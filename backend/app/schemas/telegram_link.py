from pydantic import BaseModel


class TelegramStatusResponse(BaseModel):
    connected: bool
    telegram_ids: list[int]


class TelegramLinkTokenResponse(BaseModel):
    ok: bool
    telegram_link_url: str
    expires_at: str


class TelegramConsumeLinkRequest(BaseModel):
    token: str
    telegram_id: int
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    language_code: str | None = None


class TelegramConsumeLinkResponse(BaseModel):
    ok: bool
    user_id: str
    telegram_id: int
