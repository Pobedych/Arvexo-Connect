from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
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
)
from app.schemas.common import UserOut, subscription_to_out
from app.services.access_key_service import create_access_key
from app.services.subscription_service import (
    create_subscription,
    disable_subscription,
    extend_subscription,
    require_subscription_by_token,
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
    return CreateUserWithSubscriptionResponse(
        ok=True,
        user=UserOut.model_validate(user),
        subscription=subscription_to_out(subscription),
    )


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
