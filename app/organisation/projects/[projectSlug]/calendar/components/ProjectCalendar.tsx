"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useProject } from "@/components/providers/ProjectProvider";
import {
  OperationsCalendar,
  OperationsCalendarLoading,
  type CalendarResponse,
} from "@/components/calendar/OperationsCalendar";
import { apiAny } from "@/lib/convexApiAny";
import { useI18n } from "@/lib/i18n";

export { OperationsCalendarLoading as ProjectCalendarLoading };

export default function ProjectCalendar() {
  const { project } = useProject();
  const { t } = useI18n();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const calendarData = useQuery(apiAny.calendar.getProjectCalendarData, {
    projectId: project._id,
    month: currentMonth,
  }) as CalendarResponse | undefined;

  return (
    <OperationsCalendar
      calendarData={calendarData}
      currentMonth={currentMonth}
      onMonthChange={setCurrentMonth}
      title={t("navigation", "calendar")}
    />
  );
}
