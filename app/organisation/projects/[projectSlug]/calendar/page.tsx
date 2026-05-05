import { Suspense } from "react";
import ProjectCalendar, { ProjectCalendarLoading } from "./components/ProjectCalendar";

export default function ProjectCalendarPage() {
  return (
    <Suspense fallback={<ProjectCalendarLoading />}>
      <ProjectCalendar />
    </Suspense>
  );
} 