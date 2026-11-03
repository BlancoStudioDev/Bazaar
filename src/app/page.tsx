import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { HomeClient } from "@/components/home-client";
import { resolveSession } from "@/lib/auth/session";

async function Gate() {
  const result = await resolveSession(await headers());
  if (!result.user) redirect(result.denied ? "/login?error=not_allowed" : "/login");
  return <HomeClient user={result.user} />;
}

export default function Home() {
  return (
    <Suspense fallback={<div className="h-dvh bg-paper" />}>
      <Gate />
    </Suspense>
  );
}
