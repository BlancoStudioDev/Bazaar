import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Mascot, MascotBadge } from "@/components/brand/mascot";
import { BASE_PATH } from "@/lib/base-path";

/**
 * Landing pubblica di Bazaar. Server component, nessun JS client: solo HTML, SVG inline e CSS (`lp-*`
 * in globals.css). I dati della demo sono d'esempio e dichiarati tali.
 */

const MARKETPLACES = [
  { name: "Amazon.it", cls: "lp-brand-serif" },
  { name: "AliExpress", cls: "lp-brand-mono" },
  { name: "Vinted", cls: "lp-brand-serif-i" },
  { name: "Subito.it", cls: "lp-brand-mono-b" },
];

const DEMO_ROWS = [
  { where: "Subito.it", what: "Usato, 8 mesi · Torino, ritiro a mano", price: "48 €" },
  { where: "AliExpress", what: "Nuovo · arriva in circa 3 settimane", price: "44 €" },
  { where: "Vinted", what: "Usato, senza scatola", price: "52 €" },
  { where: "Amazon.it", what: "Nuovo · spedito da Amazon", price: "59 €" },
];

const DIFFERENCES = [
  {
    title: "Quattro bancarelle, una domanda",
    body: "Amazon, AliExpress, Vinted e Subito.it in un colpo solo. Niente venti schede aperte una accanto all'altra.",
  },
  {
    title: "Legge le descrizioni, non solo i titoli",
    body: "Il titolo dice «SSD 1 TB», la descrizione dice «solo la custodia». Fiuto le legge tutte e due.",
  },
  {
    title: "Scarta le trappole",
    body: "Prezzi-civetta, scatole vuote e kit con tre pezzi quando cercavi un modulo singolo restano fuori dal verdetto.",
  },
  {
    title: "Cerca nella tua città",
    body: "Per l'usato e il ritiro a mano filtra gli annunci vicino a te, così il prezzo giusto è anche a portata di strada.",
  },
  {
    title: "Chat da condividere con un link",
    body: "Una ricerca utile vale la pena mandarla a qualcuno. Chi la riceve la legge subito, senza login. Decidi tu se condividerla.",
  },
];

const FAQ = [
  {
    q: "Costa qualcosa?",
    a: "Oggi è gratuito, in fase di prova. Bazaar usa modelli AI gratuiti: quando c'è coda può essere più lento e ci sono dei limiti d'uso.",
  },
  {
    q: "Vendete dei prodotti?",
    a: "No. Bazaar cerca e confronta, non vende e non gestisce pagamenti. I link ti portano all'annuncio sul marketplace, dove compri o ritiri come sempre.",
  },
  {
    q: "Dove vanno i miei dati?",
    a: "Le tue conversazioni restano nel browser, su questo dispositivo. Una chat diventa pubblica solo se scegli di condividerla: in quel caso se ne salva un'istantanea, leggibile da chi ha il link. Per cercare, il testo della richiesta passa dai servizi AI e dai marketplace interrogati.",
  },
  {
    q: "I prezzi sono aggiornati?",
    a: "Fiuto li legge nel momento in cui cerchi. Poi possono cambiare: prima di muoverti apri l'annuncio e conferma prezzo e disponibilità.",
  },
  {
    q: "Perché serve un account?",
    a: "Per tenere dei limiti d'uso equi per tutti e per far funzionare la condivisione delle chat. Si entra con il tuo account OnionRings, senza carta.",
  },
  {
    q: "E Facebook Marketplace?",
    a: "Non ancora. Per ora Fiuto cerca su Amazon, AliExpress, Vinted e Subito.it.",
  },
];

