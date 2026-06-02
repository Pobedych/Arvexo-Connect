import secrets
from datetime import timezone, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.telegram_account import TelegramAccount
from app.models.telegram_link_token import TelegramLinkToken
from app.services.audit_service import write_audit_log
from app.services.user_service import upsert_telegram_user
from app.utils.security import hash_access_key, verify_access_key
from app.utils.time import utc_now


def generate_link_token() -> str:
    return f"link_{secrets.token_urlsafe(24)}"


async def create_telegram_link_token(session: AsyncSession, user_id: UUID) -> tuple[TelegramLinkToken, str]:
    plain = generate_link_token()
    expires_at = utc_now() + timedelta(minutes=30)
    token = TelegramLinkToken(
        user_id=user_id,
        token_hash=hash_access_key(plain),
        token_prefix=plain[:12],
        expires_at=expires_at,
    )
    session.add(token)
    await session.flush()
    await write_audit_log(session, "telegram_link_token_created", user_id=user_id)
    return token, plain


async def consume_telegram_link_token(
    session: AsyncSession,
    plain_token: str,
    telegram_id: int,
    username: str | None,
    first_name: str | None,
    last_name: str | None,
    language_code: str | None,
) -> tuple[UUID, int]:
    result = await session.execute(
        select(TelegramLinkToken).where(
            TelegramLinkToken.token_prefix == plain_token[:12],
            TelegramLinkToken.consumed_at.is_(None),
        )
    )
    candidates = result.scalars().all()
    for token in candidates:
        expires_at = token.expires_at if token.expires_at.tzinfo else token.expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= utc_now():
            continue
        if not verify_access_key(plain_token, token.token_hash):
            continue
        telegram_user, _ = await upsert_telegram_user(
            session,
            telegram_id=telegram_id,
            username=username,
            first_name=first_name,
            last_name=last_name,
            language_code=language_code,
        )
        old_user_id = telegram_user.id

        account_result = await session.execute(select(TelegramAccount).where(TelegramAccount.telegram_id == telegram_id))
        account = account_result.scalar_one()
        account.user_id = token.user_id
        token.consumed_at = utc_now()
        await write_audit_log(
            session,
            "telegram_linked",
            user_id=token.user_id,
            metadata={"telegram_id": telegram_id, "previous_user_id": str(old_user_id)},
        )
        return token.user_id, telegram_id

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid or expired link token")


async def unlink_telegram_accounts(session: AsyncSession, user_id: UUID) -> int:
    result = await session.execute(select(TelegramAccount).where(TelegramAccount.user_id == user_id))
    accounts = list(result.scalars().all())
    for account in accounts:
        await session.delete(account)

    token_result = await session.execute(select(TelegramLinkToken).where(TelegramLinkToken.user_id == user_id))
    for token in token_result.scalars().all():
        await session.delete(token)

    await write_audit_log(session, "telegram_unlinked", user_id=user_id, metadata={"removed": len(accounts)})
    return len(accounts)
