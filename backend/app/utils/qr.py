import base64
from io import BytesIO

import qrcode


def qr_data_uri(data: str) -> str:
    """Сгенерировать QR-код локально и вернуть его как data: URI.

    Раньше QR-коды (subscription-токен, платёжные реквизиты) отправлялись на
    api.qrserver.com — сторонний сервис получал секретные данные пользователя
    (Medium, см. SECURITY_REVIEW.md, п.11). Теперь рисуем QR на сервере и отдаём
    готовую картинку, ничего никуда не уходит.
    """
    image = qrcode.make(data)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"
