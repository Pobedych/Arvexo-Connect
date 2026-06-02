from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.services.subscription_proxy import build_subscription_headers, proxy_subscription
from app.services.subscription_service import ensure_subscription_accessible, require_subscription_by_token

router = APIRouter(tags=["public-subscription"])


@router.get("/u/{token}")
async def get_public_subscription(token: str, session: AsyncSession = Depends(get_db_session)):
    subscription = await require_subscription_by_token(session, token)
    ensure_subscription_accessible(subscription)
    response = await proxy_subscription(session, subscription)
    await session.commit()
    return response


@router.head("/u/{token}")
async def head_public_subscription(token: str, session: AsyncSession = Depends(get_db_session)):
    subscription = await require_subscription_by_token(session, token)
    ensure_subscription_accessible(subscription)
    return Response(headers=build_subscription_headers(subscription), media_type="text/plain; charset=utf-8")
