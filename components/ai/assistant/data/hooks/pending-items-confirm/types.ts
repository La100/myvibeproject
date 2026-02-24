/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Id } from "@/convex/_generated/dataModel";
import type { PendingItem } from "../../types";

export type ConfirmSingleItemResult = {
  success: boolean;
  message: string;
  [key: string]: unknown;
};

export interface PendingItemsConfirmDeps {
  projectId: Id<"projects"> | undefined;
  resolveTeamSlug: () => string | undefined;
  resolvePendingTargetId: (item: PendingItem, keys: string[]) => string | undefined;
  findOrCreateSection: (sectionName: string) => Promise<Id<"shoppingListSections"> | undefined>;
  findOrCreateLaborSection: (sectionName: string) => Promise<Id<"laborSections"> | undefined>;
  createConfirmedTask: (args: any) => Promise<any>;
  createConfirmedNote: (args: any) => Promise<any>;
  createConfirmedShoppingItem: (args: any) => Promise<any>;
  createConfirmedSurvey: (args: any) => Promise<any>;
  createConfirmedContact: (args: any) => Promise<any>;
  editConfirmedTask: (args: any) => Promise<any>;
  editConfirmedNote: (args: any) => Promise<any>;
  editConfirmedShoppingItem: (args: any) => Promise<any>;
  editConfirmedSurvey: (args: any) => Promise<any>;
  bulkEditConfirmedTasks: (args: any) => Promise<any>;
  createConfirmedLaborItem: (args: any) => Promise<any>;
  editConfirmedLaborItem: (args: any) => Promise<any>;
  deleteTask: (args: any) => Promise<any>;
  deleteNote: (args: any) => Promise<any>;
  deleteShoppingItem: (args: any) => Promise<any>;
  createShoppingSection: (args: any) => Promise<any>;
  updateShoppingSection: (args: any) => Promise<any>;
  deleteShoppingSection: (args: any) => Promise<any>;
  deleteSurvey: (args: any) => Promise<any>;
  deleteContact: (args: any) => Promise<any>;
  deleteLaborItem: (args: any) => Promise<any>;
  createLaborSection: (args: any) => Promise<any>;
  updateLaborSection: (args: any) => Promise<any>;
  deleteLaborSection: (args: any) => Promise<any>;
  updateProjectSettings: (args: any) => Promise<any>;
}

export interface PendingItemsConfirmContext extends PendingItemsConfirmDeps {
  projectId: Id<"projects">;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
