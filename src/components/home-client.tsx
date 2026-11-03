"use client";

import { AppShell } from "@/components/app-shell";
import { useBazaar } from "@/lib/use-bazaar";

export interface ClientUser {
  id: string;
  name: string;
  email: string;
  authEnabled: boolean;
}

export function HomeClient({ user }: { user: ClientUser }) {
  const store = useBazaar(user.id);
  return <AppShell store={store} user={user} />;
}
