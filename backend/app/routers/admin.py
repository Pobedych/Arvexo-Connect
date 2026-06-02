from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db_session
from app.enums import OrderStatus, RoutingMode
from app.models.order import Order
from app.models.promo_code import PromoCode
from app.models.user import User
from app.schemas.billing import AdminConfirmOrderResponse
from app.schemas.billing import OrdersResponse
from app.schemas.promo import CreatePromoCodeRequest, CreatePromoCodeResponse, PromoCodesResponse
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
    AdminStatsResponse,
    AdminUserListResponse,
    ProvisionSubscriptionRequest,
    ProvisionSubscriptionResponse,
)
from app.schemas.common import UserOut, subscription_to_out
from app.services.access_key_service import create_access_key
from app.models.vpn_subscription import VpnSubscription
from app.services.billing_service import load_order_for_output, order_to_out, require_order
from app.services.provisioning_service import provision_subscription, provision_subscription_for_user
from app.services.promo_service import create_promo_code, list_promo_codes, promo_code_to_out
from app.services.subscription_service import get_subscription_by_token
from app.services.subscription_service import (
    create_subscription,
    disable_subscription,
    extend_subscription,
    require_subscription_by_token,
    set_subscription_mode,
)
from app.services.user_service import create_user, upsert_telegram_user
from app.utils.security import require_admin_token
from app.utils.time import utc_now

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin_token)])


def subscription_url(token: str) -> str:
    return f"{settings.public_sub_base_url.rstrip('/')}/u/{token}" if token else ""


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


@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(session: AsyncSession = Depends(get_db_session)):
    async def count(query):
        return int((await session.execute(query)).scalar_one())

    return AdminStatsResponse(
        users_total=await count(select(func.count()).select_from(User)),
        subscriptions_total=await count(select(func.count()).select_from(VpnSubscription)),
        subscriptions_active=await count(select(func.count()).select_from(VpnSubscription).where(VpnSubscription.status == "active")),
        orders_total=await count(select(func.count()).select_from(Order)),
        orders_pending=await count(select(func.count()).select_from(Order).where(Order.status == OrderStatus.PENDING.value)),
        orders_waiting_confirmation=await count(select(func.count()).select_from(Order).where(Order.status == OrderStatus.WAITING_CONFIRMATION.value)),
        orders_paid=await count(select(func.count()).select_from(Order).where(Order.status == OrderStatus.PAID.value)),
        promo_codes_active=await count(select(func.count()).select_from(PromoCode).where(PromoCode.status == "active")),
    )


@router.get("/subscriptions", response_model=AdminSubscriptionListResponse)
async def list_subscriptions(session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(VpnSubscription).order_by(VpnSubscription.created_at.desc()))
    return AdminSubscriptionListResponse(subscriptions=[subscription_to_out(item) for item in result.scalars().all()])


@router.get("/orders", response_model=OrdersResponse)
async def admin_list_orders(session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(
        select(Order)
        .options(selectinload(Order.plan), selectinload(Order.subscription))
        .order_by(Order.created_at.desc())
    )
    return OrdersResponse(orders=[order_to_out(order) for order in result.scalars().all()])


@router.get("/promo-codes", response_model=PromoCodesResponse)
async def admin_list_promo_codes(session: AsyncSession = Depends(get_db_session)):
    promo_codes = await list_promo_codes(session)
    return PromoCodesResponse(promo_codes=[promo_code_to_out(promo) for promo in promo_codes])


@router.post("/promo-codes", response_model=CreatePromoCodeResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_promo_code(payload: CreatePromoCodeRequest, session: AsyncSession = Depends(get_db_session)):
    promo, plain_code = await create_promo_code(
        session=session,
        plan_code=payload.plan_code,
        max_redemptions=payload.max_redemptions,
        expires_at=payload.expires_at,
        note=payload.note,
        code_prefix=payload.code_prefix,
    )
    await session.commit()
    promo_codes = await list_promo_codes(session)
    created = next(item for item in promo_codes if item.id == promo.id)
    return CreatePromoCodeResponse(
        ok=True,
        promo_code=promo_code_to_out(created),
        code=plain_code,
        warning="This promo code is shown only once. Store it securely.",
    )


@router.post("/orders/{order_id}/confirm", response_model=AdminConfirmOrderResponse)
async def confirm_order(order_id: UUID, session: AsyncSession = Depends(get_db_session)):
    order = await require_order(session, order_id)
    if order.user_id is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order has no user")
    if order.status == OrderStatus.PAID.value:
        order = await load_order_for_output(session, order.id)
        token = order.subscription.public_token if order.subscription else ""
        return AdminConfirmOrderResponse(ok=True, order=order_to_out(order), subscription_url=subscription_url(token), access_key=None)
    if order.status not in (OrderStatus.PENDING.value, OrderStatus.WAITING_CONFIRMATION.value):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order cannot be confirmed")

    result = await session.execute(
        select(Order)
        .options(selectinload(Order.plan), selectinload(Order.user))
        .where(Order.id == order.id)
    )
    order = result.scalar_one()
    if order.plan is None or order.user is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order is incomplete")

    custom_config = (order.order_metadata or {}).get("custom_config") or {}
    routing_mode = RoutingMode(custom_config.get("default_mode", RoutingMode.SMART.value))
    duration_days = int(custom_config.get("duration_days", order.plan.duration_days))
    device_limit = int(custom_config.get("devices_count", order.plan.device_limit))
    note = f"Order {order.id} / plan {order.plan.code}"
    provisioned = await provision_subscription_for_user(
        session=session,
        user=order.user,
        routing_mode=routing_mode,
        duration_days=duration_days,
        device_limit=device_limit,
        traffic_limit_gb=None,
        note=note,
        plan_id=order.plan_id,
    )
    subscription = await get_subscription_by_token(session, provisioned.subscription.token)
    if subscription is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Subscription was not created")

    order.status = OrderStatus.PAID.value
    order.paid_at = utc_now()
    order.subscription_id = subscription.id
    await session.commit()
    order = await load_order_for_output(session, order.id)
    return AdminConfirmOrderResponse(
        ok=True,
        order=order_to_out(order),
        subscription_url=subscription_url(subscription.public_token),
        access_key=provisioned.access_key,
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
