import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SharedChat } from "@/app/s/[token]/shared-chat";
import { isValidShareToken } from "@/lib/share/snapshot";
import { getActiveShare } from "@/lib/share/store";

export const metadata: Metadata = {
  title: "Chat condivisa — Bazaar",
  description: "Una ricerca fatta su Bazaar, condivisa in sola lettura.",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
  referrer: "no-referrer",
};

async function Content({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Formato non valido: 404 senza toccare il database.
  if (!isValidShareToken(token)) notFound();
  const share = getActiveShare(token);
  if (!share) notFound();
  return <SharedChat snapshot={share.snapshot} sharedAt={share.createdAt} />;
}

export default function SharedPage(props: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-paper" />}>
      <Content params={props.params} />
    </Suspense>
  );
}
