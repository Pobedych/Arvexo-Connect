from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DeviceOut(BaseModel):
    id: UUID
    name: str | None
    type: str | None
    is_active: bool
    source: str | None
    user_agent: str | None
    last_seen_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DevicesResponse(BaseModel):
    devices: list[DeviceOut]


class CreateDeviceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: str | None = Field(default=None, max_length=64)


class CreateDeviceResponse(BaseModel):
    ok: bool
    device: DeviceOut


class DeleteDeviceResponse(BaseModel):
    ok: bool
