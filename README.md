# Arvexo Connect

Monorepo for Arvexo Connect:

- `frontend/` - Next.js landing.
- `backend/` - FastAPI core API v0.1.
- `postgres` - PostgreSQL service in Docker Compose.

## MVP

The project includes the landing, backend core, cabinet, and Telegram bot skeleton. The backend stores users, Telegram accounts, VPN subscriptions, access keys, and audit logs. It exposes a permanent public subscription URL:

```txt
https://sub.arvexo.ru/u/{token}
```

In MVP this endpoint proxies the original 3x-ui subscription URL. The selected `routing_mode` is stored and can be changed from the cabinet or bot.

## Development Run

Development compose uses hot reload and local dev env files:

```bash
docker compose up -d
```

Run migrations:

```bash
docker compose exec backend alembic upgrade head
```

Start dev bot too:

```bash
docker compose --profile bot up -d bot
```

Dev ports:

- Frontend: `127.0.0.1:3002`
- Backend: `127.0.0.1:8012`
- PostgreSQL external port: `127.0.0.1:6432`
- PostgreSQL internal Docker address: `postgres:5432`

## Production Run

Production compose builds immutable images and starts frontend, backend, bot, and postgres together:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Create production env files on the server:

```bash
cp backend/.env.example backend/.env
cp bot/.env.example bot/.env
```

Set production secrets in `backend/.env`:

```env
PUBLIC_SUB_BASE_URL=https://sub.arvexo.ru
PUBLIC_API_BASE_URL=https://api.arvexo.ru
PUBLIC_FRONTEND_BASE_URL=https://connect.arvexo.ru
ADMIN_TOKEN=strong_secret
BOT_INTERNAL_TOKEN=strong_secret
JWT_SECRET=strong_secret
JWT_EXPIRES_MINUTES=60
CRYPTO_PAYMENT_NETWORK=TRC20
CRYPTO_PAYMENT_ADDRESS=change_me_crypto_address
RUB_USDT_RATE=100.00
TON_PAYMENT_NETWORK=TON
TON_PAYMENT_ADDRESS=change_me_ton_address
TON_USDT_RATE=3.50
SBP_PAYMENT_RECIPIENT="ИП / получатель"
SBP_PAYMENT_URL=
SBP_QR_PAYLOAD=
SBP_QR_IMAGE_BASE64=
LOGIN_RATE_LIMIT_PER_MINUTE=12
SUBSCRIPTION_RATE_LIMIT_PER_MINUTE=120
ADMIN_RATE_LIMIT_PER_MINUTE=180
XUI_API_TOKEN=token_from_3x_ui
XUI_BASE_URL=https://monitor.vpn.arvexo.ru:32145/Lb9BYg8zvNRCZMPeon
XUI_SUB_BASE_URL=https://monitor.vpn.arvexo.ru:2096
XUI_SUB_PATH=/arvexo/
XUI_DEFAULT_INBOUND_IDS=1,2,3,4,6
```

Run migrations:

```bash
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

Health check:

```bash
curl http://127.0.0.1:8012/health
```

Production ports are the same: frontend `3002`, backend `8012`, postgres `6432`.

## Create Test User

```bash
docker compose exec backend python scripts/create_test_user.py \
  --display-name "Test User" \
  --telegram-id 123456789 \
  --original-sub-url "https://REAL_3XUI_SUB_URL" \
  --mode smart \
  --expires-at "2026-06-30T23:59:59Z"
```

## Automatic Provisioning

Admin provisioning creates a user, creates a client in 3x-ui, stores the subscription, and returns an access key:

```bash
curl -X POST http://127.0.0.1:8012/api/admin/provision-subscription \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: change_me_admin_token" \
  -d '{
    "display_name":"Test User",
    "telegram_id":123456789,
    "routing_mode":"smart",
    "duration_days":30,
    "device_limit":3
  }'
