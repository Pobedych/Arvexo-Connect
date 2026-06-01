import argparse
import asyncio
from uuid import UUID

from app.database import AsyncSessionLocal
from app.models.user import User
from app.services.access_key_service import create_access_key


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create an access key for an existing user.")
    parser.add_argument("--user-id", type=UUID, required=True)
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    async with AsyncSessionLocal() as session:
        user = await session.get(User, args.user_id)
        if user is None:
            raise SystemExit("User not found")

        access_key = await create_access_key(session, user.id)
        await session.commit()
        print(f"Access key: {access_key}")
        print("Save it now. It will not be shown again.")


if __name__ == "__main__":
    asyncio.run(main())
