"use client";

import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { Mascot } from "@/components/brand/mascot";
import { Spinner } from "@/components/ui";
import { authClient } from "@/lib/auth/client";
import { safeCallbackPath } from "@/lib/auth/redirect";
import { withBasePath } from "@/lib/base-path";
import type { TKey } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";

const ERROR_KEYS: Record<string, TKey> = {
  not_allowed: "login.err.notAllowed",
  access_denied: "login.err.denied",
  email_not_verified: "login.err.unverified",
  state_not_found: "login.err.expired",
  state_mismatch: "login.err.expired",
  please_restart_the_process: "login.err.expired",
  invalid_state: "login.err.expired",
  nonce_binding_missing: "login.err.expired",
  no_code: "login.err.failed",
  invalid_code: "login.err.invalid",
  invalid_callback_request: "login.err.badRequest",
  unable_to_get_user_info: "login.err.unexpected",
  issuer_mismatch: "login.err.unexpected",
  server_error: "login.err.unavailable",
  temporarily_unavailable: "login.err.unavailable",
  internal_server_error: "login.err.unavailable",
  provider_unavailable: "login.err.unavailable",
};

export function LoginForm({ callbackURL, error }: { callbackURL: string; error: string | null }) {
  const { t } = useT();
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const message = localError ?? (error ? t(ERROR_KEYS[error.toLowerCase()] ?? "login.err.default") : null);

  const signIn = async () => {
    setPending(true);
    setLocalError(null);
    const target = safeCallbackPath(callbackURL);
    try {
      const result = await authClient.signIn.social({
        provider: "onionrings",
        // Better Auth non conosce il basePath di Next: i path di ritorno vanno prefissati a mano.
        callbackURL: withBasePath(target),
        errorCallbackURL: withBasePath(
          target === "/" ? "/login" : `/login?callbackURL=${encodeURIComponent(target)}`,
        ),
      });
      if (result?.error) {
        setLocalError(t("login.err.unavailable"));
        setPending(false);
      }
      // In caso di successo il browser viene reindirizzato a OnionRings.
    } catch {
      setLocalError(t("login.err.unavailable"));
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-6 py-12">
      <div className="w-full max-w-[380px]">
        <Mascot mood="idle" size={148} animated />
        <h1 className="mt-6">
          <Logo variant="word" tone="dark" size={48} />
        </h1>
        <p className="mt-3 font-serif text-[24px] italic leading-[1.1] tracking-[-0.01em] text-ink-2">
          {t("brand.tagline")}
        </p>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
          {t("login.sub")}
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
          {pending ? t("login.pending") : t("login.button")}
        </button>
      </div>
    </main>
  );
}
