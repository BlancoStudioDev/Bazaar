import { ImageResponse } from "next/og";

import { Logo } from "@/components/brand/logo";
import { Mascot } from "@/components/brand/mascot";
import { TAGLINE_BOX, TAGLINE_LINES } from "@/components/brand/paths";

const size = { width: 1200, height: 630 };

// Tagline in curve (Instrument Serif Italic): nessun font da caricare, resa identica ovunque.
const TAG_SCALE = 88 / 1000;

// Route handler (non la convenzione opengraph-image): con basePath Next non prefissa i link dei file generati.
export function GET() {
  const lineW = Math.ceil(Math.max(...TAGLINE_LINES.map((l) => l.width)) * TAG_SCALE) + 12;
  const lineH = Math.ceil((TAGLINE_BOX.ascent + TAGLINE_BOX.descent) * TAG_SCALE) + 8;
  const logoH = 64;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f5f1e8",
          padding: "72px 80px",
          position: "relative",
        }}
      >
        <Logo tone="dark" size={logoH} literal />
        <div style={{ display: "flex", flexDirection: "column" }}>
          {TAGLINE_LINES.map((line) => (
            <svg
              key={line.path.length}
              width={lineW}
              height={lineH}
              viewBox={`${-6 + line.left * TAG_SCALE} ${-TAGLINE_BOX.ascent * TAG_SCALE - 4} ${lineW} ${lineH}`}
            >
              <path d={line.path} transform={`scale(${TAG_SCALE})`} fill="#171512" />
            </svg>
          ))}
          <div style={{ marginTop: 28, width: 96, height: 4, background: "#e8451f" }} />
        </div>
        <div style={{ display: "flex", position: "absolute", right: 72, top: 96 }}>
          <Mascot mood="sniff" size={440} literal />
        </div>
      </div>
    ),
    { ...size },
  );
}
