import { OrdersApp } from "@/components/CabinetPages";

export const metadata = {
  title: "Заказы | Arvexo Connect",
  description: "История заказов и платежей Arvexo Connect.",
  robots: { index: false, follow: false }
};

export default function CabinetOrdersPage() {
  return <OrdersApp />;
}
