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

## Run

Create backend env:

```bash
cp backend/.env.example backend/.env
```

Set production secrets in `backend/.env`:

```env
PUBLIC_SUB_BASE_URL=https://sub.arvexo.ru
PUBLIC_API_BASE_URL=https://api.arvexo.ru
PUBLIC_FRONTEND_BASE_URL=https://connect.arvexo.ru
ADMIN_TOKEN=strong_secret
BOT_INTERNAL_TOKEN=strong_secret
XUI_API_TOKEN=token_from_3x_ui
XUI_BASE_URL=https://monitor.vpn.arvexo.ru:32145/Lb9BYg8zvNRCZMPeon
XUI_SUB_BASE_URL=https://monitor.vpn.arvexo.ru:2096
XUI_SUB_PATH=/arvexo/
XUI_DEFAULT_INBOUND_IDS=1,2,3,4,6
```

Start services:

```bash
docker compose up -d --build
```

Run migrations:

```bash
docker compose exec backend alembic upgrade head
```

Health check:

```bash
curl http://127.0.0.1:8012/health
```

## Ports

- Frontend: `127.0.0.1:3002`
- Backend: `127.0.0.1:8012`
- PostgreSQL external port: `127.0.0.1:6432`
- PostgreSQL internal Docker address: `postgres:5432`

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
/instructions/iphone
/instructions/android
/instructions/windows
```

The cabinet logs in with an access key, shows subscription status, QR code, copy button, instructions, and routing mode selector.

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
```

Run with Docker profile:

```bash
docker compose --profile bot up -d --build bot
```

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
```

Change mode:

```bash
curl -X POST http://127.0.0.1:8012/api/cabinet/subscription/ARVX-XXXX-XXXX/mode \
  -H "Content-Type: application/json" \
  -d '{"mode":"privacy"}'
```

Telegram upsert:

```bash
curl -X POST http://127.0.0.1:8012/api/telegram/users/upsert \
  -H "Content-Type: application/json" \
  -H "X-Bot-Token: change_me_bot_token" \
  -d '{"telegram_id":123456789,"username":"alex","first_name":"Alex"}'
```

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
```
