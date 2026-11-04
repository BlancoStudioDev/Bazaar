import { Suspense } from "react";
import { connection } from "next/server";

async function Connection() {
  await connection();
  return null;
}

/**
 * Segnala a Next (cacheComponents) che la pagina è volutamente dinamica: serve quando `generateMetadata`
 * legge dati di richiesta (cookie/Accept-Language per la lingua) e il resto della pagina sarebbe prerenderizzabile.
 */
export function DynamicMarker() {
  return (
    <Suspense>
      <Connection />
    </Suspense>
  );
}
