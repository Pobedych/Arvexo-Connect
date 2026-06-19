import secrets
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
from app.utils.qr import qr_data_uri
from app.utils.time import utc_now


CUSTOM_ALLOWED_DURATIONS = {30, 90, 180, 365}
CUSTOM_ALLOWED_DEVICES = {1, 3, 5, 10}
UNPAID_ORDER_STATUSES = {
    OrderStatus.PENDING.value,
    OrderStatus.WAITING_CONFIRMATION.value,
}
UNPAID_ORDER_RETENTION_DAYS = 14

# Соль на сумму TRC20-платежа: без неё два заказа на один тариф получают одинаковый
# crypto_amount (он считается детерминированно из цены/курса), и TRC20-монитор не может
# различить, какой заказ реально оплачен (CRITICAL, см. SECURITY_REVIEW.md, п.1).
CRYPTO_AMOUNT_SALT_MIN = Decimal("0.0001")
CRYPTO_AMOUNT_SALT_MAX = Decimal("0.0099")
CRYPTO_AMOUNT_SALT_STEP = Decimal("0.0001")
CRYPTO_AMOUNT_SALT_UNIQUENESS_ATTEMPTS = 25


def require_payment_configuration(payment_method: PaymentMethod) -> None:
    if settings.app_env != "production":
        return
    if payment_method == PaymentMethod.CRYPTO_MANUAL and (not settings.crypto_payment_address or not settings.rub_usdt_rate):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Crypto payment address or RUB/USDT rate is not configured")
    if payment_method == PaymentMethod.TON_MANUAL and (not settings.ton_payment_address or not settings.ton_usdt_rate or not settings.rub_usdt_rate):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="TON payment address or rates are not configured")
    if payment_method == PaymentMethod.SBP_MANUAL and not any(
        [settings.sbp_payment_recipient, settings.sbp_payment_url, settings.sbp_qr_payload, settings.sbp_qr_image_base64]
    ):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="SBP payment details are not configured")


def order_payment_purpose(order_id) -> str:
    return f"Arvexo Connect order {order_id}"


def amount_to_usdt(amount: Decimal, currency: str) -> Decimal:
    normalized_currency = currency.upper()
    if normalized_currency in {"USDT", "USD"}:
        return amount.quantize(Decimal("0.000001"))
    if normalized_currency != "RUB":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Unsupported plan currency: {currency}")
    if not settings.rub_usdt_rate or settings.rub_usdt_rate <= 0:
        if settings.app_env == "production":
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="RUB/USDT rate is not configured")
        return (amount / Decimal("100.00")).quantize(Decimal("0.000001"))
    return (amount / settings.rub_usdt_rate).quantize(Decimal("0.000001"))


def calculate_payment_amount(amount: Decimal, currency: str, payment_method: PaymentMethod) -> Decimal:
    if payment_method == PaymentMethod.SBP_MANUAL:
        return amount
    usdt_amount = amount_to_usdt(amount, currency)
    if payment_method == PaymentMethod.CRYPTO_MANUAL:
        return usdt_amount
    if not settings.ton_usdt_rate or settings.ton_usdt_rate <= 0:
        if settings.app_env == "production":
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="TON payment rate is not configured")
        return usdt_amount
    return (usdt_amount / settings.ton_usdt_rate).quantize(Decimal("0.000000001"))


def payment_currency_for_method(payment_method: str) -> str:
    if payment_method == PaymentMethod.TON_MANUAL.value:
        return "TON"
    if payment_method == PaymentMethod.SBP_MANUAL.value:
        return "RUB"
    return "USDT"


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

    base_monthly = Decimal("299.00")
    device_addon = {
        1: Decimal("0.00"),
        3: Decimal("200.00"),
        5: Decimal("400.00"),
        10: Decimal("900.00"),
    }[config.devices_count]
    mode_addon = Decimal("150.00") if config.default_mode == RoutingMode.GLOBAL else Decimal("0.00")
    iphone_addon = Decimal("150.00") if config.iphone_stable else Decimal("0.00")
    support_addon = Decimal("300.00") if config.priority_support else Decimal("0.00")
    backup_addon = Decimal("150.00") if config.backup_profiles else Decimal("0.00")
    custom_routing_addon = Decimal("250.00") if config.custom_routing_ready else Decimal("0.00")
    monthly = base_monthly + device_addon + mode_addon + iphone_addon + support_addon + backup_addon + custom_routing_addon
    months = Decimal(config.duration_days) / Decimal(30)
    discount = Decimal("0.90") if config.duration_days >= 180 else Decimal("1.00")
    return (monthly * months * discount).quantize(Decimal("0.01"))


def _random_crypto_salt() -> Decimal:
    steps = int((CRYPTO_AMOUNT_SALT_MAX - CRYPTO_AMOUNT_SALT_MIN) / CRYPTO_AMOUNT_SALT_STEP) + 1
    return CRYPTO_AMOUNT_SALT_MIN + CRYPTO_AMOUNT_SALT_STEP * secrets.randbelow(steps)


