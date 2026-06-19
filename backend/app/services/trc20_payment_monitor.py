import asyncio
import logging
from decimal import Decimal

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import AsyncSessionLocal
from app.enums import OrderStatus, PaymentMethod
from app.models.order import Order
from app.services.order_confirmation_service import confirm_order_in_session

logger = logging.getLogger(__name__)

TRONGRID_API_BASE = "https://api.trongrid.io/v1"
USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
CHECK_INTERVAL_SECONDS = 30
# С 2026-06-17 каждый заказ получает уникальную "соль" в сумме (см. billing_service.
# _unique_salted_crypto_amount), поэтому ожидаемая и фактическая сумма должны совпадать
# почти точно — допуск нужен только на случай недетерминированного округления Decimal,
# а не для разруливания коллизий между заказами, как было раньше.
AMOUNT_TOLERANCE = Decimal("0.000001")


def _parse_trc20_value(raw_value: str, decimals: int = 6) -> Decimal:
    return Decimal(raw_value) / Decimal(10 ** decimals)


def _amount_matches(expected: Decimal, actual: Decimal) -> bool:
    return abs(expected - actual) <= AMOUNT_TOLERANCE


async def fetch_recent_trc20_transfers(
    address: str,
    min_timestamp_ms: int | None = None,
    api_key: str | None = None,
) -> list[dict]:
    url = f"{TRONGRID_API_BASE}/accounts/{address}/transactions/trc20"
    params: dict = {
        "limit": 50,
        "only_to": "true",
        "contract_address": USDT_CONTRACT,
    }
    if min_timestamp_ms is not None:
        params["min_timestamp"] = min_timestamp_ms

    headers = {"Accept": "application/json"}
    if api_key:
        headers["TRON-PRO-API-KEY"] = api_key

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, params=params, headers=headers)
        resp.raise_for_status()
        data = resp.json()
    return data.get("data", [])


async def find_matching_order(session: AsyncSession, tx: dict) -> Order | None:
    tx_hash = tx.get("transaction_id", "")
    raw_value = tx.get("value", "0")
    transfer_amount = _parse_trc20_value(raw_value)

    # FOR UPDATE: фоновый цикл (раз в 30с) и ручной POST /api/admin/check-trc20-payments
    # используют один и тот же check_payments_once и могут выполняться конкурентно —
    # блокировка строк-кандидатов исключает гонку, при которой два прохода одновременно
    # сопоставят разные транзакции одному и тому же заказу (или наоборот).
    result = await session.execute(
        select(Order)
        .options(selectinload(Order.plan), selectinload(Order.user))
        .where(
            Order.status.in_([OrderStatus.PENDING.value, OrderStatus.WAITING_CONFIRMATION.value]),
            Order.payment_method == PaymentMethod.CRYPTO_MANUAL.value,
            Order.crypto_network == "TRC20",
            Order.crypto_address == settings.crypto_payment_address,
            Order.crypto_amount.isnot(None),
        )
        .order_by(Order.created_at.desc())
        .with_for_update()
    )
    candidates = list(result.scalars().all())

    for order in candidates:
        if order.tx_hash == tx_hash:
            return None

    # Берём не первый попавшийся, а ближайший по сумме кандидат — соль делает суммы
    # практически уникальными, но если несмотря на это совпали два заказа, выбираем
    # точнее совпадающий, а не просто самый новый.
    best_match: Order | None = None
    best_diff: Decimal | None = None
    for order in candidates:
        if not order.crypto_amount or not _amount_matches(order.crypto_amount, transfer_amount):
            continue
        diff = abs(order.crypto_amount - transfer_amount)
        if best_diff is None or diff < best_diff:
            best_match = order
            best_diff = diff
    return best_match


async def process_single_transaction(session: AsyncSession, tx: dict) -> bool:
    order = await find_matching_order(session, tx)
    if order is None:
        return False

    logger.info(
        "Matched TRC20 tx %s to order %s (expected %s USDT, got %s USDT)",
        tx.get("transaction_id", "?")[:16],
        order.id,
        order.crypto_amount,
        _parse_trc20_value(tx.get("value", "0")),
    )

    order.tx_hash = tx.get("transaction_id", "")
    order.status = OrderStatus.WAITING_CONFIRMATION.value
    await session.flush()

    try:
        await confirm_order_in_session(session, order.id)
        logger.info("Auto-confirmed order %s from TRC20 monitor", order.id)
        return True
    except Exception:
        logger.exception("Failed to auto-confirm order %s", order.id)
        return False


async def check_payments_once() -> int:
    if not settings.crypto_payment_address:
        return 0

    confirmed_count = 0
    async with AsyncSessionLocal() as session:
        try:
            cutoff_ms = int((__import__("time").time()) * 1000) - (6 * 60 * 60 * 1000)
            txs = await fetch_recent_trc20_transfers(
                address=settings.crypto_payment_address,
                min_timestamp_ms=cutoff_ms,
                api_key=getattr(settings, "trongrid_api_key", None),
            )
            for tx in txs:
                result = await process_single_transaction(session, tx)
                if result:
                    confirmed_count += 1
            if confirmed_count > 0:
                await session.commit()
        except Exception:
            logger.exception("TRC20 payment check failed")
            await session.rollback()
    return confirmed_count


async def _monitor_loop() -> None:
    logger.info("TRC20 payment monitor started (interval=%ds)", CHECK_INTERVAL_SECONDS)
    while True:
        try:
            count = await check_payments_once()
            if count > 0:
                logger.info("TRC20 monitor: auto-confirmed %d order(s)", count)
        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("TRC20 monitor iteration failed")
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)


_monitor_task: asyncio.Task | None = None


def start_monitor() -> None:
    global _monitor_task
    if not settings.crypto_payment_address:
        logger.info("TRC20 monitor disabled (no crypto_payment_address)")
        return
    if _monitor_task is not None:
        return
    _monitor_task = asyncio.get_event_loop().create_task(_monitor_loop())
    logger.info("TRC20 payment monitor task created")


def stop_monitor() -> None:
    global _monitor_task
    if _monitor_task is not None:
        _monitor_task.cancel()
        _monitor_task = None
        logger.info("TRC20 payment monitor stopped")
