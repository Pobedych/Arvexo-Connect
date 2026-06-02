from datetime import timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.enums import OrderStatus, PaymentMethod, RoutingMode
from app.models.order import Order
from app.models.plan import Plan
from app.models.user import User
from app.schemas.billing import CustomPlanConfig, OrderOut
from app.services.audit_service import write_audit_log
from app.utils.time import utc_now


CUSTOM_ALLOWED_DURATIONS = {30, 90, 180, 365}
CUSTOM_ALLOWED_DEVICES = {1, 3, 5, 10}


async def list_active_plans(session: AsyncSession) -> list[Plan]:
    result = await session.execute(select(Plan).where(Plan.is_active.is_(True)).order_by(Plan.is_custom, Plan.price, Plan.code))
    return list(result.scalars().all())


async def require_plan_by_code(session: AsyncSession, code: str) -> Plan:
    result = await session.execute(select(Plan).where(Plan.code == code, Plan.is_active.is_(True)))
    plan = result.scalar_one_or_none()
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return plan


def quote_custom_plan(config: CustomPlanConfig) -> Decimal:
    if config.devices_count not in CUSTOM_ALLOWED_DEVICES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported devices_count")
    if config.duration_days not in CUSTOM_ALLOWED_DURATIONS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported duration_days")

    base_monthly = Decimal("4.00")
    device_addon = {
        1: Decimal("0.00"),
        3: Decimal("3.00"),
        5: Decimal("6.00"),
        10: Decimal("14.00"),
    }[config.devices_count]
    mode_addon = Decimal("2.00") if config.default_mode == RoutingMode.GLOBAL else Decimal("0.00")
    iphone_addon = Decimal("2.00") if config.iphone_stable else Decimal("0.00")
    support_addon = Decimal("4.00") if config.priority_support else Decimal("0.00")
    backup_addon = Decimal("2.00") if config.backup_profiles else Decimal("0.00")
    custom_routing_addon = Decimal("3.00") if config.custom_routing_ready else Decimal("0.00")
    monthly = base_monthly + device_addon + mode_addon + iphone_addon + support_addon + backup_addon + custom_routing_addon
    months = Decimal(config.duration_days) / Decimal(30)
    discount = Decimal("0.90") if config.duration_days >= 180 else Decimal("1.00")
    return (monthly * months * discount).quantize(Decimal("0.01"))


async def create_order_for_user(
    session: AsyncSession,
    user_id: UUID,
    plan_code: str,
    payment_method: PaymentMethod,
    custom_config: CustomPlanConfig | None,
) -> Order:
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    plan = await require_plan_by_code(session, plan_code)
    if plan.is_custom:
        if custom_config is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="custom_config is required")
        amount = quote_custom_plan(custom_config)
        order_metadata = {"custom_config": custom_config.model_dump(mode="json")}
    else:
        if custom_config is not None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="custom_config is allowed only for custom plan")
        amount = Decimal(plan.price)
        order_metadata = None

    order = Order(
        user_id=user_id,
        plan_id=plan.id,
        status=OrderStatus.PENDING.value,
        amount=amount,
        currency=plan.currency,
        payment_method=payment_method.value,
        provider=payment_method.value,
        payment_url=settings.sbp_payment_url if payment_method == PaymentMethod.SBP_MANUAL else None,
        qr_payload=settings.sbp_qr_payload if payment_method == PaymentMethod.SBP_MANUAL else None,
        qr_image_base64=settings.sbp_qr_image_base64 if payment_method == PaymentMethod.SBP_MANUAL else None,
        payment_recipient=settings.sbp_payment_recipient if payment_method == PaymentMethod.SBP_MANUAL else None,
        crypto_network=settings.crypto_payment_network if payment_method == PaymentMethod.CRYPTO_MANUAL else None,
        crypto_address=settings.crypto_payment_address if payment_method == PaymentMethod.CRYPTO_MANUAL else None,
        crypto_amount=amount if payment_method == PaymentMethod.CRYPTO_MANUAL else None,
        order_metadata=order_metadata,
        expires_at=utc_now() + timedelta(hours=24),
    )
    session.add(order)
    await session.flush()
    await write_audit_log(session, "order_created", user_id=user_id, metadata={"order_id": str(order.id), "plan_code": plan.code})
    return order


async def require_user_order(session: AsyncSession, user_id: UUID, order_id: UUID) -> Order:
    result = await session.execute(select(Order).where(Order.id == order_id, Order.user_id == user_id))
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


async def require_order(session: AsyncSession, order_id: UUID) -> Order:
    order = await session.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


async def load_order_for_output(session: AsyncSession, order_id: UUID) -> Order:
    result = await session.execute(
        select(Order)
        .options(selectinload(Order.plan), selectinload(Order.subscription))
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


async def list_user_orders(session: AsyncSession, user_id: UUID) -> list[Order]:
    result = await session.execute(
        select(Order)
        .options(selectinload(Order.plan), selectinload(Order.subscription))
        .where(Order.user_id == user_id)
        .order_by(Order.created_at.desc())
    )
    return list(result.scalars().all())


async def submit_order_payment(session: AsyncSession, order: Order, tx_hash: str) -> Order:
    if order.status not in (OrderStatus.PENDING.value, OrderStatus.WAITING_CONFIRMATION.value):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order cannot be updated")
    order.tx_hash = tx_hash
    order.status = OrderStatus.WAITING_CONFIRMATION.value
    await write_audit_log(session, "order_payment_submitted", user_id=order.user_id, metadata={"order_id": str(order.id)})
    return order


def order_to_out(order: Order) -> OrderOut:
    metadata = order.order_metadata or {}
    subscription_token = order.subscription.public_token if order.subscription else None
    return OrderOut(
        id=order.id,
        status=order.status,
        plan_code=order.plan.code if order.plan else None,
        plan_name=order.plan.name if order.plan else None,
        amount=order.amount,
        currency=order.currency,
        payment_method=order.payment_method,
        provider=order.provider,
        provider_payment_id=order.provider_payment_id,
        payment_url=order.payment_url,
        qr_payload=order.qr_payload,
        qr_image_base64=order.qr_image_base64,
        payment_recipient=order.payment_recipient,
        crypto_network=order.crypto_network,
        crypto_address=order.crypto_address,
        crypto_amount=order.crypto_amount,
        tx_hash=order.tx_hash,
        custom_config=metadata.get("custom_config"),
        subscription_token=subscription_token,
        created_at=order.created_at,
        updated_at=order.updated_at,
        paid_at=order.paid_at,
        expires_at=order.expires_at,
    )
