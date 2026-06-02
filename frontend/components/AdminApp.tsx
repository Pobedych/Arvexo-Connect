"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type Stats = {
  users_total: number;
  subscriptions_total: number;
  subscriptions_active: number;
  orders_total: number;
  orders_pending: number;
  orders_waiting_confirmation: number;
  orders_paid: number;
  promo_codes_active: number;
};

type User = {
  id: string;
  display_name: string | null;
  status: string;
  created_at: string;
};

type Subscription = {
  token: string;
  status: string;
  routing_mode: string;
  days_left: number | null;
  device_limit: number;
  public_subscription_url: string;
};

type Order = {
  id: string;
  status: string;
  plan_code: string | null;
  plan_name: string | null;
  amount: string;
  currency: string;
  tx_hash: string | null;
  subscription_token: string | null;
  created_at: string;
};

type PromoCode = {
  id: string;
  plan_code: string;
  plan_name: string;
  code_prefix: string;
  status: string;
  max_redemptions: number;
  redemptions_count: number;
  expires_at: string | null;
  note: string | null;
  created_at: string;
};

const ADMIN_TOKEN_KEY = "arvexo_admin_token";

export function AdminApp() {
  const [adminToken, setAdminToken] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem(ADMIN_TOKEN_KEY) || ""));
  const [tokenInput, setTokenInput] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [createdCode, setCreatedCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [promoForm, setPromoForm] = useState({ plan_code: "family", max_redemptions: 5, code_prefix: "FAMILY", note: "Family access" });

  const waitingOrders = useMemo(() => orders.filter((order) => ["pending", "waiting_confirmation"].includes(order.status)), [orders]);

  useEffect(() => {
    if (adminToken) void loadAdminData(adminToken);
  }, [adminToken]);

  function saveToken() {
    const token = tokenInput.trim();
    if (!token) return;
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    setAdminToken(token);
    setTokenInput("");
  }

  function logout() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdminToken("");
    setStats(null);
    setUsers([]);
    setSubscriptions([]);
    setOrders([]);
    setPromoCodes([]);
  }

  async function loadAdminData(token = adminToken) {
    setLoading(true);
    setError("");
    try {
      const [statsBody, usersBody, subscriptionsBody, ordersBody, promoBody] = await Promise.all([
        adminGet<Stats>("/api/admin/stats", token),
        adminGet<{ users: User[] }>("/api/admin/users", token),
        adminGet<{ subscriptions: Subscription[] }>("/api/admin/subscriptions", token),
        adminGet<{ orders: Order[] }>("/api/admin/orders", token),
        adminGet<{ promo_codes: PromoCode[] }>("/api/admin/promo-codes", token)
      ]);
      setStats(statsBody);
      setUsers(usersBody.users);
      setSubscriptions(subscriptionsBody.subscriptions);
      setOrders(ordersBody.orders);
      setPromoCodes(promoBody.promo_codes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить админку");
    } finally {
      setLoading(false);
    }
  }

  async function createPromoCode() {
    setLoading(true);
    setError("");
    setCreatedCode("");
    try {
      const response = await adminPost<{ code: string }>("/api/admin/promo-codes", adminToken, promoForm);
      setCreatedCode(response.code);
      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать промокод");
    } finally {
      setLoading(false);
    }
  }

  async function confirmOrder(orderId: string) {
    setLoading(true);
    setError("");
    try {
      await adminPost(`/api/admin/orders/${orderId}/confirm`, adminToken, {});
      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось подтвердить order");
    } finally {
      setLoading(false);
    }
  }

  if (!adminToken) {
    return (
      <main className="min-h-screen bg-[#050505] text-white">
        <section className="mx-auto grid min-h-screen w-[min(calc(100%-32px),520px)] place-items-center">
          <div className="w-full rounded-lg border border-white/[0.1] bg-[#101010] p-6">
            <p className="text-xs font-bold uppercase text-[#ff2b3a]">Admin</p>
            <h1 className="mt-3 text-3xl font-bold">Вход в админку</h1>
            <input
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              placeholder="X-Admin-Token"
              type="password"
              className="mt-6 h-12 w-full rounded-lg border border-white/[0.1] bg-black px-4 text-white outline-none focus:border-[#ef233c]"
            />
            <button onClick={saveToken} className="mt-4 min-h-12 w-full rounded-lg bg-[#ef233c] px-5 text-sm font-bold">
              Войти
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="mx-auto w-[min(calc(100%-32px),1320px)] py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-5">
          <div>
            <p className="text-xs font-bold uppercase text-[#ff2b3a]">Arvexo Connect</p>
            <h1 className="mt-2 text-3xl font-bold">Админка</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => loadAdminData()} disabled={loading} className="min-h-10 rounded-lg border border-white/[0.1] px-4 text-sm font-bold disabled:opacity-50">
              Обновить
            </button>
            <button onClick={logout} className="min-h-10 rounded-lg bg-white px-4 text-sm font-bold text-black">
              Выйти
            </button>
          </div>
        </div>

        {error && <p className="mt-5 rounded-lg border border-[#ef233c]/30 bg-[#ef233c]/10 p-3 text-sm text-[#ffb3bb]">{error}</p>}

        {stats && (
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <Stat label="Users" value={stats.users_total} />
            <Stat label="Active subs" value={stats.subscriptions_active} />
            <Stat label="Waiting orders" value={stats.orders_waiting_confirmation} />
            <Stat label="Active promos" value={stats.promo_codes_active} />
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Panel title="Промокоды">
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Plan" value={promoForm.plan_code} onChange={(value) => setPromoForm({ ...promoForm, plan_code: value })} />
              <Field label="Prefix" value={promoForm.code_prefix} onChange={(value) => setPromoForm({ ...promoForm, code_prefix: value.toUpperCase() })} />
              <label className="grid gap-2 text-xs text-white/48">
                Uses
                <input
                  value={promoForm.max_redemptions}
                  onChange={(event) => setPromoForm({ ...promoForm, max_redemptions: Number(event.target.value) || 1 })}
                  type="number"
                  min={1}
                  max={100}
                  className="h-10 rounded-lg border border-white/[0.1] bg-black px-3 text-sm text-white"
                />
              </label>
              <Field label="Note" value={promoForm.note} onChange={(value) => setPromoForm({ ...promoForm, note: value })} />
            </div>
            <button onClick={createPromoCode} disabled={loading} className="mt-4 min-h-11 rounded-lg bg-[#ef233c] px-5 text-sm font-bold disabled:opacity-50">
              Создать промокод
            </button>
            {createdCode && (
              <div className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3">
                <p className="text-xs text-emerald-100/70">Показывается один раз</p>
                <p className="mt-1 text-lg font-bold text-emerald-50">{createdCode}</p>
              </div>
            )}
            <Table
              headers={["Prefix", "Plan", "Uses", "Status", "Note"]}
              rows={promoCodes.map((promo) => [promo.code_prefix, promo.plan_code, `${promo.redemptions_count}/${promo.max_redemptions}`, promo.status, promo.note || ""])}
            />
          </Panel>

          <Panel title="Orders">
            <Table
              headers={["Status", "Plan", "Amount", "Tx", "Action"]}
              rows={orders.slice(0, 12).map((order) => [
                order.status,
                order.plan_code || "",
                `${order.amount} ${order.currency}`,
                order.tx_hash || "",
                waitingOrders.some((item) => item.id === order.id) ? (
                  <button onClick={() => confirmOrder(order.id)} className="rounded-lg bg-[#ef233c] px-3 py-2 text-xs font-bold">Confirm</button>
                ) : order.subscription_token || ""
              ])}
            />
          </Panel>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Panel title="Subscriptions">
            <Table
              headers={["Token", "Status", "Mode", "Days", "Devices"]}
              rows={subscriptions.slice(0, 12).map((sub) => [sub.token, sub.status, sub.routing_mode, sub.days_left ?? "no limit", sub.device_limit])}
            />
          </Panel>
          <Panel title="Users">
            <Table
              headers={["Name", "Status", "Created"]}
              rows={users.slice(0, 12).map((user) => [user.display_name || user.id.slice(0, 8), user.status, new Date(user.created_at).toLocaleDateString()])}
            />
          </Panel>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#101010] p-4">
      <p className="text-xs text-white/45">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-white/[0.08] bg-[#101010] p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-xs text-white/48">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-lg border border-white/[0.1] bg-black px-3 text-sm text-white" />
    </label>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (ReactNode[])[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="text-xs uppercase text-white/40">
          <tr>{headers.map((header) => <th key={header} className="border-b border-white/[0.08] py-2 pr-3">{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-white/[0.06]">
              {row.map((cell, cellIndex) => <td key={cellIndex} className="max-w-[260px] truncate py-3 pr-3 text-white/72">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function adminGet<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, { headers: { "X-Admin-Token": token } });
  return readResponse<T>(response);
}

async function adminPost<T>(path: string, token: string, body: unknown): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Token": token },
    body: JSON.stringify(body)
  });
  return readResponse<T>(response);
}

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || "Admin request failed");
  }
  return response.json() as Promise<T>;
}

function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) return process.env.NEXT_PUBLIC_API_BASE_URL;
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) return "http://127.0.0.1:8012";
  return "https://api.arvexo.ru";
}
