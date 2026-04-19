"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Hammer,
  Receipt,
  ShoppingBag,
} from "lucide-react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  max,
  min,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn, formatCurrency } from "@/lib/utils";

type CalendarTask = {
  _id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority?: "low" | "medium" | "high" | "urgent" | null;
  startDate?: number;
  endDate?: number;
  assignedToName?: string;
  projectSlug?: string;
  projectName?: string;
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
  projectSlug?: string;
  projectName?: string;
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
  projectSlug?: string;
  projectName?: string;
};

type ProjectPaymentDateType = "dueDate" | "invoiceIssuedAt" | "sentAt" | "paidAt";

type CalendarProjectPayment = {
  _id: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  invoiceNumber?: string;
  paymentReference?: string;
  dueDate?: number;
  invoiceIssuedAt?: number;
  sentAt?: number;
  paidAt?: number;
  createdByName?: string;
  projectSlug?: string;
  projectName?: string;
  relevantDates: Array<{
    type: ProjectPaymentDateType;
    timestamp: number;
  }>;
};

type CalendarInvoiceEntry = {
  _id: string;
  invoiceId: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  status: CalendarProjectPayment["status"];
  invoiceNumber?: string;
  paymentReference?: string;
  createdByName?: string;
  projectSlug?: string;
  projectName?: string;
  dateType: ProjectPaymentDateType;
  timestamp: number;
};

type DayData = {
  tasks: CalendarTask[];
  shopping: CalendarShoppingItem[];
  labor: CalendarLaborItem[];
  invoices: CalendarInvoiceEntry[];
};

type EventType = "task" | "shopping" | "labor" | "invoice";

type WeekTaskBar = {
  task: CalendarTask;
  lane: number;
  startColumn: number;
  endColumn: number;
  startsWithinWeek: boolean;
  endsWithinWeek: boolean;
};

export type CalendarResponse = {
  tasks: CalendarTask[];
  shoppingItems: CalendarShoppingItem[];
  laborItems: CalendarLaborItem[];
  projectPayments: CalendarProjectPayment[];
};

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const FILTERS: Array<{
  key: EventType;
  label: string;
  dotClassName: string;
}> = [
  { key: "task", label: "Tasks", dotClassName: "bg-stone-700" },
  { key: "shopping", label: "Shopping", dotClassName: "bg-amber-500" },
  { key: "labor", label: "Labor", dotClassName: "bg-sky-600" },
  { key: "invoice", label: "Invoices", dotClassName: "bg-emerald-600" },
];

