export type MarketplaceId =
  | "amazon"
  | "aliexpress"
  | "vinted"
  | "subito"
  | "facebook-marketplace";

export type ServerStatus = "idle" | "connecting" | "online" | "offline";

export interface Product {
  key: string;
  marketplace: MarketplaceId;
  id: string;
  title: string;
  price: number | null;
  priceLabel: string | null;
  url: string;
  image?: string | null;
  condition?: string | null;
  location?: string | null;
  seller?: string | null;
  rating?: number | null;
  reviews?: number | null;
  extra?: string | null;
  query?: string | null;
}

export interface ToolActivity {
  id: string;
  server: string;
  tool: string;
  label: string;
  args: Record<string, unknown>;
  status: "running" | "done" | "error";
  startedAt: number;
  durationMs?: number;
  count?: number;
  error?: string;
  products?: Product[];
}

export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  model?: string;
  modelLabel?: string;
  status: "streaming" | "done" | "error" | "stopped";
  error?: string;
  errorCode?: string;
  notices?: string[];
  isFallback?: boolean;
  activities?: ToolActivity[];
  products?: Product[];
  usage?: ChatUsage;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface ModelMetrics {
  latencyMs: number | null;
  throughput: number | null;
  uptime: number | null;
}

export interface FreeModel {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  description?: string;
  metrics: ModelMetrics;
  scores: {
    intelligence: number;
    speed: number;
    reliability: number;
    overall: number;
  };
  reason: string;
  isRouter?: boolean;
  isPaid?: boolean;
  pricingNote?: string;
  /** Provider diretto (groq, cerebras, gemini, mistral); assente = OpenRouter. */
  providerId?: string;
  baseUrl?: string;
}

export interface ModelRegistry {
  selected: FreeModel | null;
  models: FreeModel[];
  routerModel: FreeModel | null;
  fetchedAt: number;
  source: "live" | "fallback";
  note?: string;
}

export interface ModelRegistryResponse extends ModelRegistry {
  paidFallbackAvailable: boolean;
  paidFallbackModel: FreeModel | null;
}

export interface McpServerInfo {
  id: MarketplaceId;
  label: string;
  description: string;
  color: string;
  status: ServerStatus;
  tools: string[];
  latencyMs?: number;
  error?: string;
  lastUsed?: number;
}

export interface ConnectionStatus {
  openrouter: {
    ok: boolean;
    label: string;
    keyMasked?: string;
    freeUsed?: number;
    freeLimit?: number;
    credits?: number;
    error?: string;
  };
  providers?: Array<{ id: string; label: string; model: string }>;
  mcp: McpServerInfo[];
  checkedAt: number;
}

export interface ChatRequestBody {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  model?: string | null;
  marketplaces?: MarketplaceId[];
  city?: string;
  allowPaidFallback?: boolean;
}

export type AgentEvent =
  | {
      type: "meta";
      model: FreeModel | null;
      modelLabel: string;
      fallback: boolean;
    }
  | { type: "activity"; activity: ToolActivity }
  | { type: "delta"; text: string }
  | { type: "notice"; message: string }
  | { type: "done"; usage?: ChatUsage; modelLabel?: string }
  | { type: "error"; message: string; code?: string };
