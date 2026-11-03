const CITIES = [
  "Milano", "Roma", "Napoli", "Torino", "Palermo", "Genova", "Bologna", "Firenze", "Bari", "Catania",
  "Venezia", "Verona", "Messina", "Padova", "Trieste", "Brescia", "Parma", "Taranto", "Prato", "Modena",
  "Reggio Calabria", "Reggio Emilia", "Perugia", "Livorno", "Ravenna", "Cagliari", "Foggia", "Rimini",
  "Salerno", "Ferrara", "Sassari", "Latina", "Monza", "Siracusa", "Pescara", "Bergamo", "Forlì", "Trento",
  "Vicenza", "Terni", "Bolzano", "Novara", "Piacenza", "Ancona", "Andria", "Arezzo", "Udine", "Cesena",
  "Lecce", "Pesaro", "La Spezia", "Como", "Pisa", "Lucca", "Varese", "Treviso", "Cosenza", "Brindisi",
  "Caserta", "Pavia", "Cremona", "Mantova", "Lecco", "Aosta", "Potenza", "Campobasso", "L'Aquila",
  "Catanzaro", "Trapani", "Agrigento", "Savona", "Asti", "Alessandria", "Cuneo", "Siena", "Grosseto",
  "Viterbo", "Rieti", "Frosinone", "Benevento", "Avellino", "Matera", "Crotone", "Olbia", "Sondrio",
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'");
}

const CITY_PATTERNS = CITIES.map((city) => ({
  city,
  pattern: new RegExp(`(^|[^a-z])${normalize(city).replace(/ /g, "\\s+")}($|[^a-z])`),
}));

/**
 * Se l'ultimo messaggio dell'utente nomina esplicitamente una città italiana
 * (es. "a Roma", "vicino Bologna") la restituisce, altrimenti null.
 */
export function explicitCityInText(text: string): string | null {
  const haystack = normalize(text);
  for (const entry of CITY_PATTERNS) {
    if (entry.pattern.test(haystack)) return entry.city;
  }
  return null;
}
