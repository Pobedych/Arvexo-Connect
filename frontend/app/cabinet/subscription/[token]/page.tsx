import { SubscriptionDetailApp } from "@/components/CabinetPages";

export const metadata = {
  title: "Подписка | Arvexo Connect",
  description: "Детали подписки Arvexo Connect.",
  robots: { index: false, follow: false }
};

export default async function CabinetSubscriptionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SubscriptionDetailApp token={token} />;
}
