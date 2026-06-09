"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type Order = {
  id: string;
  status: string;
  plan_name: string | null;
  amount: string;
  currency: string;
  payment_amount: string | null;
  payment_currency: string | null;
  payment_method: string;
  payment_url: string | null;
  qr_payload: string | null;
  qr_image_base64: string | null;
  payment_recipient: string | null;
  crypto_network: string | null;
  crypto_address: string | null;
  crypto_amount: string | null;
  tx_hash: string | null;
  payment_reference: string | null;
  payment_purpose: string | null;
  subscription_token: string | null;
};

const JWT_STORAGE_KEY = "arvexo_cabinet_jwt";

export function CheckoutApp() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderId, setOrderId] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const order = useMemo(() => orders.find((item) => item.id === orderId) || orders[0], [orders, orderId]);

  const isSbp = order?.payment_method === "sbp_manual";
  const isTon = order?.payment_method === "ton_manual";
  const isPaid = order?.status === "paid";
  const isWaiting = order?.status === "waiting_confirmation";
  const canSubmit = Boolean(order && !isPaid && paymentReference.trim().length >= 3);
  const amountText = order ? `${order.payment_amount || order.crypto_amount || order.amount} ${order.payment_currency || order.currency}` : "";
  const basePriceText = order ? formatMoney(order.amount, order.currency) : "";
  const purposeText = order?.payment_purpose || (order ? `Arvexo Connect order ${order.id}` : "");
  const requiresTransferMessage = Boolean(isSbp || isTon);
  const existingReference = order?.payment_reference || order?.tx_hash || "";

  useEffect(() => {
    setOrderId(new URLSearchParams(window.location.search).get("order") || "");
    void loadOrders();
  }, []);

  useEffect(() => {
    setPaymentReference(existingReference);
  }, [existingReference]);

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

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1500);
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
        body: JSON.stringify({ payment_reference: paymentReference.trim() })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(readApiError(body) || "Не удалось отправить данные платежа");
      }
      setMessage("Платеж отправлен на проверку. После подтверждения доступ появится в кабинете.");
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить данные платежа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="mx-auto w-[min(calc(100%-32px),980px)] py-10">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-6">
          <Link href="/cabinet/plans" className="text-sm font-semibold text-white/60 hover:text-white">Тарифы</Link>
          <span className="text-xs font-bold uppercase text-[#ff2b3a]">Checkout</span>
        </div>
        {!order ? (
          <div className="mt-10 rounded-lg border border-white/[0.1] bg-[#101010] p-6">
            <p className="text-white/60">Заказов пока нет.</p>
          </div>
        ) : (
          <div className="mt-10 rounded-lg border border-white/[0.1] bg-[#101010] p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-[#ff2b3a]">
                  {isSbp ? "Оплата через СБП" : isTon ? "Оплата TON" : `Оплата USDT ${order.crypto_network || ""}`}
                </p>
                <h1 className="mt-3 text-3xl font-bold">{order.plan_name || "Order"}</h1>
                <p className="mt-2 break-all text-sm text-white/45">Order ID: {order.id}</p>
              </div>
              <StatusBadge status={order.status} />
            </div>

            {isPaid && order.subscription_token && (
              <Notice tone="success">
                Платеж подтвержден. Доступ активирован.
                <Link href={`/cabinet/subscription/${order.subscription_token}`} className="ml-2 font-bold text-white underline">Открыть подписку</Link>
              </Notice>
            )}
            {isWaiting && <Notice>Платеж уже отправлен на проверку. Можно обновить ID/комментарий, если ошиблись.</Notice>}
            {!isPaid && (
              <Notice tone="warning">
                Переводите ровно сумму из блока «К оплате». Комиссию банка или сети оплачивайте сверху, чтобы нам дошла полная сумма. {requiresTransferMessage ? "В сообщении/комментарии к переводу обязательно укажите текст из блока «Сообщение к переводу»." : "После USDT-перевода обязательно вставьте tx hash ниже."} Один перевод — один order.
              </Notice>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Info label="Цена тарифа" value={basePriceText} />
              <CopyInfo label="К оплате" value={amountText} onCopy={() => copy(amountText, "amount")} />
              <CopyInfo label={requiresTransferMessage ? "Сообщение к переводу" : "Order reference"} value={purposeText} onCopy={() => copy(purposeText, "purpose")} highlight={requiresTransferMessage} />
              {isSbp ? (
                <>
                  <CopyInfo label="Получатель" value={order.payment_recipient || "SBP_PAYMENT_RECIPIENT не задан"} onCopy={() => copy(order.payment_recipient || "", "recipient")} disabled={!order.payment_recipient} />
                  {order.payment_url ? <PaymentLink href={order.payment_url} /> : <Info label="Ссылка оплаты" value="Не настроена" />}
                </>
              ) : (
                <>
                  <Info label="Сеть" value={order.crypto_network || (isTon ? "TON" : "Нужно настроить")} />
                  <CopyInfo
                    label="Адрес кошелька"
                    value={order.crypto_address || (isTon ? "TON_PAYMENT_ADDRESS не задан" : "CRYPTO_PAYMENT_ADDRESS не задан")}
                    onCopy={() => copy(order.crypto_address || "", "address")}
                    disabled={!order.crypto_address}
                  />
                </>
              )}
            </div>

            {isSbp && (order.qr_image_base64 || order.qr_payload) && (
              <div className="mt-6 grid gap-4 md:grid-cols-[240px_1fr] md:items-start">
                <img
                  alt="Payment QR"
                  className="w-60 rounded-lg bg-white p-3"
                  src={order.qr_image_base64 ? `data:image/png;base64,${order.qr_image_base64}` : `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(order.qr_payload || "")}`}
                />
                <div className="rounded-lg border border-white/[0.08] bg-black/25 p-4">
                  <p className="text-xs text-white/45">QR payload</p>
                  <p className="mt-2 break-all text-sm font-semibold">{order.qr_payload}</p>
                  {order.qr_payload && (
                    <button onClick={() => copy(order.qr_payload || "", "qr")} className="mt-4 min-h-10 rounded-lg border border-white/[0.12] px-4 text-sm font-bold">
                      Скопировать QR payload
                    </button>
                  )}
                </div>
              </div>
            )}

            {!isPaid && (
              <div className="mt-6 grid gap-3">
                <label className="grid gap-2 text-sm font-semibold text-white/56">
                  {isSbp ? "ID перевода или комментарий из банка" : isTon ? "Tx hash или комментарий TON-перевода" : "Tx hash"}
                  <input
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.target.value)}
                    placeholder={isSbp ? purposeText : isTon ? purposeText : "Например: 5f8c..."}
                    className="h-12 rounded-lg border border-white/[0.1] bg-black px-4 text-white outline-none focus:border-[#ef233c]"
                  />
                </label>
                <button disabled={loading || !canSubmit} onClick={submitPayment} className="min-h-12 rounded-lg bg-[#ef233c] px-5 text-sm font-bold disabled:opacity-50">
                  {loading ? "Отправляем..." : isWaiting ? "Обновить данные платежа" : "Я оплатил"}
                </button>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <Link href="/cabinet/orders" className="font-bold text-white/64 hover:text-white">История заказов</Link>
              <Link href="/cabinet/support" className="font-bold text-white/64 hover:text-white">Проблема с оплатой</Link>
              {copied && <span className="text-white/45">Скопировано</span>}
            </div>
            {message && <p className="mt-4 text-sm text-white/64">{message}</p>}
            {error && <p className="mt-4 text-sm text-[#ff2b3a]">{error}</p>}
          </div>
        )}
      </section>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label: Record<string, string> = {
    pending: "Ожидает оплаты",
    waiting_confirmation: "На проверке",
    paid: "Оплачен",
    cancelled: "Отменен"
  };
  return (
    <div className="rounded-lg border border-white/[0.1] bg-black/25 px-4 py-3">
      <p className="text-xs text-white/45">Статус</p>
      <p className="mt-1 text-sm font-bold">{label[status] || status}</p>
    </div>
  );
}

function CopyInfo({ label, value, disabled, highlight, onCopy }: { label: string; value: string; disabled?: boolean; highlight?: boolean; onCopy: () => void }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "border-amber-300/35 bg-amber-300/10" : "border-white/[0.08] bg-black/25"}`}>
      <p className={`text-xs ${highlight ? "font-bold uppercase text-amber-100" : "text-white/45"}`}>{label}</p>
      <p className="mt-2 break-words text-sm font-semibold">{value}</p>
      {highlight && <p className="mt-2 text-xs leading-5 text-amber-50/72">Этот текст нужно вставить в комментарий или сообщение к переводу без изменений.</p>}
      <button disabled={disabled} onClick={onCopy} className="mt-4 min-h-9 rounded-lg border border-white/[0.12] px-3 text-xs font-bold disabled:opacity-40">
        Скопировать
      </button>
    </div>
  );
}

function PaymentLink({ href }: { href: string }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-black/25 p-4">
      <p className="text-xs text-white/45">Ссылка оплаты</p>
      <a href={href} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-[#ef233c] px-4 text-sm font-bold">
        Открыть оплату
      </a>
    </div>
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

function Notice({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "success" | "warning" }) {
  const className =
    tone === "success"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-50"
      : tone === "warning"
        ? "border-amber-300/30 bg-amber-300/10 text-amber-50"
        : "border-white/[0.1] bg-black/25 text-white/64";
  return (
    <div className={`mt-6 rounded-lg border p-4 text-sm ${className}`}>
      {children}
    </div>
  );
}

function readApiError(body: unknown) {
  if (!body || typeof body !== "object" || !("detail" in body)) return "";
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  return "";
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
