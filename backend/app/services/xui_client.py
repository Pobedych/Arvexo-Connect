import uuid
from dataclasses import dataclass
from datetime import datetime

import httpx
from fastapi import HTTPException, status

from app.config import settings


@dataclass(frozen=True)
class XuiCreatedClient:
    client_uuid: str
    client_email: str
    sub_id: str
    inbound_ids: list[int]
    original_sub_url: str


class XuiClient:
    def __init__(self) -> None:
        self.base_url = settings.xui_base_url.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {settings.xui_api_token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def _request(self, method: str, path: str, json: dict | None = None) -> dict:
        if not settings.xui_api_token or settings.xui_api_token == "change_me_xui_api_token":
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="XUI API token is not configured",
            )

        async with httpx.AsyncClient(
            timeout=settings.xui_request_timeout,
            verify=settings.xui_ssl_verify,
            follow_redirects=True,
        ) as client:
            try:
                response = await client.request(method, f"{self.base_url}{path}", headers=self.headers, json=json)
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to create client in 3x-ui",
                ) from exc

        data = response.json()
        if data.get("success") is not True:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=data.get("msg") or "Failed to create client in 3x-ui",
            )
        return data

    async def get_inbounds_options(self) -> list[dict]:
        data = await self._request("GET", "/panel/api/inbounds/options")
        return list(data.get("obj") or [])

    async def add_client(
        self,
        public_token: str,
        telegram_id: int | None,
        expires_at: datetime | None,
        traffic_limit_gb: int | None,
        inbound_ids: list[int] | None = None,
    ) -> XuiCreatedClient:
        inbound_ids = inbound_ids or settings.xui_default_inbound_id_list
        if not inbound_ids:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Invalid x-ui inbound configuration",
            )

        client_uuid = str(uuid.uuid4())
        sub_id = f"sub_{uuid.uuid4().hex[:10]}"
        client_email = f"tg_{telegram_id}_{public_token[:9]}" if telegram_id else f"arvexo_{public_token}"
        expiry_time = int(expires_at.timestamp() * 1000) if expires_at else 0
        total_gb = int(traffic_limit_gb * 1024 * 1024 * 1024) if traffic_limit_gb else 0

        payload = {
            "client": {
                "email": client_email,
                "id": client_uuid,
                "uuid": client_uuid,
                "subId": sub_id,
                "totalGB": total_gb,
                "expiryTime": expiry_time,
                "limitIp": 0,
                "tgId": telegram_id or 0,
                "comment": public_token,
                "enable": True,
            },
            "inboundIds": inbound_ids,
        }
        await self._request("POST", "/panel/api/clients/add", json=payload)

        return XuiCreatedClient(
            client_uuid=client_uuid,
            client_email=client_email,
            sub_id=sub_id,
            inbound_ids=inbound_ids,
            original_sub_url=build_xui_subscription_url(sub_id),
        )


def build_xui_subscription_url(sub_id: str) -> str:
    base = settings.xui_sub_base_url.rstrip("/")
    path = settings.xui_sub_path.strip("/")
    return f"{base}/{path}/{sub_id}"
