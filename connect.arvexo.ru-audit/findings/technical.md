# Technical SEO — connect.arvexo.ru

**Оценка: 30/100**

## Что работает
- Корректные security-заголовки в `frontend/next.config.mjs`: Content-Security-Policy, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy.
- Чистая структура URL без параметров и дублей.
- `metadataBase` и `lang="ru"` заданы корректно в `app/layout.tsx`.
- Сайт отдаётся по HTTPS (подтверждено живым запросом).

## Находки

### Critical — отсутствует robots.txt
Запрос `https://connect.arvexo.ru/robots.txt` возвращает пустой ответ. Проверка по исходному коду подтверждает: в `frontend/public/` нет файла `robots.txt`, в `frontend/app/` нет файла `robots.ts` (Next.js App Router metadata route). Приватные разделы (`/cabinet/*`, `/admin`, `/cabinet/checkout`) технически открыты для обхода любым ботом.
**Рекомендация:** создать `frontend/app/robots.ts`, разрешить `/` и `/instructions/*`, запретить `/cabinet/`, `/admin/`, `/cabinet/checkout`.

### Critical — отсутствует sitemap.xml
Аналогично robots.txt: пустой ответ на `/sitemap.xml`, ни статического файла, ни `app/sitemap.ts` в коде нет.
**Рекомендация:** создать `frontend/app/sitemap.ts` со списком публичных URL и `lastModified`.

### High — приватные страницы индексируемы по умолчанию
На `/cabinet`, `/cabinet/login`, `/admin` и других внутренних страницах нет meta `robots: noindex`, и нет блокировки через robots.txt (его просто нет). Поисковик может проиндексировать пустые app-шеллы личного кабинета/админки.
**Рекомендация:** добавить `metadata.robots = { index: false, follow: false }` на все страницы `/cabinet/*`, `/admin`, либо закрыть их в robots.txt.

### Low — отсутствует llms.txt
`/llms.txt` возвращает пустой ответ — нет явных инструкций для AI-кроулеров (актуально для GEO/AI Search Readiness).
**Рекомендация:** добавить `llms.txt` с описанием продукта и ссылками на ключевые страницы.

## Не оценено в этой сессии
Core Web Vitals / Lighthouse, HTTP→HTTPS редирект на уровне сервера, поведение JS-рендеринга в реальном браузере — требуют Chrome MCP или Playwright, которые были недоступны. См. `findings/performance.md`.
