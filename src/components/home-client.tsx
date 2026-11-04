"use client";

import { AppShell } from "@/components/app-shell";
import type { Lang } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/client";
import { useBazaar } from "@/lib/use-bazaar";

export interface ClientUser {
  id: string;
  name: string;
  email: string;
  authEnabled: boolean;
}

export function HomeClient({ user, initialLang }: { user: ClientUser; initialLang?: Lang }) {
  const store = useBazaar(user.id, initialLang);
  return (
    <I18nProvider lang={store.lang}>
      <AppShell store={store} user={user} />
    </I18nProvider>
  );
}
