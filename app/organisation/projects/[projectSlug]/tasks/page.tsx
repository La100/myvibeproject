import { Suspense } from "react";
import TasksView, { TasksViewLoading } from "./components/TasksView";

export default function ProjectTasksPage() {
  return (
    <Suspense fallback={<TasksViewLoading />}>
      <TasksView />
    </Suspense>
  );
}