import type { Metadata } from "next";

import { Landing } from "@/components/landing/landing";

// Anteprima sempre pubblica della landing (anche con auth disattiva). Non indicizzata: la copia canonica è `/`.
export const metadata: Metadata = {
  title: "Bazaar: il fiuto giusto per ogni affare",
  robots: { index: false, follow: false },
};

export default function LandingPreview() {
  return <Landing />;
}
