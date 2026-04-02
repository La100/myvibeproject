"use client";

import { useEffect, useMemo, useState } from "react";
import Script from "next/script";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { ChatKit, useChatKit, type StartScreenPrompt } from "@openai/chatkit-react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { useProject } from "@/components/providers/ProjectProvider";
import { apiAny } from "@/lib/convexApiAny";
import { AISubscriptionWall, AIQuotaUpsellCard } from "@/components/ai/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { QUICK_PROMPTS, MAX_FILE_SIZE_BYTES } from "@/components/ai/assistant/config";
import { useChatKitClientTools } from "@/components/ai/assistant/chatkit/useChatKitClientTools";

const CHANGE_MODE_STORAGE_KEY = "myvibeproject-chatkit-can-make-changes";
const DEFAULT_SELF_HOSTED_CHATKIT_URL = "/api/chatkit/self-hosted";

const START_PROMPT_ICONS: Record<string, StartScreenPrompt["icon"]> = {
  "Set Up Phases": "check-circle",
  "Material List": "square-text",
  "Labor Costs": "suitcase",
  "Add Contractors": "profile",
  "Week Plan": "calendar",
  "Status Check": "chart",
};

export default function HostedChatKit() {
  const { user } = useUser();
  const { project, team, isLoading: isProjectLoading } = useProject();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const selfHostedChatKitUrl =
    process.env.NEXT_PUBLIC_CHATKIT_SELF_HOSTED_URL?.trim() || DEFAULT_SELF_HOSTED_CHATKIT_URL;
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

  const onClientTool = useChatKitClientTools(
    project?._id && team?._id && team?.slug
      ? {
          projectId: project._id,
          teamId: team._id,
          teamSlug: team.slug,
          userClerkId: user?.id,
          canMakeChanges,
        }
      : null,
  );

  const selfHostedFetch = useMemo(
    () => async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);

      if (project?._id) {
        headers.set("x-chatkit-project-id", String(project._id));
      }

      if (team?._id) {
        headers.set("x-chatkit-team-id", String(team._id));
      }

      headers.set("x-chatkit-can-make-changes", canMakeChanges ? "true" : "false");

      return fetch(input, {
        ...init,
        headers,
        cache: "no-store",
        credentials: "same-origin",
      });
    },
    [canMakeChanges, project?._id, team?._id],
  );

  const chatkit = useChatKit({
    api: {
      url: selfHostedChatKitUrl,
      domainKey: selfHostedDomainKey ?? "",
      fetch: selfHostedFetch,
      uploadStrategy: { type: "two_phase" },
    },
    onClientTool,
    locale: "en",
    frameTitle: `${project?.name || "Project"} assistant`,
    initialThread: initialThreadId ?? null,
    header: {
      enabled: true,
      title: {
        enabled: true,
        text: canMakeChanges
          ? project?.name || "AI Assistant"
          : `${project?.name || "AI Assistant"} (Read-only)`,
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

  if (aiAccess !== undefined && !aiAccess.hasAccess && team?._id) {
    const quotaBlocked =
      aiAccess.remainingTokens === 0 ||
      (aiAccess.message || "").toLowerCase().includes("exhaust");

    if (quotaBlocked) {
      return (
        <AIQuotaUpsellCard
          teamId={team._id}
          currentPlan={aiAccess.currentPlan}
          subscriptionStatus={aiAccess.subscriptionStatus}
          message={aiAccess.message}
          remainingTokens={aiAccess.remainingTokens}
        />
      );
    }

    return <AISubscriptionWall teamId={team._id} teamSlug={team.slug} />;
  }

  const showUnifiedLoading =
    isProjectLoading ||
    !team?._id ||
    !project?._id ||
    aiAccess === undefined ||
    !team.slug;

  if (showUnifiedLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }

  const effectiveError = configurationError || bootError;

  if (effectiveError) {
    return (
      <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center p-4 xl:p-6">
        <Card className="w-full max-w-xl rounded-3xl border-border/70 bg-background/95">
          <CardHeader>
            <CardTitle>Self-hosted ChatKit error</CardTitle>
            <CardDescription>
              The AI assistant is wired to your self-hosted ChatKit backend, but the integration
              could not be initialized.
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

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full min-w-0 flex-col p-4 xl:p-6">
      <Script
        src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"
        strategy="afterInteractive"
      />

      <div className="mx-auto mb-4 flex w-full max-w-[1220px] items-center justify-between rounded-3xl border border-border/70 bg-background/95 px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Can make changes</p>
          <p className="text-xs text-muted-foreground">
            The self-hosted backend receives this mode on every request, so it can enforce
            read-only behavior server-side.
          </p>
        </div>
        <Switch
          checked={canMakeChanges}
          onCheckedChange={(checked) => {
            setCanMakeChanges(checked);
            setBootError(null);
            if (typeof window !== "undefined") {
              window.localStorage.setItem(CHANGE_MODE_STORAGE_KEY, String(checked));
            }
          }}
          aria-label="Toggle whether ChatKit can make changes"
        />
      </div>

      <div className="mx-auto flex h-full w-full max-w-[1220px] overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-b from-background to-muted/20 shadow-lg">
        <ChatKit
          key={refreshKey}
          control={chatkit.control}
          className="block h-full min-h-0 w-full"
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Signed in as {user?.primaryEmailAddress?.emailAddress || user?.id || "unknown user"} for
        project {project.name}.
      </p>
    </div>
  );
}
