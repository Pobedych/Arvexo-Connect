"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

const JWT_STORAGE_KEY = "arvexo_cabinet_jwt";

const ACCENT = "#E5402C";

const marqueeItems = [
  "YouTube","ChatGPT","Netflix","Instagram","Spotify","Steam","Discord","Twitch",
  "YouTube","ChatGPT","Netflix","Instagram","Spotify","Steam","Discord","Twitch",
];

const stats = [
  { num: "12 000+", label: "активных пользователей" },
  { num: "20+",     label: "узлов в нескольких странах" },
  { num: "99.9%",   label: "аптайм инфраструктуры" },
  { num: "< 5 мин", label: "до первого подключения" },
];

const problems = [
  { title: "Банки ругаются на вход",    body: "Финансовые сервисы блокируют доступ при заходе с зарубежного IP." },
  { title: "Маркетплейсы тормозят",     body: "Ozon, Wildberries и другие площадки открываются нестабильно." },
  { title: "Чужой регион",              body: "Локальные сервисы видят зарубежный IP и показывают не тот контент." },
  { title: "Ручные переключения",       body: "Приходится включать и выключать VPN вручную под каждый сайт." },
];

const steps = [
  { n: 1, title: "Получаете доступ",         body: "После оплаты или выдачи ключа вы получаете одну постоянную ссылку подписки." },
  { n: 2, title: "Импортируете в приложение",body: "Подходит для Hiddify, V2RayTun, NekoBox и других клиентов." },
  { n: 3, title: "Меняете режим",             body: "В боте или кабинете выбираете Smart, Privacy или Global." },
  { n: 4, title: "Обновляете подписку",       body: "Ссылка остаётся той же, но конфиг обновляется под выбранный режим." },
];

const modes = [
  {
    tag: "RECOMMENDED", name: "Smart Russia", featured: true,
    body: "Для повседневного использования в России. .ru, банки, Ozon, Яндекс, VK и другие локальные сервисы открываются напрямую. Остальное идёт через VPN.",
    chips: ["Direct local", "Foreign tunnel", "Daily mode"],
  },
  {
    tag: "MAXIMUM TUNNEL", name: "Privacy", featured: false,
    body: "Почти весь трафик идёт через защищённый туннель. Подходит, когда важнее приватность и единый внешний IP.",
    chips: ["Single exit IP", "Tunnel first", "Privacy focus"],
  },
  {
    tag: "TRAVEL READY", name: "Global", featured: false,
    body: "Для поездок, Китая, Ирана и нестабильных сетей. Локальные сервисы выбранной страны можно оставить напрямую, остальное пустить через VPN.",
    chips: ["Country rules", "Hard networks", "Flexible route"],
  },
];

const features = [
  { n: 1, title: "Reality + Hysteria",   body: "Два протокола в одной подписке: TCP-стабильность и UDP-скорость для разных сетевых сценариев." },
  { n: 2, title: "Smart DNS & Routing",  body: "Локальные и зарубежные сервисы обрабатываются по разным правилам — без ручных списков." },
  { n: 3, title: "Telegram Support",     body: "Быстрая помощь, инструкции и выдача доступа через бота. Без UUID, SNI и технической боли." },
  { n: 4, title: "One Subscription",     body: "Одна ссылка для всех серверов, режимов и обновлений. Меняется конфиг — не ссылка." },
  { n: 5, title: "No Technical Setup",   body: "Пользователь не видит UUID, SNI, shortId и другие сложные настройки — всё уже внутри профиля." },
  { n: 6, title: "Multi-device Access",  body: "Подключение на телефоне, ПК, планшете и роутере. Один профиль — все экраны." },
];

const compare = [
  { param: "Локальные сайты и банки",  old: "Ломаются, видят чужой регион",      arv: "Открываются напрямую" },
  { param: "Переключение режимов",      old: "Вручную под каждый сайт",           arv: "Автоматически по правилам" },
  { param: "Блокировки провайдера",     old: "Часто блокируется",                  arv: "Reality + Hysteria маскируют трафик" },
  { param: "Если сервер упал",          old: "Теряете связь",                      arv: "Резервные узлы подхватывают сами" },
  { param: "Настройка",                 old: "UUID, SNI, конфиги вручную",         arv: "Одна ссылка — и всё работает" },
  { param: "Поддержка",                 old: "Тикеты на сутки",                    arv: "Живой Telegram за минуты" },
];

const testimonials = [
  { quote: "Поставил один раз и забыл про настройки. Сбер и Ozon открываются как обычно, YouTube идёт через туннель. Именно этого не хватало.", name: "Денис К.", handle: "@denis_k", ini: "Д" },
  { quote: "Брал для поездки в Азию — Global вытащил там, где обычные VPN просто лежали. Режим меняется без новой ссылки.", name: "Марина Т.", handle: "@marina.tv", ini: "М" },
  { quote: "Главное — поддержка в телеге отвечает за минуты, а не за сутки. Сервер раз моргнул, меня перекинуло на резервный автоматически.", name: "Алексей Р.", handle: "@alex_r", ini: "А" },
];

