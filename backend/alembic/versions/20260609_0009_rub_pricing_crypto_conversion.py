"""rub pricing crypto conversion

Revision ID: 20260609_0009
Revises: 20260602_0008
Create Date: 2026-06-09 00:09:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260609_0009"
down_revision: Union[str, None] = "20260602_0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("plans", "currency", server_default=sa.text("'RUB'"))
    op.alter_column("orders", "currency", server_default=sa.text("'RUB'"))
    op.execute("UPDATE plans SET price = 199, currency = 'RUB' WHERE code = 'base'")
    op.execute("UPDATE plans SET price = 599, currency = 'RUB' WHERE code = 'family'")
    op.execute("UPDATE plans SET price = 0, currency = 'RUB' WHERE code = 'custom'")


def downgrade() -> None:
    op.alter_column("plans", "currency", server_default=sa.text("'USDT'"))
    op.alter_column("orders", "currency", server_default=sa.text("'USDT'"))
    op.execute("UPDATE plans SET price = 5, currency = 'USDT' WHERE code = 'base'")
    op.execute("UPDATE plans SET price = 12, currency = 'USDT' WHERE code = 'family'")
    op.execute("UPDATE plans SET price = 0, currency = 'USDT' WHERE code = 'custom'")
