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

Run bot in production:

```bash
docker compose -f docker-compose.prod.yml up -d --build bot
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
TOKEN=$(curl -s -X POST http://127.0.0.1:8012/api/auth/access-key \
  -H "Content-Type: application/json" \
  -d '{"access_key":"ARVX-XXXX-XXXX-XXXX"}' | jq -r .access_token)

curl -X POST http://127.0.0.1:8012/api/cabinet/subscription/ARVX-XXXX-XXXX/mode \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
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
