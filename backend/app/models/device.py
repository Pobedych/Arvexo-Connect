import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.vpn_subscription import VpnSubscription


class Device(TimestampMixin, Base):
    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    subscription_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vpn_subscriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[Optional[str]] = mapped_column(Text)
    type: Mapped[Optional[str]] = mapped_column(String(64))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    source: Mapped[Optional[str]] = mapped_column(String(64))
    fingerprint_hash: Mapped[Optional[str]] = mapped_column(String(128), index=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    subscription: Mapped["VpnSubscription"] = relationship(back_populates="devices")
