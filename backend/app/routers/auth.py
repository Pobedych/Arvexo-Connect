from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.schemas.auth import AccessKeyRequest, AccessKeyResponse
from app.schemas.common import subscription_to_out
from app.services.access_key_service import authenticate_access_key

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/access-key", response_model=AccessKeyResponse)
async def authenticate_by_access_key(payload: AccessKeyRequest, session: AsyncSession = Depends(get_db_session)):
    authenticated = await authenticate_access_key(session, payload.access_key)
    if authenticated is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access key")

    user_id, subscriptions = authenticated
    await session.commit()
    return AccessKeyResponse(
        ok=True,
        user_id=user_id,
        subscriptions=[subscription_to_out(subscription) for subscription in subscriptions],
    )
