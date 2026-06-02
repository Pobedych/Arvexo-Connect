import hashlib
import re

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device import Device
from app.models.vpn_subscription import VpnSubscription
from app.utils.time import utc_now

DEVICE_MODEL_HEADERS = (
    "x-device-model",
    "x-client-device-model",
    "x-client-model",
    "device-model",
    "client-device-model",
)
DEVICE_NAME_HEADERS = (
    "x-device-name",
    "x-client-device",
    "x-client-device-name",
    "device-name",
    "client-device",
)
DEVICE_ID_HEADERS = (
    "x-device-id",
    "x-client-device-id",
    "device-id",
    "client-device-id",
)


async def record_raw_subscription_device(
    session: AsyncSession,
    subscription: VpnSubscription,
    request: Request,
) -> Device:
    user_agent = (request.headers.get("user-agent") or "Unknown client").strip()[:1000]
    detected_name = guess_device_name(user_agent, request)
    detected_type = guess_device_type(user_agent, request)
    fingerprint_hash = _fingerprint(subscription.public_token, user_agent, request)

    result = await session.execute(
        select(Device).where(Device.subscription_id == subscription.id, Device.fingerprint_hash == fingerprint_hash)
    )
    device = result.scalar_one_or_none()
    if device is None:
        device = await _find_legacy_raw_device(session, subscription, user_agent)

    if device is None:
        device = Device(
            subscription_id=subscription.id,
            name=detected_name,
            type=detected_type,
            source="raw_subscription",
            fingerprint_hash=fingerprint_hash,
            user_agent=user_agent,
            last_seen_at=utc_now(),
        )
        session.add(device)
    else:
        device.name = _prefer_specific_name(device.name, detected_name)
        device.type = device.type or detected_type
        device.fingerprint_hash = fingerprint_hash
        device.user_agent = user_agent
        device.last_seen_at = utc_now()
        device.is_active = True
    return device


def guess_device_name(user_agent: str, request: Request | None = None) -> str:
    header_model = _first_header(request, DEVICE_MODEL_HEADERS)
    if header_model:
        return _normalize_model_name(header_model)

    header_name = _first_header(request, DEVICE_NAME_HEADERS)
    if header_name:
        return _clean_display_value(header_name)

    exact_apple = _extract_exact_apple_model(user_agent)
    if exact_apple:
        return exact_apple

    android_model = _extract_android_model(user_agent)
    if android_model:
        return _normalize_model_name(android_model)

    value = user_agent.lower()
    if "happ" in value:
        return _client_platform_name("Happ", value)
    if "hiddify" in value:
        return _client_platform_name("Hiddify", value)
    if "v2raytun" in value or "v2raytun" in user_agent:
        return _client_platform_name("V2RayTun", value)
    if "v2ray" in value:
        return "V2Ray client"
    if "clash" in value:
        return "Clash"
    if "sing-box" in value or "singbox" in value:
        return "sing-box"
    if "iphone" in value or "ipad" in value:
        return "iOS device"
    if "android" in value:
        return "Android device"
    if "windows" in value:
        return "Windows device"
    if "mac os" in value or "macintosh" in value:
        return "Mac device"
    return "VPN client"


def guess_device_type(user_agent: str, request: Request | None = None) -> str:
    header_type = (_first_header(request, ("x-device-type", "device-type", "x-client-device-type")) or "").lower()
    if header_type in {"phone", "tablet", "laptop", "desktop", "other"}:
        return header_type

    value = user_agent.lower()
    if "iphone" in value or "android" in value or "happ" in value or "v2raytun" in value:
        return "phone"
    if "ipad" in value:
        return "tablet"
    if "windows" in value or "mac os" in value or "macintosh" in value:
        return "laptop"
    return "other"


