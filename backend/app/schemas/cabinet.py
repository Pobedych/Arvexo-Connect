from pydantic import BaseModel

from app.enums import RoutingMode


class ChangeModeRequest(BaseModel):
    mode: RoutingMode


class ChangeModeResponse(BaseModel):
    ok: bool
    token: str
    routing_mode: str
    message: str
