"use client";

import { useEffect, useMemo, useState } from "react";
import Script from "next/script";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import {
  ChatKit,
  useChatKit,
  type StartScreenPrompt,
} from "@openai/chatkit-react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { useProject } from "@/components/providers/ProjectProvider";
import { apiAny } from "@/lib/convexApiAny";
import { AISubscriptionWall, AIQuotaUpsellCard } from "@/components/ai/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  QUICK_PROMPTS,
  MAX_FILE_SIZE_BYTES,
} from "@/components/ai/assistant/config";
import { useChatKitClientTools } from "@/components/ai/assistant/chatkit/useChatKitClientTools";

const CHANGE_MODE_STORAGE_KEY = "myvibeproject-chatkit-can-make-changes";
const DEFAULT_SELF_HOSTED_CHATKIT_URL = "/api/chatkit/self-hosted";
const CLIENT_TOOL_TIMEOUT_MS = 45_000;

const START_PROMPT_ICONS: Record<string, StartScreenPrompt["icon"]> = {
  "Project Status": "chart",
  "Next Steps": "check-circle",
  "Budget Check": "suitcase",
};

type HostedChatKitProps = {
  mode?: "page" | "panel";
};

export default function HostedChatKit({ mode = "page" }: HostedChatKitProps) {
  const { userId, getToken, isLoaded: isAuthLoaded } = useAuth();
  const { project, team, isLoading: isProjectLoading } = useProject();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isPanel = mode === "panel";
  const sessionParam = searchParams.get("session");
  const initialThreadId =
    typeof sessionParam === "string" && sessionParam.trim().length > 0
      ? sessionParam
      : undefined;

  const aiAccess = useQuery(
    apiAny.stripe.checkTeamAIAccess,
    team?._id ? { teamId: team._id } : "skip",
  );

  const [bootError, setBootError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [canMakeChanges, setCanMakeChanges] = useState(false);
  const [assistantActivity, setAssistantActivity] = useState<
    "idle" | "loading_thread" | "responding"
  >("idle");
  const selfHostedChatKitUrl =
    process.env.NEXT_PUBLIC_CHATKIT_SELF_HOSTED_URL?.trim() ||
    DEFAULT_SELF_HOSTED_CHATKIT_URL;
  const usesDirectChatKitBackend = /^https?:\/\//i.test(selfHostedChatKitUrl);
  const selfHostedDomainKey =
    process.env.NEXT_PUBLIC_CHATKIT_SELF_HOSTED_DOMAIN_KEY?.trim() || null;
  const configurationError = selfHostedDomainKey
    ? null
    : "Missing NEXT_PUBLIC_CHATKIT_SELF_HOSTED_DOMAIN_KEY for the self-hosted AI assistant.";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(CHANGE_MODE_STORAGE_KEY);
    if (stored === "true") {
      setCanMakeChanges(true);
    }
  }, []);

  const prompts = useMemo<StartScreenPrompt[]>(
    () =>
      QUICK_PROMPTS.map((prompt) => ({
        label: prompt.label,
        prompt: prompt.prompt,
        icon: START_PROMPT_ICONS[prompt.label],
      })),
    [],
  );

  const composerAttachments = useMemo(
    () => ({
      enabled: true,
      maxSize: MAX_FILE_SIZE_BYTES,
      maxCount: 5,
      accept: {
        "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif"],
        "application/pdf": [".pdf"],
      },
    }),
    [],
  );

  const theme = useMemo(
    () =>
      isPanel
        ? {
            density: "compact" as const,
            radius: "round" as const,
            typography: {
              baseSize: 14 as const,
            },
          }
        : undefined,
    [isPanel],
  );

  const rawOnClientTool = useChatKitClientTools(
    project?._id && team?._id && team?.slug
      ? {
          projectId: project._id,
          teamId: team._id,
          teamSlug: team.slug,
          userClerkId: userId ?? undefined,
          timezone: team.timezone,
          canMakeChanges,
        }
      : null,
  );
  const onClientTool = useMemo(
    () =>
      async (...toolArgs: Parameters<typeof rawOnClientTool>) => {
        const [call] = toolArgs;
        const startedAt = performance.now();
        const toolName =
          call && typeof call === "object" && "name" in call
            ? String(call.name)
            : "unknown";

        console.info("[chatkit-client-tool] start", {
          tool: toolName,
          projectId: project?._id,
          teamId: team?._id,
        });

        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<Record<string, unknown>>((resolve) => {
          timeoutId = setTimeout(() => {
            resolve({
              ok: false,
              tool: toolName,
              error: `Client tool timed out after ${Math.round(CLIENT_TOOL_TIMEOUT_MS / 1000)} seconds.`,
              timedOut: true,
            });
          }, CLIENT_TOOL_TIMEOUT_MS);
        });

        const result = await Promise.race([
          rawOnClientTool(...toolArgs),
          timeout,
        ]);

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        const durationMs = Math.round(performance.now() - startedAt);
        const ok = (result as Record<string, unknown>).ok !== false;
        const logPayload = {
          tool: toolName,
          ok,
          durationMs,
          resultKeys: Object.keys(result as Record<string, unknown>),
          projectId: project?._id,
          teamId: team?._id,
        };

        if ((result as Record<string, unknown>).timedOut === true) {
          console.warn("[chatkit-client-tool] timeout", logPayload);
        } else {
          console.info("[chatkit-client-tool] result", logPayload);
        }

        return result;
      },
    [project?._id, rawOnClientTool, team?._id],
  );

  const selfHostedFetch = useMemo(
    () => async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);

      if (usesDirectChatKitBackend) {
        const convexToken = await getToken({ template: "convex" });
        if (convexToken) {
          headers.set("authorization", `Bearer ${convexToken}`);
          headers.set("x-chatkit-convex-token", convexToken);
        }
      }

      if (userId) {
        headers.set("x-chatkit-user-id", userId);
      }

      if (project?._id) {
        headers.set("x-chatkit-project-id", String(project._id));
      }

      if (team?._id) {
        headers.set("x-chatkit-team-id", String(team._id));
      }

      if (team?.timezone) {
        headers.set("x-chatkit-timezone", team.timezone);
      }

      headers.set(
        "x-chatkit-can-make-changes",
        canMakeChanges ? "true" : "false",
      );

      return fetch(input, {
        ...init,
        headers,
        cache: "no-store",
        credentials: "same-origin",
      });
    },
    [
      canMakeChanges,
      getToken,
      project?._id,
      team?._id,
      team?.timezone,
      userId,
      usesDirectChatKitBackend,
    ],
  );

  const handleCanMakeChangesChange = (checked: boolean) => {
    setCanMakeChanges(checked);
    setBootError(null);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHANGE_MODE_STORAGE_KEY, String(checked));
    }
  };

  const chatkit = useChatKit({
    api: {
      url: selfHostedChatKitUrl,
      domainKey: selfHostedDomainKey ?? "",
      fetch: selfHostedFetch,
      uploadStrategy: { type: "two_phase" },
    },
    onClientTool,
    locale: "en",
    frameTitle: "Vibe assistant",
    theme,
    initialThread: initialThreadId ?? null,
    header: {
      enabled: true,
      title: {
        enabled: false,
      },
    },
    history: {
      enabled: true,
      showDelete: true,
      showRename: true,
    },
    startScreen: {
      greeting: "Hi, I'm Vibe.",
      prompts,
    },
    composer: {
      placeholder: "Ask Vibe",
      attachments: composerAttachments,
    },
    threadItemActions: {
      feedback: false,
      retry: true,
    },
    onResponseStart: () => {
      setAssistantActivity("responding");
    },
    onResponseEnd: () => {
      setAssistantActivity("idle");
    },
    onThreadLoadStart: () => {
      setAssistantActivity("loading_thread");
    },
    onThreadLoadEnd: () => {
      setAssistantActivity("idle");
    },
    disclaimer: {
      text: "AI can make mistakes. Verify important decisions before taking action.",
    },
    onThreadChange: ({ threadId }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (threadId) {
        params.set("session", threadId);
      } else {
        params.delete("session");
      }

      const nextQuery = params.toString();
      const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
      router.replace(nextUrl, { scroll: false });
    },
    onError: ({ error }) => {
      console.error("ChatKit error", error);
      const message = error?.message || "ChatKit error";
      setBootError(message);
      toast.error(message);
    },
  });

  const assistantActivityLabel =
    assistantActivity === "responding"
      ? "Vibe is thinking..."
      : assistantActivity === "loading_thread"
        ? "Loading conversation..."
        : null;

  if (aiAccess !== undefined && !aiAccess.hasAccess && team?._id) {
    const quotaBlocked =
      aiAccess.remainingTokens === 0 ||
      (aiAccess.message || "").toLowerCase().includes("exhaust");

    if (quotaBlocked) {
      if (isPanel) {
        return (
          <div className="flex h-full min-h-0 flex-col overflow-auto p-4">
            <Script
              src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"
              strategy="afterInteractive"
            />
            <AIQuotaUpsellCard
              teamId={team._id}
              currentPlan={aiAccess.currentPlan}
              subscriptionStatus={aiAccess.subscriptionStatus}
              message={aiAccess.message}
              remainingTokens={aiAccess.remainingTokens}
              className="border-border/70 bg-background/95 shadow-sm"
            />
          </div>
        );
      }

      return (
        <div>
          <AIQuotaUpsellCard
            teamId={team._id}
            currentPlan={aiAccess.currentPlan}
            subscriptionStatus={aiAccess.subscriptionStatus}
            message={aiAccess.message}
            remainingTokens={aiAccess.remainingTokens}
          />
        </div>
      );
    }

    if (isPanel) {
      return (
        <div className="flex h-full min-h-0 items-center justify-center p-4">
          <Script
            src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"
            strategy="afterInteractive"
          />
          <Card className="w-full rounded-3xl border-border/70 bg-background/95 shadow-sm">
            <CardHeader>
              <CardTitle>AI assistant unavailable</CardTitle>
              <CardDescription>
                Your workspace does not currently have access to the self-hosted
                assistant.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button onClick={() => router.push("/organisation/subscription")}>
                Open billing settings
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  router.push(`/organisation/projects/${project.slug}/ai`)
                }
              >
                Open full AI page
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div>
        <AISubscriptionWall teamId={team._id} teamSlug={team.slug} />
      </div>
    );
  }

  const showUnifiedLoading =
    isProjectLoading ||
    !isAuthLoaded ||
    !userId ||
    !team?._id ||
    !project?._id ||
    aiAccess === undefined ||
    !team.slug;

  if (showUnifiedLoading) {
    return (
      <div
        className={
          isPanel
            ? "flex h-full items-center justify-center p-6"
            : "flex min-h-screen items-center justify-center"
        }
      >
        <Loader2
          className="h-8 w-8 animate-spin text-primary"
          aria-label="Loading"
        />
      </div>
    );
  }

  const effectiveError = configurationError || bootError;

  if (effectiveError) {
    return (
      <div
        className={
          isPanel
            ? "flex h-full w-full items-center justify-center p-4"
            : "flex h-[calc(100vh-4rem)] w-full items-center justify-center p-4 xl:p-6"
        }
      >
        <Script
          src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"
          strategy="afterInteractive"
        />
        <Card className="w-full max-w-xl rounded-3xl border-border/70 bg-background/95">
          <CardHeader>
            <CardTitle>Self-hosted ChatKit error</CardTitle>
            <CardDescription>
              The AI assistant is wired to your self-hosted ChatKit backend, but
              the integration could not be initialized.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              {effectiveError}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setBootError(null);
                  setRefreshKey((current) => current + 1);
                }}
              >
                <RefreshCw className="size-4" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isPanel) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <Script
          src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"
          strategy="afterInteractive"
        />

        <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-white px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold leading-tight text-foreground">
              Vibe Assistant
            </p>
            <p className="text-[11px] text-muted-foreground">
              {assistantActivityLabel ??
                (canMakeChanges ? "Live changes enabled" : "Read-only mode")}
            </p>
          </div>
          <Switch
            checked={canMakeChanges}
            onCheckedChange={handleCanMakeChangesChange}
            aria-label="Toggle whether ChatKit can make changes"
          />
        </div>

        <div className="min-h-0 flex-1 bg-gradient-to-b from-background to-muted/20">
          <ChatKit
            key={refreshKey}
            control={chatkit.control}
            className="block h-full min-h-0 w-full"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full min-w-0 flex-col p-4 xl:p-6">
      <Script
        src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"
        strategy="afterInteractive"
      />

      <div className="mx-auto mb-3 flex w-full max-w-[1220px] justify-end">
        <div className="flex items-center gap-3 rounded-full border border-border/70 bg-background/95 px-4 py-2 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Can make changes
            </span>
            <span className="text-sm font-medium text-foreground">
              {canMakeChanges ? "Enabled" : "Read-only"}
            </span>
          </div>
          <Switch
            checked={canMakeChanges}
            onCheckedChange={handleCanMakeChangesChange}
            aria-label="Toggle whether ChatKit can make changes"
          />
        </div>
      </div>

      <div className="relative mx-auto flex h-full w-full max-w-[1220px] overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-b from-background to-muted/20 shadow-lg">
        {assistantActivityLabel ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center px-4 pt-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/95 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>{assistantActivityLabel}</span>
            </div>
          </div>
        ) : null}
        <ChatKit
          key={refreshKey}
          control={chatkit.control}
          className="block h-full min-h-0 w-full"
        />
      </div>
    </div>
  );
}
