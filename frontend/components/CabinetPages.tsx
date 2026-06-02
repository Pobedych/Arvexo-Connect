"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

const JWT_STORAGE_KEY = "arvexo_cabinet_jwt";

type Order = {
  id: string;
  status: string;
  plan_name: string | null;
  amount: string;
  currency: string;
  payment_method: string;
  tx_hash: string | null;
  subscription_token: string | null;
  created_at: string;
  paid_at: string | null;
};

type Subscription = {
  token: string;
  status: string;
  routing_mode: string;
  expires_at: string | null;
  days_left: number | null;
  device_limit: number;
  public_subscription_url: string;
};

type Device = {
  id: string;
  name: string | null;
  type: string | null;
  created_at: string;
};

const repairSteps: Record<string, string[]> = {
  telegram: ["Проверьте, выключен ли proxy внутри Telegram.", "Обновите подписку в VPN-приложении.", "Попробуйте режим Privacy.", "Если не помогло, напишите в поддержку."],
  offline: ["Проверьте интернет без VPN.", "Обновите подписку.", "Выберите другой профиль.", "Проверьте срок подписки в кабинете."],
  slow: ["Смените профиль в приложении.", "Попробуйте режим Smart Russia.", "Отключите лишние фоновые загрузки.", "Если скорость не восстановилась, напишите в поддержку."],
  iphone: ["Используйте Happ или V2RayTun.", "Выберите Reality-профиль.", "Не используйте Hysteria как основной профиль.", "Обновите подписку."],
  local: ["Включите Smart Russia.", "Обновите подписку.", "Перезапустите VPN-клиент.", "Если банк или маркетплейс не открылся, напишите в поддержку."],
  import: ["Откройте raw subscription link.", "Скопируйте ссылку полностью.", "Добавьте подписку заново.", "Проверьте, что клиент поддерживает subscription import."],
  unknown: ["Обновите подписку.", "Смените режим.", "Проверьте инструкцию для вашего устройства.", "Опишите проблему поддержке."],
};

const repairLabels = [
  ["telegram", "Telegram не работает"],
  ["offline", "Всё не открывается"],
  ["slow", "Медленно"],
  ["iphone", "iPhone пишет “Соединение…”"],
  ["local", "Ozon/банк не открывается"],
  ["import", "Подписка не импортируется"],
  ["unknown", "Не знаю, что выбрать"],
];

export function OrdersApp() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const jwt = requireJwt();
    if (!jwt) return;
    fetch(`${getApiBase()}/api/cabinet/orders`, { headers: { Authorization: `Bearer ${jwt}` } })
      .then(checkAuth)
      .then((body) => setOrders(body.orders || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить заказы"));
  }, []);

  return (
    <CabinetShell title="Заказы">
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid gap-3">
        {orders.map((order) => (
          <div key={order.id} className="rounded-lg border border-white/[0.08] bg-[#101010] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">{order.plan_name || "Order"}</p>
                <p className="mt-1 text-xs text-white/45">{new Date(order.created_at).toLocaleString()}</p>
              </div>
              <span className="text-sm font-bold text-[#ffb3bb]">{order.status}</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <Info label="Сумма" value={`${order.amount} ${order.currency}`} />
              <Info label="Метод" value={order.payment_method} />
              <Info label="Tx / comment" value={order.tx_hash || "не отправлен"} />
              <Info label="Оплачен" value={order.paid_at ? new Date(order.paid_at).toLocaleString() : "нет"} />
            </div>
            {["pending", "waiting_confirmation"].includes(order.status) && (
              <Link href={`/cabinet/checkout?order=${order.id}`} className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-[#ef233c] px-4 text-sm font-bold">
                Продолжить оплату
              </Link>
            )}
          </div>
        ))}
        {!orders.length && <Empty text="История заказов пока пуста." />}
      </div>
    </CabinetShell>
  );
}

