import type { Id } from "@/convex/_generated/dataModel";
import type { PendingItem } from "../../types";
import {
  extractBulkSelection,
  extractBulkUpdates,
  resolveSectionName,
  sanitizeShoppingItemData,
} from "../../utils";
import { sanitizeProjectSettingsUpdates } from "../pendingItemsHelpers";
import { isPlainObject, type ConfirmSingleItemResult, type PendingItemsConfirmContext } from "./types";

export async function confirmEditItem(
  item: PendingItem,
  context: PendingItemsConfirmContext,
): Promise<ConfirmSingleItemResult> {
  const {
    projectId,
    resolvePendingTargetId,
    findOrCreateSection,
    findOrCreateLaborSection,
    editConfirmedTask,
    editConfirmedNote,
    editConfirmedShoppingItem,
    editConfirmedSurvey,
    bulkEditConfirmedTasks,
    editConfirmedLaborItem,
    updateShoppingSection,
    updateLaborSection,
    updateProjectSettings,
  } = context;

  let result: ConfirmSingleItemResult;
  const isBulkEdit = item.operation === 'bulk_edit';
  const bulkItems = Array.isArray((item.data as { items?: unknown })?.items)
    ? ((item.data as { items: Array<Record<string, unknown>> }).items)
    : [];

  switch (item.type) {
    case 'task': {
      if (isBulkEdit) {
        const selection = extractBulkSelection(item);
        const updates = extractBulkUpdates(item);

        if (Object.keys(updates).length > 0) {
          result = await bulkEditConfirmedTasks({
            projectId,
            selection,
            updates: updates as {
              title?: string;
              description?: string;
              status?: 'todo' | 'in_progress' | 'review' | 'done';
              priority?: 'low' | 'medium' | 'high' | 'urgent';
              assignedTo?: string | null;
              tags?: string[];
            },
            reason: selection.reason,
          });
          break;
        }

        const taskEdits = Array.isArray(item.data?.tasks)
          ? (item.data.tasks as Array<Record<string, unknown>>)
          : bulkItems;

        if (taskEdits.length === 0) {
          throw new Error("No tasks provided for bulk edit");
        }

        let updatedCount = 0;
        const errors: string[] = [];

        for (const taskUpdate of taskEdits) {
          try {
            const candidateItem: PendingItem = {
              ...item,
              data: taskUpdate,
              originalItem: isPlainObject(taskUpdate.originalItem)
                ? (taskUpdate.originalItem as Record<string, unknown>)
                : item.originalItem,
            };
            const taskId = resolvePendingTargetId(candidateItem, ["taskId", "itemId"]);
            if (!taskId) {
              errors.push("Skipped task edit without taskId");
              continue;
            }

            const rawUpdates = isPlainObject(taskUpdate.updates)
              ? (taskUpdate.updates as Record<string, unknown>)
              : taskUpdate;
            const cleanUpdates = { ...rawUpdates };
            delete cleanUpdates.assignedToName;
            delete cleanUpdates.taskId;
            delete cleanUpdates.itemId;
            delete cleanUpdates.originalItem;
            delete cleanUpdates.updates;

            const editResult = await editConfirmedTask({
              projectId,
              taskId: taskId as Id<"tasks">,
              updates: cleanUpdates as {
                title?: string;
                description?: string;
                content?: string;
                status?: 'todo' | 'in_progress' | 'review' | 'done';
                assignedTo?: string | null;
                priority?: 'low' | 'medium' | 'high' | 'urgent';
                startDate?: string;
                endDate?: string;
                tags?: string[];
              },
            });

            if (editResult.success) {
              updatedCount++;
            } else {
              errors.push(editResult.message);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(message);
          }
        }

        result = {
          success: errors.length === 0,
          message: errors.length === 0
            ? `Updated ${updatedCount}/${taskEdits.length} tasks successfully`
            : `Updated ${updatedCount}/${taskEdits.length} tasks with errors: ${errors.slice(0, 3).join(', ')}`,
        };
        break;
      }

      const cleanUpdates = { ...(item.updates as Record<string, unknown>) };
      delete cleanUpdates.assignedToName;
      const taskId = resolvePendingTargetId(item, ["taskId", "itemId"]);
      if (!taskId) {
        throw new Error("Missing taskId for task edit");
      }

      result = await editConfirmedTask({
        projectId,
        taskId: taskId as Id<"tasks">,
        updates: cleanUpdates
      });
      break;
    }
    case 'note': {
      if (isBulkEdit) {
        if (bulkItems.length === 0) {
          throw new Error("No notes provided for bulk edit");
        }

        let updatedCount = 0;
        const errors: string[] = [];

        for (const noteUpdate of bulkItems) {
          try {
            const candidateItem: PendingItem = {
              ...item,
              data: noteUpdate,
              originalItem: isPlainObject(noteUpdate.originalItem)
                ? (noteUpdate.originalItem as Record<string, unknown>)
                : item.originalItem,
            };
            const noteId = resolvePendingTargetId(candidateItem, ["noteId", "itemId"]);
            if (!noteId) {
              errors.push("Skipped note edit without noteId");
              continue;
            }
            const rawUpdates = isPlainObject(noteUpdate.updates)
              ? (noteUpdate.updates as Record<string, unknown>)
              : noteUpdate;
            const updates = {
              title: typeof rawUpdates.title === "string" ? rawUpdates.title : undefined,
              content: typeof rawUpdates.content === "string" ? rawUpdates.content : undefined,
            };

            const editResult = await editConfirmedNote({
              projectId,
              noteId: noteId as Id<"notes">,
              updates,
            });

            if (editResult.success) {
              updatedCount++;
            } else {
              errors.push(editResult.message);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(message);
          }
        }

        result = {
          success: errors.length === 0,
          message: errors.length === 0
            ? `Updated ${updatedCount}/${bulkItems.length} notes successfully`
            : `Updated ${updatedCount}/${bulkItems.length} notes with errors: ${errors.slice(0, 3).join(', ')}`,
        };
        break;
      }

      const noteId = resolvePendingTargetId(item, ["noteId", "itemId"]);
      if (!noteId) {
        throw new Error("Missing noteId for note edit");
      }
      result = await editConfirmedNote({
        projectId,
        noteId: noteId as Id<"notes">,
        updates: item.updates as Record<string, unknown>
      });
      break;
    }
    case 'shopping': {
      if (isBulkEdit) {
        if (bulkItems.length === 0) {
          throw new Error("No shopping items provided for bulk edit");
        }

        let updatedCount = 0;
        const errors: string[] = [];

        for (const shoppingUpdate of bulkItems) {
          try {
            const candidateItem: PendingItem = {
              ...item,
              data: shoppingUpdate,
              originalItem: isPlainObject(shoppingUpdate.originalItem)
                ? (shoppingUpdate.originalItem as Record<string, unknown>)
                : item.originalItem,
            };
            const shoppingItemId = resolvePendingTargetId(candidateItem, ["itemId"]);
            if (!shoppingItemId) {
              errors.push("Skipped shopping edit without itemId");
              continue;
            }

            const rawUpdates = isPlainObject(shoppingUpdate.updates)
              ? (shoppingUpdate.updates as Record<string, unknown>)
              : shoppingUpdate;
            const updates = { ...rawUpdates };
            delete updates.itemId;
            delete updates.originalItem;
            delete updates.updates;
            const fallbackCategory =
              updates["category"] ??
              (candidateItem.data ? (candidateItem.data as Record<string, unknown>)["category"] : undefined);
            const targetSectionName = resolveSectionName(updates["sectionName"], fallbackCategory);

            if (targetSectionName && !updates["sectionId"]) {
              const sectionId = await findOrCreateSection(targetSectionName);
              if (sectionId) {
                updates["sectionId"] = sectionId;
              }
            }

            delete updates["sectionName"];
            const sanitizedUpdates = sanitizeShoppingItemData(updates);

            const editResult = await editConfirmedShoppingItem({
              projectId,
              itemId: shoppingItemId as Id<"shoppingListItems">,
              updates: sanitizedUpdates,
            });

            if (editResult.success) {
              updatedCount++;
            } else {
              errors.push(editResult.message);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(message);
          }
        }

        result = {
          success: errors.length === 0,
          message: errors.length === 0
            ? `Updated ${updatedCount}/${bulkItems.length} shopping items successfully`
            : `Updated ${updatedCount}/${bulkItems.length} shopping items with errors: ${errors.slice(0, 3).join(', ')}`,
        };
        break;
      }

      const updates = { ...(item.updates as Record<string, unknown>) };
      const fallbackCategory =
        updates["category"] ?? (item.data ? (item.data as Record<string, unknown>)["category"] : undefined);
      const targetSectionName = resolveSectionName(updates["sectionName"], fallbackCategory);

      if (targetSectionName && !updates["sectionId"]) {
        const sectionId = await findOrCreateSection(targetSectionName);
        if (sectionId) {
          updates["sectionId"] = sectionId;
        }
      }

      delete updates["sectionName"];
      const sanitizedUpdates = sanitizeShoppingItemData(updates);
      const shoppingItemId = resolvePendingTargetId(item, ["itemId"]);
      if (!shoppingItemId) {
        throw new Error("Missing itemId for shopping item edit");
      }

      result = await editConfirmedShoppingItem({
        projectId,
        itemId: shoppingItemId as Id<"shoppingListItems">,
        updates: sanitizedUpdates,
      });
      break;
    }
    case 'shoppingSection':
      await updateShoppingSection({
        sectionId: item.originalItem?._id as Id<"shoppingListSections">,
        name: item.data.name as string,
      });
      result = { success: true, message: "Shopping section updated successfully" };
      break;
    case 'survey': {
      if (isBulkEdit) {
        if (bulkItems.length === 0) {
          throw new Error("No surveys provided for bulk edit");
        }

        let updatedCount = 0;
        const errors: string[] = [];

        for (const surveyUpdate of bulkItems) {
          try {
            const candidateItem: PendingItem = {
              ...item,
              data: surveyUpdate,
              originalItem: isPlainObject(surveyUpdate.originalItem)
                ? (surveyUpdate.originalItem as Record<string, unknown>)
                : item.originalItem,
            };
            const surveyId = resolvePendingTargetId(candidateItem, ["surveyId", "itemId"]);
            if (!surveyId) {
              errors.push("Skipped survey edit without surveyId");
              continue;
            }

            const rawUpdates = isPlainObject(surveyUpdate.updates)
              ? (surveyUpdate.updates as Record<string, unknown>)
              : surveyUpdate;
            const updates = { ...rawUpdates };
            delete updates.itemId;
            delete updates.surveyId;
            delete updates.originalItem;
            delete updates.updates;

            const editResult = await editConfirmedSurvey({
              projectId,
              surveyId: surveyId as Id<"surveys">,
              updates,
            });

            if (editResult.success) {
              updatedCount++;
            } else {
              errors.push(editResult.message);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(message);
          }
        }

        result = {
          success: errors.length === 0,
          message: errors.length === 0
            ? `Updated ${updatedCount}/${bulkItems.length} surveys successfully`
            : `Updated ${updatedCount}/${bulkItems.length} surveys with errors: ${errors.slice(0, 3).join(', ')}`,
        };
        break;
      }

      const surveyId = resolvePendingTargetId(item, ["surveyId", "itemId"]);
      if (!surveyId) {
        throw new Error("Missing surveyId for survey edit");
      }
      result = await editConfirmedSurvey({
        projectId,
        surveyId: surveyId as Id<"surveys">,
        updates: item.updates as Record<string, unknown>
      });
      break;
    }
    case 'labor': {
      if (isBulkEdit) {
        if (bulkItems.length === 0) {
          throw new Error("No labor items provided for bulk edit");
        }

        let updatedCount = 0;
        const errors: string[] = [];

        for (const laborUpdate of bulkItems) {
          try {
            const candidateItem: PendingItem = {
              ...item,
              data: laborUpdate,
              originalItem: isPlainObject(laborUpdate.originalItem)
                ? (laborUpdate.originalItem as Record<string, unknown>)
                : item.originalItem,
            };
            const laborItemId = resolvePendingTargetId(candidateItem, ["itemId"]);
            if (!laborItemId) {
              errors.push("Skipped labor edit without itemId");
              continue;
            }

            const rawUpdates = isPlainObject(laborUpdate.updates)
              ? (laborUpdate.updates as Record<string, unknown>)
              : laborUpdate;
            const laborUpdates = { ...rawUpdates };
            delete laborUpdates.itemId;
            delete laborUpdates.originalItem;
            delete laborUpdates.updates;
            const targetSectionName = laborUpdates["sectionName"] as string | undefined;

            if (targetSectionName && !laborUpdates["sectionId"]) {
              const sectionId = await findOrCreateLaborSection(targetSectionName);
              if (sectionId) {
                laborUpdates["sectionId"] = sectionId;
              }
            }

            delete laborUpdates["sectionName"];

            const editResult = await editConfirmedLaborItem({
              projectId,
              itemId: laborItemId as Id<"laborItems">,
              updates: laborUpdates,
            });

            if (editResult.success) {
              updatedCount++;
            } else {
              errors.push(editResult.message);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(message);
          }
        }

        result = {
          success: errors.length === 0,
          message: errors.length === 0
            ? `Updated ${updatedCount}/${bulkItems.length} labor items successfully`
            : `Updated ${updatedCount}/${bulkItems.length} labor items with errors: ${errors.slice(0, 3).join(', ')}`,
        };
        break;
      }

      const laborUpdates = { ...(item.updates as Record<string, unknown>) };
      const targetSectionName = laborUpdates["sectionName"] as string | undefined;

      if (targetSectionName && !laborUpdates["sectionId"]) {
        const sectionId = await findOrCreateLaborSection(targetSectionName);
        if (sectionId) {
          laborUpdates["sectionId"] = sectionId;
        }
      }

      delete laborUpdates["sectionName"];
      const laborItemId = resolvePendingTargetId(item, ["itemId"]);
      if (!laborItemId) {
        throw new Error("Missing itemId for labor item edit");
      }

      result = await editConfirmedLaborItem({
        projectId,
        itemId: laborItemId as Id<"laborItems">,
        updates: laborUpdates,
      });
      break;
    }
    case 'laborSection':
      await updateLaborSection({
        sectionId: item.originalItem?._id as Id<"laborSections">,
        name: item.data.name as string,
      });
      result = { success: true, message: "Labor section updated successfully" };
      break;
    case 'projectSettings': {
      const source = isPlainObject(item.updates)
        ? item.updates
        : isPlainObject(item.data)
          ? item.data
          : {};
      const updates = sanitizeProjectSettingsUpdates(source);
      if (Object.keys(updates).length === 0) {
        throw new Error("No valid project settings changes were provided");
      }

      await updateProjectSettings({
        projectId,
        ...updates,
      });
      result = { success: true, message: "Project settings updated successfully" };
      break;
    }
    default:
      throw new Error(`Unknown content type for editing: ${item.type}`);
  }

  return result;
}
