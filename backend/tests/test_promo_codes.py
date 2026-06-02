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


async def seed_family_plan(session_factory):
    async with session_factory() as session:
        session.add(Plan(code="family", name="Family", description="Family", price=Decimal("12.00"), duration_days=30, device_limit=7))
        await session.commit()


async def register(client: AsyncClient, email: str) -> str:
    response = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "strongpass123", "display_name": "User"},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


@pytest.fixture
def fake_xui(monkeypatch):
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


@pytest.mark.asyncio
async def test_admin_create_promo_code_returns_plain_code_once(client, session_factory):
    await seed_family_plan(session_factory)

    response = await client.post(
        "/api/admin/promo-codes",
        headers={"X-Admin-Token": "change_me_admin_token"},
        json={"plan_code": "family", "max_redemptions": 3, "code_prefix": "FAMILY"},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["code"].startswith("FAMILY-")
    assert payload["promo_code"]["redemptions_count"] == 0


@pytest.mark.asyncio
async def test_redeem_promo_code_creates_subscription(client, session_factory, fake_xui):
    await seed_family_plan(session_factory)
    created = await client.post(
        "/api/admin/promo-codes",
        headers={"X-Admin-Token": "change_me_admin_token"},
        json={"plan_code": "family", "max_redemptions": 1, "code_prefix": "FAMILY"},
    )
    code = created.json()["code"]
    jwt = await register(client, "promo@example.com")

    response = await client.post(
        "/api/cabinet/promo-codes/redeem",
        headers={"Authorization": f"Bearer {jwt}"},
        json={"code": code},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["subscription"]["device_limit"] == 7
    assert payload["subscription"]["token"]

    second = await client.post(
        "/api/cabinet/promo-codes/redeem",
        headers={"Authorization": f"Bearer {jwt}"},
        json={"code": code},
    )
    assert second.status_code == 409
