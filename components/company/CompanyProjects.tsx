/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { enUS, pl } from "date-fns/locale";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { apiAny } from "@/lib/convexApiAny";
import {
  Archive,
  Plus,
  FolderOpen,
  ExternalLink,
  MoreHorizontal,
  RotateCcw,
  Search,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";

type ProjectStatus =
  | "active"
  | "planning"
  | "on_hold"
  | "completed"
  | "cancelled"
  | "archived";
type ProjectSort = "recent_activity" | "date_created";
type ProjectView = "active" | "archived";


export default function CompanyProjects() {
  const router = useRouter();
  const { organization } = useOrganization();
  const { locale, t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<ProjectSort>("recent_activity");
  const [projectView, setProjectView] = useState<ProjectView>("active");
  const demoSeedAttemptedOrgIdRef = useRef<string | null>(null);
  const updateProject = useMutation(apiAny.projects.updateProject);
  const ensureCurrentUserTeamMembership = useMutation(
    apiAny.teamMembership.ensureCurrentUserTeamMembership,
  );

  const projects = useQuery(
    apiAny.projects.listProjectsByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip",
  );
  const teamSettings = useQuery(
    apiAny.teams.getTeamSettingsByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip",
  );

  const filteredProjects = useMemo(
    () => {
      return (
        projects
          ?.filter((project) => {
            const query = searchQuery.toLowerCase();
            const isArchived = project.status === "archived";
            if (projectView === "archived" ? !isArchived : isArchived) {
              return false;
            }
            return (
              project.name.toLowerCase().includes(query) ||
              project.description?.toLowerCase().includes(query) ||
              project.customer?.toLowerCase().includes(query)
            );
          })
          .sort((left, right) => {
            const leftRecentActivity =
              left.recentActivityAt ||
              (typeof left.updatedAt === "number" ? left.updatedAt : left._creationTime);
            const rightRecentActivity =
              right.recentActivityAt ||
              (typeof right.updatedAt === "number" ? right.updatedAt : right._creationTime);
            if (sortBy === "date_created") {
              return right._creationTime - left._creationTime;
            }

            return rightRecentActivity - leftRecentActivity;
          }) || []
      );
    },
    [projects, projectView, searchQuery, sortBy],
  );

  const projectGridClass = "grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";
  const hasProjects = filteredProjects.length > 0;
  const activeProjectCount =
    projects?.filter((project) => project.status !== "archived").length ?? 0;
  const archivedProjectCount =
    projects?.filter((project) => project.status === "archived").length ?? 0;

  useEffect(() => {
    if (
      !organization?.id ||
      projects === undefined ||
      projects.length > 0 ||
      teamSettings === undefined ||
      teamSettings === null ||
      teamSettings.demoProjectSeeded ||
      demoSeedAttemptedOrgIdRef.current === organization.id
    ) {
      return;
    }

    demoSeedAttemptedOrgIdRef.current = organization.id;
    void ensureCurrentUserTeamMembership({
      clerkOrgId: organization.id,
      orgName: organization.name,
      locale,
    }).catch((error) => {
      demoSeedAttemptedOrgIdRef.current = null;
      console.error("Failed to repair demo project seed", error);
    });
  }, [
    ensureCurrentUserTeamMembership,
    locale,
    organization?.id,
    organization?.name,
    projects,
    teamSettings,
  ]);

  const handleArchiveToggle = async (project: {
    _id: string;
    status?: ProjectStatus;
  }) => {
    const nextStatus = project.status === "archived" ? "active" : "archived";

    try {
      await updateProject({
        projectId: project._id,
        status: nextStatus,
      });
      toast.success(
        nextStatus === "archived"
          ? t("companyProjects", "projectArchived")
          : t("companyProjects", "projectRestored"),
      );
      if (nextStatus === "archived") {
        setProjectView("archived");
      }
    } catch (error) {
      toast.error(t("companyProjects", "projectArchiveFailed"), {
        description: toUserFacingErrorMessage(error),
      });
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="clean-title text-3xl font-medium tracking-tight">
            {t("companyProjects", "title")}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t("companyProjects", "sortBy")}
            </span>
            <Select
              value={sortBy}
              onValueChange={(value) => setSortBy(value as ProjectSort)}
            >
              <SelectTrigger className="h-9 min-w-[12rem] rounded-xl border-border/80 bg-card shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="recent_activity">
                  {t("companyProjects", "sortRecentActivity")}
                </SelectItem>
                <SelectItem value="date_created">
                  {t("companyProjects", "sortDateCreated")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("companyProjects", "searchPlaceholder")}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-9 w-52 rounded-xl pl-9 text-sm md:w-64"
            />
          </div>
          <Button
            onClick={() => router.push("/organisation/projects/new")}
            className="h-9 rounded-xl px-4"
          >
            {t("companyProjects", "createProject")}
          </Button>
        </div>
      </div>

      <Tabs
        value={projectView}
        onValueChange={(value) => setProjectView(value as ProjectView)}
        className="gap-0"
      >
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl bg-secondary/55 p-1 sm:w-fit">
          <TabsTrigger value="active" className="px-4">
            {t("companyProjects", "activeProjectsTab", {
              count: activeProjectCount,
            })}
          </TabsTrigger>
          <TabsTrigger value="archived" className="px-4">
            {t("companyProjects", "archivedProjectsTab", {
              count: archivedProjectCount,
            })}
          </TabsTrigger>
        </TabsList>
      </Tabs>

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
                  slug: project.slug,
                  customer: project.customer,
                  location: project.location,
                  budget: project.budget,
                  currency: project.currency,
                  status: project.status as ProjectStatus,
                  recentActivityAt:
                    typeof project.recentActivityAt === "number"
                      ? project.recentActivityAt
                      : undefined,
                  updatedAt: typeof project.updatedAt === "number" ? project.updatedAt : undefined,
                  createdAt: project._creationTime,
                  taskCount: project.taskCount || 0,
                  completedTasks: project.completedTasks || 0,
                }}
                locale={locale}
                onClick={() => router.push(`/organisation/projects/${project.slug}`)}
                onHover={() => router.prefetch(`/organisation/projects/${project.slug}`)}
                onArchiveToggle={() =>
                  void handleArchiveToggle({
                    _id: project._id,
                    status: project.status as ProjectStatus,
                  })
                }
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
                className="mb-3 size-14 rounded-2xl bg-white [&_svg:not([class*='size-'])]:size-8"
              >
                <FolderOpen strokeWidth={1.5} />
              </EmptyMedia>
              <EmptyTitle className="text-2xl font-semibold tracking-tight md:text-3xl">
                {searchQuery
                  ? t("companyProjects", "noMatchingProjects")
                  : projectView === "archived"
                    ? t("companyProjects", "noArchivedProjects")
                    : t("companyProjects", "noProjectsYet")}
              </EmptyTitle>
              <EmptyDescription className="max-w-lg text-base/relaxed md:text-lg/relaxed">
                {searchQuery
                  ? t("companyProjects", "noMatchingProjectsDescription")
                  : projectView === "archived"
                    ? t("companyProjects", "noArchivedProjectsDescription")
                    : t("companyProjects", "noProjectsYetDescription")}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row flex-wrap justify-center gap-3 text-base">
              {projectView === "active" ? (
                <Button
                  onClick={() => router.push("/organisation/projects/new")}
                  size="lg"
                  className="h-12 rounded-xl px-6 text-base"
                >
                  <Plus className="h-5 w-5" />
                  {t("companyProjects", "createProject")}
                </Button>
              ) : null}
              {searchQuery ? (
                <Button
                  onClick={() => setSearchQuery("")}
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-xl px-6 text-base"
                >
                  {t("companyProjects", "clearSearch")}
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
  onArchiveToggle,
  locale,
}: {
  project: {
    name: string;
    description?: string;
    coverImageUrl?: string;
    slug: string;
    customer?: string;
    location?: string;
    budget?: number;
    currency?: string;
    status?: ProjectStatus;
    recentActivityAt?: number;
    updatedAt?: number;
    createdAt?: number;
    taskCount: number;
    completedTasks: number;
  };
  onClick: () => void;
  onHover: () => void;
  onArchiveToggle: () => void;
  locale: Locale;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const hasCoverImage = Boolean(project.coverImageUrl?.trim());
  const statusMeta: Record<
    ProjectStatus,
    { dotClassName: string; textClassName: string }
  > = {
    active: {
      dotClassName: "bg-primary",
      textClassName: "text-primary",
    },
    planning: {
      dotClassName: "bg-accent",
      textClassName: "text-accent",
    },
    on_hold: {
      dotClassName: "bg-accent",
      textClassName: "text-accent",
    },
    completed: {
      dotClassName: "bg-primary",
      textClassName: "text-primary",
    },
    cancelled: {
      dotClassName: "bg-primary",
      textClassName: "text-primary",
    },
    archived: {
      dotClassName: "bg-muted-foreground",
      textClassName: "text-muted-foreground",
    },
  };

  const getStatusLabel = (status: ProjectStatus) => {
    switch (status) {
      case "active":
        return t("companyProjects", "statusActive");
      case "planning":
        return t("companyProjects", "statusPlanning");
      case "on_hold":
        return t("companyProjects", "statusOnHold");
      case "completed":
        return t("companyProjects", "statusCompleted");
      case "cancelled":
        return t("companyProjects", "statusCancelled");
      case "archived":
        return t("companyProjects", "statusArchived");
      default:
        return t("companyProjects", "statusUnknown");
    }
  };
  const lastEditedAt = project.recentActivityAt ?? project.updatedAt ?? project.createdAt;
  const editedLabel = lastEditedAt
    ? t("companyProjects", "editedDistance", {
        distance: formatDistanceToNow(new Date(lastEditedAt), {
          addSuffix: true,
          locale: locale === "pl" ? pl : enUS,
        }),
      })
    : null;
  const projectBasePath = `/organisation/projects/${project.slug}`;

  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      className="group h-full w-full cursor-pointer"
    >
      <article className="flex h-full flex-col gap-4">
        <div className="relative aspect-[1.68/1] overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5">
          {hasCoverImage ? (
            <>
              <img
                src={project.coverImageUrl!}
                alt={t("companyProjects", "coverImageAlt", {
                  name: project.name,
                })}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-background" />
              <div className="absolute inset-0 bg-gradient-to-br from-card via-card/70 to-background" />
              <div className="absolute inset-0 bg-gradient-to-tl from-card via-transparent to-card/85" />
            </>
          )}
          <div className="relative flex h-full items-start p-4 sm:p-5 md:p-6">
            <h3
              className={cn(
                "max-w-[11ch] text-[clamp(1.625rem,2.35vw,2.5rem)] font-normal leading-[1.05] tracking-tight",
                hasCoverImage ? "text-white" : "text-foreground",
              )}
            >
              {project.name}
            </h3>
          </div>
        </div>
        <div className="flex flex-1 items-start justify-between gap-4 px-1">
          <div className="min-w-0 flex flex-col gap-1.5">
            <p className="line-clamp-2 text-sm font-normal leading-tight tracking-tight text-foreground sm:text-base">
              {project.name}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-muted-foreground">
              {project.status ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-2",
                    statusMeta[project.status].textClassName,
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-2.5 w-2.5 shrink-0 rounded-sm",
                      statusMeta[project.status].dotClassName,
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("companyProjects", "projectActions")}
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                  onClick={(event) => event.stopPropagation()}
                >
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 rounded-xl border-border/80 bg-popover"
                onClick={(event) => event.stopPropagation()}
              >
                <DropdownMenuItem
                  onSelect={() => {
                    router.push(projectBasePath);
                  }}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {t("companyProjects", "openProject")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    router.push(`${projectBasePath}/settings`);
                  }}
                >
                  <Settings2 className="mr-2 h-4 w-4" />
                  {t("companyProjects", "projectSettings")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    router.push(`${projectBasePath}/customer-panel`);
                  }}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t("companyProjects", "clientPanel")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    onArchiveToggle();
                  }}
                >
                  {project.status === "archived" ? (
                    <RotateCcw className="mr-2 h-4 w-4" />
                  ) : (
                    <Archive className="mr-2 h-4 w-4" />
                  )}
                  {project.status === "archived"
                    ? t("companyProjects", "restoreProject")
                    : t("companyProjects", "archiveProject")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </article>
    </div>
  );
}
