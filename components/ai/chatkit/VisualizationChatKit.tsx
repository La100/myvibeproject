"use client";

import { useMemo, useState } from "react";
import Script from "next/script";
import { useAuth, useOrganization } from "@clerk/nextjs";
import { useAction, useQuery } from "convex/react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { AIQuotaUpsellCard, AISubscriptionWall } from "@/components/ai/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VISUALIZATION_SUGGESTIONS } from "@/app/organisation/(company)/visualizations/constants";
import { apiAny } from "@/lib/convexApiAny";

const DEFAULT_VISUALIZATION_CHATKIT_URL = "/api/chatkit/visualizations";
const CLIENT_TOOL_TIMEOUT_MS = 115_000;
const MAX_IMAGE_ATTACHMENT_BYTES = 20 * 1024 * 1024;

type ToolCall = {
  name: string;
  params: Record<string, unknown>;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const asReferenceImages = (value: unknown) => {
  if (!Array.isArray(value)) return undefined;

  const images = value.flatMap((entry, index) => {
    const record = asRecord(entry);
    const name = asString(record.name) || `reference-${index + 1}`;
    const imageUrl = asString(record.imageUrl) || asString(record.url);
    const base64 = asString(record.base64);
    const storageKey = asString(record.storageKey);
    const mimeType = asString(record.mimeType) || asString(record.type);

    if (!imageUrl && !base64 && !storageKey) {
      return [];
    }

    return [
      {
        name,
        ...(imageUrl ? { imageUrl } : {}),
        ...(base64 ? { base64 } : {}),
        ...(storageKey ? { storageKey } : {}),
        ...(mimeType ? { mimeType } : {}),
      },
    ];
  });

  return images.length > 0 ? images : undefined;
};

export default function VisualizationChatKit() {
  const { userId, getToken, isLoaded: isAuthLoaded } = useAuth();
  const { organization, isLoaded: isOrganizationLoaded } = useOrganization();
  const team = useQuery(
    apiAny.teams.getTeamByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip",
  );
  const aiAccess = useQuery(
    apiAny.stripe.checkTeamAIAccess,
    team?._id ? { teamId: team._id } : "skip",
  );
  const generateVisualization = useAction(apiAny.ai.imageGen.generation.generateVisualization);

  const [bootError, setBootError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [assistantActivity, setAssistantActivity] = useState<
    "idle" | "loading_thread" | "responding"
  >("idle");

  const chatkitUrl =
    process.env.NEXT_PUBLIC_CHATKIT_VISUALIZATIONS_URL?.trim() ||
    DEFAULT_VISUALIZATION_CHATKIT_URL;
  const usesDirectChatKitBackend = /^https?:\/\//i.test(chatkitUrl);
  const domainKey =
    process.env.NEXT_PUBLIC_CHATKIT_VISUALIZATIONS_DOMAIN_KEY?.trim() || null;
  const configurationError = domainKey
    ? null
    : "Missing NEXT_PUBLIC_CHATKIT_VISUALIZATIONS_DOMAIN_KEY for the visualizations ChatKit.";

  const onClientTool = useMemo(
    () => async (call: ToolCall) => {
      const startedAt = performance.now();
      const toolName = call?.name || "unknown";

      const timeout = new Promise<Record<string, unknown>>((resolve) => {
        setTimeout(() => {
          resolve({
            ok: false,
            tool: toolName,
            error: `Client tool timed out after ${Math.round(CLIENT_TOOL_TIMEOUT_MS / 1000)} seconds.`,
            timedOut: true,
          });
        }, CLIENT_TOOL_TIMEOUT_MS);
      });

      const run = async () => {
        if (toolName !== "generate_visualization_image") {
          return {
            ok: false,
            tool: toolName,
            error: `Unknown visualization client tool: ${toolName}`,
          };
        }

        if (!team?._id) {
          return {
            ok: false,
            tool: toolName,
            error: "No active team is available for image generation.",
          };
        }

        const params = asRecord(call.params);
        const prompt = asString(params.prompt);
        if (!prompt) {
          return {
            ok: false,
            tool: toolName,
            error: "Missing required `prompt`.",
          };
        }

        const result = await generateVisualization({
          teamId: team._id,
          prompt,
          referenceImages: asReferenceImages(params.referenceImages),
        });

        return {
          ok: result.success,
          tool: toolName,
          model: "gpt-image-2",
          imageUrl: result.fileUrl,
          imageStorageKey: result.imageStorageKey,
          mimeType: result.mimeType,
          generationId: result.generationId,
          markdown: result.fileUrl ? `![Generated visualization](${result.fileUrl})` : undefined,
          error: result.error,
        };
      };

      const result = await Promise.race([run(), timeout]);
      const durationMs = Math.round(performance.now() - startedAt);
      console.info("[visualization-chatkit-client-tool] result", {
        tool: toolName,
        ok: (result as Record<string, unknown>).ok !== false,
        durationMs,
        resultKeys: Object.keys(result),
        teamId: team?._id,
      });

      if ((result as Record<string, unknown>).ok === false) {
        toast.error(String((result as Record<string, unknown>).error || "Visualization tool failed"));
      }

      return result;
    },
    [generateVisualization, team?._id],
  );

  const chatkitFetch = useMemo(
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

      if (team?._id) {
        headers.set("x-chatkit-team-id", String(team._id));
      }

      if (team?.timezone) {
        headers.set("x-chatkit-timezone", team.timezone);
      }

      headers.set("x-chatkit-surface", "visualizations");

      return fetch(input, {
        ...init,
        headers,
        cache: "no-store",
        credentials: "same-origin",
      });
    },
    [
      getToken,
      team?._id,
      team?.timezone,
      userId,
      usesDirectChatKitBackend,
    ],
  );

  const chatkit = useChatKit({
    api: {
      url: chatkitUrl,
      domainKey: domainKey ?? "",
      fetch: chatkitFetch,
      uploadStrategy: { type: "two_phase" },
    },
    onClientTool,
    locale: "en",
    frameTitle: "Visualization assistant",
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
      greeting: "Describe the visual direction. Attach references when useful.",
    },
    composer: {
      placeholder: "Describe the visualization...",
      attachments: {
        enabled: true,
        maxSize: MAX_IMAGE_ATTACHMENT_BYTES,
        maxCount: 8,
        accept: {
          "image/*": [".png", ".jpg", ".jpeg", ".webp"],
        },
      },
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
      text: "Generated images can be imperfect. Verify details before client delivery.",
    },
    onError: ({ error }) => {
      console.error("Visualization ChatKit error", error);
      const message = error?.message || "Visualization ChatKit error";
      setBootError(message);
      toast.error(message);
    },
  });

  const handleSuggestionClick = (prompt: string) => {
    void (async () => {
      try {
        await chatkit.setComposerValue({ text: prompt });
        await chatkit.focusComposer();
      } catch (error) {
        console.error("Failed to set visualization prompt", error);
        toast.error("Could not load the prompt into ChatKit.");
      }
    })();
  };

  const assistantActivityLabel =
    assistantActivity === "responding"
      ? "Generating..."
      : assistantActivity === "loading_thread"
        ? "Loading visualization thread..."
        : null;

  const isLoading =
    !isAuthLoaded ||
    !isOrganizationLoaded ||
    !userId ||
    team === undefined ||
    (team?._id && aiAccess === undefined);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }

  if (aiAccess !== undefined && !aiAccess.hasAccess && team?._id) {
    const quotaBlocked =
      aiAccess.remainingTokens === 0 ||
      (aiAccess.message || "").toLowerCase().includes("exhaust");

    if (quotaBlocked) {
      return (
        <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-3xl items-center px-6">
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

    return <AISubscriptionWall teamId={team._id} teamSlug={team.slug} />;
  }

  const effectiveError = configurationError || bootError;

  if (effectiveError) {
    return (
      <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center p-4 xl:p-6">
        <Script
          src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"
          strategy="afterInteractive"
        />
        <Card className="w-full max-w-xl rounded-3xl border-border/70 bg-background/95">
          <CardHeader>
            <CardTitle>Visualization ChatKit error</CardTitle>
            <CardDescription>
              The visualizations page is wired to a dedicated ChatKit surface,
              but the integration could not be initialized.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              {effectiveError}
            </div>
            <Button
              onClick={() => {
                setBootError(null);
                setRefreshKey((current) => current + 1);
              }}
            >
              <RefreshCw className="size-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full min-w-0 flex-col gap-4 p-4 xl:p-6">
      <Script
        src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"
        strategy="afterInteractive"
      />

      <div className="relative mx-auto flex min-h-0 flex-1 w-full max-w-[1220px] overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-b from-background to-muted/20 shadow-lg">
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

      <section className="mx-auto w-full max-w-[1220px]" aria-label="Example visualization prompts">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">Example prompts</p>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Click one to load it into the composer.
          </p>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-1">
          {VISUALIZATION_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.title}
              type="button"
              onClick={() => handleSuggestionClick(suggestion.text)}
              className="group relative h-36 w-[20rem] shrink-0 overflow-hidden rounded-xl border border-border/70 bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:border-border hover:shadow-lg md:h-40 md:w-[23rem]"
            >
              <img
                src={suggestion.image}
                alt={suggestion.title}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/15" />
              <div className="relative flex h-full flex-col justify-end p-5">
                <p className="line-clamp-1 text-lg font-semibold leading-tight text-white md:text-xl">
                  {suggestion.title}
                </p>
                <p className="mt-2 line-clamp-2 text-sm leading-snug text-white/90 md:text-[15px]">
                  {suggestion.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
