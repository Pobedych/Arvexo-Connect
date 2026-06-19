import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

// Конфига не было в репозитории вовсе: "next lint" в ESLint 9 без неё уходит
// в интерактивный мастер настройки и в неинтерактивном CI просто падает/виснет.
// @eslint/eslintrc уже стоит в devDependencies — это ровно тот пакет, который
// нужен, чтобы подключить классический next/core-web-vitals через flat-конфиг.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
