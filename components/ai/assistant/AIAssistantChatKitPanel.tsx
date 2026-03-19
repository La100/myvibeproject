"use client";

import { useMemo, useState } from "react";
import Script from "next/script";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChatKit, useChatKit, type StartScreenPrompt } from "@openai/chatkit-react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QUICK_PROMPTS, MAX_FILE_SIZE_BYTES } from "@/components/ai/assistant/config";
import { useChatKitClientTools } from "@/components/ai/assistant/chatkit/useChatKitClientTools";

type Props = {
  initialThreadId?: string;
  projectId: Id<"projects">;
  projectName: string;
  teamId: Id<"teams">;
  teamSlug: string;
};

const START_PROMPT_ICONS: Record<string, StartScreenPrompt["icon"]> = {
  "Set Up Phases": "check-circle",
  "Material List": "square-text",
  "Labor Costs": "suitcase",
  "Add Contractors": "profile",
  "Week Plan": "calendar",
  "Status Check": "chart",
};

export default function AIAssistantChatKitPanel({
  initialThreadId,
  projectId,
  projectName,
  teamId,
  teamSlug,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [bootError, setBootError] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
  const onClientTool = useChatKitClientTools({
    projectId,
    teamId,
    teamSlug,
  });

  const getClientSecret = useMemo(
    () => async (currentClientSecret: string | null) => {
      if (currentClientSecret) {
        return currentClientSecret;
      }

      setIsBootstrapping(true);
      setBootError(null);

      try {
        const response = await fetch("/api/chatkit/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: "{}",
        });

        const payload = (await response.json().catch(() => ({}))) as {
          client_secret?: string;
          error?: string;
        };

        if (!response.ok || !payload.client_secret) {
          const message = payload.error || "Failed to create ChatKit session.";
          setBootError(message);
          throw new Error(message);
        }

        return payload.client_secret;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create ChatKit session.";
        setBootError(message);
        toast.error(message);
        throw error;
      } finally {
        setIsBootstrapping(false);
      }
    },
    [],
  );

  const chatkit = useChatKit({
    api: {
      getClientSecret,
    },
    onClientTool,
    locale: "en",
    frameTitle: `${projectName} assistant`,
    initialThread: initialThreadId ?? null,
    header: {
      enabled: true,
      title: {
        enabled: true,
        text: projectName,
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
      toast.error(error.message || "ChatKit error");
    },
  });

  const handleRetry = () => {
    setBootError(null);
    setRefreshKey((current) => current + 1);
  };

  if (bootError) {
    return (
      <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center p-4 xl:p-6">
        <Card className="w-full max-w-xl rounded-[2rem] border-border/70 bg-background/95 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <CardHeader>
            <CardTitle>ChatKit session error</CardTitle>
            <CardDescription>
              The new assistant shell is wired to OpenAI ChatKit, but the session could not be created.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              {bootError}
            </div>
            <div className="flex gap-3">
              <Button onClick={handleRetry}>
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

      <div className="mx-auto flex h-full w-full max-w-[1220px] overflow-hidden rounded-[2rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,248,244,0.92))] shadow-[0_28px_110px_rgba(15,23,42,0.08)]">
        <ChatKit
          key={refreshKey}
          control={chatkit.control}
          className="block h-full min-h-0 w-full"
        />
      </div>

      {isBootstrapping ? (
        <div className="pointer-events-none absolute inset-x-0 top-6 z-10 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/95 px-4 py-2 text-sm text-muted-foreground shadow-sm">
            <Loader2 className="size-4 animate-spin" />
            Initializing ChatKit…
          </div>
        </div>
      ) : null}
    </div>
  );
}
