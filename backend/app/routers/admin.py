from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.user import User
from app.schemas.admin import (
    CreateAccessKeyResponse,
    CreateSubscriptionRequest,
    CreateSubscriptionResponse,
    CreateUserWithSubscriptionRequest,
    CreateUserWithSubscriptionResponse,
    DisableSubscriptionResponse,
    ExtendSubscriptionRequest,
    ExtendSubscriptionResponse,
    AdminChangeModeRequest,
    AdminChangeOriginalSubUrlRequest,
    AdminSubscriptionListResponse,
    AdminUserListResponse,
    ProvisionSubscriptionRequest,
    ProvisionSubscriptionResponse,
)
from app.schemas.common import UserOut, subscription_to_out
from app.services.access_key_service import create_access_key
from app.models.vpn_subscription import VpnSubscription
from app.services.provisioning_service import provision_subscription
from app.services.subscription_service import (
    create_subscription,
    disable_subscription,
    extend_subscription,
    require_subscription_by_token,
    set_subscription_mode,
)
from app.services.user_service import create_user, upsert_telegram_user
from app.utils.security import require_admin_token

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin_token)])


@router.post("/users-with-subscription", response_model=CreateUserWithSubscriptionResponse)
async def create_user_with_subscription(
    payload: CreateUserWithSubscriptionRequest,
    session: AsyncSession = Depends(get_db_session),
):
    if payload.telegram_id is not None:
        user, _ = await upsert_telegram_user(session, payload.telegram_id)
        if payload.display_name:
            user.display_name = payload.display_name
    else:
        user = await create_user(session, display_name=payload.display_name)

    subscription = await create_subscription(
        session,
        user_id=user.id,
        original_sub_url=str(payload.original_sub_url),
        routing_mode=payload.routing_mode,
        expires_at=payload.expires_at,
        device_limit=payload.device_limit,
        traffic_limit_gb=payload.traffic_limit_gb,
        note=payload.note,
    )
    await session.commit()
    await session.refresh(user)
    await session.refresh(subscription)
    access_key = await create_access_key(session, user.id)
    await session.commit()
    return CreateUserWithSubscriptionResponse(
        ok=True,
        user=UserOut.model_validate(user),
        subscription=subscription_to_out(subscription),
        access_key=access_key,
    )


@router.post("/provision-subscription", response_model=ProvisionSubscriptionResponse)
async def provision_subscription_endpoint(
    payload: ProvisionSubscriptionRequest,
    session: AsyncSession = Depends(get_db_session),
):
    result = await provision_subscription(
        session=session,
        display_name=payload.display_name,
        telegram_id=payload.telegram_id,
        routing_mode=payload.routing_mode,
        duration_days=payload.duration_days,
        device_limit=payload.device_limit,
        traffic_limit_gb=payload.traffic_limit_gb,
        note=payload.note,
    )
    await session.commit()
    return ProvisionSubscriptionResponse(
        ok=True,
        user=result.user,
        subscription=result.subscription,
        access_key=result.access_key or "",
    )


@router.get("/users", response_model=AdminUserListResponse)
async def list_users(session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(User).order_by(User.created_at.desc()))
    return AdminUserListResponse(users=[UserOut.model_validate(user) for user in result.scalars().all()])


@router.get("/subscriptions", response_model=AdminSubscriptionListResponse)
async def list_subscriptions(session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(VpnSubscription).order_by(VpnSubscription.created_at.desc()))
    return AdminSubscriptionListResponse(subscriptions=[subscription_to_out(item) for item in result.scalars().all()])


@router.post("/users/{user_id}/subscriptions", response_model=CreateSubscriptionResponse)
async def create_subscription_for_user(
    user_id: UUID,
    payload: CreateSubscriptionRequest,
    session: AsyncSession = Depends(get_db_session),
):
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    subscription = await create_subscription(
        session,
        user_id=user.id,
        original_sub_url=str(payload.original_sub_url),
        routing_mode=payload.routing_mode,
        expires_at=payload.expires_at,
        device_limit=payload.device_limit,
        traffic_limit_gb=payload.traffic_limit_gb,
        note=payload.note,
    )
    await session.commit()
    await session.refresh(subscription)
    return CreateSubscriptionResponse(ok=True, user_id=user.id, subscription=subscription_to_out(subscription))


@router.post("/subscriptions/{token}/disable", response_model=DisableSubscriptionResponse)
async def disable_subscription_endpoint(token: str, session: AsyncSession = Depends(get_db_session)):
    subscription = await require_subscription_by_token(session, token)
    await disable_subscription(session, subscription)
    await session.commit()
    return DisableSubscriptionResponse(ok=True, status=subscription.status)


@router.post("/subscriptions/{token}/extend", response_model=ExtendSubscriptionResponse)
async def extend_subscription_endpoint(
    token: str,
    payload: ExtendSubscriptionRequest,
    session: AsyncSession = Depends(get_db_session),
):
    subscription = await require_subscription_by_token(session, token)
    await extend_subscription(session, subscription, payload.days)
    await session.commit()
    return ExtendSubscriptionResponse(ok=True, expires_at=subscription.expires_at)


@router.post("/subscriptions/{token}/original-sub-url", response_model=CreateSubscriptionResponse)
async def update_original_sub_url(
    token: str,
    payload: AdminChangeOriginalSubUrlRequest,
    session: AsyncSession = Depends(get_db_session),
):
    subscription = await require_subscription_by_token(session, token)
    subscription.original_sub_url = str(payload.original_sub_url)
    await session.commit()
    return CreateSubscriptionResponse(
        ok=True,
        user_id=subscription.user_id,
        subscription=subscription_to_out(subscription),
    )


@router.post("/subscriptions/{token}/mode", response_model=CreateSubscriptionResponse)
async def admin_change_subscription_mode(
    token: str,
    payload: AdminChangeModeRequest,
    session: AsyncSession = Depends(get_db_session),
):
    subscription = await require_subscription_by_token(session, token)
    await set_subscription_mode(session, subscription, payload.mode, actor="admin")
    await session.commit()
    return CreateSubscriptionResponse(
        ok=True,
        user_id=subscription.user_id,
        subscription=subscription_to_out(subscription),
    )


@router.post("/users/{user_id}/access-keys", response_model=CreateAccessKeyResponse)
async def create_user_access_key(user_id: UUID, session: AsyncSession = Depends(get_db_session)):
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    access_key = await create_access_key(session, user.id)
    await session.commit()
    return CreateAccessKeyResponse(
        ok=True,
        access_key=access_key,
        warning="This key is shown only once. Store it securely.",
    )
