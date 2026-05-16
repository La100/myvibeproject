"use client";

import { useQuery } from "convex/react";
import { History } from "lucide-react";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { cn } from "@/lib/utils";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import {
  ActivityChangelog,
  ActivityChangelogLoading,
} from "@/components/shared/ActivityChangelog";
import { useI18n } from "@/lib/i18n";

type ProjectChangelogProps = {
  enabled?: boolean;
  showHeader?: boolean;
  className?: string;
};

export { ActivityChangelogLoading as ProjectChangelogLoading };

export function ProjectChangelog({
  enabled = true,
  showHeader = true,
  className,
}: ProjectChangelogProps) {
  const { project } = useProject();
  const { t } = useI18n();
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
            title={t("projectWorkspace", "projectChangelog")}
            icon={<History className="h-8 w-8 text-primary" />}
          />
        </div>
      ) : null}

      <ActivityChangelog
        activities={activities}
        title={t("projectWorkspace", "projectActivity")}
        collapsedLabel={t("projectWorkspace", "expandToLoadActivities")}
        emptyMessage={t("projectWorkspace", "projectActivityEmpty")}
      />
    </div>
  );
}
