import type { Id } from "@/convex/_generated/dataModel";
import type { PendingItem } from "../../types";
import {
  sanitizeShoppingItemData,
  sanitizeContactData,
  extractSurveyData,
  resolveSectionName,
} from "../../utils";
import {
  extractLaborInput,
  extractShoppingInput,
  getFirstNonEmptyString,
  toFiniteNumber,
} from "../pendingItemsHelpers";
import type { ConfirmSingleItemResult, PendingItemsConfirmContext } from "./types";

export async function confirmCreateItem(
  item: PendingItem,
  context: PendingItemsConfirmContext,
): Promise<ConfirmSingleItemResult> {
  const {
    projectId,
    resolveTeamSlug,
    findOrCreateSection,
    findOrCreateLaborSection,
    createConfirmedTask,
    createConfirmedNote,
    createConfirmedShoppingItem,
    createConfirmedSurvey,
    createConfirmedContact,
    createConfirmedLaborItem,
  } = context;

  let result: ConfirmSingleItemResult;
  // Create operations
  switch (item.type) {
    case 'task':
      const cleanTaskData = { ...(item.data as Record<string, unknown>) };
      delete cleanTaskData.assignedToName;
      result = await createConfirmedTask({
        projectId,
        taskData: cleanTaskData as {
          title: string;
          status?: 'todo' | 'in_progress' | 'review' | 'done';
          description?: string;
          assignedTo?: string | null;
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          startDate?: string;
          endDate?: string;
          tags?: string[];
        },
      });
      break;
    case 'note':
      result = await createConfirmedNote({
        projectId,
        noteData: item.data as { title: string; content: string }
      });
      break;
    case 'shopping': {
      const rawShoppingData = extractShoppingInput(item.data);
      const { sectionName, ...shoppingItemData } = rawShoppingData;
      const targetSectionName = resolveSectionName(sectionName, rawShoppingData.category);

      if (targetSectionName && !shoppingItemData.sectionId) {
        const sectionId = await findOrCreateSection(targetSectionName);
        if (sectionId) {
          shoppingItemData.sectionId = sectionId;
        }
      }

      const sanitizedItemData = sanitizeShoppingItemData(shoppingItemData);
      const normalizedName =
        typeof sanitizedItemData.name === "string"
          ? sanitizedItemData.name.trim()
          : "";
      if (normalizedName.length === 0) {
        result = {
          success: false,
          message: "Shopping item is missing name. Edit it and try again.",
        };
        break;
      }

      const normalizedQuantity = toFiniteNumber(sanitizedItemData.quantity);
      const normalizedUnitPrice = toFiniteNumber(sanitizedItemData.unitPrice);
      const normalizedTotalPrice = toFiniteNumber(sanitizedItemData.totalPrice);
      sanitizedItemData.name = normalizedName;
      sanitizedItemData.quantity = normalizedQuantity ?? 1;
      if (normalizedUnitPrice !== undefined) {
        sanitizedItemData.unitPrice = normalizedUnitPrice;
      }
      if (normalizedTotalPrice !== undefined) {
        sanitizedItemData.totalPrice = normalizedTotalPrice;
      }

      result = await createConfirmedShoppingItem({
        projectId,
        itemData: sanitizedItemData as {
          name: string;
          quantity: number;
          notes?: string;
          priority?: "low" | "medium" | "high" | "urgent";
          buyBefore?: string;
          supplier?: string;
          category?: string;
          unitPrice?: number;
          sectionId?: Id<"shoppingListSections">;
          alternativeToItemId?: Id<"shoppingListItems">;
          selectedAlternativeItemId?: Id<"shoppingListItems">;
        },
      });
      break;
    }
    case 'shoppingSection': {
      const rawSectionData = item.data as Record<string, unknown>;
      const targetSectionName = resolveSectionName(
        getFirstNonEmptyString(
          rawSectionData?.name,
          rawSectionData?.sectionName,
          rawSectionData?.title,
        ),
      );
      if (!targetSectionName) {
        result = {
          success: false,
          message: "Shopping section is missing name. Edit it and try again.",
        };
        break;
      }

      const sectionId = await findOrCreateSection(targetSectionName);
      if (!sectionId) {
        result = {
          success: false,
          message: `Failed to create or resolve shopping section "${targetSectionName}".`,
        };
        break;
      }

      result = {
        success: true,
        sectionId,
        message: "Shopping section created successfully",
      };
      break;
    }
    case 'survey':
      result = await createConfirmedSurvey({
        projectId,
        surveyData: extractSurveyData(item.data)
      });
      break;
    case 'contact': {
      const slug = resolveTeamSlug();
      if (!slug) {
        throw new Error("Missing team slug for contact creation");
      }
      result = await createConfirmedContact({
        teamSlug: slug,
        contactData: sanitizeContactData(item.data),
      });
      break;
    }
    case 'labor': {
      const rawLaborData = extractLaborInput(item.data);
      const { sectionName, ...laborItemData } = rawLaborData;
      const targetSectionName = getFirstNonEmptyString(sectionName);

      if (targetSectionName && !laborItemData.sectionId) {
        const sectionId = await findOrCreateLaborSection(targetSectionName);
        if (sectionId) {
          laborItemData.sectionId = sectionId;
        }
      }

      const normalizedName = getFirstNonEmptyString(laborItemData.name);
      if (!normalizedName) {
        result = {
          success: false,
          message: "Labor item is missing name. Edit it and try again.",
        };
        break;
      }
      const normalizedQuantity = toFiniteNumber(laborItemData.quantity) ?? 1;
      const normalizedUnitPrice = toFiniteNumber(laborItemData.unitPrice);
      const normalizedUnit = getFirstNonEmptyString(laborItemData.unit);
      const normalizedNotes = getFirstNonEmptyString(laborItemData.notes);
      const normalizedAssignedTo = getFirstNonEmptyString(laborItemData.assignedTo);

      result = await createConfirmedLaborItem({
        projectId,
        itemData: {
          name: normalizedName,
          quantity: normalizedQuantity,
          unit: normalizedUnit,
          notes: normalizedNotes,
          unitPrice: normalizedUnitPrice,
          sectionId: laborItemData.sectionId,
          assignedTo: normalizedAssignedTo,
        },
      });
      break;
    }
    case 'laborSection': {
      const rawSectionData = item.data as Record<string, unknown>;
      const targetSectionName = getFirstNonEmptyString(
        rawSectionData?.name,
        rawSectionData?.sectionName,
        rawSectionData?.title,
      );
      if (!targetSectionName) {
        result = {
          success: false,
          message: "Labor section is missing name. Edit it and try again.",
        };
        break;
      }

      const sectionId = await findOrCreateLaborSection(targetSectionName);
      if (!sectionId) {
        result = {
          success: false,
          message: `Failed to create or resolve labor section "${targetSectionName}".`,
        };
        break;
      }

      result = {
        success: true,
        sectionId,
        message: "Labor section created successfully",
      };
      break;
    }
    default:
      throw new Error(`Unknown content type: ${item.type}`);
  }
  return result;
}
