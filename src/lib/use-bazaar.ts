"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AgentEvent,
  ChatMessage,
  ConnectionStatus,
  Conversation,
  MarketplaceId,
  ModelRegistryResponse,
  Product,
  ToolActivity,
} from "@/lib/types";
import { MARKETPLACE_IDS } from "@/lib/marketplaces";
import { conversationTitle, uid } from "@/lib/ui";

const LEGACY_CONVERSATIONS_KEY = "bazaar.conversations.v1";
const LEGACY_SETTINGS_KEY = "bazaar.settings.v1";
const conversationsKey = (userId: string) => `${LEGACY_CONVERSATIONS_KEY}.u.${userId}`;
const settingsKey = (userId: string) => `${LEGACY_SETTINGS_KEY}.u.${userId}`;
const MAX_CONVERSATIONS = 40;
const MAX_MESSAGES = 80;

export interface Settings {
  modelMode: "auto" | "manual";
  modelId: string | null;
  enabledMarketplaces: MarketplaceId[];
  city: string;
  allowPaidFallback: boolean;
  settingsVersion: number;
}

const SETTINGS_VERSION = 3;

const DEFAULT_SETTINGS: Settings = {
  modelMode: "auto",
  modelId: null,
  enabledMarketplaces: [...MARKETPLACE_IDS],
  city: "Milano",
  allowPaidFallback: false,
  settingsVersion: SETTINGS_VERSION,
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function sanitizeConversations(value: unknown): Conversation[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Conversation => {
      if (!item || typeof item !== "object") return false;
      const conversation = item as Conversation;
      return (
        typeof conversation.id === "string" &&
        Array.isArray(conversation.messages) &&
        conversation.messages.every(
          (message) => message && (message.role === "user" || message.role === "assistant"),
        )
      );
    })
    .map((conversation) => ({
      ...conversation,
      title: conversation.title || "Ricerca",
      createdAt: conversation.createdAt || Date.now(),
      updatedAt: conversation.updatedAt || Date.now(),
      messages: conversation.messages.slice(-MAX_MESSAGES).map((message) => ({
        ...message,
        content: typeof message.content === "string" ? message.content : "",
        status: message.status || "done",
      })),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_CONVERSATIONS);
}

function sanitizeSettings(value: unknown): Settings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;
  const raw = value as Partial<Settings>;
  const enabled = Array.isArray(raw.enabledMarketplaces)
    ? raw.enabledMarketplaces.filter((id): id is MarketplaceId =>
        MARKETPLACE_IDS.includes(id as MarketplaceId),
      )
    : DEFAULT_SETTINGS.enabledMarketplaces;
  // v3: la riserva economica è spenta di default (costi zero). Le impostazioni
  // salvate con versioni precedenti ripartono da false; dalla v3 vale la scelta salvata.
  const migrated = raw.settingsVersion !== SETTINGS_VERSION;
  return {
    modelMode: raw.modelMode === "manual" ? "manual" : "auto",
    modelId: typeof raw.modelId === "string" ? raw.modelId : null,
    enabledMarketplaces: enabled.length ? enabled : DEFAULT_SETTINGS.enabledMarketplaces,
    city: typeof raw.city === "string" && raw.city.trim() ? raw.city.trim().slice(0, 60) : "Milano",
    allowPaidFallback: migrated ? false : raw.allowPaidFallback === true,
    settingsVersion: SETTINGS_VERSION,
  };
}

function mergeProducts(current: Product[] | undefined, incoming: Product[] | undefined): Product[] {
  if (!incoming?.length) return current || [];
  const map = new Map<string, Product>();
  for (const product of current || []) map.set(product.url || product.key, product);
  for (const product of incoming) map.set(product.url || product.key, product);
  return Array.from(map.values());
}

function mergeActivity(
  activities: ToolActivity[] | undefined,
  incoming: ToolActivity,
): ToolActivity[] {
  const list = activities ? [...activities] : [];
  const index = list.findIndex((item) => item.id === incoming.id);
  if (index >= 0) {
    list[index] = { ...list[index], ...incoming };
  } else {
    list.push(incoming);
  }
  return list;
}

async function readSse(
  response: Response,
  onEvent: (event: AgentEvent) => void,
): Promise<void> {
  if (!response.body) throw new Error("Il server non ha aperto uno stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const processBlock = (block: string) => {
    const lines = block.split("\n");
    let eventName = "message";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    if (!dataLines.length) return;
    const raw = dataLines.join("\n");
    if (!raw) return;
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    onEvent({ type: eventName, ...(payload as object) } as AgentEvent);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let match = buffer.match(/\r?\n\r?\n/);
    while (match && match.index != null) {
      const block = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      processBlock(block);
      match = buffer.match(/\r?\n\r?\n/);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) processBlock(buffer);
}

export function useBazaar(userId: string) {
  const CONVERSATIONS_KEY = conversationsKey(userId);
  const SETTINGS_KEY = settingsKey(userId);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [modelRegistry, setModelRegistry] = useState<ModelRegistryResponse | null>(null);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const abortRef = useRef<AbortController | null>(null);
  const statusRequestRef = useRef(false);
  const textBufferRef = useRef("");
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeAssistantRef = useRef<string | null>(null);
  const activeConversationRef = useRef<string | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) || null,
    [activeId, conversations],
  );

  useEffect(() => {
    // Migrazione una tantum: i dati senza prefisso utente passano al primo utente che entra.
    try {
      if (localStorage.getItem(CONVERSATIONS_KEY) === null) {
        const legacy = localStorage.getItem(LEGACY_CONVERSATIONS_KEY);
        if (legacy !== null) {
          localStorage.setItem(CONVERSATIONS_KEY, legacy);
          localStorage.removeItem(LEGACY_CONVERSATIONS_KEY);
        }
      }
      if (localStorage.getItem(SETTINGS_KEY) === null) {
        const legacy = localStorage.getItem(LEGACY_SETTINGS_KEY);
        if (legacy !== null) localStorage.setItem(SETTINGS_KEY, legacy);
      }
    } catch {
      // storage non disponibile: ignora
    }
    const storedConversations = sanitizeConversations(
      safeParse<unknown>(localStorage.getItem(CONVERSATIONS_KEY), []),
    );
    const storedSettings = sanitizeSettings(
      safeParse<unknown>(localStorage.getItem(SETTINGS_KEY), DEFAULT_SETTINGS),
    );
    setConversations(storedConversations);
    setSettings(storedSettings);
    if (storedConversations.length) {
      setActiveId(storedConversations[0].id);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
      } catch {
        // quota superata: ignora
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [conversations, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings, hydrated]);

  const refreshModels = useCallback(async (force = false) => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const response = await fetch(`/api/models${force ? "?refresh=1" : ""}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as ModelRegistryResponse;
      setModelRegistry(payload);
      return payload;
    } catch (error) {
      setModelsError(error instanceof Error ? error.message : "Errore nel caricamento dei modelli.");
      return null;
    } finally {
      setModelsLoading(false);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    if (statusRequestRef.current) return;
    statusRequestRef.current = true;
    setStatusLoading(true);
    setStatusError(null);
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as ConnectionStatus;
      setStatus(payload);
      return payload;
    } catch (error) {
      setStatusError(
        error instanceof Error ? error.message : "Errore nel controllo delle connessioni.",
      );
      return null;
    } finally {
      setStatusLoading(false);
      statusRequestRef.current = false;
    }
  }, []);

  const reconnect = useCallback(
    async (server?: MarketplaceId) => {
      setStatusLoading(true);
      setStatusError(null);
      try {
        const response = await fetch("/api/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reconnect", server }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as ConnectionStatus;
        setStatus(payload);
        return payload;
      } catch (error) {
        setStatusError(
          error instanceof Error ? error.message : "Errore nella riconnessione.",
        );
        return null;
      } finally {
        setStatusLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void refreshModels();
    void refreshStatus();
  }, [refreshModels, refreshStatus]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refreshStatus();
    }, 60_000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, []);

  const flushText = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const conversationId = activeConversationRef.current;
    const assistantId = activeAssistantRef.current;
    const text = textBufferRef.current;
    textBufferRef.current = "";
    if (!conversationId || !assistantId || !text) return;
    setConversations((prev) =>
      prev.map((conversation) => {
        if (conversation.id !== conversationId) return conversation;
        return {
          ...conversation,
          updatedAt: Date.now(),
          messages: conversation.messages.map((message) =>
            message.id === assistantId
              ? { ...message, content: message.content + text }
              : message,
          ),
        };
      }),
    );
  }, []);

  const scheduleTextFlush = useCallback(() => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      flushText();
    }, 45);
  }, [flushText]);

  const updateAssistant = useCallback(
    (
      conversationId: string,
      assistantId: string,
      updater: (message: ChatMessage) => ChatMessage,
    ) => {
      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== conversationId) return conversation;
          return {
            ...conversation,
            updatedAt: Date.now(),
            messages: conversation.messages.map((message) =>
              message.id === assistantId ? updater(message) : message,
            ),
          };
        }),
      );
    },
    [],
  );

  const startStream = useCallback(
    async (options: {
      conversationId: string;
      baseMessages: ChatMessage[];
      history: Array<{ role: "user" | "assistant"; content: string }>;
      allowPaidFallback?: boolean;
    }) => {
      const { conversationId, baseMessages, history } = options;
      const assistantId = uid("msg");
      const assistant: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        status: "streaming",
        activities: [],
        products: [],
        notices: [],
      };

      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== conversationId) return conversation;
          return {
            ...conversation,
            updatedAt: Date.now(),
            messages: [...baseMessages, assistant].slice(-MAX_MESSAGES),
          };
        }),
      );

      activeConversationRef.current = conversationId;
      activeAssistantRef.current = assistantId;
      textBufferRef.current = "";
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const handleEvent = (event: AgentEvent) => {
        if (event.type === "meta") {
          updateAssistant(conversationId, assistantId, (message) => ({
            ...message,
            model: event.model?.id,
            modelLabel: event.modelLabel,
            isFallback: event.fallback,
          }));
          return;
        }
        if (event.type === "notice") {
          updateAssistant(conversationId, assistantId, (message) => ({
            ...message,
            notices: Array.from(new Set([...(message.notices || []), event.message])),
          }));
          return;
        }
        if (event.type === "activity") {
          updateAssistant(conversationId, assistantId, (message) => ({
            ...message,
            activities: mergeActivity(message.activities, event.activity),
            products: mergeProducts(message.products, event.activity.products),
          }));
          return;
        }
        if (event.type === "delta") {
          textBufferRef.current += event.text;
          scheduleTextFlush();
          return;
        }
        if (event.type === "done") {
          flushText();
          updateAssistant(conversationId, assistantId, (message) => ({
            ...message,
            status: "done",
            usage: event.usage || message.usage,
            modelLabel: event.modelLabel || message.modelLabel,
          }));
          return;
        }
        if (event.type === "error") {
          flushText();
          updateAssistant(conversationId, assistantId, (message) => ({
            ...message,
            status: "error",
            error: event.message,
            errorCode: event.code,
          }));
        }
      };

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            model: settings.modelMode === "manual" ? settings.modelId : null,
            marketplaces: settings.enabledMarketplaces,
            city: settingsRef.current.city.trim() || DEFAULT_SETTINGS.city,
            allowPaidFallback: options.allowPaidFallback ?? settings.allowPaidFallback,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          let detail = `HTTP ${response.status}`;
          try {
            const payload = (await response.json()) as { error?: string };
            if (payload.error) detail = payload.error;
          } catch {
            // ignore
          }
          throw new Error(detail);
        }

        await readSse(response, handleEvent);
        flushText();
        updateAssistant(conversationId, assistantId, (message) =>
          message.status === "streaming" ? { ...message, status: "done" } : message,
        );
      } catch (error) {
        flushText();
        if (controller.signal.aborted) {
          updateAssistant(conversationId, assistantId, (message) => ({
            ...message,
            status: "stopped",
          }));
        } else {
          const message = error instanceof Error ? error.message : "Errore di rete.";
          updateAssistant(conversationId, assistantId, (current) => ({
            ...current,
            status: "error",
            error: message,
          }));
        }
      } finally {
        flushText();
        setIsStreaming(false);
        abortRef.current = null;
        activeAssistantRef.current = null;
        activeConversationRef.current = null;
      }
    },
    [flushText, scheduleTextFlush, settings, updateAssistant],
  );

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || isStreaming) return;

      const userMessage: ChatMessage = {
        id: uid("msg"),
        role: "user",
        content: text,
        createdAt: Date.now(),
        status: "done",
      };

      let conversationId = activeConversation?.id;
      let baseMessages: ChatMessage[] = [];

      if (!conversationId) {
        conversationId = uid("conv");
        const conversation: Conversation = {
          id: conversationId,
          title: conversationTitle(text),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [userMessage],
        };
        setConversations((prev) => [conversation, ...prev].slice(0, MAX_CONVERSATIONS));
        setActiveId(conversationId);
        baseMessages = [userMessage];
      } else {
        const current = activeConversation;
        baseMessages = [...(current?.messages || []), userMessage];
        setConversations((prev) =>
          prev.map((conversation) => {
            if (conversation.id !== conversationId) return conversation;
            return {
              ...conversation,
              title:
                conversation.messages.length === 0
                  ? conversationTitle(text)
                  : conversation.title,
              updatedAt: Date.now(),
              messages: baseMessages,
            };
          }),
        );
      }

      const history = baseMessages
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map((message) => ({ role: message.role, content: message.content }))
        .filter((message) => message.content.trim().length > 0);

      await startStream({
        conversationId,
        baseMessages,
        history,
        allowPaidFallback: settings.allowPaidFallback,
      });
    },
    [activeConversation, isStreaming, settings.allowPaidFallback, startStream],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const newConversation = useCallback(() => {
    abortRef.current?.abort();
    setActiveId(null);
  }, []);

  const selectConversation = useCallback(
    (id: string) => {
      if (isStreaming) abortRef.current?.abort();
      setActiveId(id);
    },
    [isStreaming],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      const remaining = conversations.filter((conversation) => conversation.id !== id);
      if (activeId === id) {
        abortRef.current?.abort();
        setActiveId(remaining[0]?.id || null);
      }
      setConversations((prev) => prev.filter((conversation) => conversation.id !== id));
    },
    [activeId, conversations],
  );

  const retryWithPaidFallback = useCallback(async () => {
    if (!activeConversation || isStreaming) return;
    const messages = activeConversation.messages;
    let lastUserIndex = -1;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "user") {
        lastUserIndex = index;
        break;
      }
    }
    if (lastUserIndex < 0) return;
    const baseMessages = messages.slice(0, lastUserIndex + 1);
    const history = baseMessages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({ role: message.role, content: message.content }))
      .filter((message) => message.content.trim().length > 0);

    await startStream({
      conversationId: activeConversation.id,
      baseMessages,
      history,
      allowPaidFallback: true,
    });
  }, [activeConversation, isStreaming, startStream]);

  const retryLast = useCallback(async () => {
    if (!activeConversation || isStreaming) return;
    const messages = activeConversation.messages;
    let lastUserIndex = -1;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "user") {
        lastUserIndex = index;
        break;
      }
    }
    if (lastUserIndex < 0) return;
    const baseMessages = messages.slice(0, lastUserIndex + 1);
    const history = baseMessages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({ role: message.role, content: message.content }))
      .filter((message) => message.content.trim().length > 0);
    await startStream({
      conversationId: activeConversation.id,
      baseMessages,
      history,
      allowPaidFallback: settings.allowPaidFallback,
    });
  }, [activeConversation, isStreaming, settings.allowPaidFallback, startStream]);

  const toggleMarketplace = useCallback((id: MarketplaceId) => {
    setSettings((prev) => {
      const enabled = prev.enabledMarketplaces.includes(id)
        ? prev.enabledMarketplaces.filter((item) => item !== id)
        : [...prev.enabledMarketplaces, id];
      return { ...prev, enabledMarketplaces: enabled.length ? enabled : [id] };
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearAllConversations = useCallback(() => {
    abortRef.current?.abort();
    setConversations([]);
    setActiveId(null);
  }, []);

  return {
    hydrated,
    conversations,
    activeConversation,
    activeId,
    settings,
    modelRegistry,
    modelsLoading,
    modelsError,
    status,
    statusLoading,
    statusError,
    isStreaming,
    sendMessage,
    stop,
    newConversation,
    selectConversation,
    deleteConversation,
    retryLast,
    retryWithPaidFallback,
    toggleMarketplace,
    updateSettings,
    refreshModels,
    refreshStatus,
    reconnect,
    clearAllConversations,
  };
}

export type BazaarStore = ReturnType<typeof useBazaar>;
