import { InstructionPage } from "@/components/InstructionPage";

export const metadata = {
  title: "Инструкция iPhone | Arvexo Connect",
  description:
    "Как подключить Arvexo Connect на iPhone: установка Happ, V2RayTun или Streisand, добавление subscription-ссылки и выбор Reality-профиля.",
  alternates: {
    canonical: "https://connect.arvexo.ru/instructions/iphone"
  }
};

export default function IPhoneInstructionPage() {
  return (
    <InstructionPage
      title="iPhone"
      appNames="Happ / V2RayTun / Streisand"
      steps={[
        "Установите Happ, V2RayTun или Streisand из App Store.",
        "Скопируйте subscription-ссылку в личном кабинете или Telegram-боте.",
        "Добавьте подписку в приложение.",
        "Нажмите обновить подписку.",
        "Выберите Reality-профиль.",
        "Подключитесь."
      ]}
    />
  );
}
