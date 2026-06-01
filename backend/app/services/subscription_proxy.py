import httpx
from fastapi import HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.vpn_subscription import VpnSubscription
from app.services.audit_service import write_audit_log
from app.utils.time import utc_now


NO_CACHE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
}


async def proxy_subscription(session: AsyncSession, subscription: VpnSubscription) -> Response:
    try:
        async with httpx.AsyncClient(
            timeout=settings.request_timeout,
            verify=settings.upstream_ssl_verify,
            follow_redirects=True,
        ) as client:
            upstream = await client.get(subscription.original_sub_url)
            upstream.raise_for_status()
    except httpx.HTTPError as exc:
        await write_audit_log(
            session,
            "subscription_upstream_failed",
            user_id=subscription.user_id,
            metadata={"token_prefix": subscription.public_token[:9], "error": exc.__class__.__name__},
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch upstream subscription",
        ) from exc

    subscription.last_access_at = utc_now()
    await write_audit_log(
        session,
        "subscription_accessed",
        user_id=subscription.user_id,
        metadata={"token_prefix": subscription.public_token[:9]},
    )
    content_type = upstream.headers.get("content-type", "text/plain; charset=utf-8")
    return Response(content=upstream.content, media_type=content_type, headers=NO_CACHE_HEADERS)
