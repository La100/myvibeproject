"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { enUS, pl } from "date-fns/locale";
import {
  FileText,
  Edit3,
  Users,
  MessageCircle,
  Upload,
  CheckCircle2,
  Clock,
  Trash,
  Plus,
  History,
  ShoppingCart,
  StickyNote,
  Contact,
  ClipboardList,
  Filter,
  Calendar as CalendarIcon,
  Hammer,
  ChevronDown,
  XCircle,
  FolderOpen,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dedupeActivityLogActivities } from "@/lib/activityLogDeduplication";
import { getClientActorName } from "@/lib/clientNotificationCopy";
import { useI18n } from "@/lib/i18n";

type ActivityItem = {
  _id: string;
  _creationTime: number;
  actionType: string;
  details?: Record<string, unknown> | null;
  userName?: string;
  userImageUrl?: string;
  projectName?: string;
  projectSlug?: string;
};

type ActivityChangelogProps = {
  activities: ActivityItem[] | undefined;
  title: string;
  collapsedLabel: string;
  emptyMessage: string;
  showProjectBadge?: boolean;
  className?: string;
};

const PAGE_SIZE = 30;

export function ActivityChangelogLoading({ className }: { className?: string }) {
  return <Spinner className={cn("px-4 lg:px-0", className)} />;
}

const getClientDecisionState = (
  actionType: string,
  details: Record<string, unknown>,
): "accepted" | "rejected" | null => {
  if (
    actionType !== "shopping.customer.decision" &&
    actionType !== "shopping.customer.feedback" &&
    actionType !== "labor.customer.decision" &&
    actionType !== "labor.customer.feedback"
  ) {
    return null;
  }

  const decision = details.decision;
  if (decision === "accepted" || decision === "rejected") {
    return decision;
  }

  return null;
};

