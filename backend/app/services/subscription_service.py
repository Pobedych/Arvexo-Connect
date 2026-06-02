import uuid
from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import RoutingMode, SubscriptionStatus
from app.models.telegram_account import TelegramAccount
from app.models.user import User
from app.models.vpn_subscription import VpnSubscription
from app.services.audit_service import write_audit_log
from app.services.token_generator import generate_public_token
from app.utils.time import is_expired, utc_now


async def get_subscription_by_token(session: AsyncSession, token: str) -> VpnSubscription | None:
    result = await session.execute(select(VpnSubscription).where(VpnSubscription.public_token == token))
    return result.scalar_one_or_none()


async def require_subscription_by_token(session: AsyncSession, token: str) -> VpnSubscription:
    subscription = await get_subscription_by_token(session, token)
    if subscription is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid token")
    return subscription


def ensure_subscription_accessible(subscription: VpnSubscription) -> None:
    if subscription.status not in (SubscriptionStatus.ACTIVE.value, SubscriptionStatus.TRIAL.value):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Subscription inactive")
    if is_expired(subscription.expires_at):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Subscription expired")


async def create_subscription(
    session: AsyncSession,
    user_id: uuid.UUID,
    original_sub_url: str,
    routing_mode: RoutingMode = RoutingMode.SMART,
    expires_at=None,
    device_limit: int = 3,
    traffic_limit_gb: int | None = None,
    note: str | None = None,
    public_token: str | None = None,
    status_value: SubscriptionStatus = SubscriptionStatus.ACTIVE,
    xui_client_uuid: str | None = None,
    xui_client_email: str | None = None,
    xui_sub_id: str | None = None,
    xui_inbound_ids: list[int] | None = None,
) -> VpnSubscription:
    if public_token is None:
        for _ in range(8):
            public_token = generate_public_token()
            exists = await get_subscription_by_token(session, public_token)
            if exists is None:
                break
        else:
            raise RuntimeError("Failed to generate unique public token")

    subscription = VpnSubscription(
        user_id=user_id,
        public_token=public_token,
        routing_mode=routing_mode.value,
        status=status_value.value,
        original_sub_url=original_sub_url,
        xui_client_uuid=xui_client_uuid,
        xui_client_email=xui_client_email,
        xui_sub_id=xui_sub_id,
        xui_inbound_ids=xui_inbound_ids,
        expires_at=expires_at,
        device_limit=device_limit,
        traffic_limit_gb=traffic_limit_gb,
        note=note,
    )
    session.add(subscription)
    await write_audit_log(session, "subscription_created", user_id=user_id, metadata={"token_prefix": public_token[:9]})
    return subscription


async def set_subscription_mode(
    session: AsyncSession,
    subscription: VpnSubscription,
    mode: RoutingMode,
    actor: str,
) -> VpnSubscription:
    subscription.routing_mode = mode.value
    await write_audit_log(
        session,
        "routing_mode_changed",
        user_id=subscription.user_id,
        metadata={"token_prefix": subscription.public_token[:9], "mode": mode.value, "actor": actor},
    )
    return subscription


async def disable_subscription(session: AsyncSession, subscription: VpnSubscription) -> VpnSubscription:
    subscription.status = SubscriptionStatus.DISABLED.value
    await write_audit_log(
        session,
        "subscription_disabled",
        user_id=subscription.user_id,
        metadata={"token_prefix": subscription.public_token[:9]},
    )
    return subscription


async def extend_subscription(session: AsyncSession, subscription: VpnSubscription, days: int) -> VpnSubscription:
    base = subscription.expires_at if subscription.expires_at and subscription.expires_at > utc_now() else utc_now()
    subscription.expires_at = base + timedelta(days=days)
    if subscription.status == SubscriptionStatus.EXPIRED.value:
        subscription.status = SubscriptionStatus.ACTIVE.value
    await write_audit_log(
        session,
        "subscription_extended",
        user_id=subscription.user_id,
        metadata={"token_prefix": subscription.public_token[:9], "days": days},
    )
    return subscription


async def require_telegram_owns_subscription(
    session: AsyncSession,
    telegram_id: int,
    token: str,
) -> VpnSubscription:
    result = await session.execute(
        select(VpnSubscription)
        .join(User, User.id == VpnSubscription.user_id)
        .join(TelegramAccount, TelegramAccount.user_id == User.id)
        .where(TelegramAccount.telegram_id == telegram_id, VpnSubscription.public_token == token)
    )
    subscription = result.scalar_one_or_none()
    if subscription is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    return subscription
