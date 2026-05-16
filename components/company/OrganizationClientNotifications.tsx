"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { useOrganization } from "@clerk/nextjs";
import { BellRing } from "lucide-react";
import { apiAny } from "@/lib/convexApiAny";
import { dedupeActivityLogActivities } from "@/lib/activityLogDeduplication";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { ClientNotificationsFeed } from "@/components/shared/ClientNotificationsFeed";
import { useI18n } from "@/lib/i18n";

type OrganizationNotification = {
  _id: string;
  _creationTime: number;
  actionType: string;
  details?: Record<string, unknown> | null;
  projectId?: string;
  projectName: string;
  projectSlug: string;
  userName?: string;
  effectiveLastReadAt?: number;
};

type OrganizationClientNotificationsProps = {
  enabled?: boolean;
  showHeader?: boolean;
  className?: string;
};

function OrganizationClientNotificationsLoading({
  className,
}: {
  className?: string;
}) {
  return <Spinner className={cn("px-4 lg:px-0", className)} />;
}

export function OrganizationClientNotifications({
  enabled = true,
  showHeader = true,
  className,
}: OrganizationClientNotificationsProps) {
  const { t } = useI18n();
  const { organization } = useOrganization();
  const markOrganizationNotificationsRead = useMutation(
    apiAny.teams.markOrganizationClientNotificationsRead,
  );
  const notificationsQuery = useQuery(
    apiAny.activityLog.getClientNotificationsForTeam,
    enabled && organization?.id ? { clerkOrgId: organization.id } : "skip",
  );
  const lastMarkedNotificationAtRef = useRef(0);

  const notifications = useMemo(() => {
    const rawNotifications = (notificationsQuery ?? []) as OrganizationNotification[];
    return dedupeActivityLogActivities(rawNotifications) as OrganizationNotification[];
  }, [notificationsQuery]);

  const unreadNotifications = useMemo(
    () =>
      notifications.filter(
        (notification) =>
          notification._creationTime > (notification.effectiveLastReadAt ?? 0),
      ),
    [notifications],
  );
  const latestNotificationAt = notifications[0]?._creationTime ?? 0;
  const latestProjectReads = useMemo(() => {
    const projectReadMap = new Map<string, { projectId: string; lastReadAt: number }>();

    for (const notification of notifications) {
      if (!notification.projectId) {
        continue;
      }

      const current = projectReadMap.get(notification.projectId);
      if (!current || notification._creationTime > current.lastReadAt) {
        projectReadMap.set(notification.projectId, {
          projectId: notification.projectId,
          lastReadAt: notification._creationTime,
        });
      }
    }

    return Array.from(projectReadMap.values());
  }, [notifications]);

  useEffect(() => {
    if (!enabled || !organization?.id || latestNotificationAt === 0) {
      return;
    }
    if (unreadNotifications.length === 0) {
      return;
    }
    if (lastMarkedNotificationAtRef.current >= latestNotificationAt) {
      return;
    }

    lastMarkedNotificationAtRef.current = latestNotificationAt;
    void markOrganizationNotificationsRead({
      clerkOrgId: organization.id,
      lastReadAt: latestNotificationAt,
      projectReads: latestProjectReads,
    });
  }, [
    enabled,
    latestNotificationAt,
    latestProjectReads,
    markOrganizationNotificationsRead,
    organization?.id,
    unreadNotifications.length,
  ]);

  if (!enabled) {
    return null;
  }

  if (!notificationsQuery) {
    return <OrganizationClientNotificationsLoading className={className} />;
  }

  return (
    <div className={cn(className)}>
      {showHeader ? (
        <div className="mb-4 lg:mb-6">
          <div className="mb-2 flex items-center gap-2">
            <BellRing className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold lg:text-3xl">
              {t("organizationNotifications", "title")}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground lg:text-base">
            {t("organizationNotifications", "description")}
          </p>
        </div>
      ) : null}

      <ClientNotificationsFeed
        title={t("organizationNotifications", "feedTitle")}
        emptyState={t("organizationNotifications", "emptyState")}
        notifications={notifications}
        unreadCount={unreadNotifications.length}
        showProjectBadge
      />
    </div>
  );
}

export { OrganizationClientNotificationsLoading };