const getActivityIcon = (actionType: string, details: Record<string, unknown> = {}) => {
  const clientDecisionState = getClientDecisionState(actionType, details);
  if (clientDecisionState === "accepted") {
    return <CheckCircle2 className="h-4 w-4 text-primary" />;
  }

  if (clientDecisionState === "rejected") {
    return <XCircle className="h-4 w-4 text-destructive" />;
  }

  if (actionType.startsWith("task.")) {
    switch (actionType) {
      case "task.create":
        return <Plus className="h-4 w-4 text-primary" />;
      case "task.update":
        return <Edit3 className="h-4 w-4 text-primary" />;
      case "task.status.change":
      case "task.status_change":
        return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case "task.assign":
        return <Users className="h-4 w-4 text-muted-foreground" />;
      case "task.comment.add":
        return <MessageCircle className="h-4 w-4 text-muted-foreground" />;
      case "task.file.add":
        return <Upload className="h-4 w-4 text-muted-foreground" />;
      case "task.content.update":
        return <FileText className="h-4 w-4 text-muted-foreground" />;
      case "task.delete":
        return <Trash className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  }

  if (actionType.startsWith("shopping.")) {
    return <ShoppingCart className="h-4 w-4 text-primary" />;
  }

  if (actionType.startsWith("labor.")) {
    return <Hammer className="h-4 w-4 text-muted-foreground" />;
  }

  if (actionType.startsWith("note.")) {
    return <StickyNote className="h-4 w-4 text-muted-foreground" />;
  }

  if (actionType.startsWith("contact.")) {
    return <Contact className="h-4 w-4 text-muted-foreground" />;
  }

  if (actionType.startsWith("survey.")) {
    return <ClipboardList className="h-4 w-4 text-muted-foreground" />;
  }

  return <Clock className="h-4 w-4 text-muted-foreground" />;
};

const getActivityColor = (details: Record<string, unknown> = {}) => {
  const shoppingDecisionState = details.decision;
  if (shoppingDecisionState === "accepted") {
    return "bg-primary/5 border-primary/20";
  }

  if (shoppingDecisionState === "rejected") {
    return "bg-destructive/5 border-destructive/20";
  }

  return "bg-card border-border";
};

const getDecisionBadgeColor = (decision: "accepted" | "rejected") =>
  decision === "accepted"
    ? "border-primary/20 bg-primary/10 text-primary"
    : "border-destructive/20 bg-destructive/10 text-destructive";

const getActivityDescription = (
  actionType: string,
  details: Record<string, unknown>,
  t: ReturnType<typeof useI18n>["t"],
) => {
  if (actionType.startsWith("task.")) {
    switch (actionType) {
      case "task.create":
        return t("activity", "taskCreated", { title: String(details.title ?? "") });
      case "task.update": {
        const updatedFields = Array.isArray(details.updatedFields) ? details.updatedFields : [];
        const friendlyFields = updatedFields
          .map((field: string) => {
            switch (field) {
              case "updatedAt":
                return null;
              case "title":
                return t("activity", "fieldTitle");
              case "description":
                return t("activity", "fieldDescription");
              case "status":
                return t("activity", "fieldStatus");
              case "priority":
                return t("activity", "fieldPriority");
              case "assignedTo":
                return t("activity", "fieldAssignee");
              case "dueDate":
                return t("activity", "fieldDueDate");
              case "tags":
                return t("activity", "fieldTags");
              case "content":
                return t("activity", "fieldContent");
              default:
                return field;
            }
          })
          .filter(Boolean);

        if (friendlyFields.length === 0) {
          return t("activity", "taskUpdatedGeneric");
        }
        return t("activity", "taskUpdatedFields", {
          fields: friendlyFields.join(", "),
          title: String(details.title || t("activity", "untitled")),
        });
      }
      case "task.status.change":
      case "task.status_change": {
        const fromStatus = (details.fromStatus || details.from) as string | undefined;
        const toStatus = (details.toStatus || details.to) as string | undefined;

        if (toStatus === "done") {
          return t("activity", "taskMarkedDone", {
            title: String(details.title || t("activity", "untitled")),
          });
        }

        if (fromStatus && toStatus && fromStatus !== toStatus) {
          return t("activity", "taskStatusChangedFromTo", {
            title: String(details.title || t("activity", "untitled")),
            from: getStatusLabel(fromStatus, t),
            to: getStatusLabel(toStatus, t),
          });
        }

        if (toStatus) {
          return t("activity", "taskStatusChangedTo", {
            title: String(details.title || t("activity", "untitled")),
            to: getStatusLabel(toStatus, t),
          });
        }

        return t("activity", "taskStatusUpdated", {
          title: String(details.title || t("activity", "untitled")),
        });
      }
      case "task.assign":
        return t("activity", "taskReassigned", {
          title: String(details.title || t("activity", "untitled")),
          from: String(details.from ?? ""),
          to: String(details.to ?? ""),
        });
      case "task.comment.add":
        return t("activity", "taskCommentAdded", { title: String(details.title || t("activity", "untitled")) });
      case "task.file.add":
        return t("activity", "taskFileUploaded", {
          fileName: String(details.fileName ?? ""),
          title: String(details.title || t("activity", "untitled")),
        });
      case "task.content.update":
        return t("activity", "taskContentUpdated", { title: String(details.title || t("activity", "untitled")) });
      case "task.delete":
        return t("activity", "taskDeleted", { title: String(details.title ?? "") });
      default:
        return t("activity", "taskAction");
    }
  }

  if (actionType.startsWith("shopping.")) {
    switch (actionType) {
      case "shopping.create":
        return t("activity", "shoppingCreated", { name: String(details.name ?? "") });
      case "shopping.update":
        return t("activity", "shoppingUpdated", { name: String(details.name ?? "") });
      case "shopping.delete":
        return t("activity", "shoppingDeleted", { name: String(details.name ?? "") });
      case "shopping.customer.option_selected":
        return t("activity", "shoppingOptionSelected", {
          name: String(details.selectedItemName || details.selectedItemId || ""),
        });
      case "shopping.customer.feedback":
        if (details.decision === "accepted") {
          return t("activity", "shoppingApproved", { name: String(details.itemName ?? "") });
        }
        if (details.decision === "rejected") {
          return t("activity", "shoppingRejected", { name: String(details.itemName ?? "") });
        }
        return t("activity", "shoppingFeedback", { name: String(details.itemName ?? "") });
      case "shopping.customer.decision":
        return details.decision === "accepted"
          ? t("activity", "shoppingApproved", { name: String(details.itemName ?? "") })
          : t("activity", "shoppingRejected", { name: String(details.itemName ?? "") });
      default:
        return t("activity", "shoppingAction");
    }
  }

  if (actionType.startsWith("labor.")) {
    switch (actionType) {
      case "labor.create":
        return t("activity", "laborCreated", { name: String(details.name ?? "") });
      case "labor.update":
        return t("activity", "laborUpdated", { name: String(details.name ?? "") });
      case "labor.delete":
        return t("activity", "laborDeleted", { name: String(details.name ?? "") });
      case "labor.customer.feedback":
        if (details.decision === "accepted") {
          return t("activity", "laborApproved", { name: String(details.itemName ?? "") });
        }
        if (details.decision === "rejected") {
          return t("activity", "laborRejected", { name: String(details.itemName ?? "") });
        }
        return t("activity", "laborFeedback", { name: String(details.itemName ?? "") });
      case "labor.customer.decision":
        return details.decision === "accepted"
          ? t("activity", "laborApproved", { name: String(details.itemName ?? "") })
          : t("activity", "laborRejected", { name: String(details.itemName ?? "") });
      default:
        return t("activity", "laborAction");
    }
  }

  if (actionType.startsWith("note.")) {
    switch (actionType) {
      case "note.create":
        return t("activity", "noteCreated", { title: String(details.title ?? "") });
      case "note.update":
        return t("activity", "noteUpdated", { title: String(details.title ?? "") });
      case "note.delete":
        return t("activity", "noteDeleted", { title: String(details.title ?? "") });
      default:
        return t("activity", "noteAction");
    }
  }

  if (actionType.startsWith("contact.")) {
    switch (actionType) {
      case "contact.create":
        return t("activity", "contactCreated", { name: String(details.name ?? "") });
      case "contact.update":
        return t("activity", "contactUpdated", { name: String(details.name ?? "") });
      case "contact.archive":
        return t("activity", "contactArchived", { name: String(details.name ?? "") });
      case "contact.delete":
        return t("activity", "contactDeleted", { name: String(details.name ?? "") });
      default:
        return t("activity", "contactAction");
    }
  }

  if (actionType.startsWith("survey.")) {
    switch (actionType) {
      case "survey.create":
        return t("activity", "surveyCreated", { title: String(details.title ?? "") });
      case "survey.update":
        return t("activity", "surveyUpdated", { title: String(details.title ?? "") });
      case "survey.delete":
        return t("activity", "surveyDeleted", { title: String(details.title ?? "") });
      case "survey.question.create":
        return t("activity", "surveyQuestionCreated", { title: String(details.surveyTitle ?? "") });
      case "survey.question.update":
        return t("activity", "surveyQuestionUpdated", { title: String(details.surveyTitle ?? "") });
      case "survey.question.delete":
        return t("activity", "surveyQuestionDeleted", { title: String(details.surveyTitle ?? "") });
      case "survey.response.submit":
        return t("activity", "surveySubmitted", { title: String(details.surveyTitle || t("activity", "untitled")) });
      default:
        return t("activity", "surveyAction");
    }
  }

  return t("activity", "performedAction");
};

const getStatusLabel = (status: string, t: ReturnType<typeof useI18n>["t"]) => {
  switch (status) {
    case "todo":
      return t("activity", "statusTodo");
    case "in_progress":
      return t("activity", "statusInProgress");
    case "review":
      return t("activity", "statusReview");
    case "done":
      return t("activity", "statusDone");
    default:
      return status;
  }
};

const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case "todo":
      return "border-border bg-muted text-muted-foreground";
    case "in_progress":
      return "border-primary/20 bg-primary/10 text-primary";
    case "review":
      return "border-secondary/20 bg-secondary text-secondary-foreground";
    case "done":
      return "border-primary/20 bg-primary/10 text-primary";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
};