const taskStatusClassNames: Record<CalendarTask["status"], string> = {
  todo: "border-stone-200 bg-stone-50 text-stone-700",
  in_progress: "border-sky-200 bg-sky-50 text-sky-700",
  review: "border-amber-200 bg-amber-50 text-amber-700",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const shoppingStatusClassNames: Record<CalendarShoppingItem["realizationStatus"], string> = {
  PLANNED: "border-stone-200 bg-stone-50 text-stone-700",
  ORDERED: "border-sky-200 bg-sky-50 text-sky-700",
  IN_TRANSIT: "border-indigo-200 bg-indigo-50 text-indigo-700",
  DELIVERED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-700",
};

const invoiceStatusClassNames: Record<CalendarProjectPayment["status"], string> = {
  draft: "border-stone-200 bg-stone-50 text-stone-700",
  open: "border-amber-200 bg-amber-50 text-amber-700",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  void: "border-stone-300 bg-stone-100 text-stone-700",
  uncollectible: "border-rose-200 bg-rose-50 text-rose-700",
};

const detailLinkClassName =
  "inline-flex items-center rounded-full border border-border/70 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground transition-[background-color,border-color,color] hover:border-border hover:bg-stone-100";

function dateToKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function timestampToKey(timestamp: number) {
  return format(new Date(timestamp), "yyyy-MM-dd");
}

function getNormalizedRange(
  startTimestamp?: number,
  endTimestamp?: number,
): { start: Date; end: Date } | null {
  const startValue = startTimestamp ?? endTimestamp;
  const endValue = endTimestamp ?? startTimestamp;
  if (!startValue || !endValue) return null;

  const start = startOfDay(new Date(startValue));
  const end = startOfDay(new Date(endValue));

  return start.getTime() <= end.getTime()
    ? { start, end }
    : { start: end, end: start };
}

function getInvoiceDateLabel(type: ProjectPaymentDateType) {
  switch (type) {
    case "dueDate":
      return "Due";
    case "invoiceIssuedAt":
      return "Issued";
    case "sentAt":
      return "Sent";
    case "paidAt":
      return "Paid";
    default:
      return "Invoice";
  }
}

function createEmptyDay(): DayData {
  return {
    tasks: [],
    shopping: [],
    labor: [],
    invoices: [],
  };
}

function buildProjectBasePath(projectSlug?: string) {
  return projectSlug ? `/organisation/projects/${projectSlug}` : null;
}

function ProjectBadge({ projectName }: { projectName?: string }) {
  if (!projectName) return null;

  return (
    <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
      {projectName}
    </p>
  );
}

export function OperationsCalendarSkeleton() {
  return <Spinner className="h-full rounded-[1.75rem] border bg-card" />;
}

export function OperationsCalendar({
  calendarData,
  currentMonth,
  onMonthChange,
  title,
  subtitle,
}: {
  calendarData?: CalendarResponse;
  currentMonth: string;
  onMonthChange: (month: string) => void;
  title: string;
  subtitle: string;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<EventType>>(
    new Set(["task", "shopping", "labor", "invoice"]),
  );

  const [year, monthIdx] = useMemo(() => {
    const [yearPart, monthPart] = currentMonth.split("-");
    return [Number.parseInt(yearPart, 10), Number.parseInt(monthPart, 10) - 1] as const;
  }, [currentMonth]);

  const monthDate = useMemo(() => new Date(year, monthIdx, 1), [monthIdx, year]);

  const allDays = useMemo(() => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
    });
  }, [monthDate]);

  const weeks = useMemo(() => {
    const nextWeeks: Date[][] = [];
    for (let index = 0; index < allDays.length; index += 7) {
      nextWeeks.push(allDays.slice(index, index + 7));
    }
    return nextWeeks;
  }, [allDays]);

  const dayDataMap = useMemo(() => {
    const map = new Map<string, DayData>();
    if (!calendarData) return map;

    const getDay = (key: string) => {
      if (!map.has(key)) {
        map.set(key, createEmptyDay());
      }
      return map.get(key)!;
    };

    for (const task of calendarData.tasks) {
      const start = task.startDate ?? task.endDate;
      const end = task.endDate ?? task.startDate;
      if (!start || !end) continue;

      const days = eachDayOfInterval({
        start: new Date(start),
        end: new Date(end),
      });

      for (const day of days) {
        getDay(dateToKey(day)).tasks.push(task);
      }
    }

    for (const item of calendarData.shoppingItems) {
      if (!item.buyBefore) continue;
      getDay(timestampToKey(item.buyBefore)).shopping.push(item);
    }

    for (const item of calendarData.laborItems) {
      const start = item.startDate ?? item.endDate;
      const end = item.endDate ?? item.startDate;
      if (!start || !end) continue;

      const days = eachDayOfInterval({
        start: new Date(start),
        end: new Date(end),
      });

      for (const day of days) {
        getDay(dateToKey(day)).labor.push(item);
      }
    }

    for (const payment of calendarData.projectPayments) {
      for (const relevantDate of payment.relevantDates) {
        getDay(timestampToKey(relevantDate.timestamp)).invoices.push({
          _id: `${payment._id}-${relevantDate.type}`,
          invoiceId: payment._id,
          title: payment.title,
          description: payment.description,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          invoiceNumber: payment.invoiceNumber,
          paymentReference: payment.paymentReference,
          createdByName: payment.createdByName,
          projectSlug: payment.projectSlug,
          projectName: payment.projectName,
          dateType: relevantDate.type,
          timestamp: relevantDate.timestamp,
        });
      }
    }

    return map;
  }, [calendarData]);

  const weekTaskBars = useMemo(() => {
    if (!calendarData) return weeks.map(() => ({ bars: [] as WeekTaskBar[], laneCount: 0 }));

    return weeks.map((week) => {
      const weekStart = startOfDay(week[0]);
      const weekEnd = startOfDay(week[6]);

      const rawBars = calendarData.tasks
        .map((task) => {
          const normalizedRange = getNormalizedRange(task.startDate, task.endDate);
          if (!normalizedRange) return null;
          if (normalizedRange.end < weekStart || normalizedRange.start > weekEnd) return null;

          const segmentStart = max([normalizedRange.start, weekStart]);
          const segmentEnd = min([normalizedRange.end, weekEnd]);

          return {
            task,
            segmentStart,
            segmentEnd,
            startsWithinWeek: normalizedRange.start.getTime() >= weekStart.getTime(),
            endsWithinWeek: normalizedRange.end.getTime() <= weekEnd.getTime(),
            startColumn: week.findIndex(
              (day) => startOfDay(day).getTime() === segmentStart.getTime(),
            ),
            endColumn: week.findIndex(
              (day) => startOfDay(day).getTime() === segmentEnd.getTime(),
            ),
          };
        })
        .filter(
          (
            bar,
          ): bar is Omit<WeekTaskBar, "lane"> & {
            segmentStart: Date;
            segmentEnd: Date;
          } => Boolean(bar && bar.startColumn >= 0 && bar.endColumn >= 0),
        )
        .sort((left, right) => {
          const startDiff = left.segmentStart.getTime() - right.segmentStart.getTime();
          if (startDiff !== 0) return startDiff;

          const endDiff = left.segmentEnd.getTime() - right.segmentEnd.getTime();
          if (endDiff !== 0) return endDiff;

          return left.task.title.localeCompare(right.task.title);
        });

      const laneEndColumns: number[] = [];
      const bars: WeekTaskBar[] = rawBars.map((bar) => {
        let lane = laneEndColumns.findIndex((endColumn) => bar.startColumn > endColumn);
        if (lane === -1) {
          lane = laneEndColumns.length;
          laneEndColumns.push(bar.endColumn);
        } else {
          laneEndColumns[lane] = bar.endColumn;
        }

        return {
          task: bar.task,
          lane,
          startColumn: bar.startColumn,
          endColumn: bar.endColumn,
          startsWithinWeek: bar.startsWithinWeek,
          endsWithinWeek: bar.endsWithinWeek,
        };
      });

      return {
        bars,
        laneCount: laneEndColumns.length,
      };
    });
  }, [calendarData, weeks]);

  const selectedDayData = useMemo(
    () => (selectedDate ? dayDataMap.get(selectedDate) ?? createEmptyDay() : null),
    [dayDataMap, selectedDate],
  );

  const monthStats = useMemo(() => {
    if (!calendarData) {
      return {
        tasks: 0,
        shopping: 0,
        labor: 0,
        invoices: 0,
      };
    }

    return {
      tasks: calendarData.tasks.length,
      shopping: calendarData.shoppingItems.length,
      labor: calendarData.laborItems.length,
      invoices: calendarData.projectPayments.reduce(
        (total, payment) => total + payment.relevantDates.length,
        0,
      ),
    };
  }, [calendarData]);

  const selectedDateLabel = selectedDate
    ? format(new Date(`${selectedDate}T12:00:00`), "EEEE, d MMMM yyyy")
    : null;

  if (!calendarData) {
    return <OperationsCalendarSkeleton />;
  }

  const toggleType = (type: EventType) => {
    setVisibleTypes((previous) => {
      const next = new Set(previous);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const shiftMonth = (offset: number) => {
    const next = new Date(year, monthIdx + offset, 1);
    onMonthChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
    setSelectedDate(null);
  };

  return (
    <ProjectPageLayout>
      <div className="flex flex-col gap-8">
        <ProjectPageHeader title={title} icon={<CalendarDays />} subtitle={subtitle} />

        <Card className="overflow-hidden rounded-[1.75rem] border-border/70 bg-white shadow-none">
          <CardHeader className="gap-5 border-b border-border/60 bg-muted/15">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full border-border/70 bg-white"
                  onClick={() => shiftMonth(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-[220px]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Focus month
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    {format(monthDate, "MMMM yyyy")}
                  </h2>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full border-border/70 bg-white"
                  onClick={() => shiftMonth(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-border/60 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Tasks
                  </p>
                  <p className="mt-1 text-xl font-semibold tracking-tight">{monthStats.tasks}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Shopping
                  </p>
                  <p className="mt-1 text-xl font-semibold tracking-tight">{monthStats.shopping}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Labor
                  </p>
                  <p className="mt-1 text-xl font-semibold tracking-tight">{monthStats.labor}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Invoice dates
                  </p>
                  <p className="mt-1 text-xl font-semibold tracking-tight">{monthStats.invoices}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {FILTERS.map((filter) => {
                const isActive = visibleTypes.has(filter.key);
                return (
                  <Button
                    key={filter.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleType(filter.key)}
                    className={cn(
                      "h-11 rounded-full border-border/70 px-4 text-sm font-medium shadow-none transition-[background-color,border-color,color,box-shadow,transform] hover:-translate-y-0.5 hover:border-border hover:bg-white hover:text-foreground hover:shadow-sm",
                      isActive ? "bg-white text-foreground" : "bg-transparent text-muted-foreground",
                    )}
                  >
                    <span className={cn("mr-2 h-2.5 w-2.5 rounded-full", filter.dotClassName)} />
                    {filter.label}
                  </Button>
                );
              })}
            </div>
          </CardHeader>

          <CardContent className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
            <div className="overflow-hidden rounded-[1.5rem] border border-border/70">
              <div className="grid grid-cols-7 border-b border-border/60 bg-muted/20">
                {WEEKDAY_HEADERS.map((day) => (
                  <div
                    key={day}
                    className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="space-y-px bg-border/60">
                {weeks.map((week, weekIndex) => {
                  const taskBars = weekTaskBars[weekIndex];
                  const visibleTaskBars = visibleTypes.has("task") ? taskBars.bars : [];
                  const taskLaneCount = visibleTypes.has("task") ? taskBars.laneCount : 0;
                  const rowMinHeight = 124 + taskLaneCount * 28;

                  return (
                    <div key={week[0]?.toISOString()} className="relative grid grid-cols-7">
                      {week.map((day) => {
                        const key = dateToKey(day);
                        const data = dayDataMap.get(key);
                        const visibleCount =
                          (visibleTypes.has("task") ? data?.tasks.length ?? 0 : 0) +
                          (visibleTypes.has("shopping") ? data?.shopping.length ?? 0 : 0) +
                          (visibleTypes.has("labor") ? data?.labor.length ?? 0 : 0) +
                          (visibleTypes.has("invoice") ? data?.invoices.length ?? 0 : 0);

                        const isSelected = selectedDate === key;

                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSelectedDate(isSelected ? null : key)}
                            className={cn(
                              "border-b border-r border-border/60 bg-white p-3 text-left transition-[background-color,border-color,box-shadow]",
                              !isSameMonth(day, monthDate) && "bg-stone-50/80 text-muted-foreground",
                              isSelected && "bg-stone-50 shadow-[inset_0_0_0_1px_rgba(70,52,37,0.14)]",
                              !isSelected && "hover:bg-stone-50/60",
                            )}
                            style={{ minHeight: `${rowMinHeight}px` }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span
                                className={cn(
                                  "inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-semibold",
                                  isToday(day)
                                    ? "bg-stone-900 text-white"
                                    : "bg-transparent text-foreground",
                                )}
                              >
                                {day.getDate()}
                              </span>
                              {visibleCount > 0 ? (
                                <span
                                  className={cn(
                                    "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[11px] font-semibold shadow-sm",
                                    isSelected
                                      ? "bg-stone-900 text-white"
                                      : "bg-stone-100 text-stone-700",
                                  )}
                                >
                                  {visibleCount}
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {visibleTypes.has("task") && (data?.tasks.length ?? 0) > 0 ? (
                                <span className="h-2 w-2 rounded-full bg-stone-700" />
                              ) : null}
                              {visibleTypes.has("shopping") && (data?.shopping.length ?? 0) > 0 ? (
                                <span className="h-2 w-2 rounded-full bg-amber-500" />
                              ) : null}
                              {visibleTypes.has("labor") && (data?.labor.length ?? 0) > 0 ? (
                                <span className="h-2 w-2 rounded-full bg-sky-600" />
                              ) : null}
                              {visibleTypes.has("invoice") && (data?.invoices.length ?? 0) > 0 ? (
                                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                              ) : null}
                            </div>

                            <div className="mt-3 hidden space-y-1.5 lg:block">
                              {visibleTypes.has("invoice") && (data?.invoices.length ?? 0) > 0
                                ? data?.invoices.slice(0, 1).map((invoice) => (
                                    <div
                                      key={invoice._id}
                                      className="truncate rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700"
                                    >
                                      {getInvoiceDateLabel(invoice.dateType)}: {invoice.title}
                                    </div>
                                  ))
                                : null}
                            </div>
                          </button>
                        );
                      })}

                      {visibleTaskBars.length > 0 ? (
                        <div className="pointer-events-none absolute inset-x-0 top-[56px] z-10">
                          {visibleTaskBars.map((bar) => {
                            const width = ((bar.endColumn - bar.startColumn + 1) / 7) * 100;
                            const left = (bar.startColumn / 7) * 100;

                            return (
                              <div
                                key={`${bar.task._id}-${weekIndex}`}
                                className={cn(
                                  "absolute flex h-9 items-center overflow-hidden border border-stone-200 bg-stone-100/95 px-3 text-[11px] font-medium text-stone-700 shadow-sm backdrop-blur-[1px]",
                                  bar.startsWithinWeek ? "rounded-l-full" : "rounded-l-md border-l-0",
                                  bar.endsWithinWeek ? "rounded-r-full" : "rounded-r-md border-r-0",
                                )}
                                style={{
                                  left: `calc(${left}% + 8px)`,
                                  width: `calc(${width}% - 16px)`,
                                  top: `${bar.lane * 28}px`,
                                }}
                              >
                                <span className="truncate">
                                  {bar.startsWithinWeek ? bar.task.title : ""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <Card className="rounded-[1.5rem] border-border/70 bg-muted/10 shadow-none">
              <CardHeader className="border-b border-border/60">
                <CardTitle className="text-lg font-semibold tracking-tight">
                  {selectedDateLabel ?? "Select a day"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                {!selectedDayData ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    Click any day to inspect planned work, purchases, labor windows and invoice deadlines.
                  </p>
                ) : (
                  <>
                    {visibleTypes.has("task") && selectedDayData.tasks.length > 0 ? (
                      <section className="space-y-3">
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-4 w-4 text-stone-700" />
                          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Tasks
                          </h3>
                        </div>
                        <div className="space-y-3">
                          {selectedDayData.tasks.map((task) => {
                            const projectBasePath = buildProjectBasePath(task.projectSlug);
                            return (
                              <div
                                key={task._id}
                                className="rounded-2xl border border-border/70 bg-white p-4"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-foreground">{task.title}</p>
                                    {task.description ? (
                                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                        {task.description}
                                      </p>
                                    ) : null}
                                    <ProjectBadge projectName={task.projectName} />
                                    {task.assignedToName ? (
                                      <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                        {task.assignedToName}
                                      </p>
                                    ) : null}
                                    {projectBasePath ? (
                                      <div className="mt-3">
                                        <Link
                                          href={`${projectBasePath}/tasks/${task._id}`}
                                          className={detailLinkClassName}
                                        >
                                          Open task
                                        </Link>
                                      </div>
                                    ) : null}
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "rounded-full px-3 py-1 text-[11px] font-semibold",
                                      taskStatusClassNames[task.status],
                                    )}
                                  >
                                    {task.status.replace("_", " ")}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ) : null}

                    {visibleTypes.has("shopping") && selectedDayData.shopping.length > 0 ? (
                      <section className="space-y-3">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="h-4 w-4 text-amber-600" />
                          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Shopping
                          </h3>
                        </div>
                        <div className="space-y-3">
                          {selectedDayData.shopping.map((item) => {
                            const projectBasePath = buildProjectBasePath(item.projectSlug);
                            return (
                              <div
                                key={item._id}
                                className="rounded-2xl border border-border/70 bg-white p-4"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-foreground">{item.name}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                      Qty {item.quantity}
                                      {item.assignedToName ? ` • ${item.assignedToName}` : ""}
                                    </p>
                                    <ProjectBadge projectName={item.projectName} />
                                    {projectBasePath ? (
                                      <div className="mt-3">
                                        <Link
                                          href={`${projectBasePath}/shopping-list?itemId=${item._id}`}
                                          className={detailLinkClassName}
                                        >
                                          Open shopping
                                        </Link>
                                      </div>
                                    ) : null}
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "rounded-full px-3 py-1 text-[11px] font-semibold",
                                      shoppingStatusClassNames[item.realizationStatus],
                                    )}
                                  >
                                    {item.realizationStatus.replace(/_/g, " ")}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ) : null}

                    {visibleTypes.has("labor") && selectedDayData.labor.length > 0 ? (
                      <section className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Hammer className="h-4 w-4 text-sky-700" />
                          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Labor
                          </h3>
                        </div>
                        <div className="space-y-3">
                          {selectedDayData.labor.map((item) => {
                            const projectBasePath = buildProjectBasePath(item.projectSlug);
                            return (
                              <div
                                key={item._id}
                                className="rounded-2xl border border-border/70 bg-white p-4"
                              >
                                <p className="text-sm font-semibold text-foreground">{item.name}</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {item.quantity} {item.unit}
                                  {item.assignedToName ? ` • ${item.assignedToName}` : ""}
                                </p>
                                <ProjectBadge projectName={item.projectName} />
                                {projectBasePath ? (
                                  <div className="mt-3">
                                    <Link
                                      href={`${projectBasePath}/labor?itemId=${item._id}`}
                                      className={detailLinkClassName}
                                    >
                                      Open labor
                                    </Link>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ) : null}

                    {visibleTypes.has("invoice") && selectedDayData.invoices.length > 0 ? (
                      <section className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Receipt className="h-4 w-4 text-emerald-700" />
                          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Invoices
                          </h3>
                        </div>
                        <div className="space-y-3">
                          {selectedDayData.invoices.map((invoice) => {
                            const projectBasePath = buildProjectBasePath(invoice.projectSlug);
                            return (
                              <div
                                key={invoice._id}
                                className="rounded-2xl border border-border/70 bg-white p-4"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-semibold text-foreground">{invoice.title}</p>
                                      {invoice.invoiceNumber ? (
                                        <Badge
                                          variant="outline"
                                          className="rounded-full border-border/70 bg-white px-2.5 py-1 text-[11px] font-semibold"
                                        >
                                          #{invoice.invoiceNumber}
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                      {getInvoiceDateLabel(invoice.dateType)} •{" "}
                                      {format(new Date(invoice.timestamp), "d MMM yyyy")}
                                    </p>
                                    <ProjectBadge projectName={invoice.projectName} />
                                    {invoice.paymentReference ? (
                                      <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                        Ref: {invoice.paymentReference}
                                      </p>
                                    ) : null}
                                    {projectBasePath ? (
                                      <div className="mt-3">
                                        <Link
                                          href={`${projectBasePath}/payments?invoiceId=${invoice.invoiceId}`}
                                          className={detailLinkClassName}
                                        >
                                          Open invoice
                                        </Link>
                                      </div>
                                    ) : null}
                                  </div>
                                  <div className="text-right">
                                    <p className="text-base font-semibold tracking-tight text-foreground">
                                      {formatCurrency(invoice.amount, invoice.currency)}
                                    </p>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "mt-2 rounded-full px-3 py-1 text-[11px] font-semibold",
                                        invoiceStatusClassNames[invoice.status],
                                      )}
                                    >
                                      {invoice.status}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ) : null}

                    {((!visibleTypes.has("task") || selectedDayData.tasks.length === 0) &&
                      (!visibleTypes.has("shopping") || selectedDayData.shopping.length === 0) &&
                      (!visibleTypes.has("labor") || selectedDayData.labor.length === 0) &&
                      (!visibleTypes.has("invoice") || selectedDayData.invoices.length === 0)) ? (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-white/80 px-5 py-8 text-center">
                        <p className="text-sm leading-6 text-muted-foreground">
                          Nothing operational is scheduled for this day.
                        </p>
                      </div>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </ProjectPageLayout>
  );
}
