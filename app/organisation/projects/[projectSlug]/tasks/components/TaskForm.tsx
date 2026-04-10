"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Loader2 } from "lucide-react";

import { useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Doc, Id } from "@/convex/_generated/dataModel";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import { DatePicker } from "@/components/ui/date-picker";
import { Checkbox } from "@/components/ui/checkbox";



const taskFormSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    status: z.enum(["todo", "in_progress", "review", "done"]).optional(),
    assignedTo: z.string().nullable().optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
});
  
type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
    projectId: Id<"projects">;
    teamId: Id<"teams">;
    teamMembers: { clerkUserId: string; name: string; }[];
    task?: Doc<"tasks">;
    onTaskCreated?: () => void;
    setIsOpen: (isOpen: boolean) => void;
}
  
export default function TaskForm({ projectId, teamId, teamMembers, task, onTaskCreated, setIsOpen }: TaskFormProps) {
    const [singleDayTask, setSingleDayTask] = useState(false);
    const [isAllDay, setIsAllDay] = useState(false);
    const [startTime, setStartTime] = useState("09:00");
    const [endTime, setEndTime] = useState("");
    const [hasEndTime, setHasEndTime] = useState(false);

    const updateTask = useMutation(apiAny.tasks.updateTask);
    const createTask = useMutation(apiAny.tasks.createTask);

    const form = useForm<TaskFormValues>({
      resolver: zodResolver(taskFormSchema),
      defaultValues: task
        ? {
            title: task.title,
            description: task.description,
            priority: task.priority as TaskFormValues["priority"],
            status: task.status as TaskFormValues["status"],
            assignedTo: task.assignedTo || undefined,
            startDate: task.startDate ? new Date(task.startDate) : undefined,
            endDate: task.endDate ? new Date(task.endDate) : undefined,
          }
        : {
            title: "",
            description: "",
            priority: undefined,
            status: "todo",
            assignedTo: "",
            startDate: undefined,
            endDate: undefined,
          },
    });

    useEffect(() => {
      if (task) {
        const startDate = task.startDate ? new Date(task.startDate) : undefined;
        const endDate = task.endDate ? new Date(task.endDate) : undefined;
        
        form.reset({
            title: task.title,
            description: task.description,
            priority: task.priority as TaskFormValues["priority"],
            status: task.status as TaskFormValues["status"],
            assignedTo: task.assignedTo || undefined,
            startDate: startDate,
            endDate: endDate,
        });
        
        const isSingleDayTask =
          Boolean(task.startDate && task.endDate) &&
          new Date(task.startDate!).toDateString() === new Date(task.endDate!).toDateString();
        setSingleDayTask(isSingleDayTask);

        const hasStartTime = Boolean(startDate) && (startDate!.getHours() !== 0 || startDate!.getMinutes() !== 0);
        const hasEndTimeValue = Boolean(endDate) && (endDate!.getHours() !== 0 || endDate!.getMinutes() !== 0);
        const hasSpecificTime = hasStartTime || hasEndTimeValue;

        setIsAllDay(!hasSpecificTime);

        if (hasStartTime && startDate) {
          setStartTime(`${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`);
        } else {
          setStartTime("09:00");
        }

        if (hasEndTimeValue && endDate) {
          const endTimeStr = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;
          const startTimeStr = startDate
            ? `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`
            : "";
          if (!hasStartTime || endTimeStr !== startTimeStr) {
            setEndTime(endTimeStr);
            setHasEndTime(true);
          } else {
            setEndTime("");
            setHasEndTime(false);
          }
        } else {
          setEndTime("");
          setHasEndTime(false);
        }
      } else {
        form.reset({
          title: "",
          description: "",
          priority: undefined,
          status: "todo",
          assignedTo: "",
          startDate: undefined,
          endDate: undefined,
        });
        setSingleDayTask(false);
        setIsAllDay(false);
        setStartTime("09:00");
        setEndTime("");
        setHasEndTime(false);
      }
    }, [task, form]);

    const onSubmit = async (values: TaskFormValues) => {
      try {
        let startDateTimestamp: number | undefined;
        let endDateTimestamp: number | undefined;

        // Handle start date with time
        if (values.startDate) {
            if (isAllDay) {
                // All day - use midnight UTC
                startDateTimestamp = values.startDate.getTime();
            } else {
                // Specific time - combine date with time
                const [hours, minutes] = startTime.split(':').map(Number);
                const dateWithTime = new Date(values.startDate);
                dateWithTime.setHours(hours, minutes, 0, 0);
                startDateTimestamp = dateWithTime.getTime();
            }
        }

        // Handle end date with time
        if (values.endDate) {
            if (isAllDay) {
                // All day - use midnight UTC
                endDateTimestamp = values.endDate.getTime();
            } else {
                // Specific time - if endTime is provided, use it; otherwise use same as start
                if (hasEndTime && endTime) {
                    const [hours, minutes] = endTime.split(':').map(Number);
                    const dateWithTime = new Date(values.endDate);
                    dateWithTime.setHours(hours, minutes, 0, 0);
                    endDateTimestamp = dateWithTime.getTime();
                } else if (startTime) {
                    // No end time specified, use start time (event/reminder type)
                    const [hours, minutes] = startTime.split(':').map(Number);
                    const dateWithTime = new Date(values.endDate);
                    dateWithTime.setHours(hours, minutes, 0, 0);
                    endDateTimestamp = dateWithTime.getTime();
                } else {
                    endDateTimestamp = values.endDate.getTime();
                }
            }
        }

        const submissionData = {
            title: values.title,
            description: values.description,
            priority: values.priority,
            status: values.status || "todo",
            assignedTo: values.assignedTo,
            startDate: startDateTimestamp,
            endDate: endDateTimestamp,
        };

        if (task) {
          await updateTask({
            taskId: task._id,
            ...submissionData,
          });
          toast.success("Task updated");
        } else {
          await createTask({
            projectId,
            teamId,
            ...submissionData,
            tags: [], 
          });
          toast.success("Task created");
          form.reset();
        }
        onTaskCreated?.();
        setIsOpen(false);
      } catch (error) {
        toast.error("Something went wrong");
        console.error(error);
      }
    };
  
    return (
        <div className="flex flex-col gap-4">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g. Implement new feature" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="todo">To Do</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="review">Review</SelectItem>
                                <SelectItem value="done">Done</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select onValueChange={(value) => field.onChange(value === "none" ? undefined : value)} value={field.value || "none"}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="none">No priority</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
                <FormField
                    control={form.control}
                    name="assignedTo"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Assign to</FormLabel>
                        <Select onValueChange={(value) => field.onChange(value === "none" ? undefined : value)} value={field.value || "none"}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select a team member" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="none">No assignee</SelectItem>
                            {teamMembers?.map((member) => (
                                <SelectItem key={member.clerkUserId} value={member.clerkUserId}>
                                    {member.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                {/* Date and Time Options */}
                <div className="flex flex-col gap-4 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-base font-medium">Date & Time</Label>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="all-day"
                                checked={isAllDay}
                                onCheckedChange={(checked) => setIsAllDay(checked as boolean)}
                            />
                            <Label htmlFor="all-day" className="text-sm font-normal cursor-pointer">
                                All day
                            </Label>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="single-day"
                            checked={singleDayTask}
                            onCheckedChange={(checked) => {
                                setSingleDayTask(checked as boolean);
                                if (checked) {
                                    const currentStartDate = form.watch("startDate");
                                    if (currentStartDate) {
                                        form.setValue("endDate", currentStartDate);
                                    }
                                }
                            }}
                        />
                        <Label htmlFor="single-day" className="text-sm font-normal cursor-pointer">
                            Single day event
                        </Label>
                    </div>

                    <div className="flex flex-col gap-4">
                        {/* Date Selection */}
                        <div className={singleDayTask ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 sm:grid-cols-2 gap-4"}>
                            {/* Start Date */}
                            <FormField
                                control={form.control}
                                name="startDate"
                                render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>{singleDayTask ? "Date" : "Start Date"}</FormLabel>
                                    <DatePicker
                                        date={field.value}
                                        onDateChange={(date) => {
                                            field.onChange(date);
                                            if (singleDayTask && date) {
                                                form.setValue("endDate", date);
                                            }
                                        }}
                                    />
                                    <FormMessage />
                                </FormItem>
                                )}
                            />

                            {/* End Date - only for multi-day */}
                            {!singleDayTask && (
                                <FormField
                                    control={form.control}
                                    name="endDate"
                                    render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>End Date</FormLabel>
                                        <DatePicker
                                            date={field.value}
                                            onDateChange={field.onChange}
                                        />
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            )}
                        </div>

                        {/* Time Selection - shown when "All day" is unchecked */}
                        {!isAllDay && (
                            <div className="flex flex-col gap-3">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-sm text-muted-foreground">Start Time</Label>
                                        <Input
                                            type="time"
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            className="mt-1"
                                        />
                                    </div>
                                    {hasEndTime && (
                                        <div>
                                            <Label className="text-sm text-muted-foreground">End Time</Label>
                                            <Input
                                                type="time"
                                                value={endTime}
                                                onChange={(e) => setEndTime(e.target.value)}
                                                className="mt-1"
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="has-end-time"
                                        checked={hasEndTime}
                                        onCheckedChange={(checked) => {
                                            setHasEndTime(checked as boolean);
                                            if (checked && !endTime) {
                                                // Default to 1 hour after start time
                                                const [hours, minutes] = startTime.split(':').map(Number);
                                                const endHour = (hours + 1) % 24;
                                                setEndTime(`${String(endHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
                                            }
                                        }}
                                    />
                                    <Label htmlFor="has-end-time" className="text-sm font-normal cursor-pointer">
                                        Specify end time (default: event/reminder at specific time)
                                    </Label>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Add a more detailed description..."
                                    className="resize-none"
                                    {...field}
                                    value={field.value ?? ""}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" disabled={form.formState.isSubmitting} className="w-full sm:w-auto">
                    {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {task ? "Save Changes" : "Create Task"}
                </Button>
                </form>
            </Form>
        </div>
    );
} 
