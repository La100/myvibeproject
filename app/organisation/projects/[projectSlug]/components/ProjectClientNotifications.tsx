"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { BellRing, CheckCircle2, ClipboardList, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isClientNotificationActivity,
  markProjectClientNotificationsRead,
} from "@/lib/projectClientNotifications";

type ProjectClientNotificationsProps = {
  enabled?: boolean;
  showHeader?: boolean;
  className?: string;
};

export function ProjectClientNotificationsSkeleton({ className }: { className?: string }) {
  return <Spinner className={cn("px-4 lg:px-0", className)} />;
}

export function ProjectClientNotifications({
  enabled = true,
  showHeader = true,
  className,
}: ProjectClientNotificationsProps) {
  const { project } = useProject();
  const activities = useQuery(
    apiAny.activityLog.getForProject,
    enabled ? { projectId: project._id } : "skip",
  );

  const notifications = useMemo(
    () => (activities ?? []).filter(isClientNotificationActivity),
    [activities],
  );

  useEffect(() => {
    if (!enabled || notifications.length === 0) {
      return;
    }
    markProjectClientNotificationsRead(String(project._id), notifications[0]._creationTime);
  }, [enabled, notifications, project._id]);

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

      <Card className="bg-card/92">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="clean-title flex items-center gap-2 text-lg font-medium lg:text-xl">
              <BellRing className="h-5 w-5 text-primary" />
              Client Notifications
            </CardTitle>
            <Badge variant="secondary">{notifications.length} recent</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No client notifications yet. Actions from client portal will appear here.
            </p>
          ) : (
            notifications.map((activity) => {
              const details = (activity.details ?? {}) as Record<string, unknown>;
              const actorName =
                activity.userName ||
                (typeof details.actorName === "string" && details.actorName.length > 0
                  ? details.actorName
                  : "Client");
              const itemName =
                typeof details.itemName === "string" && details.itemName.length > 0
                  ? details.itemName
                  : "shopping item";
              const surveyTitle =
                typeof details.surveyTitle === "string" && details.surveyTitle.length > 0
                  ? details.surveyTitle
                  : "survey";
              const isDecision = activity.actionType === "shopping.customer.decision";
              const isAccepted = details.decision === "accepted";

              return (
                <div
                  key={activity._id}
                  className="flex items-start justify-between gap-3 rounded-xl border bg-card/60 px-3 py-3"
                >
                  <div className="flex min-w-0 items-start gap-2">
                    {isDecision ? (
                      isAccepted ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                      ) : (
                        <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" />
                      )
                    ) : (
                      <ClipboardList className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                    )}
                    <p className="text-sm leading-6 text-foreground">
                      {isDecision ? (
                        <>
                          <span className="font-medium">{actorName}</span>{" "}
                          {isAccepted ? "accepted" : "rejected"}{" "}
                          <span className="font-medium">"{itemName}"</span> in client portal
                        </>
                      ) : (
                        <>
                          <span className="font-medium">{actorName}</span>{" "}
                          submitted survey{" "}
                          <span className="font-medium">"{surveyTitle}"</span> in client portal
                        </>
                      )}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{formatDistanceToNow(new Date(activity._creationTime), { addSuffix: true })}</p>
                    <p>{new Date(activity._creationTime).toLocaleString()}</p>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
