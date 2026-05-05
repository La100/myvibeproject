import { Suspense } from "react";
import LaborListView, { LaborListViewLoading } from "./components/LaborListView";

export default function ProjectLaborPage() {
  return (
    <Suspense fallback={<LaborListViewLoading />}>
      <LaborListView />
    </Suspense>
  );
}


