from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.telegram_account import TelegramAccount
from app.models.user import User
from app.services.audit_service import write_audit_log
from app.utils.security import hash_password, verify_password
from app.utils.time import utc_now


async def create_user(session: AsyncSession, display_name: str | None = None) -> User:
    user = User(display_name=display_name)
    session.add(user)
    await session.flush()
    await write_audit_log(session, "user_created", user_id=user.id)
    return user


def normalize_email(email: str) -> str:
    return email.strip().lower()


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    result = await session.execute(select(User).where(User.email == normalize_email(email)))
    return result.scalar_one_or_none()


async def create_account_user(
    session: AsyncSession,
    email: str,
    password: str,
    display_name: str | None = None,
) -> User:
    user = User(
        email=normalize_email(email),
        password_hash=hash_password(password),
        display_name=display_name,
        last_login_at=utc_now(),
    )
    session.add(user)
    await session.flush()
    await write_audit_log(session, "account_registered", user_id=user.id)
    return user


async def authenticate_account_user(session: AsyncSession, email: str, password: str) -> User | None:
    user = await get_user_by_email(session, email)
    if user is None or not verify_password(password, user.password_hash):
        return None
    user.last_login_at = utc_now()
    await write_audit_log(session, "account_login", user_id=user.id)
    return user


async def upsert_telegram_user(
    session: AsyncSession,
    telegram_id: int,
    username: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
    language_code: str | None = None,
) -> tuple[User, TelegramAccount]:
    result = await session.execute(select(TelegramAccount).where(TelegramAccount.telegram_id == telegram_id))
    account = result.scalar_one_or_none()

    if account is None:
        display_name = first_name or username or f"Telegram {telegram_id}"
        user = await create_user(session, display_name=display_name)
        account = TelegramAccount(user_id=user.id, telegram_id=telegram_id)
        session.add(account)
        await write_audit_log(session, "telegram_linked", user_id=user.id, metadata={"telegram_id": telegram_id})
    else:
        user = await session.get(User, account.user_id)
        if user is None:
            raise RuntimeError("Telegram account references missing user")

    account.username = username
    account.first_name = first_name
    account.last_name = last_name
    account.language_code = language_code
    return user, account
