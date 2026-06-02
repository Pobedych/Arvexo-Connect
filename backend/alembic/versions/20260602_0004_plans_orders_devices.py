"""plans orders devices

Revision ID: 20260602_0004
Revises: 20260602_0003
Create Date: 2026-06-02 00:04:00
"""

from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260602_0004"
down_revision: Union[str, None] = "20260602_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "plans",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(length=12), nullable=False, server_default="USDT"),
        sa.Column("duration_days", sa.Integer(), nullable=False),
        sa.Column("device_limit", sa.Integer(), nullable=False),
        sa.Column("is_custom", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("features", postgresql.JSONB(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_plans_code", "plans", ["code"], unique=True)

    op.add_column("vpn_subscriptions", sa.Column("plan_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_vpn_subscriptions_plan_id_plans",
        "vpn_subscriptions",
        "plans",
        ["plan_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "orders",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("plan_id", sa.UUID(), nullable=True),
        sa.Column("subscription_id", sa.UUID(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(length=12), nullable=False, server_default="USDT"),
        sa.Column("payment_method", sa.String(length=64), nullable=False, server_default="crypto_manual"),
        sa.Column("crypto_network", sa.String(length=64), nullable=True),
        sa.Column("crypto_address", sa.String(length=256), nullable=True),
        sa.Column("crypto_amount", sa.Numeric(18, 8), nullable=True),
        sa.Column("tx_hash", sa.String(length=256), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["subscription_id"], ["vpn_subscriptions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_orders_user_id", "orders", ["user_id"])
    op.create_index("ix_orders_status", "orders", ["status"])

    op.create_table(
        "devices",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("subscription_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("type", sa.String(length=64), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["subscription_id"], ["vpn_subscriptions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_devices_subscription_id", "devices", ["subscription_id"])

    plans_table = sa.table(
        "plans",
        sa.column("id", sa.UUID()),
        sa.column("code", sa.String()),
        sa.column("name", sa.String()),
        sa.column("description", sa.Text()),
        sa.column("price", sa.Numeric()),
        sa.column("currency", sa.String()),
        sa.column("duration_days", sa.Integer()),
        sa.column("device_limit", sa.Integer()),
        sa.column("is_custom", sa.Boolean()),
        sa.column("features", postgresql.JSONB()),
        sa.column("is_active", sa.Boolean()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    now = datetime.now(timezone.utc)
    op.bulk_insert(
        plans_table,
        [
            {
                "id": "00000000-0000-4000-8000-000000000001",
                "code": "base",
                "name": "Base",
                "description": "Base - простой доступ для личного использования.",
                "price": 5,
                "currency": "USDT",
                "duration_days": 30,
                "device_limit": 2,
                "is_custom": False,
                "features": {"modes": ["smart", "privacy", "global"], "support": "standard"},
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "00000000-0000-4000-8000-000000000002",
                "code": "family",
                "name": "Family",
                "description": "Family - доступ для нескольких устройств и близких.",
                "price": 12,
                "currency": "USDT",
                "duration_days": 30,
                "device_limit": 7,
                "is_custom": False,
                "features": {"modes": ["smart", "privacy", "global"], "support": "priority", "backup_profiles": True},
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "00000000-0000-4000-8000-000000000003",
                "code": "custom",
                "name": "Custom",
                "description": "Custom - тариф-конструктор.",
                "price": 0,
                "currency": "USDT",
                "duration_days": 30,
                "device_limit": 1,
                "is_custom": True,
                "features": {"constructor": True},
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_devices_subscription_id", table_name="devices")
    op.drop_table("devices")
    op.drop_index("ix_orders_status", table_name="orders")
    op.drop_index("ix_orders_user_id", table_name="orders")
    op.drop_table("orders")
    op.drop_constraint("fk_vpn_subscriptions_plan_id_plans", "vpn_subscriptions", type_="foreignkey")
    op.drop_column("vpn_subscriptions", "plan_id")
    op.drop_index("ix_plans_code", table_name="plans")
    op.drop_table("plans")
