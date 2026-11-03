import type { CSSProperties } from "react";

import { MARK_HOLES, MARK_SILHOUETTE, NOSE } from "@/components/brand/paths";

export type MascotMood = "idle" | "sniff" | "happy" | "confused" | "refuse";

type Palette = { ink: string; ink2: string; cream: string; accent: string; light: string };

// Con i token CSS il disegno segue il tema; `literal` serve dove i var() non esistono (immagini OG).
const TOKENS: Palette = {
  ink: "var(--color-ink, #171512)",
  ink2: "var(--color-ink-2, #4d483f)",
  cream: "var(--color-card, #fffdf8)",
  accent: "var(--color-accent, #e8451f)",
  light: "var(--color-sidebar-ink, #f6f1e7)",
};
const LITERAL: Palette = { ink: "#171512", ink2: "#4d483f", cream: "#fffdf8", accent: "#e8451f", light: "#f6f1e7" };

// Geometria della testa (spazio 32x32, la stessa del marchio).
const EAR_L = "M3 0.5 L14.2 14.6 L6.2 19.4 Z";
const EAR_R = "M29 0.5 L17.8 14.6 L25.8 19.4 Z";
// Orecchio destro piegato (confused): la punta cade di lato.
const EAR_R_FOLD = "M17.8 14.6 L25.6 5.4 L31.2 9.4 L25.8 19.4 Z";
const EAR_IN_R_FOLD = "M23.2 10.4 L28 11.2 L25 16.2 Z";
const EAR_IN_L = "M5 6 L11.4 13.8 L7 16.6 Z";
const EAR_IN_R = "M27 6 L20.6 13.8 L25 16.6 Z";
const FACE = "M6.8 17 Q9 14.4 16 14.2 Q23 14.4 25.2 17 L28.2 22.4 L23.4 22.6 Q21 27.5 16 30.4 Q11 27.5 8.6 22.6 L3.8 22.4 Z";
const MUZZLE = "M8.6 22 Q12 19.4 16 22.8 Q20 19.4 23.4 22 Q21.6 27 16 29.8 Q10.4 27 8.6 22 Z";

const EYE_L = { x: 11.4, y: 18 };
const EYE_R = { x: 20.6, y: 18 };

const HEAD_TILT: Record<MascotMood, number> = { idle: 0, sniff: -7, happy: 0, confused: 5, refuse: -2 };

// Le parti sono funzioni (non componenti) così il disegno resta serializzabile anche da next/og.
function Eyes({ mood, c }: { mood: MascotMood; c: Palette }) {
  if (mood === "happy") {
    return (
      <g fill="none" stroke={c.cream} strokeWidth="1.35" strokeLinecap="round">
        <path d={`M${EYE_L.x - 2.1} ${EYE_L.y + 0.8} Q${EYE_L.x} ${EYE_L.y - 2.2} ${EYE_L.x + 2.1} ${EYE_L.y + 0.8}`} />
        <path d={`M${EYE_R.x - 2.1} ${EYE_R.y + 0.8} Q${EYE_R.x} ${EYE_R.y - 2.2} ${EYE_R.x + 2.1} ${EYE_R.y + 0.8}`} />
      </g>
    );
  }
  const ry = mood === "refuse" ? 1.1 : mood === "sniff" ? 1.25 : 1.6;
  // Direzione dello sguardo: sniff verso l'alto/destra, confused di lato, refuse in basso.
  const look =
    mood === "sniff" ? { dx: 0.8, dy: -0.3 } : mood === "confused" ? { dx: -0.6, dy: -0.5 } : mood === "refuse" ? { dx: 0, dy: 0.3 } : { dx: 0, dy: 0.1 };
  return (
    <g className="fx-eyes">
      {[EYE_L, EYE_R].map((eye, index) => (
        <g key={index} transform={`rotate(${index === 0 ? 10 : -10} ${eye.x} ${eye.y})`}>
          <ellipse cx={eye.x} cy={eye.y} rx="2.4" ry={ry} fill={c.cream} />
          <circle cx={eye.x + look.dx * 0.8} cy={eye.y + look.dy * 0.6} r={mood === "refuse" ? 0.9 : 1.05} fill={c.ink} />
        </g>
      ))}
    </g>
  );
}

function Brows({ mood, c }: { mood: MascotMood; c: Palette }) {
  const props = { fill: "none", stroke: c.cream, strokeWidth: 0.95, strokeLinecap: "round" as const };
  if (mood === "confused") {
    return (
      <g {...props}>
        <path d="M9.2 16.6 L13.2 16.9" />
        <path d="M18.6 16 Q20.8 14.4 23 15.4" />
      </g>
    );
  }
  if (mood === "refuse") {
    // Sopracciglia con l'estremo interno alzato: "mi dispiace, non posso".
    return (
      <g {...props}>
        <path d="M9 16.8 L13.2 15.6" />
        <path d="M23 16.8 L18.8 15.6" />
      </g>
    );
  }
  return null;
}

