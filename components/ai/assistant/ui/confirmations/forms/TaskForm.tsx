import { useEffect, useRef, useState } from "react";
import { format, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TaskForm({
    data,
    onUpdate,
    teamMembers,
}: {
    data: Record<string, unknown>;
    onUpdate: (u: Record<string, unknown>) => void;
    teamMembers?: Array<{ clerkUserId: string; name?: string; email?: string }>;
}) {
    const [startDate, setStartDate] = useState<Date | undefined>(() => {
        if (!data.startDate) return undefined;
        const d = new Date(String(data.startDate));
        return isValid(d) ? d : undefined;
    });
    const [endDate, setEndDate] = useState<Date | undefined>(() => {
        if (!data.endDate) return undefined;
        const d = new Date(String(data.endDate));
        return isValid(d) ? d : undefined;
    });
    const [startTime, setStartTime] = useState(startDate ? format(startDate, "HH:mm") : "11:00");
    const [endTime, setEndTime] = useState(endDate ? format(endDate, "HH:mm") : "12:00");
    const assignedToValue = data.assignedTo ? String(data.assignedTo) : "unassigned";
    const priorityValue = typeof data.priority === "string" ? data.priority : "none";
    const statusValue = typeof data.status === "string" ? data.status : "todo";
    const tagsValue = Array.isArray(data.tags) ? data.tags.join(", ") : String(data.tags || "");
    const onUpdateRef = useRef(onUpdate);
    const startDateIsoRef = useRef(
        typeof data.startDate === "string" ? data.startDate : undefined
    );
    const endDateIsoRef = useRef(
        typeof data.endDate === "string" ? data.endDate : undefined
    );

    useEffect(() => {
        onUpdateRef.current = onUpdate;
    }, [onUpdate]);

    useEffect(() => {
        startDateIsoRef.current =
            typeof data.startDate === "string" ? data.startDate : undefined;
    }, [data.startDate]);

    useEffect(() => {
        endDateIsoRef.current =
            typeof data.endDate === "string" ? data.endDate : undefined;
    }, [data.endDate]);

    useEffect(() => {
        if (startDate) {
            const [hours, minutes] = startTime.split(':').map(Number);
            const newDate = new Date(startDate);
            newDate.setHours(hours || 0, minutes || 0);
            if (newDate.toISOString() !== startDateIsoRef.current) {
                onUpdateRef.current({ startDate: newDate.toISOString() });
            }
        }
    }, [startDate, startTime]);

    useEffect(() => {
        if (endDate) {
            const [hours, minutes] = endTime.split(':').map(Number);
            const newDate = new Date(endDate);
            newDate.setHours(hours || 0, minutes || 0);
            if (newDate.toISOString() !== endDateIsoRef.current) {
                onUpdateRef.current({ endDate: newDate.toISOString() });
            }
        }
    }, [endDate, endTime]);

    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</Label>
                <Input
                    value={String(data.title || data.name || "")}
                    onChange={(e) => onUpdate({ title: e.target.value })}
                    className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30 text-base font-medium"
                    placeholder="Enter title"
                />
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</Label>
                <Input
                    value={String(data.description || "")}
                    onChange={(e) => onUpdate({ description: e.target.value })}
                    className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                    placeholder="Add description"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</Label>
                    <Select
                        value={statusValue}
                        onValueChange={(value) => onUpdate({ status: value })}
                    >
                        <SelectTrigger className="h-9 rounded-md border border-border/60 bg-card px-3 shadow-none">
                            <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="review">Review</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority</Label>
                    <Select
                        value={priorityValue}
                        onValueChange={(value) => onUpdate({ priority: value === "none" ? undefined : value })}
                    >
                        <SelectTrigger className="h-9 rounded-md border border-border/60 bg-card px-3 shadow-none">
                            <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">No priority</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assigned To</Label>
                <Select
                    value={assignedToValue}
                    onValueChange={(value) => {
                        const selected = teamMembers?.find((member) => member.clerkUserId === value);
                        if (value === "unassigned") {
                            onUpdate({ assignedTo: null, assignedToName: undefined });
                            return;
                        }
                        onUpdate({
                            assignedTo: value,
                            assignedToName: selected?.name || selected?.email,
                        });
                    }}
                >
                    <SelectTrigger className="h-9 rounded-md border border-border/60 bg-card px-3 shadow-none">
                        <SelectValue placeholder="Select a person" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {teamMembers?.map((member) => (
                            <SelectItem key={member.clerkUserId} value={member.clerkUserId}>
                                {member.name || member.email || "Unknown"}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tags</Label>
                <Input
                    value={tagsValue}
                    onChange={(e) => {
                        const nextTags = e.target.value
                            .split(",")
                            .map((tag) => tag.trim())
                            .filter(Boolean);
                        onUpdate({ tags: nextTags.length > 0 ? nextTags : undefined });
                    }}
                    className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                    placeholder="e.g. meeting, painter"
                />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Start Time</Label>
                    <div className="flex gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal h-9 rounded-md border border-border/60 bg-card px-3 shadow-none",
                                        !startDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                    <span className="truncate">{startDate ? format(startDate, "MMM d, yyyy") : "Pick date"}</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <Input
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="h-9 w-[108px] rounded-md border border-border/60 bg-card px-2 shadow-none"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">End Time</Label>
                    <div className="flex gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal h-9 rounded-md border border-border/60 bg-card px-3 shadow-none",
                                        !endDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                    <span className="truncate">{endDate ? format(endDate, "MMM d, yyyy") : "Pick date"}</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <Input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="h-9 w-[108px] rounded-md border border-border/60 bg-card px-2 shadow-none"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
