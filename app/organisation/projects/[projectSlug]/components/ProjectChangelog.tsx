"use client";

import { useQuery } from "convex/react";
import { History } from "lucide-react";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { cn } from "@/lib/utils";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import {
  ActivityChangelog,
  ActivityChangelogSkeleton,
} from "@/components/shared/ActivityChangelog";

type ProjectChangelogProps = {
  enabled?: boolean;
  showHeader?: boolean;
  className?: string;
};

export { ActivityChangelogSkeleton as ProjectChangelogSkeleton };

export function ProjectChangelog({
  enabled = true,
  showHeader = true,
  className,
}: ProjectChangelogProps) {
  const { project } = useProject();
  const activities = useQuery(
    apiAny.activityLog.getForProject,
    enabled ? { projectId: project._id } : "skip",
  );

  if (!enabled) {
    return null;
  }

  return (
    <div className={cn(className)}>
      {showHeader ? (
        <div className="px-4 lg:px-0">
          <ProjectPageHeader
            title="Project Changelog"
            icon={<History className="h-8 w-8 text-primary" />}
            subtitle={`Complete activity history for ${project.name}`}
          />
        </div>
      ) : null}

      <ActivityChangelog
        activities={activities}
        title="Project activity"
        collapsedLabel="Expand to load activities"
        emptyMessage="Activity will appear here as team members work on the project"
      />
    </div>
  );
}
