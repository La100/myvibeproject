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
import { useI18n } from "@/lib/i18n";

type ProjectClientNotificationsProps = {
  enabled?: boolean;
  showHeader?: boolean;
  className?: string;
};

function ProjectClientNotificationsLoading({ className }: { className?: string }) {
  return <Spinner className={cn("px-4 lg:px-0", className)} />;
}

export function ProjectClientNotifications({
  enabled = true,
  showHeader = true,
  className,
}: ProjectClientNotificationsProps) {
  const { project, markClientNotificationsReadLocally } = useProject();
  const { t } = useI18n();
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
    return <ProjectClientNotificationsLoading className={className} />;
  }

  return (
    <div className={cn("px-4 lg:px-0", className)}>
      {showHeader && (
        <div className="mb-4 lg:mb-6">
          <div className="mb-2 flex items-center gap-2">
            <BellRing className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold lg:text-3xl">
              {t("projectWorkspace", "clientNotifications")}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground lg:text-base">
            {t("projectWorkspace", "clientNotificationsDescription")}
          </p>
        </div>
      )}

      <ClientNotificationsFeed
        title={t("projectWorkspace", "clientNotifications")}
        emptyState={t("projectWorkspace", "clientNotificationsEmpty")}
        notifications={notifications}
      />
    </div>
  );
}

export { ProjectClientNotificationsLoading };