async def _unique_salted_crypto_amount(session: AsyncSession, base_amount: Decimal, crypto_address: str) -> Decimal:
    """Подбирает сумму к оплате, уникальную среди текущих неоплаченных TRC20-заказов на этот
    адрес, чтобы матчинг по сумме в trc20_payment_monitor не путал чужие платежи между собой."""
    candidate = base_amount
    for _ in range(CRYPTO_AMOUNT_SALT_UNIQUENESS_ATTEMPTS):
        candidate = (base_amount + _random_crypto_salt()).quantize(Decimal("0.000001"))
        result = await session.execute(
            select(Order.id).where(
                Order.crypto_address == crypto_address,
                Order.crypto_amount == candidate,
                Order.status.in_(UNPAID_ORDER_STATUSES),
            )
        )
        if result.scalar_one_or_none() is None:
            return candidate
    # Десятки коллизий подряд практически невозможны; если это всё же произошло, отдаём
    # последнего кандидата — блокировка строк в find_matching_order не даст выдать подписку
    # дважды по одной транзакции, просто платёж придётся сопоставить вручную.
    return candidate


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

    require_payment_configuration(payment_method)
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

    payment_amount = calculate_payment_amount(amount, plan.currency, payment_method)
    if payment_method == PaymentMethod.CRYPTO_MANUAL and settings.crypto_payment_address:
        payment_amount = await _unique_salted_crypto_amount(session, payment_amount, settings.crypto_payment_address)
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
        crypto_network=(
            settings.ton_payment_network if payment_method == PaymentMethod.TON_MANUAL
            else settings.crypto_payment_network if payment_method == PaymentMethod.CRYPTO_MANUAL
            else None
        ),
        crypto_address=(
            settings.ton_payment_address if payment_method == PaymentMethod.TON_MANUAL
            else settings.crypto_payment_address if payment_method == PaymentMethod.CRYPTO_MANUAL
            else None
        ),
        crypto_amount=payment_amount if payment_method in (PaymentMethod.CRYPTO_MANUAL, PaymentMethod.TON_MANUAL) else None,
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
    await cleanup_old_unpaid_orders(session, user_id)
    result = await session.execute(
        select(Order)
        .options(selectinload(Order.plan), selectinload(Order.subscription))
        .where(Order.user_id == user_id)
        .order_by(Order.created_at.desc())
    )
    return list(result.scalars().all())


async def cleanup_old_unpaid_orders(session: AsyncSession, user_id: UUID) -> int:
    cutoff = utc_now() - timedelta(days=UNPAID_ORDER_RETENTION_DAYS)
    result = await session.execute(
        select(Order).where(
            Order.user_id == user_id,
            Order.status.in_(UNPAID_ORDER_STATUSES),
            Order.subscription_id.is_(None),
            Order.created_at < cutoff,
        )
    )
    orders = list(result.scalars().all())
    for order in orders:
        await session.delete(order)
    if orders:
        await session.flush()
    return len(orders)


async def delete_unpaid_order(session: AsyncSession, order: Order) -> None:
    if order.status not in UNPAID_ORDER_STATUSES or order.subscription_id is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only unpaid orders can be deleted")
    await write_audit_log(session, "order_deleted_by_user", user_id=order.user_id, metadata={"order_id": str(order.id)})
    await session.delete(order)


async def submit_order_payment(session: AsyncSession, order: Order, payment_reference: str) -> Order:
    if order.status not in (OrderStatus.PENDING.value, OrderStatus.WAITING_CONFIRMATION.value):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order cannot be updated")
    order.tx_hash = payment_reference.strip()
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
        payment_amount=order.crypto_amount if order.crypto_amount is not None else order.amount,
        payment_currency=payment_currency_for_method(order.payment_method),
        payment_method=order.payment_method,
        provider=order.provider,
        provider_payment_id=order.provider_payment_id,
        payment_url=order.payment_url,
        qr_payload=order.qr_payload,
        # Если админ не загрузил готовую картинку QR (settings.sbp_qr_image_base64),
        # раньше фронтенд сам тянул её с api.qrserver.com, передавая туда qr_payload —
        # см. SECURITY_REVIEW.md, п.11. Теперь рисуем QR на сервере по требованию.
        qr_image_base64=order.qr_image_base64 or (qr_data_uri(order.qr_payload) if order.qr_payload else None),
        payment_recipient=order.payment_recipient,
        crypto_network=order.crypto_network,
        crypto_address=order.crypto_address,
        crypto_amount=order.crypto_amount,
        tx_hash=order.tx_hash,
        payment_reference=order.tx_hash,
        payment_purpose=order_payment_purpose(order.id),
        custom_config=metadata.get("custom_config"),
        subscription_token=subscription_token,
        created_at=order.created_at,
        updated_at=order.updated_at,
        paid_at=order.paid_at,
        expires_at=order.expires_at,
    )
