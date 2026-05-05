import { Suspense } from "react";
import NotesView, { NotesViewLoading } from "./components/NotesView";

export default function ProjectNotesPage() {
  return (
    <Suspense fallback={<NotesViewLoading />}>
      <NotesView />
    </Suspense>
  );
} 