def _fingerprint(token: str, user_agent: str, request: Request | None = None) -> str:
    device_id = _first_header(request, DEVICE_ID_HEADERS)
    model = _first_header(request, DEVICE_MODEL_HEADERS) or _extract_android_model(user_agent) or _extract_exact_apple_model(user_agent)
    if device_id:
        identity = f"id:{_clean_display_value(device_id)}"
    elif model:
        identity = f"model:{_normalize_model_name(model)}"
    else:
        # Most VPN clients only send a generic User-Agent (for example
        # "v2raytun/android"). Do not include IP here, otherwise one device
        # turns into many rows when mobile networks rotate the address.
        identity = f"ua:{user_agent.strip().lower()}"

    raw = f"{token}|{identity}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _first_header(request: Request | None, names: tuple[str, ...]) -> str | None:
    if request is None:
        return None
    for name in names:
        value = request.headers.get(name)
        if value and value.strip():
            return value.strip()[:240]
    return None


def _clean_display_value(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())[:120]


def _normalize_model_name(model: str) -> str:
    value = _clean_display_value(model)
    lower = value.lower()
    if re.fullmatch(r"sm-[a-z0-9]+", lower):
        return f"samsung {value.upper()}"
    if re.fullmatch(r"iphone\d+,\d+", lower):
        return f"iPhone {value}"
    if re.fullmatch(r"ipad\d+,\d+", lower):
        return f"iPad {value}"
    if lower.startswith("samsung "):
        return "samsung " + value.split(" ", 1)[1].upper()
    return value


def _extract_exact_apple_model(user_agent: str) -> str | None:
    match = re.search(r"\b(iPhone\s+\d+(?:\s+(?:Pro Max|Pro|Plus|Air|mini))?)\b", user_agent, re.IGNORECASE)
    if match:
        return _clean_display_value(match.group(1)).replace("Iphone", "iPhone")
    match = re.search(r"\b(iPad\s+\d+(?:\s+(?:Pro|Air|mini))?)\b", user_agent, re.IGNORECASE)
    if match:
        return _clean_display_value(match.group(1)).replace("Ipad", "iPad")
    match = re.search(r"\b(iPhone\d+,\d+|iPad\d+,\d+)\b", user_agent, re.IGNORECASE)
    if match:
        return _normalize_model_name(match.group(1))
    return None


def _extract_android_model(user_agent: str) -> str | None:
    samsung = re.search(r"\bSM-[A-Z0-9]+\b", user_agent, re.IGNORECASE)
    if samsung:
        return samsung.group(0).upper()

    pixel = re.search(r"\bPixel\s+[A-Za-z0-9 ]{1,24}\b", user_agent, re.IGNORECASE)
    if pixel:
        return _clean_android_candidate(pixel.group(0))

    android_block = re.search(r"Android\s+[^;)]*;\s*([^;)]+?)(?:\s+Build/|;|\))", user_agent, re.IGNORECASE)
    if android_block:
        candidate = _clean_android_candidate(android_block.group(1))
        if candidate:
            return candidate
    return None


def _clean_android_candidate(value: str) -> str | None:
    candidate = re.sub(r"\s+Build/.*$", "", _clean_display_value(value), flags=re.IGNORECASE)
    lower = candidate.lower()
    if not candidate or lower in {"android", "mobile", "wv", "linux"}:
        return None
    if "/" in candidate and " " not in candidate:
        return None
    return candidate


def _client_platform_name(client_name: str, lowered_user_agent: str) -> str:
    if "android" in lowered_user_agent:
        return f"{client_name} Android"
    if "iphone" in lowered_user_agent:
        return f"{client_name} iPhone"
    if "ipad" in lowered_user_agent:
        return f"{client_name} iPad"
    return client_name


def _prefer_specific_name(current: str | None, detected: str) -> str:
    if not current:
        return detected
    generic_names = {"VPN client", "Android device", "iOS device", "V2RayTun", "Happ", "Hiddify"}
    if current in generic_names and detected not in generic_names:
        return detected
    return current


async def _find_legacy_raw_device(
    session: AsyncSession,
    subscription: VpnSubscription,
    user_agent: str,
) -> Device | None:
    result = await session.execute(
        select(Device)
        .where(
            Device.subscription_id == subscription.id,
            Device.source == "raw_subscription",
            Device.user_agent == user_agent,
        )
        .order_by(Device.last_seen_at.desc(), Device.created_at.desc())
    )
    matches = list(result.scalars().all())
    if not matches:
        return None

    primary = matches[0]
    for duplicate in matches[1:]:
        duplicate.is_active = False
    return primary