function Mouth({ mood, c }: { mood: MascotMood; c: Palette }) {
  const props = { fill: "none", stroke: c.ink, strokeWidth: 0.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (mood) {
    case "happy":
      return <path d="M13.9 27 Q16 30 18.1 27 Z" fill={c.ink} stroke={c.ink} strokeWidth="0.6" strokeLinejoin="round" />;
    case "confused":
      return <path d="M14.2 28 Q15.1 27 16 28 Q16.9 29 17.8 28" {...props} />;
    case "refuse":
      return <path d="M14.6 28 H17.4" {...props} />;
    case "sniff":
      return <path d="M14.8 27.7 Q16 28.5 17.2 27.7" {...props} />;
    default:
      return <path d="M16 27.1 V27.7 M14.2 27.4 Q15.1 28.5 16 27.7 Q16.9 28.5 17.8 27.4" {...props} />;
  }
}

function Head({ mood, c }: { mood: MascotMood; c: Palette }) {
  const folded = mood === "confused";
  return (
    <g>
      <g className="fx-ear fx-ear-l">
        <path d={EAR_L} fill={c.ink} stroke={c.ink} strokeWidth="0.9" strokeLinejoin="round" />
        <path d={EAR_IN_L} fill={c.ink2} />
      </g>
      <g className="fx-ear fx-ear-r">
        <path d={folded ? EAR_R_FOLD : EAR_R} fill={c.ink} stroke={c.ink} strokeWidth="0.9" strokeLinejoin="round" />
        <path d={folded ? EAR_IN_R_FOLD : EAR_IN_R} fill={c.ink2} />
      </g>
      <path d={FACE} fill={c.ink} stroke={c.ink} strokeWidth="0.6" strokeLinejoin="round" />
      <path d={MUZZLE} fill={c.cream} />
      {Eyes({ mood, c })}
      {Brows({ mood, c })}
      <circle className="fx-nose" cx={NOSE.cx} cy={NOSE.cy} r={mood === "sniff" ? NOSE.r + 0.2 : NOSE.r} fill={c.accent} />
      {Mouth({ mood, c })}
    </g>
  );
}

const STRIPES = Array.from({ length: 8 }, (_, index) => 16 + index * 16);

/** Bancarella: tendone a righe con festoni, il "banco" da cui Fiuto si affaccia. */
function Stall({ c }: { c: Palette }) {
  return (
    <g strokeLinejoin="round">
      {STRIPES.map((x, index) => (
        <path
          key={x}
          d={`M${x} 98 H${x + 16} V117 A8 8 0 0 1 ${x} 117 Z`}
          fill={index % 2 === 0 ? c.accent : c.cream}
          stroke={c.ink}
          strokeWidth="2"
        />
      ))}
    </g>
  );
}

function Paws({ mood, c }: { mood: MascotMood; c: Palette }) {
  return (
    <g fill={c.ink}>
      <ellipse cx="60" cy="97" rx="8" ry="5" />
      {mood === "refuse" ? (
        <g className="fx-paw">
          <path d="M112 99 L127 82" stroke={c.ink} strokeWidth="10" strokeLinecap="round" fill="none" />
          <ellipse cx="130" cy="72" rx="8.4" ry="9" transform="rotate(14 130 72)" />
          <ellipse cx="130.6" cy="75" rx="3.2" ry="2.7" fill={c.cream} />
          <circle cx="124.6" cy="68" r="1.5" fill={c.cream} />
          <circle cx="129.4" cy="65.4" r="1.5" fill={c.cream} />
          <circle cx="134.6" cy="65.8" r="1.5" fill={c.cream} />
        </g>
      ) : (
        <ellipse cx="100" cy="97" rx="8" ry="5" />
      )}
    </g>
  );
}

/**
 * Fiuto, la volpe del deserto di Bazaar. Cinque umori, animazioni solo CSS (vedi globals.css, `.fx-*`),
 * spente con prefers-reduced-motion. `size` è la larghezza in px. Decorativa per default (aria-hidden):
 * passa `title` per esporla alle tecnologie assistive.
 */
export function Mascot({
  mood = "idle",
  size = 160,
  animated = false,
  literal = false,
  title,
  className,
  style,
}: {
  mood?: MascotMood;
  size?: number;
  animated?: boolean;
  /** Colori letterali invece dei token CSS (per OG/immagini generate). */
  literal?: boolean;
  title?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const tilt = HEAD_TILT[mood];
  const c = literal ? LITERAL : TOKENS;
  return (
    <svg
      viewBox="12 -4 140 132"
      width={size}
      height={(size * 132) / 140}
      className={`fx fx-${mood}${animated ? " is-animated" : ""}${className ? ` ${className}` : ""}`}
      style={{ display: "block", flexShrink: 0, overflow: "visible", ...style }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <g className="fx-body">
        <g transform="translate(28.8 2) scale(3.2)">
          <g className="fx-head" transform={tilt ? `rotate(${tilt} 16 28)` : undefined}>
            {Head({ mood, c })}
          </g>
        </g>
        {Stall({ c })}
        {Paws({ mood, c })}
      </g>
    </svg>
  );
}

/**
 * Avatar tondo (28–32 px) per i messaggi: la testa di Fiuto in crema su fondo inchiostro.
 * A questa dimensione contano solo silhouette, occhi e naso.
 */
export function MascotBadge({
  size = 28,
  animated = false,
  literal = false,
  className,
}: {
  size?: number;
  animated?: boolean;
  literal?: boolean;
  className?: string;
}) {
  const c = literal ? LITERAL : TOKENS;
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={`fx fx-badge${animated ? " is-animated" : ""}${className ? ` ${className}` : ""}`}
      style={{ display: "block", flexShrink: 0 }}
      aria-hidden
      focusable="false"
    >
      <circle cx="16" cy="16" r="16" fill={c.ink} />
      <g transform="translate(16 17.2) scale(0.74) translate(-16 -16)">
        <path d={`${MARK_SILHOUETTE} ${MARK_HOLES}`} fill={c.light} fillRule="evenodd" />
        <circle className="fx-nose" cx={NOSE.cx} cy={NOSE.cy} r={NOSE.r} fill={c.accent} />
      </g>
    </svg>
  );
}
