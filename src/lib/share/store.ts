import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { isValidShareToken, type ShareSnapshot } from "./snapshot";

/**
 * Archivio delle condivisioni (SQLite, file separato dal database di auth).
 * `owner_user_id` resta solo lato server: non finisce mai in una risposta né nella pagina pubblica.
 */

const HOUR_MS = 60 * 60 * 1000;
const g = globalThis as unknown as { __bazaarShareDb?: Database.Database };

function db(): Database.Database {
  if (g.__bazaarShareDb) return g.__bazaarShareDb;
  const file = path.resolve(/*turbopackIgnore: true*/ (process.env.SHARE_DB_PATH ?? "").trim() || "./data/shares.sqlite");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new Database(file);
  conn.pragma("journal_mode = WAL");
  conn.exec(`
    CREATE TABLE IF NOT EXISTS shares (
      token TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      revoked_at INTEGER,
      snapshot TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS shares_owner_created ON shares (owner_user_id, created_at);
  `);
  g.__bazaarShareDb = conn;
  return conn;
}

export function sharesPerHour(): number {
  const value = Number.parseInt(process.env.SHARE_RATE_PER_HOUR ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : 20;
}

/** Condivisioni create dall'utente nell'ultima ora (anche se poi revocate). */
export function countRecentShares(ownerId: string): { count: number; oldest: number | null } {
  const row = db()
    .prepare("SELECT COUNT(*) AS n, MIN(created_at) AS oldest FROM shares WHERE owner_user_id = ? AND created_at > ?")
    .get(ownerId, Date.now() - HOUR_MS) as { n: number; oldest: number | null };
  return { count: row.n, oldest: row.oldest };
}

export function createShare(ownerId: string, snapshot: ShareSnapshot): { token: string; createdAt: number } {
  const token = randomBytes(24).toString("base64url");
  const createdAt = Date.now();
  db()
    .prepare("INSERT INTO shares (token, owner_user_id, created_at, snapshot) VALUES (?, ?, ?, ?)")
    .run(token, ownerId, createdAt, JSON.stringify(snapshot));
  return { token, createdAt };
}

export interface StoredShare {
  token: string;
  createdAt: number;
  snapshot: ShareSnapshot;
}

/** Lettura pubblica: solo token valido e non revocato. Niente owner nel risultato. */
export function getActiveShare(token: string): StoredShare | null {
  if (!isValidShareToken(token)) return null;
  const row = db()
    .prepare("SELECT token, created_at, snapshot FROM shares WHERE token = ? AND revoked_at IS NULL")
    .get(token) as { token: string; created_at: number; snapshot: string } | undefined;
  if (!row) return null;
  try {
    return { token: row.token, createdAt: row.created_at, snapshot: JSON.parse(row.snapshot) as ShareSnapshot };
  } catch {
    return null;
  }
}

/** Revoca solo se il token appartiene all'utente. Restituisce false se non esiste/non è suo. */
export function revokeShare(token: string, ownerId: string): boolean {
  if (!isValidShareToken(token)) return false;
  const result = db()
    .prepare("UPDATE shares SET revoked_at = COALESCE(revoked_at, ?) WHERE token = ? AND owner_user_id = ?")
    .run(Date.now(), token, ownerId);
  return result.changes > 0;
}
