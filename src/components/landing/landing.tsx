import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Mascot, MascotBadge } from "@/components/brand/mascot";
import { LangSwitcher } from "@/components/landing/lang-switcher";
import { BASE_PATH } from "@/lib/base-path";
import { I18nProvider } from "@/lib/i18n/client";
import { t as translate, type Lang } from "@/lib/i18n";

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
  { where: "Subito.it", what: "lp.row1", price: "48 €" },
  { where: "AliExpress", what: "lp.row2", price: "44 €" },
  { where: "Vinted", what: "lp.row3", price: "52 €" },
  { where: "Amazon.it", what: "lp.row4", price: "59 €" },
] as const;

const DIFFERENCES = ["lp.d1", "lp.d2", "lp.d3", "lp.d4", "lp.d5"] as const;
const FAQ = ["lp.f1", "lp.f2", "lp.f3", "lp.f4", "lp.f5", "lp.f6"] as const;

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

function jsonLd(lang: Lang) {
  const origin = (process.env.BETTER_AUTH_URL ?? "").trim().replace(/\/+$/, "");
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Bazaar",
    description: translate(lang, "lp.ldDescription"),
    applicationCategory: "ShoppingApplication",
    operatingSystem: "Web",
    inLanguage: lang,
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    creator: { "@type": "Organization", name: "BlancoStudio" },
  };
  if (origin) data.url = `${origin}${BASE_PATH}/`;
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function Landing({ lang }: { lang: Lang }) {
  const t = (key: Parameters<typeof translate>[1], vars?: Parameters<typeof translate>[2]) => translate(lang, key, vars);
  return (
    <I18nProvider lang={lang}>
    <div className="lp">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(lang) }} />
      <a href="#lp-main" className="lp-skip">
        {t("lp.skip")}
      </a>
      <div className="lp-awning" aria-hidden />

      <header className="lp-nav lp-wrap">
        <Link href="/" className="lp-nav-logo" aria-label={t("lp.homeAria")}>
          <Logo tone="dark" size={28} />
        </Link>
        <div className="lp-nav-end">
          <LangSwitcher lang={lang} label={t("lp.langLabel")} />
          <Link href="/login" className="lp-nav-link">
            {t("lp.signIn")}
          </Link>
        </div>
      </header>

      <main id="lp-main">
        {/* 1. Hero */}
        <section className="lp-hero lp-wrap" aria-labelledby="lp-h1">
          <div className="lp-hero-copy">
            <p className="lp-tagline lp-rise" style={{ "--d": "0ms" } as React.CSSProperties}>
              {t("brand.tagline")}
            </p>
            <h1 id="lp-h1" className="lp-h1 lp-rise" style={{ "--d": "60ms" } as React.CSSProperties}>
              {t("lp.h1a")} <em>{t("lp.h1b")}</em>
            </h1>
            <p className="lp-lead lp-rise" style={{ "--d": "120ms" } as React.CSSProperties}>
              {t("lp.lead")}
            </p>
            <div className="lp-rise" style={{ "--d": "180ms" } as React.CSSProperties}>
              <Cta>{t("lp.cta")}</Cta>
              <p className="lp-trust">{t("lp.trust")}</p>
            </div>
          </div>
          <div className="lp-hero-fox lp-rise" style={{ "--d": "100ms" } as React.CSSProperties}>
            <Mascot mood="idle" size={460} animated title={t("lp.foxTitle")} />
          </div>
        </section>

        {/* 2. Come funziona */}
        <section className="lp-section lp-wrap" aria-labelledby="lp-how">
          <h2 id="lp-how" className="lp-h2">
            {t("lp.howTitle")}
          </h2>
          <ol className="lp-steps">
            <li className="lp-step">
              <div className="lp-step-visual lp-step-query">
                <p>{t("lp.step1.query")}</p>
              </div>
              <p className="lp-step-n">01</p>
              <h3 className="lp-h3">{t("lp.step1.title")}</h3>
              <p className="lp-body">{t("lp.step1.body")}</p>
            </li>
            <li className="lp-step">
              <div className="lp-step-visual">
                <Mascot mood="sniff" size={150} animated />
              </div>
              <p className="lp-step-n">02</p>
              <h3 className="lp-h3">{t("lp.step2.title")}</h3>
              <p className="lp-body">{t("lp.step2.body")}</p>
            </li>
            <li className="lp-step">
              <div className="lp-step-visual">
                <Mascot mood="happy" size={150} animated />
              </div>
              <p className="lp-step-n">03</p>
              <h3 className="lp-h3">{t("lp.step3.title")}</h3>
              <p className="lp-body">{t("lp.step3.body")}</p>
            </li>
          </ol>
        </section>

        {/* 3. Demo */}
        <section className="lp-demo-band" aria-labelledby="lp-demo">
          <div className="lp-wrap lp-demo">
            <div className="lp-demo-copy">
              <h2 id="lp-demo" className="lp-h2">
                {t("lp.demoTitle1")} <em>{t("lp.demoTitle2")}</em>
              </h2>
              <p className="lp-body">
                {t("lp.demoBody")}
              </p>
            </div>

            <figure className="lp-chat" aria-label={t("lp.chatAria")}>
              <figcaption className="lp-chat-head">
                <span className="lp-tag">{t("lp.chatTag")}</span>
                <span className="lp-chat-note">{t("lp.chatNote")}</span>
              </figcaption>

              <div className="lp-msg-user">{t("lp.chatUser")}</div>

              <div className="lp-msg-fiuto">
                <MascotBadge size={32} />
                <div className="lp-msg-body">
                  <p>{t("lp.chatIntro")}</p>
                  <div className="lp-table-wrap">
                    <table className="lp-table">
                      <caption className="lp-sr">{t("lp.tableCaption")}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{t("lp.thWhere")}</th>
                          <th scope="col">{t("lp.thListing")}</th>
                          <th scope="col" className="lp-num">
                            {t("lp.thPrice")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {DEMO_ROWS.map((row) => (
                          <tr key={row.where}>
                            <th scope="row">{row.where}</th>
                            <td>{t(row.what)}</td>
                            <td className="lp-num">{row.price}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p>
                    <strong>{t("lp.advice")}</strong> {t("lp.adviceBody")}
                  </p>
                  <p className="lp-run">{t("lp.run")}</p>
                </div>
              </div>
            </figure>
          </div>
        </section>

        {/* 4. Cosa fa di diverso */}
        <section className="lp-section lp-wrap lp-diff" aria-labelledby="lp-diff">
          <h2 id="lp-diff" className="lp-h2">
            {t("lp.diffTitle1")} <em>{t("lp.diffTitle2")}</em>
          </h2>
          <ul className="lp-diff-list">
            {DIFFERENCES.map((item) => (
              <li key={item}>
                <h3 className="lp-h3">{t(`${item}.title`)}</h3>
                <p className="lp-body">{t(`${item}.body`)}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* 5. Marketplace */}
        <section className="lp-markets" aria-label={t("lp.marketsAria")}>
          <div className="lp-wrap">
            <p className="lp-markets-label">{t("lp.marketsLabel")}</p>
            <ul className="lp-markets-list">
              {MARKETPLACES.map((m) => (
                <li key={m.name} className={m.cls}>
                  {m.name}
                </li>
              ))}
            </ul>
            <p className="lp-fine">{t("lp.marketsFine")}</p>
          </div>
        </section>

        {/* 6. FAQ */}
        <section className="lp-section lp-wrap lp-faq" aria-labelledby="lp-faq">
          <h2 id="lp-faq" className="lp-h2">
            {t("lp.faqTitle1")} <em>{t("lp.faqTitle2")}</em>
          </h2>
          <div className="lp-faq-list">
            {FAQ.map((item) => (
              <details key={item} className="lp-details">
                <summary>{t(`${item}.q`)}</summary>
                <p>{t(`${item}.a`)}</p>
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
                {t("lp.finalTitle")}
              </h2>
              <p className="lp-lead">{t("lp.finalLead")}</p>
              <Cta>{t("lp.cta")}</Cta>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer lp-wrap">
        <Logo tone="dark" size={24} />
        <p>{t("lp.footerBy")}</p>
        <Link href="/login" className="lp-nav-link">
          {t("lp.signIn")}
        </Link>
      </footer>
    </div>
    </I18nProvider>
  );
}
