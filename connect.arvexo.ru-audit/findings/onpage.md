# On-Page SEO — connect.arvexo.ru

**Оценка: 35/100**

## Что работает
- На главной (`app/page.tsx`) корректно заданы `title`, `description` и `canonical` (`https://connect.arvexo.ru/`).
- Чистая структура заголовков на главной: ровно один `<h1>`, три `<h2>` (проверено по `components/ArvexoConnectLanding.tsx`).
- Title на внутренних страницах брендированы и человекочитаемы («Инструкция iPhone | Arvexo Connect» и т.д.).

## Находки

### High — meta description отсутствует на 11 из 12 страниц
Проверено построчно по исходному коду: `app/admin/page.tsx`, `app/cabinet/page.tsx`, `app/cabinet/login/page.tsx`, `app/cabinet/checkout/page.tsx`, `app/cabinet/orders/page.tsx`, `app/cabinet/plans/page.tsx`, `app/cabinet/settings/page.tsx`, `app/cabinet/subscription/[token]/page.tsx`, `app/cabinet/support/page.tsx`, `app/instructions/iphone/page.tsx`, `app/instructions/android/page.tsx`, `app/instructions/windows/page.tsx` — везде `export const metadata` содержит только `title`. Только главная имеет `description`.
**Рекомендация:** добавить `description` во все 11 файлов; для `/instructions/*` — описать конкретное приложение/платформу, так как у этих страниц реальный поисковый потенциал.

### Medium — canonical задан только на главной
`alternates.canonical` есть только в `app/page.tsx`.
**Рекомендация:** добавить canonical минимум на `/instructions/*` (публичные индексируемые страницы).

### High — страницы /instructions/* не связаны внутренними ссылками
На живой главной странице ссылки в футере (Контакты, Статус серверов, Документация и т.д.) ведут на placeholder `#top`, а не на реальные разделы или `/instructions/*`. Эти страницы «осиротевшие»: контент есть, но нет входящих внутренних ссылок.
**Рекомендация:** добавить реальные ссылки на `/instructions/iphone`, `/instructions/android`, `/instructions/windows` из главной навигации/футера и из личного кабинета после оформления подписки.