const pricing = [
  {
    name: "Start", price: "199 ₽", note: "Для одного устройства и базового подключения.", featured: false,
    perks: ["1 устройство", "Основной профиль", "Инструкция подключения"],
    cta: "Получить доступ",
  },
  {
    name: "Connect", price: "299 ₽", note: "Smart Routing, Reality + Hysteria, несколько серверов.", featured: true,
    perks: ["Arvexo Route Control", "Reality + Hysteria", "Multi-node infrastructure"],
    cta: "Получить доступ",
  },
  {
    name: "Family", price: "599 ₽", note: "Несколько устройств, поддержка и резервные профили.", featured: false,
    perks: ["Несколько устройств", "Поддержка семьи", "Резервные профили"],
    cta: "Получить доступ",
  },
];

const guarantees = [
  { title: "Возврат 7 дней",              body: "Не заработает под ваш сценарий — вернём деньги без вопросов." },
  { title: "Оплата через Telegram-бот",   body: "Доступ выдаётся сразу, без привязки карты к сайту." },
  { title: "Без логов",                   body: "Мы не храним историю подключений и не передаём данные третьим лицам." },
];

const faqData = [
  { q: "Это обычный VPN?",                       a: "Нет. Arvexo сам решает, что вести через защищённый туннель, а что оставить локальным. Вы не переключаете VPN вручную — режим маршрутизации делает это за вас." },
  { q: "Российские сайты будут работать?",        a: "Да. .ru-сайты, банки, Ozon, Яндекс, VK и госуслуги в режиме Smart Russia открываются напрямую, без VPN — поэтому они не «ругаются» на чужой регион." },
  { q: "Можно ли пустить всё через VPN?",         a: "Да. В режиме Privacy почти весь трафик идёт через защищённый туннель с единым внешним IP — когда важнее приватность." },
  { q: "Что делать, если один сервер не работает?", a: "Multi-node инфраструктура переключит вас на резервный узел. Подписка и ссылка остаются прежними — переустанавливать профиль не нужно." },
  { q: "Нужно ли разбираться в настройках?",      a: "Нет. Вы не видите UUID, SNI, shortId и другие технические параметры — просто импортируете одну ссылку в приложение, и всё работает." },
];

function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) return process.env.NEXT_PUBLIC_API_BASE_URL;
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname))
    return "http://127.0.0.1:8012";
  return "https://api.arvexo.ru";
}

/* ─── Shared primitives ──────────────────────────────────────────── */

function MonoLabel({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <p
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "11.5px",
        letterSpacing: ".16em",
        color: dark ? "#867F73" : "#8A857B",
        marginBottom: "32px",
      }}
    >
      {children}
    </p>
  );
}

function ArrowRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ color = ACCENT }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M5 12l5 5 9-11" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
      <path d="M6 6l12 12M18 6L6 18" stroke="#B8B2A6" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
      <path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z" stroke={ACCENT} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4.5" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Nav ────────────────────────────────────────────────────────── */

export function ArvexoConnectLanding() {
  return (
    <div style={{ background: "#EEEBE3", color: "#14130F", minHeight: "100vh", overflowX: "hidden" }}>
      <LandingNav />
      <main>
        <HeroSection />
        <MarqueeSection />
        <StatsSection />
        <ProblemSection />
        <HowSection />
        <ModesSection />
        <FeaturesSection />
        <CompareSection />
        <TestimonialsSection />
        <PricingSection />
        <FaqSection />
        <BigCta />
      </main>
      <LandingFooter />
    </div>
  );
}

