import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.enums import OrderStatus, PaymentMethod
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.plan import Plan
    from app.models.user import User
    from app.models.vpn_subscription import VpnSubscription


class Order(TimestampMixin, Base):
    __tablename__ = "orders"
    __table_args__ = (
        Index("ix_orders_user_id", "user_id"),
        Index("ix_orders_status", "status"),
        Index(
            "ix_orders_tx_hash_unique_crypto_manual",
            "tx_hash",
            unique=True,
            postgresql_where=text("payment_method = 'crypto_manual' AND tx_hash IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    plan_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("plans.id", ondelete="SET NULL"))
    subscription_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("vpn_subscriptions.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(32), default=OrderStatus.PENDING.value, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(12), default="RUB", nullable=False)
    payment_method: Mapped[str] = mapped_column(String(64), default=PaymentMethod.CRYPTO_MANUAL.value, nullable=False)
    provider: Mapped[Optional[str]] = mapped_column(String(64))
    provider_payment_id: Mapped[Optional[str]] = mapped_column(String(256))
    payment_url: Mapped[Optional[str]] = mapped_column(Text)
    qr_payload: Mapped[Optional[str]] = mapped_column(Text)
    qr_image_base64: Mapped[Optional[str]] = mapped_column(Text)
    payment_recipient: Mapped[Optional[str]] = mapped_column(Text)
    crypto_network: Mapped[Optional[str]] = mapped_column(String(64))
    crypto_address: Mapped[Optional[str]] = mapped_column(String(256))
    crypto_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 8))
    tx_hash: Mapped[Optional[str]] = mapped_column(String(256))
    order_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSONB)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    user: Mapped[Optional["User"]] = relationship(back_populates="orders")
    plan: Mapped[Optional["Plan"]] = relationship(back_populates="orders")
    subscription: Mapped[Optional["VpnSubscription"]] = relationship(back_populates="orders")
