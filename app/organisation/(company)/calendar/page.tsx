import { Suspense } from "react";
import OrganizationCalendar, {
  OrganizationCalendarLoading,
} from "./components/OrganizationCalendar";

export default function OrganizationCalendarPage() {
  return (
    <Suspense fallback={<OrganizationCalendarLoading />}>
      <OrganizationCalendar />
    </Suspense>
  );
}
