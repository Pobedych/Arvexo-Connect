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
    access_key: str | None = None


class DisableSubscriptionResponse(BaseModel):
    ok: bool
    status: str


class ExtendSubscriptionRequest(BaseModel):
    days: int = Field(gt=0, le=3660)


class ExtendSubscriptionResponse(BaseModel):
    ok: bool
    expires_at: datetime


class ChangeDeviceLimitRequest(BaseModel):
    device_limit: int = Field(ge=1, le=100)


class AuditLogOut(BaseModel):
    id: UUID
    user_id: UUID | None
    action: str
    metadata: dict | None = None
    created_at: datetime


class AuditLogResponse(BaseModel):
    audit_logs: list[AuditLogOut]


class CreateAccessKeyResponse(BaseModel):
    ok: bool
    access_key: str
    warning: str


class CreateSubscriptionResponse(BaseModel):
    ok: bool
    user_id: UUID
    subscription: SubscriptionOut


class ProvisionSubscriptionRequest(BaseModel):
    display_name: str | None = None
    telegram_id: int | None = None
    routing_mode: RoutingMode = RoutingMode.SMART
    duration_days: int = Field(default=30, ge=1, le=3660)
    device_limit: int = Field(default=3, ge=1)
    traffic_limit_gb: int | None = Field(default=None, ge=1)
    note: str | None = None


class ProvisionSubscriptionResponse(BaseModel):
    ok: bool
    user: UserOut
    subscription: SubscriptionOut
    access_key: str


class AdminChangeOriginalSubUrlRequest(BaseModel):
    original_sub_url: HttpUrl


class AdminChangeModeRequest(BaseModel):
    mode: RoutingMode


class AdminUserListResponse(BaseModel):
    users: list[UserOut]


class AdminSubscriptionListResponse(BaseModel):
    subscriptions: list[SubscriptionOut]


class AdminStatsResponse(BaseModel):
    users_total: int
    subscriptions_total: int
    subscriptions_active: int
    orders_total: int
    orders_pending: int
    orders_waiting_confirmation: int
    orders_paid: int
    promo_codes_active: int
