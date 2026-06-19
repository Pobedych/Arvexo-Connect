# Schema / Structured Data — connect.arvexo.ru

**Оценка: 5/100**

## Что работает
Не обнаружено.

## Находки

### Critical — JSON-LD полностью отсутствует
Поиск по всему фронтенду (`app/`, `components/`) не находит ни одного `<script type="application/ld+json">` и ни одного упоминания structured data. Отсутствует разметка:
- Organization / WebSite — нет вообще
- SoftwareApplication / Product+Offer — для тарифов Start 199₽ / Connect 299₽ / Family 599₽
- FAQPage — для готового блока из 5 вопросов на главной
- HowTo — для трёх страниц инструкций (iPhone/Android/Windows)

**Рекомендация (порядок внедрения):**
1. Organization + WebSite в `app/layout.tsx` (базовый уровень, влияет на все страницы).
2. FAQPage на главной — контент уже написан, нужно только обернуть в JSON-LD.
3. HowTo на трёх страницах инструкций — шаги уже структурированы как массив строк в коде.
4. Product/Offer для тарифных планов.
