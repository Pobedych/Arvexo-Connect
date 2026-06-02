"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Copy, LogOut, ShieldCheck } from "lucide-react";

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
  provisioning_failed: "Готовится"
};

const statusGroups = [
  { title: "Активные", statuses: ["active"] },
  { title: "Тестовые", statuses: ["trial"] },
  { title: "Истекшие", statuses: ["expired", "provisioning_failed"] },
  { title: "Отключённые", statuses: ["disabled"] }
];

export function CabinetApp() {
  const pathname = usePathname();
  const isLoginPage = pathname === "/cabinet/login";
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [jwt, setJwt] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem(JWT_STORAGE_KEY) || ""));
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
          headers: { Authorization: `Bearer ${jwt}` }
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
    return () => {
      cancelled = true;
    };
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
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const isRegistration = authMode === "register";
      const response = await fetch(`${getApiBase()}/api/auth/${isRegistration ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          ...(isRegistration && displayName.trim() ? { display_name: displayName.trim() } : {})
        })
      });
      if (!response.ok) {
        if (isRegistration && response.status === 409) throw new Error("Аккаунт с таким email уже есть. Переключитесь на вход.");
        throw new Error(await readApiError(response, isRegistration ? "Не удалось создать Arvexo Account" : "Неверный email или пароль"));
      }
      applyAuthPayload((await response.json()) as AuthResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось выполнить вход");
    } finally {
      setLoading(false);
    }
  }

  async function loginWithAccessKey() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${getApiBase()}/api/auth/access-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_key: accessKey.trim() })
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
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${getApiBase()}/api/cabinet/promo-codes/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ code: promoCode.trim() })
      });
      if (response.status === 401 || response.status === 403) {
        logout(true);
        return;
      }
      if (!response.ok) throw new Error(await readApiError(response, "Промокод не найден или уже использован"));
      const payload = (await response.json()) as { subscription: Subscription; message: string };
      setData((current) => current ? { ...current, subscriptions: [payload.subscription, ...current.subscriptions] } : current);
      setPromoCode("");
      setMessage("Промокод применен. Подписка активирована.");
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
      headers: { Authorization: `Bearer ${jwt}` }
    });
    if (response.status === 401 || response.status === 403) {
      logout(true);
      return;
    }
    if (!response.ok) {
      setError("Не удалось создать ссылку Telegram");
      return;
    }
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
    setData(null);
    setAccessKey("");
    setEmail("");
    setPassword("");
    setJwt("");
    if (redirectToLogin && typeof window !== "undefined") window.location.assign("/cabinet/login");
  }

  if (isLoginPage && data) {
    window.location.assign("/cabinet");
  }

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-8 text-white">
      <section className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
          <Link href="/" className="flex items-center gap-3 text-lg font-semibold">
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-[#ef233c]/35 bg-[#ef233c]/10 text-[#ff2b3a]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            Arvexo Connect
          </Link>
          {data && (
            <button onClick={() => logout()} className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] px-4 py-2 text-sm font-bold">
              <LogOut className="h-4 w-4" /> Выйти
            </button>
          )}
        </header>

        {restoringSession && !data ? (
          <CenteredPanel title="Восстанавливаем сессию" text="Загружаем данные кабинета." />
        ) : !data ? (
          <LoginPanel
            authMode={authMode}
            setAuthMode={setAuthMode}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            displayName={displayName}
            setDisplayName={setDisplayName}
            accessKey={accessKey}
            setAccessKey={setAccessKey}
            loading={loading}
            error={error}
            submitAccountAuth={submitAccountAuth}
            loginWithAccessKey={loginWithAccessKey}
          />
        ) : (
          <div className="mt-10">
            <div className="rounded-[28px] border border-white/[0.08] bg-[#101010] p-6 md:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff2b3a]">Arvexo Account</p>
              <h1 className="mt-4 text-3xl font-semibold">Привет, {accountName}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/56">
                Управляйте всеми подписками аккаунта: активными, тестовыми, истекшими и отключёнными.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/cabinet/plans" className="inline-flex min-h-12 items-center rounded-lg bg-[#ef233c] px-5 text-sm font-bold">
                  Купить подписку
                </Link>
                {firstSubscription && (
                  <Link href={`/cabinet/subscription/${firstSubscription.token}`} className="inline-flex min-h-12 items-center rounded-lg border border-white/[0.12] px-5 text-sm font-bold">
                    Открыть подписку
                  </Link>
                )}
                <button onClick={createTelegramLink} className="inline-flex min-h-12 items-center rounded-lg border border-white/[0.12] px-5 text-sm font-bold">
                  {telegramConnected ? "Telegram подключён" : "Подключить Telegram"}
                </button>
                <Link href="/instructions/iphone" className="inline-flex min-h-12 items-center rounded-lg border border-white/[0.12] px-5 text-sm font-bold">
                  Открыть инструкции
                </Link>
                <Link href="/cabinet/support" className="inline-flex min-h-12 items-center rounded-lg border border-white/[0.12] px-5 text-sm font-bold">
                  Поддержка
                </Link>
              </div>
              {telegramLink && <a href={telegramLink} className="mt-3 block break-all text-sm font-semibold text-[#ffb3bb]">{telegramLink}</a>}
            </div>

            {message && <Notice>{message}</Notice>}
            {error && <Notice tone="error">{error}</Notice>}

            <section className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold">Ваши подписки</h2>
                  <p className="mt-2 text-sm text-white/45">Всего: {subscriptions.length}</p>
                </div>
                <Link href="/cabinet/orders" className="text-sm font-bold text-white/64 hover:text-white">История заказов</Link>
              </div>

              {!subscriptions.length ? (
                <div className="mt-5 rounded-[24px] border border-white/[0.08] bg-[#101010] p-6">
                  <h3 className="text-xl font-semibold">У вас пока нет подписок.</h3>
                  <p className="mt-3 text-sm leading-6 text-white/56">Выберите тариф, чтобы получить доступ.</p>
                  <Link href="/cabinet/plans" className="mt-5 inline-flex min-h-12 items-center rounded-lg bg-[#ef233c] px-5 text-sm font-bold">
                    Выбрать тариф
                  </Link>
                  <PromoBox promoCode={promoCode} setPromoCode={setPromoCode} loading={loading} redeemPromoCode={redeemPromoCode} />
                </div>
              ) : (
                <div className="mt-5 grid gap-7">
                  {statusGroups.map((group) => {
                    const items = subscriptions.filter((item) => group.statuses.includes(item.status));
                    if (!items.length) return null;
                    return (
                      <div key={group.title}>
                        <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-white/45">{group.title}</h3>
                        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {items.map((subscription) => (
                            <SubscriptionCard key={subscription.token} subscription={subscription} onCopy={() => copyLink(subscription)} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function LoginPanel(props: {
  authMode: AuthMode;
  setAuthMode: (mode: AuthMode) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  displayName: string;
  setDisplayName: (value: string) => void;
  accessKey: string;
  setAccessKey: (value: string) => void;
  loading: boolean;
  error: string;
  submitAccountAuth: () => void;
  loginWithAccessKey: () => void;
}) {
  const { authMode, setAuthMode, loading } = props;
  return (
    <div className="mx-auto mt-16 max-w-xl rounded-[28px] border border-white/[0.08] bg-[#101010] p-6 md:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff2b3a]">Arvexo Account</p>
      <h1 className="mt-4 text-4xl font-semibold">
        {authMode === "register" ? "Создать аккаунт" : authMode === "login" ? "Войти в аккаунт" : "Вход по access key"}
      </h1>
      <div className="mt-6 grid grid-cols-3 rounded-xl border border-white/[0.08] bg-black/25 p-1 text-xs font-bold sm:text-sm">
        <AuthModeButton active={authMode === "register"} onClick={() => setAuthMode("register")} label="Регистрация" />
        <AuthModeButton active={authMode === "login"} onClick={() => setAuthMode("login")} label="Вход" />
        <AuthModeButton active={authMode === "access-key"} onClick={() => setAuthMode("access-key")} label="Access key" />
      </div>

      {authMode === "access-key" ? (
        <>
          <input value={props.accessKey} onChange={(event) => props.setAccessKey(event.target.value)} placeholder="ARVX-XXXX-XXXX-XXXX" className="mt-8 min-h-12 w-full rounded-lg border border-white/[0.1] bg-black/35 px-4 text-white outline-none focus:border-[#ef233c]" />
          <button onClick={props.loginWithAccessKey} disabled={loading} className="mt-4 min-h-12 w-full rounded-lg bg-[#ef233c] px-5 text-sm font-bold disabled:opacity-60">
            {loading ? "Проверяем..." : "Войти по access key"}
          </button>
        </>
      ) : (
        <>
          {authMode === "register" && <input value={props.displayName} onChange={(event) => props.setDisplayName(event.target.value)} placeholder="Имя" className="mt-8 min-h-12 w-full rounded-lg border border-white/[0.1] bg-black/35 px-4 text-white outline-none focus:border-[#ef233c]" />}
          <input value={props.email} onChange={(event) => props.setEmail(event.target.value)} placeholder="email@example.com" type="email" autoComplete="email" className={`${authMode === "register" ? "mt-3" : "mt-8"} min-h-12 w-full rounded-lg border border-white/[0.1] bg-black/35 px-4 text-white outline-none focus:border-[#ef233c]`} />
          <input value={props.password} onChange={(event) => props.setPassword(event.target.value)} placeholder="Пароль" type="password" autoComplete={authMode === "register" ? "new-password" : "current-password"} className="mt-3 min-h-12 w-full rounded-lg border border-white/[0.1] bg-black/35 px-4 text-white outline-none focus:border-[#ef233c]" />
          <button onClick={props.submitAccountAuth} disabled={loading} className="mt-4 min-h-12 w-full rounded-lg bg-[#ef233c] px-5 text-sm font-bold disabled:opacity-60">
            {loading ? "Проверяем..." : authMode === "register" ? "Создать Arvexo Account" : "Войти через Arvexo Account"}
          </button>
        </>
      )}
      {props.error && <p className="mt-4 text-sm text-[#ff2b3a]">{props.error}</p>}
    </div>
  );
}

