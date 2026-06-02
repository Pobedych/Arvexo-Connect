"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Order = {
  id: string;
  status: string;
  plan_name: string | null;
  amount: string;
  currency: string;
  payment_method: string;
  payment_url: string | null;
  qr_payload: string | null;
  qr_image_base64: string | null;
  payment_recipient: string | null;
  crypto_network: string | null;
  crypto_address: string | null;
  crypto_amount: string | null;
  tx_hash: string | null;
  subscription_token: string | null;
};

const JWT_STORAGE_KEY = "arvexo_cabinet_jwt";

export function CheckoutApp() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderId, setOrderId] = useState("");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const order = useMemo(() => orders.find((item) => item.id === orderId) || orders[0], [orders, orderId]);

  useEffect(() => {
    setOrderId(new URLSearchParams(window.location.search).get("order") || "");
    loadOrders();
  }, []);

  async function loadOrders() {
    const jwt = localStorage.getItem(JWT_STORAGE_KEY);
    if (!jwt) {
      window.location.assign("/cabinet/login");
      return;
    }
    const response = await fetch(`${getApiBase()}/api/cabinet/orders`, { headers: { Authorization: `Bearer ${jwt}` } });
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem(JWT_STORAGE_KEY);
      window.location.assign("/cabinet/login");
      return;
    }
    const body = await response.json();
    setOrders(body.orders || []);
  }

  async function submitPayment() {
    if (!order) return;
    const jwt = localStorage.getItem(JWT_STORAGE_KEY);
    if (!jwt) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${getApiBase()}/api/cabinet/orders/${order.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ tx_hash: txHash.trim() })
      });
      if (!response.ok) throw new Error("Не удалось отправить tx hash");
      setMessage("Ваш платеж отправлен на проверку. После подтверждения доступ будет активирован.");
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить tx hash");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="mx-auto w-[min(calc(100%-32px),920px)] py-10">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-6">
          <Link href="/cabinet/plans" className="text-sm font-semibold text-white/60 hover:text-white">Тарифы</Link>
          <span className="text-xs font-bold uppercase text-[#ff2b3a]">Checkout</span>
        </div>
        {!order ? (
          <div className="mt-10 rounded-lg border border-white/[0.1] bg-[#101010] p-6">
            <p className="text-white/60">Orders пока нет.</p>
          </div>
        ) : (
          <div className="mt-10 rounded-lg border border-white/[0.1] bg-[#101010] p-6">
            <p className="text-xs font-bold uppercase text-[#ff2b3a]">
              {order.payment_method === "sbp_manual" ? "SBP manual" : `Оплата USDT ${order.crypto_network || ""}`}
            </p>
            <h1 className="mt-3 text-3xl font-bold">{order.plan_name || "Order"}</h1>
            <div className="mt-6 grid gap-4">
              <Info label="Статус" value={order.status} />
              <Info label="Сумма" value={`${order.crypto_amount || order.amount} ${order.currency}`} />
              {order.payment_method === "sbp_manual" ? (
                <>
                  <Info label="Получатель" value={order.payment_recipient || "SBP_PAYMENT_RECIPIENT не задан"} />
                  <Info label="Назначение" value={`Arvexo Connect order ${order.id}`} />
                  {order.payment_url && <Info label="Ссылка оплаты" value={order.payment_url} />}
                  {order.qr_payload && <Info label="QR payload" value={order.qr_payload} />}
                </>
              ) : (
                <>
                  <Info label="Сеть" value={order.crypto_network || "Нужно настроить"} />
                  <Info label="Адрес" value={order.crypto_address || "CRYPTO_PAYMENT_ADDRESS не задан"} />
                </>
              )}
            </div>
            {order.qr_image_base64 && (
              <img alt="Payment QR" className="mt-6 w-56 rounded-lg bg-white p-3" src={`data:image/png;base64,${order.qr_image_base64}`} />
            )}
            <div className="mt-6 grid gap-3">
              <input
                value={txHash}
                onChange={(event) => setTxHash(event.target.value)}
                placeholder={order.payment_method === "sbp_manual" ? "Комментарий / ID перевода" : "tx hash"}
                className="h-12 rounded-lg border border-white/[0.1] bg-black px-4 text-white outline-none focus:border-[#ef233c]"
              />
              <button disabled={loading || txHash.trim().length < 6} onClick={submitPayment} className="min-h-12 rounded-lg bg-[#ef233c] px-5 text-sm font-bold disabled:opacity-50">
                {loading ? "Отправляем..." : "Я оплатил"}
              </button>
              {message && <p className="text-sm text-white/64">{message}</p>}
              {error && <p className="text-sm text-[#ff2b3a]">{error}</p>}
            </div>
          </div>
        )}
      </section>
    </main>
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

function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) return process.env.NEXT_PUBLIC_API_BASE_URL;
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) return "http://127.0.0.1:8012";
  return "https://api.arvexo.ru";
}
