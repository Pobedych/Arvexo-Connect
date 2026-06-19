from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict
from sqlalchemy import inspect

from app.config import settings
from app.models.vpn_subscription import VpnSubscription
from app.utils.time import days_left


class UserOut(BaseModel):
    id: UUID
    display_name: str | None

    model_config = ConfigDict(from_attributes=True)


class SubscriptionOut(BaseModel):
    token: str
    status: str
    routing_mode: str
    expires_at: datetime | None
    days_left: int | None
    device_limit: int
    devices_used: int = 0
    plan_name: str | None = None
    traffic_limit_gb: int | None = None
    last_access_at: datetime | None = None
    public_subscription_url: str
    raw_subscription_url: str
    # Заполняется только в детальном эндпоинте подписки (cabinet.py), чтобы не генерировать
    # QR на каждый элемент списка подписок — см. SECURITY_REVIEW.md, п.11.
    qr_image_base64: str | None = None


def subscription_to_out(subscription: VpnSubscription) -> SubscriptionOut:
    state = inspect(subscription)
    plan_name = None
    if "plan" not in state.unloaded and subscription.plan is not None:
        plan_name = subscription.plan.name
    devices_used = 0
    if "devices" not in state.unloaded:
        devices_used = len([device for device in subscription.devices if device.is_active])
    public_url = f"{settings.public_sub_base_url.rstrip('/')}/u/{subscription.public_token}"
    return SubscriptionOut(
        token=subscription.public_token,
        status=subscription.status,
        routing_mode=subscription.routing_mode,
        expires_at=subscription.expires_at,
        days_left=days_left(subscription.expires_at),
        device_limit=subscription.device_limit,
        devices_used=devices_used,
        plan_name=plan_name,
        traffic_limit_gb=subscription.traffic_limit_gb,
        last_access_at=subscription.last_access_at,
        public_subscription_url=public_url,
        raw_subscription_url=f"{public_url}?format=raw",
    )
