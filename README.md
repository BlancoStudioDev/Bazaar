# bazaar

Personal shopper conversazionale che cerca in tempo reale su cinque marketplace — **Amazon.it, AliExpress, Vinted, Subito.it e Facebook Marketplace** — confronta i prezzi e dice dove conviene comprare.

Non è un catalogo: è una chat. Scrivi cosa cerchi, Bazaar chiama i server MCP locali, normalizza gli annunci in schede prodotto e risponde con una raccomandazione secca, una tabella comparativa e i link agli annunci. I risultati restano anche nella **Bacheca**, ordinabili per prezzo o per fonte.

## Cosa sa fare

- Ricerca in linguaggio naturale, anche vaga: «una borsa Longchamp la più economica», «una RTX 4070 usata a Milano».
- Cinque marketplace in parallelo, con gestione dei singoli errori (se un server è giù, gli altri continuano).
- Deduplica e normalizza annunci eterogenei in un unico modello `Product`.
- Confronto prezzi, condizioni, provenienza e link diretti all'annuncio.
- Bacheca laterale con filtri per marketplace, ordinamento per prezzo/fonte e schede con immagine.
- Selezione **dinamica** del modello OpenRouter gratuito migliore: qualità stimata + latenza, throughput e uptime live.
- Streaming SSE: testo, attività dei tool, notifiche, errori e metadati del modello in tempo reale.
- Cronologia e impostazioni salvate in `localStorage`; chiave OpenRouter solo server-side.
- UI responsive: sidebar e bacheca diventano drawer su mobile.

## Stack

- **Next.js 16** (App Router, Turbopack, Cache Components)
- **React 19** + **TypeScript**
- **Tailwind CSS 4** con design system custom in `src/app/globals.css`
- **@modelcontextprotocol/sdk** per parlare con i server MCP locali via stdio
- **OpenRouter** per l'LLM (modelli gratuiti, con riserva economica opzionale)
- **react-markdown** + **remark-gfm** per le risposte

## Avvio

Requisiti: Node.js 20+, npm, e i cinque server MCP già presenti in `~/.config/opencode/mcp/` (con i rispettivi virtualenv Python).

```bash
cd bazaar
npm install
cp .env.example .env.local   # inserisci almeno una chiave LLM free
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

Build di produzione:

```bash
npm run build
npm start
```

## Variabili d'ambiente

| Variabile | Default | Descrizione |
|---|---|---|
| `GROQ_API_KEY` / `GROQ_MODEL` | — / `openai/gpt-oss-120b` | Provider free diretto ([chiave](https://console.groq.com/keys)). |
| `CEREBRAS_API_KEY` / `CEREBRAS_MODEL` | — / `gpt-oss-120b` | Provider free diretto ([chiave](https://cloud.cerebras.ai/)). |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | — / `gemini-flash-latest` | Google AI Studio, endpoint OpenAI-compatibile ([chiave](https://aistudio.google.com/apikey)). |
| `MISTRAL_API_KEY` / `MISTRAL_MODEL` | — / `mistral-small-latest` | Provider free diretto ([chiave](https://console.mistral.ai/api-keys)). |
| `OPENROUTER_API_KEY` | — | Opzionale se è presente almeno un altro provider. Chiave server-side, non esposta al browser. |
| `OPENROUTER_APP_URL` | `http://localhost:3000` | Header `HTTP-Referer` per OpenRouter. |
| `OPENROUTER_APP_NAME` | `Bazaar` | Header `X-Title`. |
| `OPENROUTER_ALLOW_PAID_FALLBACK` | `false` | Opt-in: consente la riserva a pagamento (richiede `OPENROUTER_API_KEY`). |
| `OPENROUTER_CHEAP_MODELS` | dinamico | Tier economico a pagamento (id separati da virgola). Default: i 3 modelli con tool support più economici del catalogo OpenRouter (gpt-oss, qwen, deepseek, gemini flash, llama, glm, mistral, gemma) sopra una soglia di qualità/contesto. |
| `OPENROUTER_PAID_FALLBACK_MODEL` | `deepseek/deepseek-v4.1-flash` | Ultima riserva fissa, dopo free e tier economico (richiede il toggle nelle impostazioni). |
| `MCP_ROOT` | `~/.config/opencode/mcp` | Radice dei server MCP. |
| `MCP_PYTHON_SHARED` | `$MCP_ROOT/.venv/bin/python` | Python per Amazon, AliExpress, Vinted. |
| `MCP_PYTHON_SUBITO` | `$MCP_ROOT/subito-search/.venv/bin/python` | Python per Subito. |
| `MCP_PYTHON_FACEBOOK` | `$MCP_ROOT/facebook-marketplace/.venv/bin/python` | Python per Facebook Marketplace. |
| `MCP_DISABLED` | — | Lista separata da virgole di server da non avviare (es. `aliexpress`). |

