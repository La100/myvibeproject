"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const projectGridClass = "grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";
  const hasProjects = filteredProjects.length > 0;

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="clean-title text-3xl font-medium tracking-tight">Projects</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Search, launch, and expand the projects that drive the campaign forward.
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
                  : "Create your first live project and start running execution from one place."}
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
    updatedAt?: number;
    createdAt?: number;
    taskCount: number;
    completedTasks: number;
  };
  onClick: () => void;
  onHover: () => void;
}) {
  const hasCoverImage = Boolean(project.coverImageUrl?.trim());
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
        <div
          className={cn(
            "relative overflow-hidden rounded-[1rem] border border-border bg-card shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5",
            hasCoverImage ? "aspect-[1.92/1]" : "min-h-[9rem] sm:min-h-[10.5rem]",
          )}
        >
          {hasCoverImage ? (
            <>
              <Image
                src={project.coverImageUrl!}
                alt={`${project.name} cover image`}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-stone-100 via-white to-stone-50" />
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
          <div className="min-w-0 space-y-1.5">
            <p className="line-clamp-2 text-sm font-normal leading-tight tracking-tight text-foreground sm:text-base">
              {project.name}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-muted-foreground">
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
