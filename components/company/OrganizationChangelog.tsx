"use client";

import { useQuery } from "convex/react";
import { useOrganization } from "@clerk/nextjs";
import { History } from "lucide-react";
import { apiAny } from "@/lib/convexApiAny";
import { cn } from "@/lib/utils";
import { ActivityChangelog } from "@/components/shared/ActivityChangelog";

type OrganizationChangelogProps = {
  enabled?: boolean;
  showHeader?: boolean;
  className?: string;
};

export function OrganizationChangelog({
  enabled = true,
  showHeader = true,
  className,
}: OrganizationChangelogProps) {
  const { organization } = useOrganization();
  const activities = useQuery(
    apiAny.activityLog.getForTeam,
    enabled && organization?.id ? { clerkOrgId: organization.id } : "skip",
  );

  if (!enabled) {
    return null;
  }

  return (
    <div className={cn(className)}>
      {showHeader ? (
        <div className="px-4 lg:px-0">
          <div className="mb-4 lg:mb-6">
            <div className="mb-2 flex items-center gap-2">
              <History className="h-8 w-8 text-primary" />
              <h2 className="text-2xl font-bold lg:text-3xl">Organization Changelog</h2>
            </div>
            <p className="text-sm text-muted-foreground lg:text-base">
              Full activity history across all projects in this organization.
            </p>
          </div>
        </div>
      ) : null}

      <ActivityChangelog
        activities={activities}
        title="Organization activity"
        collapsedLabel="Expand to load all project activity"
        emptyMessage="Activity will appear here as your team works across projects."
        showProjectBadge
      />
    </div>
  );
}
