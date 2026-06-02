import { InstructionPage } from "@/components/InstructionPage";

export const metadata = {
  title: "Инструкция Windows | Arvexo Connect"
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
