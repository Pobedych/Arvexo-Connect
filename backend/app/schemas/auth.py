from pydantic import BaseModel

from app.schemas.common import SubscriptionOut


class AccessKeyRequest(BaseModel):
    access_key: str


class AccessKeyResponse(BaseModel):
    ok: bool
    user_id: str
    access_token: str
    token_type: str = "bearer"
    subscriptions: list[SubscriptionOut]
