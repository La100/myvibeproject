"use client";

import { useCallback, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";
import { useProject } from "@/components/providers/ProjectProvider";
import { Loader2, Menu, MessageSquare, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useChat } from "./data/hooks";
import { usePendingItems } from "./data/hooks";
import { type ThreadListItem } from "./data/types";
import { Sidebar } from "./ui";
import { AISubscriptionWall } from "@/components/ai/shared";
import AssistantConversation from "@/components/assistant-ui/assistant-conversation";
import type { UIMessage } from "@convex-dev/agent/react";

const AIAssistant = () => {
  const { user } = useUser();
  const { project, team } = useProject();

  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const sessionParam = searchParams.get("session");
  const lastSessionParamRef = useRef<string | null>(null);
  const suppressSessionSyncRef = useRef(false);
  const suppressedSessionParamRef = useRef<string | null>(null);

  const aiAccess = useQuery(
    apiAny.stripe.checkTeamAIAccess,
    team?._id ? { teamId: team._id } : "skip",
  );

  const generateUploadUrl = useMutation(apiAny.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(apiAny.files.addFile);

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
    handleThreadSelect: selectThread,
    uiMessages,
    isStreaming,
  } = useChat({
    projectId: project?._id,
    userClerkId: user?.id,
  });

  const {
    pendingItems,
    handleAutoRejectPendingItems,
    resetPendingState,
  } = usePendingItems({
    projectId: project?._id,
    teamSlug: team?.slug,
    threadId,
    setChatHistory,
  });

  const updateSessionParam = useCallback(
    (nextThreadId?: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextThreadId) {
        params.set("session", nextThreadId);
      } else {
        params.delete("session");
      }
      const query = params.toString();
      router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  useEffect(() => {
    if (suppressSessionSyncRef.current) {
      if (sessionParam !== suppressedSessionParamRef.current) {
        suppressSessionSyncRef.current = false;
        suppressedSessionParamRef.current = null;
        lastSessionParamRef.current = null;
      }
      return;
    }
    if (!sessionParam || sessionParam === threadId) return;
    if (lastSessionParamRef.current === sessionParam) return;

    lastSessionParamRef.current = sessionParam;
    selectThread(sessionParam);
    resetPendingState();
  }, [sessionParam, threadId, selectThread, resetPendingState]);

  useEffect(() => {
    if (!threadId) return;
    if (sessionParam === threadId) {
      lastSessionParamRef.current = threadId;
      return;
    }
    lastSessionParamRef.current = threadId;
    updateSessionParam(threadId);
  }, [threadId, sessionParam, updateSessionParam]);

  const handleThreadSelect = useCallback(
    (selectedThreadId: string) => {
      selectThread(selectedThreadId);
      resetPendingState();
    },
    [selectThread, resetPendingState],
  );

  const handleNewChatClick = useCallback(() => {
    suppressSessionSyncRef.current = true;
    suppressedSessionParamRef.current = sessionParam;
    handleNewChat();
    resetPendingState();
    lastSessionParamRef.current = sessionParam;
    updateSessionParam(undefined);
  }, [handleNewChat, resetPendingState, sessionParam, updateSessionParam]);

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
        () => {},
        () => {},
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
                className="w-fit rounded-full border-0 bg-red-100 px-3 py-1 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400"
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

  return (
    <div className="relative flex h-[calc(100vh-4rem)] w-full min-w-0 flex-col overflow-hidden text-foreground md:flex-row-reverse">
      <Sidebar
        showHistory={showHistory}
        setShowHistory={setShowHistory}
        isThreadListLoading={isThreadListLoading}
        hasThreads={hasThreads}
        threadList={threadList as ThreadListItem[]}
        currentThreadId={threadId}
        onThreadSelect={handleThreadSelect}
        onNewChat={handleNewChatClick}
      />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="absolute right-6 top-6 z-20 hidden items-center gap-3 md:flex">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowHistory(!showHistory)}
            className="h-8 w-8"
            title={showHistory ? "Zamknij historię czatów" : "Otwórz historię czatów"}
          >
            <span className="sr-only">Toggle chat history</span>
            <MessageSquare className="h-5 w-5" />
          </Button>
        </div>

        <div className="absolute right-4 top-4 z-20 md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle history</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] p-0 sm:w-[350px]">
              <SheetHeader className="border-b border-border/50 p-4 text-left">
                <SheetTitle className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Project chats
                </SheetTitle>
              </SheetHeader>
              <div className="flex h-full flex-col overflow-hidden">
                <div className="p-4">
                  <Button
                    onClick={handleNewChatClick}
                    className="w-full justify-start pl-3"
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New Chat
                  </Button>
                </div>
                <Separator className="opacity-50" />
                <ScrollArea className="flex-1">
                  {isThreadListLoading ? (
                    <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                      <Loader2 className="mb-2 h-6 w-6 animate-spin" />
                      <span className="text-xs">Loading history...</span>
                    </div>
                  ) : hasThreads ? (
                    <div className="flex flex-col gap-1 p-2">
                      {threadList.map((thread) => {
                        const isActive = thread.threadId === threadId;
                        const relativeTime = formatDistanceToNow(
                          new Date(thread.lastMessageAt ?? Date.now()),
                          { addSuffix: true },
                        );

                        return (
                          <Button
                            key={thread.threadId}
                            variant={isActive ? "secondary" : "ghost"}
                            className={cn(
                              "h-auto w-full flex-col items-start justify-start gap-1 px-3 py-3",
                              isActive
                                ? "bg-secondary"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                            onClick={() => handleThreadSelect(thread.threadId)}
                          >
                            <div className="flex w-full items-baseline justify-between gap-2">
                              <span className="truncate text-sm font-medium">{thread.title}</span>
                              <span className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
                                {relativeTime}
                              </span>
                            </div>
                            <span className="w-full line-clamp-1 text-left text-xs font-normal text-muted-foreground opacity-90">
                              {thread.lastMessagePreview || "No messages yet."}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                        <MessageSquare className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium">No chats yet</p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <AssistantConversation
          className="flex-1 min-h-0"
          showHeader={false}
          title={project?.name || "AI Assistant"}
          assistantFallback={(project?.name || "A").charAt(0)}
          uiMessages={uiMessages as UIMessage[]}
          isLoading={isLoading}
          isStreaming={isStreaming}
          chatIsLoading={chatIsLoading}
          onSend={handleConversationSend}
          onStop={handleStopResponse}
          onReset={async () => {
            handleNewChatClick();
          }}
          userImageUrl={user?.imageUrl || undefined}
          userFallback={userFallback}
        />
      </div>
    </div>
  );
};

export default AIAssistant;
