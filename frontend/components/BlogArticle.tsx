import Link from "next/link";

export interface BlogSection {
  heading: string;
  paragraphs: string[];
  list?: string[];
}

export interface BlogFaqItem {
  question: string;
  answer: string;
}

export interface BlogRelatedLink {
  label: string;
  href: string;
}

export function BlogArticle({
  title,
  description,
  updatedAt,
  sections,
  faq,
  related
}: {
  title: string;
  description: string;
  updatedAt: string;
  sections: BlogSection[];
  faq?: BlogFaqItem[];
  related?: BlogRelatedLink[];
}) {
  const faqJsonLd =
    faq && faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.answer
            }
          }))
        }
      : null;

  return (
    <main className="min-h-screen bg-[#050505] px-4 text-white">
      {faqJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      )}
      <div className="mx-auto w-[min(calc(100%-32px),760px)] py-16">
        <Link href="/blog" className="text-sm font-semibold text-white/50 hover:text-white">
          ← Все статьи
        </Link>

        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-[#ff2b3a]">Блог</p>
        <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">{title}</h1>
        <p className="mt-4 text-[15px] leading-7 text-white/60">{description}</p>
        <p className="mt-2 text-sm text-white/45">Обновлено {updatedAt}</p>

        <div className="mt-10 space-y-8 text-[15px] leading-7 text-white/80">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-bold text-white">{section.heading}</h2>
              {section.paragraphs.map((paragraph, index) => (
                <p key={index} className="mt-2">
                  {paragraph}
                </p>
              ))}
              {section.list && (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {section.list.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {faq && faq.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-bold text-white">Частые вопросы</h2>
            <div className="mt-4 space-y-4">
              {faq.map((item) => (
                <div key={item.question} className="rounded-2xl border border-white/[0.08] bg-[#101010] p-4">
                  <p className="font-semibold text-white">{item.question}</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {related && related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-bold text-white">Похожие материалы</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {related.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg border border-white/[0.1] px-4 py-2 text-sm font-semibold text-white/80 hover:border-[#ff2b3a]/60 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12 flex flex-wrap gap-3">
          <Link className="rounded-lg bg-[#ef233c] px-5 py-3 text-sm font-bold" href="/cabinet/plans">
            Выбрать тариф
          </Link>
          <Link className="rounded-lg border border-white/[0.1] px-5 py-3 text-sm font-bold" href="/">
            На главную
          </Link>
        </div>
      </div>
    </main>
  );
}
