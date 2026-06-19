// CSP/security-заголовки отсутствовали полностью (High, см. SECURITY_REVIEW.md, п.4).
// script-src/style-src держим с 'unsafe-inline', т.к. Next.js App Router инлайнит скрипты
// гидратации (self.__next_f) при стриминге RSC — без nonce-инфраструктуры (middleware.ts)
// их иначе не разрешить. Это не блокирует основной риск из ревью: даже при инъекции
// inline-скрипта connect-src/img-src ограничивают, куда он может отправить украденный
// токен из localStorage.
const API_ORIGINS = ["https://api.arvexo.ru", "http://127.0.0.1:8012"];

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  `connect-src 'self' ${API_ORIGINS.join(" ")} https://get.geojs.io https://ipwho.is`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'"
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
        ]
      }
    ];
  }
};

export default nextConfig;
