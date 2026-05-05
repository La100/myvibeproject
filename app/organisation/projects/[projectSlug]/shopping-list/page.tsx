import { Suspense } from "react";
import ShoppingListView, { ShoppingListViewLoading } from "./components/ShoppingListView";

export default function ProjectShoppingListPage() {
  return (
    <Suspense fallback={<ShoppingListViewLoading />}>
      <ShoppingListView />
    </Suspense>
  );
} 