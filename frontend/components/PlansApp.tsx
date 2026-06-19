"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const ACCENT = "#E5402C";
const JWT_STORAGE_KEY = "arvexo_cabinet_jwt";

type Plan = {
  code: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  duration_days: number;
  device_limit: number;
  is_custom: boolean;
};

type CustomConfig = {
  devices_count: number;
  duration_days: number;
  default_mode: "smart" | "privacy" | "global";
  iphone_stable: boolean;
  priority_support: boolean;
  backup_profiles: boolean;
  custom_routing_ready: boolean;
};

export function PlansApp() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState("base");
  const [custom, setCustom] = useState<CustomConfig>({
    devices_count: 3,
    duration_days: 30,
    default_mode: "smart",
    iphone_stable: false,
    priority_support: false,
    backup_profiles: false,
    custom_routing_ready: false,
  });
  const [paymentMethod, setPaymentMethod] = useState<"crypto_manual" | "ton_manual" | "sbp_manual">("crypto_manual");
  const [quote, setQuote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedPlan = useMemo(() => plans.find((p) => p.code === selected), [plans, selected]);

  useEffect(() => {
    fetch(`${getApiBase()}/api/cabinet/plans`)
      .then((r) => r.json())
      .then((body) => {
        setPlans(body.plans || []);
        if (body.plans?.[0]?.code) setSelected(body.plans[0].code);
      })
      .catch(() => setError("Не удалось загрузить тарифы"));
  }, []);

  useEffect(() => {
    if (selected !== "custom") return;
    fetch(`${getApiBase()}/api/cabinet/custom-plan/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(custom),
    })
      .then((r) => r.json())
      .then((body) => setQuote(formatMoney(body.price, body.currency)))
      .catch(() => setQuote(""));
  }, [custom, selected]);

  async function createOrder() {
    const jwt = localStorage.getItem(JWT_STORAGE_KEY);
    if (!jwt) { window.location.assign("/cabinet/login"); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch(`${getApiBase()}/api/cabinet/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          plan_code: selected,
          payment_method: paymentMethod,
          ...(selected === "custom" ? { custom_config: custom } : {}),
        }),
      });
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem(JWT_STORAGE_KEY);
        window.location.assign("/cabinet/login");
        return;
      }
      if (!response.ok) throw new Error("Не удалось создать order");
      const body = await response.json();
      window.location.assign(`/cabinet/checkout?order=${body.order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать order");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "#EEEBE3", color: "#14130F", minHeight: "100vh", fontFamily: "'Onest',sans-serif", WebkitFontSmoothing: "antialiased" }}>
      {/* Nav */}
      <header style={{ borderBottom: "1px solid rgba(20,19,15,.08)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "18px 36px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ fontWeight: 700, fontSize: 19, letterSpacing: "-.02em", display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: ACCENT, display: "inline-block" }} />
            Arvexo Connect
          </Link>
          <Link href="/cabinet" style={{ color: "#57534B", fontSize: 14, fontWeight: 500 }}>← Кабинет</Link>
        </div>
      </header>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 36px 80px" }}>
        {/* Title */}
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, letterSpacing: ".16em", color: "#8A857B", marginBottom: 24 }}>
          ТАРИФЫ
        </div>
        <h1 style={{ fontWeight: 700, fontSize: "clamp(28px,3vw,42px)", letterSpacing: "-.035em", marginBottom: 8 }}>
          Выберите тариф
        </h1>
        <p style={{ fontSize: 16, color: "#57534B", marginBottom: 40 }}>
          После оплаты доступ появится в кабинете автоматически.
        </p>

        {/* Plan cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }} className="plans-grid">
          {plans.map((plan) => (
            <button
              key={plan.code}
              type="button"
              onClick={() => setSelected(plan.code)}
              style={{
                background: selected === plan.code ? "rgba(229,64,44,.05)" : "#FBFAF7",
                border: `1px solid ${selected === plan.code ? ACCENT : "rgba(20,19,15,.1)"}`,
                borderRadius: 18, padding: "28px 26px",
                textAlign: "left", cursor: "pointer",
                fontFamily: "'Onest',sans-serif",
                transition: "border-color .2s, background .2s",
              }}
            >
              <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.02em", marginBottom: 8 }}>{plan.name}</h2>
              <p style={{ fontSize: 14, color: "#57534B", lineHeight: 1.5, minHeight: 44, marginBottom: 20 }}>{plan.description}</p>
              <p style={{ fontWeight: 700, fontSize: 36, letterSpacing: "-.04em", lineHeight: 1 }}>
                {plan.is_custom ? quote || "от 299 ₽" : formatMoney(plan.price, plan.currency)}
              </p>
              <p style={{ fontSize: 13, color: "#8A857B", marginTop: 6 }}>
                {plan.duration_days} дней · до {plan.device_limit} устройств
              </p>
            </button>
          ))}
        </div>

        {/* Custom config */}
        {selectedPlan?.is_custom && (
          <div style={{ marginTop: 20, background: "#FBFAF7", border: "1px solid rgba(20,19,15,.09)", borderRadius: 16, padding: "28px" }}>
            <h2 style={{ fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Параметры Custom</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="custom-grid">
              <CSelect label="Устройства" value={custom.devices_count} values={[1,3,5,10]}
                onChange={(v) => setCustom({ ...custom, devices_count: v })} />
              <CSelect label="Срок (дней)" value={custom.duration_days} values={[30,90,180,365]}
                onChange={(v) => setCustom({ ...custom, duration_days: v })} />
              <label style={{ display: "grid", gap: 8, fontSize: 13, color: "#8A857B" }}>
                Режим
                <select value={custom.default_mode}
                  onChange={(e) => setCustom({ ...custom, default_mode: e.target.value as CustomConfig["default_mode"] })}
                  style={selectStyle}>
                  <option value="smart">Smart Russia</option>
                  <option value="privacy">Privacy</option>
                  <option value="global">Global</option>
                </select>
              </label>
              <div style={{ display: "grid", gap: 10, paddingTop: 22 }}>
                <CToggle label="iPhone Stable"         checked={custom.iphone_stable}       onChange={(v) => setCustom({ ...custom, iphone_stable: v })} />
                <CToggle label="Priority support"      checked={custom.priority_support}     onChange={(v) => setCustom({ ...custom, priority_support: v })} />
                <CToggle label="Резервные профили"     checked={custom.backup_profiles}      onChange={(v) => setCustom({ ...custom, backup_profiles: v })} />
                <CToggle label="Custom routing ready"  checked={custom.custom_routing_ready} onChange={(v) => setCustom({ ...custom, custom_routing_ready: v })} />
              </div>
            </div>
          </div>
        )}

        {/* Payment method */}
        <div style={{ marginTop: 20, background: "#FBFAF7", border: "1px solid rgba(20,19,15,.09)", borderRadius: 16, padding: "28px" }}>
          <h2 style={{ fontWeight: 700, fontSize: 18, marginBottom: 18 }}>Метод оплаты</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }} className="pay-grid">
            <PayBtn active={paymentMethod === "crypto_manual"} title="USDT TRC20" text="Перевод USDT на TRC20-кошелёк."                               onClick={() => setPaymentMethod("crypto_manual")} />
            <PayBtn active={paymentMethod === "ton_manual"}    title="TON"        text="Перевод TON на кошелёк с комментарием заказа."                 onClick={() => setPaymentMethod("ton_manual")} />
            <PayBtn active={paymentMethod === "sbp_manual"}    title="СБП"        text="Ручная проверка перевода по назначению платежа."               onClick={() => setPaymentMethod("sbp_manual")} />
          </div>
        </div>

        {/* CTA */}
        <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <button
            disabled={loading || !selectedPlan}
            onClick={createOrder}
            style={{ display: "inline-flex", alignItems: "center", padding: "15px 32px", borderRadius: 100, background: ACCENT, color: "#fff", fontSize: 15.5, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "'Onest',sans-serif", opacity: (loading || !selectedPlan) ? .55 : 1 }}
          >
            {loading ? "Создаём…" : "Перейти к оплате"}
          </button>
          {error && <p style={{ fontSize: 13, color: ACCENT }}>{error}</p>}
        </div>
      </main>

      <footer style={{ borderTop: "1px solid rgba(20,19,15,.08)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 36px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#A39E93" }}>© 2026 Arvexo</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#A39E93" }}>connect.arvexo.ru</span>
        </div>
      </footer>

      <style>{`
        @media (max-width: 720px) { .plans-grid, .pay-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 560px) { .custom-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  height: 44, borderRadius: 10,
  border: "1px solid rgba(20,19,15,.14)",
  padding: "0 14px", fontSize: 14,
  color: "#14130F", fontFamily: "'Onest',sans-serif",
  outline: "none", background: "#fff",
};

function CSelect({ label, value, values, onChange }: { label: string; value: number; values: number[]; onChange: (v: number) => void }) {
  return (
    <label style={{ display: "grid", gap: 8, fontSize: 13, color: "#8A857B" }}>
      {label}
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} style={selectStyle}>
        {values.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    </label>
  );
}

function CToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: ACCENT, width: 16, height: 16 }} />
      {label}
    </label>
  );
}

function PayBtn({ active, title, text, onClick }: { active: boolean; title: string; text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? "rgba(229,64,44,.06)" : "#EEEBE3",
        border: `1px solid ${active ? ACCENT : "rgba(20,19,15,.1)"}`,
        borderRadius: 14, padding: "18px 20px",
        textAlign: "left", cursor: "pointer",
        fontFamily: "'Onest',sans-serif",
        transition: "border-color .2s, background .2s",
      }}
    >
      <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "#14130F", marginBottom: 6 }}>{title}</span>
      <span style={{ display: "block", fontSize: 13, color: "#57534B", lineHeight: 1.5 }}>{text}</span>
    </button>
  );
}

function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) return process.env.NEXT_PUBLIC_API_BASE_URL;
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname))
    return "http://127.0.0.1:8012";
  return "https://api.arvexo.ru";
}

function formatMoney(value: string | number, currency: string) {
  const numeric = Number(value);
  if (currency === "RUB")
    return `${Number.isFinite(numeric) ? numeric.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) : value} ₽`;
  return `${value} ${currency}`;
}
