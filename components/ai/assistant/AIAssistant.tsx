"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import type { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { useProject } from "@/components/providers/ProjectProvider";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useChat } from "./data/hooks";
import { usePendingItems } from "./data/hooks";
import { AISubscriptionWall } from "@/components/ai/shared";
import AssistantConversation from "@/components/assistant-ui/assistant-conversation";
import type { UIMessage } from "@convex-dev/agent/react";
import { toast } from "sonner";

const AIAssistant = () => {
  const { user } = useUser();
  const { project, team } = useProject();

  const aiAccess = useQuery(
    apiAny.stripe.checkTeamAIAccess,
    team?._id ? { teamId: team._id } : "skip",
  );

  const generateUploadUrl = useMutation(apiAny.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(apiAny.files.addFile);
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
    chatIsLoading,
    handleSendMessage: sendMessageWithFile,
    handleStopResponse,
    handleClearChat,
    handleNewChat,
    uiMessages,
    isStreaming,
  } = useChat({
    projectId: project?._id,
    userClerkId: user?.id,
  });

  const {
    pendingItems,
    handleAutoRejectPendingItems,
    handleConfirmItem,
    handleRejectItem,
    handleEditItem,
    handleConfirmAll,
    handleRejectAll,
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

  const handleResetChat = useCallback(async () => {
    if (threadId) {
      await handleClearChat();
    } else {
      handleNewChat();
    }
    resetPendingState();
  }, [threadId, handleClearChat, handleNewChat, resetPendingState]);

  const handleConversationSend = useCallback(
    async (payload: { text: string; files: File[] }) => {
      const trimmedMessage = payload.text.trim();
      if (!trimmedMessage && payload.files.length === 0) {
        return;
      }

      if (pendingItems.some((item) => !item.status)) {
        await handleAutoRejectPendingItems();
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
          const result = await generateUploadUrl({
            projectId: args.projectId,
            fileName: args.fileName,
            origin: args.origin as "general" | "ai",
          });
          return { url: result.url, key: result.key };
        },
        addFile as (args: {
          projectId: Id<"projects">;
          fileKey: string;
          fileName: string;
          fileType: string;
          fileSize: number;
          origin: string;
        }) => Promise<string>,
        trimmedMessage || fileLabel,
      );
    },
    [
      pendingItems,
      handleAutoRejectPendingItems,
      sendMessageWithFile,
      generateUploadUrl,
      addFile,
    ],
  );

  const isQuotaBlocked = !!(
    aiAccess &&
    !aiAccess.hasAccess &&
    (aiAccess.remainingTokens === 0 ||
      (aiAccess.message || "").toLowerCase().includes("exhaust"))
  );

  if (aiAccess !== undefined && !aiAccess.hasAccess && team?._id) {
    if (isQuotaBlocked) {
      const remainingTokens = aiAccess.remainingTokens ?? 0;

      return (
        <div className="flex min-h-screen items-center justify-center bg-background/50 px-4">
          <Card className="w-full max-w-lg overflow-hidden rounded-3xl border-border/50 bg-card/80 shadow-2xl backdrop-blur-xl">
            <CardHeader className="space-y-4 pb-2">
              <Badge
                variant="secondary"
                className="w-fit rounded-lg border-0 bg-red-100 px-3 py-1 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400"
              >
                Tokens exhausted
              </Badge>
              <div className="space-y-2">
                <CardTitle className="font-display text-2xl tracking-tight">
                  No AI tokens available
                </CardTitle>
                <CardDescription className="text-base">{aiAccess.message}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Remaining tokens
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {remainingTokens.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-500"
                    style={{ width: "100%" }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Contact your administrator to add more tokens.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return <AISubscriptionWall teamId={team._id} teamSlug={team.slug} />;
  }

  if (aiAccess === undefined && team?._id) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  const userFallback =
    user?.fullName?.charAt(0) ||
    user?.firstName?.charAt(0) ||
    user?.primaryEmailAddress?.emailAddress?.charAt(0) ||
    "U";

  const handleToggleAutoConfirmCrud = async (checked: boolean) => {
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
          ? "Włączono auto-confirm CRUD"
          : "Włączono ręczne potwierdzanie CRUD",
      );
    } catch (error) {
      setAutoConfirmCrud(previous);
      console.error("Failed to update aiAutoConfirmCrud:", error);
      toast.error("Nie udało się zapisać trybu potwierdzeń");
    } finally {
      setIsSavingAutoConfirmCrud(false);
    }
  };

  return (
    <div className="relative flex h-[calc(100vh-4rem)] w-full min-w-0 flex-col overflow-hidden text-foreground">
      <AssistantConversation
        className="flex-1 min-h-0"
        showHeader
        title={project?.name || "AI Assistant"}
        assistantFallback={(project?.name || "A").charAt(0)}
        uiMessages={uiMessages as UIMessage[]}
        isLoading={isLoading}
        isStreaming={isStreaming}
        chatIsLoading={chatIsLoading}
        onSend={handleConversationSend}
        onStop={handleStopResponse}
        onReset={handleResetChat}
        userImageUrl={user?.imageUrl || undefined}
        userFallback={userFallback}
        pendingItems={pendingItems}
        onConfirmItem={handleConfirmItem}
        onRejectItem={handleRejectItem}
        onEditItem={(index) => handleEditItem(index)}
        onConfirmAll={handleConfirmAll}
        onRejectAll={handleRejectAll}
        onUpdateItem={handleUpdatePendingItem}
        isProcessing={isBulkProcessing}
        confirmationMode={autoConfirmCrud ? "auto_confirm" : "always_ask"}
        onConfirmationModeChange={(mode) => handleToggleAutoConfirmCrud(mode === "auto_confirm")}
        isModeUpdating={isSavingAutoConfirmCrud}
      />
    </div>
  );
};

export default AIAssistant;
