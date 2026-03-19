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
}

export default function TaskDetailSidebar({ task, project, onDelete }: TaskDetailSidebarProps) {
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
      toast.success("Changes saved");
    } catch (error) {
      toast.error("Error saving changes");
      console.error(error);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleStartDateUpdate = async (date: Date | undefined) => {
    setIsUpdating('startDate');
     try {
      await updateTask({
        taskId: task._id,
        startDate: date ? getStartTimestamp(date) : undefined,
      });
      toast.success("Start date updated");
    } catch (error) {
      toast.error("Error updating start date");
      console.error(error);
    } finally {
      setIsUpdating(null);
    }
  }

  const handleEndDateUpdate = async (date: Date | undefined) => {
    setIsUpdating('endDate');
     try {
      await updateTask({
        taskId: task._id,
        endDate: date ? getEndTimestamp(date) : undefined,
      });
      toast.success("End date updated");
    } catch (error) {
      toast.error("Error updating end date");
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
      toast.success("Task deleted");
      onDelete();
    } catch {
      toast.error("Error deleting task");
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
      toast.success(checked ? "Time removed" : "Time enabled");
    } catch (error) {
      setIsAllDay(!checked);
      toast.error("Error updating time settings");
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
      toast.success("Start time updated");
    } catch (error) {
      toast.error("Error updating start time");
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
      toast.success("End time updated");
    } catch (error) {
      toast.error("Error updating end time");
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
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Task Details</CardTitle>
        <p className="text-sm text-muted-foreground">Edit fields directly</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status */}
        <div>
          <Label className="text-sm font-medium">Status</Label>
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
          <Label className="text-sm font-medium">Priority</Label>
          <Select
            value={task.priority || 'none'}
            onValueChange={(value) => handleUpdate('priority', value === 'none' ? null : value)}
            disabled={isUpdating === 'priority'}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="No priority set" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">⚪ No priority</SelectItem>
              <SelectItem value="low">🟢 Low</SelectItem>
              <SelectItem value="medium">🟡 Medium</SelectItem>
              <SelectItem value="high">🟠 High</SelectItem>
              <SelectItem value="urgent">🔴 Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Assigned To */}
        <div>
          <Label className="text-sm font-medium flex items-center"><User className="mr-2 h-4 w-4"/>Assigned to</Label>
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
                    <span className="text-muted-foreground">No assignee</span>
                  )}
                </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No assignee</SelectItem>
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
          <Label className="text-sm font-medium">Start Date</Label>
          <DatePicker
            date={task.startDate ? new Date(task.startDate) : undefined}
            onDateChange={handleStartDateUpdate}
            placeholder="Set start date"
            className="mt-1"
          />
          {isUpdating === 'startDate' && (
            <div className="flex items-center mt-1 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              Updating...
            </div>
          )}
        </div>

        {/* End Date */}
        <div>
          <Label className="text-sm font-medium">End Date</Label>
          <DatePicker
            date={task.endDate ? new Date(task.endDate) : undefined}
            onDateChange={handleEndDateUpdate}
            placeholder="Set end date"
            className="mt-1"
          />
          {isUpdating === 'endDate' && (
            <div className="flex items-center mt-1 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              Updating...
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="task-all-day" className="text-sm font-medium cursor-pointer">
              All day
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
              Updating...
            </div>
          )}

          {!isAllDay && (
            <div className="space-y-3">
              <div className={hasEndTime ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "grid grid-cols-1"}>
                <div>
                  <Label className="text-sm text-muted-foreground">Start Time</Label>
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
                    <Label className="text-sm text-muted-foreground">End Time</Label>
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

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="task-has-end-time"
                  checked={hasEndTime}
                  disabled={!task.endDate}
                  onCheckedChange={(checked) => handleHasEndTimeChange(Boolean(checked))}
                />
                <Label htmlFor="task-has-end-time" className="text-sm font-normal cursor-pointer">
                  Specify end time
                </Label>
              </div>
            </div>
          )}
        </div>

        {/* Tags */}
        <div>
          <Label className="text-sm font-medium flex items-center"><Tags className="mr-2 h-4 w-4"/>Tags</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              onBlur={handleTagsUpdate}
              onKeyDown={(e) => e.key === 'Enter' && handleTagsUpdate()}
              placeholder="Add tags, comma separated"
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
                    Delete Task
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure you want to delete this task?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the task and all associated data.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteTask} className={cn(buttonVariants({ variant: "destructive" }))}>
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
           </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
} 
