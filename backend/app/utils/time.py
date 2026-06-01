from datetime import datetime, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def days_left(expires_at: datetime | None) -> int | None:
    if expires_at is None:
        return None
    delta = expires_at - utc_now()
    return max(delta.days, 0)


def is_expired(expires_at: datetime | None) -> bool:
    return expires_at is not None and expires_at <= utc_now()