function LandingNav() {
  const [accountInitial, setAccountInitial] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const jwt = localStorage.getItem(JWT_STORAGE_KEY);
    if (!jwt) return;
    let cancelled = false;
    fetch(`${getApiBase()}/api/auth/me`, { headers: { Authorization: `Bearer ${jwt}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { account?: { display_name?: string }; display_name?: string; email?: string } | null) => {
        if (body && !cancelled) {
          const name = body.account?.display_name || body.display_name || body.email || "A";
          setAccountInitial(String(name).trim().slice(0, 1).toUpperCase() || "A");
        }
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, []);

  const navLinks = [
    { href: "#feat", label: "Возможности" },
    { href: "#modes", label: "Режимы" },
    { href: "#price", label: "Тарифы" },
    { href: "#faq", label: "FAQ" },
  ];

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "rgba(238,235,227,.88)",
      backdropFilter: "blur(14px)",
      borderBottom: "1px solid rgba(20,19,15,.08)",
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "18px 36px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Logo */}
        <a href="#top" style={{ fontWeight: 700, fontSize: 19, letterSpacing: "-.02em", display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: ACCENT, display: "inline-block" }} />
          Arvexo Connect
        </a>

        {/* Desktop nav */}
        <nav style={{ display: "flex", alignItems: "center", gap: 34 }} className="hidden lg:flex">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} style={{ color: "#57534B", fontSize: 14.5, fontWeight: 500 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#14130F")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#57534B")}>
              {l.label}
            </a>
          ))}
        </nav>

        {/* Desktop actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }} className="hidden lg:flex">
          {accountInitial ? (
            <a href="/cabinet" style={{ width: 36, height: 36, borderRadius: "50%", background: "#14130F", color: "#EEEBE3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>
              {accountInitial}
            </a>
          ) : (
            <a href="/cabinet/login" style={{ color: "#57534B", fontSize: 14.5, fontWeight: 500 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#14130F")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#57534B")}>
              Войти
            </a>
          )}
          <NavCta />
        </div>

        {/* Mobile burger */}
        <button
          className="lg:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ background: "none", border: "1px solid rgba(20,19,15,.14)", borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 36px 20px", display: "flex", flexDirection: "column", gap: 8 }} className="lg:hidden">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
              style={{ padding: "12px 0", fontWeight: 500, color: "#57534B", borderBottom: "1px solid rgba(20,19,15,.06)" }}>
              {l.label}
            </a>
          ))}
          <div style={{ marginTop: 8, display: "flex", gap: 10 }}>
            <a href="/cabinet/login" style={{ flex: 1, textAlign: "center", padding: "12px 0", border: "1px solid rgba(20,19,15,.14)", borderRadius: 100, fontWeight: 600, fontSize: 14 }}>Войти</a>
            <a href="/cabinet" style={{ flex: 1, textAlign: "center", padding: "12px 0", background: "#14130F", color: "#EEEBE3", borderRadius: 100, fontWeight: 600, fontSize: 14 }}>Получить доступ</a>
          </div>
        </div>
      )}
    </header>
  );
}

function NavCta() {
  const [hovered, setHovered] = useState(false);
  return (
    <a href="/cabinet"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? ACCENT : "#14130F", color: "#EEEBE3", fontSize: 14, fontWeight: 600, padding: "11px 20px", borderRadius: 100, whiteSpace: "nowrap", transition: "background .2s" }}>
      Получить доступ
    </a>
  );
}

/* ─── Hero ───────────────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section id="top" style={{ maxWidth: 1280, margin: "0 auto", padding: "78px 36px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 38 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: ACCENT, animation: "acPulse 1.9s ease-in-out infinite", display: "inline-block" }} />
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, letterSpacing: ".16em", color: "#8A857B" }}>SMART VPN ACCESS</span>
      </div>

      <h1 style={{ fontWeight: 700, fontSize: "clamp(48px,7.2vw,92px)", lineHeight: .92, letterSpacing: "-.045em", maxWidth: 1120, textWrap: "balance" as never }}>
        VPN, который{" "}
        <em style={{ fontFamily: "'Cormorant',serif", fontStyle: "italic", fontWeight: 600, color: ACCENT, letterSpacing: "-.01em" }}>адаптируется</em>
        {" "}под ваш интернет
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "64px", alignItems: "end", marginTop: 54, paddingBottom: 80 }} className="hero-grid">
        <div>
          <p style={{ fontSize: 18, lineHeight: 1.55, color: "#4A463F", maxWidth: 460, marginBottom: 32 }}>
            Arvexo Connect направляет зарубежные сервисы через защищённый туннель, а локальные сайты, банки и маркетплейсы открывает напрямую — быстро, стабильно и без лишних настроек.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 30, flexWrap: "wrap" }}>
            <HeroPrimaryBtn />
            <a href="#how" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#14130F", fontSize: 15.5, fontWeight: 600, padding: "15px 8px" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = ACCENT)}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#14130F")}>
              Посмотреть, как работает
            </a>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#8A857B", letterSpacing: ".02em" }}>
            Reality + Hysteria · Smart Routing · Multi-node
          </div>
        </div>

        {/* Product panel */}
        <ProductPanel />
      </div>

      <style>{`
        @media (max-width: 860px) {
          .hero-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

function HeroPrimaryBtn() {
  const [hovered, setHovered] = useState(false);
  return (
    <a href="/cabinet"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "inline-flex", alignItems: "center", gap: 9, background: hovered ? ACCENT : "#14130F", color: "#EEEBE3", fontSize: 15.5, fontWeight: 600, padding: "15px 26px", borderRadius: 100, transition: "background .2s" }}>
      Получить доступ <ArrowRight />
    </a>
  );
}

function ProductPanel() {
  return (
    <div>
      <div style={{ background: "#FBFAF7", border: "1px solid rgba(20,19,15,.09)", borderRadius: 20, padding: 8, boxShadow: "0 30px 60px -28px rgba(20,19,15,.28)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1FB46A", display: "inline-block" }} />
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#3B382F", fontWeight: 500 }}>tunnel · active</span>
          </div>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#A39E93" }}>node-se-04</span>
        </div>
        {/* Rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <PanelRow icon="YT" iconBg="#14130F" iconColor="#EEEBE3" title="Зарубежные сервисы" sub="через туннель · Sweden" badge="VPN" badgeStyle={{ background: ACCENT, color: "#EEEBE3" }} />
          <PanelRow icon="₽"  iconBg="#1FB46A" iconColor="#fff"    title="Банки и госуслуги"  sub="напрямую · локально"    badge="DIRECT" badgeStyle={{ color: "#1FB46A", border: "1px solid rgba(31,180,106,.4)" }} />
        </div>
        {/* Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", marginTop: 8, borderTop: "1px solid rgba(20,19,15,.07)", paddingTop: 4 }}>
          <Metric label="пинг" value="18" unit="ms" />
          <Metric label="скорость" value="940" unit="mb" bordered />
          <Metric label="аптайм" value="99.9" unit="%" success bordered />
        </div>
      </div>
    </div>
  );
}

function PanelRow({ icon, iconBg, iconColor, title, sub, badge, badgeStyle }: {
  icon: string; iconBg: string; iconColor: string; title: string; sub: string; badge: string; badgeStyle: React.CSSProperties;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 15px", borderRadius: 13, background: "#F1EFE9" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: iconBg, color: iconColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>
          {icon}
        </span>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</div>
          <div style={{ fontSize: 11.5, color: "#8A857B" }}>{sub}</div>
        </div>
      </div>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, borderRadius: 6, padding: "4px 8px", ...badgeStyle }}>{badge}</span>
    </div>
  );
}

function Metric({ label, value, unit, success, bordered }: { label: string; value: string; unit: string; success?: boolean; bordered?: boolean }) {
  return (
    <div style={{ padding: "12px 15px", borderLeft: bordered ? "1px solid rgba(20,19,15,.07)" : undefined }}>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 19, fontWeight: 500, color: success ? "#1FB46A" : undefined }}>
        {value}<span style={{ fontSize: 11, color: "#A39E93" }}>{unit}</span>
      </div>
      <div style={{ fontSize: 11, color: "#8A857B" }}>{label}</div>
    </div>
  );
}

/* ─── Marquee ────────────────────────────────────────────────────── */

function MarqueeSection() {
  return (
    <section style={{ borderTop: "1px solid rgba(20,19,15,.1)", borderBottom: "1px solid rgba(20,19,15,.1)", overflow: "hidden", padding: "20px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 56, width: "max-content", animation: "acMarquee 28s linear infinite" }}>
        {marqueeItems.map((item, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 56, fontSize: 19, fontWeight: 600, color: "#8A857B", whiteSpace: "nowrap" }}>
            {item}
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: ACCENT, display: "inline-block" }} />
          </span>
        ))}
      </div>
    </section>
  );
}

/* ─── Stats ──────────────────────────────────────────────────────── */

function StatsSection() {
  return (
    <section style={{ borderBottom: "1px solid rgba(20,19,15,.1)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 36px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "rgba(20,19,15,.08)" }} className="stats-grid">
        {stats.map((s) => (
          <div key={s.num} style={{ background: "#EEEBE3", padding: "8px 28px 8px 0" }}>
            <div style={{ fontWeight: 700, fontSize: 44, letterSpacing: "-.04em", lineHeight: 1, marginBottom: 8 }}>{s.num}</div>
            <div style={{ fontSize: 14, color: "#57534B", lineHeight: 1.4 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <style>{`
        @media (max-width: 600px) { .stats-grid { grid-template-columns: 1fr 1fr !important; } }
      `}</style>
    </section>
  );
}

/* ─── Problem ────────────────────────────────────────────────────── */

function ProblemSection() {
  return (
    <section style={{ maxWidth: 1280, margin: "0 auto", padding: "120px 36px" }}>
      <MonoLabel>(01) ПОЧЕМУ ЭТО ВАЖНО</MonoLabel>
      <h2 style={{ fontWeight: 600, fontSize: "clamp(32px,4.2vw,54px)", lineHeight: 1.02, letterSpacing: "-.035em", maxWidth: 820, marginBottom: 18 }}>
        Обычный VPN часто{" "}
        <em style={{ fontFamily: "'Cormorant',serif", fontStyle: "italic", fontWeight: 500, color: ACCENT }}>ломает</em>
        {" "}привычные сайты
      </h2>
      <p style={{ fontSize: 18, color: "#57534B", maxWidth: 520, marginBottom: 56 }}>Arvexo Connect решает это через умные режимы маршрутизации.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }} className="cards-4">
        {problems.map((p) => (
          <div key={p.title} style={{ background: "#FBFAF7", border: "1px solid rgba(20,19,15,.09)", borderRadius: 16, padding: "26px 24px" }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: ACCENT, marginBottom: 32 }}>✕</div>
            <h3 style={{ fontWeight: 600, fontSize: 18, letterSpacing: "-.015em", marginBottom: 8 }}>{p.title}</h3>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: "#8A857B" }}>{p.body}</p>
          </div>
        ))}
      </div>
      <style>{`
        @media (max-width: 800px) { .cards-4 { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 480px) { .cards-4 { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}

/* ─── How (dark) ─────────────────────────────────────────────────── */

function HowSection() {
  return (
    <section id="how" style={{ background: "#14130F", color: "#EEEBE3" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "120px 36px" }}>
        <MonoLabel dark>(02) КАК ЭТО РАБОТАЕТ</MonoLabel>
        <h2 style={{ fontWeight: 600, fontSize: "clamp(32px,4.2vw,54px)", lineHeight: 1.02, letterSpacing: "-.035em", maxWidth: 760, marginBottom: 72 }}>
          Одна ссылка.{" "}
          <em style={{ fontFamily: "'Cormorant',serif", fontStyle: "italic", fontWeight: 500, color: ACCENT }}>Разные</em>
          {" "}режимы.
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, overflow: "hidden" }} className="steps-grid">
          {steps.map((s) => (
            <div key={s.n} style={{ background: "#14130F", padding: "34px 28px" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: ACCENT, marginBottom: 44 }}>0{s.n}</div>
              <h3 style={{ fontWeight: 600, fontSize: 19, letterSpacing: "-.02em", marginBottom: 11 }}>{s.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.55, color: "#9A958A" }}>{s.body}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24, fontSize: 14, color: "#9A958A" }}>
          Инструкции по платформам:{" "}
          <Link href="/instructions/iphone" style={{ color: ACCENT, fontWeight: 600, marginRight: 12 }}>iPhone</Link>
          <Link href="/instructions/android" style={{ color: ACCENT, fontWeight: 600, marginRight: 12 }}>Android</Link>
          <Link href="/instructions/windows" style={{ color: ACCENT, fontWeight: 600 }}>Windows</Link>
        </div>
      </div>
      <style>{`
        @media (max-width: 720px) { .steps-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 480px) { .steps-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}

/* ─── Modes ──────────────────────────────────────────────────────── */

function ModesSection() {
  return (
    <section id="modes" style={{ maxWidth: 1280, margin: "0 auto", padding: "120px 36px" }}>
      <MonoLabel>(03) РЕЖИМЫ</MonoLabel>
      <h2 style={{ fontWeight: 600, fontSize: "clamp(32px,4.2vw,54px)", lineHeight: 1.0, letterSpacing: "-.035em", maxWidth: 840, marginBottom: 18 }}>
        Вы сами выбираете, как должен{" "}
        <em style={{ fontFamily: "'Cormorant',serif", fontStyle: "italic", fontWeight: 500, color: ACCENT }}>работать</em>
        {" "}интернет
      </h2>
      <p style={{ fontSize: 18, color: "#57534B", maxWidth: 560, marginBottom: 56 }}>
        Один доступ — разные режимы подключения. Меняйте логику маршрутизации без новой ссылки и без переустановки профиля.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }} className="cards-3">
        {modes.map((m) => (
          <ModeCard key={m.name} mode={m} />
        ))}
      </div>
      <style>{`
        @media (max-width: 720px) { .cards-3 { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}

function ModeCard({ mode }: { mode: typeof modes[0] }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#FBFAF7",
        border: `1px solid ${mode.featured ? ACCENT : "rgba(20,19,15,.1)"}`,
        borderRadius: 18,
        padding: "30px 28px",
        display: "flex",
        flexDirection: "column",
        transition: "box-shadow .2s",
        boxShadow: hovered ? "0 8px 32px rgba(20,19,15,.08)" : "none",
      }}
    >
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, letterSpacing: ".14em", color: ACCENT, marginBottom: 14 }}>{mode.tag}</div>
      <h3 style={{ fontWeight: 600, fontSize: 24, letterSpacing: "-.02em", marginBottom: 12 }}>{mode.name}</h3>
      <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "#57534B", marginBottom: 24, flex: 1 }}>{mode.body}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 24 }}>
        {mode.chips.map((c) => (
          <span key={c} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#57534B", background: "#EEEBE3", border: "1px solid rgba(20,19,15,.1)", borderRadius: 100, padding: "5px 11px" }}>{c}</span>
        ))}
      </div>
      <a href="/cabinet" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: hovered ? ACCENT : "#14130F", fontSize: 14.5, fontWeight: 600, transition: "color .2s" }}>
        Выбрать режим <ArrowRight size={15} />
      </a>
    </div>
  );
}

/* ─── Features (editorial list) ─────────────────────────────────── */

function FeaturesSection() {
  return (
    <section id="feat" style={{ background: "#E6E2D8" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "120px 36px" }}>
        <MonoLabel>(04) ВОЗМОЖНОСТИ</MonoLabel>
        <h2 style={{ fontWeight: 600, fontSize: "clamp(32px,4.2vw,54px)", lineHeight: 1.02, letterSpacing: "-.035em", maxWidth: 760, marginBottom: 64 }}>
          Технологии скрыты,{" "}
          <em style={{ fontFamily: "'Cormorant',serif", fontStyle: "italic", fontWeight: 500, color: ACCENT }}>сценарии</em>
          {" "}понятны
        </h2>
        <div style={{ borderTop: "1px solid rgba(20,19,15,.14)" }}>
          {features.map((f) => <FeatureRow key={f.n} feature={f} />)}
        </div>
      </div>
    </section>
  );
}

function FeatureRow({ feature: f }: { feature: typeof features[0] }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid", gridTemplateColumns: "80px 1fr 1.1fr", gap: 32,
        alignItems: "start", padding: "30px 8px",
        borderBottom: "1px solid rgba(20,19,15,.14)", cursor: "default",
        background: hovered ? "rgba(20,19,15,.03)" : "transparent",
        transition: "background .15s",
      }}
      className="feat-row"
    >
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: ACCENT, paddingTop: 5 }}>0{f.n}</div>
      <h3 style={{ fontWeight: 600, fontSize: 25, letterSpacing: "-.025em" }}>{f.title}</h3>
      <p style={{ fontSize: 16, lineHeight: 1.55, color: "#57534B", maxWidth: 480 }}>{f.body}</p>
    </div>
  );
}

/* ─── Compare ────────────────────────────────────────────────────── */

function CompareSection() {
  return (
    <section style={{ maxWidth: 1280, margin: "0 auto", padding: "120px 36px" }}>
      <MonoLabel>(05) СРАВНЕНИЕ</MonoLabel>
      <h2 style={{ fontWeight: 600, fontSize: "clamp(32px,4.2vw,54px)", lineHeight: 1.02, letterSpacing: "-.035em", maxWidth: 760, marginBottom: 56 }}>
        Чем это{" "}
        <em style={{ fontFamily: "'Cormorant',serif", fontStyle: "italic", fontWeight: 500, color: ACCENT }}>отличается</em>
        {" "}от обычного VPN
      </h2>
      <div style={{ border: "1px solid rgba(20,19,15,.12)", borderRadius: 18, overflow: "hidden", background: "#FBFAF7" }}>
        {/* Header row */}
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", borderBottom: "1px solid rgba(20,19,15,.12)" }}>
          <div style={{ padding: "20px 28px" }} />
          <div style={{ padding: "20px 28px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: ".08em", color: "#8A857B" }}>ОБЫЧНЫЙ VPN</div>
          <div style={{ padding: "20px 28px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: ".08em", color: ACCENT, background: `rgba(229,64,44,.05)`, borderLeft: "1px solid rgba(20,19,15,.12)" }}>ARVEXO CONNECT</div>
        </div>
        {compare.map((c, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", borderBottom: i < compare.length - 1 ? "1px solid rgba(20,19,15,.08)" : undefined }}>
            <div style={{ padding: "22px 28px", fontSize: 15.5, fontWeight: 600, letterSpacing: "-.01em" }}>{c.param}</div>
            <div style={{ padding: "22px 28px", fontSize: 14.5, color: "#8A857B", display: "flex", alignItems: "flex-start", gap: 9 }}>
              <CrossIcon />{c.old}
            </div>
            <div style={{ padding: "22px 28px", fontSize: 14.5, color: "#3B382F", display: "flex", alignItems: "flex-start", gap: 9, background: "rgba(229,64,44,.05)", borderLeft: "1px solid rgba(20,19,15,.08)" }}>
              <CheckIcon />{c.arv}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Testimonials ───────────────────────────────────────────────── */

function TestimonialsSection() {
  return (
    <section style={{ background: "#E6E2D8" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "120px 36px" }}>
        <MonoLabel>(06) ОТЗЫВЫ</MonoLabel>
        <h2 style={{ fontWeight: 600, fontSize: "clamp(32px,4.2vw,54px)", lineHeight: 1.02, letterSpacing: "-.035em", maxWidth: 760, marginBottom: 56 }}>
          Им уже{" "}
          <em style={{ fontFamily: "'Cormorant',serif", fontStyle: "italic", fontWeight: 500, color: ACCENT }}>не нужно</em>
          {" "}думать о настройках
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }} className="cards-3t">
          {testimonials.map((t) => (
            <div key={t.name} style={{ background: "#FBFAF7", border: "1px solid rgba(20,19,15,.09)", borderRadius: 18, padding: "30px 28px", display: "flex", flexDirection: "column" }}>
              <div style={{ color: ACCENT, fontSize: 15, marginBottom: 20 }}>★★★★★</div>
              <p style={{ fontSize: 16, lineHeight: 1.6, color: "#3B382F", marginBottom: 26, flex: 1 }}>{t.quote}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 40, height: 40, borderRadius: "50%", background: "#14130F", color: "#EEEBE3", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 16 }}>{t.ini}</span>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#8A857B" }}>{t.handle}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <style>{`
          @media (max-width: 720px) { .cards-3t { grid-template-columns: 1fr !important; } }
        `}</style>
      </div>
    </section>
  );
}

/* ─── Pricing ────────────────────────────────────────────────────── */

function PricingSection() {
  const pricingJsonLd = {
    "@context": "https://schema.org",
    "@graph": pricing.map((plan) => ({
      "@type": "Product",
      name: `Arvexo Connect ${plan.name}`,
      description: plan.note,
      brand: { "@type": "Brand", name: "Arvexo Connect" },
      offers: {
        "@type": "Offer",
        price: plan.price.replace(/[^\d]/g, ""),
        priceCurrency: "RUB",
        url: "https://connect.arvexo.ru/cabinet/plans",
        availability: "https://schema.org/InStock",
      },
    })),
  };

  return (
    <section id="price" style={{ maxWidth: 1280, margin: "0 auto", padding: "120px 36px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }} />
      <div style={{ textAlign: "center", marginBottom: 64 }}>
        <MonoLabel>(07) ТАРИФЫ</MonoLabel>
        <h2 style={{ fontWeight: 600, fontSize: "clamp(32px,4.2vw,54px)", lineHeight: 1.02, letterSpacing: "-.035em" }}>
          Простой доступ без лишней сложности
        </h2>
        <p style={{ fontSize: 18, color: "#57534B", maxWidth: 560, margin: "18px auto 0" }}>
          Мы делаем стабильный приватный доступ, умную маршрутизацию и понятное подключение.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, maxWidth: 1040, margin: "0 auto" }} className="cards-3p">
        {pricing.map((p) => <PricingCard key={p.name} plan={p} />)}
      </div>
      {/* Guarantees */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, maxWidth: 1040, margin: "24px auto 0" }} className="cards-3g">
        {guarantees.map((g) => (
          <div key={g.title} style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "22px 24px", background: "#FBFAF7", border: "1px solid rgba(20,19,15,.09)", borderRadius: 14 }}>
            <ShieldIcon />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.01em", marginBottom: 4 }}>{g.title}</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "#8A857B" }}>{g.body}</div>
            </div>
          </div>
        ))}
      </div>
      <style>{`
        @media (max-width: 720px) {
          .cards-3p, .cards-3g { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

function PricingCard({ plan }: { plan: typeof pricing[0] }) {
  return (
    <div style={{
      background: plan.featured ? "#14130F" : "#FBFAF7",
      color: plan.featured ? "#EEEBE3" : "#14130F",
      border: `1px solid ${plan.featured ? "#14130F" : "rgba(20,19,15,.1)"}`,
      borderRadius: 20, padding: "34px 30px", position: "relative",
    }}>
      {plan.featured && (
        <span style={{ position: "absolute", top: 24, right: 26, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: ".1em", color: "#14130F", background: ACCENT, padding: "4px 9px", borderRadius: 100 }}>POPULAR</span>
      )}
      <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 5 }}>{plan.name}</div>
      <div style={{ fontSize: 13, color: plan.featured ? "#9A958A" : "#8A857B", marginBottom: 26, minHeight: 36 }}>{plan.note}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 28 }}>
        <span style={{ fontWeight: 700, fontSize: 46, letterSpacing: "-.04em" }}>{plan.price}</span>
        <span style={{ fontSize: 14, color: plan.featured ? "#9A958A" : "#8A857B" }}>/месяц</span>
      </div>
      <a href="/cabinet/plans" style={{
        display: "block", textAlign: "center", fontSize: 14.5, fontWeight: 600, padding: 14, borderRadius: 100, marginBottom: 28,
        background: plan.featured ? ACCENT : "#EEEBE3",
        color: plan.featured ? "#fff" : "#14130F",
        border: plan.featured ? undefined : "1px solid rgba(20,19,15,.14)",
      }}>
        {plan.cta}
      </a>
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        {plan.perks.map((perk) => (
          <div key={perk} style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 14.5 }}>
            <CheckIcon color={ACCENT} />
            {perk}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── FAQ (dark) ─────────────────────────────────────────────────── */

function FaqSection() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" style={{ background: "#14130F", color: "#EEEBE3" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "120px 36px" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <MonoLabel dark>(08) FAQ</MonoLabel>
          <h2 style={{ fontWeight: 600, fontSize: "clamp(30px,4vw,50px)", lineHeight: 1.02, letterSpacing: "-.035em" }}>Частые вопросы</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {faqData.map((f, i) => (
            <FaqItem key={i} faq={f} isOpen={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ faq, isOpen, onToggle }: { faq: typeof faqData[0]; isOpen: boolean; onToggle: () => void }) {
  return (
    <div style={{ background: "#1A1814", border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, overflow: "hidden" }}>
      <button
        onClick={onToggle}
        style={{ width: "100%", background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "20px 24px", cursor: "pointer", color: "#EEEBE3", textAlign: "left" }}
      >
        <span style={{ fontWeight: 600, fontSize: 17, letterSpacing: "-.01em" }}>{faq.q}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, transition: "transform .25s ease", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
          <path d="M6 9l6 6 6-6" stroke={ACCENT} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen && (
        <p style={{ padding: "0 24px 22px", fontSize: 15, lineHeight: 1.6, color: "#9A958A", maxWidth: 680 }}>{faq.a}</p>
      )}
    </div>
  );
}

/* ─── Big CTA ────────────────────────────────────────────────────── */

function BigCta() {
  return (
    <section style={{ maxWidth: 1280, margin: "0 auto", padding: "130px 36px 110px", textAlign: "center" }}>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, letterSpacing: ".16em", color: "#8A857B", marginBottom: 28 }}>ARVEXO CONNECT</div>
      <h2 style={{ fontWeight: 700, fontSize: "clamp(36px,5.8vw,74px)", lineHeight: .96, letterSpacing: "-.045em", marginBottom: 24, maxWidth: 900, marginLeft: "auto", marginRight: "auto" }}>
        Подключение, которое работает{" "}
        <em style={{ fontFamily: "'Cormorant',serif", fontStyle: "italic", fontWeight: 600, color: ACCENT }}>под ваш</em>
        {" "}сценарий
      </h2>
      <p style={{ fontSize: 18, color: "#4A463F", maxWidth: 560, margin: "0 auto 38px" }}>
        Smart Russia для повседневного интернета. Privacy для максимального туннеля. Global для поездок и сложных сетей.
      </p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
        <CtaPrimaryBtn />
        <a href="https://t.me/arvexo_support"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#FBFAF7", color: "#14130F", fontSize: 16, fontWeight: 600, padding: "17px 28px", borderRadius: 100, border: "1px solid rgba(20,19,15,.14)" }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(20,19,15,.35)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(20,19,15,.14)")}>
          Написать в поддержку
        </a>
      </div>
    </section>
  );
}

function CtaPrimaryBtn() {
  const [hovered, setHovered] = useState(false);
  return (
    <a href="/cabinet"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "inline-flex", alignItems: "center", gap: 10, background: hovered ? ACCENT : "#14130F", color: "#EEEBE3", fontSize: 16, fontWeight: 600, padding: "17px 32px", borderRadius: 100, transition: "background .2s" }}>
      Получить Arvexo Connect <ArrowRight size={17} />
    </a>
  );
}

/* ─── Footer ─────────────────────────────────────────────────────── */

function LandingFooter() {
  const columns = [
    { title: "PRODUCT",  links: [{ label: "Возможности", href: "#feat" }, { label: "Режимы", href: "#modes" }, { label: "Тарифы", href: "#price" }, { label: "Инструкция", href: "/instructions/iphone" }, { label: "Личный кабинет", href: "/cabinet" }] },
    { title: "COMPANY",  links: [{ label: "Arvexo", href: "#top" }, { label: "Контакты", href: "https://t.me/arvexo_support" }, { label: "Статус серверов", href: "#top" }] },
    { title: "SUPPORT",  links: [{ label: "Telegram", href: "https://t.me/arvexo_support" }, { label: "FAQ", href: "#faq" }, { label: "iPhone", href: "/instructions/iphone" }, { label: "Android", href: "/instructions/android" }, { label: "Windows", href: "/instructions/windows" }] },
    { title: "LEGAL",    links: [{ label: "Политика конфиденциальности", href: "/privacy" }, { label: "Условия использования", href: "/terms" }] },
  ];
  return (
    <footer style={{ borderTop: "1px solid rgba(20,19,15,.1)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "56px 36px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1.2fr", gap: 30, marginBottom: 56 }} className="footer-grid">
          <div style={{ maxWidth: 300 }}>
            <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-.02em", display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: ACCENT, display: "inline-block" }} />
              Arvexo Connect
            </div>
            <p style={{ fontSize: 14, color: "#8A857B", lineHeight: 1.5 }}>VPN-доступ с режимами Smart Russia, Privacy и Global. Одна подписка, несколько узлов и понятное подключение.</p>
          </div>
          {columns.map((col) => (
            <div key={col.title} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: ".12em", color: "#A39E93", marginBottom: 4 }}>{col.title}</div>
              {col.links.map((l) => (
                <a key={l.label} href={l.href} style={{ fontSize: 14.5, color: "#4A463F", fontWeight: 500 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = ACCENT)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#4A463F")}>
                  {l.label}
                </a>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, paddingTop: 24, borderTop: "1px solid rgba(20,19,15,.1)" }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#A39E93" }}>© 2026 Arvexo</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#A39E93" }}>connect.arvexo.ru</span>
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) { .footer-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 480px) { .footer-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </footer>
  );
}
