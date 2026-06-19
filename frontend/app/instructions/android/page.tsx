import { InstructionPage } from "@/components/InstructionPage";

export const metadata = {
  title: "Инструкция Android | Arvexo Connect",
  description:
    "Как подключить Arvexo Connect на Android: установка Hiddify, v2rayNG или NekoBox, импорт subscription-ссылки и выбор профиля.",
  alternates: {
    canonical: "https://connect.arvexo.ru/instructions/android"
  }
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
