"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, Copy, LogOut, QrCode, ShieldCheck } from "lucide-react";

type Subscription = {
  token: string;
  status: string;
  routing_mode: string;
  expires_at: string | null;
  days_left: number | null;
  device_limit: number;
  traffic_limit_gb: number | null;
  last_access_at: string | null;
  public_subscription_url: string;
};

type AuthResponse = {
  ok: boolean;
  user_id: string;
  access_token: string;
  token_type: "bearer";
  subscriptions: Subscription[];
};

const modes = [
  { value: "smart", title: "Smart Russia", text: "Локальные сервисы напрямую, зарубежные через защищенный туннель." },
  { value: "privacy", title: "Privacy", text: "Почти весь трафик идет через защищенный туннель." },
  { value: "global", title: "Global", text: "Для поездок и нестабильных сетей." }
];

const JWT_STORAGE_KEY = "arvexo_cabinet_jwt";
type AuthMode = "register" | "login" | "access-key";

export function CabinetApp() {
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [jwt, setJwt] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem(JWT_STORAGE_KEY) || ""));
  const [data, setData] = useState<AuthResponse | null>(null);
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const subscription = useMemo(() => {
    if (!data?.subscriptions.length) return null;
    return data.subscriptions.find((item) => item.token === selectedToken) || data.subscriptions[0];
  }, [data, selectedToken]);

  function applyAuthPayload(payload: AuthResponse) {
    localStorage.setItem(JWT_STORAGE_KEY, payload.access_token);
    setJwt(payload.access_token);
    setData(payload);
    setAccessKey("");
    setPassword("");
    setSelectedToken(payload.subscriptions[0]?.token || "");
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
        if (isRegistration && response.status === 409) {
          throw new Error("Аккаунт с таким email уже есть. Переключитесь на вход.");
        }
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

  async function changeMode(mode: string) {
    if (!subscription || !jwt) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${getApiBase()}/api/cabinet/subscription/${subscription.token}/mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ mode })
      });
      if (response.status === 401 || response.status === 403) {
        logout(true);
        return;
      }
      if (!response.ok) throw new Error("Не удалось изменить режим");
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          subscriptions: current.subscriptions.map((item) =>
            item.token === subscription.token ? { ...item, routing_mode: mode } : item
          )
        };
      });
      setMessage("Режим изменён. Чтобы применить его, обновите подписку в VPN-приложении.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось изменить режим");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!subscription) return;
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
    setSelectedToken("");
    if (redirectToLogin && typeof window !== "undefined") {
      window.location.assign("/cabinet/login");
    }
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

        {!data ? (
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
                <input
                  value={accessKey}
                  onChange={(event) => setAccessKey(event.target.value)}
                  placeholder="ARVX-XXXX-XXXX-XXXX"
                  className="mt-8 min-h-12 w-full rounded-lg border border-white/[0.1] bg-black/35 px-4 text-white outline-none focus:border-[#ef233c]"
                />
                <button onClick={loginWithAccessKey} disabled={loading} className="mt-4 min-h-12 w-full rounded-lg bg-[#ef233c] px-5 text-sm font-bold disabled:opacity-60">
                  {loading ? "Проверяем..." : "Войти по access key"}
                </button>
              </>
            ) : (
              <>
                {authMode === "register" && (
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Имя"
                    className="mt-8 min-h-12 w-full rounded-lg border border-white/[0.1] bg-black/35 px-4 text-white outline-none focus:border-[#ef233c]"
                  />
                )}
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="email@example.com"
                  type="email"
                  autoComplete="email"
                  className={`${authMode === "register" ? "mt-3" : "mt-8"} min-h-12 w-full rounded-lg border border-white/[0.1] bg-black/35 px-4 text-white outline-none focus:border-[#ef233c]`}
                />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Пароль"
                  type="password"
                  autoComplete={authMode === "register" ? "new-password" : "current-password"}
                  className="mt-3 min-h-12 w-full rounded-lg border border-white/[0.1] bg-black/35 px-4 text-white outline-none focus:border-[#ef233c]"
                />
                <button onClick={submitAccountAuth} disabled={loading} className="mt-4 min-h-12 w-full rounded-lg bg-[#ef233c] px-5 text-sm font-bold disabled:opacity-60">
                  {loading ? "Проверяем..." : authMode === "register" ? "Создать Arvexo Account" : "Войти через Arvexo Account"}
                </button>
              </>
            )}
            {error && <p className="mt-4 text-sm text-[#ff2b3a]">{error}</p>}
          </div>
        ) : (
          <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_0.82fr]">
            <section className="rounded-[28px] border border-white/[0.08] bg-[#101010] p-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff2b3a]">Ваш доступ</p>
              <h1 className="mt-4 text-3xl font-semibold">{subscription ? "Подписка активна" : "Подписка пока не выдана"}</h1>
              {!subscription && (
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/62">
                  Arvexo Account создан. Когда доступ будет выдан, здесь появятся subscription URL, QR-код и выбор режима.
                </p>
              )}
              {subscription && (
                <>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <Info label="Статус" value={subscription.status} />
                    <Info label="Режим" value={subscription.routing_mode} />
                    <Info label="Осталось" value={subscription.days_left === null ? "без срока" : `${subscription.days_left} дней`} />
                    <Info label="Устройств" value={`до ${subscription.device_limit}`} />
                  </div>
                  <div className="mt-6 rounded-2xl border border-white/[0.08] bg-black/30 p-4">
                    <p className="text-xs text-white/48">Subscription URL</p>
                    <p className="mt-2 break-all text-sm text-white/80">{subscription.public_subscription_url}</p>
                    <button onClick={copyLink} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#ef233c] px-4 py-3 text-sm font-bold">
                      <Copy className="h-4 w-4" /> Скопировать ссылку
                    </button>
                  </div>
                  <div className="mt-6 grid gap-3 md:grid-cols-3">
                    {modes.map((mode) => (
                      <button
                        key={mode.value}
                        onClick={() => changeMode(mode.value)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          subscription.routing_mode === mode.value
                            ? "border-[#ef233c] bg-[#ef233c]/12"
                            : "border-white/[0.08] bg-black/25 hover:border-[#ef233c]/45"
                        }`}
                      >
                        <span className="text-base font-semibold">{mode.title}</span>
                        <span className="mt-2 block text-sm leading-5 text-white/56">{mode.text}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {message && <p className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">{message}</p>}
              {error && <p className="mt-5 rounded-2xl border border-[#ef233c]/30 bg-[#ef233c]/10 p-4 text-sm text-[#ffb3bb]">{error}</p>}
            </section>

            <aside className="grid gap-5">
              {subscription && (
                <div className="rounded-[28px] border border-white/[0.08] bg-[#101010] p-6">
                  <div className="flex items-center gap-3">
                    <QrCode className="h-5 w-5 text-[#ff2b3a]" />
                    <h2 className="text-xl font-semibold">QR-код</h2>
                  </div>
                  <img
                    alt="Subscription QR"
                    className="mt-5 aspect-square w-full rounded-2xl bg-white p-4"
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(subscription.public_subscription_url)}`}
                  />
                </div>
              )}
              <div className="rounded-[28px] border border-white/[0.08] bg-[#101010] p-6">
                <h2 className="text-xl font-semibold">Инструкции</h2>
                <div className="mt-5 grid gap-3">
                  <InstructionLink href="/instructions/iphone" label="iPhone" />
                  <InstructionLink href="/instructions/android" label="Android" />
                  <InstructionLink href="/instructions/windows" label="Windows" />
                </div>
              </div>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}

function AuthModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 rounded-lg px-2 transition ${active ? "bg-[#ef233c] text-white" : "text-white/56 hover:text-white"}`}
    >
      {label}
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4">
      <p className="text-xs text-white/45">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function InstructionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-black/25 p-4 text-sm font-bold">
      {label}
      <Check className="h-4 w-4 text-[#ff2b3a]" />
    </Link>
  );
}

function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "http://127.0.0.1:8012";
  }
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
