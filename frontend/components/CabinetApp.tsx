"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

const ACCENT = "#E5402C";
const SUCCESS = "#1FB46A";

type Subscription = {
  token: string;
  status: string;
  routing_mode: string;
  expires_at: string | null;
  days_left: number | null;
  device_limit: number;
  devices_used: number;
  plan_name: string | null;
  traffic_limit_gb: number | null;
  last_access_at: string | null;
  public_subscription_url: string;
  raw_subscription_url: string;
};

type AuthResponse = {
  ok: boolean;
  user_id: string;
  email: string | null;
  display_name: string | null;
  account?: {
    user_id: string;
    display_name: string | null;
    telegram_connected: boolean;
  } | null;
  access_token: string;
  token_type: "bearer";
  subscriptions: Subscription[];
};

const JWT_STORAGE_KEY = "arvexo_cabinet_jwt";
type AuthMode = "register" | "login" | "access-key";

const statusLabels: Record<string, string> = {
  active: "Активна",
  trial: "Тест",
  expired: "Истекла",
  disabled: "Отключена",
  provisioning_failed: "Готовится",
};

const statusGroups = [
  { title: "АКТИВНЫЕ",    statuses: ["active"] },
  { title: "ТЕСТОВЫЕ",    statuses: ["trial"] },
  { title: "ИСТЁКШИЕ",    statuses: ["expired", "provisioning_failed"] },
  { title: "ОТКЛЮЧЁННЫЕ", statuses: ["disabled"] },
];

/* ─── Root ───────────────────────────────────────────────────────── */

