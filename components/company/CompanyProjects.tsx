"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { apiAny } from "@/lib/convexApiAny";
import {
  CheckCircle2,
  Plus,
  FolderOpen,
  Rocket,
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
  Card,
  CardContent,
} from "@/components/ui/card";
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
  const [questsHidden, setQuestsHidden] = useState(false);

  const projects = useQuery(
    apiAny.projects.listProjectsByClerkOrg,
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

  const projectGridClass = "grid grid-cols-1 justify-items-start gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";
  const hasProjects = filteredProjects.length > 0;
  const totalProjects = projects?.length ?? 0;
  const completedTasks = useMemo(
    () => (projects ?? []).reduce((sum, project) => sum + (project.completedTasks || 0), 0),
    [projects],
  );
  const organizationImageReady = Boolean(organization?.hasImage && organization.imageUrl);

  useEffect(() => {
    const syncJourney = () => {
      setExtensionReady(readOnboardingFlag(ONBOARDING_EXTENSION_READY_KEY));
      setQuestsHidden(readOnboardingFlag(ONBOARDING_DASHBOARD_QUESTS_HIDDEN_KEY));
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
        title: "Close your first execution task",
        description: "Complete at least one task to prove the workspace is live.",
        xp: 15,
        done: completedTasks > 0,
        action: () => {
          if (projects?.[0]?.slug) {
            router.push(`/organisation/projects/${projects[0].slug}`);
            return;
          }
          router.push("/organisation/projects/new");
        },
        actionLabel: completedTasks > 0 ? "Done" : totalProjects > 0 ? "Open workspace" : "Create project",
      },
    ],
    [completedTasks, extensionReady, organizationImageReady, projects, router, totalProjects],
  );

  const dashboardXpTotal = dashboardQuests.reduce((sum, quest) => sum + quest.xp, 0);
  const dashboardXpEarned = dashboardQuests.reduce((sum, quest) => sum + (quest.done ? quest.xp : 0), 0);
  const questCompletionCount = dashboardQuests.filter((quest) => quest.done).length;
  const showQuestBoard = !questsHidden && questCompletionCount < dashboardQuests.length;

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
          <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
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
                <Button onClick={() => router.push("/organisation/projects/new")} className="rounded-xl">
                  <Rocket className="mr-2 h-4 w-4" />
                  Create project
                </Button>
                <GuidedTourLauncher tourId="workspace" label="Take workspace tour" className="rounded-xl" />
                <Button
                  variant="outline"
                  onClick={() => router.push("/organisation/settings#organization-profile")}
                  className="rounded-xl"
                >
                  <Target className="mr-2 h-4 w-4" />
                  Set organization image
                </Button>
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
              {dashboardQuests.map((quest) => (
                <div
                  key={quest.id}
                  className={cn(
                    "rounded-2xl border px-4 py-3 transition-colors",
                    quest.done ? "border-primary/35 bg-primary/5" : "border-border/70 bg-background",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={quest.done ? "default" : "outline"}>
                          {quest.done ? "Done" : "Open"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">+{quest.xp} XP</span>
                      </div>
                      <p className="text-sm font-medium">{quest.title}</p>
                      <p className="text-sm text-muted-foreground">{quest.description}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={quest.done ? "outline" : "default"}
                      onClick={quest.action}
                      disabled={quest.done && quest.id !== "dashboard-extension"}
                      className="rounded-xl"
                    >
                      {quest.done ? <CheckCircle2 className="mr-2 h-4 w-4" /> : null}
                      {quest.actionLabel}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : questCompletionCount < dashboardQuests.length ? (
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
              className="h-full w-full md:max-w-[30rem] xl:max-w-none"
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
    taskCount: number;
    completedTasks: number;
  };
  onClick: () => void;
  onHover: () => void;
}) {
  const statusDotClasses: Record<ProjectStatus, string> = {
    active: "bg-primary",
    planning: "bg-muted-foreground",
    on_hold: "bg-muted-foreground",
    completed: "bg-primary",
    cancelled: "bg-destructive",
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

  const [coverImageFailed, setCoverImageFailed] = useState(false);

  useEffect(() => {
    setCoverImageFailed(false);
  }, [project.coverImageUrl]);

  const coverImageSrc = project.coverImageUrl ?? "";
  const showCoverImage = Boolean(coverImageSrc && !coverImageFailed);
  const projectInitials = getProjectInitials(project.name);

  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      className="group h-full w-full cursor-pointer"
    >
      <Card className="h-full gap-0 overflow-hidden border-border py-0 shadow-none transition-transform duration-200 group-hover:-translate-y-0.5">
        <div className="relative aspect-[5/4] overflow-hidden bg-muted md:aspect-[16/10] xl:aspect-[4/3]">
          {showCoverImage ? (
            <Image
              src={coverImageSrc}
              alt={project.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              onError={() => setCoverImageFailed(true)}
            />
          ) : (
            <div className="flex h-full flex-col p-5">
              <div className="flex items-start justify-between gap-4">
                {(project.location || project.customer) ? (
                  <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {project.location || project.customer}
                  </span>
                ) : <span />}
                {project.status ? (
                  <span
                    className={cn(
                      "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
                      statusDotClasses[project.status],
                    )}
                  />
                ) : null}
              </div>

              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-background text-xl font-semibold tracking-tight text-foreground">
                    {projectInitials}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <CardContent className="flex flex-1 flex-col gap-1 p-4">
          <p className="line-clamp-3 text-lg font-medium leading-snug text-foreground">
            {project.name}
          </p>
          {project.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {project.description}
            </p>
          ) : null}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {project.status ? (
              <>
                <span
                  className={cn(
                    "inline-block h-2 w-2 rounded-full",
                    statusDotClasses[project.status],
                  )}
                />
                <span>{getStatusLabel(project.status)}</span>
              </>
            ) : null}
            {project.customer ? (
              <>
                <span className="mx-0.5">·</span>
                <span className="line-clamp-1">{project.customer}</span>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getProjectInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "PR";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}
