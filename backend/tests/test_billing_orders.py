from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db_session
from app.main import app
from app.models.plan import Plan
from app.services.xui_client import XuiCreatedClient


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
                Plan(code="base", name="Base", description="Base", price=Decimal("5.00"), duration_days=30, device_limit=2),
                Plan(code="family", name="Family", description="Family", price=Decimal("12.00"), duration_days=30, device_limit=7),
                Plan(code="custom", name="Custom", description="Custom", price=Decimal("0.00"), duration_days=30, device_limit=1, is_custom=True),
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
async def test_create_order_and_submit_payment(client, session_factory):
    await seed_plans(session_factory)
    jwt = await register(client)

    response = await client.post(
        "/api/cabinet/orders",
        headers={"Authorization": f"Bearer {jwt}"},
        json={"plan_code": "base"},
    )
    assert response.status_code == 201
    order = response.json()["order"]
    assert order["amount"] == "5.00"
    assert order["status"] == "pending"

    payment = await client.post(
        f"/api/cabinet/orders/{order['id']}/payment",
        headers={"Authorization": f"Bearer {jwt}"},
        json={"tx_hash": "tx123456789"},
    )

    assert payment.status_code == 200
    assert payment.json()["order"]["status"] == "waiting_confirmation"


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
