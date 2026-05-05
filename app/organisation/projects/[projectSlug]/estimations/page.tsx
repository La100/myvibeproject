import { Suspense } from "react";
import EstimationsView, { EstimationsViewLoading } from "./components/EstimationsView";

export default function ProjectEstimationsPage() {
  return (
    <Suspense fallback={<EstimationsViewLoading />}>
      <EstimationsView />
    </Suspense>
  );
}


