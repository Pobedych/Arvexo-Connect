import asyncio
from io import BytesIO

import qrcode
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandObject, CommandStart
from aiogram.types import BufferedInputFile, CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message

from app.backend import BackendClient
from app.config import settings

backend = BackendClient()


def main_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Мой доступ", callback_data="access")],
            [InlineKeyboardButton(text="Получить подписку", callback_data="trial")],
            [InlineKeyboardButton(text="Показать QR", callback_data="qr")],
            [InlineKeyboardButton(text="Сменить режим", callback_data="modes")],
            [
                InlineKeyboardButton(text="Инструкция iPhone", callback_data="instruction_iphone"),
                InlineKeyboardButton(text="Инструкция Android", callback_data="instruction_android"),
            ],
            [InlineKeyboardButton(text="Поддержка", url=settings.support_url)],
        ]
    )


def mode_keyboard(token: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Smart Russia", callback_data=f"mode:{token}:smart")],
            [InlineKeyboardButton(text="Privacy", callback_data=f"mode:{token}:privacy")],
            [InlineKeyboardButton(text="Global", callback_data=f"mode:{token}:global")],
        ]
    )


async def first_subscription(telegram_id: int) -> dict | None:
    subscriptions = await backend.subscriptions(telegram_id)
    return subscriptions[0] if subscriptions else None


def subscription_text(subscription: dict) -> str:
    days = subscription.get("days_left")
    days_text = "без срока" if days is None else f"{days} дней"
    return (
        "Ваш доступ активен.\n\n"
        f"Режим: {subscription['routing_mode']}\n"
        f"Осталось: {days_text}\n"
        f"Устройств: до {subscription.get('device_limit', 3)}\n\n"
        "Ссылка подписки:\n"
        f"{subscription['public_subscription_url']}"
    )


async def send_access(message: Message) -> None:
    subscription = await first_subscription(message.from_user.id)
    if not subscription:
        await message.answer(
            "У вас пока нет активной подписки.\n\nЧтобы получить доступ, выберите тестовый доступ или напишите в поддержку.",
            reply_markup=main_menu(),
        )
        return
    await message.answer(subscription_text(subscription), reply_markup=main_menu())


async def send_qr(message: Message) -> None:
    subscription = await first_subscription(message.from_user.id)
    if not subscription:
        await message.answer("Сначала получите подписку.", reply_markup=main_menu())
        return
    image = qrcode.make(subscription["public_subscription_url"])
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    await message.answer_photo(
        BufferedInputFile(buffer.getvalue(), filename="arvexo-subscription.png"),
        caption="QR-код subscription-ссылки.",
        reply_markup=main_menu(),
    )


async def main() -> None:
    bot = Bot(token=settings.telegram_bot_token)
    dp = Dispatcher()

    @dp.message(CommandStart())
    async def start(message: Message, command: CommandObject) -> None:
        if command.args and command.args.startswith("link_"):
            try:
                await backend.consume_link_token(
                    token=command.args,
                    telegram_id=message.from_user.id,
                    username=message.from_user.username,
                    first_name=message.from_user.first_name,
                    language_code=message.from_user.language_code,
                )
                await message.answer("Telegram подключён к вашему Arvexo Account.", reply_markup=main_menu())
                return
            except Exception:
                await message.answer("Ссылка подключения недействительна или истекла.", reply_markup=main_menu())
                return
        await backend.upsert_user(
            telegram_id=message.from_user.id,
            username=message.from_user.username,
            first_name=message.from_user.first_name,
            language_code=message.from_user.language_code,
        )
        await message.answer("Arvexo Connect\n\nВыберите действие:", reply_markup=main_menu())

    @dp.callback_query(F.data == "access")
    async def access(callback: CallbackQuery) -> None:
        await callback.answer()
        await send_access(callback.message)

    @dp.callback_query(F.data == "trial")
    async def trial(callback: CallbackQuery) -> None:
        await callback.answer()
        try:
            subscription = await backend.provision_trial(
                telegram_id=callback.from_user.id,
                username=callback.from_user.username,
                first_name=callback.from_user.first_name,
            )
            await callback.message.answer(
                "Тестовый доступ активирован на 24 часа.\n\n" + subscription_text(subscription),
                reply_markup=main_menu(),
            )
        except Exception:
            await callback.message.answer("Тестовый доступ уже использован или временно недоступен.", reply_markup=main_menu())

    @dp.callback_query(F.data == "qr")
    async def qr(callback: CallbackQuery) -> None:
        await callback.answer()
        await send_qr(callback.message)

    @dp.callback_query(F.data == "modes")
    async def modes(callback: CallbackQuery) -> None:
        await callback.answer()
        subscription = await first_subscription(callback.from_user.id)
        if not subscription:
            await callback.message.answer("Сначала получите подписку.", reply_markup=main_menu())
            return
        await callback.message.answer("Выберите режим:", reply_markup=mode_keyboard(subscription["token"]))

    @dp.callback_query(F.data.startswith("mode:"))
    async def change_mode(callback: CallbackQuery) -> None:
        await callback.answer()
        _, token, mode = callback.data.split(":")
        await backend.change_mode(callback.from_user.id, token, mode)
        await callback.message.answer(
            f"Режим изменён на {mode}.\n\nЧтобы применить изменения, обновите подписку в VPN-приложении.",
            reply_markup=main_menu(),
        )

    @dp.callback_query(F.data.startswith("instruction_"))
    async def instruction(callback: CallbackQuery) -> None:
        await callback.answer()
        if callback.data.endswith("iphone"):
            text = "iPhone:\n1. Установите Happ / V2RayTun / Streisand.\n2. Скопируйте subscription-ссылку.\n3. Добавьте подписку.\n4. Нажмите обновить.\n5. Подключитесь."
        else:
            text = "Android:\n1. Установите Hiddify / v2rayNG / NekoBox.\n2. Импортируйте subscription-ссылку.\n3. Обновите подписку.\n4. Выберите профиль.\n5. Подключитесь."
        await callback.message.answer(text, reply_markup=main_menu())

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
