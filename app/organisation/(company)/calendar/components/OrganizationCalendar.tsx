"use client";

import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useState } from "react";
import {
  OperationsCalendar,
  OperationsCalendarSkeleton,
  type CalendarResponse,
} from "@/components/calendar/OperationsCalendar";
import { apiAny } from "@/lib/convexApiAny";

export { OperationsCalendarSkeleton as OrganizationCalendarSkeleton };

export default function OrganizationCalendar() {
  const { organization } = useOrganization();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const calendarData = useQuery(
    apiAny.calendar.getOrganizationCalendarData,
    organization?.id
      ? {
          clerkOrgId: organization.id,
          month: currentMonth,
        }
      : "skip",
  ) as CalendarResponse | undefined;

  return (
    <OperationsCalendar
      calendarData={calendarData}
      currentMonth={currentMonth}
      onMonthChange={setCurrentMonth}
      title="Calendar"
    />
  );
}
