/**
 * AI Assistant Utility Functions
 * 
 * Helper functions for normalizing, sanitizing, and processing AI data.
 */

import type {
  PendingItem,
  AnyPendingItemType,
  TaskInput,
  NoteInput,
  ShoppingItemInput,
  LaborItemInput,
  ContactInput,
  ChatHistoryEntry,
  SurveyData,
} from "../types";
import {
  PENDING_ITEM_TYPES,
  TOOL_NAME_MAPPING,
  ALLOWED_SHOPPING_FIELDS,
  ALLOWED_CONTACT_TYPES,
  OPTIONAL_CONTACT_STRING_FIELDS,
} from "../../config/constants";

// ==================== TYPE GUARDS ====================

export const isPendingItemType = (value: unknown): value is AnyPendingItemType =>
  typeof value === "string" && PENDING_ITEM_TYPES.includes(value as AnyPendingItemType);

// ==================== MESSAGE HELPERS ====================

export const computeNextMessageIndex = (history: ChatHistoryEntry[]) =>
  history.reduce(
    (max, entry) => (typeof entry.messageIndex === "number" ? Math.max(max, entry.messageIndex) : max),
    -1
  ) + 1;

// ==================== SURVEY DATA EXTRACTION ====================

export const extractSurveyData = (data: Record<string, unknown>): SurveyData => ({
  title: (data.title as string) || '',
  description: data.description as string | undefined,
  isRequired: data.isRequired as boolean | undefined,
  allowMultipleResponses: data.allowMultipleResponses as boolean | undefined,
  startDate: data.startDate as string | undefined,
  endDate: data.endDate as string | undefined,
  questions: data.questions as SurveyData["questions"],
});

// ==================== SANITIZERS ====================

export const sanitizeShoppingItemData = (data: Record<string, unknown>) => {
  const toNumber = (value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const raw = value.trim();
      const numericLike = raw.match(/-?\d[\d\s.,]*/)?.[0];
      if (!numericLike) return undefined;

      let normalized = numericLike.replace(/\s+/g, "");
      const commaCount = (normalized.match(/,/g) || []).length;
      const dotCount = (normalized.match(/\./g) || []).length;

      if (commaCount > 0 && dotCount > 0) {
        if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
          normalized = normalized.replace(/\./g, "").replace(",", ".");
        } else {
          normalized = normalized.replace(/,/g, "");
        }
      } else if (commaCount > 0) {
        if (commaCount > 1) {
          normalized = normalized.replace(/,/g, "");
        } else {
          const [intPart, fracPart = ""] = normalized.split(",");
          normalized = fracPart.length === 3 ? `${intPart}${fracPart}` : `${intPart}.${fracPart}`;
        }
      } else if (dotCount > 1) {
        normalized = normalized.replace(/\./g, "");
      } else if (dotCount === 1) {
        const [intPart, fracPart = ""] = normalized.split(".");
        if (fracPart.length === 3) {
          normalized = `${intPart}${fracPart}`;
        }
      }

      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
  };

  const normalizedData: Record<string, unknown> = { ...data };
  const quantity = toNumber(data.quantity);
  const unitPrice =
    toNumber(data.unitPrice) ??
    toNumber(data.price);
  const totalPrice = toNumber(data.totalPrice);

  if (quantity !== undefined) {
    normalizedData.quantity = quantity;
  }
  if (unitPrice !== undefined && unitPrice > 0) {
    normalizedData.unitPrice = unitPrice;
  } else if (
    totalPrice !== undefined &&
    totalPrice > 0 &&
    quantity !== undefined &&
    quantity > 0
  ) {
    normalizedData.unitPrice = totalPrice / quantity;
  }
  if (totalPrice !== undefined && totalPrice > 0) {
    normalizedData.totalPrice = totalPrice;
  }

  const sanitized: Record<string, unknown> = {};
  for (const key of ALLOWED_SHOPPING_FIELDS) {
    if (normalizedData[key] !== undefined) {
      sanitized[key] = normalizedData[key];
    }
  }
  return sanitized;
};

