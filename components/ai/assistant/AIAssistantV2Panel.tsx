"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bot, Clock3, Loader2, PanelLeftDashed, Sparkles } from "lucide-react";
import { toast } from "sonner";

import type { Id } from "@/convex/_generated/dataModel";
import { apiAny } from "@/lib/convexApiAny";
import { cn } from "@/lib/utils";
import type { ChatHistoryEntry } from "@/components/ai/assistant/data/types";
import { InlineConfirmationList } from "@/components/ai/assistant/ui/confirmations/InlineConfirmation";
import { usePendingItems } from "@/components/ai/assistant/data/hooks";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AssistantRuntime = "v1" | "v2";

type Props = {
  canManageRuntime: boolean;
  initialThreadId?: string;
  projectId: Id<"projects">;
  projectName: string;
  runtime: AssistantRuntime;
  teamSlug?: string;
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
  canManageRuntime,
  initialThreadId,
  projectId,
  projectName,
  runtime,
  teamSlug,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [draft, setDraft] = useState("");
  const [threadId, setThreadId] = useState<string | undefined>(initialThreadId);
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>();
  const [seedStubEvents, setSeedStubEvents] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSwitchingRuntime, setIsSwitchingRuntime] = useState(false);
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

  const startExperimentalTurn = useMutation(apiAny.ai.v2.groups.startExperimentalTurn);
  const setProjectAssistantRuntime = useMutation(
    apiAny.ai.v2.profiles.setProjectAssistantRuntime,
  );
  const {
    pendingItems,
    handleConfirmItem,
    handleRejectItem,
    handleEditItem,
    handleUpdatePendingItem,
    isBulkProcessing,
  } = usePendingItems({
    projectId,
    teamSlug,
    threadId,
    autoConfirmCrud: false,
    setChatHistory,
  });

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

  const handleRuntimeChange = useCallback(
    async (nextRuntime: AssistantRuntime) => {
      if (nextRuntime === runtime) return;

      setIsSwitchingRuntime(true);
      try {
        await setProjectAssistantRuntime({
          projectId,
          runtime: nextRuntime,
        });
        toast.success(
          nextRuntime === "v2"
            ? "Assistant runtime switched to v2"
            : "Assistant runtime switched to v1",
        );
      } catch (error) {
        console.error("Failed to update assistant runtime:", error);
        toast.error("Failed to change assistant runtime");
      } finally {
        setIsSwitchingRuntime(false);
      }
    },
    [projectId, runtime, setProjectAssistantRuntime],
  );

  const handleStartTurn = useCallback(async () => {
    const message = draft.trim();
    if (!message) {
      toast.error("Enter a prompt for the v2 runtime");
      return;
    }

    setIsSending(true);
    try {
      const result = await startExperimentalTurn({
        projectId,
        threadId,
        message,
        title: `${projectName} Assistant v2`,
        confirmationPolicy: "group",
        seedStubEvents,
      });

      setThreadId(result.threadId);
      setSelectedGroupId(result.groupId);
      setDraft("");
      toast.success(
        seedStubEvents
          ? "Experimental v2 turn stored with stub assistant events"
          : "Experimental v2 turn stored",
      );
    } catch (error) {
      console.error("Failed to start experimental v2 turn:", error);
      toast.error("Failed to start experimental turn");
    } finally {
      setIsSending(false);
    }
  }, [draft, projectId, projectName, seedStubEvents, startExperimentalTurn, threadId]);

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full min-w-0 flex-col gap-4 overflow-hidden p-4 text-foreground xl:p-6">
      <Card className="border-border/70 bg-background/90 shadow-soft-lg">
        <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="gap-1" variant="default">
                <Sparkles className="size-3" />
                Assistant v2
              </Badge>
              <Badge variant="outline">Experimental runtime</Badge>
              {threadId ? <Badge variant="secondary">Thread {threadId}</Badge> : null}
            </div>
            <div>
              <CardTitle className="text-xl tracking-tight">
                New runtime sandbox for {projectName}
              </CardTitle>
              <CardDescription className="max-w-3xl pt-1">
                This panel writes to the new response-group and event-log model. It is the
                staging ground before the live OpenAI Responses orchestrator replaces v1.
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:min-w-56">
            <Label htmlFor="assistant-runtime-select">Project runtime</Label>
            <Select
              disabled={!canManageRuntime || isSwitchingRuntime}
              value={runtime}
              onValueChange={(value) => {
                void handleRuntimeChange(value as AssistantRuntime);
              }}
            >
              <SelectTrigger id="assistant-runtime-select" className="w-full">
                <SelectValue placeholder="Select runtime" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="v1">v1 legacy runtime</SelectItem>
                <SelectItem value="v2">v2 event runtime</SelectItem>
              </SelectContent>
            </Select>
            {!canManageRuntime ? (
              <p className="text-xs text-muted-foreground">
                Only admins can switch the runtime for this project.
              </p>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
          <Card className="border-border/70 bg-background/90 shadow-soft-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PanelLeftDashed className="size-4" />
                Send an experimental turn
              </CardTitle>
              <CardDescription>
                Store a new v2 turn in Convex and inspect the generated event timeline.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="assistant-v2-prompt">Prompt</Label>
                <Textarea
                  id="assistant-v2-prompt"
                  className="min-h-32 resize-y"
                  placeholder="Plan the next renovation workflow and show how v2 stores the turn."
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
                <div className="space-y-1">
                  <Label htmlFor="assistant-v2-stub">Seed stub assistant events</Label>
                  <p className="text-xs text-muted-foreground">
                    Keeps the UI end-to-end for now by adding reasoning and assistant events.
                  </p>
                </div>
                <Switch
                  id="assistant-v2-stub"
                  checked={seedStubEvents}
                  onCheckedChange={setSeedStubEvents}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={isSending}
                  onClick={() => {
                    void handleStartTurn();
                  }}
                >
                  {isSending ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}
                  Start v2 turn
                </Button>
                <Button
                  disabled={!threadId}
                  variant="outline"
                  onClick={() => {
                    setThreadId(undefined);
                    setSelectedGroupId(undefined);
                  }}
                >
                  New thread
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/90 shadow-soft-md">
            <CardHeader>
              <CardTitle className="text-base">Tenant assistant profile</CardTitle>
              <CardDescription>
                Team-scoped defaults that the v2 runtime will inherit.
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
                Each v2 assistant turn is tracked as one response group.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!threadId ? (
                <p className="text-sm text-muted-foreground">
                  Start a v2 turn to create the first thread and response group.
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
                  <Badge variant="outline">{selectedGroup.groupId}</Badge>
                </>
              ) : null}
            </div>
            <CardDescription>
              Stream-ready event log for text, reasoning, tools, and confirmation state.
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
