"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Bot, Clock3, Loader2, Paperclip, RotateCcw, Sparkles, Square, X } from "lucide-react";
import { toast } from "sonner";

import type { Id } from "@/convex/_generated/dataModel";
import { apiAny } from "@/lib/convexApiAny";
import { cn } from "@/lib/utils";
import type { ChatHistoryEntry } from "@/components/ai/assistant/data/types";
import { InlineConfirmationList } from "@/components/ai/assistant/ui/confirmations/InlineConfirmation";
import { useFileUpload, usePendingItems } from "@/components/ai/assistant/data/hooks";
import { AIQuotaUpsellCard } from "@/components/ai/shared";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

type Props = {
  initialThreadId?: string;
  projectId: Id<"projects">;
  projectName: string;
  teamId: Id<"teams">;
  teamSlug?: string;
  aiAccess: {
    hasAccess: boolean;
    currentPlan?: string;
    subscriptionStatus?: string | null;
    message?: string;
    remainingTokens?: number;
  };
  autoConfirmCrud: boolean;
};

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function getStatusVariant(status: string) {
  if (status === "completed") return "default";
  if (status === "failed" || status === "aborted") return "destructive";
  return "secondary";
}

function getEventVariant(eventType: string) {
  if (eventType.startsWith("turn.")) return "outline";
  if (eventType.startsWith("reasoning.")) return "secondary";
  if (eventType.startsWith("tool.")) return "secondary";
  return "default";
}

