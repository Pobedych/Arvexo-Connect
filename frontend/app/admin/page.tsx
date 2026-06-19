import { AdminApp } from "@/components/AdminApp";

export const metadata = {
  title: "Админка | Arvexo Connect",
  description: "Административная панель Arvexo Connect.",
  robots: { index: false, follow: false }
};

export default function AdminPage() {
  return <AdminApp />;
}
