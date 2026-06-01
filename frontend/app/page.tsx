import type { Metadata } from "next";
import { ArvexoConnectLanding } from "@/components/ArvexoConnectLanding";

export const metadata: Metadata = {
  title: "Arvexo Connect — VPN с умной маршрутизацией",
  description:
    "VPN-доступ с режимами Smart Russia, Privacy и Global. Reality + Hysteria, несколько узлов и одна подписка.",
  alternates: {
    canonical: "https://connect.arvexo.ru/"
  }
};

export default function HomePage() {
  return <ArvexoConnectLanding />;
}
