"use client";

import { useState } from "react";

import { Spinner } from "@/components/ui";
import { authClient } from "@/lib/auth/client";
import { safeCallbackPath } from "@/lib/auth/redirect";

const ERROR_MESSAGES: Record<string, string> = {
  not_allowed:
    "Questo account non è autorizzato ad accedere a Bazaar. Prova con un altro account OnionRings o chiedi di essere aggiunto.",
  access_denied: "Hai negato il consenso su OnionRings. Per entrare serve accettarlo: riprova quando vuoi.",
  email_not_verified: "L'email del tuo account OnionRings non è verificata. Verificala e riprova.",
  state_not_found: "La richiesta di accesso è scaduta. Riprova.",
  state_mismatch: "La richiesta di accesso è scaduta. Riprova.",
  please_restart_the_process: "La richiesta di accesso è scaduta. Riprova.",
  invalid_state: "La richiesta di accesso è scaduta. Riprova.",
  no_code: "La richiesta di accesso non è andata a buon fine. Riprova.",
  invalid_code: "La richiesta di accesso è scaduta o non è valida. Riprova.",
  invalid_callback_request: "La richiesta di accesso non è valida. Riprova.",
  nonce_binding_missing: "La richiesta di accesso è scaduta. Riprova.",
  unable_to_get_user_info: "OnionRings non ha risposto come previsto. Riprova tra poco.",
  issuer_mismatch: "OnionRings non ha risposto come previsto. Riprova tra poco.",
  server_error: "OnionRings non è raggiungibile al momento. Riprova tra poco.",
  temporarily_unavailable: "OnionRings non è raggiungibile al momento. Riprova tra poco.",
  internal_server_error: "OnionRings non è raggiungibile al momento. Riprova tra poco.",
  provider_unavailable: "OnionRings non è raggiungibile al momento. Riprova tra poco.",
};

function messageFor(code: string | null): string | null {
  if (!code) return null;
  return ERROR_MESSAGES[code.toLowerCase()] ?? "Accesso non riuscito. Riprova.";
}

export function LoginForm({ callbackURL, error }: { callbackURL: string; error: string | null }) {
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const message = localError ?? messageFor(error);

  const signIn = async () => {
    setPending(true);
    setLocalError(null);
    const target = safeCallbackPath(callbackURL);
    try {
      const result = await authClient.signIn.social({
        provider: "onionrings",
        callbackURL: target,
        errorCallbackURL: target === "/" ? "/login" : `/login?callbackURL=${encodeURIComponent(target)}`,
      });
      if (result?.error) {
        setLocalError(ERROR_MESSAGES.provider_unavailable);
        setPending(false);
      }
      // In caso di successo il browser viene reindirizzato a OnionRings.
    } catch {
      setLocalError(ERROR_MESSAGES.provider_unavailable);
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-6 py-12">
      <div className="w-full max-w-[380px]">
        <h1 className="font-serif text-[56px] leading-none text-ink">Bazaar</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          Il tuo personal shopper: confronta prezzi reali su più marketplace in un'unica chat.
        </p>

        {message ? (
          <p
            role="alert"
            className="mt-8 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-[13px] leading-relaxed text-ink"
          >
            {message}
          </p>
        ) : null}

        <button
          type="button"
          onClick={signIn}
          disabled={pending}
          className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink text-[14px] font-medium text-paper transition hover:bg-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-70"
        >
          {pending ? <Spinner className="h-4 w-4" /> : null}
          {pending ? "Reindirizzamento…" : "Accedi con OnionRings"}
        </button>
      </div>
    </main>
  );
}
