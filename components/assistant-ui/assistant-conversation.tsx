"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppendMessage, Attachment, ThreadMessageLike } from "@assistant-ui/react";
import { AssistantRuntimeProvider, useExternalStoreRuntime } from "@assistant-ui/react";
import type { AttachmentAdapter } from "@assistant-ui/react";
import type { UIMessage } from "@convex-dev/agent/react";
import { MessageSquare, RotateCcw } from "lucide-react";
import type { PendingContentItem } from "@/components/ai/assistant/data/types";

import { Thread } from "@/components/assistant-ui/thread";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { ACCEPTED_FILE_TYPES } from "@/components/ai/assistant/config";
import { cn } from "@/lib/utils";

type ThreadRole = "assistant" | "user" | "system";
type ThreadContentPart = Exclude<ThreadMessageLike["content"], string>[number];

type ReadonlyJSONObject = { readonly [key: string]: ReadonlyJSONValue };
type ReadonlyJSONValue =
  | string
  | number
  | boolean
  | null
  | ReadonlyJSONObject
  | ReadonlyJSONValue[];

type AssistantConversationProps = {
  className?: string;
  title?: string;
  showHeader?: boolean;
  assistantImageUrl?: string;
  assistantFallback?: string;
  uiMessages: UIMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  chatIsLoading: boolean;
  onSend: (payload: { text: string; files: File[] }) => Promise<void>;
  onStop: () => void;
  onReset: () => Promise<void> | void;
  userImageUrl?: string;
  userFallback?: string;
  pendingItems?: PendingContentItem[];
  onConfirmItem?: (index: number | string) => Promise<void>;
  onRejectItem?: (index: number | string) => void | Promise<void>;
  onEditItem?: (index: number) => void;
  onConfirmAll?: () => Promise<void>;
  onRejectAll?: () => void | Promise<void>;
  onUpdateItem?: (index: number | string, updates: Partial<PendingContentItem>) => void;
  isProcessing?: boolean;
  confirmationMode?: "always_ask" | "auto_confirm";
  onConfirmationModeChange?: (mode: "always_ask" | "auto_confirm") => void | Promise<void>;
  isModeUpdating?: boolean;
};

type MessageConversionOptions = {
  hideToolCalls?: boolean;
};

type StoreMessage =
  | { kind: "ui"; message: UIMessage }
  | { kind: "optimistic"; message: ThreadMessageLike };

const toText = (content: ThreadMessageLike["content"]) => {
  if (typeof content === "string") return content;
  return content
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
};

const normalizeText = (text: string) => text.trim().replace(/\s+/g, " ");

const toThreadMessageLikeFromUI = (
  msg: UIMessage,
  status?: "running" | "complete",
  options?: MessageConversionOptions,
): ThreadMessageLike => {
  const role = (msg.role ?? "assistant") as ThreadRole;
  const parts = Array.isArray(msg.parts) ? (msg.parts as Array<Record<string, unknown>>) : [];
  const content: ThreadContentPart[] = [];
  const record = msg as unknown as Record<string, unknown>;
  const messageId =
    (typeof record.key === "string" && record.key) ||
    (typeof record._id === "string" && record._id) ||
    undefined;

  for (const part of parts) {
    const type = String(part.type ?? "");
    if (type === "text" && typeof part.text === "string") {
      content.push({ type: "text", text: part.text });
      continue;
    }

    if (type.startsWith("tool-result:")) {
      if (options?.hideToolCalls) {
        continue;
      }
      const toolCallId = type.replace("tool-result:", "");
      const toolName =
        (typeof part.toolName === "string" && part.toolName) ||
        (typeof part.name === "string" && part.name) ||
        "tool";
      let result: unknown = undefined;
      if (typeof part.result === "string") {
        try {
          result = JSON.parse(part.result);
        } catch {
          result = part.result;
        }
      }
      const args =
        typeof part.args === "object" && part.args
          ? (part.args as ReadonlyJSONObject)
          : undefined;

      content.push({
        type: "tool-call",
        toolCallId,
        toolName,
        args,
        argsText:
          (typeof part.argsText === "string" && part.argsText) ||
          (typeof part.args === "object" ? JSON.stringify(part.args) : ""),
        result,
        isError:
          typeof result === "object" &&
          result !== null &&
          "error" in (result as Record<string, unknown>),
      });
      continue;
    }
  }

  if (content.length === 0) {
    const fallbackText =
      typeof msg.text === "string"
        ? msg.text
        : typeof record.content === "string"
          ? record.content
          : "";
    if (fallbackText) {
      content.push({ type: "text", text: fallbackText });
    }
  }

  if (role === "assistant") {
    return {
      id: messageId,
      role,
      content,
      status:
        status === "running"
          ? { type: "running" }
          : { type: "complete", reason: "stop" },
      metadata: { custom: {} },
    };
  }

  return {
    id: messageId,
    role,
    content,
    metadata: { custom: {} },
  };
};