export default function AIAssistantV2Panel({
  initialThreadId,
  projectId,
  projectName,
  teamId,
  teamSlug,
  aiAccess,
  autoConfirmCrud,
}: Props) {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [draft, setDraft] = useState("");
  const [threadId, setThreadId] = useState<string | undefined>(initialThreadId);
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>();
  const [isSending, setIsSending] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isSavingAutoConfirmCrud, setIsSavingAutoConfirmCrud] = useState(false);
  const [autoConfirmEnabled, setAutoConfirmEnabled] = useState(autoConfirmCrud);
  const [, setChatHistory] = useState<ChatHistoryEntry[]>([]);

  const profile = useQuery(apiAny.ai.v2.profiles.getTeamAssistantProfile, {
    projectId,
  });
  const groups = useQuery(
    apiAny.ai.v2.groups.listThreadResponseGroups,
    threadId ? { threadId } : "skip",
  );
  const events = useQuery(
    apiAny.ai.v2.events.listGroupEvents,
    threadId && selectedGroupId
      ? { threadId, groupId: selectedGroupId }
      : "skip",
  );

  const startTurn = useMutation(apiAny.ai.v2.groups.startTurn);
  const requestGroupAbort = useMutation(apiAny.ai.v2.groups.requestGroupAbort);
  const updateProject = useMutation(apiAny.projects.updateProject);
  const clearAllThreadsForUser = useMutation(apiAny.ai.threads.clearAllThreadsForUser);
  const {
    pendingItems,
    handleConfirmItem,
    handleRejectItem,
    handleEditItem,
    handleRejectAll,
    handleUpdatePendingItem,
    isBulkProcessing,
    resetPendingState,
  } = usePendingItems({
    projectId,
    teamSlug,
    threadId,
    autoConfirmCrud: autoConfirmEnabled,
    setChatHistory,
  });
  const {
    selectedFiles,
    setSelectedFiles,
    handleFileSelect,
    handleRemoveFile,
    handleAttachmentClick,
    fileInputRef,
  } = useFileUpload();

  useEffect(() => {
    setAutoConfirmEnabled(autoConfirmCrud);
  }, [autoConfirmCrud]);

  useEffect(() => {
    if (!threadId && initialThreadId) {
      setThreadId(initialThreadId);
    }
  }, [initialThreadId, threadId]);

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
    if (!groups || groups.length === 0) {
      if (selectedGroupId) {
        setSelectedGroupId(undefined);
      }
      return;
    }

    if (selectedGroupId && groups.some((group) => group.groupId === selectedGroupId)) {
      return;
    }

    setSelectedGroupId(groups[groups.length - 1]?.groupId);
  }, [groups, selectedGroupId]);

  const selectedGroup = useMemo(
    () => groups?.find((group) => group.groupId === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );
  const scopedPendingItems = useMemo(
    () =>
      pendingItems.filter((item) =>
        selectedGroupId ? item.responseId === selectedGroupId : true,
      ),
    [pendingItems, selectedGroupId],
  );

  const resolveScopedItemRef = useCallback(
    (indexOrId: number | string) => {
      if (typeof indexOrId === "string") {
        return indexOrId;
      }

      const item = scopedPendingItems[indexOrId];
      return item?.clientId ?? indexOrId;
    },
    [scopedPendingItems],
  );

  const handleScopedConfirmItem = useCallback(
    async (indexOrId: number | string) => {
      await handleConfirmItem(resolveScopedItemRef(indexOrId));
    },
    [handleConfirmItem, resolveScopedItemRef],
  );

  const handleScopedRejectItem = useCallback(
    async (indexOrId: number | string) => {
      await handleRejectItem(resolveScopedItemRef(indexOrId));
    },
    [handleRejectItem, resolveScopedItemRef],
  );

  const handleScopedEditItem = useCallback(
    (indexOrId: number | string) => {
      const resolved = resolveScopedItemRef(indexOrId);
      if (typeof resolved === "string") {
        handleEditItem(resolved);
        return;
      }
      handleEditItem(indexOrId);
    },
    [handleEditItem, resolveScopedItemRef],
  );

  const handleScopedUpdateItem = useCallback(
    (indexOrId: number | string, updates: Record<string, unknown>) => {
      handleUpdatePendingItem(resolveScopedItemRef(indexOrId), updates);
    },
    [handleUpdatePendingItem, resolveScopedItemRef],
  );

  const handleStartTurn = useCallback(async () => {
    if (
      !aiAccess.hasAccess &&
      ((aiAccess.remainingTokens ?? 0) === 0 ||
        (aiAccess.message || "").toLowerCase().includes("exhaust"))
    ) {
      toast.error("AI credits exhausted. Upgrade your plan or manage billing to continue.");
      return;
    }

    const message = draft.trim();
    if (!message && selectedFiles.length === 0) {
      toast.error("Enter a message for the assistant");
      return;
    }

    setIsSending(true);
    try {
      const unresolvedPendingCount = pendingItems.filter(
        (item) => item.status !== "confirmed" && item.status !== "rejected",
      ).length;
      if (unresolvedPendingCount > 0) {
        await handleRejectAll();
        toast.info(
          unresolvedPendingCount === 1
            ? "Previous pending action was auto-cancelled before sending your new message."
            : `${unresolvedPendingCount} pending actions were auto-cancelled before sending your new message.`,
        );
      }

      let openaiFiles:
        | Array<{
            fileId: string;
            fileName: string;
            fileType?: string;
            fileSize?: number;
          }>
        | undefined;
      if (selectedFiles.length > 0) {
        openaiFiles = await Promise.all(
          selectedFiles.map(async (file) => {
            const formData = new FormData();
            formData.append("projectId", String(projectId));
            formData.append("file", file);

            const response = await fetch("/api/ai/files", {
              method: "POST",
              body: formData,
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(errorText || "OpenAI file upload failed");
            }

            return (await response.json()) as {
              fileId: string;
              fileName: string;
              fileType?: string;
              fileSize?: number;
            };
          }),
        );
      }

      const fileLabel =
        selectedFiles.length > 0
          ? `Attached: ${selectedFiles.map((file) => file.name).join(", ")}`
          : "";

      const result = await startTurn({
        projectId,
        threadId,
        message: message || fileLabel,
        title: `${projectName} Assistant`,
        confirmationPolicy: "group",
        openaiFiles,
      });

      setThreadId(result.threadId);
      setSelectedGroupId(result.groupId);
      setDraft("");
      setSelectedFiles([]);
    } catch (error) {
      console.error("Failed to start assistant turn:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  }, [
    aiAccess.hasAccess,
    aiAccess.message,
    aiAccess.remainingTokens,
    draft,
    handleRejectAll,
    pendingItems,
    projectId,
    projectName,
    selectedFiles,
    setSelectedFiles,
    startTurn,
    threadId,
  ]);

  const handleResetChat = useCallback(async () => {
    if (!user?.id) return;

    try {
      await clearAllThreadsForUser({
        projectId,
        userClerkId: user.id,
      });
      setThreadId(undefined);
      setSelectedGroupId(undefined);
      setDraft("");
      setSelectedFiles([]);
      resetPendingState();
    } catch (error) {
      console.error("Failed to reset AI threads:", error);
      toast.error("Failed to reset conversation");
    }
  }, [clearAllThreadsForUser, projectId, resetPendingState, setSelectedFiles, user?.id]);

  const handleToggleAutoConfirmCrud = useCallback(async (checked: boolean) => {
    const previous = autoConfirmEnabled;
    setAutoConfirmEnabled(checked);
    setIsSavingAutoConfirmCrud(true);
    try {
      await updateProject({
        projectId,
        aiAutoConfirmCrud: checked,
      });
      toast.success(
        checked
          ? "Auto-confirm ON — AI actions are applied automatically"
          : "Auto-confirm OFF — AI actions require your approval",
      );
    } catch (error) {
      setAutoConfirmEnabled(previous);
      console.error("Failed to update aiAutoConfirmCrud:", error);
      toast.error("Failed to save confirmation mode");
    } finally {
      setIsSavingAutoConfirmCrud(false);
    }
  }, [autoConfirmEnabled, projectId, updateProject]);

  const isQuotaBlocked =
    !aiAccess.hasAccess &&
    ((aiAccess.remainingTokens ?? 0) === 0 ||
      (aiAccess.message || "").toLowerCase().includes("exhaust"));
  const canStopSelectedGroup =
    Boolean(selectedGroupId) && selectedGroup?.status === "running" && !selectedGroup?.abortRequestedAt;

  const handleStopTurn = useCallback(async () => {
    if (!threadId || !selectedGroupId) return;

    setIsStopping(true);
    try {
      const result = await requestGroupAbort({
        threadId,
        groupId: selectedGroupId,
      });
      if (result.requested) {
        toast.success("Stop requested");
      }
    } catch (error) {
      console.error("Failed to request assistant stop:", error);
      toast.error("Failed to stop response");
    } finally {
      setIsStopping(false);
    }
  }, [requestGroupAbort, selectedGroupId, threadId]);

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full min-w-0 flex-col gap-4 overflow-hidden p-4 text-foreground xl:p-6">
      <Card className="border-border/70 bg-background/90 shadow-soft-lg">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="gap-1" variant="default">
              <Sparkles className="size-3" />
              Assistant
            </Badge>
            <Badge variant="outline">Responses runtime</Badge>
            {threadId ? <Badge variant="secondary">Thread {threadId}</Badge> : null}
          </div>
          <div>
            <CardTitle className="text-xl tracking-tight">
              {projectName}
            </CardTitle>
            <CardDescription className="max-w-3xl pt-1">
              Unified assistant flow backed by response groups, event history, and confirmation-aware tools.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
          <Card className="border-border/70 bg-background/90 shadow-soft-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                New message
              </CardTitle>
              <CardDescription>
                Send a turn and inspect the runtime timeline as it completes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isQuotaBlocked ? (
                <AIQuotaUpsellCard
                  teamId={teamId}
                  currentPlan={aiAccess.currentPlan}
                  subscriptionStatus={aiAccess.subscriptionStatus ?? null}
                  message={aiAccess.message}
                  remainingTokens={aiAccess.remainingTokens ?? 0}
                />
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="assistant-prompt">Message</Label>
                <Textarea
                  id="assistant-prompt"
                  className="min-h-32 resize-y"
                  placeholder="Plan the next project steps and note any actions that need confirmation."
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
              </div>

              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  className="hidden"
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={isSending}
                    type="button"
                    variant="outline"
                    onClick={handleAttachmentClick}
                  >
                    <Paperclip className="size-4" />
                    Attach files
                  </Button>
                </div>
                {selectedFiles.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedFiles.map((file, index) => (
                      <Badge key={`${file.name}-${index}`} variant="secondary" className="gap-2">
                        {file.name}
                        <button
                          type="button"
                          aria-label={`Remove ${file.name}`}
                          onClick={() => handleRemoveFile(index)}
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
                <div className="space-y-1">
                  <Label htmlFor="assistant-auto-confirm">Auto-confirm actions</Label>
                  <p className="text-xs text-muted-foreground">
                    Apply assistant CRUD actions automatically instead of asking for approval.
                  </p>
                </div>
                <Switch
                  id="assistant-auto-confirm"
                  checked={autoConfirmEnabled}
                  disabled={isSavingAutoConfirmCrud}
                  onCheckedChange={(checked) => {
                    void handleToggleAutoConfirmCrud(checked);
                  }}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={isSending || isQuotaBlocked}
                  onClick={() => {
                    void handleStartTurn();
                  }}
                >
                  {isSending ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}
                  Send
                </Button>
                <Button
                  disabled={!canStopSelectedGroup || isStopping}
                  variant="outline"
                  onClick={() => {
                    void handleStopTurn();
                  }}
                >
                  {isStopping ? <Loader2 className="size-4 animate-spin" /> : <Square className="size-4" />}
                  Stop
                </Button>
                <Button
                  disabled={!threadId}
                  variant="outline"
                  onClick={() => {
                    void handleResetChat();
                  }}
                >
                  <RotateCcw className="size-4" />
                  Reset chat
                </Button>
                <Button
                  disabled={!threadId}
                  variant="outline"
                  onClick={() => {
                    setThreadId(undefined);
                    setSelectedGroupId(undefined);
                    setDraft("");
                    resetPendingState();
                  }}
                >
                  New local thread
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/90 shadow-soft-md">
            <CardHeader>
              <CardTitle className="text-base">Assistant profile</CardTitle>
              <CardDescription>
                Team-scoped defaults inherited by the runtime.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!profile ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading assistant profile...
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        Model
                      </p>
                      <p className="mt-1 text-sm font-medium">{profile.defaultModel}</p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        Confirmation
                      </p>
                      <p className="mt-1 text-sm font-medium">{profile.confirmationMode}</p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        Memory
                      </p>
                      <p className="mt-1 text-sm font-medium">{profile.memoryMode}</p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        Source
                      </p>
                      <p className="mt-1 text-sm font-medium">{profile.source}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      Enabled tools
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {profile.enabledTools.map((tool: string) => (
                        <Badge key={tool} variant="outline">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      Feature flags
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {profile.featureFlags.map((flag: string) => (
                        <Badge key={flag} variant="secondary">
                          {flag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/90 shadow-soft-md">
            <CardHeader>
              <CardTitle className="text-base">Response groups</CardTitle>
              <CardDescription>
                Each assistant turn is tracked as one response group.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!threadId ? (
                <p className="text-sm text-muted-foreground">
                  Send a message to create the first thread and response group.
                </p>
              ) : groups === undefined ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading response groups...
                </div>
              ) : groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No response groups yet in this thread.
                </p>
              ) : (
                groups
                  .slice()
                  .reverse()
                  .map((group) => {
                    const isActive = group.groupId === selectedGroupId;
                    return (
                      <button
                        key={group.groupId}
                        type="button"
                        className={cn(
                          "w-full rounded-2xl border px-3 py-3 text-left transition-colors",
                          isActive
                            ? "border-primary/40 bg-primary/6"
                            : "border-border/70 bg-muted/10 hover:bg-accent/60",
                        )}
                        onClick={() => setSelectedGroupId(group.groupId)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={getStatusVariant(group.status)}>{group.status}</Badge>
                          <Badge variant="outline">{group.confirmationPolicy}</Badge>
                        </div>
                        <p className="mt-2 text-sm font-medium">{group.groupId}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {group.model} via {group.provider}
                        </p>
                        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock3 className="size-3.5" />
                          {formatTimestamp(group.updatedAt)}
                        </div>
                      </button>
                    );
                  })
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="flex min-h-0 flex-col border-border/70 bg-background/90 shadow-soft-md">
          <CardHeader className="border-b border-border/70">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">Event timeline</CardTitle>
              {selectedGroup ? (
                <>
                  <Badge variant={getStatusVariant(selectedGroup.status)}>
                    {selectedGroup.status}
                  </Badge>
                  {selectedGroup.abortRequestedAt ? (
                    <Badge variant="secondary">stopping</Badge>
                  ) : null}
                  <Badge variant="outline">{selectedGroup.groupId}</Badge>
                </>
              ) : null}
            </div>
            <CardDescription>
              Event log for text, reasoning, tool calls, and confirmation state.
            </CardDescription>
            {selectedGroup?.summary ? (
              <div className="rounded-xl border border-border/70 bg-muted/15 px-3 py-3 text-sm">
                {selectedGroup.summary}
              </div>
            ) : null}
          </CardHeader>

          <CardContent className="min-h-0 flex-1 overflow-y-auto p-4">
            {selectedGroupId && scopedPendingItems.length > 0 ? (
              <div className="mb-4 rounded-2xl border border-border/70 bg-muted/10 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Pending confirmations</p>
                    <p className="text-xs text-muted-foreground">
                      Actions proposed in this response group are waiting for approval.
                    </p>
                  </div>
                  <Badge variant="secondary">{scopedPendingItems.length} pending</Badge>
                </div>

                <InlineConfirmationList
                  items={scopedPendingItems}
                  onConfirmItem={handleScopedConfirmItem}
                  onRejectItem={handleScopedRejectItem}
                  onEditItem={handleScopedEditItem}
                  onUpdateItem={handleScopedUpdateItem}
                  isProcessing={isBulkProcessing}
                  confirmationMode="always_ask"
                />
              </div>
            ) : null}

            {!selectedGroupId ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
                Select a response group to inspect its event sequence.
              </div>
            ) : events === undefined ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading event timeline...
              </div>
            ) : events.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
                No events stored for this response group yet.
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div
                    key={`${event.sequence}-${event.eventType}`}
                    className="rounded-2xl border border-border/70 bg-muted/10 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getEventVariant(event.eventType)}>{event.eventType}</Badge>
                      {event.role ? <Badge variant="outline">{event.role}</Badge> : null}
                      <span className="text-xs text-muted-foreground">
                        #{event.sequence} · {formatTimestamp(event.createdAt)}
                      </span>
                    </div>

                    {event.text ? (
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                        {event.text}
                      </p>
                    ) : null}

                    {event.data ? (
                      <pre className="mt-3 overflow-x-auto rounded-xl border border-border/70 bg-background/80 p-3 text-xs text-muted-foreground">
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
