"""device detection fields

Revision ID: 20260602_0007
Revises: 20260602_0006
Create Date: 2026-06-02 00:07:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260602_0007"
down_revision: Union[str, None] = "20260602_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("devices", sa.Column("source", sa.String(length=64), nullable=True))
    op.add_column("devices", sa.Column("fingerprint_hash", sa.String(length=128), nullable=True))
    op.add_column("devices", sa.Column("user_agent", sa.Text(), nullable=True))
    op.add_column("devices", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_devices_fingerprint_hash", "devices", ["fingerprint_hash"])


def downgrade() -> None:
    op.drop_index("ix_devices_fingerprint_hash", table_name="devices")
    op.drop_column("devices", "last_seen_at")
    op.drop_column("devices", "user_agent")
    op.drop_column("devices", "fingerprint_hash")
    op.drop_column("devices", "source")
