import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


async def write_audit_log(
    session: AsyncSession,
    action: str,
    user_id: uuid.UUID | None = None,
    metadata: dict | None = None,
) -> None:
    session.add(AuditLog(user_id=user_id, action=action, metadata_=metadata))
