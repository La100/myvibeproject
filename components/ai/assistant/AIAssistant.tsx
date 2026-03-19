"use client";

import { useQuery } from "convex/react";
import { useProject } from "@/components/providers/ProjectProvider";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { apiAny } from "@/lib/convexApiAny";
import { AISubscriptionWall } from "@/components/ai/shared";
import AIAssistantChatKitPanel from "./AIAssistantChatKitPanel";

const AIAssistant = () => {
  const { project, team, isLoading: isProjectContextLoading } = useProject();
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get("session");
  const initialThreadIdFromUrl =
    typeof sessionParam === "string" && sessionParam.trim().length > 0
      ? sessionParam
      : undefined;

  const aiAccess = useQuery(
    apiAny.stripe.checkTeamAIAccess,
    team?._id ? { teamId: team._id } : "skip",
  );

  if (aiAccess !== undefined && !aiAccess.hasAccess && team?._id) {
    const quotaBlocked =
      aiAccess.remainingTokens === 0 ||
      (aiAccess.message || "").toLowerCase().includes("exhaust");

    if (!quotaBlocked) {
      return <AISubscriptionWall teamId={team._id} teamSlug={team.slug} />;
    }
  }

  const showUnifiedLoading =
    isProjectContextLoading ||
    !team?._id ||
    !project?._id ||
    aiAccess === undefined;

  if (showUnifiedLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }

  return (
    <AIAssistantChatKitPanel
      initialThreadId={initialThreadIdFromUrl}
      projectId={project._id}
      projectName={project.name || "AI Assistant"}
      teamId={team._id}
      teamSlug={team.slug}
    />
  );
};

export default AIAssistant;
