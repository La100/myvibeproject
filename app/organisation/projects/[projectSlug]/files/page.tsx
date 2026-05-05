import { Suspense } from "react";
import FilesView, { FilesViewLoading } from "./components/FilesView";

export default function ProjectFilesPage() {
  return (
    <Suspense fallback={<FilesViewLoading />}>
      <FilesView />
    </Suspense>
  );
} 