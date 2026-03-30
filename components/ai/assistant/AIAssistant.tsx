"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useUser } from "@clerk/nextjs";
import { useProject } from "@/components/providers/ProjectProvider";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useChat } from "./data/hooks";
import { AISubscriptionWall, AIQuotaUpsellCard } from "@/components/ai/shared";
import AssistantConversation from "@/components/assistant-ui/assistant-conversation";
import ChatSidebar from "@/components/ai/assistant/ui/Sidebar";
import { ASSISTANT_AT_COMMANDS } from "@/components/ai/assistant/config";
import type { UIMessage } from "@convex-dev/agent/react";
import { toast } from "sonner";

const expandAssistantCommand = (text: string) => {
  const trimmedMessage = text.trim();
  const match = trimmedMessage.match(/^@([a-z-]+)\b\s*/i);
  if (!match) return trimmedMessage;

  const command = ASSISTANT_AT_COMMANDS.find(
    (item) => item.id === match[1].toLowerCase(),
  );
  if (!command) return trimmedMessage;

  const rest = trimmedMessage.slice(match[0].length).trim();
  return rest ? `${command.promptPrefix} ${rest}` : command.promptPrefix;
};

const AIAssistant = () => {
  const { user } = useUser();
  const { project, team, isLoading: isProjectContextLoading } = useProject();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get("session");
  const initialThreadIdFromUrl =
    typeof sessionParam === "string" &&
    sessionParam.trim().length > 0
      ? sessionParam
      : undefined;

  const aiAccess = useQuery(
    apiAny.stripe.checkTeamAIAccess,
    team?._id ? { teamId: team._id } : "skip",
  );
  const updateProject = useMutation(apiAny.projects.updateProject);
  const respondToToolApproval = useMutation(apiAny.ai.streamingQueries.respondToToolApproval);
  const [confirmationMode, setConfirmationMode] = useState<"always_ask" | "auto_confirm">(
    "always_ask",
  );
  const [isModeUpdating, setIsModeUpdating] = useState(false);
  const uploadAssistantFile = useCallback(
    async (args: { projectId: unknown; file: File }) => {
      const formData = new FormData();
      formData.append("projectId", String(args.projectId));
      formData.append("file", args.file);

      const response = await fetch("/api/ai/files", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "OpenAI file upload failed");
      }
      return await response.json();
    },
    [],
  );

  const {
    isLoading,
    threadId,
    showHistory,
    setShowHistory,
    threadList,
    isThreadListLoading,
    hasThreads,
    chatIsLoading,
    handleSendMessage: sendMessageWithFile,
    handleStopResponse,
    handleNewChat,
    handleThreadSelect,
    uiMessages,
    isStreaming,
  } = useChat({
    projectId: project?._id,
    userClerkId: user?.id,
    initialThreadId: initialThreadIdFromUrl,
  });

  useEffect(() => {
    if (!pathname) return;
    const params = new URLSearchParams(searchParams.toString());
    const currentSession = params.get("session");
    const nextSession = threadId ?? null;
    const shouldUpdate =
      (nextSession && currentSession !== nextSession) ||
      (!nextSession && currentSession !== null);

    if (!shouldUpdate) return;

    if (nextSession) {
      params.set("session", nextSession);
    } else {
      params.delete("session");
    }

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [pathname, router, searchParams, threadId]);

  useEffect(() => {
    if (!project) return;
    setConfirmationMode(project.aiAutoConfirmCrud ? "auto_confirm" : "always_ask");
  }, [project]);

  const handleStartNewChat = useCallback(() => {
    handleNewChat();
  }, [handleNewChat]);

  const handleSelectThread = useCallback((selectedThreadId: string) => {
    handleThreadSelect(selectedThreadId);
  }, [handleThreadSelect]);

  const isQuotaBlocked = !!(
    aiAccess &&
    !aiAccess.hasAccess &&
    (aiAccess.remainingTokens === 0 ||
      (aiAccess.message || "").toLowerCase().includes("exhaust"))
  );

  const handleConversationSend = useCallback(
    async (payload: { text: string; files: File[] }) => {
      if (isQuotaBlocked) {
        toast.error("AI credits exhausted. Upgrade your plan or manage billing to continue.");
        return;
      }

      const expandedMessage = expandAssistantCommand(payload.text);

      if (!expandedMessage && payload.files.length === 0) {
        return;
      }

      const fileLabel = payload.files.length > 0
        ? `📎 Attached: ${payload.files.map((file) => file.name).join(", ")}`
        : "";

      await sendMessageWithFile(
        payload.files,
        [],
        () => {},
        () => {},
        uploadAssistantFile,
        expandedMessage || fileLabel,
      );
    },
    [
      isQuotaBlocked,
      sendMessageWithFile,
      uploadAssistantFile,
    ],
  );

  const userFallback =
    user?.fullName?.charAt(0) ||
    user?.firstName?.charAt(0) ||
    user?.primaryEmailAddress?.emailAddress?.charAt(0) ||
    "U";

  const handleConfirmationModeChange = useCallback(
    async (nextMode: "always_ask" | "auto_confirm") => {
      if (!project?._id) return;

      const previousMode = confirmationMode;
      setConfirmationMode(nextMode);
      setIsModeUpdating(true);

      try {
        await updateProject({
          projectId: project._id,
          aiAutoConfirmCrud: nextMode === "auto_confirm",
        });
        toast.success(
          nextMode === "auto_confirm"
            ? "Auto mode enabled"
            : "Manual confirmation enabled",
        );
      } catch (error) {
        setConfirmationMode(previousMode);
        console.error("Failed to update AI confirmation mode:", error);
        toast.error("Failed to save AI confirmation mode");
      } finally {
        setIsModeUpdating(false);
      }
    },
    [confirmationMode, project, updateProject],
  );

  const handleRespondToToolApproval = useCallback(
    async (args: {
      approvalId: string;
      approved: boolean;
      toolCallId: string;
      reason?: string;
    }) => {
      if (!threadId) return;
      await respondToToolApproval({
        threadId,
        toolCallId: args.toolCallId,
        approved: args.approved,
        reason: args.reason,
      });
    },
    [respondToToolApproval, threadId],
  );

  const quotaBlockedAssistantMessage = useMemo(() => {
    if (!isQuotaBlocked) return null;

    const noticeText = [
      "### AI credits exhausted",
      aiAccess?.message || "AI credits are exhausted.",
      "",
      "Upgrade your plan or manage billing to continue. You can still review previous messages and visualizations.",
    ].join("\n");

    return {
      id: "quota-blocked-assistant-message",
      key: "quota-blocked-assistant-message",
      role: "assistant",
      content: noticeText,
      text: noticeText,
      parts: [
        {
          type: "text",
          text: noticeText,
        },
      ],
      order: Number.MAX_SAFE_INTEGER,
      stepOrder: Number.MAX_SAFE_INTEGER,
      status: "success",
      _creationTime: Date.now(),
    } as UIMessage;
  }, [aiAccess?.message, isQuotaBlocked]);

  const conversationMessages = useMemo(() => {
    const baseMessages = (uiMessages as UIMessage[] | undefined) ?? [];
    if (!quotaBlockedAssistantMessage) return baseMessages;

    const withoutQuotaNotice = baseMessages.filter((message) => {
      const messageKey = message.key ?? message.id;
      return messageKey !== quotaBlockedAssistantMessage.key;
    });

    return [...withoutQuotaNotice, quotaBlockedAssistantMessage];
  }, [quotaBlockedAssistantMessage, uiMessages]);

  const quotaBanner =
    isQuotaBlocked && team?._id ? (
      <AIQuotaUpsellCard
        teamId={team._id}
        currentPlan={aiAccess?.currentPlan}
        subscriptionStatus={aiAccess?.subscriptionStatus ?? null}
        message={aiAccess?.message}
        remainingTokens={aiAccess?.remainingTokens ?? 0}
      />
    ) : null;

  const assistantThemeStyle = useMemo(
    () =>
      ({
        "--background": "#FFFFFF",
        "--foreground": "#111111",
        "--card": "#FFFFFF",
        "--card-foreground": "#111111",
        "--popover": "#FFFFFF",
        "--popover-foreground": "#111111",
        "--primary": "#111111",
        "--primary-foreground": "#FFFFFF",
        "--secondary": "#F5F5F5",
        "--secondary-foreground": "#111111",
        "--muted": "#F5F5F5",
        "--muted-foreground": "#737373",
        "--accent": "#F5F5F5",
        "--accent-foreground": "#111111",
        "--destructive": "#DC2626",
        "--destructive-foreground": "#FFFFFF",
        "--border": "#E5E5E5",
        "--input": "#E5E5E5",
        "--ring": "#D4D4D4",
        "--sidebar": "#FCFCFC",
        "--sidebar-foreground": "#111111",
        "--sidebar-primary": "#111111",
        "--sidebar-primary-foreground": "#FFFFFF",
        "--sidebar-accent": "#F5F5F5",
        "--sidebar-accent-foreground": "#111111",
        "--sidebar-border": "#E5E5E5",
        "--sidebar-ring": "#D4D4D4",
      }) as CSSProperties,
    [],
  );

  if (aiAccess !== undefined && !aiAccess.hasAccess && team?._id) {
    if (!isQuotaBlocked) {
      return <AISubscriptionWall teamId={team._id} teamSlug={team.slug} />;
    }
  }

  const showUnifiedLoading =
    isProjectContextLoading ||
    !team?._id ||
    aiAccess === undefined;

  if (showUnifiedLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div
      className="relative flex h-[calc(100vh-4rem)] w-full min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-border bg-background text-foreground"
      style={assistantThemeStyle}
    >
      <div className="flex min-h-0 flex-1">
        <AssistantConversation
          className={
            showHistory
              ? "flex-1 min-h-0 md:pl-[26.75rem]"
              : "flex-1 min-h-0"
          }
          showHeader
          title={project?.name || "AI Assistant"}
          assistantFallback={(project?.name || "A").charAt(0)}
          showHistoryToggle
          isHistoryVisible={showHistory}
          onHistoryToggle={() => setShowHistory((current) => !current)}
          uiMessages={conversationMessages}
          isLoading={isLoading}
          isStreaming={isStreaming}
          chatIsLoading={chatIsLoading}
          onSend={handleConversationSend}
          onStop={handleStopResponse}
          onReset={handleStartNewChat}
          userImageUrl={user?.imageUrl || undefined}
          userFallback={userFallback}
          composerBanner={quotaBanner}
          onRespondToToolApproval={handleRespondToToolApproval}
          confirmationMode={confirmationMode}
          onConfirmationModeChange={handleConfirmationModeChange}
          isModeUpdating={isModeUpdating}
        />
        <ChatSidebar
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          isDisabled={isLoading || isStreaming}
          isThreadListLoading={isThreadListLoading}
          hasThreads={hasThreads}
          threadList={threadList}
          currentThreadId={threadId}
          onThreadSelect={handleSelectThread}
          onNewChat={handleStartNewChat}
          title="Conversation history"
          newChatLabel="New conversation"
          emptyStateTitle="No previous conversations"
          emptyStateDescription="Start a new conversation and it will appear here."
        />
      </div>
    </div>
  );
};

export default AIAssistant;