export function CabinetApp() {
  const pathname = usePathname();
  const isLoginPage = pathname === "/cabinet/login";
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [jwt, setJwt] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem(JWT_STORAGE_KEY) || ""
  );
  const [data, setData] = useState<AuthResponse | null>(null);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [telegramLink, setTelegramLink] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [restoringSession, setRestoringSession] = useState(() => Boolean(jwt));

  const accountName = data?.account?.display_name || data?.display_name || "Arvexo Account";
  const subscriptions = data?.subscriptions || [];
  const firstSubscription = subscriptions[0];

  useEffect(() => {
    if (!jwt) {
      setRestoringSession(false);
      if (!isLoginPage) window.location.assign("/cabinet/login");
      return;
    }
    if (data) return;

    let cancelled = false;
    async function restoreSession() {
      setRestoringSession(true);
      try {
        const response = await fetch(`${getApiBase()}/api/auth/me`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (response.status === 401 || response.status === 403) {
          if (!cancelled) logout(!isLoginPage);
          return;
        }
        if (!response.ok) throw new Error("Не удалось восстановить сессию");
        const payload = (await response.json()) as AuthResponse;
        if (!cancelled) applyAuthPayload(payload, false);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Не удалось восстановить сессию");
      } finally {
        if (!cancelled) setRestoringSession(false);
      }
    }
    void restoreSession();
    return () => { cancelled = true; };
  }, [data, isLoginPage, jwt]);

  useEffect(() => {
    if (!jwt || !data) return;
    setTelegramConnected(Boolean(data.account?.telegram_connected));
  }, [data, jwt]);

  function applyAuthPayload(payload: AuthResponse, redirectAfterLogin = true) {
    localStorage.setItem(JWT_STORAGE_KEY, payload.access_token);
    setJwt(payload.access_token);
    setData(payload);
    setAccessKey("");
    setPassword("");
    if (redirectAfterLogin) window.location.assign("/cabinet");
  }

  async function submitAccountAuth() {
    setLoading(true); setError(""); setMessage("");
    try {
      const isRegistration = authMode === "register";
      const response = await fetch(`${getApiBase()}/api/auth/${isRegistration ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(), password,
          ...(isRegistration && displayName.trim() ? { display_name: displayName.trim() } : {}),
        }),
      });
      if (!response.ok) {
        if (isRegistration && response.status === 409)
          throw new Error("Аккаунт с таким email уже есть. Переключитесь на вход.");
        throw new Error(
          await readApiError(response, isRegistration ? "Не удалось создать Arvexo Account" : "Неверный email или пароль")
        );
      }
      applyAuthPayload((await response.json()) as AuthResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось выполнить вход");
    } finally {
      setLoading(false);
    }
  }

  async function loginWithAccessKey() {
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch(`${getApiBase()}/api/auth/access-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_key: accessKey.trim() }),
      });
      if (!response.ok) throw new Error("Access key не найден");
      applyAuthPayload((await response.json()) as AuthResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти");
    } finally {
      setLoading(false);
    }
  }

  async function redeemPromoCode() {
    if (!jwt || !promoCode.trim()) return;
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch(`${getApiBase()}/api/cabinet/promo-codes/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ code: promoCode.trim() }),
      });
      if (response.status === 401 || response.status === 403) { logout(true); return; }
      if (!response.ok) throw new Error(await readApiError(response, "Промокод не найден или уже использован"));
      const payload = (await response.json()) as { subscription: Subscription; message: string };
      setData((cur) => cur ? { ...cur, subscriptions: [payload.subscription, ...cur.subscriptions] } : cur);
      setPromoCode("");
      setMessage("Промокод применён. Подписка активирована.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось применить промокод");
    } finally {
      setLoading(false);
    }
  }

  async function createTelegramLink() {
    if (!jwt) return;
    setError("");
    const response = await fetch(`${getApiBase()}/api/cabinet/telegram/link-token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (response.status === 401 || response.status === 403) { logout(true); return; }
    if (!response.ok) { setError("Не удалось создать ссылку Telegram"); return; }
    const payload = (await response.json()) as { telegram_link_url: string };
    setTelegramLink(payload.telegram_link_url);
    window.location.assign(payload.telegram_link_url);
  }

  async function copyLink(subscription: Subscription) {
    await navigator.clipboard.writeText(subscription.public_subscription_url);
    setMessage("Ссылка скопирована.");
  }

  function logout(redirectToLogin = false) {
    localStorage.removeItem(JWT_STORAGE_KEY);
    setData(null); setAccessKey(""); setEmail(""); setPassword(""); setJwt("");
    if (redirectToLogin && typeof window !== "undefined") window.location.assign("/cabinet/login");
  }

  if (isLoginPage && data) window.location.assign("/cabinet");

  return (
    <div style={{ background: "#EEEBE3", color: "#14130F", minHeight: "100vh", fontFamily: "'Onest',sans-serif", WebkitFontSmoothing: "antialiased" }}>
      {/* Nav */}
      <header style={{ borderBottom: "1px solid rgba(20,19,15,.08)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "18px 36px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ fontWeight: 700, fontSize: 19, letterSpacing: "-.02em", display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: ACCENT, display: "inline-block" }} />
            Arvexo Connect
          </Link>
          {data ? (
            <button onClick={() => logout()} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "1px solid rgba(20,19,15,.14)", borderRadius: 100, padding: "10px 18px", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#57534B" }}>
              Выйти
            </button>
          ) : (
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#57534B", fontSize: 14, fontWeight: 500 }}>
              ← На сайт
            </Link>
          )}
        </div>
      </header>

      {restoringSession && !data ? (
        <LoadingScreen />
      ) : !data ? (
        <LoginPage
          authMode={authMode} setAuthMode={setAuthMode}
          email={email} setEmail={setEmail}
          password={password} setPassword={setPassword}
          displayName={displayName} setDisplayName={setDisplayName}
          accessKey={accessKey} setAccessKey={setAccessKey}
          loading={loading} error={error}
          submitAccountAuth={submitAccountAuth}
          loginWithAccessKey={loginWithAccessKey}
        />
      ) : (
        <Dashboard
          accountName={accountName}
          subscriptions={subscriptions}
          firstSubscription={firstSubscription}
          telegramConnected={telegramConnected}
          telegramLink={telegramLink}
          message={message}
          error={error}
          loading={loading}
          promoCode={promoCode}
          setPromoCode={setPromoCode}
          createTelegramLink={createTelegramLink}
          copyLink={copyLink}
          redeemPromoCode={redeemPromoCode}
        />
      )}

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(20,19,15,.08)", marginTop: "auto" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 36px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#A39E93" }}>© 2026 Arvexo</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#A39E93" }}>connect.arvexo.ru</span>
        </div>
      </footer>
    </div>
  );
}

