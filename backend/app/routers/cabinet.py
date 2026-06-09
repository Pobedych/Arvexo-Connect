from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db_session
from app.models.device import Device
from app.models.access_key import AccessKey
from app.models.user import User
from app.models.telegram_account import TelegramAccount
from app.schemas.billing import (
    CreateOrderRequest,
    CreateOrderResponse,
    CustomPlanConfig,
    CustomPlanQuoteResponse,
    OrdersResponse,
    PlansResponse,
    PlanOut,
    SubmitPaymentRequest,
)
from app.schemas.cabinet import CabinetSettingsResponse, ChangeModeRequest, ChangeModeResponse, IssueCabinetAccessKeyResponse, UpdateCabinetSettingsRequest
from app.schemas.common import SubscriptionOut, subscription_to_out
from app.schemas.devices import CreateDeviceRequest, CreateDeviceResponse, DeleteDeviceResponse, DevicesResponse, DeviceOut
from app.schemas.promo import RedeemPromoCodeRequest, RedeemPromoCodeResponse
from app.schemas.telegram_link import TelegramLinkTokenResponse, TelegramStatusResponse, TelegramUnlinkResponse
from app.services.billing_service import (
    create_order_for_user,
    list_active_plans,
    list_user_orders,
    load_order_for_output,
    order_to_out,
    quote_custom_plan,
    require_user_order,
    submit_order_payment,
)
from app.services.access_key_service import create_access_key
from app.services.promo_service import redeem_promo_code
from app.services.subscription_service import (
    require_subscription_by_token,
    set_subscription_mode,
)
from app.services.telegram_link_service import create_telegram_link_token, unlink_telegram_accounts
from app.utils.security import require_cabinet_user_id

router = APIRouter(prefix="/api/cabinet", tags=["cabinet"])


