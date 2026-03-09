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
import { EmptyState } from "@/components/ui/empty-state";
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

  return (
    <div className="space-y-6">
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

      <div className={projectGridClass}>
        {projects === undefined ? null : filteredProjects.length > 0 ? (
          filteredProjects.map((project, index) => (
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
          ))
        ) : (
          <div className="col-span-full">
            <EmptyState
              icon={FolderOpen}
              title={searchQuery ? "No matching projects" : "No projects yet"}
              description={
                searchQuery
                  ? "Try a different search phrase or create a new project."
                  : "Create your first project to start collaborating with your team and clients."
              }
              className="py-20"
              action={{
                label: "Create Project",
                onClick: () => router.push("/organisation/projects/new"),
                icon: Plus,
              }}
              secondaryAction={
                searchQuery
                  ? {
                      label: "Clear search",
                      onClick: () => setSearchQuery(""),
                    }
                  : undefined
              }
            />
          </div>
        )}
      </div>
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
  const getStatusDotClass = (status: ProjectStatus) => {
    switch (status) {
      case "active":
        return "bg-blue-500";
      case "planning":
        return "bg-neutral-400";
      case "on_hold":
        return "bg-amber-500";
      case "completed":
        return "bg-emerald-500";
      case "cancelled":
        return "bg-red-500";
      default:
        return "bg-neutral-300";
    }
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
      <div
        className={cn(
          "relative aspect-[5/4] overflow-hidden rounded-lg border transition-shadow group-hover:shadow-md md:aspect-[16/10] xl:aspect-[4/3]",
          showCoverImage
            ? "border-border bg-muted/40 p-4"
            : "border-border bg-card p-5",
        )}
      >
        {showCoverImage ? (
          <>
            <img
              src={project.coverImageUrl}
              alt={project.name}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              onError={() => setCoverImageFailed(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/35 to-black/5" />
            <div className="relative z-10 mt-auto flex h-full flex-col justify-end">
              <p className="text-lg font-medium leading-snug line-clamp-3 text-[var(--overlay-foreground)]">{project.name}</p>
              {project.description ? (
                <p className="mt-1.5 text-xs text-[var(--overlay-foreground-muted)] line-clamp-2">{project.description}</p>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--card)_94%,white_6%)_0%,color-mix(in_oklab,var(--muted)_62%,var(--card)_38%)_100%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_oklab,white_90%,transparent)_0%,transparent_34%)]" />
              <div className="absolute inset-0 opacity-[0.55] bg-[linear-gradient(135deg,transparent_0%,transparent_64%,color-mix(in_oklab,var(--foreground)_3%,transparent)_64%,color-mix(in_oklab,var(--foreground)_3%,transparent)_65%,transparent_65%,transparent_100%)]" />
              <div className="absolute inset-0 opacity-[0.35] bg-[linear-gradient(to_right,color-mix(in_oklab,var(--foreground)_3%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--foreground)_2.5%,transparent)_1px,transparent_1px)] [background-size:32px_32px]" />
              <div className="absolute -bottom-4 right-4 text-[5.5rem] font-semibold tracking-[-0.08em] text-foreground/[0.05]">
                {projectInitials}
              </div>
            </div>

            <div className="relative z-10 flex h-full flex-col">
              <div className="flex items-start justify-between gap-4">
                {(project.location || project.customer) ? (
                  <span className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur-sm">
                    {project.location || project.customer}
                  </span>
                ) : (
                  <span />
                )}
              </div>

              <div className="mt-auto max-w-[24rem]">
                <p className="text-xl font-medium leading-tight tracking-tight text-foreground">
                  {project.name}
                </p>
                {project.description ? (
                  <p className="mt-2 max-w-[20rem] text-sm leading-6 text-muted-foreground line-clamp-2">
                    {project.description}
                  </p>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground line-clamp-1">{project.name}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {project.status ? (
          <>
            <span className={cn("inline-block h-2 w-2 rounded-sm", getStatusDotClass(project.status))} />
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
