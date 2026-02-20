"use client";
/**
 * useAIChat Hook
 * 
 * Manages chat state, message sending, and thread operations for the AI Assistant.
 * Uses Convex Agent's streaming hooks for real-time message updates.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import type { ChatHistoryEntry, SessionTokens } from "../types";
import { useUIMessages } from "@convex-dev/agent/react";

type UIMessagesResult = ReturnType<typeof useUIMessages>["results"];
type UIMessageItem = NonNullable<UIMessagesResult>[number];
type MessagePart = NonNullable<UIMessageItem["parts"]>[number];
type ToolResultPart = MessagePart & { result?: string };
type ToolCallishPart = MessagePart & {
  toolCallId?: string;
  callId?: string;
  id?: string;
  toolName?: string;
  name?: string;
};
type PersistentCall = {
  callId: string;
  status?: string;
  result?: string;
  arguments: string;
};

interface UseAIChatProps {
  projectId: Id<"projects"> | undefined;
  userClerkId: string | undefined;
}

interface UseAIChatReturn {
  // State
  message: string;
  setMessage: (msg: string) => void;
  chatHistory: ChatHistoryEntry[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryEntry[]>>;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  currentMode: "full" | "recent" | null;
  sessionTokens: SessionTokens;
  threadId: string | undefined;
  setThreadId: (id: string | undefined) => void;
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
  isStreaming: boolean;

  // Computed
  threadList: Array<{
    threadId: string;
    title: string;
    lastMessageAt?: number;
    lastMessagePreview?: string;
    lastMessageRole?: string;
    messageCount: number;
  }>;
  isThreadListLoading: boolean;
  hasThreads: boolean;
  showEmptyState: boolean;
  chatIsLoading: boolean;
  previousThreadsCount: number;
  mobileSelectValue: string;

  // UIMessages from streaming
  uiMessages: UIMessagesResult;
  streamingStatus: "LoadingFirstPage" | "CanLoadMore" | "Exhausted";
  loadMoreMessages: (numItems: number) => void;
  messageMetadataByIndex: Map<number, {
    fileId?: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    mode?: string;
  }>;

  // Refs
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;

  // Actions
  handleSendMessage: (
    selectedFiles: File[],
    uploadedFileIds: string[],
    onUploadStart: () => void,
    onUploadComplete: (fileIds: string[]) => void,
    generateUploadUrl: (args: { projectId: Id<"projects">; fileName: string; origin: string }) => Promise<{ url: string; key: string }>,
    addFile: (args: { projectId: Id<"projects">; fileKey: string; fileName: string; fileType: string; fileSize: number; origin: string }) => Promise<string>,
    promptOverride?: string
  ) => Promise<void>;
  handleStopResponse: () => void;
  handleClearChat: () => Promise<void>;
  handleClearPreviousThreads: () => Promise<void>;
  handleNewChat: () => void;
  handleThreadSelect: (selectedThreadId: string) => void;
  handleQuickPromptClick: (prompt: string) => void;
  scrollToBottom: () => void;
}

export const useAIChat = ({ projectId, userClerkId }: UseAIChatProps): UseAIChatReturn => {
  // State
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [initialThreadSelectionDone, setInitialThreadSelectionDone] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentMode, setCurrentMode] = useState<'full' | 'recent' | null>(null);
  const [sessionTokens, setSessionTokens] = useState<SessionTokens>({ total: 0, cost: 0 });

  // Anti-flicker: suppress messages briefly when switching threads to ensure 
  // useUIMessages doesn't render stale data from the previous thread.
  const [suppressMessages, setSuppressMessages] = useState(false);
  const suppressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setThreadIdWithSuppression = useCallback((id: string | undefined) => {
    const previousThreadId = threadId;

    if (suppressTimeoutRef.current) {
      clearTimeout(suppressTimeoutRef.current);
      suppressTimeoutRef.current = null;
    }

    setThreadId(id);

    // Clearing thread means empty chat immediately.
    if (!id) {
      setSuppressMessages(false);
      return;
    }

    // Suppress only when switching between two existing threads.
    // For a brand-new thread created after first send (undefined -> id),
    // suppression causes optimistic user message flicker.
    const isExistingThreadSwitch = Boolean(previousThreadId && previousThreadId !== id);
    if (!isExistingThreadSwitch) {
      setSuppressMessages(false);
      return;
    }

    // While switching to another concrete thread, hide message list briefly
    // until the new thread has loaded at least its first page.
    setSuppressMessages(true);
    suppressTimeoutRef.current = setTimeout(() => {
      setSuppressMessages(false);
      suppressTimeoutRef.current = null;
    }, 600);
  }, [threadId]);

  useEffect(() => {
    return () => {
      if (suppressTimeoutRef.current) {
        clearTimeout(suppressTimeoutRef.current);
      }
    };
  }, []);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isSendingRef = useRef(false);

  // CRITICAL: Subscribe strategy based on thread type
  // - Skip if no threadId (empty/new chat state)
  // - For new threads: subscribe anyway (optimistic updates will work)
  // - For existing threads: always subscribe
  const shouldSubscribe = Boolean(threadId);

  // List persistent function calls (pending + confirmed/rejected)
  const persistentFunctionCalls = useQuery(
    apiAny.ai.threads.listPendingItems,
    shouldSubscribe ? { threadId: threadId! } : "skip"
  );

  const streamingHookResult = useUIMessages(
    apiAny.ai.streamingQueries.listThreadMessages,
    shouldSubscribe ? { threadId: threadId! } : "skip",
    { initialNumItems: 50, stream: true }
  );

  // Extract results - always from hook when subscribed
  const rawUiMessages = shouldSubscribe ? streamingHookResult.results : undefined;

  const stripThinking = useCallback((text: string) => {
    if (!text.includes("<thinking>")) return text;
    const withoutBlocks = text.replace(/<thinking>[\s\S]*?<\/thinking>/g, "");
    const withoutOpen = withoutBlocks.replace(/<thinking>[\s\S]*$/g, "");
    return withoutOpen.replace(/<\/thinking>/g, "");
  }, []);

  // Merge persistent status into UI messages
  const uiMessages = useMemo(() => {
    if (suppressMessages) return [] as UIMessagesResult;
    if (!rawUiMessages) return undefined;
    if (!persistentFunctionCalls) return rawUiMessages;

    const callMap = new Map<string, PersistentCall>(
      persistentFunctionCalls.map((c) => {
        const call = c as PersistentCall;
        return [call.callId, call];
      })
    );

    return rawUiMessages.map(msg => {
      if (!msg.parts) return msg;

      let parts = [...msg.parts];
      let hasUpdates = false;

      // 1. Update existing tool-results with persisted status
      parts = parts.map(part => {
        if (part.type.startsWith("tool-result")) {
          const callId = part.type.replace("tool-result:", "");
          const persistentCall = callMap.get(callId);

          const partWithResult = part as ToolResultPart;
          if (persistentCall?.status && partWithResult.result) {
            try {
              const currentResult = JSON.parse(partWithResult.result);
              if (currentResult.status !== persistentCall.status) {
                hasUpdates = true;
                const enrichedResult = {
                  ...currentResult,
                  status: persistentCall.status,
                  outcome: persistentCall.result ? JSON.parse(persistentCall.result) : undefined
                };
                return {
                  ...part,
                  result: JSON.stringify(enrichedResult)
                };
              }
            } catch {
              return part;
            }
          }
        }
        return part;
      });

      // 2. Inject missing tool-results for pending items
      const toolCallParts = parts.filter((p) => {
        const part = p as ToolCallishPart;
        const hasCallId = "toolCallId" in part || "callId" in part || "id" in part;
        const isToolCallType = typeof part.type === "string" && part.type.startsWith("tool-");
        return (isToolCallType || hasCallId) && !part.type.startsWith("tool-result");
      });

      for (const tc of toolCallParts) {
        const toolCallish = tc as ToolCallishPart;
        const callId = toolCallish.toolCallId || toolCallish.callId || toolCallish.id;

        if (callId) {
          const persistentCall = callMap.get(callId);
          const hasResult = parts.some(p => p.type === `tool-result:${callId}`);

          if (persistentCall && !hasResult && persistentCall.arguments) {
            hasUpdates = true;
            parts.push({
              type: `tool-result:${callId}`,
              toolCallId: callId,
              toolName: toolCallish.toolName || toolCallish.name,
              result: JSON.stringify({
                ...JSON.parse(persistentCall.arguments),
                status: persistentCall.status
              })
            } as MessagePart);
          }
        }
      }

      // 3. Strip any <thinking> tags or reasoning parts from text
      let partsChanged = false;
      const processedParts: MessagePart[] = [];

      for (const part of parts) {
        if (part.type === "reasoning") {
          partsChanged = true;
          hasUpdates = true;
          continue;
        }

        if (part.type === "text" && typeof (part as unknown as { text: string }).text === "string") {
          const rawText = (part as unknown as { text: string }).text as string;
          const cleaned = stripThinking(rawText).trimEnd();
          if (cleaned !== rawText) {
            partsChanged = true;
            hasUpdates = true;
          }
          if (cleaned.length > 0) {
            processedParts.push({
              ...part,
              text: cleaned,
            } as MessagePart);
          } else {
            partsChanged = true;
            hasUpdates = true;
          }
          continue;
        }

        processedParts.push(part);
      }

      if (partsChanged) {
        parts = processedParts;
      }

      if (!hasUpdates) return msg;

      // If we modified parts (either via tools/status or stripping thinking tags),
      // update both parts and the flattened text field to avoid rendering raw tags.
      if (partsChanged) {
        const newText = parts
          .filter(p => p.type === "text" && typeof (p as unknown as { text: string }).text === "string")
          .map(p => (p as unknown as { text: string }).text)
          .join("");

        return {
          ...msg,
          parts,
          text: newText
        };
      }

      return {
        ...msg,
        parts
      };
    }).map((msg) => {
      if (!msg.parts && typeof (msg as { text?: unknown }).text === "string") {
        const rawText = (msg as { text: string }).text;
        const cleaned = stripThinking(rawText).trimEnd();
        if (cleaned !== rawText) {
          return {
            ...msg,
            text: cleaned,
          };
        }
      }
      return msg;
    });
  }, [rawUiMessages, persistentFunctionCalls, stripThinking, suppressMessages]);

  const streamingStatus = shouldSubscribe ? streamingHookResult.status : "Exhausted";
  const loadMoreMessages = streamingHookResult.loadMore;

  // Release suppression as soon as the current thread finishes first-page loading.
  useEffect(() => {
    if (!suppressMessages) return;
    if (!threadId) {
      setSuppressMessages(false);
      return;
    }
    if (streamingStatus !== "LoadingFirstPage") {
      if (suppressTimeoutRef.current) {
        clearTimeout(suppressTimeoutRef.current);
        suppressTimeoutRef.current = null;
      }
      setSuppressMessages(false);
    }
  }, [suppressMessages, threadId, streamingStatus]);

  // Streaming mutation
  const initiateStreamingMutation = useMutation(
    apiAny.ai.streamingQueries.initiateStreaming
  );

  // Abort streaming mutation
  const abortStreamMutation = useMutation(apiAny.ai.streamingQueries.abortStream);

  // Mutations
  const clearThread = useMutation(apiAny.ai.threads.clearThreadForUser);
  const clearPreviousThreads = useMutation(apiAny.ai.threads.clearPreviousThreadsForUser);

  // History UI was removed from assistant; keep stable defaults for compatibility.
  const threadList: UseAIChatReturn["threadList"] = [];
  const isThreadListLoading = false;
  const hasThreads = false;
  const previousThreadsCount = 0;
  const mobileSelectValue = "";

  // Check if any message is currently streaming
  const isStreaming = useMemo(() => {
    return (uiMessages ?? []).some((m) => m.status === "streaming");
  }, [uiMessages]);

  // Determine if we should show empty state - only use uiMessages, not chatHistory to avoid loops
  const showEmptyState = useMemo(() => {
    const hasUIMessages = (uiMessages ?? []).length > 0;
    return !hasUIMessages && !isLoading && !isStreaming;
  }, [uiMessages, isLoading, isStreaming]);

  const chatIsLoading = shouldSubscribe && streamingStatus === "LoadingFirstPage";
  const messageMetadataByIndex = useMemo(() => new Map<number, {
    fileId?: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    mode?: string;
  }>(), []);

  // Initial thread selection
  useEffect(() => {
    if (!initialThreadSelectionDone) {
      setInitialThreadSelectionDone(true);
    }
  }, [initialThreadSelectionDone]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const maxHeight = 240;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [message]);

  // Scroll to bottom on new messages
  // Use a ref to track last scroll to avoid excessive scrolling
  const lastScrollRef = useRef(0);
  const uiMessagesLength = uiMessages?.length ?? 0;

  useEffect(() => {
    // Only scroll when messages count changes, not during streaming updates
    if (uiMessagesLength > lastScrollRef.current) {
      lastScrollRef.current = uiMessagesLength;
      // Use setTimeout to defer scroll and avoid render loop
      const timeout = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [uiMessagesLength]);

  // Track whether streaming ever started or any UI message arrived for current send
  const hasStreamedRef = useRef(false);
  useEffect(() => {
    if (isStreaming || uiMessagesLength > 0) {
      hasStreamedRef.current = true;
    }
  }, [isStreaming, uiMessagesLength]);

  // Handle escape key to stop response
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isStreaming) {
        event.preventDefault();
        handleStopResponse();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  // Actions
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleStopResponse = useCallback(async () => {
    if (threadId) {
      try {
        const result = await abortStreamMutation({ threadId });
        if (result.success) {
          toast.info("Response stopped");
        }
      } catch (error) {
        console.error("Failed to abort stream:", error);
        toast.error("Failed to stop response");
      }
    }
    setIsLoading(false);
  }, [threadId, abortStreamMutation]);

  const handleThreadSelect = useCallback((selectedThreadId: string) => {
    if (selectedThreadId === threadId) {
      return;
    }
    setInitialThreadSelectionDone(true);
    setThreadIdWithSuppression(selectedThreadId);
    setChatHistory([]);
    setMessage("");
    setSessionTokens({ total: 0, cost: 0 });
    setCurrentMode(null);
  }, [threadId, setThreadIdWithSuppression]);

  const handleNewChat = useCallback(() => {
    setThreadIdWithSuppression(undefined);
    setChatHistory([]);
    setMessage("");
    setSessionTokens({ total: 0, cost: 0 });
    setCurrentMode(null);
  }, [setThreadIdWithSuppression]);

  const handleClearChat = useCallback(async () => {
    if (!threadId || !projectId || !userClerkId) return;

    try {
      await clearThread({ threadId, projectId, userClerkId });
      setChatHistory([]);
      setSessionTokens({ total: 0, cost: 0 });
      setCurrentMode(null);
      // Reset threadId to start fresh - this forces useUIMessages to skip
      // and clears any cached/stale streaming data from the agent SDK
      setThreadIdWithSuppression(undefined);
      toast.success("Chat cleared");
    } catch (error) {
      console.error("Failed to clear chat:", error);
      toast.error("Failed to clear chat");
    }
  }, [threadId, projectId, userClerkId, clearThread, setThreadIdWithSuppression]);

  const handleClearPreviousThreads = useCallback(async () => {
    if (!projectId || !userClerkId) return;

    try {
      const result = await clearPreviousThreads({
        projectId,
        userClerkId,
        keepThreadId: threadId,
      });
      toast.success(`Cleared ${result.removedThreads} previous chat${result.removedThreads === 1 ? '' : 's'}`);
    } catch (error) {
      console.error("Failed to clear previous threads:", error);
      toast.error("Failed to clear previous chats");
    }
  }, [projectId, userClerkId, threadId, clearPreviousThreads]);

  const handleQuickPromptClick = useCallback((prompt: string) => {
    setMessage(prompt);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // ===========================================
  // MAIN SEND MESSAGE HANDLER - Uses streaming mutation
  // ===========================================
  const handleSendMessage = useCallback(async (
    selectedFiles: File[],
    uploadedFileIds: string[],
    onUploadStart: () => void,
    onUploadComplete: (fileIds: string[]) => void,
    generateUploadUrl: (args: { projectId: Id<"projects">; fileName: string; origin: string }) => Promise<{ url: string; key: string }>,
    addFile: (args: { projectId: Id<"projects">; fileKey: string; fileName: string; fileType: string; fileSize: number; origin: string }) => Promise<string>,
    promptOverride?: string
  ) => {
    console.log("📤 [CLIENT] Starting handleSendMessage");

    const promptText = (promptOverride ?? message).trim();
    if (
      !projectId ||
      (!promptText && selectedFiles.length === 0) ||
      !userClerkId ||
      isLoading ||
      isStreaming ||
      isSendingRef.current
    ) {
      console.log("⛔ [CLIENT] Send blocked:", {
        hasProjectId: !!projectId,
        hasMessage: !!(promptText || selectedFiles.length > 0),
        hasUserClerkId: !!userClerkId,
        isLoading,
        isStreaming,
        isSending: isSendingRef.current,
      });
      return;
    }

    isSendingRef.current = true;

    const userMessage = promptText;
    const hasFiles = selectedFiles.length > 0;

    console.log("📨 [CLIENT] Message prepared:", {
      messageLength: userMessage.length,
      hasFiles,
      filesCount: selectedFiles.length,
      threadId,
    });

    setIsLoading(true);

    try {

      const currentFileIds: string[] = [...uploadedFileIds];
      const uploadedFilesInfo: Array<{ name: string; size: number; type: string; id: string }> = [];

      // Handle file uploads
      if (selectedFiles.length > 0) {
        console.log("📁 [CLIENT] Starting file uploads:", selectedFiles.length);
        onUploadStart();

        for (const file of selectedFiles) {
          const uploadData = await generateUploadUrl({
            projectId,
            fileName: file.name,
            origin: "ai",
          });

          const uploadResult = await fetch(uploadData.url, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });

          if (!uploadResult.ok) {
            throw new Error(`Upload failed for ${file.name}`);
          }

          const fileId = await addFile({
            projectId,
            fileKey: uploadData.key,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            origin: "ai",
          });

          currentFileIds.push(fileId);
          uploadedFilesInfo.push({
            name: file.name,
            size: file.size,
            type: file.type,
            id: fileId,
          });
        }

        onUploadComplete(currentFileIds);
      }

      // Clear message immediately for better UX
      setMessage("");

      // Build the prompt
      const prompt = hasFiles && !userMessage
        ? `📎 Attached: ${selectedFiles.map(f => f.name).join(", ")}`
        : userMessage;

      console.log("🚀 [CLIENT] Calling initiateStreamingMutation:", {
        threadId: threadId || "undefined (new thread)",
        projectId,
        promptLength: prompt.length,
        fileIds: hasFiles ? currentFileIds : undefined,
      });

      // Use the streaming mutation - this will trigger optimistic update
      // and the useUIMessages hook will receive real-time updates
      const result = await initiateStreamingMutation({
        threadId: threadId,
        projectId,
        prompt,
        fileIds: hasFiles ? (currentFileIds as Id<"files">[]) : undefined,
      });

      console.log("✅ [CLIENT] initiateStreamingMutation result:", {
        success: result?.success,
        threadId: result?.threadId,
        error: result?.error,
      });

      if (!threadId && result?.threadId) {
        console.log("🆔 [CLIENT] Setting new threadId:", result.threadId);
        setThreadIdWithSuppression(result.threadId);
      }

      // isLoading will be turned off when streaming completes
      // The streaming status is tracked via isStreaming computed value

    } catch (error) {
      console.error("❌ [CLIENT] Error sending message:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      toast.error(`Failed to send message: ${errorMessage}`);
      setIsLoading(false);
      throw error;
    } finally {
      console.log("🏁 [CLIENT] handleSendMessage finished, isSending = false");
      isSendingRef.current = false;
    }
  }, [projectId, userClerkId, message, threadId, initiateStreamingMutation, isLoading, isStreaming, setThreadIdWithSuppression]);

  // Turn off isLoading when streaming finishes
  useEffect(() => {
    if (!isStreaming && isLoading && hasStreamedRef.current) {
      // Small delay to ensure final content is rendered
      const timeout = setTimeout(() => {
        setIsLoading(false);
        hasStreamedRef.current = false;
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isStreaming, isLoading]);

  return {
    // State
    message,
    setMessage,
    chatHistory,
    setChatHistory,
    isLoading: isLoading || isStreaming,
    setIsLoading,
    currentMode,
    sessionTokens,
    threadId,
    setThreadId: setThreadIdWithSuppression,
    showHistory,
    setShowHistory,
    isStreaming,

    // Computed
    threadList,
    isThreadListLoading,
    hasThreads,
    showEmptyState,
    chatIsLoading,
    previousThreadsCount,
    mobileSelectValue,

    // UIMessages from streaming
    uiMessages: uiMessages ?? [],
    streamingStatus: streamingStatus as "LoadingFirstPage" | "CanLoadMore" | "Exhausted",
    loadMoreMessages,
    messageMetadataByIndex,

    // Refs
    messagesEndRef,
    inputRef,
    abortControllerRef,

    // Actions
    handleSendMessage,
    handleStopResponse,
    handleClearChat,
    handleClearPreviousThreads,
    handleNewChat,
    handleThreadSelect,
    handleQuickPromptClick,
    scrollToBottom,
  };
};

export default useAIChat;