const getEntityTypeLabel = (actionType: string, t: ReturnType<typeof useI18n>["t"]) => {
  if (actionType.startsWith("task.")) return t("activity", "entityTask");
  if (actionType.startsWith("shopping.")) return t("activity", "entityShopping");
  if (actionType.startsWith("labor.")) return t("activity", "entityLabor");
  if (actionType.startsWith("note.")) return t("activity", "entityNote");
  if (actionType.startsWith("contact.")) return t("activity", "entityContact");
  if (actionType.startsWith("survey.")) return t("activity", "entitySurvey");
  return t("activity", "entityOther");
};

export function ActivityChangelog({
  activities,
  title,
  collapsedLabel,
  emptyMessage,
  showProjectBadge = false,
  className,
}: ActivityChangelogProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { locale, t } = useI18n();
  const [filterType, setFilterType] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const filteredActivities = useMemo(() => {
    if (!activities) return [];

    let filtered = activities;

    if (filterType !== "all") {
      filtered = filtered.filter((activity) => activity.actionType.startsWith(`${filterType}.`));
    }

    if (timeFilter !== "all") {
      const now = Date.now();
      const filterTime = {
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
      }[timeFilter];

      if (filterTime) {
        filtered = filtered.filter((activity) => now - activity._creationTime <= filterTime);
      }
    }

    return dedupeActivityLogActivities(filtered) as typeof filtered;
  }, [activities, filterType, timeFilter]);

  useEffect(() => {
    setPage(1);
  }, [filterType, timeFilter, activities]);

  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const paginatedActivities = filteredActivities.slice(pageStart, pageEnd);
  const showingStart = filteredActivities.length === 0 ? 0 : pageStart + 1;
  const showingEnd = Math.min(pageEnd, filteredActivities.length);

  return (
    <div className={cn("px-4 lg:px-0", className)}>
      <Card className="mb-6">
        <CardContent className="p-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsExpanded((current) => !current)}
            className="h-auto w-full justify-between px-2 py-2 text-left hover:bg-muted"
          >
            <div>
              <div className="text-sm font-semibold">{title}</div>
              <div className="text-xs text-muted-foreground">
                {isExpanded
                  ? t("activity", "activityCount", {
                      count: filteredActivities.length,
                      activityLabel:
                        filteredActivities.length === 1
                          ? t("activity", "activitySingular")
                          : t("activity", "activityPlural"),
                    })
                  : collapsedLabel}
              </div>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                isExpanded && "rotate-180",
              )}
            />
          </Button>
        </CardContent>
      </Card>

      {isExpanded ? (
        !activities ? (
          <ActivityChangelogLoading className="pt-2" />
        ) : (
          <>
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{t("activity", "filters")}</span>
                  </div>

                  <div className="flex flex-1 flex-wrap gap-3">
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder={t("activity", "entityType")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("activity", "allTypes")}</SelectItem>
                        <SelectItem value="task">{t("activity", "tasks")}</SelectItem>
                        <SelectItem value="shopping">{t("activity", "shoppingList")}</SelectItem>
                        <SelectItem value="labor">{t("activity", "labor")}</SelectItem>
                        <SelectItem value="note">{t("activity", "notes")}</SelectItem>
                        <SelectItem value="contact">{t("activity", "contacts")}</SelectItem>
                        <SelectItem value="survey">{t("activity", "surveys")}</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={timeFilter} onValueChange={setTimeFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder={t("activity", "timeRange")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("activity", "allTime")}</SelectItem>
                        <SelectItem value="24h">{t("activity", "last24Hours")}</SelectItem>
                        <SelectItem value="7d">{t("activity", "last7Days")}</SelectItem>
                        <SelectItem value="30d">{t("activity", "last30Days")}</SelectItem>
                      </SelectContent>
                    </Select>

                    {filterType !== "all" || timeFilter !== "all" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFilterType("all");
                          setTimeFilter("all");
                        }}
                      >
                        {t("activity", "clearFilters")}
                      </Button>
                    ) : null}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {filteredActivities.length}{" "}
                    {filteredActivities.length === 1
                      ? t("activity", "activitySingular")
                      : t("activity", "activityPlural")}
                  </div>
                </div>
              </CardContent>
            </Card>

            {filteredActivities.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <History className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p className="text-lg font-medium">{t("activity", "noActivityFound")}</p>
                    <p className="mt-1 text-sm">
                      {filterType !== "all" || timeFilter !== "all"
                        ? t("activity", "tryAdjustingFilters")
                        : emptyMessage}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {paginatedActivities.map((activity) => {
                  const actorName = getClientActorName(
                    activity.userName ||
                      (typeof activity.details?.actorName === "string"
                        ? activity.details.actorName
                        : t("activity", "unknownUser")),
                  );
                  const decisionState = getClientDecisionState(
                    activity.actionType,
                    activity.details ?? {},
                  );

                  return (
                    <div
                      key={activity._id}
                      className={`relative flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/40 ${getActivityColor(activity.details ?? {})}`}
                    >
                      <div className="mt-1 flex-shrink-0">
                        {getActivityIcon(activity.actionType, activity.details ?? {})}
                      </div>

                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={activity.userImageUrl} />
                        <AvatarFallback className="text-xs">
                          {actorName.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 text-sm">
                            <span className="font-medium text-foreground">{actorName}</span>
                            <span className="ml-1 text-muted-foreground">
                              {getActivityDescription(activity.actionType, activity.details ?? {}, t)}
                            </span>
                            {showProjectBadge && activity.projectName && activity.projectSlug ? (
                              <span className="ml-2 inline-flex align-middle">
                                <Badge variant="outline" className="gap-1 text-xs">
                                  <FolderOpen className="h-3 w-3" />
                                  <Link href={`/organisation/projects/${activity.projectSlug}/changelog`}>
                                    {activity.projectName}
                                  </Link>
                                </Badge>
                              </span>
                            ) : null}
                          </div>

                          <div className="flex flex-shrink-0 items-center gap-2">
                            {decisionState ? (
                              <Badge
                                variant="outline"
                                className={cn("text-xs capitalize", getDecisionBadgeColor(decisionState))}
                              >
                                {decisionState === "accepted"
                                  ? t("activity", "accepted")
                                  : t("activity", "rejected")}
                              </Badge>
                            ) : null}
                            <Badge variant="outline" className="text-xs">
                              {getEntityTypeLabel(activity.actionType, t)}
                            </Badge>
                          </div>
                        </div>

                        {(activity.actionType === "task.status.change" ||
                          activity.actionType === "task.status_change") && (
                          <div className="mt-2 flex items-center gap-2">
                            <Badge className={getStatusBadgeColor((activity.details?.fromStatus || activity.details?.from) as string)}>
                              {getStatusLabel((activity.details?.fromStatus || activity.details?.from) as string, t)}
                            </Badge>
                            <span className="text-muted-foreground">→</span>
                            <Badge className={getStatusBadgeColor((activity.details?.toStatus || activity.details?.to) as string)}>
                              {getStatusLabel((activity.details?.toStatus || activity.details?.to) as string, t)}
                            </Badge>
                          </div>
                        )}

                        {activity.actionType === "task.comment.add" && activity.details?.commentPreview ? (
                          <div className="mt-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs italic text-muted-foreground">
                            "{String(activity.details.commentPreview)}..."
                          </div>
                        ) : null}

                        {activity.actionType === "task.file.add" ? (
                          <div className="mt-2 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {t("activity", "fileTypeLabel", {
                                fileType: String(activity.details?.fileType ?? t("activity", "file")),
                              })}
                            </span>
                          </div>
                        ) : null}

                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <CalendarIcon className="h-3 w-3" />
                          <span>
                            {formatDistanceToNow(new Date(activity._creationTime), {
                              addSuffix: true,
                              locale: locale === "pl" ? pl : enUS,
                            })}
                          </span>
                          <span>•</span>
                          <span>{new Date(activity._creationTime).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filteredActivities.length > 0 ? (
              <div className="mt-6 text-center text-sm text-muted-foreground">
                {t("activity", "showingActivities", {
                  start: showingStart,
                  end: showingEnd,
                  count: filteredActivities.length,
                })}
              </div>
            ) : null}

            {filteredActivities.length > PAGE_SIZE ? (
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                >
                  {t("activity", "previous")}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {t("activity", "pageOf", { page, totalPages })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                >
                  {t("activity", "next")}
                </Button>
              </div>
            ) : null}
          </>
        )
      ) : null}
    </div>
  );
}
