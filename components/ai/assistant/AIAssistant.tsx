"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useUser } from "@clerk/nextjs";
import { useProject } from "@/components/providers/ProjectProvider";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useChat } from "./data/hooks";
import { usePendingItems } from "./data/hooks";
import { AISubscriptionWall, AIQuotaUpsellCard } from "@/components/ai/shared";
import AssistantConversation from "@/components/assistant-ui/assistant-conversation";
import ChatSidebar from "@/components/ai/assistant/ui/Sidebar";
import { ASSISTANT_AT_COMMANDS } from "@/components/ai/assistant/config";
import type { UIMessage } from "@convex-dev/agent/react";
import { toast } from "sonner";

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

  const projectAutoConfirmCrud = Boolean((project as { aiAutoConfirmCrud?: boolean } | null)?.aiAutoConfirmCrud);
  const [autoConfirmCrud, setAutoConfirmCrud] = useState(projectAutoConfirmCrud);
  const [isSavingAutoConfirmCrud, setIsSavingAutoConfirmCrud] = useState(false);

  useEffect(() => {
    setAutoConfirmCrud(projectAutoConfirmCrud);
  }, [projectAutoConfirmCrud]);

  const {
    setChatHistory,
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

  const {
    pendingItems,
    handleConfirmItem,
    handleRejectItem,
    handleEditItem,
    handleUpdatePendingItem,
    isBulkProcessing,
    resetPendingState,
  } = usePendingItems({
    projectId: project?._id,
    teamSlug: team?.slug,
    threadId,
    autoConfirmCrud,
    setChatHistory,
  });

  const handleStartNewChat = useCallback(() => {
    handleNewChat();
    resetPendingState();
  }, [handleNewChat, resetPendingState]);

  const handleSelectThread = useCallback((selectedThreadId: string) => {
    resetPendingState();
    handleThreadSelect(selectedThreadId);
  }, [handleThreadSelect, resetPendingState]);

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

      const trimmedMessage = payload.text.trim();
      const expandedMessage = (() => {
        const match = trimmedMessage.match(/^@([a-z-]+)\b\s*/i);
        if (!match) return trimmedMessage;

        const command = ASSISTANT_AT_COMMANDS.find(
          (item) => item.id === match[1].toLowerCase(),
        );
        if (!command) return trimmedMessage;

        const rest = trimmedMessage.slice(match[0].length).trim();
        return rest ? `${command.promptPrefix} ${rest}` : command.promptPrefix;
      })();

      if (!expandedMessage && payload.files.length === 0) {
        return;
      }

      const fileLabel = payload.files.length > 0
        ? `📎 Attached: ${payload.files.map((file) => file.name).join(", ")}`
        : "";

      await sendMessageWithFile(
        payload.files,
        [],
        () => { },
        () => { },
        async (args) => {
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
        expandedMessage || fileLabel,
      );
    },
    [
      isQuotaBlocked,
      sendMessageWithFile,
    ],
  );

  const handleToggleAutoConfirmCrud = useCallback(async (checked: boolean) => {
    if (!project?._id) return;

    const previous = autoConfirmCrud;
    setAutoConfirmCrud(checked);
    setIsSavingAutoConfirmCrud(true);
    try {
      await updateProject({
        projectId: project._id,
        aiAutoConfirmCrud: checked,
      });
      toast.success(
        checked
          ? "Auto-confirm ON — AI actions are applied automatically"
          : "Auto-confirm OFF — AI actions require your approval",
      );
    } catch (error) {
      setAutoConfirmCrud(previous);
      console.error("Failed to update aiAutoConfirmCrud:", error);
      toast.error("Failed to save confirmation mode");
    } finally {
      setIsSavingAutoConfirmCrud(false);
    }
  }, [autoConfirmCrud, project?._id, updateProject]);

  const handleConversationModeChange = useCallback(
    (mode: "always_ask" | "auto_confirm") => {
      void handleToggleAutoConfirmCrud(mode === "auto_confirm");
    },
    [handleToggleAutoConfirmCrud],
  );

  const userFallback =
    user?.fullName?.charAt(0) ||
    user?.firstName?.charAt(0) ||
    user?.primaryEmailAddress?.emailAddress?.charAt(0) ||
    "U";

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
    const baseMessages = [...((uiMessages as UIMessage[] | undefined) ?? [])];
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
    <div className="relative flex h-[calc(100vh-4rem)] w-full min-w-0 flex-col overflow-hidden text-foreground">
      <div className="flex min-h-0 flex-1">
        <AssistantConversation
          className="flex-1 min-h-0"
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
          pendingItems={pendingItems}
          onConfirmItem={handleConfirmItem}
          onRejectItem={handleRejectItem}
          onEditItem={handleEditItem}
          onUpdateItem={handleUpdatePendingItem}
          isProcessing={isBulkProcessing}
          confirmationMode={autoConfirmCrud ? "auto_confirm" : "always_ask"}
          onConfirmationModeChange={handleConversationModeChange}
          isModeUpdating={isSavingAutoConfirmCrud}
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