/* ─── Loading ────────────────────────────────────────────────────── */

function LoadingScreen() {
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "80px 36px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, letterSpacing: ".16em", color: "#8A857B", marginBottom: 16 }}>ARVEXO ACCOUNT</div>
        <p style={{ fontSize: 18, fontWeight: 600 }}>Восстанавливаем сессию…</p>
      </div>
    </div>
  );
}

/* ─── Login page (two-column) ────────────────────────────────────── */

function LoginPage(props: {
  authMode: AuthMode; setAuthMode: (m: AuthMode) => void;
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  displayName: string; setDisplayName: (v: string) => void;
  accessKey: string; setAccessKey: (v: string) => void;
  loading: boolean; error: string;
  submitAccountAuth: () => void;
  loginWithAccessKey: () => void;
}) {
  const { authMode, setAuthMode, loading } = props;

  const tabDefs: { id: AuthMode; label: string }[] = [
    { id: "register",   label: "Регистрация" },
    { id: "login",      label: "Вход" },
    { id: "access-key", label: "Access key" },
  ];

  const titles: Record<AuthMode, string> = {
    register:   "Создать аккаунт",
    login:      "С возвращением",
    "access-key": "Вход по ключу",
  };

  const hints: Record<AuthMode, string> = {
    register:   "Регистрируясь, вы принимаете условия использования и политику конфиденциальности.",
    login:      "Забыли пароль? Восстановите доступ через Telegram-бота.",
    "access-key": "Ключ доступа выдаётся в Telegram-боте при покупке подписки.",
  };

  const ctas: Record<AuthMode, string> = {
    register:   "Создать Arvexo Account",
    login:      "Войти",
    "access-key": "Войти по ключу",
  };

  return (
    <main style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", maxWidth: 1180, margin: "0 auto", width: "100%", padding: "0 36px", alignItems: "center", gap: 80, minHeight: "calc(100vh - 130px)" }} className="login-grid">
      {/* Left value block */}
      <div style={{ padding: "60px 0" }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, letterSpacing: ".16em", color: "#8A857B", marginBottom: 28 }}>ARVEXO ACCOUNT</div>
        <h1 style={{ fontWeight: 700, fontSize: "clamp(36px,4.5vw,56px)", lineHeight: .98, letterSpacing: "-.04em", marginBottom: 24 }}>
          Доступ к вашему{" "}
          <em style={{ fontFamily: "'Cormorant',serif", fontStyle: "italic", fontWeight: 600, color: ACCENT }}>интернету</em>
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.55, color: "#4A463F", maxWidth: 420, marginBottom: 40 }}>
          Один аккаунт — все подписки, устройства и режимы. Профиль обновляется по той же ссылке, без переустановки.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {[
            "Smart Russia, Privacy и Global в одном профиле",
            "Один ключ — телефон, ПК, планшет и роутер",
            "Поддержка и выдача доступа в Telegram",
          ].map((point) => (
            <div key={point} style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: "#FBFAF7", border: "1px solid rgba(20,19,15,.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l5 5 9-11" stroke={ACCENT} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span style={{ fontSize: 15.5, color: "#3B382F", fontWeight: 500 }}>{point}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right form card */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: "100%", maxWidth: 440, background: "#FBFAF7", border: "1px solid rgba(20,19,15,.1)", borderRadius: 22, padding: 34, boxShadow: "0 30px 70px -34px rgba(20,19,15,.3)" }}>
          <h2 style={{ fontWeight: 700, fontSize: 28, letterSpacing: "-.025em", marginBottom: 22 }}>{titles[authMode]}</h2>

          {/* Tab switcher */}
          <div style={{ display: "flex", gap: 4, background: "#EEEBE3", border: "1px solid rgba(20,19,15,.08)", borderRadius: 100, padding: 4, marginBottom: 26 }}>
            {tabDefs.map((t) => (
              <button
                key={t.id}
                onClick={() => setAuthMode(t.id)}
                style={{
                  flex: 1, border: "none", cursor: "pointer",
                  fontFamily: "'Onest',sans-serif", fontWeight: 600, fontSize: 13.5,
                  padding: "10px 8px", borderRadius: 100, transition: "background .2s, color .2s",
                  background: authMode === t.id ? "#14130F" : "transparent",
                  color: authMode === t.id ? "#EEEBE3" : "#57534B",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
            {authMode === "register" && (
              <StyledInput type="text" placeholder="Имя" value={props.displayName} onChange={props.setDisplayName} />
            )}
            {authMode !== "access-key" && (
              <>
                <StyledInput type="email" placeholder="email@example.com" value={props.email} onChange={props.setEmail} autoComplete="email" />
                <StyledInput type="password" placeholder="Пароль" value={props.password} onChange={props.setPassword} autoComplete={authMode === "register" ? "new-password" : "current-password"} />
              </>
            )}
            {authMode === "access-key" && (
              <StyledInput type="text" placeholder="ARVX-0000-0000-0000" value={props.accessKey} onChange={props.setAccessKey} />
            )}
          </div>

          {props.error && (
            <p style={{ fontSize: 13, color: ACCENT, marginBottom: 14 }}>{props.error}</p>
          )}

          <button
            onClick={authMode === "access-key" ? props.loginWithAccessKey : props.submitAccountAuth}
            disabled={loading}
            style={{ width: "100%", border: "none", cursor: loading ? "not-allowed" : "pointer", background: ACCENT, color: "#fff", fontFamily: "'Onest',sans-serif", fontWeight: 600, fontSize: 15.5, padding: 16, borderRadius: 100, marginBottom: 18, opacity: loading ? .65 : 1, transition: "filter .2s" }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.filter = "brightness(1.06)")}
            onMouseLeave={(e) => (e.currentTarget.style.filter = "brightness(1)")}
          >
            {loading ? "Проверяем…" : ctas[authMode]}
          </button>

          <p style={{ fontSize: 13, lineHeight: 1.5, color: "#8A857B", textAlign: "center" }}>{hints[authMode]}</p>
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .login-grid { grid-template-columns: 1fr !important; padding-top: 40px !important; }
          .login-grid > div:first-child { padding: 0 !important; }
        }
      `}</style>
    </main>
  );
}

function StyledInput({ type, placeholder, value, onChange, autoComplete }: {
  type: string; placeholder: string; value: string; onChange: (v: string) => void; autoComplete?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type} placeholder={placeholder} value={value}
      autoComplete={autoComplete}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%", background: "#fff",
        border: `1px solid ${focused ? ACCENT : "rgba(20,19,15,.14)"}`,
        borderRadius: 12, padding: "15px 16px", fontSize: 15,
        color: "#14130F", outline: "none",
        fontFamily: "'Onest',sans-serif",
        transition: "border-color .2s",
      }}
    />
  );
}

/* ─── Dashboard ──────────────────────────────────────────────────── */

function Dashboard(props: {
  accountName: string;
  subscriptions: Subscription[];
  firstSubscription: Subscription | undefined;
  telegramConnected: boolean;
  telegramLink: string;
  message: string;
  error: string;
  loading: boolean;
  promoCode: string;
  setPromoCode: (v: string) => void;
  createTelegramLink: () => void;
  copyLink: (s: Subscription) => void;
  redeemPromoCode: () => void;
}) {
  const { accountName, subscriptions, firstSubscription, telegramConnected } = props;
  const firstName = accountName.split(" ")[0] || accountName;

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 36px 80px" }}>
      {/* Greeting card */}
      <div style={{ background: "#14130F", color: "#EEEBE3", borderRadius: 22, padding: "40px 44px", marginBottom: 32 }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, letterSpacing: ".16em", color: "#867F73", marginBottom: 20 }}>ARVEXO ACCOUNT</div>
        <h1 style={{ fontWeight: 700, fontSize: "clamp(32px,3.6vw,46px)", lineHeight: 1, letterSpacing: "-.035em", marginBottom: 12 }}>
          Привет,{" "}
          <em style={{ fontFamily: "'Cormorant',serif", fontStyle: "italic", fontWeight: 600, color: ACCENT }}>{firstName}</em>
        </h1>
        <p style={{ fontSize: 15, color: "#9A958A", marginBottom: 28, maxWidth: 540 }}>
          Управляйте всеми подписками аккаунта: активными, тестовыми, истекшими и отключёнными.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <DarkBtn href="/cabinet/plans" accent>Купить подписку</DarkBtn>
          {firstSubscription && (
            <DarkBtn href={`/cabinet/subscription/${firstSubscription.token}`}>Открыть подписку</DarkBtn>
          )}
          <DarkBtnAction onClick={props.createTelegramLink}>
            {telegramConnected ? "Telegram подключён" : "Подключить Telegram"}
          </DarkBtnAction>
          <DarkBtn href="/instructions/iphone">Инструкции</DarkBtn>
          <DarkBtn href="/cabinet/support">Поддержка</DarkBtn>
        </div>
        {props.telegramLink && (
          <a href={props.telegramLink} style={{ marginTop: 12, display: "block", fontSize: 13, color: "#9A958A", wordBreak: "break-all" }}>{props.telegramLink}</a>
        )}
      </div>

      {/* Notices */}
      {props.message && <Notice>{props.message}</Notice>}
      {props.error && <Notice tone="error">{props.error}</Notice>}

      {/* Subscriptions */}
      <section style={{ marginTop: 32 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <h2 style={{ fontWeight: 700, fontSize: 30, letterSpacing: "-.03em" }}>Ваши подписки</h2>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#8A857B" }}>Всего: {subscriptions.length}</span>
          </div>
          <Link href="/cabinet/orders" style={{ fontSize: 14, fontWeight: 600, color: "#57534B" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = ACCENT)}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#57534B")}>
            История заказов →
          </Link>
        </div>

        {!subscriptions.length ? (
          <EmptySubscriptions
            promoCode={props.promoCode}
            setPromoCode={props.setPromoCode}
            loading={props.loading}
            redeemPromoCode={props.redeemPromoCode}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {statusGroups.map((group) => {
              const items = subscriptions.filter((s) => group.statuses.includes(s.status));
              if (!items.length) return null;
              return (
                <div key={group.title}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, letterSpacing: ".14em", color: "#8A857B", marginBottom: 16 }}>{group.title}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }} className="sub-grid">
                    {items.map((sub) => (
                      <SubscriptionCard key={sub.token} subscription={sub} onCopy={() => props.copyLink(sub)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <style>{`
        @media (max-width: 860px) { .sub-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 560px) { .sub-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}

function DarkBtn({ href, children, accent }: { href: string; children: ReactNode; accent?: boolean }) {
  return (
    <Link href={href} style={{
      display: "inline-flex", alignItems: "center", padding: "11px 20px", borderRadius: 100,
      fontSize: 14, fontWeight: 600, cursor: "pointer",
      background: accent ? ACCENT : "rgba(255,255,255,.08)",
      color: "#EEEBE3",
    }}>
      {children}
    </Link>
  );
}

function DarkBtnAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", padding: "11px 20px", borderRadius: 100,
      fontSize: 14, fontWeight: 600, cursor: "pointer", border: "none",
      background: "rgba(255,255,255,.08)", color: "#EEEBE3",
      fontFamily: "'Onest',sans-serif",
    }}>
      {children}
    </button>
  );
}

