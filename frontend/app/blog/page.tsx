import Link from "next/link";

export const metadata = {
  title: "Блог | Arvexo Connect",
  description:
    "Статьи о VPN в России: какие сервисы блокируют, как работают Reality и Hysteria и что делать, если подключение не работает.",
  alternates: {
    canonical: "https://connect.arvexo.ru/blog"
  }
};

const posts = [
  {
    slug: "kak-obojti-blokirovki-v-rossii-2026",
    title: "Как обойти блокировки в России в 2026 году",
    description:
      "Что блокируют сейчас, почему обычный VPN не всегда работает и как подключиться через Reality и Hysteria."
  },
  {
    slug: "reality-vs-hysteria",
    title: "Reality vs Hysteria: что выбрать",
    description: "Как работает каждый протокол и какой режим подойдёт под вашу сеть и задачу."
  },
  {
    slug: "vpn-ne-rabotaet-chto-delat",
    title: "VPN не подключается: что делать",
    description: "Чек-лист по шагам: от проверки подписки до смены режима маршрутизации."
  },
  {
    slug: "vpn-dlya-youtube-instagram-discord",
    title: "VPN для YouTube, Instagram и Discord",
    description: "Какой режим выбрать под конкретный сервис и почему блокировки работают по-разному."
  }
];

export default function BlogIndexPage() {
  return (
    <main className="min-h-screen bg-[#050505] px-4 py-16 text-white">
      <div className="mx-auto w-[min(calc(100%-32px),900px)]">
        <Link href="/" className="text-sm font-semibold text-white/50 hover:text-white">
          ← На главную
        </Link>

        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-[#ff2b3a]">Блог</p>
        <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">Статьи о VPN и блокировках</h1>
        <p className="mt-4 text-[15px] leading-7 text-white/60">
          Разбираем протоколы, блокировки и типичные проблемы подключения простым языком.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="rounded-2xl border border-white/[0.08] bg-[#101010] p-5 transition hover:border-[#ff2b3a]/60"
            >
              <h2 className="text-lg font-bold text-white">{post.title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/70">{post.description}</p>
              <span className="mt-4 inline-block text-sm font-semibold text-[#ff2b3a]">Читать →</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