export const sanitizeContactData = (data: Record<string, unknown>): ContactInput => {
  const name =
    typeof data.name === "string" && data.name.trim().length > 0
      ? data.name.trim()
      : "Untitled Contact";

  const typeCandidate = typeof data.type === "string" ? data.type.toLowerCase().trim() : "";
  const type = (ALLOWED_CONTACT_TYPES.has(typeCandidate) ? typeCandidate : "other") as ContactInput["type"];

  const sanitized: ContactInput = { name, type };

  for (const field of OPTIONAL_CONTACT_STRING_FIELDS) {
    const value = data[field];
    if (typeof value === "string" && value.trim().length > 0) {
      sanitized[field] = value.trim();
    }
  }

  return sanitized;
};

// ==================== PENDING ITEM NORMALIZERS ====================

export const formatShoppingSectionDisplay = (item: PendingItem): PendingItem => {
  if (item.type !== "shoppingSection") return item;

  const name = (item.data?.name as string) || (item.originalItem?.name as string) || "Shopping Section";
  const originalName = item.originalItem?.name as string | undefined;

  return {
    ...item,
    display: {
      title:
        item.operation === "delete"
          ? `Delete section: ${name}`
          : item.operation === "edit"
            ? `Update section: ${name}`
            : `Create section: ${name}`,
      description:
        item.operation === "edit" && originalName && originalName !== name
          ? `Rename from "${originalName}" to "${name}"`
          : item.operation === "delete"
            ? "The section will be removed; assigned items stay unsectioned."
            : "New shopping list section",
    },
  } satisfies PendingItem;
};