function Cta({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <Link href="/login" className={`lp-cta ${className}`}>
      <span>{children}</span>
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden focusable="false" className="lp-cta-arrow">
        <path d="M4 10h11m-4.5-5L15.5 10l-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}

function jsonLd() {
  const origin = (process.env.BETTER_AUTH_URL ?? "").trim().replace(/\/+$/, "");
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Bazaar",
    description:
      "Una chat che cerca su Amazon, AliExpress, Vinted e Subito.it, legge le descrizioni degli annunci e confronta i prezzi. Non vende prodotti.",
    applicationCategory: "ShoppingApplication",
    operatingSystem: "Web",
    inLanguage: "it",
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    creator: { "@type": "Organization", name: "BlancoStudio" },
  };
  if (origin) data.url = `${origin}${BASE_PATH}/`;
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function Landing() {
  return (
    <div className="lp">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd() }} />
      <a href="#lp-main" className="lp-skip">
        Vai al contenuto
      </a>
      <div className="lp-awning" aria-hidden />

      <header className="lp-nav lp-wrap">
        <Link href="/" className="lp-nav-logo" aria-label="Bazaar, pagina iniziale">
          <Logo tone="dark" size={28} />
        </Link>
        <Link href="/login" className="lp-nav-link">
          Accedi
        </Link>
      </header>

      <main id="lp-main">
        {/* 1. Hero */}
        <section className="lp-hero lp-wrap" aria-labelledby="lp-h1">
          <div className="lp-hero-copy">
            <p className="lp-tagline lp-rise" style={{ "--d": "0ms" } as React.CSSProperties}>
              Il fiuto giusto per ogni affare.
            </p>
            <h1 id="lp-h1" className="lp-h1 lp-rise" style={{ "--d": "60ms" } as React.CSSProperties}>
              Basta venti schede aperte. <em>Chiedilo a Fiuto.</em>
            </h1>
            <p className="lp-lead lp-rise" style={{ "--d": "120ms" } as React.CSSProperties}>
              Una chat sola fa il giro di Amazon, AliExpress, Vinted e Subito.it e ti dice dove conviene davvero.
            </p>
            <div className="lp-rise" style={{ "--d": "180ms" } as React.CSSProperties}>
              <Cta>Accedi con OnionRings</Cta>
              <p className="lp-trust">Accesso con il tuo account OnionRings · nessuna carta richiesta</p>
            </div>
          </div>
          <div className="lp-hero-fox lp-rise" style={{ "--d": "100ms" } as React.CSSProperties}>
            <Mascot mood="idle" size={460} animated title="Fiuto, la volpe del deserto, dietro la sua bancarella" />
          </div>
        </section>

        {/* 2. Come funziona */}
        <section className="lp-section lp-wrap" aria-labelledby="lp-how">
          <h2 id="lp-how" className="lp-h2">
            Come funziona
          </h2>
          <ol className="lp-steps">
            <li className="lp-step">
              <div className="lp-step-visual lp-step-query">
                <p>Cerco un SSD NVMe da 1 TB, anche usato. Sono a Torino.</p>
              </div>
              <p className="lp-step-n">01</p>
              <h3 className="lp-h3">Scrivi cosa cerchi</h3>
              <p className="lp-body">Con le tue parole, come lo diresti a un amico. Budget, città e dettagli compresi.</p>
            </li>
            <li className="lp-step">
              <div className="lp-step-visual">
                <Mascot mood="sniff" size={150} animated />
              </div>
              <p className="lp-step-n">02</p>
              <h3 className="lp-h3">Fiuto fa il giro delle bancarelle</h3>
              <p className="lp-body">Interroga i marketplace in parallelo e legge gli annunci, non solo i titoli.</p>
            </li>
            <li className="lp-step">
              <div className="lp-step-visual">
                <Mascot mood="happy" size={150} animated />
              </div>
              <p className="lp-step-n">03</p>
              <h3 className="lp-h3">Ricevi il verdetto</h3>
              <p className="lp-body">Prezzi in fila, il consiglio in chiaro e i link diretti agli annunci.</p>
            </li>
          </ol>
        </section>

        {/* 3. Demo */}
        <section className="lp-demo-band" aria-labelledby="lp-demo">
          <div className="lp-wrap lp-demo">
            <div className="lp-demo-copy">
              <h2 id="lp-demo" className="lp-h2">
                Un verdetto, <em>non un elenco</em>
              </h2>
              <p className="lp-body">
                Fiuto non ti rovescia addosso cento risultati. Ti dice cosa ha scartato, cosa vale e dove, con onestà anche quando
                il prezzo più basso non è la scelta migliore.
              </p>
            </div>

            <figure className="lp-chat" aria-label="Esempio di conversazione con Fiuto">
              <figcaption className="lp-chat-head">
                <span className="lp-tag">Esempio</span>
                <span className="lp-chat-note">Prodotti e prezzi di fantasia, per mostrare come ragiona Fiuto.</span>
              </figcaption>

              <div className="lp-msg-user">Cerco un SSD NVMe da 1 TB, solo il modulo. Se è usato, a Torino.</div>

              <div className="lp-msg-fiuto">
                <MascotBadge size={32} />
                <div className="lp-msg-body">
                  <p>
                    Ho scartato 6 kit con più moduli e 2 annunci «solo scatola». Questi valgono la pena:
                  </p>
                  <div className="lp-table-wrap">
                    <table className="lp-table">
                      <caption className="lp-sr">Confronto prezzi d&apos;esempio</caption>
                      <thead>
                        <tr>
                          <th scope="col">Dove</th>
                          <th scope="col">Annuncio</th>
                          <th scope="col" className="lp-num">
                            Prezzo
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {DEMO_ROWS.map((row) => (
                          <tr key={row.where}>
                            <th scope="row">{row.where}</th>
                            <td>{row.what}</td>
                            <td className="lp-num">{row.price}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p>
                    <strong>Il mio consiglio:</strong> quello di Subito.it. AliExpress costa meno, ma tre settimane e nessuna garanzia
                    europea non valgono 4 €. Ritiri a mano e lo provi prima di pagare.
                  </p>
                  <p className="lp-run">Fiuto ha girato 4 bancarelle · 27 annunci</p>
                </div>
              </div>
            </figure>
          </div>
        </section>

        {/* 4. Cosa fa di diverso */}
        <section className="lp-section lp-wrap lp-diff" aria-labelledby="lp-diff">
          <h2 id="lp-diff" className="lp-h2">
            Cosa fa <em>di diverso</em>
          </h2>
          <ul className="lp-diff-list">
            {DIFFERENCES.map((item) => (
              <li key={item.title}>
                <h3 className="lp-h3">{item.title}</h3>
                <p className="lp-body">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* 5. Marketplace */}
        <section className="lp-markets" aria-label="Marketplace consultati">
          <div className="lp-wrap">
            <p className="lp-markets-label">Le bancarelle che Fiuto visita</p>
            <ul className="lp-markets-list">
              {MARKETPLACES.map((m) => (
                <li key={m.name} className={m.cls}>
                  {m.name}
                </li>
              ))}
            </ul>
            <p className="lp-fine">Marchi dei rispettivi proprietari, citati solo per indicare dove cerca Fiuto.</p>
          </div>
        </section>

        {/* 6. FAQ */}
        <section className="lp-section lp-wrap lp-faq" aria-labelledby="lp-faq">
          <h2 id="lp-faq" className="lp-h2">
            Domande, <em>risposte oneste</em>
          </h2>
          <div className="lp-faq-list">
            {FAQ.map((item) => (
              <details key={item.q} className="lp-details">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* 7. CTA finale */}
        <section className="lp-final" aria-labelledby="lp-final">
          <div className="lp-wrap lp-final-inner">
            <div className="lp-final-fox">
              <Mascot mood="happy" size={240} animated />
            </div>
            <div className="lp-final-copy">
              <h2 id="lp-final" className="lp-h2">
                Il banco è aperto.
              </h2>
              <p className="lp-lead">Dimmi cosa cerchi. Al resto pensa Fiuto.</p>
              <Cta>Accedi con OnionRings</Cta>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer lp-wrap">
        <Logo tone="dark" size={24} />
        <p>Bazaar by BlancoStudio</p>
        <Link href="/login" className="lp-nav-link">
          Accedi
        </Link>
      </footer>
    </div>
  );
}
