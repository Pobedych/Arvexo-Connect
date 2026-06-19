import Link from "next/link";

const ACCENT = "#E5402C";

export function InstructionPage({
  title,
  appNames,
  steps
}: {
  title: string;
  appNames: string;
  steps: string[];
}) {
  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `Как подключить Arvexo Connect на ${title}`,
    description: `Пошаговая инструкция подключения Arvexo Connect на ${title}: ${appNames}.`,
    step: steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step,
      text: step
    }))
  };

  return (
    <div style={{ background: "#EEEBE3", color: "#14130F", minHeight: "100vh", fontFamily: "'Onest',sans-serif", WebkitFontSmoothing: "antialiased" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />

      {/* Nav */}
      <header style={{ borderBottom: "1px solid rgba(20,19,15,.08)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "18px 36px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ fontWeight: 700, fontSize: 19, letterSpacing: "-.02em", display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: ACCENT, display: "inline-block" }} />
            Arvexo Connect
          </Link>
          <Link href="/cabinet" style={{ color: "#57534B", fontSize: 14, fontWeight: 500 }}>
            В кабинет →
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 820, margin: "0 auto", padding: "64px 36px 80px" }}>
        {/* Header */}
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, letterSpacing: ".16em", color: "#8A857B", marginBottom: 24 }}>
          ИНСТРУКЦИЯ
        </div>
        <h1 style={{ fontWeight: 700, fontSize: "clamp(32px,4vw,48px)", lineHeight: 1.05, letterSpacing: "-.035em", marginBottom: 12 }}>
          {title}
        </h1>
        <p style={{ fontSize: 16, color: "#57534B", lineHeight: 1.55, marginBottom: 48 }}>{appNames}</p>

        {/* Steps */}
        <ol style={{ display: "flex", flexDirection: "column", gap: 10, listStyle: "none", padding: 0, margin: 0 }}>
          {steps.map((step, index) => (
            <li key={step} style={{ display: "flex", gap: 20, background: "#FBFAF7", border: "1px solid rgba(20,19,15,.09)", borderRadius: 14, padding: "20px 24px", alignItems: "flex-start" }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: ACCENT, fontWeight: 500, flexShrink: 0, paddingTop: 1 }}>
                0{index + 1}
              </span>
              <span style={{ fontSize: 15, lineHeight: 1.6, color: "#3B382F" }}>{step}</span>
            </li>
          ))}
        </ol>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, marginTop: 40, flexWrap: "wrap" }}>
          <Link href="/cabinet" style={{ display: "inline-flex", alignItems: "center", padding: "13px 26px", borderRadius: 100, background: "#14130F", color: "#EEEBE3", fontSize: 14.5, fontWeight: 600 }}>
            В кабинет
          </Link>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", padding: "13px 26px", borderRadius: 100, background: "transparent", color: "#14130F", fontSize: 14.5, fontWeight: 600, border: "1px solid rgba(20,19,15,.14)" }}>
            На главную
          </Link>
          <a href="https://t.me/arvexo_support" target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", padding: "13px 26px", borderRadius: 100, background: "transparent", color: "#57534B", fontSize: 14.5, fontWeight: 600, border: "1px solid rgba(20,19,15,.14)" }}>
            Не получилось? Поддержка
          </a>
        </div>
      </main>

      <footer style={{ borderTop: "1px solid rgba(20,19,15,.08)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 36px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#A39E93" }}>© 2026 Arvexo</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#A39E93" }}>connect.arvexo.ru</span>
        </div>
      </footer>
    </div>
  );
}
