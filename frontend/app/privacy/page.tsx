import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Политика конфиденциальности | Arvexo Connect",
  description:
    "Политика конфиденциальности Arvexo Connect: какие данные мы собираем, как их используем и храним, и как с нами связаться по вопросам данных.",
  alternates: {
    canonical: "https://connect.arvexo.ru/privacy"
  }
};

const updatedAt = "17 июня 2026";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto w-[min(calc(100%-32px),760px)] py-16">
        <Link href="/" className="text-sm font-semibold text-white/50 hover:text-white">
          ← На главную
        </Link>

        <h1 className="mt-6 text-3xl font-extrabold sm:text-4xl">Политика конфиденциальности</h1>
        <p className="mt-2 text-sm text-white/45">Действует с {updatedAt}</p>

        <div className="mt-10 space-y-8 text-[15px] leading-7 text-white/80">
          <section>
            <h2 className="text-lg font-bold text-white">1. Общие положения</h2>
            <p className="mt-2">
              Настоящая Политика конфиденциальности (далее — «Политика») описывает, какие данные сервис
              Arvexo Connect (далее — «Сервис», «мы») собирает при использовании сайта connect.arvexo.ru,
              личного кабинета и VPN-приложений, с какой целью обрабатывает эти данные и какие права есть у
              пользователя в отношении своих данных.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">2. Какие данные мы собираем</h2>
            <p className="mt-2">Для предоставления доступа к Сервису мы можем обрабатывать:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>контактные данные, указанные при регистрации (email и/или Telegram ID);</li>
              <li>технические данные подписки: токен подписки, выбранный режим маршрутизации, тариф, срок действия;</li>
              <li>сведения об устройствах, добавленных в личном кабинете (название, тип, дата подключения);</li>
              <li>данные об оплате (способ оплаты, сумма, статус заказа) — без хранения полных реквизитов карт или кошельков;</li>
              <li>технические логи, необходимые для работы и безопасности Сервиса (IP-адрес на момент запроса, временные метки обращений к API).</li>
            </ul>
            <p className="mt-2">
              Мы не ведём журнал посещаемых пользователем сайтов и не анализируем содержимое трафика,
              проходящего через VPN-серверы.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">3. Цели обработки данных</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>предоставление и поддержание работы VPN-доступа и личного кабинета;</li>
              <li>обработка заказов и подписок, включая продление и смену тарифа;</li>
              <li>связь с пользователем по вопросам, связанным с использованием Сервиса;</li>
              <li>обеспечение безопасности и предотвращение злоупотреблений (например, превышение лимита устройств).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">4. Хранение и срок хранения</h2>
            <p className="mt-2">
              Данные хранятся на серверах Сервиса в течение срока действия учётной записи и дополнительный
              срок после её удаления, необходимый для соблюдения финансовой и технической отчётности, после
              чего удаляются или анонимизируются.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">5. Передача данных третьим лицам</h2>
            <p className="mt-2">
              Мы не продаём и не передаём персональные данные пользователей третьим лицам в маркетинговых
              целях. Данные могут передаваться платёжным провайдерам в объёме, необходимом для обработки
              оплаты, и могут быть раскрыты по законному требованию уполномоченных органов.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">6. Права пользователя</h2>
            <p className="mt-2">
              Пользователь может запросить просмотр, исправление или удаление своих данных, а также отзыв
              согласия на обработку, обратившись через личный кабинет или контакты, указанные ниже.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">7. Контакты</h2>
            <p className="mt-2">
              По вопросам, связанным с этой Политикой и обработкой данных, обращайтесь в Telegram:{" "}
              <a className="font-semibold text-[#ef233c]" href="https://t.me/arvexo_support">
                @arvexo_support
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
