import type { Id } from "@/convex/_generated/dataModel";
import type { PendingItem } from "../../types";
import type { ConfirmSingleItemResult, PendingItemsConfirmContext } from "./types";

export async function confirmDeleteItem(
  item: PendingItem,
  context: PendingItemsConfirmContext,
): Promise<ConfirmSingleItemResult> {
  const {
    deleteTask,
    deleteNote,
    deleteFile,
    deleteShoppingItem,
    deleteShoppingSection,
    deleteSurvey,
    deleteContact,
    deleteLaborItem,
    deleteLaborSection,
  } = context;

  let result: ConfirmSingleItemResult;
  switch (item.type) {
    case 'task': {
      const taskId = item.data.itemId as Id<"tasks">;
      if (!taskId) {
        throw new Error("Missing itemId for task deletion");
      }
      await deleteTask({ taskId });
      result = { success: true, message: "Task deleted successfully" };
      break;
    }
    case 'note': {
      const noteId = item.data.itemId as Id<"notes">;
      if (!noteId) {
        throw new Error("Missing itemId for note deletion");
      }
      await deleteNote({ noteId });
      result = { success: true, message: "Note deleted successfully" };
      break;
    }
    case 'moodboard': {
      const fileId = (item.data.fileId ?? item.data.itemId ?? item.originalItem?._id) as Id<"files">;
      if (!fileId) {
        throw new Error("Missing fileId for moodboard image deletion");
      }
      await deleteFile({ fileId });
      result = { success: true, message: "Moodboard image deleted successfully" };
      break;
    }
    case 'shopping': {
      // itemId is consistent across both formats
      const itemId = item.data.itemId as Id<"shoppingListItems">;
      if (!itemId) {
        throw new Error("Missing itemId for shopping item deletion");
      }
      await deleteShoppingItem({ itemId });
      result = { success: true, message: "Shopping item deleted successfully" };
      break;
    }
    case 'shoppingSection': {
      const sectionId = (item.data.sectionId ?? item.data.itemId) as Id<"shoppingListSections">;
      if (!sectionId) {
        throw new Error("Missing sectionId for shopping section deletion");
      }
      await deleteShoppingSection({ sectionId });
      result = { success: true, message: "Shopping section deleted successfully" };
      break;
    }
    case 'survey': {
      const surveyId = item.data.itemId as Id<"surveys">;
      if (!surveyId) {
        throw new Error("Missing itemId for survey deletion");
      }
      await deleteSurvey({ surveyId });
      result = { success: true, message: "Survey deleted successfully" };
      break;
    }
    case 'contact': {
      const contactId = item.data.itemId as Id<"contacts">;
      if (!contactId) {
        throw new Error("Missing itemId for contact deletion");
      }
      await deleteContact({ contactId });
      result = { success: true, message: "Contact deleted successfully" };
      break;
    }
    case 'labor': {
      // itemId is consistent across both formats
      const itemId = item.data.itemId as Id<"laborItems">;
      if (!itemId) {
        throw new Error("Missing itemId for labor item deletion");
      }
      await deleteLaborItem({ itemId });
      result = { success: true, message: "Labor item deleted successfully" };
      break;
    }
    case 'laborSection': {
      const sectionId = (item.data.sectionId ?? item.data.itemId) as Id<"laborSections">;
      if (!sectionId) {
        throw new Error("Missing sectionId for labor section deletion");
      }
      await deleteLaborSection({ sectionId });
      result = { success: true, message: "Labor section deleted successfully" };
      break;
    }
    default:
      throw new Error(`Unknown content type for deletion: ${item.type}`);
  }

  return result;
}