```

Telegram trial provisioning:

```bash
curl -X POST http://127.0.0.1:8012/api/telegram/provision-trial \
  -H "Content-Type: application/json" \
  -H "X-Bot-Token: change_me_bot_token" \
  -d '{"telegram_id":123456789,"username":"alex","first_name":"Alex","duration_hours":24}'
```

Both endpoints require a valid `XUI_API_TOKEN`.

## Cabinet

Frontend routes:

```txt
/cabinet/login
/cabinet
/cabinet/plans
/cabinet/checkout
/instructions/iphone
/instructions/android
/instructions/windows
```

The cabinet supports Arvexo Account email/password registration and login:

```bash
curl -X POST http://127.0.0.1:8012/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"strongpass123","display_name":"User"}'

curl -X POST http://127.0.0.1:8012/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"strongpass123"}'
```

Legacy access key login is still supported for manually issued accesses. All auth methods receive a JWT access token. Cabinet subscription status and mode changes require:

```txt
Authorization: Bearer <access_token>
```

The cabinet shows subscription status, QR code, copy button, instructions, and routing mode selector after a subscription is issued. A newly registered Arvexo Account can exist without a VPN subscription yet. The frontend stores the JWT in `localStorage` for MVP only; replace it with an httpOnly cookie session before a hardened production release.

Plans and manual crypto/SBP orders:

```bash
JWT="<access_token>"

curl http://127.0.0.1:8012/api/cabinet/plans

curl -X POST http://127.0.0.1:8012/api/cabinet/custom-plan/quote \
  -H "Content-Type: application/json" \
  -d '{"devices_count":5,"duration_days":90,"default_mode":"smart","iphone_stable":true,"priority_support":false}'

curl -X POST http://127.0.0.1:8012/api/cabinet/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{"plan_code":"base","payment_method":"crypto_manual"}'

curl -X POST http://127.0.0.1:8012/api/cabinet/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{"plan_code":"base","payment_method":"ton_manual"}'

curl -X POST http://127.0.0.1:8012/api/cabinet/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{"plan_code":"family","payment_method":"sbp_manual"}'

curl -X POST http://127.0.0.1:8012/api/cabinet/orders/<order_id>/payment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{"tx_hash":"tx123456789"}'

curl -X POST http://127.0.0.1:8012/api/admin/orders/<order_id>/confirm \
  -H "X-Admin-Token: change_me_admin_token"
```

Family promo codes can issue a free subscription without payment. The code is returned only once and only the hash is stored:

```bash
curl -X POST http://127.0.0.1:8012/api/admin/promo-codes \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: change_me_admin_token" \
  -d '{"plan_code":"family","max_redemptions":5,"code_prefix":"FAMILY","note":"Family access"}'

curl -X POST http://127.0.0.1:8012/api/cabinet/promo-codes/redeem \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{"code":"FAMILY-XXXX-XXXX"}'
```

For browser calls set:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.arvexo.ru
```

or locally use the default:

```txt
http://127.0.0.1:8012
```

## Telegram Bot

Create bot env:

```bash
cp bot/.env.example bot/.env
```

Set:

```env
TELEGRAM_BOT_TOKEN=real_bot_token
BACKEND_API_BASE_URL=http://backend:8000
BOT_INTERNAL_TOKEN=same_as_backend_bot_token
SUPPORT_URL=https://t.me/arvexo_support
ADMIN_TELEGRAM_IDS=123456789
PAYMENT_NOTIFY_INTERVAL_SECONDS=20
```

Run bot in production:

```bash
docker compose -f docker-compose.prod.yml up -d --build bot
```

`ADMIN_TELEGRAM_IDS` is a comma-separated list of Telegram numeric user IDs that can receive payment notifications and confirm orders from bot buttons. You can get your ID from bots such as `@userinfobot`. Keep `BOT_INTERNAL_TOKEN` identical in backend and bot env files.

## API Checks

Admin endpoints require:

```txt
X-Admin-Token: change_me_admin_token
```

Telegram internal endpoints require:

```txt
X-Bot-Token: change_me_bot_token
```

Public subscription:

