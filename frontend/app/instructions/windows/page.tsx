import { InstructionPage } from "@/components/InstructionPage";

export const metadata = {
  title: "Инструкция Windows | Arvexo Connect",
  description:
    "Как подключить Arvexo Connect на Windows: установка Hiddify или Nekoray, добавление subscription-ссылки и выбор профиля подключения.",
  alternates: {
    canonical: "https://connect.arvexo.ru/instructions/windows"
  }
};

export default function WindowsInstructionPage() {
  return (
    <InstructionPage
      title="Windows"
      appNames="Hiddify / Nekoray"
      steps={[
        "Установите Hiddify или Nekoray.",
        "Скопируйте subscription-ссылку из кабинета.",
        "Добавьте новую подписку.",
        "Обновите список профилей.",
        "Выберите подходящий профиль.",
        "Подключитесь."
      ]}
    />
  );
}
