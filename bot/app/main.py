import asyncio
from io import BytesIO

import qrcode
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandObject, CommandStart
from aiogram.types import BufferedInputFile, CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message

from app.backend import BackendClient
from app.config import settings

backend = BackendClient()
pending_device_add: dict[int, str] = {}
notified_payment_orders: set[str] = set()


def main_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="Мой доступ", callback_data="access"),
                InlineKeyboardButton(text="Все подписки", callback_data="subscriptions"),
            ],
            [
                InlineKeyboardButton(text="Показать QR", callback_data="qr"),
                InlineKeyboardButton(text="Raw link", callback_data="raw_link"),
            ],
            [
                InlineKeyboardButton(text="Сменить режим", callback_data="modes"),
                InlineKeyboardButton(text="Устройства", callback_data="devices"),
            ],
            [
                InlineKeyboardButton(text="Инструкция iPhone", callback_data="instruction_iphone"),
                InlineKeyboardButton(text="Инструкция Android", callback_data="instruction_android"),
            ],
            [
                InlineKeyboardButton(text="Инструкция Windows", callback_data="instruction_windows"),
                InlineKeyboardButton(text="Не работает", callback_data="repair"),
            ],
            [InlineKeyboardButton(text="Обновить", callback_data="refresh")],
            [InlineKeyboardButton(text="Получить тестовую подписку", callback_data="trial")],
            [InlineKeyboardButton(text="Поддержка", url=settings.support_url)],
        ]
    )


def mode_keyboard(token: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Smart Russia", callback_data=f"mode:{token}:smart")],
            [InlineKeyboardButton(text="Privacy", callback_data=f"mode:{token}:privacy")],
            [InlineKeyboardButton(text="Global", callback_data=f"mode:{token}:global")],
            [InlineKeyboardButton(text="Назад", callback_data="menu")],
        ]
    )


def repair_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Telegram не работает", callback_data="repair_case:telegram")],
            [InlineKeyboardButton(text="Всё не открывается", callback_data="repair_case:offline")],
            [InlineKeyboardButton(text="Медленно", callback_data="repair_case:slow")],
            [InlineKeyboardButton(text="iPhone: Соединение...", callback_data="repair_case:iphone")],
            [InlineKeyboardButton(text="Ozon/банк не открывается", callback_data="repair_case:local")],
            [InlineKeyboardButton(text="Подписка не импортируется", callback_data="repair_case:import")],
            [InlineKeyboardButton(text="Назад", callback_data="menu")],
        ]
    )