```bash
curl http://127.0.0.1:8012/u/ARVX-XXXX-XXXX
curl http://127.0.0.1:8012/u/ARVX-XXXX-XXXX?format=raw
```

Browser requests to `/u/{token}` render a safe HTML page with status, plan, QR, instructions, and raw subscription link. VPN clients or `?format=raw` receive the upstream raw subscription body. `original_sub_url` is never exposed.

Change mode:

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8012/api/auth/access-key \
  -H "Content-Type: application/json" \
  -d '{"access_key":"ARVX-XXXX-XXXX-XXXX"}' | jq -r .access_token)

curl -X POST http://127.0.0.1:8012/api/cabinet/subscription/ARVX-XXXX-XXXX/mode \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"mode":"privacy"}'
```

Telegram link and devices:

```bash
curl -X POST http://127.0.0.1:8012/api/cabinet/telegram/link-token \
  -H "Authorization: Bearer $TOKEN"

curl http://127.0.0.1:8012/api/cabinet/subscription/ARVX-XXXX-XXXX/devices \
  -H "Authorization: Bearer $TOKEN"

curl -X POST http://127.0.0.1:8012/api/cabinet/subscription/ARVX-XXXX-XXXX/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"iPhone Alex","type":"phone"}'
```

Telegram upsert:

```bash
curl -X POST http://127.0.0.1:8012/api/telegram/users/upsert \
  -H "Content-Type: application/json" \
  -H "X-Bot-Token: change_me_bot_token" \
  -d '{"telegram_id":123456789,"username":"alex","first_name":"Alex"}'
```

Telegram device management:

```bash
curl "http://127.0.0.1:8012/api/telegram/subscriptions/<token>/devices?telegram_id=123456789" \
  -H "X-Bot-Token: change_me_bot_token"

curl -X POST "http://127.0.0.1:8012/api/telegram/subscriptions/<token>/devices?telegram_id=123456789" \
  -H "Content-Type: application/json" \
  -H "X-Bot-Token: change_me_bot_token" \
  -d '{"name":"iPhone Alex","type":"iphone"}'
```

## Admin Operations

```bash
curl http://127.0.0.1:8012/api/admin/audit-log \
  -H "X-Admin-Token: change_me_admin_token"

curl -X POST http://127.0.0.1:8012/api/admin/subscriptions/<token>/device-limit \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: change_me_admin_token" \
  -d '{"device_limit":7}'

curl -X POST http://127.0.0.1:8012/api/admin/subscriptions/<token>/retry-provisioning \
  -H "X-Admin-Token: change_me_admin_token"
```

If 3x-ui provisioning fails during admin order confirmation, the order is still marked `paid`, a subscription is created with `status=provisioning_failed`, and the cabinet/subscription page shows that access is being prepared.

## Payment Setup

Prices are shown to users in RUB. Crypto checkout converts the RUB order amount to USDT through `RUB_USDT_RATE`.

Manual USDT:

- Set `CRYPTO_PAYMENT_NETWORK=TRC20`.
- Set `CRYPTO_PAYMENT_ADDRESS` to the real USDT TRC20 wallet.
- Set `RUB_USDT_RATE`, for example `100.00` if 1 USDT = 100 RUB.
- User submits tx hash in checkout.
- Admin confirms the order in `/admin` or from the Telegram admin notification button.

Manual TON:

- Set `TON_PAYMENT_NETWORK=TON`.
- Set `TON_PAYMENT_ADDRESS` to the real TON wallet.
- Set `RUB_USDT_RATE`, for example `100.00` if 1 USDT = 100 RUB.
- Set `TON_USDT_RATE` manually, for example `3.50` if 1 TON = 3.50 USDT.
- Backend converts plan price from RUB to USDT and then to TON for checkout.
- Users must include the shown `Arvexo Connect order <order_id>` text in the TON transfer comment/message.
- User submits tx hash or transfer comment in checkout.
- Admin confirms the order in `/admin` or from the Telegram admin notification button.

Manual SBP:

- Set `SBP_PAYMENT_RECIPIENT` to the exact recipient visible in the banking app, for example `ИП Иванов Иван` or your legal recipient name.
- Optional: set `SBP_PAYMENT_URL` if your bank provides a payment link.
- Optional: set `SBP_QR_PAYLOAD` if your bank provides an SBP QR payload string.
- Optional: set `SBP_QR_IMAGE_BASE64` if you already have a QR image as base64 PNG.
- Checkout shows amount, recipient, and required transfer message `Arvexo Connect order <order_id>`. Users must include this text in the SBP transfer comment/message.
- Admin verifies the transfer manually and confirms the order in `/admin` or from the Telegram admin notification button.

## Backup and Restore

Daily PostgreSQL dump:

```bash
mkdir -p backups/postgres
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U arvexo -d arvexo_connect > backups/postgres/arvexo_connect_$(date +%F).sql
```

Restore PostgreSQL dump:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres psql -U arvexo -d arvexo_connect < backups/postgres/arvexo_connect_YYYY-MM-DD.sql
```