La chiave resta nel processo Next.js: il browser chiama solo `/api/*`.

## Costi e provider

L'obiettivo è costo zero. I provider con chiave presente vengono provati in quest'ordine:
provider free diretti (Groq, Cerebras, Gemini, Mistral) -> modelli OpenRouter `:free` -> router free -> riserva a pagamento (solo se `OPENROUTER_ALLOW_PAID_FALLBACK=true`).
Ordine con la riserva attiva: free (max 6 pronti, con un retry di 1,5 s sul 429) -> tier economico dal più economico -> riserva fissa -> modelli in cooldown. I 429 persistenti vanno in cooldown 60 s; i fallimenti sistematici (404/400 per data policy, tool-call non valide) 15 minuti, e vengono scritti nel log del server (`[bazaar] <modello> ha fallito…`). Nota: il catalogo `/models` è filtrato dalle impostazioni privacy/data policy dell'account OpenRouter; se tutti i free richiedono di condividere i prompt, ne resteranno pochissimi (o nessuno) e si userà il tier economico. L'etichetta del modello mostra "a pagamento ~$X/1M token" quando se ne usa uno.

Dove si concentra il costo: i server MCP sono processi locali gratuiti (scraping); il costo LLM è solo nei token di contesto (system prompt + schemi dei tool + risultati dei tool, moltiplicati per i round). Gli schemi dei tool vengono compattati prima dell'invio. I default dei modelli sono sovrascrivibili con `*_MODEL`; verifica sulle doc dei provider quali modelli sono ancora nel free tier.

