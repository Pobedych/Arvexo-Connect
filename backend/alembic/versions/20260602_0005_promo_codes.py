"""promo codes

Revision ID: 20260602_0005
Revises: 20260602_0004
Create Date: 2026-06-02 00:05:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260602_0005"
down_revision: Union[str, None] = "20260602_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "promo_codes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("plan_id", sa.UUID(), nullable=False),
        sa.Column("code_hash", sa.String(length=256), nullable=False),
        sa.Column("code_prefix", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("max_redemptions", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("redemptions_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_promo_codes_code_prefix", "promo_codes", ["code_prefix"])
    op.create_index("ix_promo_codes_status", "promo_codes", ["status"])

    op.create_table(
        "promo_redemptions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("promo_code_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("subscription_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["promo_code_id"], ["promo_codes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subscription_id"], ["vpn_subscriptions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("promo_code_id", "user_id", name="uq_promo_redemptions_code_user"),
    )
    op.create_index("ix_promo_redemptions_user_id", "promo_redemptions", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_promo_redemptions_user_id", table_name="promo_redemptions")
    op.drop_table("promo_redemptions")
    op.drop_index("ix_promo_codes_status", table_name="promo_codes")
    op.drop_index("ix_promo_codes_code_prefix", table_name="promo_codes")
    op.drop_table("promo_codes")
