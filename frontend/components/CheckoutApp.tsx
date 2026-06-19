"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

const ACCENT = "#E5402C";

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
    if (!jwt) { window.location.assign("/cabinet/login"); return; }
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
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch(`${getApiBase()}/api/cabinet/orders/${order.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ payment_reference: paymentReference.trim() }),
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
    <div style={{ background: "#EEEBE3", color: "#14130F", minHeight: "100vh", fontFamily: "'Onest',sans-serif", WebkitFontSmoothing: "antialiased" }}>
      {/* Nav */}
      <header style={{ borderBottom: "1px solid rgba(20,19,15,.08)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 36px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ fontWeight: 700, fontSize: 19, letterSpacing: "-.02em", display: "flex", alignItems: "center", gap: 9, color: "#14130F" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: ACCENT, display: "inline-block" }} />
            Arvexo Connect
          </Link>
          <Link href="/cabinet/plans" style={{ color: "#57534B", fontSize: 14, fontWeight: 500 }}>← Тарифы</Link>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 36px 80px" }}>
        {/* Mono label */}
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, letterSpacing: ".16em", color: "#8A857B", marginBottom: 28 }}>
          ОПЛАТА
        </div>

        {!order ? (
          <div style={{ background: "#FBFAF7", border: "1px solid rgba(20,19,15,.1)", borderRadius: 16, padding: 32 }}>
            <p style={{ color: "#57534B" }}>Заказов пока нет.</p>
            <Link href="/cabinet/plans" style={{ display: "inline-flex", marginTop: 16, padding: "11px 24px", borderRadius: 100, background: "#14130F", color: "#EEEBE3", fontSize: 14, fontWeight: 600 }}>
              Выбрать тариф
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {/* Header card */}
            <div style={{ background: "#FBFAF7", border: "1px solid rgba(20,19,15,.1)", borderRadius: 18, padding: "28px 30px", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: ".12em", color: ACCENT, marginBottom: 10 }}>
                  {isSbp ? "ОПЛАТА ЧЕРЕЗ СБП" : isTon ? "ОПЛАТА TON" : `ОПЛАТА USDT ${order.crypto_network || ""}`}
                </div>
                <h1 style={{ fontWeight: 700, fontSize: 28, letterSpacing: "-.03em", marginBottom: 6 }}>{order.plan_name || "Order"}</h1>
                <p style={{ fontSize: 13, color: "#8A857B", fontFamily: "'JetBrains Mono',monospace" }}>Order ID: {order.id}</p>
              </div>
              <StatusBadge status={order.status} />
            </div>

            {/* Success notice */}
            {isPaid && order.subscription_token && (
              <Notice tone="success">
                Платеж подтвержден. Доступ активирован.{" "}
                <Link href={`/cabinet/subscription/${order.subscription_token}`} style={{ fontWeight: 700, color: "#145A35", textDecoration: "underline", marginLeft: 4 }}>
                  Открыть подписку
                </Link>
              </Notice>
            )}
            {isWaiting && <Notice>Платеж уже отправлен на проверку. Можно обновить ID/комментарий, если ошиблись.</Notice>}
            {!isPaid && (
              <Notice tone="warning">
                Переводите ровно сумму из блока «К оплате». Комиссию банка или сети оплачивайте сверху.{" "}
                {requiresTransferMessage
                  ? "В сообщении/комментарии к переводу обязательно укажите текст из блока «Сообщение к переводу»."
                  : "После USDT-перевода обязательно вставьте tx hash ниже."}{" "}
                Один перевод — один order.
              </Notice>
            )}

            {/* Info grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }} className="checkout-grid">
              <Info label="Цена тарифа" value={basePriceText} />
              <CopyInfo label="К оплате" value={amountText} onCopy={() => copy(amountText, "amount")} copiedLabel="amount" copied={copied} />
              <CopyInfo
                label={requiresTransferMessage ? "Сообщение к переводу" : "Order reference"}
                value={purposeText}
                onCopy={() => copy(purposeText, "purpose")}
                copiedLabel="purpose"
                copied={copied}
                highlight={requiresTransferMessage}
              />
              {isSbp ? (
                <>
                  <CopyInfo
                    label="Получатель"
                    value={order.payment_recipient || "SBP_PAYMENT_RECIPIENT не задан"}
                    onCopy={() => copy(order.payment_recipient || "", "recipient")}
                    copiedLabel="recipient"
                    copied={copied}
                    disabled={!order.payment_recipient}
                  />
                  {order.payment_url ? <PaymentLink href={order.payment_url} /> : <Info label="Ссылка оплаты" value="Не настроена" />}
                </>
              ) : (
                <>
                  <Info label="Сеть" value={order.crypto_network || (isTon ? "TON" : "Нужно настроить")} />
                  <CopyInfo
                    label="Адрес кошелька"
                    value={order.crypto_address || (isTon ? "TON_PAYMENT_ADDRESS не задан" : "CRYPTO_PAYMENT_ADDRESS не задан")}
                    onCopy={() => copy(order.crypto_address || "", "address")}
                    copiedLabel="address"
                    copied={copied}
                    disabled={!order.crypto_address}
                  />
                </>
              )}
            </div>

            {/* QR section */}
            {isSbp && (order.qr_image_base64 || order.qr_payload) && (
              <div style={{ background: "#FBFAF7", border: "1px solid rgba(20,19,15,.09)", borderRadius: 16, padding: 24, display: "grid", gridTemplateColumns: "auto 1fr", gap: 24, alignItems: "start" }} className="qr-grid">
                {order.qr_image_base64 && (
                  <img alt="Payment QR" src={`data:image/png;base64,${order.qr_image_base64}`}
                    style={{ width: 200, borderRadius: 12, background: "#fff", padding: 10 }} />
                )}
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: ".1em", color: "#8A857B", marginBottom: 8 }}>QR PAYLOAD</div>
                  <p style={{ fontSize: 13, wordBreak: "break-all", lineHeight: 1.6, color: "#3B382F", marginBottom: 16 }}>{order.qr_payload}</p>
                  {order.qr_payload && (
                    <button onClick={() => copy(order.qr_payload || "", "qr")}
                      style={{ padding: "10px 20px", borderRadius: 100, border: "1px solid rgba(20,19,15,.14)", background: "transparent", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Onest',sans-serif" }}>
                      {copied === "qr" ? "Скопировано" : "Скопировать QR payload"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Payment confirmation */}
            {!isPaid && (
              <div style={{ background: "#FBFAF7", border: "1px solid rgba(20,19,15,.09)", borderRadius: 16, padding: "24px 28px" }}>
                <label style={{ display: "grid", gap: 8, fontSize: 13, fontWeight: 600, color: "#57534B" }}>
                  {isSbp ? "ID перевода или комментарий из банка" : isTon ? "Tx hash или комментарий TON-перевода" : "Tx hash"}
                  <input
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder={isSbp ? purposeText : isTon ? purposeText : "Например: 5f8c..."}
                    style={{ height: 48, borderRadius: 12, border: "1px solid rgba(20,19,15,.14)", padding: "0 16px", fontSize: 14, color: "#14130F", fontFamily: "'Onest',sans-serif", outline: "none", background: "#EEEBE3" }}
                  />
                </label>
                <button
                  disabled={loading || !canSubmit}
                  onClick={submitPayment}
                  style={{ marginTop: 12, padding: "14px 28px", borderRadius: 100, background: ACCENT, color: "#fff", fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "'Onest',sans-serif", opacity: (loading || !canSubmit) ? .5 : 1 }}
                >
                  {loading ? "Отправляем…" : isWaiting ? "Обновить данные платежа" : "Я оплатил"}
                </button>
              </div>
            )}

            {/* Footer links */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", padding: "4px 0" }}>
              <Link href="/cabinet/orders" style={{ fontSize: 14, fontWeight: 600, color: "#57534B" }}>История заказов</Link>
              <Link href="/cabinet/support" style={{ fontSize: 14, fontWeight: 600, color: "#57534B" }}>Проблема с оплатой</Link>
              {copied && <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#1FB46A" }}>Скопировано</span>}
            </div>

            {message && (
              <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(31,180,106,.08)", border: "1px solid rgba(31,180,106,.2)", fontSize: 14, color: "#145A35" }}>
                {message}
              </div>
            )}
            {error && (
              <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(229,64,44,.07)", border: "1px solid rgba(229,64,44,.2)", fontSize: 14, color: ACCENT }}>
                {error}
              </div>
            )}
          </div>
        )}
      </main>

      <footer style={{ borderTop: "1px solid rgba(20,19,15,.08)", marginTop: 40 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 36px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#A39E93" }}>© 2026 Arvexo</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#A39E93" }}>connect.arvexo.ru</span>
        </div>
      </footer>

      <style>{`
        @media (max-width: 640px) { .checkout-grid { grid-template-columns: 1fr !important; } .qr-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending: "Ожидает оплаты",
    waiting_confirmation: "На проверке",
    paid: "Оплачен",
    cancelled: "Отменен",
  };
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    paid: { bg: "rgba(31,180,106,.08)", color: "#145A35", border: "rgba(31,180,106,.2)" },
    waiting_confirmation: { bg: "rgba(229,64,44,.06)", color: ACCENT, border: "rgba(229,64,44,.2)" },
    pending: { bg: "rgba(20,19,15,.04)", color: "#57534B", border: "rgba(20,19,15,.1)" },
    cancelled: { bg: "rgba(20,19,15,.04)", color: "#8A857B", border: "rgba(20,19,15,.1)" },
  };
  const c = colors[status] || colors.pending;
  return (
    <div style={{ padding: "10px 18px", borderRadius: 100, background: c.bg, border: `1px solid ${c.border}` }}>
      <p style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em", color: "#8A857B", marginBottom: 2 }}>СТАТУС</p>
      <p style={{ fontSize: 14, fontWeight: 700, color: c.color }}>{labels[status] || status}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#FBFAF7", border: "1px solid rgba(20,19,15,.09)", borderRadius: 14, padding: "18px 20px" }}>
      <p style={{ fontSize: 11.5, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".1em", color: "#8A857B", marginBottom: 8 }}>{label.toUpperCase()}</p>
      <p style={{ fontSize: 15, fontWeight: 600, wordBreak: "break-all" }}>{value}</p>
    </div>
  );
}

