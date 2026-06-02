import httpx

from app.config import settings


class BackendClient:
    def __init__(self) -> None:
        self.base_url = settings.backend_api_base_url.rstrip("/")
        self.headers = {"X-Bot-Token": settings.bot_internal_token}

    async def upsert_user(self, telegram_id: int, username: str | None, first_name: str | None, language_code: str | None) -> dict:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{self.base_url}/api/telegram/users/upsert",
                headers=self.headers,
                json={
                    "telegram_id": telegram_id,
                    "username": username,
                    "first_name": first_name,
                    "language_code": language_code,
                },
            )
            response.raise_for_status()
            return response.json()

    async def subscriptions(self, telegram_id: int) -> list[dict]:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                f"{self.base_url}/api/telegram/users/{telegram_id}/subscriptions",
                headers=self.headers,
            )
            if response.status_code == 404:
                return []
            response.raise_for_status()
            return response.json().get("subscriptions", [])

    async def provision_trial(self, telegram_id: int, username: str | None, first_name: str | None) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self.base_url}/api/telegram/provision-trial",
                headers=self.headers,
                json={"telegram_id": telegram_id, "username": username, "first_name": first_name, "duration_hours": 24},
            )
            response.raise_for_status()
            return response.json()["subscription"]

    async def change_mode(self, telegram_id: int, token: str, mode: str) -> dict:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{self.base_url}/api/telegram/subscriptions/{token}/mode",
                headers=self.headers,
                json={"telegram_id": telegram_id, "mode": mode},
            )
            response.raise_for_status()
            return response.json()
