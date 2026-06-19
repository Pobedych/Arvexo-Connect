from html import escape
from urllib.parse import quote

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db_session
from app.config import settings
from app.models.vpn_subscription import VpnSubscription
from app.services.device_service import record_raw_subscription_device
from app.services.subscription_proxy import build_subscription_headers, proxy_subscription
from app.services.subscription_service import ensure_subscription_accessible, require_subscription_by_token
from app.utils.qr import qr_data_uri
from app.utils.rate_limit import enforce_rate_limit

router = APIRouter(tags=["public-subscription"])


@router.get("/u/{token}")
async def get_public_subscription(
    token: str,
    request: Request,
    format: str | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
):
    subscription = await require_public_subscription(session, token)
    ensure_subscription_accessible(subscription)
    if format == "raw" or not wants_html(request):
        await enforce_rate_limit(request, "subscription_raw", settings.subscription_rate_limit_per_minute)
        await record_raw_subscription_device(session, subscription, request)
        response = await proxy_subscription(session, subscription)
        await session.commit()
        return response
    return Response(
        content=render_subscription_html(subscription),
        media_type="text/html; charset=utf-8",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache", "Expires": "0"},
    )


async def require_public_subscription(session: AsyncSession, token: str) -> VpnSubscription:
    result = await session.execute(
        select(VpnSubscription)
        .options(selectinload(VpnSubscription.plan), selectinload(VpnSubscription.devices))
        .where(VpnSubscription.public_token == token)
    )
    subscription = result.scalar_one_or_none()
    if subscription is None:
        return await require_subscription_by_token(session, token)
    return subscription


def wants_html(request: Request) -> bool:
    accept = request.headers.get("accept", "")
    user_agent = request.headers.get("user-agent", "").lower()
    if "format=raw" in str(request.url):
        return False
    if "mozilla" in user_agent or "chrome" in user_agent or "safari" in user_agent:
        return "text/html" in accept or "*/*" in accept
    return "text/html" in accept and "application/json" not in accept


def render_subscription_html(subscription: VpnSubscription) -> str:
    plan_name = subscription.plan.name if subscription.plan else "Arvexo Connect"
    raw_url = f"{settings.public_sub_base_url.rstrip('/')}/u/{quote(subscription.public_token)}?format=raw"
    cabinet_url = f"{settings.public_frontend_base_url.rstrip('/')}/cabinet/subscription/{quote(subscription.public_token)}"
    support_url = f"{settings.public_frontend_base_url.rstrip('/')}/cabinet/support"
    telegram_url = settings.telegram_bot_url.rstrip("/")
    expires = subscription.expires_at.strftime("%d.%m.%Y") if subscription.expires_at else "без срока"
    days = "без срока" if subscription.expires_at is None else expires
    qr_src = qr_data_uri(raw_url)
    devices = [device for device in subscription.devices if device.is_active]
    device_items = "".join(
        f"""<li><strong>{escape(device.name or "Устройство")}</strong><span>{escape(device.type or "other")}</span></li>"""
        for device in devices
    ) or "<li><strong>Устройства пока не добавлены</strong><span>Добавьте их в кабинете</span></li>"
    return f"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Arvexo Connect Subscription</title>
  <style>
    body {{ margin:0; font-family: Inter, Arial, sans-serif; background:#050505; color:#fff; }}
    main {{ width:min(calc(100% - 32px), 920px); margin:0 auto; padding:48px 0; }}
    .panel {{ border:1px solid rgba(255,255,255,.1); background:#101010; border-radius:12px; padding:28px; }}
    .eyebrow {{ color:#ff2b3a; font-size:12px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; }}
    h1 {{ margin:14px 0 0; font-size:34px; }}
    .grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-top:22px; }}
    .item {{ border:1px solid rgba(255,255,255,.08); background:#00000040; border-radius:10px; padding:14px; }}
    .label {{ color:rgba(255,255,255,.45); font-size:12px; }}
    .value {{ margin-top:8px; font-weight:700; word-break:break-word; }}
    .actions {{ display:flex; flex-wrap:wrap; gap:10px; margin-top:24px; }}
    a, button {{ min-height:44px; display:inline-flex; align-items:center; border-radius:10px; padding:0 16px; font-weight:800; font-size:14px; text-decoration:none; }}
    a.primary, button.primary {{ background:#ef233c; color:white; border:0; cursor:pointer; }}
    a.secondary {{ border:1px solid rgba(255,255,255,.12); color:white; }}
    img {{ width:min(320px,100%); background:white; padding:14px; border-radius:12px; margin-top:24px; }}
    ul {{ list-style:none; padding:0; margin:18px 0 0; display:grid; gap:10px; }}
    li {{ display:flex; justify-content:space-between; gap:12px; border:1px solid rgba(255,255,255,.08); background:#00000040; border-radius:10px; padding:12px 14px; }}
    li span {{ color:rgba(255,255,255,.5); }}
    .notice {{ margin-top:18px; color:rgba(255,255,255,.62); font-size:14px; line-height:1.6; }}
  </style>
</head>
<body>
  <main>
    <section class="panel">
      <div class="eyebrow">Arvexo Connect Subscription</div>
      <h1>{escape(plan_name)}</h1>
      <div class="grid">
        <div class="item"><div class="label">Статус</div><div class="value">{escape(subscription.status)}</div></div>
        <div class="item"><div class="label">Тариф</div><div class="value">{escape(plan_name)}</div></div>
        <div class="item"><div class="label">Режим</div><div class="value">{escape(subscription.routing_mode)}</div></div>
        <div class="item"><div class="label">Истекает</div><div class="value">{escape(days)}</div></div>
        <div class="item"><div class="label">Устройства</div><div class="value">{len(devices)} / {subscription.device_limit}</div></div>
      </div>
      <img alt="Subscription QR" src="{qr_src}" />
      <p class="notice">Импортируйте raw subscription в Happ, V2RayTun, Hiddify, NekoBox, v2rayNG или Nekoray. Если меняли режим, обновите подписку в приложении.</p>
      <div class="actions">
        <a class="primary" href="{raw_url}">Raw subscription</a>
        <button class="primary" type="button" onclick="navigator.clipboard.writeText('{raw_url}')">Copy raw</button>
        <a class="secondary" href="{settings.public_frontend_base_url.rstrip('/')}/instructions/iphone">Инструкция iPhone</a>
        <a class="secondary" href="{settings.public_frontend_base_url.rstrip('/')}/instructions/android">Инструкция Android</a>
        <a class="secondary" href="{settings.public_frontend_base_url.rstrip('/')}/instructions/windows">Инструкция Windows</a>
        <a class="secondary" href="{cabinet_url}">Личный кабинет</a>
        <a class="secondary" href="{telegram_url}">Telegram</a>
        <a class="secondary" href="{support_url}">Поддержка</a>
      </div>
      <h2 style="margin:28px 0 0;font-size:20px;">Устройства</h2>
      <ul>{device_items}</ul>
    </section>
  </main>
</body>
</html>"""


@router.head("/u/{token}")
async def head_public_subscription(token: str, session: AsyncSession = Depends(get_db_session)):
    subscription = await require_subscription_by_token(session, token)
    ensure_subscription_accessible(subscription)
    return Response(headers=build_subscription_headers(subscription), media_type="text/plain; charset=utf-8")
