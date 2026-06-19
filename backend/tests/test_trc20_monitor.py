from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.enums import OrderStatus, PaymentMethod
from app.models.order import Order
from app.models.plan import Plan
from app.services.trc20_payment_monitor import (
    _amount_matches,
    _parse_trc20_value,
    find_matching_order,
    check_payments_once,
)


@pytest.fixture
def sample_trc20_tx():
    return {
        "transaction_id": "abc123def456",
        "from": "sender_address",
        "to": "receiver_address",
        "value": "1990000",
        "token_info": {"symbol": "USDT", "decimals": 6},
        "block_timestamp": 1718000000000,
    }


def test_parse_trc20_value():
    assert _parse_trc20_value("1990000") == Decimal("1.99")
    assert _parse_trc20_value("1000000") == Decimal("1.00")
    assert _parse_trc20_value("50000") == Decimal("0.05")


def test_amount_matches_exact():
    assert _amount_matches(Decimal("1.99"), Decimal("1.99")) is True


def test_amount_matches_within_tolerance():
    # С 2026-06-17 суммы солятся до 6 знака, допуск нужен только на округление Decimal,
    # а не на разруливание коллизий между заказами (раньше допуск был 0.01).
    assert _amount_matches(Decimal("1.99"), Decimal("1.990001")) is True
    assert _amount_matches(Decimal("1.99"), Decimal("1.989999")) is True


def test_amount_matches_outside_tolerance():
    assert _amount_matches(Decimal("1.99"), Decimal("1.985")) is False
    assert _amount_matches(Decimal("1.99"), Decimal("1.97")) is False
    assert _amount_matches(Decimal("1.99"), Decimal("2.01")) is False


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


async def seed_test_data(session):
    plan = Plan(
        code="base", name="Base", description="Base",
        price=Decimal("199.00"), currency="RUB",
        duration_days=30, device_limit=2,
    )
    session.add(plan)
    await session.flush()

    order = Order(
        plan_id=plan.id,
        status=OrderStatus.PENDING.value,
        amount=Decimal("199.00"),
        currency="RUB",
        payment_method=PaymentMethod.CRYPTO_MANUAL.value,
        crypto_network="TRC20",
        crypto_address="wallet_address",
        crypto_amount=Decimal("1.99"),
    )
    session.add(order)
    await session.flush()
    return plan, order


@pytest.mark.asyncio
async def test_find_matching_order_found(db_session, sample_trc20_tx):
    from app.config import settings

    plan, order = await seed_test_data(db_session)
    sample_trc20_tx["to"] = "wallet_address"

    with patch.object(settings, "crypto_payment_address", "wallet_address"):
        result = await find_matching_order(db_session, sample_trc20_tx)

    assert result is not None
    assert result.id == order.id


@pytest.mark.asyncio
async def test_find_matching_order_no_match_wrong_amount(db_session, sample_trc20_tx):
    from app.config import settings

    plan, order = await seed_test_data(db_session)
    sample_trc20_tx["value"] = "5000000"
    sample_trc20_tx["to"] = "wallet_address"

    with patch.object(settings, "crypto_payment_address", "wallet_address"):
        result = await find_matching_order(db_session, sample_trc20_tx)

    assert result is None


@pytest.mark.asyncio
async def test_find_matching_order_already_processed(db_session, sample_trc20_tx):
    from app.config import settings

    plan, order = await seed_test_data(db_session)
    order.tx_hash = "abc123def456"
    await db_session.flush()

    sample_trc20_tx["to"] = "wallet_address"

    with patch.object(settings, "crypto_payment_address", "wallet_address"):
        result = await find_matching_order(db_session, sample_trc20_tx)

    assert result is None


@pytest.mark.asyncio
async def test_check_payments_once_no_address():
    from app.config import settings

    with patch.object(settings, "crypto_payment_address", None):
        count = await check_payments_once()
    assert count == 0


@pytest.mark.asyncio
async def test_check_payments_once_with_matching_tx(db_session, sample_trc20_tx):
    plan, order = await seed_test_data(db_session)
    sample_trc20_tx["to"] = "wallet_address"

    mock_session = AsyncMock()
    mock_session.__aenter__ = AsyncMock(return_value=db_session)
    mock_session.__aexit__ = AsyncMock(return_value=False)

    with (
        patch("app.services.trc20_payment_monitor.AsyncSessionLocal", return_value=mock_session),
        patch("app.services.trc20_payment_monitor.fetch_recent_trc20_transfers", return_value=[sample_trc20_tx]),
        patch("app.services.trc20_payment_monitor.settings") as mock_settings,
        patch("app.services.trc20_payment_monitor.confirm_order_in_session") as mock_confirm,
    ):
        mock_settings.crypto_payment_address = "wallet_address"
        mock_settings.trongrid_api_key = None

        mock_confirm.return_value = AsyncMock(ok=True)

        count = await check_payments_once()

    assert count == 1
    mock_confirm.assert_called_once()
