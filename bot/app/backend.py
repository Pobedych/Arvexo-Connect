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

    async def consume_link_token(
        self,
        token: str,
        telegram_id: int,
        username: str | None,
        first_name: str | None,
        language_code: str | None,
    ) -> dict:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{self.base_url}/api/telegram/link-token/consume",
                headers=self.headers,
                json={
                    "token": token,
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

    async def devices(self, telegram_id: int, token: str) -> list[dict]:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                f"{self.base_url}/api/telegram/subscriptions/{token}/devices",
                headers=self.headers,
                params={"telegram_id": telegram_id},
            )
            response.raise_for_status()
            return response.json().get("devices", [])

    async def add_device(self, telegram_id: int, token: str, name: str, device_type: str = "other") -> dict:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{self.base_url}/api/telegram/subscriptions/{token}/devices",
                headers=self.headers,
                params={"telegram_id": telegram_id},
                json={"name": name, "type": device_type},
            )
            response.raise_for_status()
            return response.json()

    async def delete_device(self, telegram_id: int, token: str, device_id: str) -> dict:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.delete(
                f"{self.base_url}/api/telegram/subscriptions/{token}/devices/{device_id}",
                headers=self.headers,
                params={"telegram_id": telegram_id},
            )
            response.raise_for_status()
            return response.json()

    async def waiting_payment_orders(self) -> list[dict]:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                f"{self.base_url}/api/telegram/admin/orders/waiting",
                headers=self.headers,
            )
            response.raise_for_status()
            return response.json().get("orders", [])

    async def confirm_order(self, order_id: str) -> dict:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{self.base_url}/api/telegram/admin/orders/{order_id}/confirm",
                headers=self.headers,
            )
            response.raise_for_status()
            return response.json()

    async def record_notification(self, telegram_id: int, event: str, message: str, token: str | None = None) -> dict:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{self.base_url}/api/telegram/notifications",
                headers=self.headers,
                json={"telegram_id": telegram_id, "event": event, "message": message, "token": token},
            )
            response.raise_for_status()
            return response.json()
