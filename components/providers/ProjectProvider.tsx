"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, ReactNode, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Doc } from "@/convex/_generated/dataModel";
import { AppLoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { useParams, useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { postAuthResolverUrl } from "@/lib/authRedirects";
import { useI18n } from "@/lib/i18n";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/safeLocalStorage";

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
  const { t } = useI18n();
  const params = useParams<{ projectSlug: string }>();
  const { organization, isLoaded } = useOrganization();
  const [localClientNotificationsLastReadAt, setLocalClientNotificationsLastReadAt] =
    useState<number | null>(null);

  useEffect(() => {
    if (isLoaded && !organization?.id) {
      router.replace(postAuthResolverUrl);
    }
  }, [isLoaded, organization?.id, router]);
  
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
  const clientNotificationsReadState = useQuery(
    apiAny.projects.getMyClientNotificationsReadState,
    project ? { projectId: project._id } : "skip",
  );
  const projectId = project ? String(project._id) : null;
  const serverClientNotificationsLastReadAt =
    clientNotificationsReadState?.lastReadAt ?? project?.clientNotificationsLastReadAt ?? 0;

  useEffect(() => {
    if (!projectId) {
      return;
    }

    const storageKey = getClientNotificationsStorageKey(projectId);
    const storedValue = safeLocalStorageGet(storageKey);
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

    safeLocalStorageSet(storageKey, String(effectiveLastReadAt));

    if (effectiveLastReadAt !== localClientNotificationsLastReadAt) {
      setLocalClientNotificationsLastReadAt(effectiveLastReadAt);
    }
  }, [projectId, serverClientNotificationsLastReadAt, localClientNotificationsLastReadAt]);
  
  const isLoading = project === undefined || !team || teamMember === undefined;
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
        safeLocalStorageSet(storageKey, String(nextValue));
      }

      return nextValue;
    });
  }, [projectId]);

  if (project === undefined) {
    if (isLoaded && !organization?.id) {
      return (
        <AppLoadingState
          variant="screen"
          title={t("projectProvider", "openingWorkspaceSetup")}
          description={t("projectProvider", "redirectingToWorkspaceSelection")}
          className="fixed inset-0 bg-background/95"
        />
      );
    }

    return (
      <AppLoadingState
        variant="screen"
        title=""
        className="fixed inset-0 bg-background/95"
      />
    );
  }

  if (project === null) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-5">
        <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-semibold text-foreground">
              Nie znaleziono projektu
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Projekt nie istnieje albo nie masz do niego dostępu w aktywnej organizacji.
            </p>
          </div>
          <Button asChild>
            <Link href="/organisation">Wróć do projektów</Link>
          </Button>
        </div>
      </div>
    );
  }

  const value: ProjectContextType = {
    project: effectiveProject,
    team: team || null,
    teamMember: teamMember || null,
    isLoading,
    markClientNotificationsReadLocally,
  };

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
