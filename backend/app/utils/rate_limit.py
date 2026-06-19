import secrets
from time import monotonic

from fastapi import HTTPException, Request, status


_WINDOWS: dict[tuple[str, str], list[float]] = {}
# Раз в ~1000 обращений целиком чистим словарь от ключей без свежих хитов — без этого
# IP, постучавшийся один раз, навечно остаётся в памяти (Low, см. SECURITY_REVIEW.md).
_CLEANUP_EVERY = 1000


def client_ip(request: Request) -> str:
    # Прод стоит за одним reverse-proxy (nginx/traefik), который ДОПИСЫВАЕТ реальный IP
    # клиента в конец цепочки X-Forwarded-For, а не заменяет её — поэтому доверяем только
    # последнему хопу, а не первому (который может подделать сам клиент).
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        parts = [part.strip() for part in forwarded.split(",") if part.strip()]
        if parts:
            return parts[-1]
    if request.client:
        return request.client.host
    return "unknown"


def _cleanup_stale_windows(now: float, window_seconds: int) -> None:
    stale_keys = [key for key, hits in _WINDOWS.items() if not any(now - ts < window_seconds for ts in hits)]
    for key in stale_keys:
        _WINDOWS.pop(key, None)


async def enforce_rate_limit(request: Request, scope: str, limit: int, window_seconds: int = 60) -> None:
    now = monotonic()
    if secrets.randbelow(_CLEANUP_EVERY) == 0:
        _cleanup_stale_windows(now, window_seconds)
    key = (scope, client_ip(request))
    hits = [timestamp for timestamp in _WINDOWS.get(key, []) if now - timestamp < window_seconds]
    if len(hits) >= limit:
        _WINDOWS[key] = hits
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many requests")
    hits.append(now)
    _WINDOWS[key] = hits
