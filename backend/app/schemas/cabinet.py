from pydantic import BaseModel, Field

from app.enums import RoutingMode


class ChangeModeRequest(BaseModel):
    mode: RoutingMode


class ChangeModeResponse(BaseModel):
    ok: bool
    token: str
    routing_mode: str
    message: str


class CabinetSettingsResponse(BaseModel):
    ok: bool
    email: str | None
    display_name: str | None
    active_access_keys: int


class UpdateCabinetSettingsRequest(BaseModel):
    display_name: str | None = Field(default=None, max_length=160)


class IssueCabinetAccessKeyResponse(BaseModel):
    ok: bool
    access_key: str
    warning: str
