"use client";

import { AppShell } from "@/components/app-shell";
import { useBazaar } from "@/lib/use-bazaar";

export default function Home() {
  const store = useBazaar();
  return <AppShell store={store} />;
}
