import { CheckoutApp } from "@/components/CheckoutApp";

export const metadata = {
  title: "Оплата | Arvexo Connect",
  description: "Оплата подписки Arvexo Connect через СБП или криптовалюту.",
  robots: { index: false, follow: false }
};

export default function CabinetCheckoutPage() {
  return <CheckoutApp />;
}
