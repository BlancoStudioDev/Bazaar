export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Valida le env all'avvio: in produzione credenziali mancanti = errore chiaro.
  const { getAuthConfig } = await import("@/lib/auth/config");
  const config = getAuthConfig();
  if (config.mode !== "enabled") return;

  const { getAuth } = await import("@/lib/auth/auth");
  const auth = getAuth();
  if (!auth) return;
  // Applica le migrazioni Better Auth (idempotente), come `npm run auth:migrate`.
  const { getMigrations } = await import("better-auth/db/migration");
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
  console.info(`[auth] OnionRings attivo (issuer ${config.issuer}), database ${config.dbPath}`);
}
