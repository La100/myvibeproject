"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { apiAny } from "@/lib/convexApiAny";
import {
  Plus,
  FolderOpen,
  MoreHorizontal,
  Search,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  ONBOARDING_DASHBOARD_QUESTS_HIDDEN_KEY,
  ONBOARDING_EXTENSION_READY_KEY,
  readOnboardingFlag,
  writeOnboardingFlag,
} from "@/lib/onboardingJourney";
import { GuidedTourLauncher } from "@/components/tours/GuidedTourHost";
import { cn } from "@/lib/utils";

type ProjectStatus = "active" | "planning" | "on_hold" | "completed" | "cancelled";


export default function CompanyProjects() {
  const router = useRouter();
  const { organization } = useOrganization();
  const [searchQuery, setSearchQuery] = useState("");
  const [extensionReady, setExtensionReady] = useState(false);
  const [journeyStateReady, setJourneyStateReady] = useState(false);
  const [questsHidden, setQuestsHidden] = useState(false);

  const projects = useQuery(
    apiAny.projects.listProjectsByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip",
  );
  const teamSettings = useQuery(
    apiAny.teams.getTeamSettingsByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip",
  );

  const filteredProjects = useMemo(
    () =>
      projects?.filter((project) => {
        const query = searchQuery.toLowerCase();
        return (
          project.name.toLowerCase().includes(query) ||
          project.description?.toLowerCase().includes(query) ||
          project.customer?.toLowerCase().includes(query)
        );
      }) || [],
    [projects, searchQuery],
  );

  const projectGridClass = "grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";
  const hasProjects = filteredProjects.length > 0;
  const totalProjects = projects?.length ?? 0;
  const hasCreatedTask = useMemo(
    () => (projects ?? []).some((project) => (project.taskCount || 0) > 0 || (project.completedTasks || 0) > 0),
    [projects],
  );
  const organizationImageReady = Boolean(teamSettings?.imageUrl?.trim() || organization?.imageUrl || organization?.hasImage);

  useEffect(() => {
    const syncJourney = () => {
      setExtensionReady(readOnboardingFlag(ONBOARDING_EXTENSION_READY_KEY));
      setQuestsHidden(readOnboardingFlag(ONBOARDING_DASHBOARD_QUESTS_HIDDEN_KEY));
      setJourneyStateReady(true);
    };

    syncJourney();
    window.addEventListener("storage", syncJourney);
    window.addEventListener("focus", syncJourney);
    return () => {
      window.removeEventListener("storage", syncJourney);
      window.removeEventListener("focus", syncJourney);
    };
  }, []);

  const dashboardQuests = useMemo(
    () => [
      {
        id: "dashboard-project",
        title: "Create your first project",
        description: "Open a live workspace for files, tasks, and AI flows.",
        xp: 40,
        done: totalProjects > 0,
        action: () => router.push("/organisation/projects/new"),
        actionLabel: totalProjects > 0 ? "Done" : "Create project",
      },
      {
        id: "dashboard-org-image",
        title: "Add organization image",
        description: "Upload the Clerk organization image shown in the workspace sidebar.",
        xp: 25,
        done: organizationImageReady,
        action: () => router.push("/organisation/settings#organization-profile"),
        actionLabel: organizationImageReady ? "Done" : "Open settings",
      },
      {
        id: "dashboard-extension",
        title: "Enable Chrome Clipper",
        description: "Capture products and references straight from the web.",
        xp: 20,
        done: extensionReady,
        action: () => {
          if (typeof window !== "undefined") {
            window.open("/auth/extension", "_blank", "noopener,noreferrer");
          }
        },
        actionLabel: extensionReady ? "Ready" : "Connect clipper",
      },
      {
        id: "dashboard-delivery",
        title: "Create your first task",
        description: "Add at least one task to prove the workspace is live.",
        xp: 15,
        done: hasCreatedTask,
        action: () => {
          if (projects?.[0]?.slug) {
            router.push(`/organisation/projects/${projects[0].slug}/tasks?createTask=1`);
            return;
          }
          router.push("/organisation/projects/new");
        },
        actionLabel: hasCreatedTask ? "Done" : totalProjects > 0 ? "Create task" : "Create project",
      },
    ],
    [extensionReady, hasCreatedTask, organizationImageReady, projects, router, totalProjects],
  );

  const dashboardXpTotal = dashboardQuests.reduce((sum, quest) => sum + quest.xp, 0);
  const dashboardXpEarned = dashboardQuests.reduce((sum, quest) => sum + (quest.done ? quest.xp : 0), 0);
  const questCompletionCount = dashboardQuests.filter((quest) => quest.done).length;
  const openDashboardQuests = dashboardQuests.filter((quest) => !quest.done);
  const compactQuestLayout = openDashboardQuests.length <= 2;
  const dashboardQuestDataReady =
    journeyStateReady &&
    projects !== undefined &&
    teamSettings !== undefined;
  const canRenderQuestBoard = dashboardQuestDataReady && questCompletionCount < dashboardQuests.length;
  const showQuestBoard = canRenderQuestBoard && !questsHidden;

  const dismissQuestBoard = () => {
    setQuestsHidden(true);
    writeOnboardingFlag(ONBOARDING_DASHBOARD_QUESTS_HIDDEN_KEY, true);
  };

  const reopenQuestBoard = () => {
    setQuestsHidden(false);
    writeOnboardingFlag(ONBOARDING_DASHBOARD_QUESTS_HIDDEN_KEY, false);
  };

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-6">
      {showQuestBoard ? (
        <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-gradient-to-br from-background via-background to-muted/35">
          <div className={cn("grid gap-6 p-6 lg:p-8", !compactQuestLayout ? "lg:grid-cols-[1.15fr_0.85fr]" : "")}>
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <Badge variant="secondary" className="w-fit">
                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                    Workspace quests
                  </Badge>
                  <div className="space-y-2">
                    <h1 className="clean-title text-3xl font-medium tracking-tight md:text-4xl">
                      Finish the setup, then this disappears
                    </h1>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                      These are the onboarding quests. You can skip them now, but they still show the
                      fastest path through organization setup and execution.
                    </p>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={dismissQuestBoard} className="rounded-xl">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Skip onboarding quests</span>
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-1">
                <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Progress</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight">{questCompletionCount}/4</p>
                  <p className="mt-1 text-sm text-muted-foreground">{dashboardXpEarned}/{dashboardXpTotal} XP</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Quest progress</span>
                  <span className="text-muted-foreground">
                    {questCompletionCount}/{dashboardQuests.length} quests closed
                  </span>
                </div>
                <Progress value={dashboardXpEarned} max={dashboardXpTotal} className="h-2.5" />
              </div>

              <div className="flex flex-wrap gap-2">
                {openDashboardQuests.slice(0, 2).map((quest, index) => (
                  <Button
                    key={quest.id}
                    variant={index === 0 ? "default" : "outline"}
                    onClick={quest.action}
                    className="rounded-xl"
                  >
                    {quest.actionLabel}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  onClick={dismissQuestBoard}
                  className="rounded-xl text-muted-foreground"
                >
                  Skip for now
                </Button>
              </div>
            </div>

            <div className="space-y-3 rounded-[1.5rem] border border-border/70 bg-background/85 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4" />
                Active quests
              </div>
              {openDashboardQuests.map((quest) => (
                <div
                  key={quest.id}
                  className="rounded-2xl border border-border/70 bg-background px-4 py-3 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Open</Badge>
                        <span className="text-xs text-muted-foreground">+{quest.xp} XP</span>
                      </div>
                      <p className="text-sm font-medium">{quest.title}</p>
                      <p className="text-sm text-muted-foreground">{quest.description}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={quest.action}
                      className="rounded-xl"
                    >
                      {quest.actionLabel}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : canRenderQuestBoard ? (
        <div className="flex justify-end">
          <div className="flex gap-2">
            <GuidedTourLauncher tourId="workspace" label="Take workspace tour" variant="outline" className="rounded-xl" />
            <Button type="button" variant="outline" onClick={reopenQuestBoard} className="rounded-xl">
              <Sparkles className="mr-2 h-4 w-4" />
              Show onboarding quests
            </Button>
          </div>
        </div>
      ) : null}

      <div data-tour="workspace-projects-section" className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="clean-title text-3xl font-medium tracking-tight">Projects</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Search, launch, and expand the workspaces that drive the campaign forward.
          </p>
        </div>

        <div className="flex items-center gap-2 md:justify-end">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-9 w-52 rounded-xl pl-9 text-sm md:w-64"
            />
          </div>
          <Button
            data-tour="workspace-create-project"
            onClick={() => router.push("/organisation/projects/new")}
            className="h-9 rounded-xl px-4"
          >
            Create Project
          </Button>
        </div>
      </div>

      {projects === undefined ? null : hasProjects ? (
        <div className={projectGridClass}>
          {filteredProjects.map((project, index) => (
            <motion.div
              key={project._id}
              className="h-full w-full"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
            >
              <ProjectCard
                project={{
                  name: project.name,
                  description: project.description,
                  coverImageUrl: project.coverImageDisplayUrl || project.coverImageUrl,
                  customer: project.customer,
                  location: project.location,
                  budget: project.budget,
                  currency: project.currency,
                  status: project.status as ProjectStatus,
                  updatedAt: typeof project.updatedAt === "number" ? project.updatedAt : undefined,
                  createdAt: project._creationTime,
                  taskCount: project.taskCount || 0,
                  completedTasks: project.completedTasks || 0,
                }}
                onClick={() => router.push(`/organisation/projects/${project.slug}`)}
                onHover={() => router.prefetch(`/organisation/projects/${project.slug}`)}
              />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <Empty className="mx-auto w-full max-w-2xl border-dashed py-24 md:py-28">
            <EmptyHeader className="max-w-xl gap-3">
              <EmptyMedia
                variant="icon"
                className="mb-3 size-14 rounded-2xl [&_svg:not([class*='size-'])]:size-8"
              >
                <FolderOpen strokeWidth={1.5} />
              </EmptyMedia>
              <EmptyTitle className="text-2xl font-semibold tracking-tight md:text-3xl">
                {searchQuery ? "No matching projects" : "No projects yet"}
              </EmptyTitle>
              <EmptyDescription className="max-w-lg text-base/relaxed md:text-lg/relaxed">
                {searchQuery
                  ? "Try a different search phrase or create a new project."
                  : "Create your first live workspace and start running execution from one place."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row flex-wrap justify-center gap-3 text-base">
              <Button
                data-tour="workspace-create-project-empty"
                onClick={() => router.push("/organisation/projects/new")}
                size="lg"
                className="h-12 rounded-xl px-6 text-base"
              >
                <Plus className="h-5 w-5" />
                Create Project
              </Button>
              {searchQuery ? (
                <Button
                  onClick={() => setSearchQuery("")}
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-xl px-6 text-base"
                >
                  Clear search
                </Button>
              ) : null}
            </EmptyContent>
          </Empty>
        </div>
      )}
    </div>
  );
}


function ProjectCard({
  project,
  onClick,
  onHover,
}: {
  project: {
    name: string;
    description?: string;
    coverImageUrl?: string;
    customer?: string;
    location?: string;
    budget?: number;
    currency?: string;
    status?: ProjectStatus;
    updatedAt?: number;
    createdAt?: number;
    taskCount: number;
    completedTasks: number;
  };
  onClick: () => void;
  onHover: () => void;
}) {
  const statusDotClasses: Record<ProjectStatus, string> = {
    active: "bg-muted-foreground",
    planning: "bg-muted-foreground",
    on_hold: "bg-muted-foreground",
    completed: "bg-muted-foreground",
    cancelled: "bg-muted-foreground",
  };

  const getStatusLabel = (status: ProjectStatus) => {
    switch (status) {
      case "active":
        return "Active";
      case "planning":
        return "Planned";
      case "on_hold":
        return "On Hold";
      case "completed":
        return "Completed";
      case "cancelled":
        return "Cancelled";
      default:
        return "Unknown";
    }
  };
  const lastEditedAt = project.updatedAt ?? project.createdAt;
  const editedLabel = lastEditedAt
    ? `Edited ${formatDistanceToNow(new Date(lastEditedAt), { addSuffix: true })}`
    : null;

  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      className="group h-full w-full cursor-pointer"
    >
      <article className="flex h-full flex-col gap-4">
        <div className="relative aspect-[1.92/1] overflow-hidden rounded-[1.35rem] border border-border bg-card shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5">
          <div className="relative flex h-full items-start p-4 sm:p-5 md:p-6">
            <h3 className="max-w-[11ch] text-[clamp(2rem,3vw,3.75rem)] font-normal leading-[1.02] tracking-tight text-muted-foreground">
              {project.name}
            </h3>
          </div>
        </div>
        <div className="flex flex-1 items-start justify-between gap-4 px-1">
          <div className="min-w-0 space-y-1.5">
            <p className="line-clamp-2 text-xl font-semibold leading-tight tracking-tight text-foreground sm:text-2xl">
              {project.name}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-muted-foreground">
              {project.status ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]",
                      statusDotClasses[project.status],
                    )}
                  />
                  <span>{getStatusLabel(project.status)}</span>
                </span>
              ) : null}
              {editedLabel ? (
                <>
                  <span aria-hidden="true">&middot;</span>
                  <span>{editedLabel}</span>
                </>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-start pt-0.5 text-muted-foreground">
            <MoreHorizontal className="h-5 w-5" />
          </div>
        </div>
      </article>
    </div>
  );
}