@router.get("/settings", response_model=CabinetSettingsResponse)
async def get_settings(
    user_id: UUID = Depends(require_cabinet_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    active_keys = int(
        (
            await session.execute(
                select(func.count()).select_from(AccessKey).where(AccessKey.user_id == user_id, AccessKey.is_active.is_(True))
            )
        ).scalar_one()
    )
    return CabinetSettingsResponse(ok=True, email=user.email, display_name=user.display_name, active_access_keys=active_keys)


@router.post("/settings", response_model=CabinetSettingsResponse)
async def update_settings(
    payload: UpdateCabinetSettingsRequest,
    user_id: UUID = Depends(require_cabinet_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.display_name = payload.display_name.strip() if payload.display_name else None
    await session.commit()
    return await get_settings(user_id, session)


@router.post("/access-keys", response_model=IssueCabinetAccessKeyResponse)
async def issue_access_key(
    user_id: UUID = Depends(require_cabinet_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    access_key = await create_access_key(session, user_id)
    await session.commit()
    return IssueCabinetAccessKeyResponse(
        ok=True,
        access_key=access_key,
        warning="This key is shown only once. Store it securely.",
    )


@router.get("/plans", response_model=PlansResponse)
async def get_plans(session: AsyncSession = Depends(get_db_session)):
    plans = await list_active_plans(session)
    return PlansResponse(plans=[PlanOut.model_validate(plan) for plan in plans])


@router.post("/custom-plan/quote", response_model=CustomPlanQuoteResponse)
async def quote_custom_plan_endpoint(payload: CustomPlanConfig):
    return CustomPlanQuoteResponse(ok=True, price=quote_custom_plan(payload), currency="USDT", features=payload)


@router.get("/orders", response_model=OrdersResponse)
async def get_orders(
    user_id: UUID = Depends(require_cabinet_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    orders = await list_user_orders(session, user_id)
    return OrdersResponse(orders=[order_to_out(order) for order in orders])


@router.post("/orders", response_model=CreateOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: CreateOrderRequest,
    user_id: UUID = Depends(require_cabinet_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    order = await create_order_for_user(session, user_id, payload.plan_code, payload.payment_method, payload.custom_config)
    await session.commit()
    order = await load_order_for_output(session, order.id)
    return CreateOrderResponse(ok=True, order=order_to_out(order))


@router.post("/orders/{order_id}/payment", response_model=CreateOrderResponse)
async def submit_order_payment_endpoint(
    order_id: UUID,
    payload: SubmitPaymentRequest,
    user_id: UUID = Depends(require_cabinet_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    order = await require_user_order(session, user_id, order_id)
    await submit_order_payment(session, order, payload.reference_value)
    await session.commit()
    order = await load_order_for_output(session, order.id)
    return CreateOrderResponse(ok=True, order=order_to_out(order))


@router.post("/promo-codes/redeem", response_model=RedeemPromoCodeResponse)
async def redeem_promo_code_endpoint(
    payload: RedeemPromoCodeRequest,
    user_id: UUID = Depends(require_cabinet_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    subscription = await redeem_promo_code(session, user_id, payload.code)
    await session.commit()
    return RedeemPromoCodeResponse(ok=True, subscription=subscription, message="Promo code redeemed. Subscription activated.")


@router.get("/telegram/status", response_model=TelegramStatusResponse)
async def get_telegram_status(
    user_id: UUID = Depends(require_cabinet_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    result = await session.execute(select(TelegramAccount).where(TelegramAccount.user_id == user_id))
    accounts = list(result.scalars().all())
    return TelegramStatusResponse(connected=bool(accounts), telegram_ids=[account.telegram_id for account in accounts])


@router.post("/telegram/link-token", response_model=TelegramLinkTokenResponse)
async def create_telegram_link(
    user_id: UUID = Depends(require_cabinet_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    token, plain = await create_telegram_link_token(session, user_id)
    await session.commit()
    bot_url = settings.telegram_bot_url.rstrip("/") if settings.telegram_bot_url else "https://t.me/ARVEXO_BOT"
    return TelegramLinkTokenResponse(ok=True, telegram_link_url=f"{bot_url}?start={plain}", expires_at=token.expires_at.isoformat())


@router.delete("/telegram/link", response_model=TelegramUnlinkResponse)
async def unlink_telegram(
    user_id: UUID = Depends(require_cabinet_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    removed = await unlink_telegram_accounts(session, user_id)
    await session.commit()
    return TelegramUnlinkResponse(ok=True, removed=removed)


@router.get("/subscription/{token}/devices", response_model=DevicesResponse)
async def list_subscription_devices(
    token: str,
    user_id: UUID = Depends(require_cabinet_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    subscription = await require_subscription_by_token(session, token)
    require_subscription_owner(subscription.user_id, user_id)
    result = await session.execute(
        select(Device).where(Device.subscription_id == subscription.id, Device.is_active.is_(True)).order_by(Device.created_at.desc())
    )
    return DevicesResponse(devices=[DeviceOut.model_validate(device) for device in result.scalars().all()])


@router.post("/subscription/{token}/devices", response_model=CreateDeviceResponse, status_code=status.HTTP_201_CREATED)
async def create_subscription_device(
    token: str,
    payload: CreateDeviceRequest,
    user_id: UUID = Depends(require_cabinet_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    subscription = await require_subscription_by_token(session, token)
    require_subscription_owner(subscription.user_id, user_id)
    count = int(
        (await session.execute(
            select(func.count()).select_from(Device).where(Device.subscription_id == subscription.id, Device.is_active.is_(True))
        )).scalar_one()
    )
    if count >= subscription.device_limit:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Device limit reached")
    device = Device(subscription_id=subscription.id, name=payload.name, type=payload.type)
    session.add(device)
    await session.commit()
    await session.refresh(device)
    return CreateDeviceResponse(ok=True, device=DeviceOut.model_validate(device))


@router.delete("/subscription/{token}/devices/{device_id}", response_model=DeleteDeviceResponse)
async def delete_subscription_device(
    token: str,
    device_id: UUID,
    user_id: UUID = Depends(require_cabinet_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    subscription = await require_subscription_by_token(session, token)
    require_subscription_owner(subscription.user_id, user_id)
    device = await session.get(Device, device_id)
    if device is None or device.subscription_id != subscription.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    await session.delete(device)
    await session.commit()
    return DeleteDeviceResponse(ok=True)


@router.get("/subscription/{token}", response_model=SubscriptionOut)
async def get_subscription_status(
    token: str,
    user_id: UUID = Depends(require_cabinet_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    subscription = await require_subscription_by_token(session, token)
    require_subscription_owner(subscription.user_id, user_id)
    return subscription_to_out(subscription)


@router.post("/subscription/{token}/mode", response_model=ChangeModeResponse)
async def change_subscription_mode(
    token: str,
    payload: ChangeModeRequest,
    user_id: UUID = Depends(require_cabinet_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    subscription = await require_subscription_by_token(session, token)
    require_subscription_owner(subscription.user_id, user_id)
    await set_subscription_mode(session, subscription, payload.mode, actor="cabinet")
    await session.commit()
    return ChangeModeResponse(
        ok=True,
        token=subscription.public_token,
        routing_mode=subscription.routing_mode,
        message="Mode updated. Refresh subscription in your VPN app.",
    )


def require_subscription_owner(subscription_user_id: UUID, user_id: UUID) -> None:
    if subscription_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Subscription does not belong to user")
