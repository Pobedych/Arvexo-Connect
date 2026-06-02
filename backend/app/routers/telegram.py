from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.device import Device
from app.models.telegram_account import TelegramAccount
from app.models.vpn_subscription import VpnSubscription
from app.schemas.common import subscription_to_out
from app.schemas.devices import CreateDeviceRequest, CreateDeviceResponse, DeleteDeviceResponse, DevicesResponse, DeviceOut
from app.schemas.telegram import (
    TelegramChangeModeRequest,
    TelegramChangeModeResponse,
    TelegramNotificationRequest,
    TelegramNotificationResponse,
    TelegramSubscriptionsResponse,
    TelegramTrialProvisionRequest,
    TelegramTrialProvisionResponse,
    TelegramUpsertRequest,
    TelegramUpsertResponse,
)
from app.schemas.telegram_link import TelegramConsumeLinkRequest, TelegramConsumeLinkResponse
from app.services.provisioning_service import provision_trial
from app.services.audit_service import write_audit_log
from app.services.subscription_service import require_telegram_owns_subscription, set_subscription_mode
from app.services.telegram_link_service import consume_telegram_link_token
from app.services.user_service import upsert_telegram_user
from app.utils.security import require_bot_token

router = APIRouter(prefix="/api/telegram", tags=["telegram"], dependencies=[Depends(require_bot_token)])


@router.post("/users/upsert", response_model=TelegramUpsertResponse)
async def upsert_user(payload: TelegramUpsertRequest, session: AsyncSession = Depends(get_db_session)):
    user, _ = await upsert_telegram_user(
        session,
        telegram_id=payload.telegram_id,
        username=payload.username,
        first_name=payload.first_name,
        last_name=payload.last_name,
        language_code=payload.language_code,
    )
    await session.commit()
    return TelegramUpsertResponse(ok=True, user_id=str(user.id), telegram_id=payload.telegram_id)


@router.post("/link-token/consume", response_model=TelegramConsumeLinkResponse)
async def consume_link_token(payload: TelegramConsumeLinkRequest, session: AsyncSession = Depends(get_db_session)):
    user_id, telegram_id = await consume_telegram_link_token(
        session=session,
        plain_token=payload.token,
        telegram_id=payload.telegram_id,
        username=payload.username,
        first_name=payload.first_name,
        last_name=payload.last_name,
        language_code=payload.language_code,
    )
    await session.commit()
    return TelegramConsumeLinkResponse(ok=True, user_id=str(user_id), telegram_id=telegram_id)


@router.get("/users/{telegram_id}/subscriptions", response_model=TelegramSubscriptionsResponse)
async def get_telegram_subscriptions(telegram_id: int, session: AsyncSession = Depends(get_db_session)):
    account_result = await session.execute(select(TelegramAccount).where(TelegramAccount.telegram_id == telegram_id))
    account = account_result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Telegram user not found")

    subscriptions_result = await session.execute(
        select(VpnSubscription).where(VpnSubscription.user_id == account.user_id)
    )
    subscriptions = [subscription_to_out(item) for item in subscriptions_result.scalars().all()]
    return TelegramSubscriptionsResponse(telegram_id=telegram_id, subscriptions=subscriptions)


@router.post("/subscriptions/{token}/mode", response_model=TelegramChangeModeResponse)
async def change_telegram_subscription_mode(
    token: str,
    payload: TelegramChangeModeRequest,
    session: AsyncSession = Depends(get_db_session),
):
    subscription = await require_telegram_owns_subscription(session, payload.telegram_id, token)
    await set_subscription_mode(session, subscription, payload.mode, actor="telegram")
    await session.commit()
    return TelegramChangeModeResponse(
        ok=True,
        routing_mode=subscription.routing_mode,
        message="Mode updated. Ask user to refresh subscription in VPN app.",
    )


@router.get("/subscriptions/{token}/devices", response_model=DevicesResponse)
async def get_telegram_subscription_devices(
    token: str,
    telegram_id: int,
    session: AsyncSession = Depends(get_db_session),
):
    subscription = await require_telegram_owns_subscription(session, telegram_id, token)
    result = await session.execute(
        select(Device).where(Device.subscription_id == subscription.id, Device.is_active.is_(True)).order_by(Device.created_at.desc())
    )
    return DevicesResponse(devices=[DeviceOut.model_validate(device) for device in result.scalars().all()])


@router.post("/subscriptions/{token}/devices", response_model=CreateDeviceResponse, status_code=status.HTTP_201_CREATED)
async def create_telegram_subscription_device(
    token: str,
    telegram_id: int,
    payload: CreateDeviceRequest,
    session: AsyncSession = Depends(get_db_session),
):
    subscription = await require_telegram_owns_subscription(session, telegram_id, token)
    count = int(
        (
            await session.execute(
                select(func.count()).select_from(Device).where(Device.subscription_id == subscription.id, Device.is_active.is_(True))
            )
        ).scalar_one()
    )
    if count >= subscription.device_limit:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Device limit reached")
    device = Device(subscription_id=subscription.id, name=payload.name, type=payload.type)
    session.add(device)
    await session.commit()
    await session.refresh(device)
    return CreateDeviceResponse(ok=True, device=DeviceOut.model_validate(device))


@router.delete("/subscriptions/{token}/devices/{device_id}", response_model=DeleteDeviceResponse)
async def delete_telegram_subscription_device(
    token: str,
    device_id: UUID,
    telegram_id: int,
    session: AsyncSession = Depends(get_db_session),
):
    subscription = await require_telegram_owns_subscription(session, telegram_id, token)
    device = await session.get(Device, device_id)
    if device is None or device.subscription_id != subscription.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    await session.delete(device)
    await session.commit()
    return DeleteDeviceResponse(ok=True)


@router.post("/provision-trial", response_model=TelegramTrialProvisionResponse)
async def provision_telegram_trial(
    payload: TelegramTrialProvisionRequest,
    session: AsyncSession = Depends(get_db_session),
):
    result = await provision_trial(
        session=session,
        telegram_id=payload.telegram_id,
        username=payload.username,
        first_name=payload.first_name,
        duration_hours=payload.duration_hours,
    )
    await session.commit()
    return TelegramTrialProvisionResponse(ok=True, subscription=result.subscription)


@router.post("/notifications", response_model=TelegramNotificationResponse)
async def record_telegram_notification(payload: TelegramNotificationRequest, session: AsyncSession = Depends(get_db_session)):
    account_result = await session.execute(select(TelegramAccount).where(TelegramAccount.telegram_id == payload.telegram_id))
    account = account_result.scalar_one_or_none()
    await write_audit_log(
        session,
        "telegram_notification_requested",
        user_id=account.user_id if account else None,
        metadata={"telegram_id": payload.telegram_id, "event": payload.event, "token_prefix": payload.token[:9] if payload.token else None},
    )
    await session.commit()
    return TelegramNotificationResponse(ok=True)