Riduzione token: cronologia max 8 messaggi (3000 caratteri l'uno), max 4 round di tool, max 8 risultati per ricerca con soli campi essenziali (tetto 6000 caratteri per tool), vecchi tool result sostituiti da un riassunto, `max_tokens` 1200, system prompt compatto. Le risposte dei marketplace sono in cache in memoria per 10 minuti (max 100 voci, solo risposte senza errore).

## Architettura

```
Browser (React)
  │  POST /api/chat  (SSE)
  ▼
Next.js Route Handler
  │
  ├─ agent/run.ts ──────────────► OpenRouter (streaming, tool calling)
  │      │
  │      └─ mcp/manager.ts ─────► stdio ─► server MCP Python
  │                                         ├─ amazon
  │                                         ├─ aliexpress
  │                                         ├─ vinted
  │                                         ├─ subito-search
  │                                         └─ facebook-marketplace
  │
  └─ mcp/normalize.ts ──────────► Product[] + JSON compatto per il modello
```

Percorsi principali:

- `src/lib/agent/run.ts` — loop dell'agente, esecuzione tool in parallelo, fallback tra modelli.
- `src/lib/agent/prompt.ts` — system prompt italiano: regole di ricerca, pertinenza e formato della risposta.
- `src/lib/openrouter/models.ts` — scoperta dei modelli free, scoring, cache 5 minuti, catena di fallback.
- `src/lib/openrouter/client.ts` — client streaming OpenRouter, filtro delle pseudo tool-call testuali e messaggi d'errore.
- `src/lib/mcp/manager.ts` — ciclo di vita dei processi MCP, riconnessione, schemi tool.
- `src/lib/mcp/normalize.ts` — parsing e normalizzazione degli output eterogenei.
- `src/app/api/chat/route.ts` — endpoint SSE.
- `src/lib/use-bazaar.ts` — stato client, conversazioni, impostazioni, consumo SSE.
- `src/components/` — shell, chat, bacheca, schede prodotto, dialoghi.

### Protocollo SSE

Eventi emessi da `/api/chat`:

- `meta` — modello scelto, etichetta, flag riserva.
- `activity` — tool avviato/completato, durata, numero risultati, prodotti normalizzati.
- `delta` — token di testo.
- `notice` — cambio modello o avviso.
- `error` — errore con codice.
- `done` — usage e modello finale.

### Scelta del modello

`/api/models` legge `https://openrouter.ai/api/v1/models`, filtra i modelli a prezzo zero con supporto `tools`, arricchisce ogni candidato con `/models/{id}/endpoints` (latenza p50, throughput, uptime) e calcola:

- **intelligenza** — stima da famiglia e dimensione del modello;
- **velocità** — parametri attivi + latenza + throughput;
- **affidabilità** — uptime dell'endpoint;
- **overall** — 50% intelligenza, 35% velocità, 15% affidabilità.

Il risultato è in cache per 5 minuti. La catena di fallback prova gli altri free, poi il router `openrouter/free`, poi — se la riserva economica è attiva (default) — il modello economico. La riserva è automatica: l'utente non deve cliccare nulla, vede solo un avviso in chat e può disattivarla dalle impostazioni.

Alcuni modelli free (per esempio XingChen/TeleChat) non usano il canale nativo dei tool: scrivono `<tool_call>nome<param_key>…</param_key><param_value>…</param_value></tool_call>` come testo normale. Il client filtra questo markup dallo streaming, lo converte in vere tool-call quando il tool è tra quelli disponibili e, se la chiamata non è valida, passa al modello successivo invece di mostrare il markup in chat.

## API

- `GET /api/status` — chiave OpenRouter, crediti, modelli free usati/limite, stato dei cinque server MCP e latenza di avvio.
- `GET /api/models` — registry dei modelli free, modello scelto, punteggi, riserva economica. `?refresh=1` forza l'aggiornamento.
- `POST /api/chat` — body `{ messages, model?, marketplaces?, city?, allowPaidFallback? }`, risposta SSE.

## Test rapidi

```bash
# stato connessioni
curl -s http://localhost:3000/api/status | jq

# registry modelli
curl -s http://localhost:3000/api/models | jq '.selected'

# chat (SSE)
curl -N -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Cerca una borsa Longchamp su Vinted"}],"marketplaces":["vinted"]}'
```

Test diretto dei server MCP:

```bash
node scripts/test-mcp.mjs amazon
node scripts/test-mcp.mjs vinted
node scripts/test-mcp.mjs subito
node scripts/test-mcp.mjs facebook-marketplace
node scripts/test-mcp.mjs aliexpress
```

## Limiti noti

- **Modelli gratuiti OpenRouter**: il catalogo free è molto variabile. Al momento della scrittura è esposto un solo modello free con supporto tool (`xingchen-agi/xing4.0-29b-a4b:free`), su un pool condiviso spesso saturo (429) o bloccato da guardrail del provider. Bazaar usa automaticamente la riserva economica e lo segnala in chat; la riserva si può disattivare dalle impostazioni. Per usare solo i free, abilita la condivisione prompt nelle impostazioni privacy di OpenRouter.
- **AliExpress**: il parser del server MCP può fallire con `itemList assente (layout cambiato o blocco anti-bot)`. È un limite del server, non dell'app: gli altri marketplace continuano a funzionare.
- **Facebook Marketplace**: usa la sessione Chrome del Mac; se scade, va rifatto il login. La ricerca è limitata a raggio/città.
- **Prezzi**: provengono dagli annunci e possono cambiare; la UI invita sempre a verificare sul link.
- **Persistenza**: solo `localStorage` del browser, nessun account o database.
- **Nessun acquisto**: Bazaar cerca e confronta, non compra e non gestisce carrelli.

## Deploy e multiutente

Bazaar può girare su un server Linux dietro nginx/TLS con login (OIDC onionrings) e whitelist di email. Script, unit systemd, vhost nginx e guida passo per passo sono in [`deploy/`](deploy/README.md) (`deploy/deploy.sh --dry-run` per provare senza toccare nulla).

Limiti noti:

- I server MCP sono **condivisi** tra tutti gli utenti: marketplace con rate limit e anti-bot, e gli IP datacenter vengono bloccati più facilmente. Amazon, AliExpress, Vinted e Subito possono rispondere con blocchi dal server anche se in locale funzionano.
- **Facebook Marketplace è disabilitato sul server** (`MCP_DISABLED=facebook-marketplace`): legge i cookie dal profilo Chrome del Mac. I cookie manuali sono possibili ma sconsigliati (vedi `deploy/README.md`).
- Le conversazioni restano in `localStorage` del browser, per utente e per dispositivo: non sono sincronizzate né recuperabili dal server.

## Note di design

- Palette carta calda, inchiostro scuro e accento vermiglio; serif display (Instrument Serif) per i titoli, Geist per il testo, mono per i dati.
- La chat è il centro; la Bacheca è un pannello laterale che si apre solo quando serve.
- Le schede prodotto mostrano immagine, prezzo, marketplace, condizione e luogo, con link diretto all'annuncio.
- Su mobile la sidebar e la Bacheca diventano drawer a tutta altezza.
