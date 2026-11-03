import Link from "next/link";

export const metadata = { title: "Pagina non trovata — Bazaar", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col justify-center px-6 py-16">
      <p className="meta uppercase">Errore 404</p>
      <h1 className="mt-3 font-serif text-[44px] leading-[1.02] tracking-[-0.03em] text-ink">
        Questa pagina non c&apos;è <span className="italic text-accent">più</span>
      </h1>
      <p className="mt-4 text-[14px] leading-relaxed text-ink-2">
        Il link potrebbe essere sbagliato oppure la chat non è più condivisa. Chiedi a chi te l&apos;ha inviato un nuovo
        link, oppure prova a cercare qualcosa tu.
      </p>
      <Link href="/login" className="btn-quiet mt-8 self-start">
        Cerca anche tu su Bazaar
      </Link>
    </main>
  );
}
