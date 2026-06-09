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
    PROVISIONING_FAILED = "provisioning_failed"


class RoutingMode(StrEnum):
    SMART = "smart"
    PRIVACY = "privacy"
    GLOBAL = "global"


class AuthProvider(StrEnum):
    TELEGRAM = "telegram"
    ACCESS_KEY = "access_key"
    EMAIL = "email"


class OrderStatus(StrEnum):
    PENDING = "pending"
    WAITING_CONFIRMATION = "waiting_confirmation"
    PAID = "paid"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    FAILED = "failed"


class PaymentMethod(StrEnum):
    CRYPTO_MANUAL = "crypto_manual"
    TON_MANUAL = "ton_manual"
    SBP_MANUAL = "sbp_manual"


class PromoCodeStatus(StrEnum):
    ACTIVE = "active"
    DISABLED = "disabled"
