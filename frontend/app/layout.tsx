import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://connect.arvexo.ru"),
  applicationName: "Arvexo Connect",
  creator: "Arvexo",
  publisher: "Arvexo",
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png"
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "https://connect.arvexo.ru/",
    siteName: "Arvexo Connect",
    title: "Arvexo Connect — VPN с умной маршрутизацией",
    description:
      "VPN-доступ с режимами Smart Russia, Privacy и Global. Reality + Hysteria, несколько узлов и одна подписка.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Arvexo Connect"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Arvexo Connect — VPN с умной маршрутизацией",
    description:
      "VPN-доступ с режимами Smart Russia, Privacy и Global. Reality + Hysteria, несколько узлов и одна подписка.",
    images: ["/og-image.png"]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#EEEBE3"
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Arvexo",
  url: "https://connect.arvexo.ru",
  logo: "https://connect.arvexo.ru/icon.svg",
  sameAs: ["https://t.me/arvexo_support"]
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Arvexo Connect",
  url: "https://connect.arvexo.ru"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&family=Cormorant:ital,wght@1,500;1,600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
