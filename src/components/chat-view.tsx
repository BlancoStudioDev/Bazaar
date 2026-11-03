"use client";

import { useEffect, useRef } from "react";

import { ChatMessage } from "@/components/chat-message";
import { Composer } from "@/components/composer";
import { Welcome } from "@/components/welcome";
import type { BazaarStore } from "@/lib/use-bazaar";

export function ChatView({
  store,
  onOpenResults,
  onOpenSettings,
}: {
  store: BazaarStore;
  onOpenResults: () => void;
  onOpenSettings: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);
  const messages = store.activeConversation?.messages || [];
  const lastMessage = messages[messages.length - 1];

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    if (!messages.length) {
      node.scrollTop = 0;
      return;
    }
    if (!autoScrollRef.current) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, lastMessage?.content, store.isStreaming]);

  const onScroll = () => {
    const node = scrollRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    autoScrollRef.current = distance < 140;
  };

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="scrollbar-thin flex-1 overflow-y-auto scroll-smooth"
      >
        <div className="mx-auto w-full max-w-[760px] px-4 pb-8 pt-6 sm:px-6 sm:pt-8">
          {messages.length ? (
            <div className="space-y-8">
              {messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  store={store}
                  onOpenResults={onOpenResults}
                  onOpenSettings={onOpenSettings}
                  isLast={index === messages.length - 1}
                />
              ))}
            </div>
          ) : (
            <Welcome store={store} onOpenSettings={onOpenSettings} />
          )}
        </div>
      </div>

      <div className="relative shrink-0">
        <div className="mx-auto w-full max-w-[760px] px-4 pb-4 sm:px-6">
          <Composer store={store} onOpenSettings={onOpenSettings} />
        </div>
      </div>
    </div>
  );
}
