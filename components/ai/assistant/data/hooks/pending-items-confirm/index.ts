import type { PendingItem } from "../../types";
import { confirmBulkCreateItem } from "./bulkCreate";
import { confirmCreateItem } from "./createOperation";
import { confirmDeleteItem } from "./deleteOperation";
import { confirmEditItem } from "./editOperation";
import type {
  ConfirmSingleItemResult,
  PendingItemsConfirmContext,
  PendingItemsConfirmDeps,
} from "./types";

export type { ConfirmSingleItemResult, PendingItemsConfirmDeps } from "./types";

export const createConfirmSingleItem = (deps: PendingItemsConfirmDeps) => {
  return async (item: PendingItem): Promise<ConfirmSingleItemResult> => {
    if (!deps.projectId) {
      throw new Error("No project available");
    }

    const context: PendingItemsConfirmContext = {
      ...deps,
      projectId: deps.projectId,
    };

    if (item.operation === "bulk_create") {
      return confirmBulkCreateItem(item, context);
    }

    if (item.operation === "delete") {
      return confirmDeleteItem(item, context);
    }

    if (item.operation === "edit" || item.operation === "bulk_edit") {
      return confirmEditItem(item, context);
    }

    return confirmCreateItem(item, context);
  };
};
