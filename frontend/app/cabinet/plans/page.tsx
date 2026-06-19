import { PlansApp } from "@/components/PlansApp";

export const metadata = {
  title: "Тарифы | Arvexo Connect",
  description: "Тарифы и планы подписки Arvexo Connect в личном кабинете.",
  robots: { index: false, follow: false }
};

export default function CabinetPlansPage() {
  return <PlansApp />;
}
