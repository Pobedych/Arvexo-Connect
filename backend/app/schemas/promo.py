from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import SubscriptionOut


class CreatePromoCodeRequest(BaseModel):
    plan_code: str = Field(default="family", min_length=1, max_length=64)
    max_redemptions: int = Field(default=1, ge=1, le=100)
    expires_at: datetime | None = None
    note: str | None = Field(default=None, max_length=500)
    code_prefix: str = Field(default="FAMILY", min_length=1, max_length=12)


class PromoCodeOut(BaseModel):
    id: UUID
    plan_code: str
    plan_name: str
    code_prefix: str
    status: str
    max_redemptions: int
    redemptions_count: int
    expires_at: datetime | None
    note: str | None
    created_at: datetime


class CreatePromoCodeResponse(BaseModel):
    ok: bool
    promo_code: PromoCodeOut
    code: str
    warning: str


class PromoCodesResponse(BaseModel):
    promo_codes: list[PromoCodeOut]


class RedeemPromoCodeRequest(BaseModel):
    code: str = Field(min_length=4, max_length=64)


class RedeemPromoCodeResponse(BaseModel):
    ok: bool
    subscription: SubscriptionOut
    message: str
