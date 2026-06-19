import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Условия использования | Arvexo Connect",
  description:
    "Условия использования сервиса Arvexo Connect: правила доступа к VPN, тарифы и оплата, ограничения и ответственность сторон.",
  alternates: {
    canonical: "https://connect.arvexo.ru/terms"
  }
};

const updatedAt = "17 июня 2026";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto w-[min(calc(100%-32px),760px)] py-16">
        <Link href="/" className="text-sm font-semibold text-white/50 hover:text-white">
          ← На главную
        </Link>

        <h1 className="mt-6 text-3xl font-extrabold sm:text-4xl">Условия использования</h1>
        <p className="mt-2 text-sm text-white/45">Действуют с {updatedAt}</p>

        <div className="mt-10 space-y-8 text-[15px] leading-7 text-white/80">
          <section>
            <h2 className="text-lg font-bold text-white">1. Предмет соглашения</h2>
            <p className="mt-2">
              Настоящие Условия регулируют порядок использования сервиса Arvexo Connect (далее — «Сервис»),
              включая сайт connect.arvexo.ru, личный кабинет и VPN-доступ по протоколам, поддерживаемым
              Сервисом. Оформляя подписку или используя Сервис, пользователь подтверждает согласие с этими
              Условиями.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">2. Доступ к сервису и подписка</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>доступ предоставляется на основании активной подписки, привязанной к личному кабинету пользователя;</li>
              <li>каждая подписка имеет лимит подключаемых устройств в зависимости от тарифа;</li>
              <li>пользователь самостоятельно отвечает за сохранность токена подписки и доступа к личному кабинету;</li>
              <li>смена режима маршрутизации доступна в личном кабинете в рамках текущего тарифа.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">3. Оплата и возврат средств</h2>
            <p className="mt-2">
              Стоимость тарифов указана в личном кабинете на момент оформления заказа. Оплата считается
              подтверждённой после проверки платежа Сервисом. Вопросы по возврату средств за неиспользованный
              период рассматриваются индивидуально через поддержку.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">4. Ограничения использования</h2>
            <p className="mt-2">Пользователь обязуется не использовать Сервис для:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>действий, нарушающих законодательство страны пользователя;</li>
              <li>распространения вредоносного ПО, спама или массовых автоматизированных атак;</li>
              <li>попыток обхода лимитов устройств или передачи доступа третьим лицам в коммерческих целях.</li>
            </ul>
            <p className="mt-2">
              Нарушение этих ограничений может привести к приостановке или прекращению доступа без
              возврата стоимости оставшегося периода подписки.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">5. Доступность сервиса</h2>
            <p className="mt-2">
              Мы стремимся обеспечивать стабильную работу серверов и узлов маршрутизации, но не гарантируем
              бесперебойную работу Сервиса на 100% времени, в том числе из-за внешних факторов (блокировки
              на стороне сетей, действия третьих лиц, технические работы).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">6. Изменение условий</h2>
            <p className="mt-2">
              Мы можем обновлять настоящие Условия. Действующая версия всегда доступна по адресу
              connect.arvexo.ru/terms. Продолжение использования Сервиса после публикации изменений означает
              согласие с обновлёнными Условиями.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">7. Контакты</h2>
            <p className="mt-2">
              Вопросы по настоящим Условиям и работе Сервиса — в Telegram:{" "}
              <a className="font-semibold text-[#ef233c]" href="https://t.me/arvexo_support">
                @arvexo_support
              </a>
              . См. также{" "}
              <Link className="font-semibold text-[#ef233c]" href="/privacy">
                Политику конфиденциальности
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
