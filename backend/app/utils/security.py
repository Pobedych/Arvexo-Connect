import base64
import hashlib
import hmac
import json
import secrets
from datetime import timedelta
from uuid import UUID

from fastapi import Header, HTTPException, status

from app.config import settings
from app.utils.time import utc_now


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


def create_access_token(user_id: str | UUID) -> str:
    expires_at = utc_now() + timedelta(minutes=settings.jwt_expires_minutes)
    payload = {"user_id": str(user_id), "exp": int(expires_at.timestamp())}
    header = {"alg": "HS256", "typ": "JWT"}
    unsigned = f"{_base64url_json(header)}.{_base64url_json(payload)}"
    signature = _sign_jwt(unsigned)
    return f"{unsigned}.{signature}"


def verify_access_token(token: str) -> UUID:
    try:
        header_raw, payload_raw, signature = token.split(".", 2)
    except ValueError as exc:
        raise _jwt_unauthorized() from exc

    unsigned = f"{header_raw}.{payload_raw}"
    expected_signature = _sign_jwt(unsigned)
    if not constant_time_equal(signature, expected_signature):
        raise _jwt_unauthorized()

    try:
        header = _base64url_decode_json(header_raw)
        payload = _base64url_decode_json(payload_raw)
        user_id = UUID(str(payload["user_id"]))
        exp = int(payload["exp"])
    except (KeyError, TypeError, ValueError) as exc:
        raise _jwt_unauthorized() from exc

    if header.get("alg") != "HS256" or header.get("typ") != "JWT":
        raise _jwt_unauthorized()
    if exp <= int(utc_now().timestamp()):
        raise _jwt_unauthorized()
    return user_id


async def require_cabinet_user_id(authorization: str | None = Header(default=None)) -> UUID:
    if not authorization:
        raise _jwt_unauthorized()
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise _jwt_unauthorized()
    return verify_access_token(token)


async def require_admin_token(x_admin_token: str | None = Header(default=None)) -> None:
    if not x_admin_token or not constant_time_equal(x_admin_token, settings.admin_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin token")


async def require_bot_token(x_bot_token: str | None = Header(default=None)) -> None:
    if not x_bot_token or not constant_time_equal(x_bot_token, settings.bot_internal_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bot token")


def _jwt_secret() -> str:
    if settings.jwt_secret:
        return settings.jwt_secret
    return "development_jwt_secret_change_me"


def _sign_jwt(unsigned_token: str) -> str:
    digest = hmac.new(_jwt_secret().encode("utf-8"), unsigned_token.encode("utf-8"), hashlib.sha256).digest()
    return _base64url_encode(digest)


def _base64url_json(value: dict) -> str:
    raw = json.dumps(value, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return _base64url_encode(raw)


def _base64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _base64url_decode_json(value: str) -> dict:
    padded = value + "=" * (-len(value) % 4)
    return json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))


def _jwt_unauthorized() -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing access token")
