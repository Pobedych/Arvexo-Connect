from enum import StrEnum


class UserStatus(StrEnum):
    ACTIVE = "active"
    DISABLED = "disabled"
    DELETED = "deleted"


class SubscriptionStatus(StrEnum):
    ACTIVE = "active"
    DISABLED = "disabled"
    EXPIRED = "expired"
    TRIAL = "trial"


class RoutingMode(StrEnum):
    SMART = "smart"
    PRIVACY = "privacy"
    GLOBAL = "global"


class AuthProvider(StrEnum):
    TELEGRAM = "telegram"
    ACCESS_KEY = "access_key"
    EMAIL = "email"
