"use client"

import { formatDistanceToNow } from "date-fns"
import { useQuery } from "convex/react"
import {
  CheckCircle2,
  Clock,
  Edit3,
  FileText,
  MessageCircle,
  Plus,
  Trash,
  Upload,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { apiAny } from "@/lib/convexApiAny"
import { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"

interface ActivityLogProps {
  taskId: Id<"tasks">
}

type ActivityMeta = {
  icon: React.ComponentType<React.ComponentProps<"svg">>
  itemClassName?: string
  iconClassName?: string
}

const activityMetaByType: Record<string, ActivityMeta> = {
  "task.create": {
    icon: Plus,
    itemClassName: "border-primary/20 bg-primary/5",
    iconClassName: "text-primary",
  },
  "task.update": {
    icon: Edit3,
    itemClassName: "border-border bg-card",
    iconClassName: "text-foreground",
  },
  "task.status.change": {
    icon: CheckCircle2,
    itemClassName: "border-primary/20 bg-primary/5",
    iconClassName: "text-primary",
  },
  "task.status_change": {
    icon: CheckCircle2,
    itemClassName: "border-primary/20 bg-primary/5",
    iconClassName: "text-primary",
  },
  "task.assign": {
    icon: Users,
    itemClassName: "border-border bg-secondary/60",
    iconClassName: "text-foreground",
  },
  "task.comment.add": {
    icon: MessageCircle,
    itemClassName: "border-border bg-card",
    iconClassName: "text-foreground",
  },
  "task.file.add": {
    icon: Upload,
    itemClassName: "border-border bg-card",
    iconClassName: "text-foreground",
  },
  "task.content.update": {
    icon: FileText,
    itemClassName: "border-border bg-card",
    iconClassName: "text-foreground",
  },
  "task.delete": {
    icon: Trash,
    itemClassName: "border-destructive/20 bg-destructive/5",
    iconClassName: "text-destructive",
  },
}

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case "done":
      return "default" as const
    case "review":
      return "outline" as const
    default:
      return "secondary" as const
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case "todo":
      return "To do"
    case "in_progress":
      return "In progress"
    case "review":
      return "In review"
    case "done":
      return "Done"
    default:
      return status
  }
}

const getTaskTitle = (details: Record<string, unknown>) => {
  const title = details.title ?? details.taskTitle
  if (typeof title === "string" && title.trim()) {
    return title
  }
  return "Untitled task"
}

const getActivityDescription = (
  actionType: string,
  details: Record<string, unknown>
) => {
  const taskTitle = getTaskTitle(details)

  switch (actionType) {
    case "task.create":
      return `created the task "${taskTitle}"`
    case "task.update": {
      const updatedFields = Array.isArray(details.updatedFields)
        ? details.updatedFields
        : []
      const friendlyFields = updatedFields
        .map((field: string) => {
          switch (field) {
            case "updatedAt":
              return null
            case "title":
              return "title"
            case "description":
              return "description"
            case "status":
              return "status"
            case "priority":
              return "priority"
            case "assignedTo":
              return "assignee"
            case "startDate":
              return "start date"
            case "endDate":
            case "dueDate":
              return "due date"
            case "tags":
              return "tags"
            case "content":
              return "content"
            default:
              return field
          }
        })
        .filter(Boolean)

      if (friendlyFields.length === 0) {
        return `updated task "${taskTitle}"`
      }
      return `updated ${friendlyFields.join(", ")} in task "${taskTitle}"`
    }
    case "task.status.change":
    case "task.status_change": {
      const fromStatus = (details.fromStatus || details.from) as string | undefined
      const toStatus = (details.toStatus || details.to) as string | undefined

      if (toStatus === "done") {
        return `marked task "${taskTitle}" as done`
      }

      if (fromStatus && toStatus && fromStatus !== toStatus) {
        return `moved task "${taskTitle}" from ${getStatusLabel(fromStatus)} to ${getStatusLabel(toStatus)}`
      }

      if (toStatus) {
        return `changed task "${taskTitle}" status to ${getStatusLabel(toStatus)}`
      }

      return `updated task "${taskTitle}" status`
    }
    case "task.assign":
      return `updated assignee in task "${taskTitle}"`
    case "task.comment.add":
      return `added a comment to task "${taskTitle}"`
    case "task.file.add":
      return details.fileName
        ? `uploaded file "${String(details.fileName)}" to task "${taskTitle}"`
        : `uploaded a file to task "${taskTitle}"`
    case "task.content.update":
      return `updated task "${taskTitle}" description`
    case "task.delete":
      return `deleted the task "${taskTitle}"`
    default:
      return "performed an action"
  }
}

function ActivityLogLoading() {
  return <Spinner fullHeight={false} className="py-8" iconClassName="size-5" />
}

export default function ActivityLog({ taskId }: ActivityLogProps) {
  const activities = useQuery(apiAny.activityLog.getForTask, { taskId })

  if (!activities) {
    return <ActivityLogLoading />
  }

  if (activities.length === 0) {
    return (
      <Empty className="py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Clock />
          </EmptyMedia>
          <EmptyTitle>No activity yet</EmptyTitle>
          <EmptyDescription>
            Changes to this task will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {activities.map((activity) => {
        const meta = activityMetaByType[activity.actionType] ?? {
          icon: Clock,
          itemClassName: "border-border bg-card",
          iconClassName: "text-muted-foreground",
        }
        const Icon = meta.icon

        return (
          <div
            key={activity._id}
            className={cn(
              "relative flex items-start gap-3 rounded-lg border p-4",
              meta.itemClassName
            )}
          >
            <div className="flex shrink-0 items-center justify-center rounded-full border border-border/70 bg-background p-2">
              <Icon className={cn("size-4", meta.iconClassName)} />
            </div>

            <Avatar className="size-8 shrink-0">
              <AvatarImage src={activity.userImageUrl} alt={activity.userName || "User"} />
              <AvatarFallback className="text-xs">
                {activity.userName?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="text-sm">
                <span className="font-medium text-foreground">
                  {activity.userName || "Unknown user"}
                </span>
                <span className="ml-1 text-muted-foreground">
                  {getActivityDescription(activity.actionType, activity.details)}
                </span>
              </div>

              {(activity.actionType === "task.status.change" ||
                activity.actionType === "task.status_change") &&
                (() => {
                  const fromStatus = (activity.details.fromStatus ||
                    activity.details.from) as string | undefined
                  const toStatus = (activity.details.toStatus ||
                    activity.details.to) as string | undefined
                  if (!fromStatus || !toStatus) return null

                  return (
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant={statusBadgeVariant(fromStatus)}>
                        {getStatusLabel(fromStatus)}
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant={statusBadgeVariant(toStatus)}>
                        {getStatusLabel(toStatus)}
                      </Badge>
                    </div>
                  )
                })()}

              {activity.actionType === "task.comment.add" &&
                activity.details.commentPreview && (
                  <div className="mt-2 rounded-md border bg-background/70 p-2 text-xs italic text-muted-foreground">
                    "{activity.details.commentPreview}..."
                  </div>
                )}

              {activity.actionType === "task.file.add" && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="size-4" />
                  <span>{activity.details.fileType} file</span>
                </div>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
        )
      })}
    </div>
  )
}
