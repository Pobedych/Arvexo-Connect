# Arvexo Connect

Monorepo for Arvexo Connect:

- `frontend/` - Next.js landing.
- `backend/` - FastAPI core API v0.1.
- `postgres` - PostgreSQL service in Docker Compose.

## Backend v0.1

The backend stores users, Telegram accounts, VPN subscriptions, access keys, and audit logs. It exposes a permanent public subscription URL:

```txt
https://sub.arvexo.ru/u/{token}
```

In v0.1 this endpoint proxies the original 3x-ui subscription URL. Later versions can generate different configs by `routing_mode`.

## Run

Create backend env:

```bash
cp backend/.env.example backend/.env
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
