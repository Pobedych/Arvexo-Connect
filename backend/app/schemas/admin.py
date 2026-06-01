from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl

from app.enums import RoutingMode
from app.schemas.common import SubscriptionOut, UserOut


class CreateUserWithSubscriptionRequest(BaseModel):
    display_name: str | None = None
    telegram_id: int | None = None
    original_sub_url: HttpUrl
    routing_mode: RoutingMode = RoutingMode.SMART
    expires_at: datetime | None = None
    device_limit: int = Field(default=3, ge=1)
    traffic_limit_gb: int | None = Field(default=None, ge=1)
    note: str | None = None


class CreateSubscriptionRequest(BaseModel):
    original_sub_url: HttpUrl
    routing_mode: RoutingMode = RoutingMode.SMART
    expires_at: datetime | None = None
    device_limit: int = Field(default=3, ge=1)
    traffic_limit_gb: int | None = Field(default=None, ge=1)
    note: str | None = None


class CreateUserWithSubscriptionResponse(BaseModel):
    ok: bool
    user: UserOut
    subscription: SubscriptionOut


class DisableSubscriptionResponse(BaseModel):
    ok: bool
    status: str


class ExtendSubscriptionRequest(BaseModel):
    days: int = Field(gt=0, le=3660)


class ExtendSubscriptionResponse(BaseModel):
    ok: bool
    expires_at: datetime


class CreateAccessKeyResponse(BaseModel):
    ok: bool
    access_key: str
    warning: str


class CreateSubscriptionResponse(BaseModel):
    ok: bool
    user_id: UUID
    subscription: SubscriptionOut
