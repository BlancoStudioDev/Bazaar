import type { CSSProperties } from "react";

import { MARK_HOLES, MARK_SILHOUETTE, NOSE, NOSE_HOLE, WORDMARK_BOX, WORDMARK_PATH } from "@/components/brand/paths";

export type LogoTone = "auto" | "light" | "dark";

const TONES: Record<LogoTone, string> = {
  // auto: segue il colore del testo dove viene inserito (chiaro o scuro).
  auto: "currentColor",
  light: "var(--color-sidebar-ink, #f6f1e7)",
  dark: "var(--color-ink, #171512)",
};

const ACCENT = "var(--color-accent, #e8451f)";
const LITERAL_TONES: Record<LogoTone, string> = { auto: "#171512", light: "#f6f1e7", dark: "#171512" };

// Lockup orizzontale: mark 32x32 + wordmark (altezza ascendente 26, baseline y=28).
const WORD_SCALE = 26 / WORDMARK_BOX.ascent;
const WORD_X = 38;
const WORD_BASELINE = 28;
const FULL_WIDTH = Math.ceil(WORD_X + WORDMARK_BOX.width * WORD_SCALE);

/**
 * Marchio di Bazaar: la testa di Fiuto (orecchie a punta, naso vermiglio).
 * `variant="mark"` è solo la testa, `word` solo il wordmark, `full` testa + wordmark.
 * `size` è l'altezza in px. `mono` toglie il vermiglio (il naso diventa un foro).
 */
export function Logo({
  variant = "full",
  tone = "auto",
  size = 28,
  mono = false,
  literal = false,
  className,
  style,
}: {
  variant?: "full" | "mark" | "word";
  tone?: LogoTone;
  size?: number;
  mono?: boolean;
  /** Colori letterali invece dei token CSS (per OG/immagini generate). */
  literal?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const fill = literal ? LITERAL_TONES[tone] : TONES[tone];
  const width = variant === "mark" ? 32 : variant === "word" ? FULL_WIDTH - WORD_X : FULL_WIDTH;
  const showMark = variant !== "word";
  return (
    <svg
      role="img"
      aria-label="Bazaar"
      viewBox={`${variant === "word" ? WORD_X : 0} 0 ${width} 32`}
      width={(size * width) / 32}
      height={size}
      className={className}
      style={{ display: "block", flexShrink: 0, ...style }}
      fill={fill}
    >
      {showMark ? (
        <path d={mono ? `${MARK_SILHOUETTE} ${MARK_HOLES} ${NOSE_HOLE}` : `${MARK_SILHOUETTE} ${MARK_HOLES}`} fillRule="evenodd" />
      ) : null}
      {mono || !showMark ? null : <circle cx={NOSE.cx} cy={NOSE.cy} r={NOSE.r} fill={literal ? "#e8451f" : ACCENT} />}
      {variant !== "mark" ? (
        <path
          d={WORDMARK_PATH}
          transform={`translate(${WORD_X} ${WORD_BASELINE}) scale(${WORD_SCALE})`}
        />
      ) : null}
    </svg>
  );
}
