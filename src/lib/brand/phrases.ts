import { DEFAULT_LANG, t, type Lang } from "@/lib/i18n";
import type { MarketplaceId, ToolActivity } from "@/lib/types";

/**
 * Voce di Fiuto, la volpe del deserto mercante di bazar ("avere fiuto per gli affari").
 * Frasi brevi, ironiche ma non sguaiate, legate a ciò che sta succedendo davvero:
 * il marketplace che risponde, la lettura delle descrizioni, il confronto dei prezzi.
 */

export type Phase = "start" | "searching" | "reading" | "comparing" | "writing" | "slow";

interface PhrasePack {
  start: string[];
  marketplace: Record<MarketplaceId, string[]>;
  many: string[];
  reading: string[];
  comparing: string[];
  writing: string[];
  slow: string[];
  tools: Record<string, string>;
}

const PACKS: Record<Lang, PhrasePack> = {
  it: {
    start: [
      "Fiuto drizza le orecchie…",
      "Fiuto apre la bancarella, un attimo…",
      "Fiuto annusa l'aria: c'è profumo di affare…",
      "Fiuto sistema la tenda e comincia…",
    ],
    marketplace: {
      amazon: [
        "Fiuto bussa al magazzino di Amazon…",
        "Tra i pacchi di Amazon c'è odore di affare…",
        "Scaffale dopo scaffale su Amazon…",
      ],
      aliexpress: [
        "Fiuto parte per AliExpress: viaggio lungo…",
        "Contratto con un venditore dall'altra parte del mondo…",
        "Sul banco di AliExpress, tra mille lucine…",
      ],
      vinted: [
        "Frugo negli armadi di Vinted…",
        "Su Vinted c'è sempre un tesoro in fondo al cassetto…",
        "Fiuto controlla le taglie e i prezzi su Vinted…",
      ],
      subito: [
        "Giro tra le bancarelle dell'usato su Subito…",
        "Su Subito qualcuno vende proprio quello che cerchi…",
        "Fiuto bussa alla porta dei vicini su Subito…",
      ],
      ebay: ["Fiuto passa all'asta di eBay…", "Su eBay si rilancia: Fiuto tiene il naso sul prezzo…"],
      "facebook-marketplace": [
        "Chiedo ai vicini su Facebook Marketplace…",
        "Fiuto sbircia le vetrine di quartiere…",
        "Su Marketplace si tratta con una stretta di mano…",
      ],
      wallapop: [
        "Fiuto bussa alle porte dei privati su Wallapop…",
        "Su Wallapop si vende da casa, Fiuto ci ficca il naso…",
        "Giro tra le soffitte di Wallapop…",
      ],
      trovaprezzi: [
        "Fiuto chiede il conto a mille negozi su Trovaprezzi…",
        "Su Trovaprezzi i negozi litigano per il prezzo migliore…",
        "Fiuto fa il giro dei negozi online via Trovaprezzi…",
      ],
      idealo: [
        "Fiuto confronta i listini su idealo…",
        "Su idealo cerco il negozio che costa meno…",
        "Fiuto stana il prezzo più basso su idealo…",
      ],
      mediaworld: [
        "Fiuto entra da MediaWorld, tra gli scaffali di elettronica…",
        "Cerco il bollino rosso da MediaWorld…",
        "Un giro tra i frigoriferi e i televisori di MediaWorld…",
      ],
      unieuro: [
        "Fiuto passa da Unieuro a controllare i cartellini…",
        "Tra gli elettrodomestici di Unieuro c'è odore di sconto…",
        "Fiuto fa la fila alla cassa di Unieuro…",
      ],
      zalando: [
        "Fiuto prova le scarpe da Zalando…",
        "Frugo tra gli scaffali della moda su Zalando…",
        "Su Zalando i saldi si fiutano a distanza…",
      ],
    },
    many: [
      "Fiuto corre di bancarella in bancarella…",
      "Fiuto fa il giro del bazar, tutto in parallelo…",
      "Una dozzina di bancarelle, un solo naso…",
    ],
    reading: [
      "Leggo le descrizioni: i titoli raccontano solo metà storia…",
      "Fiuto controlla le scritte piccole…",
      "Cerco l'inghippo nelle descrizioni…",
    ],
    comparing: [
      "Metto in fila i prezzi, dal più furbo al più caro…",
      "Faccio i conti sul retro di un sacchetto…",
      "Scarto le trappole e tengo gli affari…",
    ],
    writing: ["Fiuto prepara il verdetto…", "Ultimo sguardo ai prezzi e ve lo dico…"],
    slow: [
      "Il bazar è affollato oggi, ancora un momento…",
      "Qualche bancarella risponde piano, aspetto con pazienza…",
      "Fiuto non molla: sta ancora contrattando…",
    ],
    tools: {
      search_amazon: "Annuso Amazon",
      get_product: "Apro la scheda Amazon",
      search_ebay: "Annuso eBay",
      get_ebay_item: "Apro l'annuncio eBay",
      search_aliexpress: "Annuso AliExpress",
      search_vinted: "Frugo su Vinted",
      get_item: "Apro l'annuncio Vinted",
      search_subito: "Giro su Subito",
      search_marketplace: "Chiedo su Facebook Marketplace",
      get_listing: "Apro l'annuncio Facebook",
      search_location: "Cerco la località",
      search_wallapop: "Giro su Wallapop",
      search_trovaprezzi: "Interrogo Trovaprezzi",
      search_idealo: "Confronto su idealo",
      search_mediaworld: "Giro da MediaWorld",
      search_unieuro: "Giro da Unieuro",
      search_zalando: "Sfoglio Zalando",
    },
  },
  en: {
    start: [
      "Fiuto perks up his ears…",
      "Fiuto opens the stall, one moment…",
      "Fiuto sniffs the air: smells like a bargain…",
      "Fiuto pitches the tent and gets going…",
    ],
    marketplace: {
      amazon: [
        "Fiuto knocks on Amazon's warehouse door…",
        "Among Amazon's parcels there's a whiff of a deal…",
        "Shelf after shelf on Amazon…",
      ],
      aliexpress: [
        "Fiuto sets off for AliExpress: long trip…",
        "Haggling with a seller on the other side of the world…",
        "At AliExpress's counter, among a thousand blinking lights…",
      ],
      vinted: [
        "Rummaging through Vinted's wardrobes…",
        "There's always a treasure at the bottom of a Vinted drawer…",
        "Fiuto checks sizes and prices on Vinted…",
      ],
      subito: [
        "Wandering the second-hand stalls on Subito…",
        "Someone on Subito is selling exactly what you want…",
        "Fiuto knocks on the neighbours' door on Subito…",
      ],
      ebay: ["Fiuto drops by the eBay auction…", "On eBay everyone raises: Fiuto keeps his nose on the price…"],
      "facebook-marketplace": [
        "Asking the neighbours on Facebook Marketplace…",
        "Fiuto peeks into the local shop windows…",
        "On Marketplace deals are sealed with a handshake…",
      ],
      wallapop: [
        "Fiuto knocks on private doors on Wallapop…",
        "On Wallapop people sell from home, Fiuto pokes his nose in…",
        "Rummaging through Wallapop's attics…",
      ],
      trovaprezzi: [
        "Fiuto asks a thousand shops for their price on Trovaprezzi…",
        "On Trovaprezzi the shops fight over the best price…",
        "Fiuto tours the online shops through Trovaprezzi…",
      ],
      idealo: [
        "Fiuto compares price lists on idealo…",
        "Hunting for the cheapest shop on idealo…",
        "Fiuto sniffs out the lowest price on idealo…",
      ],
      mediaworld: [
        "Fiuto walks into MediaWorld, among the electronics shelves…",
        "Looking for the red tag at MediaWorld…",
        "A stroll past MediaWorld's fridges and TVs…",
      ],
      unieuro: [
        "Fiuto drops by Unieuro to check the price tags…",
        "Among Unieuro's appliances there's a whiff of discount…",
        "Fiuto queues at the Unieuro checkout…",
      ],
      zalando: [
        "Fiuto tries on shoes at Zalando…",
        "Rummaging through the fashion shelves on Zalando…",
        "On Zalando Fiuto can smell a sale from afar…",
      ],
    },
    many: [
      "Fiuto runs from stall to stall…",
      "Fiuto tours the whole bazaar, all in parallel…",
      "A dozen stalls, one nose…",
    ],
    reading: [
      "Reading the descriptions: titles only tell half the story…",
      "Fiuto checks the fine print…",
      "Hunting for the catch in the descriptions…",
    ],
    comparing: [
      "Lining up prices, from the cleverest to the priciest…",
      "Doing the maths on the back of a paper bag…",
      "Tossing the traps, keeping the deals…",
    ],
    writing: ["Fiuto is preparing the verdict…", "One last look at the prices, then I'll tell you…"],
    slow: [
      "The bazaar is packed today, one more moment…",
      "A few stalls are answering slowly, waiting patiently…",
      "Fiuto won't give up: still haggling…",
    ],
    tools: {
      search_amazon: "Sniffing Amazon",
      get_product: "Opening the Amazon page",
      search_ebay: "Sniffing eBay",
      get_ebay_item: "Opening the eBay listing",
      search_aliexpress: "Sniffing AliExpress",
      search_vinted: "Rummaging on Vinted",
      get_item: "Opening the Vinted listing",
      search_subito: "Touring Subito",
      search_marketplace: "Asking on Facebook Marketplace",
      get_listing: "Opening the Facebook listing",
      search_location: "Looking up the location",
      search_wallapop: "Browsing Wallapop",
      search_trovaprezzi: "Querying Trovaprezzi",
      search_idealo: "Comparing on idealo",
      search_mediaworld: "Browsing MediaWorld",
      search_unieuro: "Browsing Unieuro",
      search_zalando: "Browsing Zalando",
    },
  },
  es: {
    start: [
      "Fiuto levanta las orejas…",
      "Fiuto abre el puesto, un momento…",
      "Fiuto olfatea el aire: huele a ganga…",
      "Fiuto monta la tienda y empieza…",
    ],
    marketplace: {
      amazon: [
        "Fiuto llama a la puerta del almacén de Amazon…",
        "Entre los paquetes de Amazon huele a ganga…",
        "Estante tras estante en Amazon…",
      ],
      aliexpress: [
        "Fiuto sale hacia AliExpress: viaje largo…",
        "Regateando con un vendedor al otro lado del mundo…",
        "En el mostrador de AliExpress, entre mil lucecitas…",
      ],
      vinted: [
        "Hurgando en los armarios de Vinted…",
        "En Vinted siempre hay un tesoro al fondo del cajón…",
        "Fiuto revisa tallas y precios en Vinted…",
      ],
      subito: [
        "Paseando por los puestos de segunda mano de Subito…",
        "En Subito alguien vende justo lo que buscas…",
        "Fiuto llama a la puerta de los vecinos en Subito…",
      ],
      ebay: ["Fiuto pasa por la subasta de eBay…", "En eBay se puja: Fiuto no despega el hocico del precio…"],
      "facebook-marketplace": [
        "Preguntando a los vecinos en Facebook Marketplace…",
        "Fiuto curiosea los escaparates del barrio…",
        "En Marketplace se cierra el trato con un apretón de manos…",
      ],
      wallapop: [
        "Fiuto llama a la puerta de los particulares en Wallapop…",
        "En Wallapop se vende desde casa, Fiuto mete el hocico…",
        "Rebusco en los áticos de Wallapop…",
      ],
      trovaprezzi: [
        "Fiuto pide el precio a mil tiendas en Trovaprezzi…",
        "En Trovaprezzi las tiendas se pelean por el mejor precio…",
        "Fiuto recorre las tiendas online con Trovaprezzi…",
      ],
      idealo: [
        "Fiuto compara tarifas en idealo…",
        "Busco la tienda más barata en idealo…",
        "Fiuto olfatea el precio más bajo en idealo…",
      ],
      mediaworld: [
        "Fiuto entra en MediaWorld, entre las estanterías de electrónica…",
        "Busco la etiqueta roja en MediaWorld…",
        "Paseo entre las neveras y los televisores de MediaWorld…",
      ],
      unieuro: [
        "Fiuto pasa por Unieuro a mirar las etiquetas…",
        "Entre los electrodomésticos de Unieuro huele a descuento…",
        "Fiuto hace cola en la caja de Unieuro…",
      ],
      zalando: [
        "Fiuto se prueba zapatos en Zalando…",
        "Rebusco entre las estanterías de moda de Zalando…",
        "En Zalando Fiuto huele las rebajas de lejos…",
      ],
    },
    many: [
      "Fiuto corre de puesto en puesto…",
      "Fiuto da la vuelta al bazar, todo en paralelo…",
      "Una docena de puestos, una sola nariz…",
    ],
    reading: [
      "Leyendo las descripciones: los títulos solo cuentan la mitad…",
      "Fiuto revisa la letra pequeña…",
      "Buscando la trampa en las descripciones…",
    ],
    comparing: [
      "Poniendo los precios en fila, del más listo al más caro…",
      "Haciendo cuentas en el reverso de una bolsa…",
      "Descarto las trampas y me quedo con las gangas…",
    ],
    writing: ["Fiuto prepara el veredicto…", "Última mirada a los precios y te lo cuento…"],
    slow: [
      "El bazar está lleno hoy, un momento más…",
      "Algunos puestos responden despacio, espero con paciencia…",
      "Fiuto no se rinde: sigue regateando…",
    ],
    tools: {
      search_amazon: "Olfateo Amazon",
      get_product: "Abro la ficha de Amazon",
      search_ebay: "Olfateo eBay",
      get_ebay_item: "Abro el anuncio de eBay",
      search_aliexpress: "Olfateo AliExpress",
      search_vinted: "Hurgo en Vinted",
      get_item: "Abro el anuncio de Vinted",
      search_subito: "Recorro Subito",
      search_marketplace: "Pregunto en Facebook Marketplace",
      get_listing: "Abro el anuncio de Facebook",
      search_location: "Busco la localidad",
      search_wallapop: "Rebusco en Wallapop",
      search_trovaprezzi: "Consulto Trovaprezzi",
      search_idealo: "Comparo en idealo",
      search_mediaworld: "Paseo por MediaWorld",
      search_unieuro: "Paseo por Unieuro",
      search_zalando: "Hojeo Zalando",
    },
  },
  fr: {
    start: [
      "Fiuto dresse les oreilles…",
      "Fiuto ouvre l'étal, un instant…",
      "Fiuto hume l'air : ça sent la bonne affaire…",
      "Fiuto installe la tente et commence…",
    ],
    marketplace: {
      amazon: [
        "Fiuto frappe à l'entrepôt d'Amazon…",
        "Entre les colis d'Amazon, ça sent la bonne affaire…",
        "Rayon après rayon sur Amazon…",
      ],
      aliexpress: [
        "Fiuto part pour AliExpress : long voyage…",
        "Je marchande avec un vendeur à l'autre bout du monde…",
        "Sur l'étal d'AliExpress, parmi mille loupiotes…",
      ],
      vinted: [
        "Je fouille les armoires de Vinted…",
        "Sur Vinted, il y a toujours un trésor au fond du tiroir…",
        "Fiuto vérifie les tailles et les prix sur Vinted…",
      ],
      subito: [
        "Je flâne entre les étals de l'occasion sur Subito…",
        "Sur Subito, quelqu'un vend justement ce que tu cherches…",
        "Fiuto frappe chez les voisins sur Subito…",
      ],
      ebay: ["Fiuto passe à la vente aux enchères d'eBay…", "Sur eBay on surenchérit : Fiuto garde le nez sur le prix…"],
      "facebook-marketplace": [
        "Je demande aux voisins sur Facebook Marketplace…",
        "Fiuto lorgne les vitrines du quartier…",
        "Sur Marketplace, on conclut d'une poignée de main…",
      ],
      wallapop: [
        "Fiuto frappe chez les particuliers sur Wallapop…",
        "Sur Wallapop on vend depuis chez soi, Fiuto y met le nez…",
        "Je fouille les greniers de Wallapop…",
      ],
      trovaprezzi: [
        "Fiuto demande son prix à mille boutiques sur Trovaprezzi…",
        "Sur Trovaprezzi les boutiques se battent pour le meilleur prix…",
        "Fiuto fait le tour des boutiques en ligne via Trovaprezzi…",
      ],
      idealo: [
        "Fiuto compare les tarifs sur idealo…",
        "Je cherche la boutique la moins chère sur idealo…",
        "Fiuto déniche le prix le plus bas sur idealo…",
      ],
      mediaworld: [
        "Fiuto entre chez MediaWorld, entre les rayons d'électronique…",
        "Je cherche l'étiquette rouge chez MediaWorld…",
        "Un tour parmi les frigos et les télés de MediaWorld…",
      ],
      unieuro: [
        "Fiuto passe chez Unieuro vérifier les étiquettes…",
        "Parmi les appareils de Unieuro, ça sent la remise…",
        "Fiuto fait la queue à la caisse d'Unieuro…",
      ],
      zalando: [
        "Fiuto essaie des chaussures chez Zalando…",
        "Je fouille les rayons mode de Zalando…",
        "Sur Zalando Fiuto flaire les soldes de loin…",
      ],
    },
    many: [
      "Fiuto court d'étal en étal…",
      "Fiuto fait le tour du bazar, tout en parallèle…",
      "Une douzaine d'étals, un seul nez…",
    ],
    reading: [
      "Je lis les descriptions : les titres ne racontent que la moitié de l'histoire…",
      "Fiuto vérifie les petites lignes…",
      "Je cherche le piège dans les descriptions…",
    ],
    comparing: [
      "Je range les prix, du plus malin au plus cher…",
      "Je fais les comptes au dos d'un sachet…",
      "J'écarte les pièges et je garde les bonnes affaires…",
    ],
    writing: ["Fiuto prépare le verdict…", "Dernier coup d'œil aux prix et je te dis ça…"],
    slow: [
      "Le bazar est bondé aujourd'hui, encore un instant…",
      "Certains étals répondent lentement, j'attends patiemment…",
      "Fiuto ne lâche pas : il marchande encore…",
    ],
    tools: {
      search_amazon: "Je hume Amazon",
      get_product: "J'ouvre la fiche Amazon",
      search_ebay: "Je hume eBay",
      get_ebay_item: "J'ouvre l'annonce eBay",
      search_aliexpress: "Je hume AliExpress",
      search_vinted: "Je fouille sur Vinted",
      get_item: "J'ouvre l'annonce Vinted",
      search_subito: "Je fais le tour de Subito",
      search_marketplace: "Je demande sur Facebook Marketplace",
      get_listing: "J'ouvre l'annonce Facebook",
      search_location: "Je cherche la localité",
      search_wallapop: "Je fouille Wallapop",
      search_trovaprezzi: "J'interroge Trovaprezzi",
      search_idealo: "Je compare sur idealo",
      search_mediaworld: "Je passe chez MediaWorld",
      search_unieuro: "Je passe chez Unieuro",
      search_zalando: "Je feuillette Zalando",
    },
  },
  de: {
    start: [
      "Fiuto spitzt die Ohren…",
      "Fiuto öffnet den Stand, einen Moment…",
      "Fiuto schnuppert in der Luft: Es riecht nach Schnäppchen…",
      "Fiuto baut das Zelt auf und legt los…",
    ],
    marketplace: {
      amazon: [
        "Fiuto klopft ans Lager von Amazon…",
        "Zwischen den Paketen von Amazon liegt Schnäppchenduft…",
        "Regal um Regal auf Amazon…",
      ],
      aliexpress: [
        "Fiuto bricht nach AliExpress auf: weite Reise…",
        "Ich feilsche mit einem Verkäufer am anderen Ende der Welt…",
        "Am Tresen von AliExpress, zwischen tausend Lichtern…",
      ],
      vinted: [
        "Ich wühle in den Kleiderschränken von Vinted…",
        "Auf Vinted liegt immer ein Schatz ganz hinten in der Schublade…",
        "Fiuto prüft Größen und Preise auf Vinted…",
      ],
      subito: [
        "Ich schlendere an den Gebrauchtständen von Subito vorbei…",
        "Auf Subito verkauft jemand genau das, was du suchst…",
        "Fiuto klopft bei den Nachbarn auf Subito an…",
      ],
      ebay: ["Fiuto schaut bei der eBay-Auktion vorbei…", "Auf eBay wird geboten: Fiuto behält den Preis in der Nase…"],
      "facebook-marketplace": [
        "Ich frage die Nachbarn auf Facebook Marketplace…",
        "Fiuto linst in die Schaufenster der Nachbarschaft…",
        "Auf Marketplace besiegelt man den Deal per Handschlag…",
      ],
      wallapop: [
        "Fiuto klopft bei Privatleuten auf Wallapop an…",
        "Auf Wallapop verkauft man von zu Hause, Fiuto steckt die Nase rein…",
        "Ich stöbere in den Dachböden von Wallapop…",
      ],
      trovaprezzi: [
        "Fiuto fragt tausend Shops auf Trovaprezzi nach dem Preis…",
        "Auf Trovaprezzi streiten sich die Shops um den besten Preis…",
        "Fiuto klappert die Online-Shops über Trovaprezzi ab…",
      ],
      idealo: [
        "Fiuto vergleicht Preislisten auf idealo…",
        "Ich suche den günstigsten Shop auf idealo…",
        "Fiuto schnüffelt den niedrigsten Preis auf idealo auf…",
      ],
      mediaworld: [
        "Fiuto betritt MediaWorld, zwischen den Elektronikregalen…",
        "Ich suche das rote Schild bei MediaWorld…",
        "Ein Rundgang zwischen Kühlschränken und Fernsehern bei MediaWorld…",
      ],
      unieuro: [
        "Fiuto schaut bei Unieuro auf die Preisschilder…",
        "Zwischen den Haushaltsgeräten bei Unieuro liegt Rabatt in der Luft…",
        "Fiuto steht an der Kasse von Unieuro an…",
      ],
      zalando: [
        "Fiuto probiert bei Zalando Schuhe an…",
        "Ich stöbere in den Moderegalen von Zalando…",
        "Bei Zalando riecht Fiuto den Sale schon von Weitem…",
      ],
    },
    many: [
      "Fiuto rennt von Stand zu Stand…",
      "Fiuto dreht eine Runde durch den Basar, alles parallel…",
      "Ein Dutzend Stände, eine Nase…",
    ],
    reading: [
      "Ich lese die Beschreibungen: Titel erzählen nur die halbe Geschichte…",
      "Fiuto prüft das Kleingedruckte…",
      "Ich suche den Haken in den Beschreibungen…",
    ],
    comparing: [
      "Ich reihe die Preise auf, vom Cleversten zum Teuersten…",
      "Ich rechne auf der Rückseite einer Tüte nach…",
      "Ich sortiere die Fallen aus und behalte die Schnäppchen…",
    ],
    writing: ["Fiuto bereitet das Urteil vor…", "Letzter Blick auf die Preise, dann sag ich's dir…"],
    slow: [
      "Der Basar ist heute voll, noch einen Moment…",
      "Ein paar Stände antworten langsam, ich warte geduldig…",
      "Fiuto gibt nicht auf: Er feilscht noch…",
    ],
    tools: {
      search_amazon: "Ich schnuppere an Amazon",
      get_product: "Ich öffne die Amazon-Seite",
      search_ebay: "Ich schnuppere an eBay",
      get_ebay_item: "Ich öffne die eBay-Anzeige",
      search_aliexpress: "Ich schnuppere an AliExpress",
      search_vinted: "Ich wühle auf Vinted",
      get_item: "Ich öffne die Vinted-Anzeige",
      search_subito: "Ich drehe eine Runde auf Subito",
      search_marketplace: "Ich frage auf Facebook Marketplace",
      get_listing: "Ich öffne die Facebook-Anzeige",
      search_location: "Ich suche den Ort",
      search_wallapop: "Ich stöbere auf Wallapop",
      search_trovaprezzi: "Ich frage Trovaprezzi",
      search_idealo: "Ich vergleiche auf idealo",
      search_mediaworld: "Ich schaue bei MediaWorld",
      search_unieuro: "Ich schaue bei Unieuro",
      search_zalando: "Ich blättere durch Zalando",
    },
  },
};

