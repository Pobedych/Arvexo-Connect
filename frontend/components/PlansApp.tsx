"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

const JWT_STORAGE_KEY = "arvexo_cabinet_jwt";

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
    custom_routing_ready: false
  });
  const [paymentMethod, setPaymentMethod] = useState<"crypto_manual" | "sbp_manual">("crypto_manual");
  const [quote, setQuote] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedPlan = useMemo(() => plans.find((plan) => plan.code === selected), [plans, selected]);

  useEffect(() => {
    fetch(`${getApiBase()}/api/cabinet/plans`)
      .then((response) => response.json())
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
      body: JSON.stringify(custom)
    })
      .then((response) => response.json())
      .then((body) => setQuote(`${body.price} ${body.currency}`))
      .catch(() => setQuote(""));
  }, [custom, selected]);

  async function createOrder() {
    const jwt = localStorage.getItem(JWT_STORAGE_KEY);
    if (!jwt) {
      window.location.assign("/cabinet/login");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${getApiBase()}/api/cabinet/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          plan_code: selected,
          payment_method: paymentMethod,
          ...(selected === "custom" ? { custom_config: custom } : {})
        })
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
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="mx-auto w-[min(calc(100%-32px),1180px)] py-10">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-6">
          <Link href="/cabinet" className="text-sm font-semibold text-white/60 hover:text-white">Кабинет</Link>
          <span className="text-xs font-bold uppercase text-[#ff2b3a]">Plans</span>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <button
              key={plan.code}
              type="button"
              onClick={() => setSelected(plan.code)}
              className={`rounded-lg border p-6 text-left transition ${selected === plan.code ? "border-[#ef233c] bg-[#ef233c]/10" : "border-white/[0.1] bg-[#101010] hover:border-white/25"}`}
            >
              <h2 className="text-2xl font-bold">{plan.name}</h2>
              <p className="mt-3 min-h-12 text-sm text-white/56">{plan.description}</p>
              <p className="mt-6 text-3xl font-bold">{plan.is_custom ? quote || "от 4 USDT" : `${plan.price} ${plan.currency}`}</p>
              <p className="mt-2 text-sm text-white/45">{plan.duration_days} дней, до {plan.device_limit} устройств</p>
            </button>
          ))}
        </div>

        {selectedPlan?.is_custom && (
          <div className="mt-8 rounded-lg border border-white/[0.1] bg-[#101010] p-6">
            <h2 className="text-xl font-semibold">Custom</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Select label="Устройства" value={custom.devices_count} values={[1, 3, 5, 10]} onChange={(value) => setCustom({ ...custom, devices_count: value })} />
              <Select label="Срок" value={custom.duration_days} values={[30, 90, 180, 365]} onChange={(value) => setCustom({ ...custom, duration_days: value })} />
              <label className="grid gap-2 text-sm text-white/56">
                Режим
                <select value={custom.default_mode} onChange={(event) => setCustom({ ...custom, default_mode: event.target.value as CustomConfig["default_mode"] })} className="h-12 rounded-lg border border-white/[0.1] bg-black px-3 text-white">
                  <option value="smart">Smart Russia</option>
                  <option value="privacy">Privacy</option>
                  <option value="global">Global</option>
                </select>
              </label>
              <div className="grid gap-3 pt-7">
                <Toggle label="iPhone Stable" checked={custom.iphone_stable} onChange={(value) => setCustom({ ...custom, iphone_stable: value })} />
                <Toggle label="Priority support" checked={custom.priority_support} onChange={(value) => setCustom({ ...custom, priority_support: value })} />
                <Toggle label="Резервные профили" checked={custom.backup_profiles} onChange={(value) => setCustom({ ...custom, backup_profiles: value })} />
                <Toggle label="Custom routing ready" checked={custom.custom_routing_ready} onChange={(value) => setCustom({ ...custom, custom_routing_ready: value })} />
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 rounded-lg border border-white/[0.1] bg-[#101010] p-6">
          <h2 className="text-xl font-semibold">Метод оплаты</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <PaymentButton active={paymentMethod === "crypto_manual"} title="Crypto manual" text="USDT, сеть и адрес из настроек сервиса." onClick={() => setPaymentMethod("crypto_manual")} />
            <PaymentButton active={paymentMethod === "sbp_manual"} title="SBP manual" text="Ручная проверка перевода по назначению платежа." onClick={() => setPaymentMethod("sbp_manual")} />
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button disabled={loading || !selectedPlan} onClick={createOrder} className="min-h-12 rounded-lg bg-[#ef233c] px-6 text-sm font-bold disabled:opacity-50">
            {loading ? "Создаем..." : "Перейти к оплате"}
          </button>
          {error && <p className="text-sm text-[#ff2b3a]">{error}</p>}
        </div>
      </section>
    </main>
  );
}

function Select({ label, value, values, onChange }: { label: string; value: number; values: number[]; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-2 text-sm text-white/56">
      {label}
      <select value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-12 rounded-lg border border-white/[0.1] bg-black px-3 text-white">
        {values.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-10 items-center gap-3 text-sm font-semibold">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function PaymentButton({ active, title, text, onClick }: { active: boolean; title: string; text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-4 text-left transition ${active ? "border-[#ef233c] bg-[#ef233c]/10" : "border-white/[0.1] bg-black/25 hover:border-white/25"}`}
    >
      <span className="block text-base font-bold">{title}</span>
      <span className="mt-2 block text-sm leading-5 text-white/56">{text}</span>
    </button>
  );
}

function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) return process.env.NEXT_PUBLIC_API_BASE_URL;
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) return "http://127.0.0.1:8012";
  return "https://api.arvexo.ru";
}
