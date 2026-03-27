import type { Id } from "@/convex/_generated/dataModel";
import type {
  PendingItem,
  BulkTaskData,
  BulkNoteData,
  BulkShoppingData,
  BulkLaborData,
  BulkSurveyData,
} from "../../types";
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

export async function confirmBulkCreateItem(
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
  switch (item.type) {
    case 'task': {
      const data = item.data as BulkTaskData;
      const tasks = Array.isArray(data.tasks) ? data.tasks : [];

      if (tasks.length === 0) {
        throw new Error("No tasks provided for bulk creation");
      }

      const createdIds: string[] = [];
      const errors: string[] = [];

      for (const taskData of tasks) {
        try {
          const cleanTaskData = { ...taskData };
          delete (cleanTaskData as Record<string, unknown>).assignedToName;

          const taskResult = await createConfirmedTask({
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

          if (taskResult.success && taskResult.taskId) {
            createdIds.push(taskResult.taskId);
          } else if (!taskResult.success) {
            errors.push(taskResult.message);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(message);
        }
      }

      result = {
        success: errors.length === 0,
        message: `Created ${createdIds.length}/${tasks.length} tasks successfully${errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
          }`,
      };
      break;
    }
    case 'note': {
      const data = item.data as BulkNoteData;
      const notes = Array.isArray(data.notes) ? data.notes : [];

      if (notes.length === 0) {
        throw new Error("No notes provided for bulk creation");
      }

      const createdIds: string[] = [];
      const errors: string[] = [];

      for (const noteData of notes) {
        try {
          const noteResult = await createConfirmedNote({
            projectId,
            noteData: noteData as { title: string; content: string },
          });

          if (noteResult.success && noteResult.noteId) {
            createdIds.push(noteResult.noteId);
          } else if (!noteResult.success) {
            errors.push(noteResult.message);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(message);
        }
      }

      result = {
        success: errors.length === 0,
        message: `Created ${createdIds.length}/${notes.length} notes successfully${errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
          }`,
      };
      break;
    }
    case 'shopping': {
      const data = item.data as BulkShoppingData;
      const items = Array.isArray(data.items) ? data.items : [];

      if (items.length === 0) {
        throw new Error("No shopping items provided for bulk creation");
      }

      const createdIds: string[] = [];
      const errors: string[] = [];

      // Pre-create sections
      const uniqueSectionNames = new Set<string>();
      for (const rawShoppingData of items) {
        const shoppingData = extractShoppingInput(rawShoppingData);
        const targetSectionName = resolveSectionName(
          shoppingData.sectionName,
          shoppingData.category,
        );
        if (targetSectionName && !shoppingData.sectionId) {
          uniqueSectionNames.add(targetSectionName);
        }
      }

      const sectionNameToId = new Map<string, Id<"shoppingListSections">>();
      for (const sectionName of uniqueSectionNames) {
        const sectionId = await findOrCreateSection(sectionName);
        if (sectionId) {
          sectionNameToId.set(sectionName, sectionId);
        }
      }

      for (const rawShoppingData of items) {
        try {
          const shoppingData = extractShoppingInput(rawShoppingData);
          const { sectionName, ...shoppingItemData } = shoppingData;
          const targetSectionName = resolveSectionName(sectionName, shoppingData.category);

          if (targetSectionName && !shoppingItemData.sectionId) {
            const sectionId = sectionNameToId.get(targetSectionName);
            if (sectionId) {
              shoppingItemData.sectionId = sectionId;
            }
          }

          const sanitizedItemData = sanitizeShoppingItemData(shoppingItemData as Record<string, unknown>);
          const normalizedName =
            typeof sanitizedItemData.name === "string"
              ? sanitizedItemData.name.trim()
              : "";
          if (normalizedName.length === 0) {
            errors.push("Skipped shopping item without a name");
            continue;
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

          const shoppingResult = await createConfirmedShoppingItem({
            projectId,
            itemData: sanitizedItemData as {
              name: string;
              quantity: number;
              notes?: string;
              priority?: 'low' | 'medium' | 'high' | 'urgent';
              buyBefore?: string;
              supplier?: string;
              category?: string;
              unitPrice?: number;
              sectionId?: Id<'shoppingListSections'>;
              alternativeToItemId?: Id<'shoppingListItems'>;
              selectedAlternativeItemId?: Id<'shoppingListItems'>;
            },
          });

          if (shoppingResult.success && shoppingResult.itemId) {
            createdIds.push(shoppingResult.itemId);
          } else if (!shoppingResult.success) {
            errors.push(shoppingResult.message);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(message);
        }
      }

      result = {
        success: errors.length === 0,
        message: `Created ${createdIds.length}/${items.length} shopping items successfully${errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
          }`,
      };
      break;
    }
    case 'survey': {
      const data = item.data as BulkSurveyData;
      const surveys = Array.isArray(data.surveys)
        ? data.surveys
        : Array.isArray((data as { items?: Array<Record<string, unknown>> }).items)
          ? ((data as { items: Array<Record<string, unknown>> }).items)
          : [];

      if (surveys.length === 0) {
        throw new Error("No surveys provided for bulk creation");
      }

      const createdIds: string[] = [];
      const errors: string[] = [];

      for (const surveyData of surveys) {
        try {
          const surveyResult = await createConfirmedSurvey({
            projectId,
            surveyData: extractSurveyData(surveyData as Record<string, unknown>),
          });

          if (surveyResult.success && surveyResult.surveyId) {
            createdIds.push(surveyResult.surveyId);
          } else if (!surveyResult.success) {
            errors.push(surveyResult.message);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(message);
        }
      }

      result = {
        success: errors.length === 0,
        message: `Created ${createdIds.length}/${surveys.length} surveys successfully${errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
          }`,
      };
      break;
    }
    case 'contact': {
      const contacts = Array.isArray(
        (item.data as { contacts?: Array<Record<string, unknown>> }).contacts
      )
        ? ((item.data as { contacts?: Array<Record<string, unknown>> }).contacts as Array<Record<string, unknown>>)
        : Array.isArray(
          (item.data as { items?: Array<Record<string, unknown>> }).items
        )
          ? ((item.data as { items: Array<Record<string, unknown>> }).items)
        : [];

      if (contacts.length === 0) {
        throw new Error("No contacts provided for bulk creation");
      }

      const slug = resolveTeamSlug();
      if (!slug) {
        throw new Error("Missing team slug for contact creation");
      }

      const createdIds: string[] = [];
      const errors: string[] = [];

      for (const contact of contacts) {
        try {
          const contactResult = await createConfirmedContact({
            teamSlug: slug,
            contactData: sanitizeContactData(contact),
          });

          if (contactResult.success && contactResult.contactId) {
            createdIds.push(contactResult.contactId);
          } else if (!contactResult.success) {
            errors.push(contactResult.message);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(message);
        }
      }

      result = {
        success: errors.length === 0,
        message: `Created ${createdIds.length}/${contacts.length} contacts successfully${errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
          }`,
      };
      break;
    }
    case 'labor': {
      const data = item.data as BulkLaborData;
      const items = Array.isArray(data.items) ? data.items : [];

      if (items.length === 0) {
        throw new Error("No labor items provided for bulk creation");
      }

      const createdIds: string[] = [];
      const errors: string[] = [];

      // Pre-create sections
      const uniqueSectionNames = new Set<string>();
      for (const rawLaborData of items) {
        const laborData = extractLaborInput(rawLaborData);
        const targetSectionName = getFirstNonEmptyString(laborData.sectionName);
        if (targetSectionName && !laborData.sectionId) {
          uniqueSectionNames.add(targetSectionName);
        }
      }

      const sectionNameToId = new Map<string, Id<"laborSections">>();
      for (const sectionName of uniqueSectionNames) {
        const sectionId = await findOrCreateLaborSection(sectionName);
        if (sectionId) {
          sectionNameToId.set(sectionName, sectionId);
        }
      }

      for (const rawLaborData of items) {
        try {
          const laborData = extractLaborInput(rawLaborData);
          const { sectionName, ...laborItemData } = laborData;
          const targetSectionName = getFirstNonEmptyString(sectionName);

          if (targetSectionName && !laborItemData.sectionId) {
            const sectionId = sectionNameToId.get(targetSectionName);
            if (sectionId) {
              laborItemData.sectionId = sectionId;
            }
          }

          const normalizedName = getFirstNonEmptyString(laborItemData.name);
          if (!normalizedName) {
            errors.push("Skipped labor item without a name");
            continue;
          }
          const normalizedQuantity = toFiniteNumber(laborItemData.quantity) ?? 1;
          const normalizedUnitPrice = toFiniteNumber(laborItemData.unitPrice);
          const normalizedUnit = getFirstNonEmptyString(laborItemData.unit);
          const normalizedNotes = getFirstNonEmptyString(laborItemData.notes);
          const normalizedAssignedTo = getFirstNonEmptyString(laborItemData.assignedTo);

          const laborResult = await createConfirmedLaborItem({
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

          if (laborResult.success && laborResult.itemId) {
            createdIds.push(laborResult.itemId);
          } else if (!laborResult.success) {
            errors.push(laborResult.message);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(message);
        }
      }

      result = {
        success: errors.length === 0,
        message: `Created ${createdIds.length}/${items.length} labor items successfully${errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
          }`,
      };
      break;
    }
    case 'shoppingSection': {
      const rawData = item.data as Record<string, unknown>;
      const rawItems = Array.isArray(rawData.items)
        ? (rawData.items as Array<Record<string, unknown>>)
        : [];
      const namesFromItems = rawItems
        .map((entry) =>
          getFirstNonEmptyString(entry.name, entry.sectionName, entry.title) ?? "",
        )
        .filter((name) => name.length > 0);
      const singleName = getFirstNonEmptyString(
        rawData.name,
        rawData.sectionName,
        rawData.title,
      ) ?? "";
      const sectionNames = Array.from(new Set(
        (namesFromItems.length > 0 ? namesFromItems : [singleName]).filter((name) => name.length > 0)
      ));

      if (sectionNames.length === 0) {
        throw new Error("No shopping sections provided for bulk creation");
      }

      const resolvedIds: string[] = [];
      const errors: string[] = [];

      for (const sectionName of sectionNames) {
        try {
          const sectionId = await findOrCreateSection(sectionName);
          if (sectionId) {
            resolvedIds.push(sectionId);
          } else {
            errors.push(`Failed to create or resolve shopping section "${sectionName}"`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(message);
        }
      }

      result = {
        success: errors.length === 0,
        message: `Processed ${resolvedIds.length}/${sectionNames.length} shopping sections${errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
          }`,
      };
      break;
    }
    case 'laborSection': {
      const rawData = item.data as Record<string, unknown>;
      const rawItems = Array.isArray(rawData.items)
        ? (rawData.items as Array<Record<string, unknown>>)
        : [];
      const namesFromItems = rawItems
        .map((entry) =>
          getFirstNonEmptyString(entry.name, entry.sectionName, entry.title) ?? "",
        )
        .filter((name) => name.length > 0);
      const singleName = getFirstNonEmptyString(
        rawData.name,
        rawData.sectionName,
        rawData.title,
      ) ?? "";
      const sectionNames = Array.from(new Set(
        (namesFromItems.length > 0 ? namesFromItems : [singleName]).filter((name) => name.length > 0)
      ));

      if (sectionNames.length === 0) {
        throw new Error("No labor sections provided for bulk creation");
      }

      const resolvedIds: string[] = [];
      const errors: string[] = [];

      for (const sectionName of sectionNames) {
        try {
          const sectionId = await findOrCreateLaborSection(sectionName);
          if (sectionId) {
            resolvedIds.push(sectionId);
          } else {
            errors.push(`Failed to create or resolve labor section "${sectionName}"`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(message);
        }
      }

      result = {
        success: errors.length === 0,
        message: `Processed ${resolvedIds.length}/${sectionNames.length} labor sections${errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
          }`,
      };
      break;
    }
    default:
      throw new Error(`Unsupported bulk create type: ${item.type}`);
  }

  return result;
}