export const normalizePendingItems = (items: PendingItem[]): PendingItem[] =>
  items.map((originalItem) => {
    const normalizeTypeAndOperation = (item: PendingItem) => {
      let type: string = item.type;
      let operation = item.operation;

      if (TOOL_NAME_MAPPING[type]) {
        const mapped = TOOL_NAME_MAPPING[type];
        type = mapped.type;
        operation = operation ?? mapped.operation;
      }

      switch (type) {
        case "create_task":
          type = "task";
          operation = operation ?? "create";
          break;
        case "create_note":
          type = "note";
          operation = operation ?? "create";
          break;
        case "create_shopping_item":
          type = "shopping";
          operation = operation ?? "create";
          break;
        case "create_survey":
          type = "survey";
          operation = operation ?? "create";
          break;
        case "create_contact":
          type = "contact";
          operation = operation ?? "create";
          break;
        case "create_multiple_items":
          type = (item.data?.type as string) || "task";
          operation = operation ?? "bulk_create";
          break;
        case "create_multiple_tasks":
          type = "task";
          operation = operation ?? "bulk_create";
          break;
        case "create_multiple_notes":
          type = "note";
          operation = operation ?? "bulk_create";
          break;
        case "create_multiple_shopping_items":
          type = "shopping";
          operation = operation ?? "bulk_create";
          break;
        case "create_multiple_surveys":
          type = "survey";
          operation = operation ?? "bulk_create";
          break;
        case "create_labor_item":
          type = "labor";
          operation = operation ?? "create";
          break;
        case "create_labor_section":
          type = "laborSection";
          operation = operation ?? "create";
          break;
        case "create_multiple_labor_items":
          type = "labor";
          operation = operation ?? "bulk_create";
          break;
        default:
          break;
      }

      const finalType = isPendingItemType(type) ? type : item.type;
      const finalOperation = operation ?? item.operation ?? "create";

      // Auto-detect bulk data that was mistakenly categorized as single create
      if (finalOperation === "create" && item.data) {
        const data = item.data as Record<string, unknown>;
        const hasBulkTasks = Array.isArray(data.tasks) || (Array.isArray(data.items) && finalType === "task");
        const hasBulkNotes = Array.isArray(data.notes) || (Array.isArray(data.items) && finalType === "note");
        const hasBulkShopping = Array.isArray(data.items) && finalType === "shopping";
        const hasBulkLabor = Array.isArray(data.items) && finalType === "labor";

        if (hasBulkTasks || hasBulkNotes || hasBulkShopping || hasBulkLabor) {
          return {
            ...item,
            type: finalType,
            operation: "bulk_create",
          } satisfies PendingItem;
        }
      }

      return {
        ...item,
        type: finalType,
        operation: finalOperation,
      } satisfies PendingItem;
    };

    let item = normalizeTypeAndOperation(originalItem);

    if (item.type === "task") {
      const selection = item.selection || item.data;
      const taskIds = (selection?.taskIds || item.data?.taskIds) as unknown;
      if (Array.isArray(taskIds)) {
        const normalizedIds = taskIds.map(String);
        item = {
          ...item,
          selection: { ...selection, taskIds: normalizedIds },
          data: { ...item.data, taskIds: normalizedIds },
        };
      }

      if (item.operation === "bulk_create") {
        const tasks = Array.isArray(item.data?.tasks)
          ? (item.data!.tasks as TaskInput[])
          : [];
        const preview = tasks
          .slice(0, 3)
          .map((task) => task.title || "Untitled Task")
          .join(" • ");
        const remaining = Math.max(tasks.length - 3, 0);

        return {
          ...item,
          display: {
            title: `Create ${tasks.length} task${tasks.length === 1 ? "" : "s"}`,
            description:
              tasks.length === 0
                ? "Review tasks before confirming."
                : [preview, remaining > 0 ? `+${remaining} more` : null]
                  .filter(Boolean)
                  .join(" • "),
          },
        };
      }

      if (item.operation === "bulk_edit") {
        const changeSummary = Array.isArray(item.data?.changeSummary)
          ? (item.data!.changeSummary as string[])
          : [];

        const count =
          Array.isArray(item.selection?.taskIds)
            ? (item.selection!.taskIds as string[]).length
            : Array.isArray(item.data?.tasks)
              ? (item.data!.tasks as unknown[]).length
              : 0;

        const summaryPreview =
          changeSummary.length > 0
            ? changeSummary.slice(0, 3).join(" • ")
            : (() => {
              const updatesSource = item.updates || (item.data?.updates as Record<string, unknown>) || {};
              const updateKeys = Object.keys(updatesSource).filter((key) => updatesSource[key] !== undefined);
              if (updateKeys.length === 0) {
                return "Review bulk changes before confirming.";
              }
              const labels = updateKeys.map((key) => {
                switch (key) {
                  case "status":
                    return `Status → ${updatesSource[key]}`;
                  case "priority":
                    return `Priority → ${updatesSource[key]}`;
                  case "assignedTo":
                    return "Assigned user updated";
                  case "tags":
                    return Array.isArray(updatesSource[key])
                      ? `Tags → ${(updatesSource[key] as string[]).join(", ")}`
                      : "Tags updated";
                  case "title":
                    return `Title → ${updatesSource[key]}`;
                  case "description":
                    return "Description updated";
                  default:
                    return `${key} updated`;
                }
              });
              return labels.join(" • ");
            })();

        return {
          ...item,
          display: {
            title: `Bulk edit ${count || "selected"} task${count === 1 ? "" : "s"}`,
            description: summaryPreview,
          },
        };
      }

      const title = (item.data?.title as string) || (item.originalItem?.title as string) || "Task";
      item = {
        ...item,
        display: {
          title:
            item.operation === "delete"
              ? `Delete task: ${title}`
              : item.operation === "edit"
                ? `Update task: ${title}`
                : `Create task: ${title}`,
          description: (item.data?.description as string) || "Review task details before confirming.",
        },
      };
    }

    if (item.type === "note") {
      if (item.operation === "bulk_create") {
        const notes = Array.isArray(item.data?.notes)
          ? (item.data!.notes as NoteInput[])
          : [];
        const preview = notes
          .slice(0, 3)
          .map((note) => note.title || "Untitled Note")
          .join(" • ");
        const remaining = Math.max(notes.length - 3, 0);

        return {
          ...item,
          display: {
            title: `Create ${notes.length} note${notes.length === 1 ? "" : "s"}`,
            description:
              notes.length === 0
                ? "Review notes before confirming."
                : [preview, remaining > 0 ? `+${remaining} more` : null]
                  .filter(Boolean)
                  .join(" • "),
          },
        };
      }

      const title = (item.data?.title as string) || (item.originalItem?.title as string) || "Note";
      item = {
        ...item,
        display: {
          title:
            item.operation === "delete"
              ? `Delete note: ${title}`
              : item.operation === "edit"
                ? `Update note: ${title}`
                : `Create note: ${title}`,
          description: (item.data?.content as string)?.slice(0, 120) || "Review note before confirming.",
        },
      };
    }

    if (item.type === "shopping") {
      if (item.operation === "bulk_create") {
        const items = Array.isArray(item.data?.items)
          ? (item.data!.items as ShoppingItemInput[])
          : [];
        const preview = items
          .slice(0, 3)
          .map((shoppingItem) => shoppingItem.name || "Untitled Item")
          .join(" • ");
        const remaining = Math.max(items.length - 3, 0);

        return {
          ...item,
          display: {
            title: `Create ${items.length} shopping item${items.length === 1 ? "" : "s"}`,
            description:
              items.length === 0
                ? "Review shopping items before confirming."
                : [preview, remaining > 0 ? `+${remaining} more` : null]
                  .filter(Boolean)
                  .join(" • "),
          },
        };
      }

      const name = (item.data?.name as string) || (item.originalItem?.name as string) || "Shopping item";
      item = {
        ...item,
        display: {
          title:
            item.operation === "delete"
              ? `Delete item: ${name}`
              : item.operation === "edit"
                ? `Update item: ${name}`
                : `Create item: ${name}`,
          description: `Quantity: ${item.data?.quantity ?? item.originalItem?.quantity ?? 1}`,
        },
      };
    }

    if (item.type === "survey") {
      if (item.operation === "bulk_create") {
        const surveys = Array.isArray(item.data?.surveys)
          ? (item.data!.surveys as Array<Record<string, unknown>>)
          : [];
        const preview = surveys
          .slice(0, 3)
          .map((survey) => (survey.title as string) || "Untitled Survey")
          .join(" • ");
        const remaining = Math.max(surveys.length - 3, 0);

        return {
          ...item,
          display: {
            title: `Create ${surveys.length} survey${surveys.length === 1 ? "" : "s"}`,
            description:
              surveys.length === 0
                ? "Review surveys before confirming."
                : [preview, remaining > 0 ? `+${remaining} more` : null]
                  .filter(Boolean)
                  .join(" • "),
          },
        };
      }

      const title = (item.data?.title as string) || (item.originalItem?.title as string) || "Survey";
      item = {
        ...item,
        display: {
          title:
            item.operation === "delete"
              ? `Delete survey: ${title}`
              : item.operation === "edit"
                ? `Update survey: ${title}`
                : `Create survey: ${title}`,
          description: (item.data?.description as string) || "Review survey details before confirming.",
        },
      };
    }

    if (item.type === "contact") {
      const name = (item.data?.name as string) || (item.originalItem?.name as string) || "Contact";
      item = {
        ...item,
        display: {
          title:
            item.operation === "delete"
              ? `Delete contact: ${name}`
              : item.operation === "edit"
                ? `Update contact: ${name}`
                : `Create contact: ${name}`,
          description: (item.data?.companyName as string) || (item.data?.email as string) || "Review contact details.",
        },
      };
    }

    if (item.type === "projectSettings") {
      const sourceCandidate =
        item.updates && typeof item.updates === "object"
          ? (item.updates as Record<string, unknown>)
          : item.data && typeof item.data === "object"
            ? (item.data as Record<string, unknown>)
            : {};

      const summary: string[] = [];
      if (typeof sourceCandidate.name === "string") summary.push(`Name → ${sourceCandidate.name}`);
      if (typeof sourceCandidate.status === "string") summary.push(`Status → ${sourceCandidate.status}`);
      if (sourceCandidate.budget !== undefined) summary.push(`Budget → ${String(sourceCandidate.budget)}`);
      if (typeof sourceCandidate.currency === "string") summary.push(`Currency → ${sourceCandidate.currency}`);
      if (typeof sourceCandidate.customer === "string") summary.push(`Client → ${sourceCandidate.customer}`);
      if (typeof sourceCandidate.location === "string") summary.push(`Location → ${sourceCandidate.location}`);
      if (Object.prototype.hasOwnProperty.call(sourceCandidate, "coverImageUrl")) {
        summary.push(
          typeof sourceCandidate.coverImageUrl === "string" && sourceCandidate.coverImageUrl.trim().length > 0
            ? "Cover image updated"
            : "Cover image cleared"
        );
      }
      if (typeof sourceCandidate.description === "string") {
        summary.push("Description updated");
      }

      item = {
        ...item,
        display: {
          title: "Update project settings",
          description:
            summary.length > 0
              ? summary.join(" • ")
              : "Review project settings changes before confirming.",
        },
      };
    }

    if (item.type === "labor") {
      if (item.operation === "bulk_create") {
        const items = Array.isArray(item.data?.items)
          ? (item.data!.items as LaborItemInput[])
          : [];
        const preview = items
          .slice(0, 3)
          .map((laborItem) => laborItem.name || "Untitled Item")
          .join(" • ");
        const remaining = Math.max(items.length - 3, 0);

        return {
          ...item,
          display: {
            title: `Create ${items.length} labor item${items.length === 1 ? "" : "s"}`,
            description:
              items.length === 0
                ? "Review labor items before confirming."
                : [preview, remaining > 0 ? `+${remaining} more` : null]
                  .filter(Boolean)
                  .join(" • "),
          },
        };
      }

      const name = (item.data?.name as string) || (item.originalItem?.name as string) || "Labor item";
      item = {
        ...item,
        display: {
          title:
            item.operation === "delete"
              ? `Delete work: ${name}`
              : item.operation === "edit"
                ? `Update work: ${name}`
                : `Create work: ${name}`,
          description: `${item.data?.quantity ?? item.originalItem?.quantity ?? 1} ${item.data?.unit ?? item.originalItem?.unit ?? "m²"}`,
        },
      };
    }

    if (item.type === "laborSection") {
      const name = (item.data?.name as string) || (item.originalItem?.name as string) || "Labor Section";
      const originalName = item.originalItem?.name as string | undefined;

      return {
        ...item,
        display: {
          title:
            item.operation === "delete"
              ? `Delete section: ${name}`
              : item.operation === "edit"
                ? `Update section: ${name}`
                : `Create section: ${name}`,
          description:
            item.operation === "edit" && originalName && originalName !== name
              ? `Rename from "${originalName}" to "${name}"`
              : item.operation === "delete"
                ? "The section will be removed; assigned items stay unsectioned."
                : "New labor list section",
        },
      } satisfies PendingItem;
    }

    return formatShoppingSectionDisplay(item);
  });

