from pydantic import BaseModel

from app.enums import RoutingMode
from app.schemas.common import SubscriptionOut


class TelegramUpsertRequest(BaseModel):
    telegram_id: int
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    language_code: str | None = None


class TelegramUpsertResponse(BaseModel):
    ok: bool
    user_id: str
    telegram_id: int


class TelegramSubscriptionsResponse(BaseModel):
    telegram_id: int
    subscriptions: list[SubscriptionOut]


class TelegramChangeModeRequest(BaseModel):
    telegram_id: int
    mode: RoutingMode


class TelegramChangeModeResponse(BaseModel):
    ok: bool
    routing_mode: str
    message: str
