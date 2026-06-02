"""billing admin v1 fields

Revision ID: 20260602_0008
Revises: 20260602_0007
Create Date: 2026-06-02 00:08:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260602_0008"
down_revision: Union[str, None] = "20260602_0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("provider", sa.String(length=64), nullable=True))
    op.add_column("orders", sa.Column("provider_payment_id", sa.String(length=256), nullable=True))
    op.add_column("orders", sa.Column("payment_url", sa.Text(), nullable=True))
    op.add_column("orders", sa.Column("qr_payload", sa.Text(), nullable=True))
    op.add_column("orders", sa.Column("qr_image_base64", sa.Text(), nullable=True))
    op.add_column("orders", sa.Column("payment_recipient", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "payment_recipient")
    op.drop_column("orders", "qr_image_base64")
    op.drop_column("orders", "qr_payload")
    op.drop_column("orders", "payment_url")
    op.drop_column("orders", "provider_payment_id")
    op.drop_column("orders", "provider")
