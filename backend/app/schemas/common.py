from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

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
    traffic_limit_gb: int | None = None
    last_access_at: datetime | None = None
    public_subscription_url: str


def subscription_to_out(subscription: VpnSubscription) -> SubscriptionOut:
    return SubscriptionOut(
        token=subscription.public_token,
        status=subscription.status,
        routing_mode=subscription.routing_mode,
        expires_at=subscription.expires_at,
        days_left=days_left(subscription.expires_at),
        device_limit=subscription.device_limit,
        traffic_limit_gb=subscription.traffic_limit_gb,
        last_access_at=subscription.last_access_at,
        public_subscription_url=f"{settings.public_sub_base_url.rstrip('/')}/u/{subscription.public_token}",
    )
