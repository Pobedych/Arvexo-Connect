"""order tx_hash partial unique index

Revision ID: 20260617_0010
Revises: 20260609_0009
Create Date: 2026-06-17 00:10:00

Частичный уникальный индекс на orders.tx_hash, ограниченный crypto_manual-заказами
с непустым tx_hash. Не накладывается на ton_manual/sbp_manual, где payment_reference
(он же tx_hash) — произвольная строка, введённая пользователем вручную, и совпадения
там не являются ошибкой (см. SECURITY_REVIEW.md, Critical п.1).
"""
from typing import Sequence, Union

from alembic import op

revision: str = "20260617_0010"
down_revision: Union[str, None] = "20260609_0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_orders_tx_hash_unique_crypto_manual",
        "orders",
        ["tx_hash"],
        unique=True,
        postgresql_where="payment_method = 'crypto_manual' AND tx_hash IS NOT NULL",
    )


def downgrade() -> None:
    op.drop_index("ix_orders_tx_hash_unique_crypto_manual", table_name="orders")
