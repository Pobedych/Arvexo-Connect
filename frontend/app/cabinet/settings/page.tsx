import { SettingsApp } from "@/components/CabinetPages";

export const metadata = {
  title: "Настройки | Arvexo Connect",
  description: "Настройки личного кабинета и устройств Arvexo Connect.",
  robots: { index: false, follow: false }
};

export default function CabinetSettingsPage() {
  return <SettingsApp />;
}
