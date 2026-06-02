from datetime import datetime, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def days_left(expires_at: datetime | None) -> int | None:
    if expires_at is None:
        return None
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    delta = expires_at - utc_now()
    return max(delta.days, 0)


def is_expired(expires_at: datetime | None) -> bool:
    if expires_at is None:
        return False
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at <= utc_now()
