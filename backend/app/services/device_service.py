import hashlib

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device import Device
from app.models.vpn_subscription import VpnSubscription
from app.utils.time import utc_now


async def record_raw_subscription_device(
    session: AsyncSession,
    subscription: VpnSubscription,
    request: Request,
) -> Device:
    user_agent = (request.headers.get("user-agent") or "Unknown client").strip()[:1000]
    client_ip = request.client.host if request.client else ""
    forwarded_for = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    ip_for_fingerprint = forwarded_for or client_ip
    fingerprint_hash = _fingerprint(subscription.public_token, user_agent, ip_for_fingerprint)

    result = await session.execute(
        select(Device).where(Device.subscription_id == subscription.id, Device.fingerprint_hash == fingerprint_hash)
    )
    device = result.scalar_one_or_none()
    if device is None:
        device = Device(
            subscription_id=subscription.id,
            name=guess_device_name(user_agent),
            type=guess_device_type(user_agent),
            source="raw_subscription",
            fingerprint_hash=fingerprint_hash,
            user_agent=user_agent,
            last_seen_at=utc_now(),
        )
        session.add(device)
    else:
        device.name = device.name or guess_device_name(user_agent)
        device.type = device.type or guess_device_type(user_agent)
        device.user_agent = user_agent
        device.last_seen_at = utc_now()
        device.is_active = True
    return device


def guess_device_name(user_agent: str) -> str:
    value = user_agent.lower()
    if "happ" in value:
        return "Happ"
    if "hiddify" in value:
        return "Hiddify"
    if "v2raytun" in value or "v2raytun" in user_agent:
        return "V2RayTun"
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


def guess_device_type(user_agent: str) -> str:
    value = user_agent.lower()
    if "iphone" in value or "android" in value or "happ" in value or "v2raytun" in value:
        return "phone"
    if "ipad" in value:
        return "tablet"
    if "windows" in value or "mac os" in value or "macintosh" in value:
        return "laptop"
    return "other"


def _fingerprint(token: str, user_agent: str, ip: str) -> str:
    raw = f"{token}|{user_agent}|{ip}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()