// ==================== BULK ITEM EXPANSION ====================

export const expandBulkEditItems = (items: PendingItem[]): PendingItem[] => {
  return items.flatMap<PendingItem>((item) => {
    if (item.type === 'shoppingSection' || item.type === 'laborSection') {
      return formatShoppingSectionDisplay(item);
    }

    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === "object" && value !== null && !Array.isArray(value);

    const nonEmptyString = (value: unknown): string | undefined => {
      if (typeof value !== "string") return undefined;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    const idFieldByType: Partial<Record<PendingItem["type"], string>> = {
      task: "taskId",
      note: "noteId",
      survey: "surveyId",
      contact: "contactId",
      shoppingSection: "sectionId",
      laborSection: "sectionId",
      projectSettings: "projectId",
    };

    const idCandidatesByType: Partial<Record<PendingItem["type"], string[]>> = {
      task: ["taskId", "itemId", "_id", "id"],
      note: ["noteId", "itemId", "_id", "id"],
      shopping: ["itemId", "_id", "id"],
      labor: ["itemId", "_id", "id"],
      survey: ["surveyId", "itemId", "_id", "id"],
      contact: ["contactId", "itemId", "_id", "id"],
      shoppingSection: ["sectionId", "itemId", "_id", "id"],
      laborSection: ["sectionId", "itemId", "_id", "id"],
      projectSettings: ["projectId", "_id", "id"],
    };

    if (item.operation === 'bulk_create') {
      const tasks = Array.isArray(item.data?.tasks)
        ? (item.data.tasks as TaskInput[])
        : Array.isArray(item.data?.items) && item.type === 'task'
          ? (item.data.items as TaskInput[])
          : [];
      const notes = Array.isArray(item.data?.notes)
        ? (item.data.notes as NoteInput[])
        : Array.isArray(item.data?.items) && item.type === 'note'
          ? (item.data.items as NoteInput[])
          : [];
      const shoppingItems = Array.isArray((item.data as { shoppingItems?: unknown })?.shoppingItems)
        ? ((item.data as { shoppingItems: ShoppingItemInput[] }).shoppingItems)
        : item.type === 'shopping' && Array.isArray(item.data?.items)
          ? (item.data.items as ShoppingItemInput[])
          : Array.isArray(item.data?.tasks) && Array.isArray(item.data?.items)
            ? (item.data.items as ShoppingItemInput[])
            : [];
      const laborItems = item.type === 'labor' && Array.isArray(item.data?.items) ? (item.data.items as LaborItemInput[]) : [];
      const contacts = Array.isArray((item.data as { contacts?: unknown })?.contacts)
        ? ((item.data as { contacts: ContactInput[] }).contacts)
        : [];
      const surveys = Array.isArray(item.data?.surveys) ? (item.data.surveys as Array<Record<string, unknown>>) : [];

      const expandedItems: PendingItem[] = [];

      if (tasks.length > 0) {
        expandedItems.push(...tasks.map((task) => ({
          type: 'task' as const,
          operation: 'create' as const,
          data: task,
          display: {
            title: task.title || 'Untitled Task',
            description: task.description || 'New task',
          },
          functionCall: item.functionCall,
          responseId: item.responseId,
        } satisfies PendingItem)));
      }

      if (notes.length > 0) {
        expandedItems.push(...notes.map((note) => ({
          type: 'note' as const,
          operation: 'create' as const,
          data: note,
          display: {
            title: note.title || 'Untitled Note',
            description: note.content ? note.content.substring(0, 100) + (note.content.length > 100 ? '...' : '') : 'New note',
          },
          functionCall: item.functionCall,
          responseId: item.responseId,
        } satisfies PendingItem)));
      }

      if (shoppingItems.length > 0) {
        expandedItems.push(...shoppingItems.map((shoppingItem) => ({
          type: 'shopping' as const,
          operation: 'create' as const,
          data: shoppingItem,
          display: {
            title: shoppingItem.name || 'Untitled Item',
            description: [
              shoppingItem.notes,
              shoppingItem.sectionName && `Section: ${shoppingItem.sectionName}`,
              shoppingItem.category && `Category: ${shoppingItem.category}`,
              shoppingItem.quantity && shoppingItem.quantity > 1 && `Qty: ${shoppingItem.quantity}`,
            ].filter(Boolean).join(' • ') || 'New shopping item',
          },
          functionCall: item.functionCall,
          responseId: item.responseId,
        } satisfies PendingItem)));
      }

      if (laborItems.length > 0) {
        expandedItems.push(...laborItems.map((laborItem) => ({
          type: 'labor' as const,
          operation: 'create' as const,
          data: laborItem,
          display: {
            title: laborItem.name || 'Untitled Item',
            description: [
              laborItem.notes,
              laborItem.sectionName && `Section: ${laborItem.sectionName}`,
              `${laborItem.quantity || 1} ${laborItem.unit || 'm²'}`,
              laborItem.unitPrice && `${laborItem.unitPrice}/unit`,
            ].filter(Boolean).join(' • ') || 'New labor item',
          },
          functionCall: item.functionCall,
          responseId: item.responseId,
        } satisfies PendingItem)));
      }

      if (contacts.length > 0) {
        expandedItems.push(...contacts.map((contact) => ({
          type: 'contact' as const,
          operation: 'create' as const,
          data: contact as unknown as Record<string, unknown>,
          display: {
            title: contact.name || 'Untitled Contact',
            description: contact.companyName || contact.email || 'New contact',
          },
          functionCall: item.functionCall,
          responseId: item.responseId,
        } satisfies PendingItem)));
      }

      if (surveys.length > 0) {
        expandedItems.push(...surveys.map((survey) => ({
          type: 'survey' as const,
          operation: 'create' as const,
          data: survey,
          display: {
            title: (survey.title as string) || 'Untitled Survey',
            description: (survey.description as string) || 'New survey',
          },
          functionCall: item.functionCall,
          responseId: item.responseId,
        } satisfies PendingItem)));
      }

      if (expandedItems.length > 0) {
        return expandedItems;
      }

      return item;
    }

    if (item.operation === "bulk_edit") {
      const rawItems = Array.isArray((item.data as { items?: unknown })?.items)
        ? ((item.data as { items: unknown[] }).items)
        : [];

      const expandedItems = rawItems.flatMap<PendingItem>((entry) => {
        if (!isRecord(entry)) return [];

        const originalItem = isRecord(entry.originalItem)
          ? { ...entry.originalItem }
          : {};
        const updatesSource = isRecord(entry.updates)
          ? { ...entry.updates }
          : { ...entry };

        delete updatesSource.originalItem;
        delete updatesSource.updates;

        for (const idField of [
          "itemId",
          "taskId",
          "noteId",
          "surveyId",
          "contactId",
          "sectionId",
          "projectId",
          "_id",
          "id",
        ]) {
          delete updatesSource[idField];
        }

        const hasMeaningfulUpdates = Object.values(updatesSource).some((value) => {
          if (value === undefined || value === null) return false;
          if (typeof value === "string") return value.trim().length > 0;
          return true;
        });
        if (!hasMeaningfulUpdates) {
          return [];
        }

        const idCandidates = idCandidatesByType[item.type] ?? ["itemId", "_id", "id"];
        const resolvedId =
          idCandidates
            .map((field) => nonEmptyString(entry[field]) ?? nonEmptyString(originalItem[field]))
            .find(Boolean) ??
          nonEmptyString(originalItem._id);
        const idField = idFieldByType[item.type] ?? "itemId";

        const mergedData: Record<string, unknown> = {
          ...originalItem,
          ...updatesSource,
        };
        if (resolvedId && mergedData[idField] === undefined) {
          mergedData[idField] = resolvedId;
        }

        const normalizedOriginal = resolvedId && originalItem._id === undefined
          ? { ...originalItem, _id: resolvedId }
          : originalItem;

        return [{
          type: item.type,
          operation: "edit",
          data: mergedData,
          updates: updatesSource,
          originalItem: normalizedOriginal,
          functionCall: item.functionCall,
          responseId: item.responseId,
          status: item.status,
          approvalState: item.approvalState,
          approvalReason: item.approvalReason,
        } satisfies PendingItem];
      });

      if (expandedItems.length > 0) {
        return expandedItems;
      }
    }

    if (item.type === 'task' && item.operation === 'bulk_edit') {
      const taskDetails = Array.isArray(item.data?.taskDetails)
        ? (item.data!.taskDetails as Array<{
          taskId: string;
          original?: Record<string, unknown>;
          updates: Record<string, unknown>;
          changeSummary?: string;
        }>)
        : [];

      if (taskDetails.length > 0) {
        return taskDetails.map((detail) => {
          const taskId = detail.taskId;
          const original = detail.original || {};
          const updates = detail.updates || {};
          const taskTitle =
            (original?.title as string) ||
            (item.data?.title as string) ||
            (item.originalItem?.title as string) ||
            "Task";
          const description =
            detail.changeSummary ||
            Object.entries(updates)
              .map(([key, value]) => `${key} → ${String(value)}`)
              .join(" • ") ||
            "Review task changes before confirming.";

          return {
            type: 'task' as const,
            operation: 'edit' as const,
            data: {
              ...original,
              ...updates,
              taskId,
            },
            updates,
            originalItem: original,
            selection: {
              applyToAll: false,
              taskIds: [taskId],
            },
            display: {
              title: `Update task: ${taskTitle}`,
              description,
            },
            functionCall: item.functionCall,
            responseId: item.responseId,
          } satisfies PendingItem;
        });
      }

      const titleChanges = item.titleChanges || (Array.isArray(item.data.titleChanges)
        ? (item.data.titleChanges as PendingItem['titleChanges'])
        : []);

      if (titleChanges && titleChanges.length > 0) {
        const baseSelection = item.selection || item.data || {};
        const baseUpdates = item.updates || (item.data?.updates as Record<string, unknown>) || {};

        return titleChanges.map(change => {
          const taskIdList = change.taskId ? [change.taskId] : Array.isArray(baseSelection.taskIds) ? (baseSelection.taskIds as string[]) : [];
          return {
            type: 'task' as const,
            operation: 'bulk_edit' as const,
            data: {
              ...item.data,
              title: change.newTitle,
              previousTitle: change.originalTitle || change.currentTitle,
              taskId: change.taskId,
              titleChanges: [change],
              taskIds: taskIdList,
            },
            updates: {
              ...baseUpdates,
              title: change.newTitle,
            },
            originalItem: {
              title: change.originalTitle || change.currentTitle,
            },
            selection: {
              applyToAll: false,
              taskIds: taskIdList,
              reason: (baseSelection as { reason?: string }).reason,
            },
            titleChanges: [change],
          } satisfies PendingItem;
        });
      }
    }

    return item;
  });
};

// ==================== BULK OPERATION HELPERS ====================

export const extractBulkSelection = (item: PendingItem) => {
  const source = item.selection || item.data;
  const taskIds = Array.isArray(source?.taskIds)
    ? (source!.taskIds as string[])
    : undefined;
  return {
    taskIds,
    applyToAll: Boolean(source?.applyToAll),
    reason: typeof source?.reason === 'string' ? (source!.reason as string) : undefined,
  };
};

export const extractBulkUpdates = (item: PendingItem) => {
  const source = item.updates || (item.data?.updates as Record<string, unknown>) || {};
  const updates = { ...source } as Record<string, unknown>;
  delete updates.assignedToName;
  return updates;
};

// ==================== SECTION NAME RESOLVER ====================

export const resolveSectionName = (rawSectionName?: unknown, rawCategory?: unknown): string | undefined => {
  const normalizedSection =
    typeof rawSectionName === "string" ? rawSectionName.trim() : "";
  if (normalizedSection.length > 0) {
    return normalizedSection;
  }

  const normalizedCategory = typeof rawCategory === "string" ? rawCategory.trim() : "";
  return normalizedCategory.length > 0 ? normalizedCategory : undefined;
};







