# Security-ревью Arvexo Connect

Дата: 2026-06-17. Скоуп: весь монорепозиторий (backend, bot, frontend, Docker/конфиги), включая незакоммиченные изменения (TRC20-монитор).

## Critical

### 1. Перепутывание платежей в TRC20-мониторе (`backend/app/services/trc20_payment_monitor.py`)

Все крипто-заказы используют один общий адрес кошелька (`settings.crypto_payment_address`). Входящий перевод сопоставляется с заказом только по сумме (`±0.01 USDT`, `_amount_matches`), без уникального адреса/memo/соли на заказ. Из кандидатов (`find_matching_order`, строки 57-81) выбирается первый по `created_at desc`, то есть самый новый подходящий по сумме заказ — а не тот, который реально оплачен.

Так как `crypto_amount` детерминированно вычисляется из цены тарифа и курса (`billing_service.calculate_payment_amount`), два заказа на один тариф, оформленные близко по времени, получают одинаковую сумму к оплате. Любой пользователь может создать новый заказ на тот же тариф сразу после того, как другой пользователь отправил перевод, и "перехватить" чужой платёж — система подтвердит и выдаст подписку именно новому (более позднему) заказу.

Дополнительно: на `Order.tx_hash` нет уникального ограничения в БД (`backend/app/models/order.py`), нет блокировки строк (`SELECT … FOR UPDATE`) — фоновый цикл (раз в 30 сек) и ручной триггер `POST /api/admin/check-trc20-payments` могут выполняться конкурентно над одними и теми же заказами.

Подтверждение заказа (`order_confirmation_service.confirm_order_in_session`) идемпотентно для одного заказа (ранний возврат при `status == PAID`), но это не защищает от описанной проблемы — баг не в повторной обработке, а в выборе *какого* заказа.

Рекомендация: привязывать платёж к заказу через уникальный идентификатор (memo/comment в TRC20 не предусмотрен — тогда генерировать уникальную сумму с копейками-солью на каждый заказ, либо отдельный адрес/sub-account на заказ), добавить уникальный констрейнт на `tx_hash` и блокировку строки заказа при сопоставлении.

Затронуто только TRC20-автомонитор; TON и SBP подтверждаются вручную администратором (`submit_order_payment` + ручной confirm), отдельного автосопоставления для них нет.

## High

### 2. Rate limiting обходится подменой `X-Forwarded-For` (`backend/app/utils/rate_limit.py`)

```python
def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    ...
```

Заголовок берётся от любого клиента без проверки доверенного проксирующего слоя. Любой внешний запрос с произвольным `X-Forwarded-For` обходит лимит, действующий по `(scope, ip)`. Это снимает защиту от брутфорса с `/auth/login`, `/auth/register`, `/auth/access-key`, `X-Admin-Token` (`require_admin_token`) и публичной `/u/{token}` (raw-режим).

Рекомендация: доверять `X-Forwarded-For`/`X-Real-IP` только если запрос пришёл от известного reverse-proxy (по списку IP) и брать самый правый адрес из цепочки, либо использовать `request.client.host` напрямую за доверенным прокси с собственной настройкой forwarded-заголовков (uvicorn `--proxy-headers` + `--forwarded-allow-ips`).

### 3. Реальный секрет 3x-ui захардкожен в отслеживаемом коде (`backend/app/config.py:18`)

```python
xui_base_url: str = "https://monitor.vpn.arvexo.ru:32145/Lb9BYg8zvNRCZMPeon"
```

Значение совпадает с `XUI_BASE_URL` из `backend/.env.dev`, то есть это не плейсхолдер, а похоже на настоящий путь продакшен-панели 3x-ui. Файл `config.py` версионируется — секрет навсегда останется в истории git, даже если значение в будущем поменять.

Рекомендация: убрать дефолт из кода (оставить пустую строку/обязательное поле), ротировать путь панели, переписать историю git при необходимости (`git filter-repo`/BFG), хотя бы для публичных клонов.

### 4. Токены в `localStorage`, нет CSP/security headers (frontend)

`AdminApp.tsx` хранит `X-Admin-Token` в `localStorage` (строки 71, 94, 100), `CabinetApp.tsx` хранит пользовательский JWT там же (`JWT_STORAGE_KEY`). В проекте нет `next.config.js`/middleware с заголовками безопасности — Content-Security-Policy не настроен вообще. Любая XSS на фронтенде (включая через сторонние скрипты) мгновенно даёт доступ к админ-токену или токену пользователя, так как `localStorage` читается любым JS на странице.

Рекомендация: минимум — добавить CSP (даже базовый `default-src 'self'`), рассмотреть перенос токенов в httpOnly-cookie с `SameSite`, либо короткоживущие токены + refresh.

## Medium

### 5. Отсутствует импорт `SubscriptionStatus` в `backend/app/routers/admin.py`

В файле импортируется `from app.enums import OrderStatus, RoutingMode`, но `retry_provisioning` (строки 288, 308) использует `SubscriptionStatus.PROVISIONING_FAILED.value` и `SubscriptionStatus.DISABLED.value`. Эндпоинт `POST /api/admin/subscriptions/{token}/retry-provisioning` упадёт с `NameError` → 500 при любом вызове на подписке в статусе `provisioning_failed`, то есть именно в том случае, для которого он создан. Баг не связан с текущим диффом, существовал до него.

