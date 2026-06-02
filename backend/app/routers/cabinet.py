from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.schemas.billing import (
    CreateOrderRequest,
    CreateOrderResponse,
    CustomPlanConfig,
    CustomPlanQuoteResponse,
    OrdersResponse,
    PlansResponse,
    PlanOut,
    SubmitPaymentRequest,
)
from app.schemas.cabinet import ChangeModeRequest, ChangeModeResponse
from app.schemas.common import SubscriptionOut, subscription_to_out
from app.services.billing_service import (
    create_order_for_user,
    list_active_plans,
    list_user_orders,
    load_order_for_output,
    order_to_out,
    quote_custom_plan,
    require_user_order,
    submit_order_payment,
)
from app.services.subscription_service import (
    require_subscription_by_token,
    set_subscription_mode,
)
from app.utils.security import require_cabinet_user_id

router = APIRouter(prefix="/api/cabinet", tags=["cabinet"])


@router.get("/plans", response_model=PlansResponse)
async def get_plans(session: AsyncSession = Depends(get_db_session)):
    plans = await list_active_plans(session)
    return PlansResponse(plans=[PlanOut.model_validate(plan) for plan in plans])


@router.post("/custom-plan/quote", response_model=CustomPlanQuoteResponse)
async def quote_custom_plan_endpoint(payload: CustomPlanConfig):
    return CustomPlanQuoteResponse(ok=True, price=quote_custom_plan(payload), currency="USDT", features=payload)


@router.get("/orders", response_model=OrdersResponse)
async def get_orders(
    user_id: UUID = Depends(require_cabinet_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    orders = await list_user_orders(session, user_id)
    return OrdersResponse(orders=[order_to_out(order) for order in orders])


@router.post("/orders", response_model=CreateOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: CreateOrderRequest,
    user_id: UUID = Depends(require_cabinet_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    order = await create_order_for_user(session, user_id, payload.plan_code, payload.custom_config)
    await session.commit()
    order = await load_order_for_output(session, order.id)
    return CreateOrderResponse(ok=True, order=order_to_out(order))


@router.post("/orders/{order_id}/payment", response_model=CreateOrderResponse)
async def submit_order_payment_endpoint(
    order_id: UUID,
    payload: SubmitPaymentRequest,
    user_id: UUID = Depends(require_cabinet_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    order = await require_user_order(session, user_id, order_id)
    await submit_order_payment(session, order, payload.tx_hash)
    await session.commit()
    order = await load_order_for_output(session, order.id)
    return CreateOrderResponse(ok=True, order=order_to_out(order))


@router.get("/subscription/{token}", response_model=SubscriptionOut)
async def get_subscription_status(
    token: str,
    user_id: UUID = Depends(require_cabinet_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    subscription = await require_subscription_by_token(session, token)
    require_subscription_owner(subscription.user_id, user_id)
    return subscription_to_out(subscription)


@router.post("/subscription/{token}/mode", response_model=ChangeModeResponse)
async def change_subscription_mode(
    token: str,
    payload: ChangeModeRequest,
    user_id: UUID = Depends(require_cabinet_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    subscription = await require_subscription_by_token(session, token)
    require_subscription_owner(subscription.user_id, user_id)
    await set_subscription_mode(session, subscription, payload.mode, actor="cabinet")
    await session.commit()
    return ChangeModeResponse(
        ok=True,
        token=subscription.public_token,
        routing_mode=subscription.routing_mode,
        message="Mode updated. Refresh subscription in your VPN app.",
    )


def require_subscription_owner(subscription_user_id: UUID, user_id: UUID) -> None:
    if subscription_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Subscription does not belong to user")