def device_keyboard(token: str, devices: list[dict]) -> InlineKeyboardMarkup:
    rows = [[InlineKeyboardButton(text="Добавить устройство", callback_data=f"device_add:{token}")]]
    rows.extend(
        [InlineKeyboardButton(text=f"Удалить {device.get('name') or 'устройство'}", callback_data=f"device_del:{token}:{device['id']}")]
        for device in devices[:8]
    )
    rows.append([InlineKeyboardButton(text="Назад", callback_data="menu")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def admin_payment_keyboard(order_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Подтвердить оплату", callback_data=f"admin_confirm_order:{order_id}")],
        ]
    )


async def first_subscription(telegram_id: int) -> dict | None:
    subscriptions = await backend.subscriptions(telegram_id)
    active = active_subscriptions(subscriptions)
    return active[0] if active else (subscriptions[0] if subscriptions else None)


def active_subscriptions(subscriptions: list[dict]) -> list[dict]:
    return [item for item in subscriptions if item.get("status") in ("active", "trial")]


def subscription_list_keyboard(subscriptions: list[dict]) -> InlineKeyboardMarkup:
    rows = []
    for index, item in enumerate(subscriptions[:10], 1):
        plan = item.get("plan_name") or "Arvexo Connect"
        days = item.get("days_left")
        days_text = "без срока" if days is None else f"{days} дн."
        rows.append(
            [
                InlineKeyboardButton(
                    text=f"{index}. {plan} · {item.get('status')} · {item.get('routing_mode')} · {days_text}",
                    callback_data=f"sub_select:{item['token']}",
                )
            ]
        )
    rows.append([InlineKeyboardButton(text="Назад", callback_data="menu")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def raw_url(subscription: dict) -> str:
    return f"{subscription['public_subscription_url']}?format=raw"


def subscription_text(subscription: dict) -> str:
    days = subscription.get("days_left")
    days_text = "без срока" if days is None else f"{days} дней"
    return (
        "Ваш доступ активен.\n\n"
        f"Режим: {subscription['routing_mode']}\n"
        f"Осталось: {days_text}\n"
        f"Устройств: до {subscription.get('device_limit', 3)}\n\n"
        "Ссылка подписки:\n"
        f"{subscription['public_subscription_url']}\n\n"
        "Raw import:\n"
        f"{raw_url(subscription)}"
    )


def format_order_amount(order: dict) -> str:
    return f"{order.get('payment_amount') or order.get('amount')} {order.get('payment_currency') or order.get('currency')}"


def admin_payment_text(order: dict) -> str:
    return (
        "Новая оплата на проверке\n\n"
        f"Тариф: {order.get('plan_name') or order.get('plan_code') or 'Order'}\n"
        f"К оплате: {format_order_amount(order)}\n"
        f"Цена: {order.get('amount')} {order.get('currency')}\n"
        f"Метод: {order.get('payment_method')}\n"
        f"Tx/comment: {order.get('payment_reference') or order.get('tx_hash') or '-'}\n"
        f"Сообщение в переводе должно быть: {order.get('payment_purpose') or '-'}\n"
        f"Order ID: {order.get('id')}"
    )


def is_admin(telegram_id: int) -> bool:
    return telegram_id in settings.admin_telegram_id_list


async def notify_admins_about_payments(bot: Bot) -> None:
    if not settings.admin_telegram_id_list:
        return
    while True:
        try:
            orders = await backend.waiting_payment_orders()
            for order in orders:
                order_id = str(order.get("id"))
                if not order_id or order_id in notified_payment_orders:
                    continue
                for admin_id in settings.admin_telegram_id_list:
                    await bot.send_message(admin_id, admin_payment_text(order), reply_markup=admin_payment_keyboard(order_id))
                notified_payment_orders.add(order_id)
        except Exception:
            pass
        await asyncio.sleep(max(settings.payment_notify_interval_seconds, 5))


def repair_text(case: str) -> str:
    steps = {
        "telegram": ["Проверьте, выключен ли proxy внутри Telegram.", "Обновите подписку.", "Попробуйте режим Privacy.", "Если не помогло — напишите в поддержку."],
        "offline": ["Проверьте интернет без VPN.", "Обновите подписку.", "Выберите другой профиль.", "Проверьте срок подписки."],
        "slow": ["Смените профиль.", "Попробуйте Smart Russia.", "Проверьте фоновые загрузки.", "Напишите в поддержку, если скорость не восстановилась."],
        "iphone": ["Используйте Happ или V2RayTun.", "Выберите Reality-профиль.", "Не используйте Hysteria как основной профиль.", "Обновите подписку."],
        "local": ["Включите Smart Russia.", "Обновите подписку.", "Перезапустите VPN-клиент.", "Если не помогло — напишите в поддержку."],
        "import": ["Откройте raw subscription link.", "Скопируйте ссылку полностью.", "Добавьте подписку заново.", "Проверьте поддержку subscription import."],
    }.get(case, ["Обновите подписку.", "Смените режим.", "Проверьте инструкцию.", "Напишите в поддержку."])
    return "Arvexo Repair\n\n" + "\n".join(f"{index + 1}. {step}" for index, step in enumerate(steps))


async def send_devices(message: Message, telegram_id: int) -> None:
    subscription = await first_subscription(telegram_id)
    if not subscription:
        await message.answer("Сначала получите подписку.", reply_markup=main_menu())
        return
    devices = await backend.devices(telegram_id, subscription["token"])
    text = f"Устройства: {len(devices)}/{subscription.get('device_limit', 3)}\n\n"
    text += "\n".join(f"- {device.get('name') or 'Устройство'} ({device.get('type') or 'other'})" for device in devices) or "Список пуст."
    await message.answer(text, reply_markup=device_keyboard(subscription["token"], devices))


async def send_access(message: Message, telegram_id: int) -> None:
    subscriptions = await backend.subscriptions(telegram_id)
    active = active_subscriptions(subscriptions)
    if len(subscriptions) > 1:
        await message.answer(
            "У вас несколько подписок. Выберите нужную:",
            reply_markup=subscription_list_keyboard(subscriptions),
        )
        return
    subscription = active[0] if active else (subscriptions[0] if subscriptions else None)
    if not subscription or subscription.get("status") not in ("active", "trial"):
        await message.answer(
            "У вас пока нет активной подписки.\n\nЧтобы получить доступ, выберите тестовый доступ или напишите в поддержку.",
            reply_markup=main_menu(),
        )
        return
    await message.answer(subscription_text(subscription), reply_markup=main_menu())


async def send_subscriptions(message: Message, telegram_id: int) -> None:
    subscriptions = await backend.subscriptions(telegram_id)
    if not subscriptions:
        await message.answer("Подписок пока нет.", reply_markup=main_menu())
        return
    text = "Ваши подписки:\n\n" + "\n\n".join(
        f"{index + 1}. {item.get('plan_name') or 'Arvexo Connect'}\n{item['token']}\nСтатус: {item['status']}\nРежим: {item['routing_mode']}\nУстройств: {item.get('devices_used', 0)}/{item.get('device_limit', 3)}"
        for index, item in enumerate(subscriptions)
    )
    await message.answer(text, reply_markup=subscription_list_keyboard(subscriptions))


async def send_qr(message: Message, telegram_id: int) -> None:
    subscriptions = active_subscriptions(await backend.subscriptions(telegram_id))
    subscription = subscriptions[0] if subscriptions else None
    if not subscription:
        await message.answer("Сначала получите подписку.", reply_markup=main_menu())
        return
    image = qrcode.make(raw_url(subscription))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    await message.answer_photo(
        BufferedInputFile(buffer.getvalue(), filename="arvexo-subscription.png"),
        caption="QR-код raw subscription-ссылки для импорта.",
        reply_markup=main_menu(),
    )


async def send_raw_link(message: Message, telegram_id: int) -> None:
    subscriptions = active_subscriptions(await backend.subscriptions(telegram_id))
    subscription = subscriptions[0] if subscriptions else None
    if not subscription:
        await message.answer("Сначала получите подписку.", reply_markup=main_menu())
        return
    await message.answer("Raw subscription link:\n" + raw_url(subscription), reply_markup=main_menu())


async def main() -> None:
    bot = Bot(token=settings.telegram_bot_token)
    dp = Dispatcher()
    asyncio.create_task(notify_admins_about_payments(bot))

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
                subscription = await first_subscription(message.from_user.id)
                if subscription:
                    await message.answer(
                        "Telegram подключён к вашему Arvexo Account.\n\n" + subscription_text(subscription),
                        reply_markup=main_menu(),
                    )
                else:
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

    @dp.message()
    async def free_text(message: Message) -> None:
        token = pending_device_add.pop(message.from_user.id, None)
        if not token:
            return
        try:
            await backend.add_device(message.from_user.id, token, message.text.strip()[:120], "other")
            await message.answer("Устройство добавлено.", reply_markup=main_menu())
        except Exception:
            await message.answer("Не удалось добавить устройство. Возможно, лимит исчерпан.", reply_markup=main_menu())

    @dp.callback_query(F.data == "access")
    async def access(callback: CallbackQuery) -> None:
        await callback.answer()
        try:
            await send_access(callback.message, callback.from_user.id)
        except Exception:
            await callback.message.answer("Не удалось загрузить доступ. Попробуйте ещё раз.", reply_markup=main_menu())

    @dp.callback_query(F.data == "subscriptions")
    async def subscriptions(callback: CallbackQuery) -> None:
        await callback.answer()
        try:
            await send_subscriptions(callback.message, callback.from_user.id)
        except Exception:
            await callback.message.answer("Не удалось загрузить подписки.", reply_markup=main_menu())

    @dp.callback_query(F.data.startswith("sub_select:"))
    async def subscription_select(callback: CallbackQuery) -> None:
        await callback.answer()
        token = callback.data.split(":", 1)[1]
        try:
            subscriptions = await backend.subscriptions(callback.from_user.id)
            subscription = next((item for item in subscriptions if item.get("token") == token), None)
            if not subscription:
                await callback.message.answer("Подписка не найдена.", reply_markup=main_menu())
                return
            await callback.message.answer(subscription_text(subscription), reply_markup=mode_keyboard(subscription["token"]))
        except Exception:
            await callback.message.answer("Не удалось открыть подписку.", reply_markup=main_menu())

    @dp.callback_query(F.data == "refresh")
    async def refresh(callback: CallbackQuery) -> None:
        await callback.answer("Обновлено")
        try:
            await send_access(callback.message, callback.from_user.id)
        except Exception:
            await callback.message.answer("Не удалось обновить данные.", reply_markup=main_menu())

    @dp.callback_query(F.data == "menu")
    async def menu(callback: CallbackQuery) -> None:
        await callback.answer()
        await callback.message.answer("Arvexo Connect\n\nВыберите действие:", reply_markup=main_menu())

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
        try:
            await send_qr(callback.message, callback.from_user.id)
        except Exception:
            await callback.message.answer("Не удалось сформировать QR.", reply_markup=main_menu())

    @dp.callback_query(F.data == "raw_link")
    async def raw_link(callback: CallbackQuery) -> None:
        await callback.answer()
        try:
            await send_raw_link(callback.message, callback.from_user.id)
        except Exception:
            await callback.message.answer("Не удалось получить raw link.", reply_markup=main_menu())

    @dp.callback_query(F.data == "modes")
    async def modes(callback: CallbackQuery) -> None:
        await callback.answer()
        subscriptions = active_subscriptions(await backend.subscriptions(callback.from_user.id))
        subscription = subscriptions[0] if subscriptions else None
        if not subscription:
            await callback.message.answer("Сначала получите подписку.", reply_markup=main_menu())
            return
        await callback.message.answer("Выберите режим:", reply_markup=mode_keyboard(subscription["token"]))

    @dp.callback_query(F.data == "devices")
    async def devices(callback: CallbackQuery) -> None:
        await callback.answer()
        try:
            await send_devices(callback.message, callback.from_user.id)
        except Exception:
            await callback.message.answer("Не удалось загрузить устройства.", reply_markup=main_menu())

    @dp.callback_query(F.data.startswith("device_add:"))
    async def device_add(callback: CallbackQuery) -> None:
        await callback.answer()
        _, token = callback.data.split(":", 1)
        pending_device_add[callback.from_user.id] = token
        await callback.message.answer("Отправьте название устройства одним сообщением.")

    @dp.callback_query(F.data.startswith("device_del:"))
    async def device_del(callback: CallbackQuery) -> None:
        await callback.answer()
        try:
            _, token, device_id = callback.data.split(":")
            await backend.delete_device(callback.from_user.id, token, device_id)
            await callback.message.answer("Устройство удалено.", reply_markup=main_menu())
        except Exception:
            await callback.message.answer("Не удалось удалить устройство.", reply_markup=main_menu())

    @dp.callback_query(F.data.startswith("mode:"))
    async def change_mode(callback: CallbackQuery) -> None:
        await callback.answer()
        try:
            _, token, mode = callback.data.split(":")
            await backend.change_mode(callback.from_user.id, token, mode)
            await callback.message.answer(
                f"Режим изменён на {mode}.\n\nЧтобы применить изменения, обновите подписку в VPN-приложении.",
                reply_markup=main_menu(),
            )
        except Exception:
            await callback.message.answer("Не удалось изменить режим. Проверьте активность подписки.", reply_markup=main_menu())

    @dp.callback_query(F.data.startswith("instruction_"))
    async def instruction(callback: CallbackQuery) -> None:
        await callback.answer()
        if callback.data.endswith("iphone"):
            text = "iPhone:\n1. Установите Happ / V2RayTun / Streisand.\n2. Скопируйте subscription-ссылку.\n3. Добавьте подписку.\n4. Нажмите обновить.\n5. Подключитесь."
        elif callback.data.endswith("android"):
            text = "Android:\n1. Установите Hiddify / v2rayNG / NekoBox.\n2. Импортируйте subscription-ссылку.\n3. Обновите подписку.\n4. Выберите профиль.\n5. Подключитесь."
        else:
            text = "Windows:\n1. Установите Hiddify или Nekoray.\n2. Скопируйте subscription-ссылку.\n3. Добавьте новую подписку.\n4. Обновите профили.\n5. Подключитесь."
        await callback.message.answer(text, reply_markup=main_menu())

    @dp.callback_query(F.data == "repair")
    async def repair(callback: CallbackQuery) -> None:
        await callback.answer()
        await callback.message.answer("Выберите проблему:", reply_markup=repair_keyboard())

    @dp.callback_query(F.data.startswith("repair_case:"))
    async def repair_case(callback: CallbackQuery) -> None:
        await callback.answer()
        _, case = callback.data.split(":", 1)
        await callback.message.answer(repair_text(case), reply_markup=main_menu())

    @dp.callback_query(F.data.startswith("admin_confirm_order:"))
    async def admin_confirm_order(callback: CallbackQuery) -> None:
        if not is_admin(callback.from_user.id):
            await callback.answer("Недостаточно прав", show_alert=True)
            return
        await callback.answer("Подтверждаю...")
        order_id = callback.data.split(":", 1)[1]
        try:
            result = await backend.confirm_order(order_id)
            subscription_url = result.get("subscription_url") or ""
            await callback.message.answer(
                "Оплата подтверждена.\n\n"
                f"Order ID: {order_id}\n"
                f"Подписка: {subscription_url or 'создана'}",
                reply_markup=main_menu(),
            )
        except Exception:
            await callback.message.answer("Не удалось подтвердить оплату. Проверьте админку/логи.", reply_markup=main_menu())

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
