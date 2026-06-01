from pydantic import BaseModel

from app.schemas.common import SubscriptionOut


class AccessKeyRequest(BaseModel):
    access_key: str


class AccessKeyResponse(BaseModel):
    ok: bool
    user_id: str
    subscriptions: list[SubscriptionOut]
