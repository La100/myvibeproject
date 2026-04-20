"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
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

export function ActivityChangelogSkeleton({ className }: { className?: string }) {
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

const getActivityDescription = (actionType: string, details: Record<string, unknown>) => {
  if (actionType.startsWith("task.")) {
    switch (actionType) {
      case "task.create":
        return `created the task "${details.title}"`;
      case "task.update": {
        const updatedFields = Array.isArray(details.updatedFields) ? details.updatedFields : [];
        const friendlyFields = updatedFields
          .map((field: string) => {
            switch (field) {
              case "updatedAt":
                return null;
              case "title":
                return "title";
              case "description":
                return "description";
              case "status":
                return "status";
              case "priority":
                return "priority";
              case "assignedTo":
                return "assignee";
              case "dueDate":
                return "due date";
              case "tags":
                return "tags";
              case "content":
                return "content";
              default:
                return field;
            }
          })
          .filter(Boolean);

        if (friendlyFields.length === 0) {
          return "updated the task";
        }
        return `updated ${friendlyFields.join(", ")} in task "${details.title || "Untitled"}"`;
      }
      case "task.status.change":
      case "task.status_change": {
        const fromStatus = (details.fromStatus || details.from) as string | undefined;
        const toStatus = (details.toStatus || details.to) as string | undefined;

        if (toStatus === "done") {
          return `marked task "${details.title || "Untitled"}" as done`;
        }

        if (fromStatus && toStatus && fromStatus !== toStatus) {
          return `changed task "${details.title || "Untitled"}" status from ${getStatusLabel(fromStatus)} to ${getStatusLabel(toStatus)}`;
        }

        if (toStatus) {
          return `changed task "${details.title || "Untitled"}" status to ${getStatusLabel(toStatus)}`;
        }

        return `updated task "${details.title || "Untitled"}" status`;
      }
      case "task.assign":
        return `reassigned task "${details.title || "Untitled"}" from "${details.from}" to "${details.to}"`;
      case "task.comment.add":
        return `added a comment to "${details.title || "Untitled"}"`;
      case "task.file.add":
        return `uploaded file "${details.fileName}" to task "${details.title || "Untitled"}"`;
      case "task.content.update":
        return `updated task "${details.title || "Untitled"}" description`;
      case "task.delete":
        return `deleted the task "${details.title}"`;
      default:
        return "performed a task action";
    }
  }

  if (actionType.startsWith("shopping.")) {
    switch (actionType) {
      case "shopping.create":
        return `added "${details.name}" to shopping list`;
      case "shopping.update":
        return `updated "${details.name}" in shopping list`;
      case "shopping.delete":
        return `removed "${details.name}" from shopping list`;
      case "shopping.customer.option_selected":
        return `selected option "${details.selectedItemName || details.selectedItemId}" for a shopping item`;
      case "shopping.customer.feedback":
        if (details.decision === "accepted") {
          return `approved "${details.itemName}" in the client portal`;
        }
        if (details.decision === "rejected") {
          return `rejected "${details.itemName}" in the client portal`;
        }
        return `left feedback on "${details.itemName}" in the client portal`;
      case "shopping.customer.decision":
        return `${details.decision === "accepted" ? "approved" : "rejected"} "${details.itemName}" in the client portal`;
      default:
        return "performed a shopping list action";
    }
  }

  if (actionType.startsWith("labor.")) {
    switch (actionType) {
      case "labor.create":
        return `added labor item "${details.name}"`;
      case "labor.update":
        return `updated labor item "${details.name}"`;
      case "labor.delete":
        return `removed labor item "${details.name}"`;
      case "labor.customer.feedback":
        if (details.decision === "accepted") {
          return `approved labor item "${details.itemName}" in the client portal`;
        }
        if (details.decision === "rejected") {
          return `rejected labor item "${details.itemName}" in the client portal`;
        }
        return `left feedback on labor item "${details.itemName}" in the client portal`;
      case "labor.customer.decision":
        return `${details.decision === "accepted" ? "approved" : "rejected"} labor item "${details.itemName}" in the client portal`;
      default:
        return "performed a labor action";
    }
  }

  if (actionType.startsWith("note.")) {
    switch (actionType) {
      case "note.create":
        return `added note "${details.title}"`;
      case "note.update":
        return `updated note "${details.title}"`;
      case "note.delete":
        return `deleted note "${details.title}"`;
      default:
        return "performed a note action";
    }
  }

  if (actionType.startsWith("contact.")) {
    switch (actionType) {
      case "contact.create":
        return `added contact "${details.name}"`;
      case "contact.update":
        return `updated contact "${details.name}"`;
      case "contact.archive":
        return `archived contact "${details.name}"`;
      case "contact.delete":
        return `deleted contact "${details.name}"`;
      default:
        return "performed a contact action";
    }
  }

  if (actionType.startsWith("survey.")) {
    switch (actionType) {
      case "survey.create":
        return `created survey "${details.title}"`;
      case "survey.update":
        return `updated survey "${details.title}"`;
      case "survey.delete":
        return `deleted survey "${details.title}"`;
      case "survey.question.create":
        return `added question to survey "${details.surveyTitle}"`;
      case "survey.question.update":
        return `updated question in survey "${details.surveyTitle}"`;
      case "survey.question.delete":
        return `deleted question from survey "${details.surveyTitle}"`;
      case "survey.response.submit":
        return `submitted survey "${details.surveyTitle || "Untitled"}" in the client portal`;
      default:
        return "performed a survey action";
    }
  }

  return "performed an action";
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "todo":
      return "To do";
    case "in_progress":
      return "In progress";
    case "review":
      return "In review";
    case "done":
      return "Done";
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

const getEntityTypeLabel = (actionType: string) => {
  if (actionType.startsWith("task.")) return "Task";
  if (actionType.startsWith("shopping.")) return "Shopping";
  if (actionType.startsWith("labor.")) return "Labor";
  if (actionType.startsWith("note.")) return "Note";
  if (actionType.startsWith("contact.")) return "Contact";
  if (actionType.startsWith("survey.")) return "Survey";
  return "Other";
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
                  ? `${filteredActivities.length} ${filteredActivities.length === 1 ? "activity" : "activities"}`
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
          <ActivityChangelogSkeleton className="pt-2" />
        ) : (
          <>
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Filters:</span>
                  </div>

                  <div className="flex flex-1 flex-wrap gap-3">
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Entity Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="task">Tasks</SelectItem>
                        <SelectItem value="shopping">Shopping List</SelectItem>
                        <SelectItem value="labor">Labor</SelectItem>
                        <SelectItem value="note">Notes</SelectItem>
                        <SelectItem value="contact">Contacts</SelectItem>
                        <SelectItem value="survey">Surveys</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={timeFilter} onValueChange={setTimeFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Time Range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="24h">Last 24 Hours</SelectItem>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="30d">Last 30 Days</SelectItem>
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
                        Clear Filters
                      </Button>
                    ) : null}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {filteredActivities.length}{" "}
                    {filteredActivities.length === 1 ? "activity" : "activities"}
                  </div>
                </div>
              </CardContent>
            </Card>

            {filteredActivities.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <History className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p className="text-lg font-medium">No activity found</p>
                    <p className="mt-1 text-sm">
                      {filterType !== "all" || timeFilter !== "all"
                        ? "Try adjusting your filters"
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
                        : "Unknown User"),
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
                              {getActivityDescription(activity.actionType, activity.details ?? {})}
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
                                {decisionState}
                              </Badge>
                            ) : null}
                            <Badge variant="outline" className="text-xs">
                              {getEntityTypeLabel(activity.actionType)}
                            </Badge>
                          </div>
                        </div>

                        {(activity.actionType === "task.status.change" ||
                          activity.actionType === "task.status_change") && (
                          <div className="mt-2 flex items-center gap-2">
                            <Badge className={getStatusBadgeColor((activity.details?.fromStatus || activity.details?.from) as string)}>
                              {getStatusLabel((activity.details?.fromStatus || activity.details?.from) as string)}
                            </Badge>
                            <span className="text-muted-foreground">→</span>
                            <Badge className={getStatusBadgeColor((activity.details?.toStatus || activity.details?.to) as string)}>
                              {getStatusLabel((activity.details?.toStatus || activity.details?.to) as string)}
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
                              {String(activity.details?.fileType ?? "File")} file
                            </span>
                          </div>
                        ) : null}

                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <CalendarIcon className="h-3 w-3" />
                          <span>
                            {formatDistanceToNow(new Date(activity._creationTime), {
                              addSuffix: true,
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
                Showing {showingStart}-{showingEnd} of {filteredActivities.length} activities
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
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </>
        )
      ) : null}
    </div>
  );
}