function SubscriptionCard({ subscription, onCopy }: { subscription: Subscription; onCopy: () => void }) {
  const label = statusLabels[subscription.status] || subscription.status;
  const expired = ["expired", "disabled"].includes(subscription.status);
  return (
    <article className="rounded-[22px] border border-white/[0.08] bg-[#101010] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-xl font-semibold">{subscription.plan_name || "Arvexo Connect"}</h4>
          <p className="mt-2 text-sm text-white/56">
            {label}{!expired ? ` · ${modeLabel(subscription.routing_mode)}` : ""}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${badgeClass(subscription.status)}`}>{label}</span>
      </div>
      <div className="mt-5 grid gap-3">
        <Info label="Осталось" value={subscription.days_left === null ? "без срока" : `${subscription.days_left} дней`} />
        <Info label="Устройства" value={`${subscription.devices_used}/${subscription.device_limit}`} />
        <Info label="Token" value={shortToken(subscription.token)} />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/cabinet/subscription/${subscription.token}`} className="inline-flex min-h-10 items-center rounded-lg bg-[#ef233c] px-4 text-sm font-bold">
          Открыть
        </Link>
        <button onClick={onCopy} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/[0.12] px-4 text-sm font-bold">
          <Copy className="h-4 w-4" /> Скопировать
        </button>
        {expired && <Link href="/cabinet/plans" className="inline-flex min-h-10 items-center rounded-lg border border-white/[0.12] px-4 text-sm font-bold">Продлить</Link>}
      </div>
    </article>
  );
}

