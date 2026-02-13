"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { apiAny } from "@/lib/convexApiAny";
import {
  Plus,
  FolderOpen,
  MapPin,
  DollarSign,
  Building2,
  Search,
  Play,
  Clock,
  Pause,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ProjectStatus = "active" | "planning" | "on_hold" | "completed" | "cancelled";

const formatCurrency = (amount: number, currency?: string) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function CompanyProjects() {
  const router = useRouter();
  const { organization, isLoaded } = useOrganization();
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

  const projectStats = useMemo(() => {
    const source = projects || [];

    return {
      total: source.length,
      active: source.filter((project) => project.status === "active").length,
      planning: source.filter((project) => project.status === "planning").length,
      completed: source.filter((project) => project.status === "completed").length,
    };
  }, [projects]);
  const projectGridClass = "grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]";

  if (!isLoaded) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Card key={idx}>
              <CardContent className="p-5">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-14" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className={projectGridClass}>
          {Array.from({ length: 6 }).map((_, idx) => (
            <Card key={idx}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Finish workspace setup</h1>
          <p className="text-sm text-muted-foreground">
            You need an active organization before creating projects and inviting clients.
          </p>
          <Button type="button" onClick={() => router.replace("/onboarding")} className="rounded-full px-6">
            Go to onboarding
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="clean-panel p-6 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="clean-title text-3xl font-medium tracking-tight md:text-4xl">Projects</h1>
            <p className="clean-subtitle mt-2 text-sm md:text-[15px]">
              Track delivery, budgets, and client progress from one place.
            </p>
          </div>
          <Button
            onClick={() => router.push("/organisation/projects/new")}
            className="px-6"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Total Projects" value={projectStats.total} />
        <StatsCard label="Active" value={projectStats.active} />
        <StatsCard label="Planning" value={projectStats.planning} />
        <StatsCard label="Completed" value={projectStats.completed} />
      </div>

      <div className="clean-surface relative rounded-2xl p-2">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by project name, client, or description..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="h-11 border-transparent bg-transparent pl-10 shadow-none focus-visible:border-border/70"
        />
      </div>

      <section className="clean-panel p-4 md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Project List</h2>
          <Badge variant="outline" className="bg-background/65 text-foreground">
            {projects ? filteredProjects.length : 0}
          </Badge>
        </div>
        <div className={projectGridClass}>
          {projects === undefined ? (
            Array.from({ length: 6 }).map((_, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-3 w-full mb-2" />
                  <Skeleton className="h-3 w-2/3" />
                </CardContent>
              </Card>
            ))
          ) : filteredProjects.length > 0 ? (
            filteredProjects.map((project, index) => (
              <motion.div
                key={project._id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.03 }}
              >
                <ProjectCard
                  project={{
                    name: project.name,
                    description: project.description,
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
                action={{
                  label: "New Project",
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
      </section>
    </div>
  );
}

function StatsCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-border/70 bg-card/85">
      <CardContent className="p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      </CardContent>
    </Card>
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
  const progress = project.taskCount > 0 ? (project.completedTasks / project.taskCount) * 100 : 0;

  const getStatusVariant = (
    status: ProjectStatus,
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "active":
        return "outline";
      case "planning":
        return "outline";
      case "on_hold":
        return "outline";
      case "completed":
        return "outline";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusClass = (status: ProjectStatus) => {
    switch (status) {
      case "active":
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
      case "planning":
        return "border-sky-200 bg-sky-50 text-sky-700";
      case "on_hold":
        return "border-amber-200 bg-amber-50 text-amber-700";
      case "completed":
        return "border-indigo-200 bg-indigo-50 text-indigo-700";
      case "cancelled":
        return "";
      default:
        return "";
    }
  };

  const getStatusIcon = (status: ProjectStatus) => {
    switch (status) {
      case "active":
        return <Play className="h-3 w-3" />;
      case "planning":
        return <Clock className="h-3 w-3" />;
      case "on_hold":
        return <Pause className="h-3 w-3" />;
      case "completed":
        return <CheckCircle2 className="h-3 w-3" />;
      case "cancelled":
        return <AlertCircle className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: ProjectStatus) => {
    switch (status) {
      case "active":
        return "Active";
      case "planning":
        return "Planning";
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

  return (
    <Card
      onClick={onClick}
      onMouseEnter={onHover}
      className="hover-lift cursor-pointer border-border bg-card shadow-sm ring-1 ring-black/[0.03]"
    >
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="line-clamp-1 text-lg">{project.name}</CardTitle>
          {project.status ? (
            <Badge
              variant={getStatusVariant(project.status)}
              className={cn("shrink-0 gap-1", getStatusClass(project.status))}
            >
              {getStatusIcon(project.status)}
              <span>{getStatusLabel(project.status)}</span>
            </Badge>
          ) : null}
        </div>
        {project.description ? (
          <CardDescription className="line-clamp-2">{project.description}</CardDescription>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm text-muted-foreground">
          {project.customer ? (
            <div className="flex items-center">
              <Building2 className="mr-2 h-4 w-4 shrink-0" />
              <span className="line-clamp-1">{project.customer}</span>
            </div>
          ) : null}
          {project.location ? (
            <div className="flex items-center">
              <MapPin className="mr-2 h-4 w-4 shrink-0" />
              <span className="line-clamp-1">{project.location}</span>
            </div>
          ) : null}
          {typeof project.budget === "number" ? (
            <div className="flex items-center">
              <DollarSign className="mr-2 h-4 w-4 shrink-0" />
              <span>{formatCurrency(project.budget, project.currency)}</span>
            </div>
          ) : null}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-xs text-muted-foreground">
              {project.completedTasks}/{project.taskCount} tasks
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/75">
            <div
              className="h-2 rounded-full bg-primary/90 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
