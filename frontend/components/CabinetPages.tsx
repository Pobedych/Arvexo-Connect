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
  payment_amount: string | null;
  payment_currency: string | null;
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
  devices_used: number;
  plan_name: string | null;
  public_subscription_url: string;
  raw_subscription_url: string;
};

type Device = {
  id: string;
  name: string | null;
  type: string | null;
  is_active?: boolean;
  source?: string | null;
  user_agent?: string | null;
  last_seen_at?: string | null;
  created_at: string;
};

const modes = [
  { value: "smart", title: "Smart Russia", text: "Локальные сервисы напрямую, зарубежные через защищённый туннель." },
  { value: "privacy", title: "Privacy", text: "Почти весь трафик идёт через защищённый туннель." },
  { value: "global", title: "Global", text: "Для поездок и нестабильных сетей." },
];

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
  const [deletingOrderId, setDeletingOrderId] = useState("");

  useEffect(() => {
    void loadOrders();
  }, []);

  async function loadOrders() {
    const jwt = requireJwt();
    if (!jwt) return;
    try {
      const body = await fetch(`${getApiBase()}/api/cabinet/orders`, { headers: { Authorization: `Bearer ${jwt}` } }).then(checkAuth);
      setOrders(body.orders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить заказы");
    }
  }

  async function deleteOrder(orderId: string) {
    if (!window.confirm("Удалить неоплаченный заказ?")) return;
    const jwt = requireJwt();
    if (!jwt) return;
    setDeletingOrderId(orderId);
    setError("");
    try {
      await fetch(`${getApiBase()}/api/cabinet/orders/${orderId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${jwt}` },
      }).then(checkAuth);
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить заказ");
    } finally {
      setDeletingOrderId("");
    }
  }

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
              <Info label="Цена" value={formatMoney(order.amount, order.currency)} />
              <Info label="К оплате" value={`${order.payment_amount || order.amount} ${order.payment_currency || order.currency}`} />
              <Info label="Метод" value={order.payment_method} />
              <Info label="Tx / comment" value={order.tx_hash || "не отправлен"} />
              <Info label="Оплачен" value={order.paid_at ? new Date(order.paid_at).toLocaleString() : "нет"} />
            </div>
            {["pending", "waiting_confirmation"].includes(order.status) && (
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={`/cabinet/checkout?order=${order.id}`} className="inline-flex min-h-10 items-center rounded-lg bg-[#ef233c] px-4 text-sm font-bold">
                  Продолжить оплату
                </Link>
                <button
                  onClick={() => deleteOrder(order.id)}
                  disabled={deletingOrderId === order.id}
                  className="min-h-10 rounded-lg border border-white/[0.12] px-4 text-sm font-bold text-white/72 disabled:opacity-50"
                >
                  {deletingOrderId === order.id ? "Удаляем..." : "Удалить"}
                </button>
              </div>
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
  const [deviceName, setDeviceName] = useState("");
  const [deviceType, setDeviceType] = useState("iphone");
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [telegramLink, setTelegramLink] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const rawUrl = useMemo(() => subscription?.raw_subscription_url || `${subscription?.public_subscription_url || ""}?format=raw`, [subscription]);

  useEffect(() => {
    void loadSubscription();
    void loadTelegramStatus();
  }, [token]);

  async function loadSubscription() {
    const jwt = requireJwt();
    if (!jwt) return;
    await fetch(`${getApiBase()}/api/cabinet/subscription/${token}`, { headers: { Authorization: `Bearer ${jwt}` } })
      .then(checkAuth)
      .then((body) => setSubscription(body))
      .catch(() => setSubscription(null));
    await fetch(`${getApiBase()}/api/cabinet/subscription/${token}/devices`, { headers: { Authorization: `Bearer ${jwt}` } })
      .then(checkAuth)
      .then((body) => setDevices(body.devices || []))
      .catch(() => setDevices([]));
  }

  async function loadTelegramStatus() {
    const jwt = requireJwt();
    if (!jwt) return;
    const response = await fetch(`${getApiBase()}/api/cabinet/telegram/status`, { headers: { Authorization: `Bearer ${jwt}` } });
    if (response.ok) {
      const payload = (await response.json()) as { connected: boolean };
      setTelegramConnected(payload.connected);
    }
  }

  async function changeMode(mode: string) {
    const jwt = requireJwt();
    if (!jwt || !subscription) return;
    setError("");
    setMessage("");
    const response = await fetch(`${getApiBase()}/api/cabinet/subscription/${subscription.token}/mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ mode }),
    });
    if (!response.ok) {
      setError(await readApiError(response, "Не удалось изменить режим"));
      return;
    }
    setSubscription({ ...subscription, routing_mode: mode });
    setMessage("Режим изменён. Чтобы применить его, обновите подписку в VPN-приложении.");
  }

  async function createTelegramLink() {
    const jwt = requireJwt();
    if (!jwt) return;
    setError("");
    const response = await fetch(`${getApiBase()}/api/cabinet/telegram/link-token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!response.ok) {
      setError("Не удалось создать ссылку Telegram");
      return;
    }
    const payload = (await response.json()) as { telegram_link_url: string };
    setTelegramLink(payload.telegram_link_url);
    window.location.assign(payload.telegram_link_url);
  }

  async function addDevice() {
    const jwt = requireJwt();
    if (!jwt || !subscription || !deviceName.trim()) return;
    setError("");
    const response = await fetch(`${getApiBase()}/api/cabinet/subscription/${subscription.token}/devices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ name: deviceName.trim(), type: deviceType }),
    });
    if (!response.ok) {
      setError(await readApiError(response, "Не удалось добавить устройство"));
      return;
    }
    setDeviceName("");
    await loadSubscription();
  }

  async function deleteDevice(deviceId: string) {
    const jwt = requireJwt();
    if (!jwt || !subscription) return;
    const response = await fetch(`${getApiBase()}/api/cabinet/subscription/${subscription.token}/devices/${deviceId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (response.ok) await loadSubscription();
  }

  return (
    <CabinetShell title="Подписка">
      {!subscription ? (
        <Empty text="Подписка не найдена или недоступна." />
      ) : (
        <div className="grid gap-5">
          <Link href="/cabinet" className="text-sm font-bold text-white/60 hover:text-white">← Все подписки</Link>
          <Panel title={subscription.status === "active" ? "Подписка активна" : statusLabel(subscription.status)}>
            {subscription.status === "provisioning_failed" && <Notice tone="error">Доступ готовится, поддержка уже уведомлена.</Notice>}
            <p className="mt-3 text-sm text-white/56">
              {modeLabel(subscription.routing_mode)} · {subscription.days_left === null ? "без срока" : `осталось ${subscription.days_left} дней`} · {devices.length}/{subscription.device_limit} устройств
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={() => navigator.clipboard.writeText(rawUrl)} className="min-h-11 rounded-lg bg-[#ef233c] px-4 text-sm font-bold">Скопировать ссылку</button>
              <a href="#qr" className="inline-flex min-h-11 items-center rounded-lg border border-white/[0.12] px-4 text-sm font-bold">Показать QR</a>
              <Link href="/instructions/iphone" className="inline-flex min-h-11 items-center rounded-lg border border-white/[0.12] px-4 text-sm font-bold">Инструкция</Link>
              <Link href="/cabinet/support" className="inline-flex min-h-11 items-center rounded-lg border border-white/[0.12] px-4 text-sm font-bold">Не работает</Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Статус" value={subscription.status} />
              <Info label="Режим" value={subscription.routing_mode} />
              <Info label="Осталось" value={subscription.days_left === null ? "без срока" : `${subscription.days_left} дней`} />
              <Info label="Устройства" value={`${devices.length}/${subscription.device_limit}`} />
            </div>
            {message && <Notice>{message}</Notice>}
            {error && <Notice tone="error">{error}</Notice>}
          </Panel>

          <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <Panel title="QR-код" >
              <div id="qr">
                <img alt="Subscription QR" className="aspect-square w-full max-w-sm rounded-lg bg-white p-4" src={`https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(rawUrl)}`} />
              </div>
            </Panel>
            <Panel title="Subscription URL">
            <div className="mt-5 rounded-lg border border-white/[0.08] bg-black/25 p-4">
              <p className="text-xs text-white/45">Raw subscription</p>
              <p className="mt-2 break-all text-sm text-white/72">{rawUrl}</p>
              <button onClick={() => navigator.clipboard.writeText(rawUrl)} className="mt-4 min-h-10 rounded-lg bg-[#ef233c] px-4 text-sm font-bold">Скопировать raw</button>
            </div>
            </Panel>
          </div>

          <Panel title="Режим подключения">
            <div className="grid gap-3 md:grid-cols-3">
              {modes.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => changeMode(mode.value)}
                  className={`rounded-lg border p-4 text-left ${subscription.routing_mode === mode.value ? "border-[#ef233c] bg-[#ef233c]/12" : "border-white/[0.08] bg-black/25 hover:border-[#ef233c]/45"}`}
                >
                  <span className="text-base font-semibold">{mode.title}</span>
                  <span className="mt-2 block text-sm leading-5 text-white/56">{mode.text}</span>
                </button>
              ))}
            </div>
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Устройства">
              <p className="text-sm text-white/48">{devices.length}/{subscription.device_limit}</p>
              <div className="mt-4 grid gap-2">
                {devices.map((device) => (
                  <div key={device.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-black/25 p-3">
                    <div>
                      <p className="text-sm font-bold">{device.name}</p>
                      <p className="text-xs text-white/45">{device.type || "device"}{device.last_seen_at ? ` · ${new Date(device.last_seen_at).toLocaleString()}` : ""}</p>
                    </div>
                    <button onClick={() => deleteDevice(device.id)} className="rounded-lg border border-white/[0.1] px-3 py-2 text-xs font-bold">Удалить</button>
                  </div>
                ))}
                {!devices.length && <p className="text-sm text-white/45">Устройства пока не добавлены.</p>}
              </div>
              <div className="mt-4 grid gap-2">
                <input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} placeholder="Название устройства" className="h-11 rounded-lg border border-white/[0.1] bg-black px-3 text-sm text-white outline-none focus:border-[#ef233c]" />
                <select value={deviceType} onChange={(event) => setDeviceType(event.target.value)} className="h-11 rounded-lg border border-white/[0.1] bg-black px-3 text-sm text-white outline-none focus:border-[#ef233c]">
                  <option value="iphone">iPhone</option>
                  <option value="android">Android</option>
                  <option value="windows">Windows</option>
                  <option value="macos">macOS</option>
                  <option value="other">Другое</option>
                </select>
                <button onClick={addDevice} disabled={!deviceName.trim() || devices.length >= subscription.device_limit} className="min-h-11 rounded-lg bg-white px-4 text-sm font-bold text-black disabled:opacity-50">Добавить устройство</button>
              </div>
            </Panel>

            <Panel title="Telegram">
              <p className="text-sm text-white/56">{telegramConnected ? "Telegram подключён." : "Подключите Telegram для управления подпиской и уведомлений."}</p>
              {!telegramConnected && <button onClick={createTelegramLink} className="mt-4 min-h-11 rounded-lg bg-[#ef233c] px-4 text-sm font-bold">Подключить Telegram</button>}
              {telegramLink && <a href={telegramLink} className="mt-3 block break-all text-sm font-semibold text-[#ffb3bb]">{telegramLink}</a>}
            </Panel>
          </div>

          <Panel title="Как подключиться">
            <div className="grid gap-3 sm:grid-cols-3">
              <InstructionLink href="/instructions/iphone" label="iPhone" />
              <InstructionLink href="/instructions/android" label="Android" />
              <InstructionLink href="/instructions/windows" label="Windows" />
            </div>
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

function InstructionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-black/25 p-4 text-sm font-bold hover:border-[#ef233c]/45">
      {label}
      <span className="text-[#ff2b3a]">→</span>
    </Link>
  );
}

function statusLabel(status: string) {
  if (status === "active") return "Подписка активна";
  if (status === "trial") return "Тестовая подписка";
  if (status === "expired") return "Подписка истекла";
  if (status === "disabled") return "Подписка отключена";
  if (status === "provisioning_failed") return "Доступ готовится";
  return status;
}

function modeLabel(mode: string) {
  if (mode === "smart") return "Smart Russia";
  if (mode === "privacy") return "Privacy Mode";
  if (mode === "global") return "Global Mode";
  return mode;
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

function formatMoney(value: string | number, currency: string) {
  const numeric = Number(value);
  if (currency === "RUB") return `${Number.isFinite(numeric) ? numeric.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) : value} ₽`;
  return `${value} ${currency}`;
}

async function readApiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { detail?: string | { msg?: string }[] };
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
    if (Array.isArray(body.detail) && body.detail[0]?.msg) return body.detail[0].msg;
  } catch {
    // Keep fallback when the API did not return JSON.
  }
  return fallback;
}