function CopyInfo({ label, value, disabled, highlight, onCopy, copiedLabel, copied }: {
  label: string; value: string; disabled?: boolean; highlight?: boolean;
  onCopy: () => void; copiedLabel: string; copied: string;
}) {
  const isCopied = copied === copiedLabel;
  return (
    <div style={{
      background: highlight ? "rgba(229,64,44,.04)" : "#FBFAF7",
      border: `1px solid ${highlight ? "rgba(229,64,44,.2)" : "rgba(20,19,15,.09)"}`,
      borderRadius: 14, padding: "18px 20px",
    }}>
      <p style={{ fontSize: 11.5, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".1em", color: highlight ? ACCENT : "#8A857B", marginBottom: 8 }}>
        {label.toUpperCase()}
      </p>
      <p style={{ fontSize: 14, fontWeight: 600, wordBreak: "break-all", lineHeight: 1.55 }}>{value}</p>
      {highlight && (
        <p style={{ fontSize: 12.5, color: "#57534B", marginTop: 6, lineHeight: 1.55 }}>
          Этот текст нужно вставить в комментарий или сообщение к переводу без изменений.
        </p>
      )}
      <button
        disabled={disabled}
        onClick={onCopy}
        style={{ marginTop: 12, padding: "8px 18px", borderRadius: 100, border: "1px solid rgba(20,19,15,.14)", background: "transparent", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "'Onest',sans-serif", opacity: disabled ? .4 : 1, color: isCopied ? "#1FB46A" : "#14130F" }}
      >
        {isCopied ? "Скопировано" : "Скопировать"}
      </button>
    </div>
  );
}