const makeLocalMessage = (
  role: ThreadRole,
  text: string,
  attachments?: ThreadMessageLike["attachments"],
): ThreadMessageLike => {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const content: ThreadContentPart[] = text ? [{ type: "text", text }] : [];
  return {
    id,
    role,
    content,
    attachments,
    status:
      role === "assistant" ? { type: "complete", reason: "stop" } : undefined,
    metadata: { custom: {} },
  };
};

export default function AssistantConversation({
  className,
  title = "Assistant",
  showHeader = true,
  assistantImageUrl,
  assistantFallback,
  uiMessages,
  isLoading,
  isStreaming,
  chatIsLoading,
  onSend,
  onStop,
  onReset,
  userImageUrl,
  userFallback = "U",
  pendingItems = [],
  onConfirmItem,
  onRejectItem,
  onEditItem,
  onConfirmAll,
  onRejectAll,
  onUpdateItem,
  isProcessing = false,
  confirmationMode = "always_ask",
  onConfirmationModeChange,
  isModeUpdating = false,
}: AssistantConversationProps) {
  const [optimisticMessages, setOptimisticMessages] = useState<ThreadMessageLike[]>([]);

  const isBooting = chatIsLoading;

  const attachmentAdapter = useMemo<AttachmentAdapter>(() => {
    return {
      accept: ACCEPTED_FILE_TYPES,
      async add({ file }) {
        const isImage = file.type.startsWith("image/");
        return {
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: isImage ? "image" : "file",
          name: file.name,
          contentType: file.type || "application/octet-stream",
          file,
          status: { type: "requires-action", reason: "composer-send" },
        };
      },
      async remove(attachment: Attachment) {
        void attachment;
        return;
      },
      async send(attachment) {
        return {
          ...attachment,
          status: { type: "complete" },
          content: [],
        };
      },
    };
  }, []);

  const onNew = useCallback(
    async (message: AppendMessage) => {
      const files =
        message.attachments
          ?.map((attachment) => attachment.file)
          .filter((file): file is File => !!file) ?? [];

      const promptText = toText(message.content) || "";

      if (promptText || files.length > 0) {
        setOptimisticMessages((prev) => [
          ...prev,
          makeLocalMessage("user", promptText, message.attachments),
        ]);
      }

      await onSend({ text: promptText, files });
    },
    [onSend],
  );

  const convertedMessages = useMemo<StoreMessage[]>(
    () => {
      return uiMessages
        .filter((message) => (message.role ?? "assistant") !== "system")
        .map((message) => ({ kind: "ui", message }));
    },
    [uiMessages],
  );

  const storeMessages = useMemo<StoreMessage[]>(() => {
    const converted = convertedMessages;

    if (optimisticMessages.length === 0) {
      return converted;
    }

    const lastOptimistic = optimisticMessages[optimisticMessages.length - 1];
    const optimisticText = normalizeText(toText(lastOptimistic.content));
    const hasUserMessage = converted.some((msg) => {
      if (msg.kind !== "ui") return false;
      if ((msg.message.role ?? "assistant") !== "user") return false;
      const messageText = normalizeText(
        toText(toThreadMessageLikeFromUI(msg.message, "complete").content),
      );
      return messageText === optimisticText;
    });

    return hasUserMessage
      ? converted
      : [
          ...converted,
          ...optimisticMessages.map(
            (message): StoreMessage => ({ kind: "optimistic", message }),
          ),
        ];
  }, [convertedMessages, optimisticMessages]);

  useEffect(() => {
    if (optimisticMessages.length === 0) return;
    const lastOptimistic = optimisticMessages[optimisticMessages.length - 1];
    const optimisticText = normalizeText(toText(lastOptimistic.content));
    const hasUserMessage = convertedMessages.some(
      (msg) =>
        msg.kind === "ui" &&
        (msg.message.role ?? "assistant") === "user" &&
        normalizeText(toText(toThreadMessageLikeFromUI(msg.message, "complete").content)) === optimisticText,
    );
    if (hasUserMessage) {
      setOptimisticMessages([]);
    }
  }, [convertedMessages, optimisticMessages]);

  const convertMessage = useMemo(
    () =>
      (message: StoreMessage, index: number): ThreadMessageLike => {
        if (message.kind === "optimistic") return message.message;

        const role = (message.message.role ?? "assistant") as ThreadRole;
        const isLast = index === storeMessages.length - 1;
        const isRunningAssistant = role === "assistant" && isStreaming && isLast;

        return toThreadMessageLikeFromUI(
          message.message,
          isRunningAssistant ? "running" : "complete",
        );
      },
    [isStreaming, storeMessages.length],
  );

  const store = useMemo(
    () => ({
      isRunning: isStreaming || isLoading,
      isLoading: false,
      messages: storeMessages,
      convertMessage,
      onNew,
      onCancel: async () => {
        onStop();
      },
      adapters: {
        attachments: attachmentAdapter,
      },
    }),
    [
      attachmentAdapter,
      convertMessage,
      isLoading,
      isStreaming,
      onNew,
      onStop,
      storeMessages,
    ],
  );

  const runtime = useExternalStoreRuntime(store);

  const handleReset = useCallback(async () => {
    setOptimisticMessages([]);
    await onReset();
  }, [onReset]);

  const resolvedAssistantFallback = assistantFallback || title.charAt(0) || "A";

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className={cn("flex h-full min-h-0 w-full flex-col", className)}>
        {showHeader && (
          <div className="flex items-center justify-between border-b border-border/60 bg-background/70 px-4 py-2 backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4 text-primary" />
              {title}
            </div>
            <TooltipIconButton
              tooltip="Reset chat"
              variant="ghost"
              className="h-8 w-8 rounded-full"
              onClick={handleReset}
              disabled={isStreaming || isLoading}
            >
              <RotateCcw className="h-4 w-4" />
            </TooltipIconButton>
          </div>
        )}
        <div className="relative flex-1 min-h-0">
          <div
            className={`flex h-full min-h-0 flex-1 transition-opacity duration-300 ${isBooting ? "opacity-70" : "opacity-100"}`}
          >
            <Thread
              showWelcome={!isBooting && uiMessages.length === 0}
              assistantImageUrl={assistantImageUrl}
              assistantFallback={resolvedAssistantFallback}
              userImageUrl={userImageUrl}
              userFallback={userFallback}
              pendingItems={pendingItems}
              onConfirmItem={onConfirmItem}
              onRejectItem={onRejectItem}
              onEditItem={onEditItem}
              onConfirmAll={onConfirmAll}
              onRejectAll={onRejectAll}
              onUpdateItem={onUpdateItem}
              isProcessing={isProcessing}
              confirmationMode={confirmationMode}
              onConfirmationModeChange={onConfirmationModeChange}
              isModeUpdating={isModeUpdating}
            />
          </div>
          <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground transition-opacity duration-300 ${isBooting ? "opacity-100" : "opacity-0"}`}
            aria-hidden={!isBooting}
          >
            Loading conversation…
          </div>
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}
