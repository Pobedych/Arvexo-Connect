from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.schemas.cabinet import ChangeModeRequest, ChangeModeResponse
from app.schemas.common import SubscriptionOut, subscription_to_out
from app.services.subscription_service import (
    require_subscription_by_token,
    set_subscription_mode,
)

router = APIRouter(prefix="/api/cabinet", tags=["cabinet"])


@router.get("/subscription/{token}", response_model=SubscriptionOut)
async def get_subscription_status(token: str, session: AsyncSession = Depends(get_db_session)):
    subscription = await require_subscription_by_token(session, token)
    return subscription_to_out(subscription)


@router.post("/subscription/{token}/mode", response_model=ChangeModeResponse)
async def change_subscription_mode(
    token: str,
    payload: ChangeModeRequest,
    session: AsyncSession = Depends(get_db_session),
):
    subscription = await require_subscription_by_token(session, token)
    await set_subscription_mode(session, subscription, payload.mode, actor="cabinet")
    await session.commit()
    return ChangeModeResponse(
        ok=True,
        token=subscription.public_token,
        routing_mode=subscription.routing_mode,
        message="Mode updated. Refresh subscription in your VPN app.",
    )
