"use client";

import { useRouter } from "next/navigation";

import { LANGS, LANG_NATIVE_NAMES, isLang, type Lang } from "@/lib/i18n";
import { persistLangCookie } from "@/lib/i18n/client";

/** Selettore di lingua della landing: salva il cookie e ricarica i dati server (la pagina è renderizzata lato server). */
export function LangSwitcher({ lang, label }: { lang: Lang; label: string }) {
  const router = useRouter();
  return (
    <label className="lp-lang">
      <span className="lp-sr">{label}</span>
      <select
        value={lang}
        onChange={(event) => {
          if (!isLang(event.target.value)) return;
          persistLangCookie(event.target.value);
          router.refresh();
        }}
        aria-label={label}
      >
        {LANGS.map((code) => (
          <option key={code} value={code}>
            {LANG_NATIVE_NAMES[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
