"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  ChevronRight,
  X,
  CheckSquare,
  ShoppingBag,
  Hammer,
  ClipboardList,
  FileText,
  Receipt,
  Flag,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
} from "date-fns";

// --- Types ---

type CalendarTask = {
  _id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority?: "low" | "medium" | "high" | "urgent" | null;
  startDate?: number;
  endDate?: number;
  assignedToName?: string;
};

type CalendarShoppingItem = {
  _id: string;
  name: string;
  notes?: string;
  buyBefore?: number;
  priority?: "low" | "medium" | "high" | "urgent";
  realizationStatus:
    | "PLANNED"
    | "ORDERED"
    | "IN_TRANSIT"
    | "DELIVERED"
    | "COMPLETED"
    | "CANCELLED";
  quantity: number;
  assignedToName?: string;
};

type CalendarLaborItem = {
  _id: string;
  name: string;
  notes?: string;
  quantity: number;
  unit: string;
  startDate?: number;
  endDate?: number;
  assignedToName?: string;
};

type CalendarSurvey = {
  _id: string;
  title: string;
  description?: string;
  status: "draft" | "active" | "closed";
  startDate?: number;
  endDate?: number;
  createdByName?: string;
};

type CalendarNote = {
  _id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  createdByName?: string;
};

type CalendarEstimation = {
  _id: string;
  title: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  estimationDate: number;
  plannedStartDate?: number;
  validUntil?: number;
  grossTotal?: number;
  createdByName?: string;
};

type CalendarProjectMilestone = {
  _id: string;
  type:
    | "project_start"
    | "project_end"
    | "planned_start"
    | "planned_end"
    | "actual_start"
    | "actual_end";
  title: string;
  timestamp: number;
  status?: "planned" | "in_progress" | "at_risk" | "blocked" | "completed";
  color?: string;
};

type EstimationDayEntry = {
  _id: string;
  title: string;
  status: CalendarEstimation["status"];
  dateType: "created" | "start" | "valid_until";
  timestamp: number;
  grossTotal?: number;
};

type DayData = {
  tasks: CalendarTask[];
  shopping: CalendarShoppingItem[];
  labor: CalendarLaborItem[];
  surveys: CalendarSurvey[];
  notes: CalendarNote[];
  estimations: EstimationDayEntry[];
  milestones: CalendarProjectMilestone[];
};

type EventType =
  | "task"
  | "shopping"
  | "labor"
  | "survey"
  | "note"
  | "estimation"
  | "project";

type CalendarResponse = {
  tasks: CalendarTask[];
  shoppingItems: CalendarShoppingItem[];
  laborItems: CalendarLaborItem[];
  surveys: CalendarSurvey[];
  notes: CalendarNote[];
  estimations: CalendarEstimation[];
  projectMilestones: CalendarProjectMilestone[];
};

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const statusBadgeColors: Record<string, string> = {
  todo: "bg-muted text-muted-foreground border-border",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  review: "bg-accent text-accent-foreground border-border",
  done: "bg-secondary text-secondary-foreground border-border",
};

const priorityBorderColors: Record<string, string> = {
  low: "border-l-border",
  medium: "border-l-primary/50",
  high: "border-l-accent",
  urgent: "border-l-destructive",
};

const shoppingStatusColors: Record<string, string> = {
  PLANNED: "bg-muted text-muted-foreground border-border",
  ORDERED: "bg-primary/10 text-primary border-primary/20",
  IN_TRANSIT: "bg-secondary text-secondary-foreground border-border",
  DELIVERED: "bg-accent text-accent-foreground border-border",
  COMPLETED: "bg-secondary text-secondary-foreground border-border",
  CANCELLED: "bg-destructive/10 text-destructive border-destructive/20",
};

const surveyStatusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  active: "bg-primary/10 text-primary border-primary/20",
  closed: "bg-secondary text-secondary-foreground border-border",
};

const estimationStatusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  sent: "bg-primary/10 text-primary border-primary/20",
  accepted: "bg-secondary text-secondary-foreground border-border",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  expired: "bg-accent text-accent-foreground border-border",
};

