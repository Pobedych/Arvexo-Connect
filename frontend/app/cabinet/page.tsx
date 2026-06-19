import { CabinetApp } from "@/components/CabinetApp";

export const metadata = {
  title: "Личный кабинет | Arvexo Connect",
  description: "Личный кабинет Arvexo Connect: подписка, устройства, тарифы и оплата.",
  robots: { index: false, follow: false }
};

export default function CabinetPage() {
  return <CabinetApp />;
}
