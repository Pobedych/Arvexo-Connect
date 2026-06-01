from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.access_key import AccessKey
from app.models.vpn_subscription import VpnSubscription
from app.services.audit_service import write_audit_log
from app.utils.security import generate_access_key, hash_access_key, verify_access_key
from app.utils.time import utc_now


async def create_access_key(session: AsyncSession, user_id, label: str | None = None) -> str:
    plain_key = generate_access_key()
    session.add(AccessKey(user_id=user_id, key_hash=hash_access_key(plain_key), label=label))
    await write_audit_log(session, "access_key_created", user_id=user_id)
    return plain_key


async def authenticate_access_key(session: AsyncSession, plain_key: str) -> tuple[str, list[VpnSubscription]] | None:
    result = await session.execute(select(AccessKey).where(AccessKey.is_active.is_(True)))
    for access_key in result.scalars().all():
        if verify_access_key(plain_key, access_key.key_hash):
            access_key.last_used_at = utc_now()
            subscriptions = await session.execute(
                select(VpnSubscription).where(VpnSubscription.user_id == access_key.user_id)
            )
            return str(access_key.user_id), list(subscriptions.scalars().all())
    return None
