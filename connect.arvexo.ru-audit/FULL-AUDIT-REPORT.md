# SEO-аудит: connect.arvexo.ru

**Дата:** 17 июня 2026
**Тип бизнеса:** SaaS / VPN-сервис (подписочная модель, личный кабинет, оплата криптовалютой и СБП, продажи также через Telegram-бота)
**Итоговый SEO Health Score: 30 / 100**

## Методология и ограничения этой сессии

Аудит выполнен в условиях ограниченного доступа к окружению: расширение Claude in Chrome было недоступно (не подключено) на протяжении всей сессии, поэтому живой рендеринг страниц, скриншоты desktop/mobile и замер Core Web Vitals (Lighthouse) не выполнялись. Вместо этого находки получены двумя независимыми способами:

1. **Прямые HTTP-запросы** к `connect.arvexo.ru` (главная, `/cabinet`, `/cabinet/login`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/privacy`, `/terms`, `/faq`), включая контрольный запрос заведомо несуществующего URL — это позволило надёжно отличить «страницы нет» от «страница не отдалась».
2. **Прямой анализ исходного кода фронтенда** в подключённой папке проекта (Next.js App Router: `frontend/app/**/page.tsx`, `frontend/app/layout.tsx`, `frontend/components/ArvexoConnectLanding.tsx`, `frontend/next.config.mjs`, `frontend/public/`).

Второй способ — большая удача для точности аудита: вместо предположений по внешним признакам, по каждому пункту (robots.txt, sitemap.xml, meta description, canonical, JSON-LD, alt-тексты, security-заголовки) есть прямое подтверждение на уровне кода.

**Категория Performance (Core Web Vitals) не оценена** и исключена из расчёта Health Score (вес остальных 6 категорий — 90 из 100 — перенормирован до 100), а не угадана. Подробности — `findings/performance.md`.

## Топ-5 критичных проблем

1. **Отсутствует robots.txt** — приватные разделы (`/cabinet/*`, `/admin`, `/cabinet/checkout`) ничем не защищены от обхода ботами.
2. **Отсутствует sitemap.xml** — ни статического файла, ни `app/sitemap.ts` нет.
3. **11 из 12 страниц не имеют meta description** — подтверждено построчно по коду.
4. **JSON-LD полностью отсутствует** — нет Organization, Product/Offer, FAQPage, HowTo.
5. **Страницы «Политика конфиденциальности» и «Условия использования» не существуют**, хотя на них ссылается футер — риск для доверия (E-E-A-T) и юридического соответствия.

## Топ-5 быстрых побед

1. Добавить meta description на все 12 страниц.
2. Создать `frontend/app/robots.ts`.
3. Создать `frontend/app/sitemap.ts`.
4. Добавить JSON-LD Organization+WebSite и FAQPage (контент FAQ уже готов).
5. Связать страницы `/instructions/*` ссылками с главной (сейчас футер ведёт на placeholder `#top`).

---

## 1. Technical SEO — 30/100

**Работает:** security-заголовки (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) корректно настроены в `next.config.mjs`; чистые URL; HTTPS; `lang="ru"` и `metadataBase` заданы верно.

**Критично:** robots.txt и sitemap.xml отсутствуют полностью (подтверждено и live-запросом, и кодом). Приватные страницы кабинета/админки не закрыты от индексации ни через robots.txt, ни через meta `noindex`.

Подробности — `findings/technical.md`.

## 2. Content Quality — 40/100

**Работает:** главная страница содержательна (hero, режимы Smart Russia/Privacy/Global, инфраструктура, тарифы, кейсы, FAQ из 5 вопросов); три страницы инструкций (iPhone/Android/Windows) дают уникальный прикладной контент.

**Критично:** страницы `/privacy` и `/terms`, упомянутые в футере, не существуют — ни на сайте, ни в роутах фронтенда. Ссылки в футере ведут на placeholder `#top`.

Подробности — `findings/content.md`.

## 3. On-Page SEO — 35/100

**Работает:** на главной верно заданы title/description/canonical; ровно один `<h1>` и три `<h2>` — чистая структура заголовков.

**Высокий приоритет:** 11 страниц без meta description (только title); canonical задан только на главной; страницы инструкций не связаны внутренними ссылками с остальным сайтом.

Подробности — `findings/onpage.md`.

## 4. Schema / Structured Data — 5/100

JSON-LD отсутствует полностью — ни одного `<script type="application/ld+json">` во всём фронтенде. Нет Organization, WebSite, Product/Offer для тарифов, FAQPage, HowTo.

Подробности — `findings/schema.md`.

## 5. Performance (Core Web Vitals) — не оценено

См. `findings/performance.md` — требует Chrome MCP или PageSpeed Insights, недоступных в этой сессии.

## 6. AI Search Readiness (GEO) — 25/100

**Работает:** текст страниц извлекается чисто, без проблем для AI-кроулеров; структура секций облегчает цитирование.

**Высокий приоритет:** нет Open Graph/Twitter Card тегов (критично, учитывая продажи через Telegram); нет llms.txt; нет FAQPage/HowTo разметки.

Подробности — `findings/ai-search.md`.

## 7. Images — 15/100

На сайте нет изображений вовсе (0 тегов `<img>`, `next/image` не используется) — поэтому проблем с alt-текстом нет, но нет и og-image, apple-touch-icon, manifest.json. При шаринге в Telegram/соцсетях превью будет пустым.

Подробности — `findings/images.md`.

---

## Сводная таблица оценок

| Категория | Вес | Оценка | Вклад |
|---|---|---|---|
| Technical SEO | 22% | 30/100 | — |
| Content Quality | 23% | 40/100 | — |
| On-Page SEO | 20% | 35/100 | — |
| Schema / Structured Data | 10% | 5/100 | — |
| Performance (CWV) | 10% | не оценено | исключено из расчёта |
| AI Search Readiness | 10% | 25/100 | — |
| Images | 5% | 15/100 | — |

Итоговый балл рассчитан как средневзвешенное по 6 оценённым категориям (суммарный вес 90, перенормирован до 100) → **30/100**.

Дальше — `ACTION-PLAN.md` с разбивкой по фазам.
