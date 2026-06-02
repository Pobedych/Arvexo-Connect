import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db_session
from app.enums import RoutingMode
from app.main import app
from app.services.access_key_service import create_access_key
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


async def create_user_access(session_factory, token: str):
    async with session_factory() as session:
        user = await create_user(session, display_name=f"User {token}")
        subscription = await create_subscription(
            session=session,
            user_id=user.id,
            original_sub_url="https://example.com/sub",
            routing_mode=RoutingMode.SMART,
            public_token=token,
        )
        access_key = await create_access_key(session, user.id)
        await session.commit()
        return user, subscription, access_key


async def login(client: AsyncClient, access_key: str) -> str:
    response = await client.post("/api/auth/access-key", json={"access_key": access_key})
    assert response.status_code == 200
    payload = response.json()
    return payload["access_token"]


@pytest.mark.asyncio
async def test_login_with_valid_access_key_returns_token(client, session_factory):
    _, _, access_key = await create_user_access(session_factory, "ARVX-1111-1111-1111")

    response = await client.post("/api/auth/access-key", json={"access_key": access_key})

    assert response.status_code == 200
    payload = response.json()
    assert payload["access_token"]
    assert payload["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_invalid_access_key_returns_401(client):
    response = await client.post("/api/auth/access-key", json={"access_key": "wrong"})

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_cabinet_subscription_status_without_token_returns_401(client, session_factory):
    await create_user_access(session_factory, "ARVX-2222-2222-2222")

    response = await client.get("/api/cabinet/subscription/ARVX-2222-2222-2222")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_cabinet_subscription_status_with_correct_token_returns_200(client, session_factory):
    _, _, access_key = await create_user_access(session_factory, "ARVX-3333-3333-3333")
    jwt = await login(client, access_key)

    response = await client.get(
        "/api/cabinet/subscription/ARVX-3333-3333-3333",
        headers={"Authorization": f"Bearer {jwt}"},
    )

    assert response.status_code == 200
    assert response.json()["token"] == "ARVX-3333-3333-3333"


@pytest.mark.asyncio
async def test_cabinet_subscription_status_with_another_user_token_returns_403(client, session_factory):
    await create_user_access(session_factory, "ARVX-4444-4444-4444")
    _, _, other_access_key = await create_user_access(session_factory, "ARVX-5555-5555-5555")
    other_jwt = await login(client, other_access_key)

    response = await client.get(
        "/api/cabinet/subscription/ARVX-4444-4444-4444",
        headers={"Authorization": f"Bearer {other_jwt}"},
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_mode_change_without_token_returns_401(client, session_factory):
    await create_user_access(session_factory, "ARVX-6666-6666-6666")

    response = await client.post(
        "/api/cabinet/subscription/ARVX-6666-6666-6666/mode",
        json={"mode": "privacy"},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_mode_change_with_correct_user_token_returns_200(client, session_factory):
    _, _, access_key = await create_user_access(session_factory, "ARVX-7777-7777-7777")
    jwt = await login(client, access_key)

    response = await client.post(
        "/api/cabinet/subscription/ARVX-7777-7777-7777/mode",
        headers={"Authorization": f"Bearer {jwt}"},
        json={"mode": "privacy"},
    )

    assert response.status_code == 200
    assert response.json()["routing_mode"] == "privacy"


@pytest.mark.asyncio
async def test_mode_change_with_another_user_token_returns_403(client, session_factory):
    await create_user_access(session_factory, "ARVX-8888-8888-8888")
    _, _, other_access_key = await create_user_access(session_factory, "ARVX-9999-9999-9999")
    other_jwt = await login(client, other_access_key)

    response = await client.post(
        "/api/cabinet/subscription/ARVX-8888-8888-8888/mode",
        headers={"Authorization": f"Bearer {other_jwt}"},
        json={"mode": "privacy"},
    )

    assert response.status_code == 403