Исправление: добавить `SubscriptionStatus` в импорт из `app.enums`.

### 6. `require_bot_token` не вызывает `enforce_rate_limit` (`backend/app/utils/security.py`)

В отличие от `require_admin_token`, проверка `X-Bot-Token` не лимитируется по частоте — несущественно при компрометации самого токена бота (даёт полный доступ к `/api/telegram/*`, включая подтверждение любых заказов), но непоследовательно по сравнению с остальными точками входа.

### 7. TLS-проверка отключена по умолчанию для 3x-ui (`backend/app/config.py:15,22`)

`upstream_ssl_verify: bool = False`, `xui_ssl_verify: bool = False`. Если значения не переопределены в продакшен `.env`, все запросы к панели провижининга (создание VPN-клиентов, токены) идут без проверки сертификата — риск MITM на этом канале.

### 8. `.env.dev` не покрыт `.gitignore`

`.gitignore` содержит `.env`, `.env.local`, `backend/.env.prod`, `bot/.env.prod`, но не `*.env.dev`. Сейчас `backend/.env.dev` и `bot/.env.dev` untracked (по `git status`), но они попадут в коммит при `git add -A`/`git add .`. По факту в текущих dev-файлах не нашёл подтверждённых реальных секретов (значения вида `change_me_*`, кроме `XUI_BASE_URL`, который совпадает с дефолтом из п.3) — но сам пробел в `.gitignore` нужно закрыть, прежде чем кто-то по привычке закоммитит реальный dev-конфиг.

### 9. Дефолтный пароль Postgres продублирован в коде и в обоих compose-файлах

`postgresql+asyncpg://arvexo:arvexo_password@postgres:5432/arvexo_connect` — дефолт в `config.py`, и тот же `POSTGRES_PASSWORD: arvexo_password` в `docker-compose.yml` и `docker-compose.prod.yml`. Порт Postgres проброшен только на `127.0.0.1:6432`, поэтому внешний риск ограничен, но если прод не переопределяет пароль через `.env`, это слабый дефолтный credential на проде.

### 10. Проверка обязательных секретов срабатывает только при `app_env == "production"` (точное совпадение)

`model_post_init` в `config.py` (строка 49) требует непустые `JWT_SECRET`/`ADMIN_TOKEN`/`BOT_INTERNAL_TOKEN` только если `app_env` буквально `"production"`. Любое другое значение (`"staging"`, опечатка, не заданная переменная) — и проверка молча не сработает, приложение поднимется с дефолтными секретами.

### 11. QR-код подписки генерируется через сторонний сервис

`public_subscription.py`: `qr_src` строится через `api.qrserver.com`, которому передаётся URL с секретным токеном подписки. Сторонний сервис получает действующий subscription-токен пользователя.

## Low / гигиена

- In-memory rate-limiter (`_WINDOWS` в `rate_limit.py`) никогда не чистит старые записи (медленная утечка памяти) и не шарится между процессами/репликами — даже без проблемы с `X-Forwarded-For` лимит ненадёжен при горизонтальном масштабировании.
- `access_key_service.authenticate_access_key` перебирает все активные access-key и считает PBKDF2 для каждого (`O(n)` дорогих хешей на одну попытку логина) — при росте базы пользователей это деградирует и создаёт DoS-вектор на эндпоинт логина по access-key.
- `promo_service.redeem_promo_code`: проверка `redemptions_count >= max_redemptions` и проверка повторного редима читаются до инкремента без блокировки строки — теоретическая гонка при параллельных редимах одного кода, низкий риск (промокоды создаёт админ).
- CRLF/LF-шум в диффах (`Dockerfile`, `database.py`, `main.py`) — не проблема безопасности, но стоит добавить `.gitattributes` (`* text=auto eol=lf`), чтобы не засорять будущие диффы.

## Что сделано хорошо

- Кастомный HMAC-JWT (`utils/security.py`) пересчитывает подпись сам, не доверяя заголовку `alg` — алгоритм-confusion исключён.
- Пароли и access-key хешируются PBKDF2-HMAC-SHA256 с адекватным числом итераций (180k/120k) и сравниваются через `hmac.compare_digest`.
- IDOR последовательно закрыт в `cabinet.py` (`require_subscription_owner`, `require_user_order`) на всех эндпоинтах подписок/устройств/заказов.
- XSS в публичной HTML-странице подписки (`public_subscription.py`) закрыт через `html.escape()` везде, где в шаблон попадают данные из БД.
- Telegram link-token (`telegram_link_service.py`): хешируется, ищется по префиксу, проверяется constant-time, одноразовый, с TTL 30 минут и аудит-логом.
- CORS настроен через явный allow-list источников, а не wildcard.
- `confirm_order_in_session` идемпотентен для одного заказа (защита от повторной обработки).

## Приоритет действий

1. Закрыть Critical №1 (логика сопоставления TRC20-платежей) до того, как монитор уйдёт в прод — иначе это прямая потеря денег/подписок.
2. Поправить `X-Forwarded-For` (№2) и убрать реальный секрет из `config.py` (№3).
3. Перенести токены из `localStorage` и добавить CSP (№4), добавить недостающий импорт в `admin.py` (№5).
4. Остальное (Medium/Low) — по мере возможности, не блокирует релиз.
