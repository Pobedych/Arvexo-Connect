"""account auth fields

Revision ID: 20260602_0003
Revises: 20260601_0002
Create Date: 2026-06-02 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260602_0003"
down_revision: Union[str, None] = "20260601_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email", sa.String(length=320), nullable=True))
    op.add_column("users", sa.Column("password_hash", sa.String(length=256), nullable=True))
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_users_email", "users", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_email", table_name="users")
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "password_hash")
    op.drop_column("users", "email")