function PaymentLink({ href }: { href: string }) {
  return (
    <div style={{ background: "#FBFAF7", border: "1px solid rgba(20,19,15,.09)", borderRadius: 14, padding: "18px 20px" }}>
      <p style={{ fontSize: 11.5, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".1em", color: "#8A857B", marginBottom: 12 }}>ССЫЛКА ОПЛАТЫ</p>
      <a href={href} target="_blank" rel="noreferrer"
        style={{ display: "inline-flex", alignItems: "center", padding: "12px 22px", borderRadius: 100, background: ACCENT, color: "#fff", fontSize: 14, fontWeight: 600 }}>
        Открыть оплату
      </a>
    </div>
  );
}

function Notice({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "success" | "warning" }) {
  const styles: Record<string, { bg: string; border: string; color: string }> = {
    success: { bg: "rgba(31,180,106,.07)", border: "rgba(31,180,106,.2)", color: "#145A35" },
    warning: { bg: "rgba(229,64,44,.05)", border: "rgba(229,64,44,.18)", color: "#8B2A1C" },
    default: { bg: "rgba(20,19,15,.04)", border: "rgba(20,19,15,.1)", color: "#57534B" },
  };
  const s = styles[tone];
  return (
    <div style={{ padding: "14px 18px", borderRadius: 14, background: s.bg, border: `1px solid ${s.border}`, fontSize: 14, color: s.color, lineHeight: 1.6 }}>
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
