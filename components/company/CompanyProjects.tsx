"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { apiAny } from "@/lib/convexApiAny";
import {
  Plus,
  FolderOpen,
  Search,
  ListFilter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";

type ProjectStatus = "active" | "planning" | "on_hold" | "completed" | "cancelled";


export default function CompanyProjects() {
  const router = useRouter();
  const { organization } = useOrganization();
  const [searchQuery, setSearchQuery] = useState("");

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

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="clean-title text-4xl font-medium tracking-tight">Projects</h1>

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
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl">
            <ListFilter className="h-4 w-4" />
          </Button>
          <Button
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
              className="w-full md:max-w-[30rem] xl:max-w-none"
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
                  : "Create your first project to start collaborating with your team and clients."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row flex-wrap justify-center gap-3 text-base">
              <Button
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

  const showCoverImage = Boolean(project.coverImageUrl && !coverImageFailed);
  const projectInitials = getProjectInitials(project.name);

  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      className="group w-full cursor-pointer"
    >
      <Card className="overflow-hidden border-border transition-transform duration-200 group-hover:-translate-y-0.5">
        <div className="relative aspect-[5/4] overflow-hidden bg-muted md:aspect-[16/10] xl:aspect-[4/3]">
          {showCoverImage ? (
            <>
              <img
                src={project.coverImageUrl}
                alt={project.name}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                onError={() => setCoverImageFailed(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
                <div className="max-w-[24rem]">
                  <p className="text-lg font-medium leading-snug text-background line-clamp-3">
                    {project.name}
                  </p>
                  {project.description ? (
                    <p className="mt-1.5 line-clamp-2 text-xs text-background/80">
                      {project.description}
                    </p>
                  ) : null}
                </div>
                {project.status ? (
                  <span
                    className={cn(
                      "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
                      statusDotClasses[project.status],
                    )}
                  />
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col justify-between p-5">
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

              <div className="max-w-[24rem]">
                <p className="text-xl font-medium leading-tight tracking-tight text-foreground">
                  {project.name}
                </p>
                {project.description ? (
                  <p className="mt-2 line-clamp-2 max-w-[20rem] text-sm leading-6 text-muted-foreground">
                    {project.description}
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </div>
        <CardContent className="flex flex-col gap-1 p-4 pt-3">
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
