import argparse
import asyncio
from datetime import datetime

from app.config import settings
from app.database import AsyncSessionLocal
from app.enums import RoutingMode
from app.schemas.common import subscription_to_out
from app.services.subscription_service import create_subscription
from app.services.user_service import create_user, upsert_telegram_user


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a test user with one VPN subscription.")
    parser.add_argument("--display-name", default="Test User")
    parser.add_argument("--telegram-id", type=int)
    parser.add_argument("--original-sub-url", required=True)
    parser.add_argument("--mode", choices=[item.value for item in RoutingMode], default=RoutingMode.SMART.value)
    parser.add_argument("--expires-at")
    parser.add_argument("--device-limit", type=int, default=3)
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    expires_at = datetime.fromisoformat(args.expires_at.replace("Z", "+00:00")) if args.expires_at else None

    async with AsyncSessionLocal() as session:
        if args.telegram_id:
            user, _ = await upsert_telegram_user(session, args.telegram_id)
            user.display_name = args.display_name
        else:
            user = await create_user(session, args.display_name)

        subscription = await create_subscription(
            session,
            user_id=user.id,
            original_sub_url=args.original_sub_url,
            routing_mode=RoutingMode(args.mode),
            expires_at=expires_at,
            device_limit=args.device_limit,
        )
        await session.commit()
        await session.refresh(subscription)

        output = subscription_to_out(subscription)
        print("User created")
        print(f"User ID: {user.id}")
        print(f"Subscription token: {output.token}")
        print(f"Public URL: {settings.public_base_url.rstrip('/')}/u/{output.token}")


if __name__ == "__main__":
    asyncio.run(main())
