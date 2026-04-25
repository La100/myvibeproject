"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { useAuth, useOrganization } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { ChatKit, useChatKit, type StartScreenPrompt } from "@openai/chatkit-react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { apiAny } from "@/lib/convexApiAny";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useChatKitClientTools } from "@/components/ai/assistant/chatkit/useChatKitClientTools";

const DEFAULT_SELF_HOSTED_CHATKIT_URL = "/api/chatkit/self-hosted";
const ONBOARDING_PROJECT_NAME = "Onboarding Workspace";
const GENERIC_SETUP_ERROR = "We couldn't start your guided setup. Please try again.";

const ONBOARDING_PROMPTS: StartScreenPrompt[] = [
  {
    label: "Create Organization",
    prompt: "Help me set up organization onboarding step by step.",
    icon: "check-circle",
  },
  {
    label: "Currency & Timezone",
    prompt: "Ask me for currency and timezone and confirm the choices.",
    icon: "globe",
  },
  {
    label: "Finish Onboarding",
    prompt: "Summarize what is done and what is left to finish onboarding.",
    icon: "chart",
  },
];

export default function OnboardingHostedChatKit() {
  const { userId, getToken, isLoaded: isAuthLoaded } = useAuth();
  const { organization, isLoaded: isOrganizationLoaded } = useOrganization();
  const onboardingStatus = useQuery(apiAny.onboarding.getStatus);
  const createProjectInOrg = useMutation(apiAny.projects.createProjectInOrg);

  const activeOrganization = onboardingStatus?.activeOrganization ?? null;
  const teamId = activeOrganization?.teamId;

  const team = useQuery(apiAny.teams.getTeam, teamId ? { teamId } : "skip");
  const projects = useQuery(apiAny.projects.listProjectsByTeam, teamId ? { teamId } : "skip");

  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const createAttemptedForTeamRef = useRef<string | null>(null);

  const selfHostedChatKitUrl =
    process.env.NEXT_PUBLIC_CHATKIT_SELF_HOSTED_URL?.trim() || DEFAULT_SELF_HOSTED_CHATKIT_URL;
  const usesDirectChatKitBackend = /^https?:\/\//i.test(selfHostedChatKitUrl);
  const selfHostedDomainKey =
    process.env.NEXT_PUBLIC_CHATKIT_SELF_HOSTED_DOMAIN_KEY?.trim() || null;
  const configurationError = selfHostedDomainKey
    ? null
    : GENERIC_SETUP_ERROR;

  const scopedProject = useMemo(() => {
    if (!projects || projects.length === 0) {
      return null;
    }
    return [...projects].sort((a, b) => b._creationTime - a._creationTime)[0];
  }, [projects]);

  useEffect(() => {
    if (!teamId || !organization?.id) {
      return;
    }
    if (projects === undefined || projects.length > 0 || isCreatingProject) {
      return;
    }

    const currentTeamId = String(teamId);
    if (createAttemptedForTeamRef.current === currentTeamId) {
      return;
    }
    createAttemptedForTeamRef.current = currentTeamId;

    setIsCreatingProject(true);
    void (async () => {
      try {
        await createProjectInOrg({
          name: ONBOARDING_PROJECT_NAME,
          clerkOrgId: organization.id,
          teamId,
        });
      } catch (error) {
        console.error(error);
        setBootError("We couldn't prepare your onboarding workspace.");
      } finally {
        setIsCreatingProject(false);
      }
    })();
  }, [createProjectInOrg, isCreatingProject, organization?.id, projects, teamId]);

  const onClientTool = useChatKitClientTools(
    scopedProject?._id && teamId && team?.slug
      ? {
          projectId: scopedProject._id,
          teamId,
          teamSlug: team.slug,
          userClerkId: userId ?? undefined,
          canMakeChanges: true,
        }
      : null,
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

      if (scopedProject?._id) {
        headers.set("x-chatkit-project-id", String(scopedProject._id));
      }
      if (teamId) {
        headers.set("x-chatkit-team-id", String(teamId));
      }
      headers.set("x-chatkit-can-make-changes", "true");

      return fetch(input, {
        ...init,
        headers,
        cache: "no-store",
        credentials: "same-origin",
      });
    },
    [getToken, scopedProject?._id, teamId, userId, usesDirectChatKitBackend],
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
    frameTitle: "Onboarding assistant",
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
      greeting: "Hi, I’m Vibe. Let’s do onboarding in chat.",
      prompts: ONBOARDING_PROMPTS,
    },
    composer: {
      placeholder: "Write a message...",
      attachments: {
        enabled: true,
        maxSize: 32 * 1024 * 1024,
        maxCount: 5,
      },
    },
    threadItemActions: {
      feedback: false,
      retry: true,
    },
    disclaimer: {
      text: "AI can make mistakes. Verify important decisions before applying changes.",
    },
    onError: ({ error }) => {
      console.error("Onboarding ChatKit error", error);
      setBootError(GENERIC_SETUP_ERROR);
      toast.error(GENERIC_SETUP_ERROR);
    },
  });

  const showLoading =
    !isAuthLoaded ||
    !isOrganizationLoaded ||
    onboardingStatus === undefined ||
    !activeOrganization ||
    team === undefined ||
    projects === undefined ||
    isCreatingProject ||
    !scopedProject;

  const effectiveError = configurationError || bootError;

  if (showLoading) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-6">
        <Script
          src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"
          strategy="afterInteractive"
        />
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading guided setup" />
      </div>
    );
  }

  if (effectiveError) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-4">
        <Script
          src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"
          strategy="afterInteractive"
        />
        <Card className="w-full max-w-xl rounded-3xl border-border/70 bg-background/95">
          <CardHeader>
            <CardTitle>Guided setup is unavailable</CardTitle>
            <CardDescription>
              We couldn't start the setup chat for this workspace.
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
    <div className="flex h-full min-h-0 flex-col">
      <Script
        src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"
        strategy="afterInteractive"
      />
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
