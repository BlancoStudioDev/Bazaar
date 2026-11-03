/** Accetta solo path interni (stessa origine). Utilizzabile anche lato client. */
export function safeCallbackPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || typeof raw !== "string") return fallback;
  if (raw.length > 512) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  try {
    const parsed = new URL(raw, "http://internal.invalid");
    if (parsed.origin !== "http://internal.invalid") return fallback;
    if (parsed.pathname.startsWith("/api/") || parsed.pathname === "/login") return fallback;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallback;
  }
}
