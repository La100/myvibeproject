"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { Spinner } from "@/components/ui/spinner";
import { BellRing } from "lucide-react";
import { cn } from "@/lib/utils";
import { dedupeActivityLogActivities } from "@/lib/activityLogDeduplication";
import { isClientNotificationActivity } from "@/lib/projectClientNotifications";
import { ClientNotificationsFeed } from "@/components/shared/ClientNotificationsFeed";

type ProjectClientNotificationsProps = {
  enabled?: boolean;
  showHeader?: boolean;
  className?: string;
};

function ProjectClientNotificationsSkeleton({ className }: { className?: string }) {
  return <Spinner className={cn("px-4 lg:px-0", className)} />;
}

export function ProjectClientNotifications({
  enabled = true,
  showHeader = true,
  className,
}: ProjectClientNotificationsProps) {
  const { project, markClientNotificationsReadLocally } = useProject();
  const markClientNotificationsRead = useMutation(apiAny.projects.markClientNotificationsRead);
  const activities = useQuery(
    apiAny.activityLog.getForProject,
    enabled ? { projectId: project._id } : "skip",
  );

  const notifications = useMemo(
    () => {
      const filtered = (activities ?? []).filter(isClientNotificationActivity);
      return dedupeActivityLogActivities(filtered) as typeof filtered;
    },
    [activities],
  );
  const latestNotificationAt = notifications[0]?._creationTime ?? 0;
  const lastMarkedNotificationAtRef = useRef(0);

  useEffect(() => {
    if (!enabled || latestNotificationAt === 0) {
      return;
    }
    if ((project.clientNotificationsLastReadAt ?? 0) >= latestNotificationAt) {
      return;
    }
    if (lastMarkedNotificationAtRef.current >= latestNotificationAt) {
      return;
    }

    lastMarkedNotificationAtRef.current = latestNotificationAt;
    markClientNotificationsReadLocally(latestNotificationAt);

    void markClientNotificationsRead({
      projectId: project._id,
      lastReadAt: latestNotificationAt,
    });
  }, [
    enabled,
    latestNotificationAt,
    markClientNotificationsReadLocally,
    markClientNotificationsRead,
    project._id,
    project.clientNotificationsLastReadAt,
  ]);

  if (!enabled) {
    return null;
  }

  if (!activities) {
    return <ProjectClientNotificationsSkeleton className={className} />;
  }

  return (
    <div className={cn("px-4 lg:px-0", className)}>
      {showHeader && (
        <div className="mb-4 lg:mb-6">
          <div className="mb-2 flex items-center gap-2">
            <BellRing className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold lg:text-3xl">Client Notifications</h1>
          </div>
          <p className="text-sm text-muted-foreground lg:text-base">
            Recent responses sent by your client from the client portal.
          </p>
        </div>
      )}

      <ClientNotificationsFeed
        title="Client Notifications"
        emptyState="No client notifications yet. Actions from client portal will appear here."
        notifications={notifications}
      />
    </div>
  );
}

export { ProjectClientNotificationsSkeleton };
