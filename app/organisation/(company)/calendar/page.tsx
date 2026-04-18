import { Suspense } from "react";
import OrganizationCalendar, {
  OrganizationCalendarSkeleton,
} from "./components/OrganizationCalendar";

export default function OrganizationCalendarPage() {
  return (
    <Suspense fallback={<OrganizationCalendarSkeleton />}>
      <OrganizationCalendar />
    </Suspense>
  );
}