/** Frasi per i tool nella timeline (voce di Fiuto, ma restano chiare su cosa succede). */
export function toolLabelFor(tool: string, lang: Lang = DEFAULT_LANG): string | undefined {
  return PACKS[lang].tools[tool] ?? PACKS.en.tools[tool];
}

const SERVER_NAMES: Record<MarketplaceId, string> = {
  amazon: "Amazon",
  aliexpress: "AliExpress",
  vinted: "Vinted",
  subito: "Subito",
  ebay: "eBay",
  "facebook-marketplace": "Facebook Marketplace",
  wallapop: "Wallapop",
  trovaprezzi: "Trovaprezzi",
  idealo: "idealo",
  mediaworld: "MediaWorld",
  unieuro: "Unieuro",
  zalando: "Zalando",
};

/** Cambia frase ogni 3,5 s; il seed (es. l'id del messaggio) evita che ogni ricerca parta con la stessa. */
export const ROTATE_MS = 3_500;
const SLOW_AFTER_MS = 22_000;

function pick(pool: string[], tick: number, seed: number): string {
  return pool[(tick + seed) % pool.length];
}

export function seedFrom(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
}

export function detectPhase(input: {
  activities: ToolActivity[];
  hasText: boolean;
  elapsedMs: number;
}): Phase {
  const { activities, hasText, elapsedMs } = input;
  if (hasText) return "writing";
  if (!activities.length) return elapsedMs > SLOW_AFTER_MS ? "slow" : "start";
  const running = activities.some((a) => a.status === "running");
  if (running) return elapsedMs > SLOW_AFTER_MS ? "slow" : "searching";
  const detail = activities.some((a) => /^get_/.test(a.tool));
  return detail ? "reading" : "comparing";
}

