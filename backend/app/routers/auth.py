from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.vpn_subscription import VpnSubscription
from app.schemas.auth import AccessKeyRequest, AccessKeyResponse, AccountLoginRequest, AccountRegisterRequest
from app.schemas.common import subscription_to_out
from app.services.access_key_service import authenticate_access_key
from app.services.user_service import authenticate_account_user, create_account_user, get_user_by_email
from app.utils.security import create_access_token, require_cabinet_user_id

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AccessKeyResponse, status_code=status.HTTP_201_CREATED)
async def register_account(payload: AccountRegisterRequest, session: AsyncSession = Depends(get_db_session)):
    existing_user = await get_user_by_email(session, payload.email)
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Account already exists")

    user = await create_account_user(
        session,
        email=payload.email,
        password=payload.password,
        display_name=payload.display_name,
    )
    await session.commit()
    return await build_auth_response(session, str(user.id))


@router.post("/login", response_model=AccessKeyResponse)
async def login_account(payload: AccountLoginRequest, session: AsyncSession = Depends(get_db_session)):
    user = await authenticate_account_user(session, payload.email, payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    await session.commit()
    return await build_auth_response(session, str(user.id))


@router.post("/access-key", response_model=AccessKeyResponse)
async def authenticate_by_access_key(payload: AccessKeyRequest, session: AsyncSession = Depends(get_db_session)):
    authenticated = await authenticate_access_key(session, payload.access_key)
    if authenticated is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access key")

    user_id, subscriptions = authenticated
    await session.commit()
    return build_access_response(user_id, subscriptions)


@router.get("/me", response_model=AccessKeyResponse)
async def get_current_account(
    user_id: UUID = Depends(require_cabinet_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    return await build_auth_response(session, str(user_id))


async def build_auth_response(session: AsyncSession, user_id: str) -> AccessKeyResponse:
    user_uuid = UUID(user_id)
    result = await session.execute(select(VpnSubscription).where(VpnSubscription.user_id == user_uuid))
    return build_access_response(str(user_uuid), list(result.scalars().all()))


def build_access_response(user_id: str, subscriptions: list[VpnSubscription]) -> AccessKeyResponse:
    return AccessKeyResponse(
        ok=True,
        user_id=user_id,
        access_token=create_access_token(user_id),
        subscriptions=[subscription_to_out(subscription) for subscription in subscriptions],
    )
