import { ImageResponse } from "next/og";

import { MARK_HOLES, MARK_SILHOUETTE } from "@/components/brand/paths";

const size = { width: 180, height: 180 };

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#171512",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 32 32">
          <path d={`${MARK_SILHOUETTE} ${MARK_HOLES}`} fill="#f6f1e7" fillRule="evenodd" />
          <circle cx="16" cy="25.4" r="2.3" fill="#e8451f" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
