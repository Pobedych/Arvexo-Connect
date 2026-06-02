import Link from "next/link";

export function InstructionPage({
  title,
  appNames,
  steps
}: {
  title: string;
  appNames: string;
  steps: string[];
}) {
  return (
    <main className="min-h-screen bg-[#050505] px-4 py-10 text-white">
      <section className="mx-auto max-w-3xl rounded-[28px] border border-white/[0.08] bg-[#101010] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.55)] md:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff2b3a]">Инструкция</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[0]">{title}</h1>
        <p className="mt-4 text-[#a3a3a3]">{appNames}</p>
        <ol className="mt-8 grid gap-3">
          {steps.map((step, index) => (
            <li key={step} className="rounded-2xl border border-white/[0.08] bg-black/30 p-4 text-sm leading-6 text-white/78">
              <span className="mr-3 font-bold text-[#ff2b3a]">{index + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="rounded-lg bg-[#ef233c] px-5 py-3 text-sm font-bold" href="/cabinet">
            В кабинет
          </Link>
          <Link className="rounded-lg border border-white/[0.1] px-5 py-3 text-sm font-bold" href="/">
            На главную
          </Link>
        </div>
      </section>
    </main>
  );
}
