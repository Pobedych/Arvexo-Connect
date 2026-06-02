from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.telegram_account import TelegramAccount
from app.models.vpn_subscription import VpnSubscription
from app.schemas.common import subscription_to_out
from app.schemas.telegram import (
    TelegramChangeModeRequest,
    TelegramChangeModeResponse,
    TelegramSubscriptionsResponse,
    TelegramTrialProvisionRequest,
    TelegramTrialProvisionResponse,
    TelegramUpsertRequest,
    TelegramUpsertResponse,
)
from app.schemas.telegram_link import TelegramConsumeLinkRequest, TelegramConsumeLinkResponse
from app.services.provisioning_service import provision_trial
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