/* ─── Subscription card ──────────────────────────────────────────── */

function SubscriptionCard({ subscription, onCopy }: { subscription: Subscription; onCopy: () => void }) {
  const [copied, setCopied] = useState(false);
  const label = statusLabels[subscription.status] || subscription.status;
  const expired = ["expired", "disabled"].includes(subscription.status);

  async function handleCopy() {
    await onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const daysLeft = subscription.days_left;
  const daysMax = 30;
  const daysProgress = daysLeft === null ? 100 : Math.min(100, (daysLeft / daysMax) * 100);
  const daysLow = daysLeft !== null && daysLeft < 5;

  const devicesProgress = Math.min(100, (subscription.devices_used / subscription.device_limit) * 100);

  return (
    <article style={{ background: "#FBFAF7", border: "1px solid rgba(20,19,15,.09)", borderRadius: 22, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <h4 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.02em", marginBottom: 4 }}>
            {subscription.plan_name || "Arvexo Connect"}
          </h4>
          <p style={{ fontSize: 13.5, color: "#57534B" }}>
            {label}{!expired ? ` · ${modeLabel(subscription.routing_mode)}` : ""}
          </p>
        </div>
        <StatusBadge status={subscription.status} label={label} />
      </div>

      {/* Stat tiles */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        <StatTile label="Осталось" value={daysLeft === null ? "без срока" : `${daysLeft} дн.`}>
          <ProgressBar progress={daysProgress} color={daysLow ? ACCENT : SUCCESS} />
        </StatTile>
        <StatTile label="Устройства" value={`${subscription.devices_used} / ${subscription.device_limit}`}>
          <ProgressBar progress={devicesProgress} color="#14130F" />
        </StatTile>
        <StatTile label="Token" value={shortToken(subscription.token)} mono />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href={`/cabinet/subscription/${subscription.token}`}
          style={{ display: "inline-flex", alignItems: "center", padding: "10px 20px", borderRadius: 100, background: "#14130F", color: "#EEEBE3", fontSize: 14, fontWeight: 600 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = ACCENT)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#14130F")}>
          Открыть
        </Link>
        <button onClick={handleCopy}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 100, border: "1px solid rgba(20,19,15,.14)", background: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Onest',sans-serif", color: "#14130F" }}>
          {copied ? "Скопировано" : "Копировать"}
        </button>
        {expired && (
          <Link href="/cabinet/plans"
            style={{ display: "inline-flex", alignItems: "center", padding: "10px 18px", borderRadius: 100, border: "1px solid rgba(20,19,15,.14)", fontSize: 14, fontWeight: 600, color: "#14130F" }}>
            Продлить
          </Link>
        )}
      </div>
    </article>
  );
}

function StatTile({ label, value, mono, children }: { label: string; value: string; mono?: boolean; children?: ReactNode }) {
  return (
    <div style={{ background: "#EEEBE3", border: "1px solid rgba(20,19,15,.09)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: children ? 10 : 0 }}>
        <span style={{ fontSize: 12, color: "#8A857B" }}>{label}</span>
        <span style={{ fontFamily: mono ? "'JetBrains Mono',monospace" : undefined, fontSize: mono ? 12 : 14, fontWeight: 600 }}>{value}</span>
      </div>
      {children}
    </div>
  );
}

function ProgressBar({ progress, color }: { progress: number; color: string }) {
  return (
    <div style={{ height: 5, background: "rgba(20,19,15,.1)", borderRadius: 100, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${progress}%`, background: color, borderRadius: 100, transition: "width .3s" }} />
    </div>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const styles: React.CSSProperties = (() => {
    if (status === "active") return { background: "rgba(31,180,106,.12)", color: "#1B9E5E" };
    if (status === "trial")  return { background: `rgba(229,64,44,.1)`, color: ACCENT };
    if (status === "expired") return { background: "rgba(20,19,15,.07)", color: "#8A857B" };
    return { background: "rgba(20,19,15,.07)", color: "#8A857B" };
  })();
  return (
    <span style={{ display: "inline-flex", padding: "5px 12px", borderRadius: 100, fontSize: 12, fontWeight: 600, ...styles }}>
      {label}
    </span>
  );
}

/* ─── Empty state ────────────────────────────────────────────────── */

function EmptySubscriptions({ promoCode, setPromoCode, loading, redeemPromoCode }: {
  promoCode: string; setPromoCode: (v: string) => void; loading: boolean; redeemPromoCode: () => void;
}) {
  return (
    <div style={{ background: "#FBFAF7", border: "1px solid rgba(20,19,15,.09)", borderRadius: 22, padding: "36px 32px" }}>
      <h3 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.02em", marginBottom: 10 }}>У вас пока нет подписок.</h3>
      <p style={{ fontSize: 15, color: "#57534B", lineHeight: 1.55, marginBottom: 24 }}>Выберите тариф, чтобы получить доступ.</p>
      <Link href="/cabinet/plans"
        style={{ display: "inline-flex", alignItems: "center", padding: "13px 26px", borderRadius: 100, background: ACCENT, color: "#fff", fontSize: 14.5, fontWeight: 600, marginBottom: 28 }}>
        Выбрать тариф
      </Link>
      {/* Promo code */}
      <div style={{ borderTop: "1px solid rgba(20,19,15,.09)", paddingTop: 24 }}>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Есть промокод?</p>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="FAMILY-XXXX-XXXX"
            style={{ flex: 1, background: "#fff", border: "1px solid rgba(20,19,15,.14)", borderRadius: 12, padding: "13px 16px", fontSize: 14, color: "#14130F", outline: "none", fontFamily: "'Onest',sans-serif" }}
          />
          <button
            onClick={redeemPromoCode}
            disabled={loading || promoCode.trim().length < 4}
            style={{ padding: "13px 22px", borderRadius: 12, background: "#14130F", color: "#EEEBE3", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "'Onest',sans-serif", opacity: (loading || promoCode.trim().length < 4) ? .5 : 1 }}>
            Применить
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Notice ─────────────────────────────────────────────────────── */

function Notice({ children, tone = "success" }: { children: ReactNode; tone?: "success" | "error" }) {
  const styles = tone === "error"
    ? { background: `rgba(229,64,44,.08)`, border: `1px solid rgba(229,64,44,.2)`, color: ACCENT }
    : { background: "rgba(31,180,106,.08)", border: "1px solid rgba(31,180,106,.2)", color: "#1B9E5E" };
  return (
    <p style={{ marginTop: 16, padding: "14px 18px", borderRadius: 12, fontSize: 14, lineHeight: 1.5, ...styles }}>
      {children}
    </p>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function modeLabel(mode: string) {
  if (mode === "smart")   return "Smart Russia";
  if (mode === "privacy") return "Privacy";
  if (mode === "global")  return "Global";
  return mode;
}

function shortToken(token: string) {
  if (token.length <= 10) return token;
  return `${token.slice(0, 9)}…`;
}

function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) return process.env.NEXT_PUBLIC_API_BASE_URL;
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname))
    return "http://127.0.0.1:8012";
  return "https://api.arvexo.ru";
}

async function readApiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { detail?: string | { msg?: string }[] };
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
    if (Array.isArray(body.detail) && body.detail[0]?.msg) return body.detail[0].msg;
  } catch { /* keep fallback */ }
  return fallback;
}
