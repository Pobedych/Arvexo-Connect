from datetime import timedelta
from decimal import Decimal
from uuid import UUID

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db_session
from app.main import app
from app.models.order import Order
from app.models.plan import Plan
from app.config import settings
from app.services.xui_client import XuiCreatedClient
from app.utils.time import utc_now


@pytest_asyncio.fixture
async def session_factory():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(bind=engine, expire_on_commit=False)

    async def override_db_session():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_db_session
    try:
        yield factory
    finally:
        app.dependency_overrides.pop(get_db_session, None)
        await engine.dispose()


@pytest_asyncio.fixture
async def client(session_factory):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as test_client:
        yield test_client


async def seed_plans(session_factory):
    async with session_factory() as session:
        session.add_all(
            [
                Plan(code="base", name="Base", description="Base", price=Decimal("199.00"), currency="RUB", duration_days=30, device_limit=2),
                Plan(code="family", name="Family", description="Family", price=Decimal("599.00"), currency="RUB", duration_days=30, device_limit=7),
                Plan(code="custom", name="Custom", description="Custom", price=Decimal("0.00"), currency="RUB", duration_days=30, device_limit=1, is_custom=True),
            ]
        )
        await session.commit()


async def register(client: AsyncClient) -> str:
    response = await client.post(
        "/api/auth/register",
        json={"email": "buyer@example.com", "password": "strongpass123", "display_name": "Buyer"},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


@pytest.mark.asyncio
async def test_list_plans_returns_seeded_plans(client, session_factory):
    await seed_plans(session_factory)

    response = await client.get("/api/cabinet/plans")

    assert response.status_code == 200
    assert {item["code"] for item in response.json()["plans"]} == {"base", "family", "custom"}


@pytest.mark.asyncio
async def test_create_order_requires_token(client, session_factory):
    await seed_plans(session_factory)

    response = await client.post("/api/cabinet/orders", json={"plan_code": "base"})

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_order_and_submit_payment(client, session_factory, monkeypatch):
    await seed_plans(session_factory)
    jwt = await register(client)
    monkeypatch.setattr(settings, "rub_usdt_rate", Decimal("100.00"))

    response = await client.post(
        "/api/cabinet/orders",
        headers={"Authorization": f"Bearer {jwt}"},
        json={"plan_code": "base"},
    )
    assert response.status_code == 201
    order = response.json()["order"]
    assert order["amount"] == "199.00"
    assert order["currency"] == "RUB"
    assert order["payment_amount"] == "1.990000"
    assert order["payment_currency"] == "USDT"
    assert order["status"] == "pending"
    assert order["payment_purpose"] == f"Arvexo Connect order {order['id']}"

    payment = await client.post(
        f"/api/cabinet/orders/{order['id']}/payment",
        headers={"Authorization": f"Bearer {jwt}"},
        json={"payment_reference": "tx123456789"},
    )

    assert payment.status_code == 200
    assert payment.json()["order"]["status"] == "waiting_confirmation"
    assert payment.json()["order"]["payment_reference"] == "tx123456789"


@pytest.mark.asyncio
async def test_create_sbp_manual_order(client, session_factory):
    await seed_plans(session_factory)
    jwt = await register(client)

    response = await client.post(
        "/api/cabinet/orders",
        headers={"Authorization": f"Bearer {jwt}"},
        json={"plan_code": "base", "payment_method": "sbp_manual"},
    )

    assert response.status_code == 201
    order = response.json()["order"]
    assert order["payment_method"] == "sbp_manual"
    assert order["provider"] == "sbp_manual"
    assert order["payment_amount"] == "199.00"
    assert order["payment_currency"] == "RUB"
    assert order["crypto_address"] is None


@pytest.mark.asyncio
async def test_user_can_delete_unpaid_order(client, session_factory):
    await seed_plans(session_factory)
    jwt = await register(client)
    response = await client.post(
        "/api/cabinet/orders",
        headers={"Authorization": f"Bearer {jwt}"},
        json={"plan_code": "base", "payment_method": "sbp_manual"},
    )
    order_id = response.json()["order"]["id"]

    deleted = await client.delete(f"/api/cabinet/orders/{order_id}", headers={"Authorization": f"Bearer {jwt}"})
    listed = await client.get("/api/cabinet/orders", headers={"Authorization": f"Bearer {jwt}"})

    assert deleted.status_code == 200
    assert deleted.json()["deleted"] is True
    assert listed.json()["orders"] == []


@pytest.mark.asyncio
async def test_user_cannot_delete_paid_order(client, session_factory, monkeypatch):
    await seed_plans(session_factory)
    jwt = await register(client)
    response = await client.post(
        "/api/cabinet/orders",
        headers={"Authorization": f"Bearer {jwt}"},
        json={"plan_code": "base", "payment_method": "sbp_manual"},
    )
    order_id = response.json()["order"]["id"]

    class FakeXuiClient:
        async def add_client(self, public_token, telegram_id, expires_at, traffic_limit_gb, inbound_ids=None):
            return XuiCreatedClient(
                client_uuid="client-uuid",
                client_email=f"arvexo_{public_token}",
                sub_id="sub-test",
                inbound_ids=[1],
                original_sub_url="https://xui.example/sub-test",
            )

    monkeypatch.setattr("app.services.provisioning_service.XuiClient", FakeXuiClient)
    confirmed = await client.post(f"/api/admin/orders/{order_id}/confirm", headers={"X-Admin-Token": "change_me_admin_token"})
    deleted = await client.delete(f"/api/cabinet/orders/{order_id}", headers={"Authorization": f"Bearer {jwt}"})

    assert confirmed.status_code == 200
    assert deleted.status_code == 409


@pytest.mark.asyncio
async def test_old_unpaid_orders_are_cleaned_from_history(client, session_factory):
    await seed_plans(session_factory)
    jwt = await register(client)
    response = await client.post(
        "/api/cabinet/orders",
        headers={"Authorization": f"Bearer {jwt}"},
        json={"plan_code": "base", "payment_method": "sbp_manual"},
    )
    order_id = UUID(response.json()["order"]["id"])
    async with session_factory() as session:
        order = await session.get(Order, order_id)
        assert order is not None
        order.created_at = utc_now() - timedelta(days=15)
        await session.commit()

    listed = await client.get("/api/cabinet/orders", headers={"Authorization": f"Bearer {jwt}"})

    assert listed.status_code == 200
    assert listed.json()["orders"] == []


@pytest.mark.asyncio
async def test_create_ton_manual_order_uses_ton_amount(client, session_factory, monkeypatch):
    await seed_plans(session_factory)
    jwt = await register(client)
    monkeypatch.setattr(settings, "rub_usdt_rate", Decimal("100.00"))
    monkeypatch.setattr(settings, "ton_payment_address", "UQ_TEST_TON_WALLET")
    monkeypatch.setattr(settings, "ton_usdt_rate", Decimal("2.50"))

    response = await client.post(
        "/api/cabinet/orders",
        headers={"Authorization": f"Bearer {jwt}"},
        json={"plan_code": "base", "payment_method": "ton_manual"},
    )

    assert response.status_code == 201
    order = response.json()["order"]
    assert order["payment_method"] == "ton_manual"
    assert order["payment_currency"] == "TON"
    assert order["payment_amount"] == "0.796000000"
    assert order["crypto_network"] == "TON"
    assert order["crypto_address"] == "UQ_TEST_TON_WALLET"


@pytest.mark.asyncio
async def test_custom_quote_accepts_all_v1_fields(client, session_factory):
    await seed_plans(session_factory)

    response = await client.post(
        "/api/cabinet/custom-plan/quote",
        json={
            "devices_count": 5,
            "duration_days": 90,
            "default_mode": "global",
            "iphone_stable": True,
            "priority_support": True,
            "backup_profiles": True,
            "custom_routing_ready": True,
        },
    )

    assert response.status_code == 200
    assert response.json()["features"]["backup_profiles"] is True
    assert response.json()["features"]["custom_routing_ready"] is True


@pytest.mark.asyncio
async def test_admin_confirm_order_creates_subscription(client, session_factory, monkeypatch):
    await seed_plans(session_factory)
    jwt = await register(client)
    response = await client.post(
        "/api/cabinet/orders",
        headers={"Authorization": f"Bearer {jwt}"},
        json={"plan_code": "base"},
    )
    order_id = response.json()["order"]["id"]

    class FakeXuiClient:
        async def add_client(self, public_token, telegram_id, expires_at, traffic_limit_gb, inbound_ids=None):
            return XuiCreatedClient(
                client_uuid="client-uuid",
                client_email=f"arvexo_{public_token}",
                sub_id="sub-test",
                inbound_ids=[1],
                original_sub_url="https://xui.example/sub-test",
            )

    monkeypatch.setattr("app.services.provisioning_service.XuiClient", FakeXuiClient)

    response = await client.post(f"/api/admin/orders/{order_id}/confirm", headers={"X-Admin-Token": "change_me_admin_token"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["order"]["status"] == "paid"
    assert payload["order"]["subscription_token"]
    assert payload["subscription_url"].endswith(f"/u/{payload['order']['subscription_token']}")


@pytest.mark.asyncio
async def test_bot_can_list_and_confirm_waiting_payment_order(client, session_factory, monkeypatch):
    await seed_plans(session_factory)
    jwt = await register(client)
    response = await client.post(
        "/api/cabinet/orders",
        headers={"Authorization": f"Bearer {jwt}"},
        json={"plan_code": "base", "payment_method": "sbp_manual"},
    )
    order_id = response.json()["order"]["id"]
    submitted = await client.post(
        f"/api/cabinet/orders/{order_id}/payment",
        headers={"Authorization": f"Bearer {jwt}"},
        json={"payment_reference": "bank transfer 1234"},
    )

    class FakeXuiClient:
        async def add_client(self, public_token, telegram_id, expires_at, traffic_limit_gb, inbound_ids=None):
            return XuiCreatedClient(
                client_uuid="client-uuid",
                client_email=f"arvexo_{public_token}",
                sub_id="sub-test",
                inbound_ids=[1],
                original_sub_url="https://xui.example/sub-test",
            )

    monkeypatch.setattr("app.services.provisioning_service.XuiClient", FakeXuiClient)
    waiting = await client.get("/api/telegram/admin/orders/waiting", headers={"X-Bot-Token": "change_me_bot_token"})
    confirmed = await client.post(f"/api/telegram/admin/orders/{order_id}/confirm", headers={"X-Bot-Token": "change_me_bot_token"})

    assert submitted.status_code == 200
    assert waiting.status_code == 200
    assert waiting.json()["orders"][0]["id"] == order_id
    assert waiting.json()["orders"][0]["payment_reference"] == "bank transfer 1234"
    assert confirmed.status_code == 200
    assert confirmed.json()["order"]["status"] == "paid"
    assert confirmed.json()["subscription_url"].endswith(f"/u/{confirmed.json()['order']['subscription_token']}")


@pytest.mark.asyncio
async def test_admin_confirm_order_marks_provisioning_failed_when_xui_fails(client, session_factory, monkeypatch):
    await seed_plans(session_factory)
    jwt = await register(client)
    response = await client.post(
        "/api/cabinet/orders",
        headers={"Authorization": f"Bearer {jwt}"},
        json={"plan_code": "base"},
    )
    order_id = response.json()["order"]["id"]

    class FailingXuiClient:
        async def add_client(self, public_token, telegram_id, expires_at, traffic_limit_gb, inbound_ids=None):
            raise RuntimeError("xui unavailable")

    monkeypatch.setattr("app.services.provisioning_service.XuiClient", FailingXuiClient)

    response = await client.post(f"/api/admin/orders/{order_id}/confirm", headers={"X-Admin-Token": "change_me_admin_token"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["order"]["status"] == "paid"
    subscriptions = await client.get("/api/admin/subscriptions", headers={"X-Admin-Token": "change_me_admin_token"})
    assert subscriptions.status_code == 200
    assert subscriptions.json()["subscriptions"][0]["status"] == "provisioning_failed"
