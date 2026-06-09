from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.enums import PaymentMethod, RoutingMode


class PlanOut(BaseModel):
    id: UUID
    code: str
    name: str
    description: str | None
    price: Decimal
    currency: str
    duration_days: int
    device_limit: int
    is_custom: bool
    features: dict | None

    model_config = {"from_attributes": True}


class PlansResponse(BaseModel):
    plans: list[PlanOut]


class CustomPlanConfig(BaseModel):
    devices_count: int = Field(ge=1, le=10)
    duration_days: int = Field(ge=30, le=365)
    default_mode: RoutingMode = RoutingMode.SMART
    iphone_stable: bool = False
    priority_support: bool = False
    backup_profiles: bool = False
    custom_routing_ready: bool = False


class CustomPlanQuoteResponse(BaseModel):
    ok: bool
    price: Decimal
    currency: str
    features: CustomPlanConfig


class CreateOrderRequest(BaseModel):
    plan_code: str = Field(min_length=1, max_length=64)
    payment_method: PaymentMethod = PaymentMethod.CRYPTO_MANUAL
    custom_config: CustomPlanConfig | None = None


class SubmitPaymentRequest(BaseModel):
    tx_hash: str | None = Field(default=None, min_length=3, max_length=256)
    payment_reference: str | None = Field(default=None, min_length=3, max_length=256)

    @model_validator(mode="after")
    def require_payment_reference(self):
        if not self.reference_value:
            raise ValueError("payment_reference is required")
        return self

    @property
    def reference_value(self) -> str:
        return (self.payment_reference or self.tx_hash or "").strip()


class OrderOut(BaseModel):
    id: UUID
    status: str
    plan_code: str | None = None
    plan_name: str | None = None
    amount: Decimal
    currency: str
    payment_amount: Decimal | None = None
    payment_currency: str | None = None
    payment_method: str
    provider: str | None
    provider_payment_id: str | None
    payment_url: str | None
    qr_payload: str | None
    qr_image_base64: str | None
    payment_recipient: str | None
    crypto_network: str | None
    crypto_address: str | None
    crypto_amount: Decimal | None
    tx_hash: str | None
    payment_reference: str | None = None
    payment_purpose: str | None = None
    custom_config: dict | None = None
    subscription_token: str | None = None
    created_at: datetime
    updated_at: datetime
    paid_at: datetime | None
    expires_at: datetime | None


class CreateOrderResponse(BaseModel):
    ok: bool
    order: OrderOut


class OrdersResponse(BaseModel):
    orders: list[OrderOut]


class DeleteOrderResponse(BaseModel):
    ok: bool
    deleted: bool


class AdminConfirmOrderResponse(BaseModel):
    ok: bool
    order: OrderOut
    subscription_url: str
    access_key: str | None = None
