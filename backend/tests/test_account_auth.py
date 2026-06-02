import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db_session
from app.main import app


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


@pytest.mark.asyncio
async def test_register_account_returns_token(client):
    response = await client.post(
        "/api/auth/register",
        json={"email": "alex@example.com", "password": "strongpass123", "display_name": "Alex"},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["access_token"]
    assert payload["token_type"] == "bearer"
    assert payload["subscriptions"] == []


@pytest.mark.asyncio
async def test_register_existing_account_returns_409(client):
    payload = {"email": "alex@example.com", "password": "strongpass123", "display_name": "Alex"}
    assert (await client.post("/api/auth/register", json=payload)).status_code == 201

    response = await client.post("/api/auth/register", json=payload)

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_login_account_returns_token(client):
    await client.post(
        "/api/auth/register",
        json={"email": "alex@example.com", "password": "strongpass123", "display_name": "Alex"},
    )

    response = await client.post("/api/auth/login", json={"email": "alex@example.com", "password": "strongpass123"})

    assert response.status_code == 200
    assert response.json()["access_token"]


@pytest.mark.asyncio
async def test_login_account_with_wrong_password_returns_401(client):
    await client.post(
        "/api/auth/register",
        json={"email": "alex@example.com", "password": "strongpass123", "display_name": "Alex"},
    )

    response = await client.post("/api/auth/login", json={"email": "alex@example.com", "password": "wrongpass123"})

    assert response.status_code == 401