Back up 3x-ui databases and env files:

```bash
mkdir -p backups/xui backups/env
cp /path/to/main/x-ui.db backups/xui/x-ui-main_$(date +%F).db
cp /path/to/node/x-ui.db backups/xui/x-ui-node_$(date +%F).db
cp backend/.env backups/env/backend.env.$(date +%F)
cp bot/.env backups/env/bot.env.$(date +%F)
```

Store backups on the main server and a reserve server. Prefer encrypted archives for `.env` and `x-ui.db`.

## Production Checks

- `APP_ENV=production`.
- `JWT_SECRET`, `ADMIN_TOKEN`, and `BOT_INTERNAL_TOKEN` are non-default strong secrets.
- `XUI_API_TOKEN`, `XUI_BASE_URL`, `XUI_SUB_BASE_URL`, and `XUI_DEFAULT_INBOUND_IDS` are configured.
- `CRYPTO_PAYMENT_ADDRESS` and SBP fields are configured for enabled payment methods.
- CORS contains only production origins.
- Nginx sets security headers and proxies `api.arvexo.ru` and `sub.arvexo.ru` to backend.
- Uptime Kuma monitors frontend, backend `/health`, raw test subscription, Telegram bot, PostgreSQL, 3x-ui, Reality TCP 443, Hysteria UDP 443, and SSL certificates.

## Manual v1.0 Smoke Test

1. Open `connect.arvexo.ru` and verify landing, CTA, mobile layout, instructions, and support links.
2. Register a user and open `/cabinet`.
3. Create Base order with `crypto_manual`; submit tx hash; confirm in `/admin`; verify subscription URL and QR.
4. Create Family order with `sbp_manual`; verify recipient, payment purpose, and admin confirmation.
5. Create Custom order with devices, duration, default mode, iPhone Stable, priority support, backup profiles, and custom routing ready.
6. Open `/u/{token}` in browser and verify safe HTML page; open `/u/{token}?format=raw` and verify raw body.
7. Change routing mode in cabinet and Telegram bot.
8. Add and delete devices in cabinet and Telegram bot.
9. Link Telegram from cabinet and verify `/start link_...`.
10. Open `/cabinet/orders`, `/cabinet/settings`, `/cabinet/support`, and `/cabinet/subscription/{token}`.
11. Trigger `/admin/subscriptions/{token}/device-limit`, extend, disable, original URL change, retry provisioning, and audit log.
12. Simulate 3x-ui failure and verify `provisioning_failed` user/admin state.
13. Confirm backup commands and restore procedure are documented for the server.

## Nginx

Both `api.arvexo.ru` and `sub.arvexo.ru` can proxy to:

```txt
http://127.0.0.1:8012
```

For production set:

```env
PUBLIC_BASE_URL=https://sub.arvexo.ru
APP_ENV=production
ADMIN_TOKEN=strong_secret
BOT_INTERNAL_TOKEN=strong_secret
JWT_SECRET=strong_secret
```
