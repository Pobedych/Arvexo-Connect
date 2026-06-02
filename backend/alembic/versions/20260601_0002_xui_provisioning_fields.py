"""xui provisioning fields

Revision ID: 20260601_0002
Revises: 20260601_0001
Create Date: 2026-06-01 00:00:01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260601_0002"
down_revision: Union[str, None] = "20260601_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("vpn_subscriptions", sa.Column("xui_client_uuid", sa.Text(), nullable=True))
    op.add_column("vpn_subscriptions", sa.Column("xui_client_email", sa.Text(), nullable=True))
    op.add_column("vpn_subscriptions", sa.Column("xui_sub_id", sa.Text(), nullable=True))
    op.add_column("vpn_subscriptions", sa.Column("xui_inbound_ids", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("vpn_subscriptions", "xui_inbound_ids")
    op.drop_column("vpn_subscriptions", "xui_sub_id")
    op.drop_column("vpn_subscriptions", "xui_client_email")
    op.drop_column("vpn_subscriptions", "xui_client_uuid")
