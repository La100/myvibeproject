"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Trash2, Tags, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useI18n } from "@/lib/i18n";

interface TaskStatusSetting {
  name: string;
  color: string;
}

interface TeamMemberWithUser {
  _id: Id<"teamMembers">;
  clerkUserId: string;
  name: string;
  email: string;
  imageUrl?: string;
  role: "admin" | "member";
}

interface TaskDetailSidebarProps {
  task: {
    _id: Id<"tasks">;
    status: string;
    priority?: string | null;
    startDate?: number;
    endDate?: number;
    assignedTo?: string | null;
    assignedToName?: string;
    estimatedHours?: number;
    tags?: string[];
    teamId: Id<"teams">;
    projectId: Id<"projects">;
  };
  project: {
    taskStatusSettings?: Record<string, TaskStatusSetting>;
  };
  onDelete: () => void;
  className?: string;
}

export default function TaskDetailSidebar({
  task,
  project,
  onDelete,
  className,
}: TaskDetailSidebarProps) {
  const { t } = useI18n();
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState(task.tags?.join(", ") || "");
  const [isAllDay, setIsAllDay] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("");
  const [hasEndTime, setHasEndTime] = useState(false);

  const updateTask = useMutation(apiAny.tasks.updateTask);
  const deleteTask = useMutation(apiAny.tasks.deleteTask);
  
  const teamMembers = useQuery(apiAny.teams.getTeamMembers, { teamId: task.teamId });

  useEffect(() => {
    const startDate = task.startDate ? new Date(task.startDate) : undefined;
    const endDate = task.endDate ? new Date(task.endDate) : undefined;
    const hasStartTimeValue =
      Boolean(startDate) &&
      (startDate!.getHours() !== 0 || startDate!.getMinutes() !== 0);
    const hasEndTimeValue =
      Boolean(endDate) &&
      (endDate!.getHours() !== 0 || endDate!.getMinutes() !== 0);

    setIsAllDay(!(hasStartTimeValue || hasEndTimeValue));

    if (hasStartTimeValue && startDate) {
      setStartTime(
        `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`,
      );
    } else {
      setStartTime("09:00");
    }

    if (hasEndTimeValue && endDate) {
      const nextEndTime = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;
      const nextStartTime = startDate
        ? `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`
        : "";

      if (!hasStartTimeValue || nextEndTime !== nextStartTime) {
        setHasEndTime(true);
        setEndTime(nextEndTime);
      } else {
        setHasEndTime(false);
        setEndTime("");
      }
    } else {
      setHasEndTime(false);
      setEndTime("");
    }
  }, [task.startDate, task.endDate]);

  const timestampWithTime = (date: Date, timeValue?: string) => {
    const nextDate = new Date(date);
    if (!timeValue) {
      nextDate.setHours(0, 0, 0, 0);
      return nextDate.getTime();
    }

    const [hours, minutes] = timeValue.split(":").map(Number);
    nextDate.setHours(hours, minutes, 0, 0);
    return nextDate.getTime();
  };

  const getStartTimestamp = (
    date: Date,
    options?: { allDay?: boolean; startTimeValue?: string },
  ) => {
    const allDay = options?.allDay ?? isAllDay;
    const nextStartTime = options?.startTimeValue ?? startTime;

    if (allDay) {
      return timestampWithTime(date);
    }
    return timestampWithTime(date, nextStartTime);
  };

  const getEndTimestamp = (
    date: Date,
    options?: {
      allDay?: boolean;
      startTimeValue?: string;
      endTimeValue?: string;
      hasEndTimeValue?: boolean;
    },
  ) => {
    const allDay = options?.allDay ?? isAllDay;
    const nextStartTime = options?.startTimeValue ?? startTime;
    const nextEndTime = options?.endTimeValue ?? endTime;
    const nextHasEndTime = options?.hasEndTimeValue ?? hasEndTime;

    if (allDay) {
      return timestampWithTime(date);
    }
    return timestampWithTime(date, nextHasEndTime && nextEndTime ? nextEndTime : nextStartTime);
  };

  const handleUpdate = async (field: string, value: string | string[] | number | undefined | null) => {
    setIsUpdating(field);
    try {
      await updateTask({
        taskId: task._id,
        [field]: value,
      });
      toast.success(t("taskDetail", "changesSaved"));
    } catch (error) {
      toast.error(t("taskDetail", "errorSavingChanges"), {
        description: toUserFacingErrorMessage(error),
      });
      console.error(error);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleStartDateUpdate = async (date: Date | undefined) => {
    setIsUpdating('startDate');
     try {
      const nextStartDate = date ? getStartTimestamp(date) : undefined;
      const nextEndDate = task.endDate;

      if (
        typeof nextStartDate === "number" &&
        typeof nextEndDate === "number" &&
        nextEndDate < nextStartDate
      ) {
        toast.error(t("taskDetail", "endDateBeforeStartDate"));
        return;
      }

      await updateTask({
        taskId: task._id,
        startDate: nextStartDate,
      });
      toast.success(t("taskDetail", "startDateUpdated"));
    } catch (error) {
      toast.error(t("taskDetail", "errorUpdatingStartDate"), {
        description: toUserFacingErrorMessage(error),
      });
      console.error(error);
    } finally {
      setIsUpdating(null);
    }
  }

  const handleEndDateUpdate = async (date: Date | undefined) => {
    setIsUpdating('endDate');
     try {
      const nextEndDate = date ? getEndTimestamp(date) : undefined;
      const nextStartDate = task.startDate;

      if (
        typeof nextStartDate === "number" &&
        typeof nextEndDate === "number" &&
        nextEndDate < nextStartDate
      ) {
        toast.error(t("taskDetail", "endDateBeforeStartDate"));
        return;
      }

      await updateTask({
        taskId: task._id,
        endDate: nextEndDate,
      });
      toast.success(t("taskDetail", "endDateUpdated"));
    } catch (error) {
      toast.error(t("taskDetail", "errorUpdatingEndDate"), {
        description: toUserFacingErrorMessage(error),
      });
      console.error(error);
    } finally {
      setIsUpdating(null);
    }
  }

  const handleTagsUpdate = () => {
    const newTags = tagsInput.split(",").map(tag => tag.trim()).filter(Boolean);
    handleUpdate('tags', newTags);
  };

  const handleDeleteTask = async () => {
    try {
      await deleteTask({ taskId: task._id });
      toast.success(t("taskDetail", "taskDeleted"));
      onDelete();
    } catch (error) {
      toast.error(t("taskDetail", "errorDeletingTask"), {
        description: toUserFacingErrorMessage(error),
      });
    }
  };

  const handleAllDayChange = async (checked: boolean) => {
    setIsAllDay(checked);

    if (!task.startDate && !task.endDate) {
      return;
    }

    setIsUpdating("dateTime");
    try {
      await updateTask({
        taskId: task._id,
        startDate: task.startDate
          ? getStartTimestamp(new Date(task.startDate), { allDay: checked })
          : undefined,
        endDate: task.endDate
          ? getEndTimestamp(new Date(task.endDate), { allDay: checked })
          : undefined,
      });
      toast.success(
        checked ? t("taskDetail", "timeRemoved") : t("taskDetail", "timeEnabled"),
      );
    } catch (error) {
      setIsAllDay(!checked);
      toast.error(t("taskDetail", "errorUpdatingTimeSettings"), {
        description: toUserFacingErrorMessage(error),
      });
      console.error(error);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleStartTimeUpdate = async (value: string) => {
    if (!task.startDate) return;

    setIsUpdating("startTime");
    try {
      const payload: {
        taskId: Id<"tasks">;
        startDate: number;
        endDate?: number;
      } = {
        taskId: task._id,
        startDate: timestampWithTime(new Date(task.startDate), value),
      };

      if (task.endDate && !hasEndTime) {
        payload.endDate = timestampWithTime(new Date(task.endDate), value);
      }

      await updateTask(payload);
      toast.success(t("taskDetail", "startTimeUpdated"));
    } catch (error) {
      toast.error(t("taskDetail", "errorUpdatingStartTime"), {
        description: toUserFacingErrorMessage(error),
      });
      console.error(error);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleEndTimeUpdate = async (value: string) => {
    if (!task.endDate) return;

    setIsUpdating("endTime");
    try {
      await updateTask({
        taskId: task._id,
        endDate: timestampWithTime(new Date(task.endDate), value),
      });
      toast.success(t("taskDetail", "endTimeUpdated"));
    } catch (error) {
      toast.error(t("taskDetail", "errorUpdatingEndTime"), {
        description: toUserFacingErrorMessage(error),
      });
      console.error(error);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleHasEndTimeChange = async (checked: boolean) => {
    setHasEndTime(checked);

    if (checked && !endTime) {
      const [hours, minutes] = startTime.split(":").map(Number);
      const endHour = (hours + 1) % 24;
      setEndTime(
        `${String(endHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
      );
      return;
    }

    if (!checked && task.endDate) {
      await handleEndTimeUpdate(startTime);
      setEndTime("");
    }
  };

  

  const assignedMember = teamMembers?.find((m: TeamMemberWithUser) => m.clerkUserId === task.assignedTo);

  return (
    <Card className={cn("sticky top-24", className)}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{t("taskDetail", "taskDetails")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("taskDetail", "editFieldsDirectly")}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Status */}
        <div>
          <Label className="text-sm font-medium">{t("taskDetail", "status")}</Label>
          <Select 
            value={task.status} 
            onValueChange={(value) => handleUpdate('status', value)}
            disabled={isUpdating === 'status'}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(project.taskStatusSettings || {}).map(([id, { name }]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Priority */}
        <div>
          <Label className="text-sm font-medium">{t("taskDetail", "priority")}</Label>
          <Select
            value={task.priority || 'none'}
            onValueChange={(value) => handleUpdate('priority', value === 'none' ? null : value)}
            disabled={isUpdating === 'priority'}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder={t("taskDetail", "noPrioritySet")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">⚪ {t("taskDetail", "noPriority")}</SelectItem>
              <SelectItem value="low">🟢 {t("taskDetail", "low")}</SelectItem>
              <SelectItem value="medium">🟡 {t("taskDetail", "medium")}</SelectItem>
              <SelectItem value="high">🟠 {t("taskDetail", "high")}</SelectItem>
              <SelectItem value="urgent">🔴 {t("taskDetail", "urgent")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Assigned To */}
        <div>
          <Label className="text-sm font-medium flex items-center"><User className="mr-2 h-4 w-4"/>{t("taskDetail", "assignedTo")}</Label>
           <Select
            value={task.assignedTo || 'none'}
            onValueChange={(value) => handleUpdate('assignedTo', value === 'none' ? null : value)}
            disabled={isUpdating === 'assignedTo'}
          >
            <SelectTrigger className="mt-1">
                <div className="flex items-center gap-2">
                  {assignedMember ? (
                    <>
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={assignedMember.imageUrl} />
                        <AvatarFallback>{assignedMember.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span>{assignedMember.name}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">{t("taskDetail", "noAssignee")}</span>
                  )}
                </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("taskDetail", "noAssignee")}</SelectItem>
              {teamMembers?.map((member: TeamMemberWithUser) => (
                <SelectItem key={member.clerkUserId} value={member.clerkUserId!}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={member.imageUrl} />
                      <AvatarFallback>{member.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span>{member.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Start Date */}
        <div>
          <Label className="text-sm font-medium">{t("taskDetail", "startDate")}</Label>
          <DatePicker
            date={task.startDate ? new Date(task.startDate) : undefined}
            onDateChange={handleStartDateUpdate}
            placeholder={t("taskDetail", "setStartDate")}
            className="mt-1"
          />
          {isUpdating === 'startDate' && (
            <div className="flex items-center mt-1 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              {t("taskDetail", "updating")}
            </div>
          )}
        </div>

        {/* End Date */}
        <div>
          <Label className="text-sm font-medium">{t("taskDetail", "endDate")}</Label>
          <DatePicker
            date={task.endDate ? new Date(task.endDate) : undefined}
            onDateChange={handleEndDateUpdate}
            placeholder={t("taskDetail", "setEndDate")}
            className="mt-1"
          />
          {isUpdating === 'endDate' && (
            <div className="flex items-center mt-1 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              {t("taskDetail", "updating")}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="task-all-day" className="text-sm font-medium cursor-pointer">
              {t("taskDetail", "allDay")}
            </Label>
            <Checkbox
              id="task-all-day"
              checked={isAllDay}
              disabled={isUpdating === "dateTime"}
              onCheckedChange={(checked) => handleAllDayChange(Boolean(checked))}
            />
          </div>

          {isUpdating === "dateTime" && (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              {t("taskDetail", "updating")}
            </div>
          )}

          {!isAllDay && (
            <div className="flex flex-col gap-3">
              <div className={hasEndTime ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "grid grid-cols-1"}>
                <div>
                  <Label className="text-sm text-muted-foreground">{t("taskDetail", "startTime")}</Label>
                  <Input
                    type="time"
                    value={startTime}
                    disabled={!task.startDate || isUpdating === "startTime"}
                    onChange={(e) => setStartTime(e.target.value)}
                    onBlur={(e) => handleStartTimeUpdate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                    }}
                    className="mt-1"
                  />
                </div>

                {hasEndTime && (
                  <div>
                    <Label className="text-sm text-muted-foreground">{t("taskDetail", "endTime")}</Label>
                    <Input
                      type="time"
                      value={endTime}
                      disabled={!task.endDate || isUpdating === "endTime"}
                      onChange={(e) => setEndTime(e.target.value)}
                      onBlur={(e) => handleEndTimeUpdate(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="task-has-end-time"
                  checked={hasEndTime}
                  disabled={!task.endDate}
                  onCheckedChange={(checked) => handleHasEndTimeChange(Boolean(checked))}
                />
                <Label htmlFor="task-has-end-time" className="text-sm font-normal cursor-pointer">
                  {t("taskDetail", "specifyEndTime")}
                </Label>
              </div>
            </div>
          )}
        </div>

        {/* Tags */}
        <div>
          <Label className="text-sm font-medium flex items-center"><Tags className="mr-2 h-4 w-4"/>{t("taskDetail", "tags")}</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              onBlur={handleTagsUpdate}
              onKeyDown={(e) => e.key === 'Enter' && handleTagsUpdate()}
              placeholder={t("taskDetail", "tagsPlaceholder")}
              className="flex-grow"
            />
          </div>
           <div className="mt-2 flex flex-wrap gap-1">
            {task.tags?.map(tag => (
                <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
            </div>
        </div>

        {/* Delete Button */}
        <div className="pt-4 border-t">
           <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full">
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("taskDetail", "deleteTask")}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t("taskDetail", "deleteTaskTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t("taskDetail", "deleteTaskDescription")}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{t("taskDetail", "cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteTask} className={cn(buttonVariants({ variant: "destructive" }))}>
                        {t("taskDetail", "delete")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
           </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
} 
