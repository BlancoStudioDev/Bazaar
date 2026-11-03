import path from "node:path";
import type { NextConfig } from "next";

/**
 * Sotto-percorso di pubblicazione (non è un segreto), es. APP_BASE_PATH=/bazaar per servire l'app
 * su https://blancostudio.dev/bazaar. Vuoto (default) = radice, come in sviluppo locale.
 * Valore fissato al build: va impostato anche in `next build`. Non serve `assetPrefix`: con basePath
 * Next serve già /_next sotto il prefisso. Esposto al client come NEXT_PUBLIC_BASE_PATH solo per fetch().
 */
function readBasePath(): string {
  const raw = (process.env.APP_BASE_PATH ?? "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  if (!/^\/[A-Za-z0-9._~-]+(\/[A-Za-z0-9._~-]+)*$/.test(raw)) {
    throw new Error(`APP_BASE_PATH non valido: "${raw}" (esempio: /bazaar, senza slash finale).`);
  }
  return raw;
}
const basePath = readBasePath();

const nextConfig: NextConfig = {
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["@modelcontextprotocol/sdk"],
  turbopack: {
    // Fissa la radice al progetto: sul server in ~ c'è un altro package-lock.json che Next scambierebbe per la radice.
    root: path.resolve(process.cwd()),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
