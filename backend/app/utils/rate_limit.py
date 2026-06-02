from time import monotonic

from fastapi import HTTPException, Request, status


_WINDOWS: dict[tuple[str, str], list[float]] = {}


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


async def enforce_rate_limit(request: Request, scope: str, limit: int, window_seconds: int = 60) -> None:
    now = monotonic()
    key = (scope, client_ip(request))
    hits = [timestamp for timestamp in _WINDOWS.get(key, []) if now - timestamp < window_seconds]
    if len(hits) >= limit:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many requests")
    hits.append(now)
    _WINDOWS[key] = hits