function PromoBox({ promoCode, setPromoCode, loading, redeemPromoCode }: { promoCode: string; setPromoCode: (value: string) => void; loading: boolean; redeemPromoCode: () => void }) {
  return (
    <div className="mt-6 rounded-2xl border border-white/[0.08] bg-black/25 p-4">
      <p className="text-sm font-semibold">Промокод</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input value={promoCode} onChange={(event) => setPromoCode(event.target.value)} placeholder="FAMILY-XXXX-XXXX" className="h-12 rounded-lg border border-white/[0.1] bg-black px-4 text-white outline-none focus:border-[#ef233c]" />
        <button onClick={redeemPromoCode} disabled={loading || promoCode.trim().length < 4} className="min-h-12 rounded-lg bg-white px-5 text-sm font-bold text-black disabled:opacity-50">
          Применить
        </button>
      </div>
    </div>
  );
}

function CenteredPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto mt-16 max-w-xl rounded-[28px] border border-white/[0.08] bg-[#101010] p-6 md:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff2b3a]">Arvexo Account</p>
      <h1 className="mt-4 text-3xl font-semibold">{title}</h1>
      <p className="mt-4 text-sm text-white/56">{text}</p>
    </div>
  );
}

function AuthModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`min-h-10 rounded-lg px-2 transition ${active ? "bg-[#ef233c] text-white" : "text-white/56 hover:text-white"}`}>
      {label}
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4">
      <p className="text-xs text-white/45">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}

function Notice({ children, tone = "success" }: { children: ReactNode; tone?: "success" | "error" }) {
  return (
    <p className={`mt-5 rounded-2xl border p-4 text-sm ${tone === "error" ? "border-[#ef233c]/30 bg-[#ef233c]/10 text-[#ffb3bb]" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"}`}>
      {children}
    </p>
  );
}

function badgeClass(status: string) {
  if (status === "active") return "bg-emerald-400/12 text-emerald-100";
  if (status === "trial") return "bg-sky-400/12 text-sky-100";
  if (status === "expired") return "bg-amber-400/12 text-amber-100";
  if (status === "disabled") return "bg-white/[0.08] text-white/56";
  return "bg-[#ef233c]/12 text-[#ffb3bb]";
}

function modeLabel(mode: string) {
  if (mode === "smart") return "Smart Russia";
  if (mode === "privacy") return "Privacy";
  if (mode === "global") return "Global";
  return mode;
}

function shortToken(token: string) {
  if (token.length <= 10) return token;
  return `${token.slice(0, 9)}...`;
}

function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) return process.env.NEXT_PUBLIC_API_BASE_URL;
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) return "http://127.0.0.1:8012";
  return "https://api.arvexo.ru";
}

async function readApiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { detail?: string | { msg?: string }[] };
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
    if (Array.isArray(body.detail) && body.detail[0]?.msg) return body.detail[0].msg;
  } catch {
    // Keep the fallback when the API did not return JSON.
  }
  return fallback;
}
