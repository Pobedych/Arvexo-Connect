from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.services.subscription_proxy import proxy_subscription
from app.services.subscription_service import ensure_subscription_accessible, require_subscription_by_token

router = APIRouter(tags=["public-subscription"])


@router.get("/u/{token}")
async def get_public_subscription(token: str, session: AsyncSession = Depends(get_db_session)):
    subscription = await require_subscription_by_token(session, token)
    ensure_subscription_accessible(subscription)
    response = await proxy_subscription(session, subscription)
    await session.commit()
    return response
