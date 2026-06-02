import hashlib
import hmac
import secrets

from fastapi import Header, HTTPException, status

from app.config import settings


def mask_token(value: str) -> str:
    if len(value) <= 8:
        return "***"
    return f"{value[:6]}***{value[-2:]}"


def generate_access_key() -> str:
    parts = ["ARVX"]
    parts.extend(secrets.token_hex(2).upper() for _ in range(3))
    return "-".join(parts)


def hash_access_key(access_key: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", access_key.encode("utf-8"), salt.encode("utf-8"), 120_000)
    return f"pbkdf2_sha256${salt}${digest.hex()}"


def verify_access_key(access_key: str, stored_hash: str) -> bool:
    try:
        algorithm, salt, digest = stored_hash.split("$", 2)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    candidate = hashlib.pbkdf2_hmac("sha256", access_key.encode("utf-8"), salt.encode("utf-8"), 120_000)
    return hmac.compare_digest(candidate.hex(), digest)


def constant_time_equal(left: str, right: str) -> bool:
    return hmac.compare_digest(left.encode("utf-8"), right.encode("utf-8"))


async def require_admin_token(x_admin_token: str | None = Header(default=None)) -> None:
    if not x_admin_token or not constant_time_equal(x_admin_token, settings.admin_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin token")


async def require_bot_token(x_bot_token: str | None = Header(default=None)) -> None:
    if not x_bot_token or not constant_time_equal(x_bot_token, settings.bot_internal_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bot token")
