"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

const ACCENT = "#E5402C";
const SUCCESS = "#1FB46A";
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
  qr_image_base64: string | null;
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
  { value: "smart",   title: "Smart Russia", text: "Локальные сервисы напрямую, зарубежные через защищённый туннель." },
  { value: "privacy", title: "Privacy",       text: "Почти весь трафик идёт через защищённый туннель." },
  { value: "global",  title: "Global",        text: "Для поездок и нестабильных сетей." },
];

const repairSteps: Record<string, string[]> = {
  telegram:  ["Проверьте, выключен ли proxy внутри Telegram.", "Обновите подписку в VPN-приложении.", "Попробуйте режим Privacy.", "Если не помогло, напишите в поддержку."],
  offline:   ["Проверьте интернет без VPN.", "Обновите подписку.", "Выберите другой профиль.", "Проверьте срок подписки в кабинете."],
  slow:      ["Смените профиль в приложении.", "Попробуйте режим Smart Russia.", "Отключите лишние фоновые загрузки.", "Если скорость не восстановилась, напишите в поддержку."],
  iphone:    ["Используйте Happ или V2RayTun.", "Выберите Reality-профиль.", "Не используйте Hysteria как основной профиль.", "Обновите подписку."],
  local:     ["Включите Smart Russia.", "Обновите подписку.", "Перезапустите VPN-клиент.", "Если банк или маркетплейс не открылся, напишите в поддержку."],
  import:    ["Откройте raw subscription link.", "Скопируйте ссылку полностью.", "Добавьте подписку заново.", "Проверьте, что клиент поддерживает subscription import."],
  unknown:   ["Обновите подписку.", "Смените режим.", "Проверьте инструкцию для вашего устройства.", "Опишите проблему поддержке."],
};

const repairLabels: [string, string][] = [
  ["telegram", "Telegram не работает"],
  ["offline",  "Всё не открывается"],
  ["slow",     "Медленно"],
  ["iphone",   "iPhone пишет «Соединение…»"],
  ["local",    "Ozon / банк не открывается"],
  ["import",   "Подписка не импортируется"],
  ["unknown",  "Не знаю, что выбрать"],
];

/* ─── Shared shell ───────────────────────────────────────────────── */

function CabinetShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: "#EEEBE3", color: "#14130F", minHeight: "100vh", fontFamily: "'Onest',sans-serif", WebkitFontSmoothing: "antialiased" }}>
      {/* Nav */}
      <header style={{ borderBottom: "1px solid rgba(20,19,15,.08)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "18px 36px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <Link href="/" style={{ fontWeight: 700, fontSize: 19, letterSpacing: "-.02em", display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: ACCENT, display: "inline-block" }} />
            Arvexo Connect
          </Link>
          <nav style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {[
              { href: "/cabinet",          label: "Кабинет" },
              { href: "/cabinet/orders",   label: "Заказы" },
              { href: "/cabinet/settings", label: "Настройки" },
              { href: "/cabinet/support",  label: "Поддержка" },
            ].map((l) => (
              <Link key={l.href} href={l.href} style={{ fontSize: 14, fontWeight: 500, color: "#57534B" }}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 36px 80px" }}>
        <h1 style={{ fontWeight: 700, fontSize: "clamp(26px,3vw,36px)", letterSpacing: "-.03em", marginBottom: 32 }}>
          {title}
        </h1>
        {children}
      </main>

      <footer style={{ borderTop: "1px solid rgba(20,19,15,.08)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 36px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#A39E93" }}>© 2026 Arvexo</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#A39E93" }}>connect.arvexo.ru</span>
        </div>
      </footer>
    </div>
  );
}

/* ─── Orders ─────────────────────────────────────────────────────── */

export function OrdersApp() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [deletingOrderId, setDeletingOrderId] = useState("");

  useEffect(() => { void loadOrders(); }, []);

  async function loadOrders() {
    const jwt = requireJwt();
    if (!jwt) return;
    try {
      const body = await fetch(`${getApiBase()}/api/cabinet/orders`, {
        headers: { Authorization: `Bearer ${jwt}` },
      }).then(checkAuth);
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

  const statusLabel: Record<string, string> = {
    pending: "Ожидает оплаты", waiting_confirmation: "На проверке", paid: "Оплачен", cancelled: "Отменён",
  };

  return (
    <CabinetShell title="История заказов">
      {error && <Notice tone="error">{error}</Notice>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {orders.map((order) => (
          <div key={order.id} style={{ background: "#FBFAF7", border: "1px solid rgba(20,19,15,.09)", borderRadius: 16, padding: "24px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: 16 }}>{order.plan_name || "Order"}</p>
                <p style={{ marginTop: 4, fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: "#8A857B" }}>
                  {new Date(order.created_at).toLocaleString("ru-RU")}
                </p>
              </div>
              <span style={{
                display: "inline-flex", padding: "5px 14px", borderRadius: 100,
                fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600,
                background: order.status === "paid" ? "rgba(31,180,106,.1)" : "rgba(20,19,15,.07)",
                color: order.status === "paid" ? SUCCESS : "#57534B",
              }}>
                {statusLabel[order.status] || order.status}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }} className="order-grid">
              <InfoTile label="Цена" value={formatMoney(order.amount, order.currency)} />
              <InfoTile label="К оплате" value={`${order.payment_amount || order.amount} ${order.payment_currency || order.currency}`} />
              <InfoTile label="Метод" value={order.payment_method} />
              <InfoTile label="Tx / comment" value={order.tx_hash || "—"} />
              <InfoTile label="Оплачен" value={order.paid_at ? new Date(order.paid_at).toLocaleString("ru-RU") : "—"} />
            </div>
            {["pending", "waiting_confirmation"].includes(order.status) && (
              <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href={`/cabinet/checkout?order=${order.id}`}
                  style={{ display: "inline-flex", alignItems: "center", padding: "10px 22px", borderRadius: 100, background: ACCENT, color: "#fff", fontSize: 14, fontWeight: 600 }}>
                  Продолжить оплату
                </Link>
                <button
                  onClick={() => deleteOrder(order.id)}
                  disabled={deletingOrderId === order.id}
                  style={{ padding: "10px 20px", borderRadius: 100, border: "1px solid rgba(20,19,15,.14)", background: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Onest',sans-serif", opacity: deletingOrderId === order.id ? .5 : 1, color: "#57534B" }}>
                  {deletingOrderId === order.id ? "Удаляем…" : "Удалить"}
                </button>
              </div>
            )}
          </div>
        ))}
        {!orders.length && (
          <div style={{ background: "#FBFAF7", border: "1px solid rgba(20,19,15,.09)", borderRadius: 16, padding: 32, textAlign: "center", color: "#8A857B", fontSize: 15 }}>
            История заказов пока пуста.
          </div>
        )}
      </div>
      <style>{`@media (max-width: 600px) { .order-grid { grid-template-columns: 1fr 1fr !important; } }`}</style>
    </CabinetShell>
  );
}

/* ─── Settings ───────────────────────────────────────────────────── */

export function SettingsApp() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [activeKeys, setActiveKeys] = useState(0);
  const [accessKey, setAccessKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { void loadSettings(); }, []);

  async function loadSettings() {
    const jwt = requireJwt();
    if (!jwt) return;
    try {
      const body = await fetch(`${getApiBase()}/api/cabinet/settings`, {
        headers: { Authorization: `Bearer ${jwt}` },
      }).then(checkAuth);
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
    setActiveKeys((v) => v + 1);
  }

  function logout() {
    localStorage.removeItem(JWT_STORAGE_KEY);
    window.location.assign("/cabinet/login");
  }

  return (
    <CabinetShell title="Настройки">
      {error   && <Notice tone="error">{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="settings-grid">
        <Panel title="Аккаунт">
          <InfoTile label="Email" value={email || "Access key account"} />
          <label style={{ display: "grid", gap: 8, fontSize: 13, color: "#8A857B", marginTop: 16 }}>
            Display name
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{ height: 48, borderRadius: 12, border: "1px solid rgba(20,19,15,.14)", background: "#fff", padding: "0 16px", fontSize: 15, color: "#14130F", fontFamily: "'Onest',sans-serif", outline: "none" }}
            />
          </label>
          <button onClick={saveSettings} style={accentBtn}>Сохранить</button>
        </Panel>

        <Panel title="Access keys">
          <InfoTile label="Активные ключи" value={String(activeKeys)} />
          <button onClick={issueAccessKey} style={{ ...accentBtn, background: "#14130F" }}>Создать access key</button>
          {accessKey && <Notice>Новый ключ показывается один раз: <strong style={{ fontFamily: "'JetBrains Mono',monospace" }}>{accessKey}</strong></Notice>}
        </Panel>

        <Panel title="Telegram">
          <p style={{ fontSize: 14, color: "#57534B", lineHeight: 1.6 }}>
            Подключение и отключение Telegram доступно на главной странице кабинета.
          </p>
          <Link href="/cabinet" style={{ display: "inline-flex", alignItems: "center", marginTop: 16, padding: "10px 20px", borderRadius: 100, border: "1px solid rgba(20,19,15,.14)", fontSize: 14, fontWeight: 600, color: "#14130F" }}>
            Открыть кабинет
          </Link>
        </Panel>

        <Panel title="Аккаунт и доступ">
          <button onClick={logout} style={{ ...accentBtn, background: "transparent", color: "#57534B", border: "1px solid rgba(20,19,15,.14)" }}>
            Выйти
          </button>
          <p style={{ marginTop: 16, fontSize: 13, lineHeight: 1.6, color: "#8A857B" }}>
            Запрос на удаление аккаунта: напишите в поддержку, указав email или access key prefix.
          </p>
        </Panel>
      </div>
      <style>{`@media (max-width: 720px) { .settings-grid { grid-template-columns: 1fr !important; } }`}</style>
    </CabinetShell>
  );
}

/* ─── Support ────────────────────────────────────────────────────── */

export function SupportApp() {
  const [problem, setProblem] = useState("telegram");
  const steps = repairSteps[problem] || repairSteps.unknown;
  const problemLabel = repairLabels.find(([v]) => v === problem)?.[1] || "Решение";

  return (
    <CabinetShell title="Поддержка">
      <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr", gap: 16 }} className="support-grid">
        <Panel title="Arvexo Repair">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {repairLabels.map(([value, label]) => (
              <button
                key={value}
                onClick={() => setProblem(value)}
                style={{
                  background: problem === value ? `rgba(229,64,44,.08)` : "#EEEBE3",
                  border: `1px solid ${problem === value ? ACCENT : "rgba(20,19,15,.1)"}`,
                  borderRadius: 10, padding: "12px 16px", textAlign: "left",
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                  color: problem === value ? ACCENT : "#14130F",
                  fontFamily: "'Onest',sans-serif",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title={problemLabel}>
          <ol style={{ display: "flex", flexDirection: "column", gap: 10, listStyle: "none", padding: 0, margin: 0 }}>
            {steps.map((step, i) => (
              <li key={step} style={{ display: "flex", gap: 16, background: "#EEEBE3", border: "1px solid rgba(20,19,15,.09)", borderRadius: 10, padding: "16px 18px", alignItems: "flex-start" }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: ACCENT, flexShrink: 0, paddingTop: 2 }}>0{i + 1}</span>
                <span style={{ fontSize: 14, lineHeight: 1.6, color: "#3B382F" }}>{step}</span>
              </li>
            ))}
          </ol>
          <a href="https://t.me/arvexo_support" target="_blank" rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", marginTop: 20, padding: "12px 24px", borderRadius: 100, background: ACCENT, color: "#fff", fontSize: 14.5, fontWeight: 600 }}>
            Написать в поддержку
          </a>
        </Panel>
      </div>
      <style>{`@media (max-width: 720px) { .support-grid { grid-template-columns: 1fr !important; } }`}</style>
    </CabinetShell>
  );
}

/* ─── Subscription detail ────────────────────────────────────────── */

export function SubscriptionDetailApp({ token }: { token: string }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceName, setDeviceName] = useState("");
  const [deviceType, setDeviceType] = useState("iphone");
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [telegramLink, setTelegramLink] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const rawUrl = useMemo(
    () => subscription?.raw_subscription_url || `${subscription?.public_subscription_url || ""}?format=raw`,
    [subscription]
  );

  useEffect(() => {
    void loadSubscription();
    void loadTelegramStatus();
  }, [token]);

  async function loadSubscription() {
    const jwt = requireJwt();
    if (!jwt) return;
    await fetch(`${getApiBase()}/api/cabinet/subscription/${token}`, { headers: { Authorization: `Bearer ${jwt}` } })
      .then(checkAuth).then((body) => setSubscription(body)).catch(() => setSubscription(null));
    await fetch(`${getApiBase()}/api/cabinet/subscription/${token}/devices`, { headers: { Authorization: `Bearer ${jwt}` } })
      .then(checkAuth).then((body) => setDevices(body.devices || [])).catch(() => setDevices([]));
  }

  async function loadTelegramStatus() {
    const jwt = requireJwt();
    if (!jwt) return;
    const res = await fetch(`${getApiBase()}/api/cabinet/telegram/status`, { headers: { Authorization: `Bearer ${jwt}` } });
    if (res.ok) setTelegramConnected(((await res.json()) as { connected: boolean }).connected);
  }

  async function changeMode(mode: string) {
    const jwt = requireJwt();
    if (!jwt || !subscription) return;
    setError(""); setMessage("");
    const res = await fetch(`${getApiBase()}/api/cabinet/subscription/${subscription.token}/mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) { setError(await readApiError(res, "Не удалось изменить режим")); return; }
    setSubscription({ ...subscription, routing_mode: mode });
    setMessage("Режим изменён. Обновите подписку в VPN-приложении, чтобы применить.");
  }

  async function createTelegramLink() {
    const jwt = requireJwt();
    if (!jwt) return;
    setError("");
    const res = await fetch(`${getApiBase()}/api/cabinet/telegram/link-token`, { method: "POST", headers: { Authorization: `Bearer ${jwt}` } });
    if (!res.ok) { setError("Не удалось создать ссылку Telegram"); return; }
    const payload = (await res.json()) as { telegram_link_url: string };
    setTelegramLink(payload.telegram_link_url);
    window.location.assign(payload.telegram_link_url);
  }

  async function addDevice() {
    const jwt = requireJwt();
    if (!jwt || !subscription || !deviceName.trim()) return;
    setError("");
    const res = await fetch(`${getApiBase()}/api/cabinet/subscription/${subscription.token}/devices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ name: deviceName.trim(), type: deviceType }),
    });
    if (!res.ok) { setError(await readApiError(res, "Не удалось добавить устройство")); return; }
    setDeviceName("");
    await loadSubscription();
  }

  async function deleteDevice(deviceId: string) {
    const jwt = requireJwt();
    if (!jwt || !subscription) return;
    const res = await fetch(`${getApiBase()}/api/cabinet/subscription/${subscription.token}/devices/${deviceId}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${jwt}` },
    });
    if (res.ok) await loadSubscription();
  }

  return (
    <CabinetShell title="Подписка">
      {!subscription ? (
        <div style={{ background: "#FBFAF7", border: "1px solid rgba(20,19,15,.09)", borderRadius: 16, padding: 32, color: "#8A857B" }}>
          Подписка не найдена или недоступна.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Link href="/cabinet" style={{ fontSize: 14, fontWeight: 600, color: "#57534B" }}>← Все подписки</Link>

          {/* Status panel */}
          <Panel title={statusLabel(subscription.status)}>
            {subscription.status === "provisioning_failed" && <Notice tone="error">Доступ готовится, поддержка уже уведомлена.</Notice>}
            <p style={{ marginTop: 8, fontSize: 14, color: "#57534B" }}>
              {modeLabel(subscription.routing_mode)} · {subscription.days_left === null ? "без срока" : `осталось ${subscription.days_left} дней`} · {devices.length}/{subscription.device_limit} устройств
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 20, marginBottom: 20 }}>
              <button onClick={() => navigator.clipboard.writeText(rawUrl)} style={accentBtn}>Скопировать ссылку</button>
              <a href="#qr" style={{ ...outlineBtn, display: "inline-flex", alignItems: "center" }}>Показать QR</a>
              <Link href="/instructions/iphone" style={{ ...outlineBtn, display: "inline-flex", alignItems: "center" }}>Инструкция</Link>
              <Link href="/cabinet/support" style={{ ...outlineBtn, display: "inline-flex", alignItems: "center" }}>Не работает</Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }} className="sub-info-grid">
              <InfoTile label="Статус" value={subscription.status} />
              <InfoTile label="Режим" value={subscription.routing_mode} />
              <InfoTile label="Осталось" value={subscription.days_left === null ? "без срока" : `${subscription.days_left} дней`} />
              <InfoTile label="Устройства" value={`${devices.length}/${subscription.device_limit}`} />
            </div>
            {message && <Notice>{message}</Notice>}
            {error   && <Notice tone="error">{error}</Notice>}
          </Panel>

          {/* QR + URL */}
          <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr", gap: 16 }} className="qr-grid">
            <Panel title="QR-код">
              <div id="qr">
                {subscription.qr_image_base64 ? (
                  <img alt="Subscription QR" style={{ width: "100%", maxWidth: 240, borderRadius: 12, background: "#fff", padding: 12 }} src={subscription.qr_image_base64} />
                ) : (
                  <p style={{ fontSize: 13, color: "#8A857B" }}>QR недоступен</p>
                )}
              </div>
            </Panel>
            <Panel title="Subscription URL">
              <div style={{ background: "#EEEBE3", border: "1px solid rgba(20,19,15,.09)", borderRadius: 12, padding: "16px 18px", marginTop: 8 }}>
                <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#8A857B", marginBottom: 8 }}>Raw subscription URL</p>
                <p style={{ fontSize: 13, wordBreak: "break-all", color: "#3B382F", lineHeight: 1.55 }}>{rawUrl}</p>
                <button onClick={() => navigator.clipboard.writeText(rawUrl)} style={{ ...accentBtn, marginTop: 14, padding: "10px 18px" }}>Скопировать raw</button>
              </div>
            </Panel>
          </div>

          {/* Mode selector */}
          <Panel title="Режим подключения">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }} className="mode-grid">
              {modes.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => changeMode(mode.value)}
                  style={{
                    background: subscription.routing_mode === mode.value ? `rgba(229,64,44,.06)` : "#EEEBE3",
                    border: `1px solid ${subscription.routing_mode === mode.value ? ACCENT : "rgba(20,19,15,.1)"}`,
                    borderRadius: 12, padding: "18px 16px", textAlign: "left",
                    cursor: "pointer", fontFamily: "'Onest',sans-serif",
                  }}
                >
                  <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: "#14130F", marginBottom: 6 }}>{mode.title}</span>
                  <span style={{ display: "block", fontSize: 13, color: "#57534B", lineHeight: 1.5 }}>{mode.text}</span>
                </button>
              ))}
            </div>
          </Panel>

          {/* Devices + Telegram */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="dev-grid">
            <Panel title="Устройства">
              <p style={{ fontSize: 13, color: "#8A857B", marginBottom: 16 }}>{devices.length}/{subscription.device_limit}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {devices.map((device) => (
                  <div key={device.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "#EEEBE3", border: "1px solid rgba(20,19,15,.09)", borderRadius: 10, padding: "12px 16px" }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600 }}>{device.name}</p>
                      <p style={{ fontSize: 12, color: "#8A857B" }}>{device.type || "device"}{device.last_seen_at ? ` · ${new Date(device.last_seen_at).toLocaleString("ru-RU")}` : ""}</p>
                    </div>
                    <button onClick={() => deleteDevice(device.id)}
                      style={{ padding: "6px 14px", borderRadius: 100, border: "1px solid rgba(20,19,15,.14)", background: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Onest',sans-serif", color: "#57534B" }}>
                      Удалить
                    </button>
                  </div>
                ))}
                {!devices.length && <p style={{ fontSize: 13, color: "#8A857B" }}>Устройства пока не добавлены.</p>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input value={deviceName} onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="Название устройства"
                  style={{ height: 44, borderRadius: 10, border: "1px solid rgba(20,19,15,.14)", padding: "0 14px", fontSize: 14, color: "#14130F", fontFamily: "'Onest',sans-serif", outline: "none", background: "#fff" }} />
                <select value={deviceType} onChange={(e) => setDeviceType(e.target.value)}
                  style={{ height: 44, borderRadius: 10, border: "1px solid rgba(20,19,15,.14)", padding: "0 14px", fontSize: 14, color: "#14130F", fontFamily: "'Onest',sans-serif", outline: "none", background: "#fff" }}>
                  <option value="iphone">iPhone</option>
                  <option value="android">Android</option>
                  <option value="windows">Windows</option>
                  <option value="macos">macOS</option>
                  <option value="other">Другое</option>
                </select>
                <button onClick={addDevice} disabled={!deviceName.trim() || devices.length >= subscription.device_limit}
                  style={{ ...accentBtn, opacity: (!deviceName.trim() || devices.length >= subscription.device_limit) ? .5 : 1 }}>
                  Добавить устройство
                </button>
              </div>
            </Panel>

            <Panel title="Telegram">
              <p style={{ fontSize: 14, color: "#57534B", lineHeight: 1.6, marginBottom: 16 }}>
                {telegramConnected ? "Telegram подключён." : "Подключите Telegram для управления подпиской и уведомлений."}
              </p>
              {!telegramConnected && (
                <button onClick={createTelegramLink} style={accentBtn}>Подключить Telegram</button>
              )}
              {telegramLink && <a href={telegramLink} style={{ marginTop: 10, display: "block", fontSize: 13, color: "#8A857B", wordBreak: "break-all" }}>{telegramLink}</a>}
            </Panel>
          </div>

          {/* Instructions */}
          <Panel title="Как подключиться">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }} className="inst-grid">
              {[["iPhone", "/instructions/iphone"], ["Android", "/instructions/android"], ["Windows", "/instructions/windows"]].map(([label, href]) => (
                <Link key={href} href={href}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#EEEBE3", border: "1px solid rgba(20,19,15,.09)", borderRadius: 10, padding: "16px 18px", fontSize: 14, fontWeight: 600, color: "#14130F" }}>
                  {label} <span style={{ color: ACCENT }}>→</span>
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      )}
      <style>{`
        @media (max-width: 720px) { .qr-grid, .dev-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 560px) { .mode-grid, .inst-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 480px) { .sub-info-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </CabinetShell>
  );
}

/* ─── Primitives ─────────────────────────────────────────────────── */

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ background: "#FBFAF7", border: "1px solid rgba(20,19,15,.09)", borderRadius: 16, padding: "24px" }}>
      <h2 style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-.02em", marginBottom: 16 }}>{title}</h2>
      {children}
    </section>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#EEEBE3", border: "1px solid rgba(20,19,15,.09)", borderRadius: 10, padding: "12px 14px" }}>
      <p style={{ fontSize: 11.5, color: "#8A857B", marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 600, wordBreak: "break-all" }}>{value}</p>
    </div>
  );
}

function Notice({ children, tone = "success" }: { children: ReactNode; tone?: "success" | "error" }) {
  const styles =
    tone === "error"
      ? { background: "rgba(229,64,44,.08)", border: "1px solid rgba(229,64,44,.2)", color: ACCENT }
      : { background: "rgba(31,180,106,.08)", border: "1px solid rgba(31,180,106,.2)", color: "#1B9E5E" };
  return (
    <p style={{ padding: "12px 16px", borderRadius: 10, fontSize: 14, lineHeight: 1.5, marginTop: 12, ...styles }}>
      {children}
    </p>
  );
}

/* ─── Shared button styles ───────────────────────────────────────── */

const accentBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center",
  padding: "12px 24px", borderRadius: 100,
  background: ACCENT, color: "#fff",
  fontSize: 14, fontWeight: 600, border: "none",
  cursor: "pointer", fontFamily: "'Onest',sans-serif",
  marginTop: 12,
};

const outlineBtn: React.CSSProperties = {
  padding: "11px 20px", borderRadius: 100,
  border: "1px solid rgba(20,19,15,.14)",
  background: "none", color: "#14130F",
  fontSize: 14, fontWeight: 600,
};

/* ─── Helpers ────────────────────────────────────────────────────── */

function statusLabel(status: string) {
  if (status === "active")              return "Подписка активна";
  if (status === "trial")               return "Тестовая подписка";
  if (status === "expired")             return "Подписка истекла";
  if (status === "disabled")            return "Подписка отключена";
  if (status === "provisioning_failed") return "Доступ готовится";
  return status;
}

function modeLabel(mode: string) {
  if (mode === "smart")   return "Smart Russia";
  if (mode === "privacy") return "Privacy Mode";
  if (mode === "global")  return "Global Mode";
  return mode;
}

function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) return process.env.NEXT_PUBLIC_API_BASE_URL;
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname))
    return "http://127.0.0.1:8012";
  return "https://api.arvexo.ru";
}

function requireJwt() {
  const jwt = typeof window !== "undefined" ? localStorage.getItem(JWT_STORAGE_KEY) : null;
  if (!jwt) window.location.assign("/cabinet/login");
  return jwt;
}

async function checkAuth(response: Response) {
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem(JWT_STORAGE_KEY);
    window.location.assign("/cabinet/login");
    throw new Error("Unauthorized");
  }
  if (!response.ok) throw new Error("Request failed");
  return response.json();
}

async function readApiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { detail?: string | { msg?: string }[] };
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
    if (Array.isArray(body.detail) && body.detail[0]?.msg) return body.detail[0].msg;
  } catch { /* keep fallback */ }
  return fallback;
}

function formatMoney(value: string | number, currency: string) {
  const numeric = Number(value);
  if (currency === "RUB")
    return `${Number.isFinite(numeric) ? numeric.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) : value} ₽`;
  return `${value} ${currency}`;
}
