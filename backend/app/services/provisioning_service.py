from dataclasses import dataclass
from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import RoutingMode, SubscriptionStatus
from app.models.access_key import AccessKey
from app.models.telegram_account import TelegramAccount
from app.models.user import User
from app.models.vpn_subscription import VpnSubscription
from app.schemas.common import SubscriptionOut, UserOut, subscription_to_out
from app.services.access_key_service import create_access_key
from app.services.audit_service import write_audit_log
from app.services.subscription_service import create_subscription
from app.services.token_generator import generate_public_token
from app.services.user_service import create_user, upsert_telegram_user
from app.services.xui_client import XuiClient
from app.utils.time import utc_now


@dataclass(frozen=True)
class ProvisionResult:
    user: UserOut
    subscription: SubscriptionOut
    access_key: str | None = None


async def provision_subscription(
    session: AsyncSession,
    display_name: str | None,
    telegram_id: int | None,
    routing_mode: RoutingMode,
    duration_days: int,
    device_limit: int,
    traffic_limit_gb: int | None,
    note: str | None,
    status_value: SubscriptionStatus = SubscriptionStatus.ACTIVE,
    create_key: bool = True,
) -> ProvisionResult:
    await write_audit_log(session, "provisioning_started", metadata={"telegram_id": telegram_id})

    if telegram_id is not None:
        user, _ = await upsert_telegram_user(session, telegram_id=telegram_id)
        if display_name:
            user.display_name = display_name
    else:
        user = await create_user(session, display_name=display_name)

    public_token = await _generate_unique_token(session)
    expires_at = utc_now() + timedelta(days=duration_days)
    xui = XuiClient()
    try:
        created_client = await xui.add_client(
            public_token=public_token,
            telegram_id=telegram_id,
            expires_at=expires_at,
            traffic_limit_gb=traffic_limit_gb,
        )
    except Exception:
        await write_audit_log(session, "provisioning_failed", user_id=user.id, metadata={"token_prefix": public_token[:9]})
        raise

    subscription = await create_subscription(
        session,
        user_id=user.id,
        original_sub_url=created_client.original_sub_url,
        routing_mode=routing_mode,
        expires_at=expires_at,
        device_limit=device_limit,
        traffic_limit_gb=traffic_limit_gb,
        note=note,
        public_token=public_token,
        status_value=status_value,
        xui_client_uuid=created_client.client_uuid,
        xui_client_email=created_client.client_email,
        xui_sub_id=created_client.sub_id,
        xui_inbound_ids=created_client.inbound_ids,
    )
    await write_audit_log(
        session,
        "xui_client_created",
        user_id=user.id,
        metadata={"token_prefix": public_token[:9], "inbound_ids": created_client.inbound_ids},
    )

    access_key = await create_access_key(session, user.id) if create_key else None
    await session.flush()
    return ProvisionResult(
        user=UserOut.model_validate(user),
        subscription=subscription_to_out(subscription),
        access_key=access_key,
    )


async def provision_subscription_for_user(
    session: AsyncSession,
    user: User,
    routing_mode: RoutingMode,
    duration_days: int,
    device_limit: int,
    traffic_limit_gb: int | None,
    note: str | None,
    plan_id=None,
    status_value: SubscriptionStatus = SubscriptionStatus.ACTIVE,
) -> ProvisionResult:
    await write_audit_log(session, "provisioning_started", user_id=user.id)

    public_token = await _generate_unique_token(session)
    expires_at = utc_now() + timedelta(days=duration_days)
    xui = XuiClient()
    try:
        created_client = await xui.add_client(
            public_token=public_token,
            telegram_id=None,
            expires_at=expires_at,
            traffic_limit_gb=traffic_limit_gb,
        )
    except Exception:
        await write_audit_log(session, "provisioning_failed", user_id=user.id, metadata={"token_prefix": public_token[:9]})
        raise

    subscription = await create_subscription(
        session,
        user_id=user.id,
        original_sub_url=created_client.original_sub_url,
        routing_mode=routing_mode,
        expires_at=expires_at,
        device_limit=device_limit,
        traffic_limit_gb=traffic_limit_gb,
        note=note,
        plan_id=plan_id,
        public_token=public_token,
        status_value=status_value,
        xui_client_uuid=created_client.client_uuid,
        xui_client_email=created_client.client_email,
        xui_sub_id=created_client.sub_id,
        xui_inbound_ids=created_client.inbound_ids,
    )
    await write_audit_log(
        session,
        "xui_client_created",
        user_id=user.id,
        metadata={"token_prefix": public_token[:9], "inbound_ids": created_client.inbound_ids},
    )

    result = await session.execute(select(AccessKey).where(AccessKey.user_id == user.id, AccessKey.is_active.is_(True)))
    access_key = None if result.scalar_one_or_none() is not None else await create_access_key(session, user.id)
    await session.flush()
    return ProvisionResult(
        user=UserOut.model_validate(user),
        subscription=subscription_to_out(subscription),
        access_key=access_key,
    )


async def provision_trial(
    session: AsyncSession,
    telegram_id: int,
    username: str | None,
    first_name: str | None,
    duration_hours: int,
) -> ProvisionResult:
    user, _ = await upsert_telegram_user(
        session,
        telegram_id=telegram_id,
        username=username,
        first_name=first_name,
    )
    existing_trial = await session.execute(
        select(VpnSubscription)
        .join(TelegramAccount, TelegramAccount.user_id == VpnSubscription.user_id)
        .where(TelegramAccount.telegram_id == telegram_id, VpnSubscription.status == SubscriptionStatus.TRIAL.value)
    )
    if existing_trial.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Trial already used")

    days = max(1, (duration_hours + 23) // 24)
    return await provision_subscription(
        session=session,
        display_name=user.display_name,
        telegram_id=telegram_id,
        routing_mode=RoutingMode.SMART,
        duration_days=days,
        device_limit=1,
        traffic_limit_gb=None,
        note="Telegram trial",
        status_value=SubscriptionStatus.TRIAL,
        create_key=False,
    )


async def _generate_unique_token(session: AsyncSession) -> str:
    for _ in range(8):
        token = generate_public_token()
        result = await session.execute(select(VpnSubscription).where(VpnSubscription.public_token == token))
        if result.scalar_one_or_none() is None:
            return token
    raise RuntimeError("Failed to generate unique public token")