const milestoneStatusColors: Record<string, string> = {
  planned: "bg-muted text-muted-foreground border-border",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  at_risk: "bg-accent text-accent-foreground border-border",
  blocked: "bg-destructive/10 text-destructive border-destructive/20",
  completed: "bg-secondary text-secondary-foreground border-border",
};

// --- Helpers ---

function dateToStr(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function timestampToDateStr(timestamp: number): string {
  return format(new Date(timestamp), "yyyy-MM-dd");
}

function toMoney(value: number | undefined) {
  if (typeof value !== "number") return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getMilestoneDateTypeLabel(type: CalendarProjectMilestone["type"]) {
  switch (type) {
    case "project_start":
      return "Project start";
    case "project_end":
      return "Project deadline";
    case "planned_start":
      return "Planned start";
    case "planned_end":
      return "Planned deadline";
    case "actual_start":
      return "Actual start";
    case "actual_end":
      return "Completed";
    default:
      return "Milestone";
  }
}

// --- Skeleton ---

export function ProjectCalendarSkeleton() {
  return <Spinner className="h-full rounded-xl border bg-card" />;
}

// --- Main Component ---

export default function ProjectCalendar() {
  const { project } = useProject();

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<EventType>>(
    new Set(["task", "shopping", "labor", "survey", "note", "estimation", "project"]),
  );

  const calendarData = useQuery(
    apiAny.calendar.getProjectCalendarData,
    { projectId: project._id, month: currentMonth },
  ) as CalendarResponse | undefined;

  const [year, monthIdx] = useMemo(() => {
    const [y, m] = currentMonth.split("-");
    return [parseInt(y, 10), parseInt(m, 10) - 1] as const;
  }, [currentMonth]);

  const monthDate = useMemo(() => new Date(year, monthIdx, 1), [year, monthIdx]);

  const allDays = useMemo(() => {
    const mStart = startOfMonth(monthDate);
    const mEnd = endOfMonth(monthDate);
    const calStart = startOfWeek(mStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(mEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [monthDate]);

  const dayDataMap = useMemo(() => {
    const map = new Map<string, DayData>();
    if (!calendarData) return map;

    const initDay = (key: string): DayData => {
      if (!map.has(key)) {
        map.set(key, {
          tasks: [],
          shopping: [],
          labor: [],
          surveys: [],
          notes: [],
          estimations: [],
          milestones: [],
        });
      }
      return map.get(key)!;
    };

    // Tasks (range)
    for (const task of calendarData.tasks) {
      const start = task.startDate;
      const end = task.endDate;
      if (!start && !end) continue;

      const taskStart = new Date(start || end!);
      const taskEnd = new Date(end || start!);

      const rangeStart = allDays[0] > taskStart ? allDays[0] : taskStart;
      const rangeEnd = allDays[allDays.length - 1] < taskEnd ? allDays[allDays.length - 1] : taskEnd;

      if (rangeStart > rangeEnd) {
        initDay(timestampToDateStr(start || end!)).tasks.push(task);
        continue;
      }

      const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
      for (const day of days) {
        initDay(dateToStr(day)).tasks.push(task);
      }
    }

    // Shopping (single date)
    for (const item of calendarData.shoppingItems) {
      if (!item.buyBefore) continue;
      initDay(timestampToDateStr(item.buyBefore)).shopping.push(item);
    }

    // Labor (range)
    for (const item of calendarData.laborItems) {
      const start = item.startDate;
      const end = item.endDate;
      if (!start && !end) continue;

      const laborStart = new Date(start || end!);
      const laborEnd = new Date(end || start!);

      const rangeStart = allDays[0] > laborStart ? allDays[0] : laborStart;
      const rangeEnd = allDays[allDays.length - 1] < laborEnd ? allDays[allDays.length - 1] : laborEnd;

      if (rangeStart > rangeEnd) {
        initDay(timestampToDateStr(start || end!)).labor.push(item);
        continue;
      }

      const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
      for (const day of days) {
        initDay(dateToStr(day)).labor.push(item);
      }
    }

    // Surveys (range)
    for (const survey of calendarData.surveys) {
      const start = survey.startDate;
      const end = survey.endDate;
      if (!start && !end) continue;

      const surveyStart = new Date(start || end!);
      const surveyEnd = new Date(end || start!);

      const rangeStart = allDays[0] > surveyStart ? allDays[0] : surveyStart;
      const rangeEnd = allDays[allDays.length - 1] < surveyEnd ? allDays[allDays.length - 1] : surveyEnd;

      if (rangeStart > rangeEnd) {
        initDay(timestampToDateStr(start || end!)).surveys.push(survey);
        continue;
      }

      const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
      for (const day of days) {
        initDay(dateToStr(day)).surveys.push(survey);
      }
    }

    // Notes (createdAt)
    for (const note of calendarData.notes) {
      initDay(timestampToDateStr(note.createdAt)).notes.push(note);
    }

    // Estimations (multiple date types)
    for (const estimation of calendarData.estimations) {
      initDay(timestampToDateStr(estimation.estimationDate)).estimations.push({
        _id: `${estimation._id}-created`,
        title: estimation.title,
        status: estimation.status,
        dateType: "created",
        timestamp: estimation.estimationDate,
        grossTotal: estimation.grossTotal,
      });

      if (estimation.plannedStartDate) {
        initDay(timestampToDateStr(estimation.plannedStartDate)).estimations.push({
          _id: `${estimation._id}-start`,
          title: estimation.title,
          status: estimation.status,
          dateType: "start",
          timestamp: estimation.plannedStartDate,
          grossTotal: estimation.grossTotal,
        });
      }

      if (estimation.validUntil) {
        initDay(timestampToDateStr(estimation.validUntil)).estimations.push({
          _id: `${estimation._id}-valid`,
          title: estimation.title,
          status: estimation.status,
          dateType: "valid_until",
          timestamp: estimation.validUntil,
          grossTotal: estimation.grossTotal,
        });
      }
    }

    // Project milestones
    for (const milestone of calendarData.projectMilestones) {
      initDay(timestampToDateStr(milestone.timestamp)).milestones.push(milestone);
    }

    return map;
  }, [calendarData, allDays]);

  const goToPrevMonth = () => {
    const d = new Date(year, monthIdx - 1, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    const d = new Date(year, monthIdx + 1, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setSelectedDate(null);
  };

  const toggleType = (type: EventType) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const selectedDayData = useMemo(() => {
    if (!selectedDate) return null;
    return (
      dayDataMap.get(selectedDate) || {
        tasks: [],
        shopping: [],
        labor: [],
        surveys: [],
        notes: [],
        estimations: [],
        milestones: [],
      }
    );
  }, [selectedDate, dayDataMap]);

  if (calendarData === undefined) {
    return <ProjectCalendarSkeleton />;
  }

  const hasDayContent = (dayData: DayData | undefined, key: EventType) => {
    if (!dayData) return false;
    switch (key) {
      case "task":
        return dayData.tasks.length > 0;
      case "shopping":
        return dayData.shopping.length > 0;
      case "labor":
        return dayData.labor.length > 0;
      case "survey":
        return dayData.surveys.length > 0;
      case "note":
        return dayData.notes.length > 0;
      case "estimation":
        return dayData.estimations.length > 0;
      case "project":
        return dayData.milestones.length > 0;
      default:
        return false;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <ProjectPageHeader
        title="Calendar"
        icon={<CalendarDays className="h-8 w-8 text-primary" />}
        subtitle={`Timeline and planning for ${project.name}`}
      />
      <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[160px] text-center">
            {format(monthDate, "MMMM yyyy")}
          </h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button
            variant={visibleTypes.has("task") ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => toggleType("task")}
          >
            <div className="h-2 w-2 rounded-full bg-primary" />
            Tasks
          </Button>
          <Button
            variant={visibleTypes.has("shopping") ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => toggleType("shopping")}
          >
            <div className="h-2 w-2 rounded-full bg-secondary" />
            Shopping
          </Button>
          <Button
            variant={visibleTypes.has("labor") ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => toggleType("labor")}
          >
            <div className="h-2 w-2 rounded-full bg-accent" />
            Labor
          </Button>
          <Button
            variant={visibleTypes.has("survey") ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => toggleType("survey")}
          >
            <div className="h-2 w-2 rounded-full bg-primary/70" />
            Surveys
          </Button>
          <Button
            variant={visibleTypes.has("estimation") ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => toggleType("estimation")}
          >
            <div className="h-2 w-2 rounded-full bg-secondary" />
            Estimates
          </Button>
          <Button
            variant={visibleTypes.has("note") ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => toggleType("note")}
          >
            <div className="h-2 w-2 rounded-full bg-muted-foreground" />
            Notes
          </Button>
          <Button
            variant={visibleTypes.has("project") ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => toggleType("project")}
          >
            <div className="h-2 w-2 rounded-full bg-destructive" />
            Milestones
          </Button>
        </div>
      </div>

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-4 p-4">
          <div className="grid grid-cols-7 gap-px rounded-t-lg overflow-hidden">
            {WEEKDAY_HEADERS.map((day) => (
              <div
                key={day}
                className="bg-muted/50 py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden -mt-4">
            {allDays.map((day) => {
              const key = dateToStr(day);
              const data = dayDataMap.get(key);
              const inMonth = isSameMonth(day, monthDate);
              const today = isToday(day);
              const isSelected = selectedDate === key;

              const eventCount =
                (visibleTypes.has("task") ? data?.tasks.length ?? 0 : 0) +
                (visibleTypes.has("shopping") ? data?.shopping.length ?? 0 : 0) +
                (visibleTypes.has("labor") ? data?.labor.length ?? 0 : 0) +
                (visibleTypes.has("survey") ? data?.surveys.length ?? 0 : 0) +
                (visibleTypes.has("note") ? data?.notes.length ?? 0 : 0) +
                (visibleTypes.has("estimation") ? data?.estimations.length ?? 0 : 0) +
                (visibleTypes.has("project") ? data?.milestones.length ?? 0 : 0);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(isSelected ? null : key)}
                  className={cn(
                    "bg-card min-h-[88px] p-1.5 text-left transition-colors relative",
                    !inMonth && "bg-muted/30 text-muted-foreground/50",
                    today && "ring-2 ring-primary/30 ring-inset",
                    isSelected && "bg-accent ring-2 ring-primary/50 ring-inset",
                    !isSelected && "hover:bg-accent/50",
                    "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        today && "text-primary font-bold",
                      )}
                    >
                      {day.getDate()}
                    </span>

                    {eventCount > 0 && (
                      <span className="text-[10px] text-muted-foreground">{eventCount}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {visibleTypes.has("task") && hasDayContent(data, "task") && (
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                    {visibleTypes.has("shopping") && hasDayContent(data, "shopping") && (
                      <div className="h-1.5 w-1.5 rounded-full bg-secondary" />
                    )}
                    {visibleTypes.has("labor") && hasDayContent(data, "labor") && (
                      <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                    )}
                    {visibleTypes.has("survey") && hasDayContent(data, "survey") && (
                      <div className="h-1.5 w-1.5 rounded-full bg-secondary" />
                    )}
                    {visibleTypes.has("estimation") && hasDayContent(data, "estimation") && (
                      <div className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                    )}
                    {visibleTypes.has("note") && hasDayContent(data, "note") && (
                      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                    )}
                    {visibleTypes.has("project") && hasDayContent(data, "project") && (
                      <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                    )}
                  </div>

                  {visibleTypes.has("task") && (data?.tasks.length ?? 0) > 0 && (
                    <div className="hidden sm:block mt-1 flex flex-col gap-0.5">
                      {data!.tasks.slice(0, 2).map((task) => (
                        <div
                          key={task._id}
                          className="text-[10px] leading-tight truncate text-primary"
                        >
                          {task.title}
                        </div>
                      ))}
                      {data!.tasks.length > 2 && (
                        <div className="text-[10px] text-muted-foreground">
                          +{data!.tasks.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {selectedDate && selectedDayData && (
            <Card className="rounded-2xl border bg-card/80">
              <CardContent className="flex flex-col gap-4 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {format(new Date(`${selectedDate}T00:00:00`), "EEEE, MMMM d, yyyy")}
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setSelectedDate(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {visibleTypes.has("task") && selectedDayData.tasks.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckSquare className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">
                        Tasks ({selectedDayData.tasks.length})
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {selectedDayData.tasks.map((task) => (
                        <div
                          key={task._id}
                          className={cn(
                            "flex items-center justify-between rounded-lg border border-border bg-primary/5 p-2.5",
                            task.priority ? priorityBorderColors[task.priority] : "border-l-border",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{task.title}</p>
                            {task.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {task.description}
                              </p>
                            )}
                            {task.assignedToName && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {task.assignedToName}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={cn("text-xs ml-2 shrink-0", statusBadgeColors[task.status])}
                          >
                            {task.status.replace("_", " ")}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {visibleTypes.has("shopping") && selectedDayData.shopping.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ShoppingBag className="h-4 w-4 text-secondary-foreground" />
                      <span className="text-sm font-medium">
                        Shopping ({selectedDayData.shopping.length})
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {selectedDayData.shopping.map((item) => (
                        <div
                          key={item._id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/30 p-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Qty: {item.quantity}
                              {item.assignedToName ? ` • ${item.assignedToName}` : ""}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] shrink-0", shoppingStatusColors[item.realizationStatus])}
                          >
                            {item.realizationStatus}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {visibleTypes.has("labor") && selectedDayData.labor.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Hammer className="h-4 w-4 text-accent-foreground" />
                      <span className="text-sm font-medium">
                        Labor ({selectedDayData.labor.length})
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {selectedDayData.labor.map((item) => (
                        <div
                          key={item._id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-accent/30 p-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity} {item.unit}
                              {item.assignedToName ? ` • ${item.assignedToName}` : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {visibleTypes.has("survey") && selectedDayData.surveys.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ClipboardList className="h-4 w-4 text-primary/70" />
                      <span className="text-sm font-medium">
                        Surveys ({selectedDayData.surveys.length})
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {selectedDayData.surveys.map((survey) => (
                        <div
                          key={survey._id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-primary/5 p-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{survey.title}</p>
                            {survey.description && (
                              <p className="text-xs text-muted-foreground truncate">{survey.description}</p>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] shrink-0", surveyStatusColors[survey.status])}
                          >
                            {survey.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {visibleTypes.has("estimation") && selectedDayData.estimations.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Receipt className="h-4 w-4 text-secondary-foreground" />
                      <span className="text-sm font-medium">
                        Estimations ({selectedDayData.estimations.length})
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {selectedDayData.estimations.map((estimation) => (
                        <div
                          key={estimation._id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 p-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{estimation.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {estimation.dateType === "created"
                                ? "Created"
                                : estimation.dateType === "start"
                                  ? "Planned start"
                                  : "Valid until"}
                              {toMoney(estimation.grossTotal) ? ` • ${toMoney(estimation.grossTotal)}` : ""}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] shrink-0", estimationStatusColors[estimation.status])}
                          >
                            {estimation.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {visibleTypes.has("note") && selectedDayData.notes.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Notes ({selectedDayData.notes.length})</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {selectedDayData.notes.map((note) => (
                        <div
                          key={note._id}
                          className="rounded-lg border border-border bg-muted/40 p-2.5"
                        >
                          <p className="text-sm font-medium truncate">{note.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(note.createdAt), "p")}
                            {note.createdByName ? ` • ${note.createdByName}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {visibleTypes.has("project") && selectedDayData.milestones.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Flag className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-medium">
                        Project milestones ({selectedDayData.milestones.length})
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {selectedDayData.milestones.map((milestone) => (
                        <div
                          key={milestone._id}
                          className="rounded-lg border border-border bg-destructive/5 p-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{milestone.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {getMilestoneDateTypeLabel(milestone.type)}
                              </p>
                            </div>
                            {milestone.status ? (
                              <Badge
                                variant="outline"
                                className={cn("text-[10px] shrink-0", milestoneStatusColors[milestone.status])}
                              >
                                {milestone.status.replace(/_/g, " ")}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {((!visibleTypes.has("task") || selectedDayData.tasks.length === 0) &&
                  (!visibleTypes.has("shopping") || selectedDayData.shopping.length === 0) &&
                  (!visibleTypes.has("labor") || selectedDayData.labor.length === 0) &&
                  (!visibleTypes.has("survey") || selectedDayData.surveys.length === 0) &&
                  (!visibleTypes.has("estimation") || selectedDayData.estimations.length === 0) &&
                  (!visibleTypes.has("note") || selectedDayData.notes.length === 0) &&
                  (!visibleTypes.has("project") || selectedDayData.milestones.length === 0)) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nothing scheduled for this day.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
