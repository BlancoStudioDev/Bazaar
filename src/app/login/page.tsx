import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/app/login/login-form";
import { safeCallbackPath } from "@/lib/auth/redirect";
import { resolveSession } from "@/lib/auth/session";
import { t } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/client";
import { requestLang } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await requestLang(), "login.metaTitle") };
}

async function Gate({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const pick = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const callbackURL = safeCallbackPath(pick(params.callbackURL));
  let error = pick(params.error) ?? null;

  const lang = await requestLang();
  const result = await resolveSession(await headers());
  if (result.user) redirect(callbackURL);
  if (result.denied) error = "not_allowed";

  return (
    <I18nProvider lang={lang}>
      <LoginForm callbackURL={callbackURL} error={error} />
    </I18nProvider>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-paper" />}>
      <Gate searchParams={props.searchParams} />
    </Suspense>
  );
}
