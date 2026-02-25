"use client";

import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
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
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ProjectChangelogProps = {
  enabled?: boolean;
  showHeader?: boolean;
  className?: string;
};

const PAGE_SIZE = 50;

export function ProjectChangelogSkeleton({ className }: { className?: string }) {
  return <Spinner className={cn("px-4 lg:px-0", className)} />;
}

const getActivityIcon = (actionType: string) => {
  if (actionType.startsWith("task.")) {
    switch (actionType) {
      case "task.create":
        return <Plus className="h-4 w-4 text-green-600" />;
      case "task.update":
        return <Edit3 className="h-4 w-4 text-blue-600" />;
      case "task.status.change":
      case "task.status_change":
        return <CheckCircle2 className="h-4 w-4 text-orange-600" />;
      case "task.assign":
        return <Users className="h-4 w-4 text-purple-600" />;
      case "task.comment.add":
        return <MessageCircle className="h-4 w-4 text-indigo-600" />;
      case "task.file.add":
        return <Upload className="h-4 w-4 text-teal-600" />;
      case "task.content.update":
        return <FileText className="h-4 w-4 text-amber-600" />;
      case "task.delete":
        return <Trash className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  }

  if (actionType.startsWith("shopping.")) {
    return <ShoppingCart className="h-4 w-4 text-emerald-600" />;
  }

  if (actionType.startsWith("labor.")) {
    return <Hammer className="h-4 w-4 text-orange-600" />;
  }

  if (actionType.startsWith("note.")) {
    return <StickyNote className="h-4 w-4 text-yellow-600" />;
  }

  if (actionType.startsWith("contact.")) {
    return <Contact className="h-4 w-4 text-cyan-600" />;
  }

  if (actionType.startsWith("survey.")) {
    return <ClipboardList className="h-4 w-4 text-pink-600" />;
  }

  return <Clock className="h-4 w-4 text-gray-600" />;
};

const getActivityColor = (actionType: string) => {
  if (actionType.startsWith("task.")) {
    switch (actionType) {
      case "task.create":
        return "bg-green-50 border-green-200";
      case "task.update":
        return "bg-blue-50 border-blue-200";
      case "task.status.change":
      case "task.status_change":
        return "bg-orange-50 border-orange-200";
      case "task.assign":
        return "bg-purple-50 border-purple-200";
      case "task.comment.add":
        return "bg-indigo-50 border-indigo-200";
      case "task.file.add":
        return "bg-teal-50 border-teal-200";
      case "task.content.update":
        return "bg-amber-50 border-amber-200";
      case "task.delete":
        return "bg-red-50 border-red-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  }

  if (actionType.startsWith("shopping.")) {
    return "bg-emerald-50 border-emerald-200";
  }

  if (actionType.startsWith("labor.")) {
    return "bg-orange-50 border-orange-200";
  }

  if (actionType.startsWith("note.")) {
    return "bg-yellow-50 border-yellow-200";
  }

  if (actionType.startsWith("contact.")) {
    return "bg-cyan-50 border-cyan-200";
  }

  if (actionType.startsWith("survey.")) {
    return "bg-pink-50 border-pink-200";
  }

  return "bg-gray-50 border-gray-200";
};

const getActivityDescription = (actionType: string, details: Record<string, unknown>) => {
  if (actionType.startsWith("task.")) {
    switch (actionType) {
      case "task.create":
        return `created the task "${details.title}"`;
      case "task.update":
        const updatedFields = Array.isArray(details.updatedFields) ? details.updatedFields : [];
        const friendlyFields = updatedFields.map((field: string) => {
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
        }).filter(Boolean);

        if (friendlyFields.length === 0) {
          return "updated the task";
        }
        return `updated ${friendlyFields.join(", ")} in task "${details.title || "Untitled"}"`;
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
          return `accepted "${details.itemName}" in client portal`;
        }
        if (details.decision === "rejected") {
          return `rejected "${details.itemName}" in client portal`;
        }
        return `left a comment for "${details.itemName}" in client portal`;
      case "shopping.customer.decision":
        return `${details.decision === "accepted" ? "accepted" : "rejected"} "${details.itemName}" in client portal`;
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
      return "bg-gray-100 text-gray-700";
    case "in_progress":
      return "bg-blue-100 text-blue-700";
    case "review":
      return "bg-purple-100 text-purple-700";
    case "done":
      return "bg-green-100 text-green-700";
    default:
      return "bg-gray-100 text-gray-700";
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

export function ProjectChangelog({
  enabled = true,
  showHeader = true,
  className,
}: ProjectChangelogProps) {
  const { project } = useProject();
  const [filterType, setFilterType] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const hasAccess = useQuery(
    apiAny.projects.checkUserProjectAccess,
    enabled ? { projectId: project._id } : "skip"
  );

  const activities = useQuery(
    apiAny.activityLog.getForProject,
    enabled && hasAccess ? { projectId: project._id } : "skip"
  );

  const filteredActivities = useMemo(() => {
    if (!activities) return [];

    let filtered = activities;

    if (filterType !== "all") {
      filtered = filtered.filter(activity =>
        activity.actionType.startsWith(filterType + ".")
      );
    }

    if (timeFilter !== "all") {
      const now = Date.now();
      const filterTime = {
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
      }[timeFilter];

      if (filterTime) {
        filtered = filtered.filter(activity =>
          (now - activity._creationTime) <= filterTime
        );
      }
    }

    return filtered;
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

  if (!enabled) {
    return null;
  }

  if (hasAccess === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You don't have permission to view this project's changelog.</p>
      </div>
    );
  }

  if (!activities) {
    return <ProjectChangelogSkeleton className={className} />;
  }

  return (
    <div className={cn("px-4 lg:px-0", className)}>
      {showHeader && (
        <div className="mb-4 lg:mb-6">
          <div className="flex items-center gap-2 mb-2">
            <History className="h-8 w-8 text-primary" />
            <h1 className="text-2xl lg:text-3xl font-bold">Project Changelog</h1>
          </div>
          <p className="text-muted-foreground text-sm lg:text-base">
            Complete activity history for {project.name}
          </p>
        </div>
      )}

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>

            <div className="flex flex-wrap gap-3 flex-1">
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

              {(filterType !== "all" || timeFilter !== "all") && (
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
              )}
            </div>

            <div className="text-sm text-muted-foreground">
              {filteredActivities.length} {filteredActivities.length === 1 ? "activity" : "activities"}
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredActivities.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No activity found</p>
              <p className="text-sm mt-1">
                {filterType !== "all" || timeFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Activity will appear here as team members work on the project"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {paginatedActivities.map((activity) => {
            const actorName =
              activity.userName ||
              (typeof activity.details?.actorName === "string"
                ? activity.details.actorName
                : "Unknown User");
            return (
            <div
              key={activity._id}
              className={`relative flex items-start space-x-3 p-4 rounded-lg border transition-all hover:shadow-md ${getActivityColor(activity.actionType)}`}
            >
              <div className="flex-shrink-0 mt-1">
                {getActivityIcon(activity.actionType)}
              </div>

              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarImage src={activity.userImageUrl} />
                <AvatarFallback className="text-xs">
                  {actorName.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm flex-1">
                    <span className="font-medium text-gray-900">
                      {actorName}
                    </span>
                    <span className="text-gray-600 ml-1">
                      {getActivityDescription(activity.actionType, activity.details)}
                    </span>
                  </div>

                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {getEntityTypeLabel(activity.actionType)}
                  </Badge>
                </div>

                {(activity.actionType === "task.status.change" || activity.actionType === "task.status_change") && (
                  <div className="mt-2 flex items-center space-x-2">
                    <Badge className={getStatusBadgeColor((activity.details.fromStatus || activity.details.from) as string)}>
                      {getStatusLabel((activity.details.fromStatus || activity.details.from) as string)}
                    </Badge>
                    <span className="text-gray-400">→</span>
                    <Badge className={getStatusBadgeColor((activity.details.toStatus || activity.details.to) as string)}>
                      {getStatusLabel((activity.details.toStatus || activity.details.to) as string)}
                    </Badge>
                  </div>
                )}

                {activity.actionType === "task.comment.add" && activity.details.commentPreview && (
                  <div className="mt-2 p-2 bg-card/50 rounded text-xs text-gray-600 italic">
                    "{activity.details.commentPreview}..."
                  </div>
                )}

                {activity.actionType === "task.file.add" && (
                  <div className="mt-2 flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span className="text-xs text-gray-600">
                      {activity.details.fileType} file
                    </span>
                  </div>
                )}

                <div className="mt-2 flex items-center space-x-2 text-xs text-gray-500">
                  <CalendarIcon className="h-3 w-3" />
                  <span>{formatDistanceToNow(new Date(activity._creationTime), { addSuffix: true })}</span>
                  <span>•</span>
                  <span>{new Date(activity._creationTime).toLocaleString()}</span>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {filteredActivities.length > 0 && (
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Showing {showingStart}-{showingEnd} of {filteredActivities.length} activities
        </div>
      )}

      {filteredActivities.length > PAGE_SIZE && (
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
      )}
    </div>
  );
}
