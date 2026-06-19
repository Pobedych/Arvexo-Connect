import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.promo_code import PromoCode
    from app.models.user import User
    from app.models.vpn_subscription import VpnSubscription


class PromoRedemption(TimestampMixin, Base):
    __tablename__ = "promo_redemptions"
    __table_args__ = (UniqueConstraint("promo_code_id", "user_id", name="uq_promo_redemptions_code_user"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    promo_code_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("promo_codes.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    subscription_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vpn_subscriptions.id", ondelete="CASCADE"), nullable=False)

    promo_code: Mapped["PromoCode"] = relationship(back_populates="redemptions")
    user: Mapped["User"] = relationship(back_populates="promo_redemptions")
    subscription: Mapped["VpnSubscription"] = relationship(back_populates="promo_redemptions")