export function SettingsApp() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [activeKeys, setActiveKeys] = useState(0);
  const [accessKey, setAccessKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings() {
    const jwt = requireJwt();
    if (!jwt) return;
    try {
      const body = await fetch(`${getApiBase()}/api/cabinet/settings`, { headers: { Authorization: `Bearer ${jwt}` } }).then(checkAuth);
      setDisplayName(body.display_name || "");
      setEmail(body.email || "");
      setActiveKeys(body.active_access_keys || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить настройки");
    }
  }

  async function saveSettings() {
    const jwt = requireJwt();
    if (!jwt) return;
    const body = await fetch(`${getApiBase()}/api/cabinet/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ display_name: displayName }),
    }).then(checkAuth);
    setDisplayName(body.display_name || "");
    setMessage("Настройки сохранены.");
  }

  async function issueAccessKey() {
    const jwt = requireJwt();
    if (!jwt) return;
    const body = await fetch(`${getApiBase()}/api/cabinet/access-keys`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
    }).then(checkAuth);
    setAccessKey(body.access_key);
    setActiveKeys((value) => value + 1);
  }

  function logout() {
    localStorage.removeItem(JWT_STORAGE_KEY);
    window.location.assign("/cabinet/login");
  }

  return (
    <CabinetShell title="Настройки">
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Аккаунт">
          <Info label="Email" value={email || "Access key account"} />
          <label className="mt-4 grid gap-2 text-sm text-white/56">
            Display name
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="h-12 rounded-lg border border-white/[0.1] bg-black px-4 text-white" />
          </label>
          <button onClick={saveSettings} className="mt-4 min-h-11 rounded-lg bg-[#ef233c] px-4 text-sm font-bold">Сохранить</button>
        </Panel>
        <Panel title="Access keys">
          <Info label="Активные ключи" value={String(activeKeys)} />
          <button onClick={issueAccessKey} className="mt-4 min-h-11 rounded-lg bg-white px-4 text-sm font-bold text-black">Создать access key</button>
          {accessKey && <Notice>Новый ключ показывается один раз: {accessKey}</Notice>}
        </Panel>
        <Panel title="Telegram">
          <p className="text-sm leading-6 text-white/56">Подключение и отключение Telegram доступно на главной странице кабинета.</p>
          <Link href="/cabinet" className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-white/[0.12] px-4 text-sm font-bold">Открыть кабинет</Link>
        </Panel>
        <Panel title="Аккаунт и доступ">
          <button onClick={logout} className="min-h-11 rounded-lg border border-white/[0.12] px-4 text-sm font-bold">Выйти</button>
          <p className="mt-4 text-sm leading-6 text-white/45">Запрос на удаление аккаунта: напишите в поддержку, указав email или access key prefix.</p>
        </Panel>
      </div>
    </CabinetShell>
  );
}

export function SupportApp() {
  const [problem, setProblem] = useState("telegram");
  const steps = repairSteps[problem] || repairSteps.unknown;

  return (
    <CabinetShell title="Поддержка">
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Arvexo Repair">
          <div className="grid gap-2">
            {repairLabels.map(([value, label]) => (
              <button
                key={value}
                onClick={() => setProblem(value)}
                className={`rounded-lg border p-3 text-left text-sm font-bold ${problem === value ? "border-[#ef233c] bg-[#ef233c]/10" : "border-white/[0.08] bg-black/25"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </Panel>
        <Panel title={repairLabels.find(([value]) => value === problem)?.[1] || "Решение"}>
          <ol className="grid gap-3">
            {steps.map((step, index) => (
              <li key={step} className="rounded-lg border border-white/[0.08] bg-black/25 p-4 text-sm leading-6 text-white/72">
                {index + 1}. {step}
              </li>
            ))}
          </ol>
          <a href="https://t.me/arvexo_support" target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-[#ef233c] px-4 text-sm font-bold">
            Написать в поддержку
          </a>
        </Panel>
      </div>
    </CabinetShell>
  );
}

export function SubscriptionDetailApp({ token }: { token: string }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const rawUrl = useMemo(() => `${subscription?.public_subscription_url || ""}?format=raw`, [subscription]);

  useEffect(() => {
    const jwt = requireJwt();
    if (!jwt) return;
    fetch(`${getApiBase()}/api/cabinet/subscription/${token}`, { headers: { Authorization: `Bearer ${jwt}` } })
      .then(checkAuth)
      .then((body) => setSubscription(body))
      .catch(() => setSubscription(null));
    fetch(`${getApiBase()}/api/cabinet/subscription/${token}/devices`, { headers: { Authorization: `Bearer ${jwt}` } })
      .then(checkAuth)
      .then((body) => setDevices(body.devices || []))
      .catch(() => setDevices([]));
  }, [token]);

  return (
    <CabinetShell title="Подписка">
      {!subscription ? (
        <Empty text="Подписка не найдена или недоступна." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_0.7fr]">
          <Panel title={subscription.token}>
            {subscription.status === "provisioning_failed" && <Notice tone="error">Доступ готовится, поддержка уже уведомлена.</Notice>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Статус" value={subscription.status} />
              <Info label="Режим" value={subscription.routing_mode} />
              <Info label="Осталось" value={subscription.days_left === null ? "без срока" : `${subscription.days_left} дней`} />
              <Info label="Устройства" value={`${devices.length}/${subscription.device_limit}`} />
            </div>
            <div className="mt-5 rounded-lg border border-white/[0.08] bg-black/25 p-4">
              <p className="text-xs text-white/45">Raw subscription</p>
              <p className="mt-2 break-all text-sm text-white/72">{rawUrl}</p>
              <button onClick={() => navigator.clipboard.writeText(rawUrl)} className="mt-4 min-h-10 rounded-lg bg-[#ef233c] px-4 text-sm font-bold">Скопировать raw</button>
            </div>
          </Panel>
          <Panel title="QR">
            <img alt="Subscription QR" className="aspect-square w-full rounded-lg bg-white p-4" src={`https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(rawUrl)}`} />
          </Panel>
        </div>
      )}
    </CabinetShell>
  );
}

function CabinetShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#050505] px-4 py-8 text-white">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-6">
          <Link href="/cabinet" className="text-lg font-semibold">Arvexo Connect</Link>
          <nav className="flex flex-wrap gap-2 text-sm font-bold text-white/64">
            <Link href="/cabinet">Кабинет</Link>
            <Link href="/cabinet/orders">Заказы</Link>
            <Link href="/cabinet/settings">Настройки</Link>
            <Link href="/cabinet/support">Поддержка</Link>
          </nav>
        </header>
        <h1 className="mt-8 text-3xl font-bold">{title}</h1>
        <div className="mt-6">{children}</div>
      </section>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-white/[0.08] bg-[#101010] p-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-black/25 p-4">
      <p className="text-xs text-white/45">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}

function Notice({ children, tone = "success" }: { children: ReactNode; tone?: "success" | "error" }) {
  return (
    <p className={`mt-4 rounded-lg border p-3 text-sm ${tone === "error" ? "border-[#ef233c]/30 bg-[#ef233c]/10 text-[#ffb3bb]" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"}`}>
      {children}
    </p>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-white/[0.08] bg-[#101010] p-5 text-sm text-white/56">{text}</div>;
}

function requireJwt() {
  const jwt = localStorage.getItem(JWT_STORAGE_KEY);
  if (!jwt) {
    window.location.assign("/cabinet/login");
    return "";
  }
  return jwt;
}

async function checkAuth(response: Response) {
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem(JWT_STORAGE_KEY);
    window.location.assign("/cabinet/login");
    throw new Error("Нужно войти заново");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || "API request failed");
  }
  return response.json();
}

function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) return process.env.NEXT_PUBLIC_API_BASE_URL;
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) return "http://127.0.0.1:8012";
  return "https://api.arvexo.ru";
}
