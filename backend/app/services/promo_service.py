from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.enums import PromoCodeStatus, RoutingMode
from app.models.promo_code import PromoCode
from app.models.promo_redemption import PromoRedemption
from app.models.user import User
from app.schemas.common import SubscriptionOut
from app.schemas.promo import PromoCodeOut
from app.services.audit_service import write_audit_log
from app.services.billing_service import require_plan_by_code
from app.services.provisioning_service import provision_subscription_for_user
from app.services.subscription_service import get_subscription_by_token
from app.utils.security import generate_promo_code, hash_promo_code, normalize_promo_code, verify_promo_code
from app.utils.time import utc_now


async def create_promo_code(
    session: AsyncSession,
    plan_code: str,
    max_redemptions: int,
    expires_at,
    note: str | None,
    code_prefix: str,
) -> tuple[PromoCode, str]:
    plan = await require_plan_by_code(session, plan_code)
    plain_code = generate_promo_code(code_prefix)
    promo = PromoCode(
        plan_id=plan.id,
        code_hash=hash_promo_code(plain_code),
        code_prefix=normalize_promo_code(plain_code).split("-", 1)[0],
        max_redemptions=max_redemptions,
        expires_at=expires_at,
        note=note,
    )
    session.add(promo)
    await session.flush()
    await write_audit_log(session, "promo_code_created", metadata={"promo_code_id": str(promo.id), "plan_code": plan.code})
    return promo, plain_code


async def list_promo_codes(session: AsyncSession) -> list[PromoCode]:
    result = await session.execute(
        select(PromoCode).options(selectinload(PromoCode.plan)).order_by(PromoCode.created_at.desc())
    )
    return list(result.scalars().all())


async def redeem_promo_code(session: AsyncSession, user_id: UUID, code: str) -> SubscriptionOut:
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # FOR UPDATE: без блокировки строки промокода два параллельных редима читали
    # redemptions_count до инкремента и оба могли проскочить проверку лимита (Low,
    # см. SECURITY_REVIEW.md, "Low / гигиена").
    promo = await find_active_promo_code(session, code, lock=True)
    if promo.redemptions_count >= promo.max_redemptions:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Promo code is fully redeemed")
    if promo.expires_at and promo.expires_at <= utc_now():
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Promo code expired")

    existing = await session.execute(
        select(PromoRedemption)
        .where(PromoRedemption.promo_code_id == promo.id, PromoRedemption.user_id == user_id)
        .with_for_update()
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Promo code already redeemed")

    custom_config = (promo.plan.features or {}).get("custom_config") if promo.plan else None
    duration_days = int(custom_config.get("duration_days", promo.plan.duration_days)) if custom_config else promo.plan.duration_days
    device_limit = int(custom_config.get("devices_count", promo.plan.device_limit)) if custom_config else promo.plan.device_limit
    routing_mode = RoutingMode(custom_config.get("default_mode", RoutingMode.SMART.value)) if custom_config else RoutingMode.SMART

    provisioned = await provision_subscription_for_user(
        session=session,
        user=user,
        routing_mode=routing_mode,
        duration_days=duration_days,
        device_limit=device_limit,
        traffic_limit_gb=None,
        note=f"Promo {promo.id} / plan {promo.plan.code}",
        plan_id=promo.plan_id,
    )
    subscription = await get_subscription_by_token(session, provisioned.subscription.token)
    if subscription is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Subscription was not created")

    promo.redemptions_count += 1
    session.add(PromoRedemption(promo_code_id=promo.id, user_id=user_id, subscription_id=subscription.id))
    await write_audit_log(session, "promo_code_redeemed", user_id=user_id, metadata={"promo_code_id": str(promo.id)})
    return provisioned.subscription


async def find_active_promo_code(session: AsyncSession, code: str, lock: bool = False) -> PromoCode:
    normalized = normalize_promo_code(code)
    prefix = normalized.split("-", 1)[0]
    query = (
        select(PromoCode)
        .options(selectinload(PromoCode.plan))
        .where(PromoCode.status == PromoCodeStatus.ACTIVE.value, PromoCode.code_prefix == prefix)
    )
    if lock:
        query = query.with_for_update()
    result = await session.execute(query)
    for promo in result.scalars().all():
        if verify_promo_code(normalized, promo.code_hash):
            return promo
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promo code not found")


def promo_code_to_out(promo: PromoCode) -> PromoCodeOut:
    return PromoCodeOut(
        id=promo.id,
        plan_code=promo.plan.code,
        plan_name=promo.plan.name,
        code_prefix=promo.code_prefix,
        status=promo.status,
        max_redemptions=promo.max_redemptions,
        redemptions_count=promo.redemptions_count,
        expires_at=promo.expires_at,
        note=promo.note,
        created_at=promo.created_at,
    )
