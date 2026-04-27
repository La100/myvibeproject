"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  BellRing,
  CheckCircle2,
  ClipboardList,
  FolderOpen,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getClientActorName } from "@/lib/clientNotificationCopy";

type ClientNotificationActivity = {
  _id: string;
  _creationTime: number;
  actionType: string;
  details?: Record<string, unknown> | null;
  userName?: string;
  projectName?: string;
  projectSlug?: string;
  effectiveLastReadAt?: number;
};

type ClientNotificationsFeedProps = {
  title: string;
  emptyState: string;
  notifications: ClientNotificationActivity[];
  unreadCount?: number;
  showProjectBadge?: boolean;
  className?: string;
};

export function ClientNotificationsFeed({
  title,
  emptyState,
  notifications,
  unreadCount = 0,
  showProjectBadge = false,
  className,
}: ClientNotificationsFeedProps) {
  return (
    <div className={cn(className)}>
      <Card className="bg-card/92">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg font-medium lg:text-xl">
              <BellRing className="h-5 w-5 text-primary" />
              {title}
            </CardTitle>
            <div className="flex items-center gap-2">
              {unreadCount > 0 ? <Badge variant="default">{unreadCount} unread</Badge> : null}
              <Badge variant="secondary">{notifications.length} recent</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-0">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">{emptyState}</p>
          ) : (
            notifications.map((activity) => {
              const details = (activity.details ?? {}) as Record<string, unknown>;
              const actorName =
                getClientActorName(
                  activity.userName ||
                    (typeof details.actorName === "string" && details.actorName.length > 0
                      ? details.actorName
                      : "Client"),
                );
              const itemName =
                typeof details.itemName === "string" && details.itemName.length > 0
                  ? details.itemName
                  : "item";
              const surveyTitle =
                typeof details.surveyTitle === "string" && details.surveyTitle.length > 0
                  ? details.surveyTitle
                  : "survey";
              const isDecision =
                activity.actionType === "shopping.customer.decision" ||
                activity.actionType === "labor.customer.decision";
              const isCommentOnlyFeedback =
                activity.actionType === "shopping.customer.feedback" ||
                activity.actionType === "labor.customer.feedback";
              const isSurveySubmission = activity.actionType === "survey.response.submit";
              const comment =
                typeof details.comment === "string" && details.comment.trim().length > 0
                  ? details.comment.trim()
                  : null;
              const isAccepted = details.decision === "accepted";
              const notificationTone = isDecision
                ? isAccepted
                  ? "border-primary/25 bg-primary/8"
                  : "border-destructive/20 bg-destructive/5"
                : "border-border bg-muted/40";
              const statusTone = isAccepted
                ? "border-primary/30 bg-primary/12 text-primary dark:text-primary"
                : "border-destructive/20 bg-destructive/10 text-destructive";
              const isUnread =
                activity._creationTime > (activity.effectiveLastReadAt ?? Number.MAX_SAFE_INTEGER);

              return (
                <div
                  key={activity._id}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-xl border px-3 py-3",
                    notificationTone,
                  )}
                >
                  <div className="flex min-w-0 items-start gap-2">
                    {isDecision ? (
                      isAccepted ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary dark:text-primary" />
                      ) : (
                        <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                      )
                    ) : (
                      <ClipboardList className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    )}
                    <div className="min-w-0">
                      {showProjectBadge && activity.projectName && activity.projectSlug ? (
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="gap-1">
                            <FolderOpen className="h-3 w-3" />
                            <Link href={`/organisation/projects/${activity.projectSlug}/changelog`}>
                              {activity.projectName}
                            </Link>
                          </Badge>
                          {isUnread ? <Badge variant="default">New</Badge> : null}
                        </div>
                      ) : null}
                      <p className="text-sm leading-6 text-foreground">
                        {isDecision ? (
                          <>
                            <span className="font-medium">{actorName}</span>{" "}
                            {isAccepted ? "approved" : "rejected"}{" "}
                            <span className="font-medium">"{itemName}"</span> in client portal
                          </>
                        ) : isCommentOnlyFeedback ? (
                          <>
                            <span className="font-medium">{actorName}</span> left a comment on{" "}
                            <span className="font-medium">"{itemName}"</span> in client portal
                          </>
                        ) : isSurveySubmission ? (
                          <>
                            <span className="font-medium">{actorName}</span>{" "}
                            submitted survey <span className="font-medium">"{surveyTitle}"</span> in
                            client portal
                          </>
                        ) : (
                          <>{activity.actionType}</>
                        )}
                      </p>
                      {isCommentOnlyFeedback && comment ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {comment}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {isDecision ? (
                      <Badge variant="outline" className={cn("mb-2 capitalize", statusTone)}>
                        {isAccepted ? "accepted" : "rejected"}
                      </Badge>
                    ) : null}
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
