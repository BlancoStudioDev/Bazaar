// Applica le migrazioni Better Auth sul database SQLite (AUTH_DB_PATH).
import fs from "node:fs";
import path from "node:path";

import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { genericOAuth } from "better-auth/plugins";
import Database from "better-sqlite3";

const dbFile = path.resolve(process.env.AUTH_DB_PATH?.trim() || "./data/auth.sqlite");
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const db = new Database(dbFile);

// Stesso schema di src/lib/auth/auth.ts (genericOAuth non aggiunge tabelle).
const auth = betterAuth({
  baseURL: "http://localhost:3000",
  secret: "migration-only-secret-not-used-at-runtime-00000",
  database: db,
  plugins: [genericOAuth({ config: [] })],
});

const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options);
if (!toBeCreated.length && !toBeAdded.length) {
  console.log(`[auth:migrate] ${dbFile}: schema già aggiornato.`);
} else {
  await runMigrations();
  console.log(
    `[auth:migrate] ${dbFile}: create ${toBeCreated.map((t) => t.table).join(", ") || "-"}; modificate ${toBeAdded.map((t) => t.table).join(", ") || "-"}.`,
  );
}
db.close();
