# Action Plan — connect.arvexo.ru

Источник: `FULL-AUDIT-REPORT.md`, `audit-data.json`. Health Score: **30/100**.

## Phase 1 — Critical Fixes (Week 1)

- [ ] Создать `frontend/app/robots.ts`: разрешить `/` и `/instructions/*`; запретить `/cabinet/`, `/admin/`, `/cabinet/checkout`.
- [ ] Создать `frontend/app/sitemap.ts` со списком публичных URL и `lastModified`.
- [ ] Создать реальные страницы `/privacy` и `/terms`, заменить ссылки в футере с placeholder `#top` на рабочие.
- [ ] Добавить `metadata.robots = { index: false, follow: false }` на страницы `/cabinet/*`, `/admin`.

## Phase 2 — High-Impact Improvements (Weeks 2-3)

- [ ] Добавить meta description на все 11 страниц без него: `/admin`, `/cabinet`, `/cabinet/login`, `/cabinet/checkout`, `/cabinet/orders`, `/cabinet/plans`, `/cabinet/settings`, `/cabinet/subscription/[token]`, `/cabinet/support`, `/instructions/iphone`, `/instructions/android`, `/instructions/windows`.
- [ ] Добавить `alternates.canonical` минимум на `/instructions/*`.
- [ ] Связать `/instructions/*` внутренними ссылками с главной навигацией/футером и личным кабинетом.
- [ ] Добавить `openGraph`/`twitter` метатеги в `app/layout.tsx` + создать og-image (1200×630).
- [ ] Добавить apple-touch-icon и `site.webmanifest`.

## Phase 3 — Content & Authority (Month 2)

- [ ] JSON-LD Organization + WebSite в `app/layout.tsx`.
- [ ] JSON-LD FAQPage на главной (контент уже написан в `ArvexoConnectLanding.tsx`).
- [ ] JSON-LD HowTo на трёх страницах инструкций (шаги уже структурированы как массив строк в коде).
- [ ] JSON-LD Product/Offer для тарифов Start/Connect/Family.
- [ ] Добавить `llms.txt`.
- [ ] Запустить минимальный контент-кластер (3-5 статей) вокруг тематики «VPN в России / обход блокировок / Reality vs Hysteria».

## Phase 4 — Monitoring & Iteration (Ongoing)

- [ ] Подключить Google Search Console и/или Яндекс.Вебмастер; отслеживать индексацию после публикации robots.txt/sitemap.xml.
- [ ] Провести замер Core Web Vitals (PageSpeed Insights/Lighthouse) — не выполнено в этом аудите.
- [ ] Повторный аудит изображений/визуального контента после добавления og-image и возможных скриншотов продукта на лендинг.

---

## Приоритеты по серьёзности (сквозной список)

**Critical:**
robots.txt, sitemap.xml, страницы /privacy и /terms, JSON-LD (полное отсутствие).

**High:**
noindex на приватных страницах, meta description на 11 страницах, внутренние ссылки на /instructions/*, OG/Twitter теги, og-image/apple-touch-icon.

**Medium:**
canonical на /instructions/*, FAQPage/HowTo schema, llms.txt, контент-кластер.

**Low:**
визуальный контент на лендинге (скриншоты продукта).
