"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppendMessage, Attachment, ThreadMessageLike } from "@assistant-ui/react";
import { AssistantRuntimeProvider, useExternalStoreRuntime } from "@assistant-ui/react";
import type { AttachmentAdapter } from "@assistant-ui/react";
import type { UIMessage } from "@convex-dev/agent/react";
import { Loader2, RotateCcw } from "lucide-react";
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
  onUpdateItem?: (index: number | string, updates: Partial<PendingContentItem>) => void;
  isProcessing?: boolean;
  confirmationMode?: "always_ask" | "auto_confirm";
  onConfirmationModeChange?: (mode: "always_ask" | "auto_confirm") => void | Promise<void>;
  isModeUpdating?: boolean;
};

type StoreMessage =
  | { kind: "ui"; message: UIMessage }
  | { kind: "optimistic"; message: ThreadMessageLike };

const ENABLE_OPTIMISTIC_USER_MESSAGE = true;

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
  onUpdateItem,
  isProcessing = false,
  confirmationMode = "always_ask",
  onConfirmationModeChange,
  isModeUpdating = false,
}: AssistantConversationProps) {
  const [optimisticMessages, setOptimisticMessages] = useState<ThreadMessageLike[]>([]);
  const optimisticMetaRef = useRef<{
    normalizedText: string;
    serverUserCountAtSend: number;
  } | null>(null);
  const onSendRef = useRef(onSend);
  const onStopRef = useRef(onStop);

  useEffect(() => {
    onSendRef.current = onSend;
  }, [onSend]);

  useEffect(() => {
    onStopRef.current = onStop;
  }, [onStop]);

  const isBooting = chatIsLoading;
  const hasVisibleMessages = uiMessages.length > 0 || optimisticMessages.length > 0;
  const shouldHideThread = isBooting && !hasVisibleMessages;
  const showWelcomeForEmptyThread = !isBooting && !hasVisibleMessages;

  useEffect(() => {
    if (isBooting) return;
    const focusInput = () => {
      const input = document.getElementById("assistant-chat-input") as HTMLTextAreaElement | null;
      input?.focus();
    };
    if (document.hasFocus()) {
      focusInput();
    } else {
      window.addEventListener("focus", focusInput, { once: true });
      return () => window.removeEventListener("focus", focusInput);
    }
  }, [isBooting]);

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

  const convertedMessages = useMemo<StoreMessage[]>(
    () => {
      return uiMessages
        .filter((message) => (message.role ?? "assistant") !== "system")
        .map((message) => ({ kind: "ui", message }));
    },
    [uiMessages],
  );

  const serverUserCount = useMemo(
    () =>
      convertedMessages.filter(
        (message) =>
          message.kind === "ui" && (message.message.role ?? "assistant") === "user",
      ).length,
    [convertedMessages],
  );

  const getLastServerUserText = useCallback((messages: StoreMessage[]) => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const candidate = messages[i];
      if (candidate.kind !== "ui") continue;
      if ((candidate.message.role ?? "assistant") !== "user") continue;
      return normalizeText(
        toText(toThreadMessageLikeFromUI(candidate.message, "complete").content),
      );
    }
    return "";
  }, []);

  const onNew = useCallback(
    async (message: AppendMessage) => {
      const files =
        message.attachments
          ?.map((attachment) => attachment.file)
          .filter((file): file is File => !!file) ?? [];

      const promptText = toText(message.content) || "";

      if (ENABLE_OPTIMISTIC_USER_MESSAGE && (promptText || files.length > 0)) {
        const optimisticMessage = makeLocalMessage("user", promptText, message.attachments);
        optimisticMetaRef.current = {
          normalizedText: normalizeText(promptText),
          serverUserCountAtSend: serverUserCount,
        };
        setOptimisticMessages((prev) => [...prev, optimisticMessage]);
      }

      await onSendRef.current({ text: promptText, files });
    },
    [serverUserCount],
  );

  const storeMessages = useMemo<StoreMessage[]>(() => {
    const converted = convertedMessages;

    if (!ENABLE_OPTIMISTIC_USER_MESSAGE) {
      return converted;
    }

    if (optimisticMessages.length === 0) {
      return converted;
    }

    const lastOptimistic = optimisticMessages[optimisticMessages.length - 1];
    const optimisticText = normalizeText(toText(lastOptimistic.content));
    const optimisticMeta = optimisticMetaRef.current;
    const hasFreshUserMessage =
      serverUserCount > (optimisticMeta?.serverUserCountAtSend ?? -1);
    const hasUserMessage =
      hasFreshUserMessage &&
      getLastServerUserText(converted) === (optimisticMeta?.normalizedText ?? optimisticText);

    return hasUserMessage
      ? converted
      : [
          ...converted,
          ...optimisticMessages.map(
            (message): StoreMessage => ({ kind: "optimistic", message }),
          ),
        ];
  }, [convertedMessages, getLastServerUserText, optimisticMessages, serverUserCount]);

  useEffect(() => {
    if (!ENABLE_OPTIMISTIC_USER_MESSAGE) return;
    if (optimisticMessages.length === 0) return;
    const lastOptimistic = optimisticMessages[optimisticMessages.length - 1];
    const optimisticText = normalizeText(toText(lastOptimistic.content));
    const optimisticMeta = optimisticMetaRef.current;
    const hasFreshUserMessage =
      serverUserCount > (optimisticMeta?.serverUserCountAtSend ?? -1);
    const hasUserMessage =
      hasFreshUserMessage &&
      getLastServerUserText(convertedMessages) ===
        (optimisticMeta?.normalizedText ?? optimisticText);
    if (hasUserMessage) {
      optimisticMetaRef.current = null;
      setOptimisticMessages([]);
    }
  }, [convertedMessages, getLastServerUserText, optimisticMessages, serverUserCount]);

  const convertMessage = useMemo(
    () =>
      (message: StoreMessage): ThreadMessageLike => {
        if (message.kind === "optimistic") return message.message;

        const role = (message.message.role ?? "assistant") as ThreadRole;
        const uiStatus = message.message.status;
        const isRunningAssistant =
          role === "assistant" && uiStatus === "streaming";

        return toThreadMessageLikeFromUI(
          message.message,
          isRunningAssistant ? "running" : "complete",
        );
      },
    [],
  );

  const store = useMemo(
    () => ({
      isRunning: (isStreaming || isLoading) && hasVisibleMessages,
      isLoading: isBooting && !hasVisibleMessages,
      messages: storeMessages,
      convertMessage,
      onNew,
      onCancel: async () => {
        onStopRef.current();
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
      isBooting,
      hasVisibleMessages,
      onNew,
      storeMessages,
    ],
  );

  const runtime = useExternalStoreRuntime(store);

  const handleReset = useCallback(async () => {
    optimisticMetaRef.current = null;
    setOptimisticMessages([]);
    await onReset();
  }, [onReset]);

  const resolvedAssistantFallback = assistantFallback || title.charAt(0) || "A";

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className={cn("flex h-full min-h-0 w-full flex-col", className)}>
        {showHeader && (
          <div className="flex items-center justify-end px-4 py-2">
            <TooltipIconButton
              tooltip="Reset chat"
              variant="ghost"
              className="h-10 w-10 rounded-full"
              onClick={handleReset}
              disabled={isStreaming || isLoading}
            >
              <RotateCcw className="h-5 w-5" />
            </TooltipIconButton>
          </div>
        )}
        <div className="relative flex-1 min-h-0">
          <div
            className={`flex h-full min-h-0 flex-1 transition-opacity duration-300 ${shouldHideThread ? "opacity-0" : "opacity-100"}`}
          >
            <Thread
              showWelcome={showWelcomeForEmptyThread}
              assistantImageUrl={assistantImageUrl}
              assistantFallback={resolvedAssistantFallback}
              userImageUrl={userImageUrl}
              userFallback={userFallback}
              pendingItems={pendingItems}
              onConfirmItem={onConfirmItem}
              onRejectItem={onRejectItem}
              onEditItem={onEditItem}
              onUpdateItem={onUpdateItem}
              isProcessing={isProcessing}
              confirmationMode={confirmationMode}
              onConfirmationModeChange={onConfirmationModeChange}
              isModeUpdating={isModeUpdating}
            />
          </div>
          <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground transition-opacity duration-300 ${shouldHideThread ? "opacity-100" : "opacity-0"}`}
            aria-hidden={!shouldHideThread}
          >
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
          </div>
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}
