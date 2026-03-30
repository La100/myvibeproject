"use client";

import { ArrowDownIcon } from "lucide-react";
import type { UIMessage } from "@convex-dev/agent/react";
import type { PendingContentItem } from "../../data/types";
import { useMessages } from "../../data/hooks/useMessages";
import { Greeting } from "./Greeting";
import { PreviewMessage } from "./Message";
import { ThinkingMessage } from "./ThinkingMessage";
import { cn } from "@/lib/utils";

type MessagesProps = {
  messages: UIMessage[];
  status: "ready" | "submitted" | "streaming" | "error";
  pendingUserMessage?: {
    text: string;
    attachments: Array<{
      name: string;
      size: number;
      type: string;
      previewUrl?: string;
    }>;
  } | null;
  onConfirmItem?: (index: number | string) => Promise<void>;
  onRejectItem?: (index: number | string) => void | Promise<void>;
  onConfirmAll?: () => Promise<void>;
  onRejectAll?: () => void | Promise<void>;
  onUpdateItem?: (index: number | string, updates: Partial<PendingContentItem>) => void;
  isProcessing?: boolean;
  messageMetadataByIndex?: Map<number, {
    fileId?: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
  }>;
  localMessageAttachments?: Record<string, Array<{
    name: string;
    size: number;
    type: string;
    previewUrl?: string;
  }>>;
  pendingItems?: PendingContentItem[];
};

export function Messages({
  messages,
  status,
  pendingUserMessage,
  onConfirmItem,
  onRejectItem,
  onConfirmAll,
  onRejectAll,
  onUpdateItem,
  isProcessing,
  messageMetadataByIndex,
  localMessageAttachments,
  pendingItems,
}: MessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    isAtBottom,
    scrollToBottom,
    hasSentMessage,
  } = useMessages({ status, messagesLength: messages.length });

  const shouldDockMessages =
    messages.length > 0 || Boolean(pendingUserMessage) || hasSentMessage;
  const lastMessage = messages[messages.length - 1];
  const lastAssistantMessageIndex = [...messages]
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => message.role === "assistant")
    .at(-1)?.index ?? -1;
  const activePendingItems = (pendingItems ?? []).filter(
    (item) =>
      item.status !== "confirmed" &&
      item.status !== "rejected" &&
      item.status !== "superseded",
  );
  const shouldShowThinking =
    (status === "submitted" || status === "streaming") &&
    lastMessage?.role !== "assistant";

  return (
    <div className="relative flex-1 min-h-0">
      <div
        className="absolute inset-0 touch-pan-y overflow-y-scroll scroll-smooth px-4 pt-4 pb-6"
        ref={messagesContainerRef}
      >
        <div
          className={cn(
            "mx-auto flex w-full min-w-0 max-w-[44rem] flex-col gap-2",
            shouldDockMessages && "min-h-full"
          )}
        >
          {messages.length === 0 && !pendingUserMessage && !hasSentMessage && <Greeting />}

          {messages.map((message, index) => {
            const messageKey = message.key ?? message.id ?? `${message.order}-${index}`;
            const isActiveConfirmationHost =
              message.role === "assistant" && index === lastAssistantMessageIndex;

            return (
              <PreviewMessage
                key={messageKey}
                message={message}
                isLoading={status === "streaming" && messages.length - 1 === index}
                metadata={messageMetadataByIndex?.get(message.order)}
                localAttachments={localMessageAttachments?.[message.key]}
                onConfirmItem={onConfirmItem}
                onRejectItem={onRejectItem}
                onUpdateItem={onUpdateItem}
                onConfirmAll={onConfirmAll}
                onRejectAll={onRejectAll}
                isProcessing={isProcessing}
                pendingItems={isActiveConfirmationHost ? activePendingItems : []}
                inlineItemsOverride={isActiveConfirmationHost ? activePendingItems : []}
                suppressInlineItemsFromMessage={!isActiveConfirmationHost}
              />
            );
          })}

          {/* Only show pending message if it's not already in the list (dedup by content/timing) */
            pendingUserMessage &&
            !messages.some((m) => m.role === "user" && m.text === pendingUserMessage.text) && (
              <PreviewMessage
                key="pending-user-message"
                message={
                  {
                    id: "pending-user-message",
                    key: "pending-user-message",
                    role: "user",
                    content: pendingUserMessage.text,
                    text: pendingUserMessage.text,
                    parts: [
                      {
                        type: "text",
                        text: pendingUserMessage.text,
                      },
                    ],
                    order: messages.length,
                    stepOrder: messages.length,
                    status: "success",
                    _creationTime: Date.now(),
                  } as UIMessage
                }
                isLoading={false}
                localAttachments={pendingUserMessage.attachments}
              />
            )}

          {shouldShowThinking && <ThinkingMessage />}

          <div
            className="min-h-[24px] min-w-[24px] shrink-0"
            ref={messagesEndRef}
          />
        </div>
      </div>

      <button
        aria-label="Scroll to bottom"
        className={`absolute bottom-8 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border/70 bg-background p-2 shadow-md transition-all hover:bg-muted ${isAtBottom
          ? "pointer-events-none scale-0 opacity-0"
          : "pointer-events-auto scale-100 opacity-100"
          }`}
        onClick={() => scrollToBottom("smooth")}
        type="button"
      >
        <ArrowDownIcon className="size-4" />
      </button>
    </div>
  );
}
