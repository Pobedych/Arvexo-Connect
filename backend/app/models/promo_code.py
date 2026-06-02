import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.enums import PromoCodeStatus
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.plan import Plan
    from app.models.promo_redemption import PromoRedemption


class PromoCode(TimestampMixin, Base):
    __tablename__ = "promo_codes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plans.id", ondelete="CASCADE"), nullable=False)
    code_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    code_prefix: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default=PromoCodeStatus.ACTIVE.value, nullable=False)
    max_redemptions: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    redemptions_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    note: Mapped[Optional[str]] = mapped_column(Text)

    plan: Mapped["Plan"] = relationship(back_populates="promo_codes")
    redemptions: Mapped[list["PromoRedemption"]] = relationship(back_populates="promo_code", cascade="all, delete-orphan")
