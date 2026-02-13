"use client";

import { createContext, useContext, ReactNode, useEffect } from "react";
import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Doc } from "@/convex/_generated/dataModel";
import { useParams, useRouter } from "next/navigation";
import { Building } from "lucide-react";
import { useOrganization } from "@clerk/nextjs";

interface ProjectContextType {
  project: Doc<"projects">;
  team: Doc<"teams"> | null;
  permissions: {
    permissions?: {
      overview?: { visible: boolean };
      tasks?: { visible: boolean };
      surveys?: { visible: boolean };
      calendar?: { visible: boolean };
      files?: { visible: boolean };
      shopping_list?: { visible: boolean };
      settings?: { visible: boolean };
    };
  } | null;
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export function ProjectProvider({ children }: { 
  children: ReactNode; 
}) {
  const router = useRouter();
  const params = useParams<{ projectSlug: string }>();
  const { organization, isLoaded } = useOrganization();
  const onboardingStatus = useQuery(apiAny.onboarding.getStatus);

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
  
  const permissions = useQuery(apiAny.projects.getProjectSidebarPermissions, 
    project ? { projectId: project._id } : "skip"
  );

  const isLoading = !project || !team || !permissions;

  const value: ProjectContextType = {
    project: project!,
    team: team || null,
    permissions: permissions || null,
    isLoading,
  };

  // Don't render children until we have the basic project data
  if (!project) {
    if (isLoaded && !organization?.id) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-muted/30">
          <div className="text-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground">Redirecting to onboarding...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Building className="h-8 w-8 text-black animate-pulse" />
            <span className="text-2xl font-semibold text-black">Myvibe project</span>
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
