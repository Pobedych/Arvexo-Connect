import uuid
from typing import Optional, TYPE_CHECKING

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.enums import UserStatus
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.access_key import AccessKey
    from app.models.telegram_account import TelegramAccount
    from app.models.vpn_subscription import VpnSubscription

class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    display_name: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default=UserStatus.ACTIVE.value, nullable=False)

    telegram_accounts: Mapped[list["TelegramAccount"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    subscriptions: Mapped[list["VpnSubscription"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    access_keys: Mapped[list["AccessKey"]] = relationship(back_populates="user", cascade="all, delete-orphan")
