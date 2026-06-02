"""telegram link tokens

Revision ID: 20260602_0006
Revises: 20260602_0005
Create Date: 2026-06-02 00:06:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260602_0006"
down_revision: Union[str, None] = "20260602_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "telegram_link_tokens",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("token_hash", sa.String(length=256), nullable=False),
        sa.Column("token_prefix", sa.String(length=16), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_telegram_link_tokens_token_prefix", "telegram_link_tokens", ["token_prefix"])


def downgrade() -> None:
    op.drop_index("ix_telegram_link_tokens_token_prefix", table_name="telegram_link_tokens")
    op.drop_table("telegram_link_tokens")
