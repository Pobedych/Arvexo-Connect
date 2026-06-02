import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.enums import RoutingMode, SubscriptionStatus
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User

class VpnSubscription(TimestampMixin, Base):
    __tablename__ = "vpn_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    public_token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    routing_mode: Mapped[str] = mapped_column(String(32), default=RoutingMode.SMART.value, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default=SubscriptionStatus.ACTIVE.value, nullable=False)
    original_sub_url: Mapped[str] = mapped_column(Text, nullable=False)
    xui_client_uuid: Mapped[Optional[str]] = mapped_column(Text)
    xui_client_email: Mapped[Optional[str]] = mapped_column(Text)
    xui_sub_id: Mapped[Optional[str]] = mapped_column(Text)
    xui_inbound_ids: Mapped[Optional[list[int]]] = mapped_column(JSON)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_access_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    device_limit: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    traffic_limit_gb: Mapped[Optional[int]] = mapped_column(Integer)
    note: Mapped[Optional[str]] = mapped_column(Text)

    user: Mapped["User"] = relationship(back_populates="subscriptions")
