from pydantic import BaseModel, Field, field_validator

from app.schemas.common import SubscriptionOut


class AccessKeyRequest(BaseModel):
    access_key: str


class AccountRegisterRequest(BaseModel):
    email: str = Field(min_length=5, max_length=320)
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=160)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or "." not in normalized.rsplit("@", 1)[-1]:
            raise ValueError("Invalid email")
        return normalized


class AccountLoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=320)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or "." not in normalized.rsplit("@", 1)[-1]:
            raise ValueError("Invalid email")
        return normalized


class AccessKeyResponse(BaseModel):
    ok: bool
    user_id: str
    access_token: str
    token_type: str = "bearer"
    subscriptions: list[SubscriptionOut]
