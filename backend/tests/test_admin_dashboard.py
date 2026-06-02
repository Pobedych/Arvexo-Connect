from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db_session
from app.main import app
from app.models.plan import Plan
from app.services.subscription_service import create_subscription
from app.services.user_service import create_user


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


async def seed_base_plan(session_factory):
    async with session_factory() as session:
        session.add(Plan(code="base", name="Base", description="Base", price=Decimal("5.00"), duration_days=30, device_limit=2))
        await session.commit()


async def register(client: AsyncClient) -> str:
    response = await client.post(
        "/api/auth/register",
        json={"email": "admin-stats@example.com", "password": "strongpass123", "display_name": "Stats User"},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


@pytest.mark.asyncio
async def test_admin_stats_and_orders(client, session_factory):
    await seed_base_plan(session_factory)
    jwt = await register(client)
    order_response = await client.post(
        "/api/cabinet/orders",
        headers={"Authorization": f"Bearer {jwt}"},
        json={"plan_code": "base"},
    )
    assert order_response.status_code == 201

    stats = await client.get("/api/admin/stats", headers={"X-Admin-Token": "change_me_admin_token"})
    orders = await client.get("/api/admin/orders", headers={"X-Admin-Token": "change_me_admin_token"})

    assert stats.status_code == 200
    assert stats.json()["users_total"] == 1
    assert stats.json()["orders_pending"] == 1
    assert orders.status_code == 200
    assert orders.json()["orders"][0]["plan_code"] == "base"


@pytest.mark.asyncio
async def test_admin_stats_requires_token(client):
    response = await client.get("/api/admin/stats")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_admin_audit_log_requires_token(client):
    response = await client.get("/api/admin/audit-log")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_admin_device_limit_updates_subscription(client, session_factory):
    async with session_factory() as session:
        user = await create_user(session, display_name="Limit User")
        subscription = await create_subscription(
            session=session,
            user_id=user.id,
            original_sub_url="https://xui.example/sub",
            public_token="ARVX-LIMIT-TEST",
        )
        await session.commit()

    response = await client.post(
        "/api/admin/subscriptions/ARVX-LIMIT-TEST/device-limit",
        headers={"X-Admin-Token": "change_me_admin_token"},
        json={"device_limit": 9},
    )

    assert response.status_code == 200
    assert response.json()["subscription"]["device_limit"] == 9
