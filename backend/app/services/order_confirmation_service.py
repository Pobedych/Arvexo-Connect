from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.enums import OrderStatus, RoutingMode, SubscriptionStatus
from app.models.order import Order
from app.schemas.billing import AdminConfirmOrderResponse
from app.services.billing_service import load_order_for_output, order_to_out, require_order
from app.services.provisioning_service import provision_subscription_for_user
from app.services.subscription_service import create_subscription, get_subscription_by_token
from app.utils.time import utc_now


def subscription_url(token: str) -> str:
    return f"{settings.public_sub_base_url.rstrip('/')}/u/{token}" if token else ""


async def confirm_order_in_session(session: AsyncSession, order_id: UUID) -> AdminConfirmOrderResponse:
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
    access_key = None
    try:
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
        access_key = provisioned.access_key
        if subscription is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Subscription was not created")
    except Exception as exc:
        subscription = await create_subscription(
            session=session,
            user_id=order.user.id,
            original_sub_url=f"https://provisioning.failed.invalid/orders/{order.id}",
            routing_mode=routing_mode,
            expires_at=utc_now(),
            device_limit=device_limit,
            traffic_limit_gb=None,
            note=f"{note} / provisioning failed: {exc.__class__.__name__}",
            plan_id=order.plan_id,
            status_value=SubscriptionStatus.PROVISIONING_FAILED,
        )
        await write_provisioning_failure_audit(session, order.user.id, order.id, exc)

    order.status = OrderStatus.PAID.value
    order.paid_at = utc_now()
    order.subscription_id = subscription.id
    await session.commit()
    order = await load_order_for_output(session, order.id)
    return AdminConfirmOrderResponse(
        ok=True,
        order=order_to_out(order),
        subscription_url=subscription_url(subscription.public_token),
        access_key=access_key,
    )


async def write_provisioning_failure_audit(session: AsyncSession, user_id: UUID, order_id: UUID, exc: Exception) -> None:
    from app.services.audit_service import write_audit_log

    await write_audit_log(
        session,
        "provisioning_failed",
        user_id=user_id,
        metadata={"order_id": str(order_id), "error": exc.__class__.__name__, "message": str(exc)[:500]},
    )
