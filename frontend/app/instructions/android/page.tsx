import { InstructionPage } from "@/components/InstructionPage";

export const metadata = {
  title: "Инструкция Android | Arvexo Connect"
};

export default function AndroidInstructionPage() {
  return (
    <InstructionPage
      title="Android"
      appNames="Hiddify / v2rayNG / NekoBox"
      steps={[
        "Установите Hiddify, v2rayNG или NekoBox.",
        "Скопируйте subscription-ссылку.",
        "Импортируйте подписку в приложение.",
        "Обновите подписку.",
        "Выберите профиль.",
        "Подключитесь."
      ]}
    />
  );
}
