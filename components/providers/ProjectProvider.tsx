"use client";

import { createContext, useCallback, useContext, ReactNode, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Doc } from "@/convex/_generated/dataModel";
import { useParams, useRouter } from "next/navigation";
import { Building } from "lucide-react";
import { useOrganization } from "@clerk/nextjs";

interface ProjectContextType {
  project: Doc<"projects">;
  team: Doc<"teams"> | null;
  teamMember: Doc<"teamMembers"> | null;
  isLoading: boolean;
  markClientNotificationsReadLocally: (lastReadAt: number) => void;
}

const ProjectContext = createContext<ProjectContextType | null>(null);
const getClientNotificationsStorageKey = (projectId: string) =>
  `project-client-notifications-last-read:${projectId}`;

export function ProjectProvider({ children }: { 
  children: ReactNode; 
}) {
  const router = useRouter();
  const params = useParams<{ projectSlug: string }>();
  const { organization, isLoaded } = useOrganization();
  const onboardingStatus = useQuery(apiAny.onboarding.getStatus);
  const [localClientNotificationsLastReadAt, setLocalClientNotificationsLastReadAt] =
    useState<number | null>(null);

  useEffect(() => {
    if (onboardingStatus === undefined || !onboardingStatus.authenticated) {
      return;
    }
    if (!onboardingStatus.completed || (isLoaded && !organization?.id)) {
      router.replace("/onboarding");
    }
  }, [onboardingStatus, isLoaded, organization?.id, router]);
  
  // Simple regular query approach
  const project = useQuery(
    apiAny.projects.getProjectBySlugInClerkOrg,
    organization?.id && params.projectSlug
      ? { clerkOrgId: organization.id, projectSlug: params.projectSlug }
      : "skip"
  );
  
  const team = useQuery(apiAny.teams.getTeam, 
    project ? { teamId: project.teamId } : "skip"
  );
  
  const teamMember = useQuery(apiAny.teams.getCurrentUserTeamMember,
    project ? { teamId: project.teamId } : "skip"
  );
  const projectId = project ? String(project._id) : null;
  const serverClientNotificationsLastReadAt = project?.clientNotificationsLastReadAt ?? 0;

  useEffect(() => {
    if (!projectId) {
      return;
    }

    const storageKey = getClientNotificationsStorageKey(projectId);
    const storedValue = window.localStorage.getItem(storageKey);
    const parsedValue = storedValue ? Number(storedValue) : 0;
    const normalizedStoredValue = Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : 0;

    setLocalClientNotificationsLastReadAt(
      Math.max(serverClientNotificationsLastReadAt, normalizedStoredValue),
    );
  }, [projectId, serverClientNotificationsLastReadAt]);

  useEffect(() => {
    if (!projectId || localClientNotificationsLastReadAt === null) {
      return;
    }

    const storageKey = getClientNotificationsStorageKey(projectId);
    const effectiveLastReadAt = Math.max(
      serverClientNotificationsLastReadAt,
      localClientNotificationsLastReadAt,
    );

    window.localStorage.setItem(storageKey, String(effectiveLastReadAt));

    if (effectiveLastReadAt !== localClientNotificationsLastReadAt) {
      setLocalClientNotificationsLastReadAt(effectiveLastReadAt);
    }
  }, [projectId, serverClientNotificationsLastReadAt, localClientNotificationsLastReadAt]);
  
  const isLoading = !project || !team || teamMember === undefined;
  const effectiveProject = project
    ? {
        ...project,
        clientNotificationsLastReadAt: Math.max(
          project.clientNotificationsLastReadAt ?? 0,
          localClientNotificationsLastReadAt ?? 0,
        ),
      }
    : project;

  const markClientNotificationsReadLocally = useCallback((lastReadAt: number) => {
    const normalizedLastReadAt = Number.isFinite(lastReadAt)
      ? lastReadAt
      : Date.now();
    setLocalClientNotificationsLastReadAt((currentValue) => {
      const nextValue = Math.max(currentValue ?? 0, normalizedLastReadAt);

      if (projectId) {
        const storageKey = getClientNotificationsStorageKey(projectId);
        window.localStorage.setItem(storageKey, String(nextValue));
      }

      return nextValue;
    });
  }, [projectId]);

  const value: ProjectContextType = {
    project: effectiveProject!,
    team: team || null,
    teamMember: teamMember || null,
    isLoading,
    markClientNotificationsReadLocally,
  };

  // Don't render children until we have the basic project data
  if (!project) {
    if (isLoaded && !organization?.id) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-muted/30">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground">Redirecting to onboarding...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="mb-6 flex items-center justify-center gap-3">
            <Building className="h-8 w-8 text-foreground animate-pulse" />
            <span className="text-2xl font-semibold text-foreground">Myvibe project</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-foreground rounded-full animate-bounce"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within ProjectProvider');
  }
  return context;
}