/**
 * Frase di attesa coerente con lo stato reale. `elapsedMs` è il tempo dall'invio della richiesta.
 * Con `prefers-reduced-motion` il chiamante può semplicemente non animare il cambio testo.
 */
export function statusPhrase(input: {
  activities: ToolActivity[];
  hasText: boolean;
  elapsedMs: number;
  seed?: number;
  lang?: Lang;
}): string {
  const { activities, hasText, elapsedMs, seed = 0, lang = DEFAULT_LANG } = input;
  const pack = PACKS[lang];
  const tick = Math.floor(elapsedMs / ROTATE_MS);
  switch (detectPhase({ activities, hasText, elapsedMs })) {
    case "start":
      return pick(pack.start, tick, seed);
    case "searching": {
      const running = activities.filter((a) => a.status === "running");
      const servers = [...new Set(running.map((a) => a.server))].filter(
        (s): s is MarketplaceId => s in pack.marketplace,
      );
      if (servers.length >= 3) return pick(pack.many, tick, seed);
      if (!servers.length) return pick(pack.start, tick, seed);
      const server = servers[(tick + seed) % servers.length];
      return pick(pack.marketplace[server], Math.floor(tick / servers.length), seed);
    }
    case "reading":
      return pick(pack.reading, tick, seed);
    case "comparing":
      return pick(pack.comparing, tick, seed);
    case "writing":
      return pick(pack.writing, tick, seed);
    case "slow":
      return pick(pack.slow, tick, seed);
  }
}

/** Riga di riepilogo della timeline a ricerca conclusa. */
export function summaryPhrase(input: { sources: number; products: number; failed: number; lang?: Lang }): string {
  const { sources, products, failed, lang = DEFAULT_LANG } = input;
  const parts = [
    t(lang, "summary.stalls", { count: sources }),
    t(lang, "summary.ads", { count: products }),
  ];
  if (failed) parts.push(t(lang, "summary.closed", { count: failed }));
  return parts.join(" · ");
}

export { SERVER_NAMES };
