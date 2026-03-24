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
import {
  mergePersistentCallState,
  type PersistentCall,
  type UIMessagesResult,
} from "./chatMessageTransform";
interface UseAIChatProps {
  projectId: Id<"projects"> | undefined;
  userClerkId: string | undefined;
  initialThreadId?: string;
}

type OpenAIUploadedFile = {
  fileId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
};

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
  setShowHistory: React.Dispatch<React.SetStateAction<boolean>>;
  isStreaming: boolean;

  // Computed
  threadList: Array<{
    threadId: string;
    title: string;
    lastMessageAt?: number;
    lastMessagePreview?: string;
    lastMessageRole?: "user" | "assistant";
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
    uploadedFiles: OpenAIUploadedFile[],
    onUploadStart: () => void,
    onUploadComplete: (files: OpenAIUploadedFile[]) => void,
    uploadOpenAIFile: (args: {
      projectId: Id<"projects">;
      file: File;
    }) => Promise<OpenAIUploadedFile>,
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

export const useAIChat = ({
  projectId,
  userClerkId,
  initialThreadId,
}: UseAIChatProps): UseAIChatReturn => {
  const normalizedInitialThreadId = initialThreadId?.trim() || undefined;
  // State
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | undefined>(normalizedInitialThreadId);
  const [showHistory, setShowHistory] = useState(false);
  const [currentMode, setCurrentMode] = useState<'full' | 'recent' | null>(null);
  const [sessionTokens, setSessionTokens] = useState<SessionTokens>({ total: 0, cost: 0 });
  const contextRef = useRef<string | null>(null);
  const resetConversationState = useCallback(() => {
    setChatHistory([]);
    setMessage("");
    setSessionTokens({ total: 0, cost: 0 });
    setCurrentMode(null);
  }, []);

  // Reset local chat state when project/user context changes.
  useEffect(() => {
    const nextContext = projectId && userClerkId
      ? `${projectId}:${userClerkId}`
      : null;
    if (contextRef.current === nextContext) return;
    contextRef.current = nextContext;

    setThreadId(normalizedInitialThreadId);
    resetConversationState();
  }, [projectId, userClerkId, normalizedInitialThreadId, resetConversationState]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isSendingRef = useRef(false);
  const prevInitialThreadIdRef = useRef<string | undefined>(normalizedInitialThreadId);
  const hasStreamedRef = useRef(false);
  const awaitingStreamRef = useRef(false);
  const pendingResponseBaselineRef = useRef<number | null>(null);

  const resetPendingRequestState = useCallback((resetLoading = false) => {
    awaitingStreamRef.current = false;
    hasStreamedRef.current = false;
    pendingResponseBaselineRef.current = null;
    if (resetLoading) {
      setIsLoading(false);
    }
  }, []);

  // Sync thread from URL only when it explicitly points to a thread.
  // This avoids re-initializing a new thread when we intentionally clear session param.
  useEffect(() => {
    const previousInitialThreadId = prevInitialThreadIdRef.current;
    const hasInitialThreadChanged = normalizedInitialThreadId !== previousInitialThreadId;
    prevInitialThreadIdRef.current = normalizedInitialThreadId;

    if (!projectId || !userClerkId) return;
    if (!hasInitialThreadChanged) return;
    if (!normalizedInitialThreadId) return;
    if (normalizedInitialThreadId === threadId) return;
    setThreadId(normalizedInitialThreadId);
    resetConversationState();
  }, [
    projectId,
    userClerkId,
    normalizedInitialThreadId,
    threadId,
    resetConversationState,
  ]);

  // CRITICAL: Subscribe strategy based on thread type
  // - Skip if no threadId (empty/new chat state)
  // - For new threads: subscribe anyway (optimistic updates will work)
  // - For existing threads: always subscribe
  const shouldSubscribe = Boolean(threadId);
  const threadListQuery = useQuery(
    apiAny.ai.threads.listThreadsForUser,
    projectId && userClerkId ? { projectId, userClerkId } : "skip"
  );

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
  const uiMessages = useMemo(
    () =>
      mergePersistentCallState(
        rawUiMessages,
        persistentFunctionCalls as PersistentCall[] | undefined,
      ),
    [rawUiMessages, persistentFunctionCalls],
  );

  const streamingStatus = shouldSubscribe ? streamingHookResult.status : "Exhausted";
  const loadMoreMessages = streamingHookResult.loadMore;

  // Streaming mutation
  const initiateStreamingMutation = useMutation(
    apiAny.ai.streamingQueries.initiateStreaming
  );

  // Abort streaming mutation
  const abortStreamMutation = useMutation(apiAny.ai.streamingQueries.abortStream);

  // Mutations
  const clearThread = useMutation(apiAny.ai.threads.clearThreadForUser);
  const clearPreviousThreads = useMutation(apiAny.ai.threads.clearPreviousThreadsForUser);

  const threadList = useMemo<UseAIChatReturn["threadList"]>(
    () => threadListQuery ?? [],
    [threadListQuery],
  );
  const isThreadListLoading =
    projectId !== undefined &&
    userClerkId !== undefined &&
    threadListQuery === undefined;
  const hasThreads = threadList.length > 0;
  const previousThreadsCount = threadList.length;
  const mobileSelectValue = threadId ?? "new";

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

  // Track request lifecycle per-send to avoid loading flicker before stream starts.
  useEffect(() => {
    if (awaitingStreamRef.current && isStreaming) {
      hasStreamedRef.current = true;
    }
  }, [isStreaming, threadId]);

  // Actions
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const abortThreadStream = useCallback(async (
    threadIdToAbort: string | undefined,
    { notify }: { notify: boolean },
  ) => {
    if (!threadIdToAbort) return false;

    try {
      const result = await abortStreamMutation({ threadId: threadIdToAbort });
      if (result.success && notify) {
        toast.info("Response stopped");
      }
      return result.success;
    } catch (error) {
      console.error("Failed to abort stream:", error);
      if (notify) {
        toast.error("Failed to stop response");
      }
      return false;
    }
  }, [abortStreamMutation]);

  const handleStopResponse = useCallback(async () => {
    await abortThreadStream(threadId, { notify: true });
    resetPendingRequestState(true);
  }, [threadId, abortThreadStream, resetPendingRequestState]);

  // Handle escape key to stop response
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isStreaming) {
        event.preventDefault();
        void handleStopResponse();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isStreaming, handleStopResponse]);

  const handleThreadSelect = useCallback((selectedThreadId: string) => {
    if (selectedThreadId === threadId) {
      return;
    }
    const activeThreadId = threadId;
    if (activeThreadId && (isStreaming || isLoading)) {
      void abortThreadStream(activeThreadId, { notify: false });
    }
    resetPendingRequestState();
    setThreadId(selectedThreadId);
    resetConversationState();
  }, [threadId, isLoading, isStreaming, abortThreadStream, resetConversationState, resetPendingRequestState]);

  const handleNewChat = useCallback(() => {
    const activeThreadId = threadId;
    if (activeThreadId && (isStreaming || isLoading)) {
      void abortThreadStream(activeThreadId, { notify: false });
    }
    resetPendingRequestState();
    setThreadId(undefined);
    resetConversationState();
  }, [threadId, isLoading, isStreaming, abortThreadStream, resetConversationState, resetPendingRequestState]);

  const handleClearChat = useCallback(async () => {
    if (!threadId || !projectId || !userClerkId) return;

    const clearingThreadId = threadId;

    try {

      // Optimistic clear: immediately detach from the current thread so stale
      // messages do not flash while backend mutation is in flight.
      resetPendingRequestState();
      resetConversationState();
      setThreadId(undefined);

      await clearThread({ threadId: clearingThreadId, projectId, userClerkId });
      toast.success("Chat cleared");
    } catch (error) {
      // Restore thread on failure so user does not lose context.
      setThreadId(clearingThreadId);
      console.error("Failed to clear chat:", error);
      toast.error("Failed to clear chat");
    }
  }, [
    threadId,
    projectId,
    userClerkId,
    clearThread,
    resetConversationState,
    resetPendingRequestState,
  ]);

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
    uploadedFiles: OpenAIUploadedFile[],
    onUploadStart: () => void,
    onUploadComplete: (files: OpenAIUploadedFile[]) => void,
    uploadOpenAIFile: (args: {
      projectId: Id<"projects">;
      file: File;
    }) => Promise<OpenAIUploadedFile>,
    promptOverride?: string
  ) => {
    const promptText = (promptOverride ?? message).trim();
    if (
      !projectId ||
      (!promptText && selectedFiles.length === 0) ||
      !userClerkId ||
      isLoading ||
      isStreaming ||
      isSendingRef.current
    ) {
      return;
    }

    isSendingRef.current = true;
    awaitingStreamRef.current = true;
    hasStreamedRef.current = false;
    pendingResponseBaselineRef.current = uiMessagesLength;

    const userMessage = promptText;
    const hasFiles = selectedFiles.length > 0;
    const currentThreadId = threadId;

    setIsLoading(true);

    try {

      const currentOpenAIFiles: OpenAIUploadedFile[] = [...uploadedFiles];
      // Upload directly to OpenAI Files API
      if (selectedFiles.length > 0) {
        onUploadStart();

        for (const file of selectedFiles) {
          const uploaded = await uploadOpenAIFile({
            projectId,
            file,
          });
          currentOpenAIFiles.push(uploaded);
        }

        onUploadComplete(currentOpenAIFiles);
      }

      // Clear message immediately for better UX
      setMessage("");

      // Build the prompt
      const prompt = hasFiles && !userMessage
        ? `📎 Attached: ${selectedFiles.map(f => f.name).join(", ")}`
        : userMessage;

      // Use the streaming mutation - this will trigger optimistic update
      // and the useUIMessages hook will receive real-time updates
      const result = await initiateStreamingMutation({
        threadId: currentThreadId,
        projectId,
        prompt,
        openaiFiles: hasFiles ? currentOpenAIFiles : undefined,
      });

      if (!currentThreadId && result?.threadId) {
        setThreadId(result.threadId);
      }

      // isLoading will be turned off when streaming completes
      // The streaming status is tracked via isStreaming computed value

    } catch (error) {
      resetPendingRequestState();
      console.error("❌ [CLIENT] Error sending message:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      toast.error(`Failed to send message: ${errorMessage}`);
      setIsLoading(false);
      throw error;
    } finally {
      isSendingRef.current = false;
    }
  }, [
    projectId,
    userClerkId,
    message,
    threadId,
    initiateStreamingMutation,
    isLoading,
    isStreaming,
    uiMessagesLength,
    resetPendingRequestState,
  ]);

  // Turn off isLoading when streaming finishes
  useEffect(() => {
    if (!awaitingStreamRef.current) return;
    if (!isStreaming && isLoading && hasStreamedRef.current) {
      // Small delay to ensure final content is rendered
      const timeout = setTimeout(() => {
        resetPendingRequestState(true);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isStreaming, isLoading, resetPendingRequestState]);

  // Fallback: if stream status is not emitted but new messages arrived, clear loading.
  useEffect(() => {
    if (!awaitingStreamRef.current) return;
    if (!isLoading || isStreaming) return;
    const baseline = pendingResponseBaselineRef.current;
    if (baseline === null) return;
    if (uiMessagesLength <= baseline) return;
    const hasAssistantSinceBaseline = (uiMessages ?? [])
      .slice(baseline)
      .some((message) => (message.role ?? "assistant") === "assistant");
    if (!hasAssistantSinceBaseline) return;
    resetPendingRequestState(true);
  }, [
    isLoading,
    isStreaming,
    uiMessages,
    uiMessagesLength,
    resetPendingRequestState,
  ]);

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
    setThreadId,
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
