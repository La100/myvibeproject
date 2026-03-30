/**
 * Myvibe project AI Tools - Shared tool definitions
 *
 * This file is the SINGLE SOURCE OF TRUTH for all AI tools.
 * It exports:
 * 1. Tool schemas (Zod) - used by both streaming and agent implementations
 * 2. createStreamingTools() - for AI SDK streamText
 * 3. createAgentTools() - for Convex Agent
 *
 * Tools return JSON structures for confirmation UI, not direct actions.
 */

import { z } from "zod";
import { createTool, type ToolCtx } from "@convex-dev/agent";
import type { Id } from "../_generated/dataModel";
import type { ProjectContextSnapshot } from "./types";
import { assistantToolNames } from "./toolMetadata.ts";

// RunAction type matches ctx.runAction signature
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunActionFn = (action: any, args: any) => Promise<any>;
// RunQuery type matches ctx.runQuery signature
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunQueryFn = (query: any, args: any) => Promise<any>;
// RunMutation type matches ctx.runMutation signature
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunMutationFn = (mutation: any, args: any) => Promise<any>;

type InternalSearchApi = {
  getItemById: unknown;
  searchTasks: unknown;
  searchNotes: unknown;
  searchShoppingItems: unknown;
  searchLaborItems: unknown;
  searchSurveys: unknown;
  searchContacts: unknown;
};

const getInternalSearchApi = (): InternalSearchApi => {
  // Keep this runtime-loaded to avoid deep type instantiation in TS.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const apiModule = require("../_generated/api") as { internal: unknown };
  return (
    apiModule.internal as { ai: { search: InternalSearchApi } }
  ).ai.search;
};

const getPublicApi = (): any => {
  // Keep this runtime-loaded to avoid deep type instantiation in TS.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const apiModule = require("../_generated/api") as { api: unknown };
  return apiModule.api as any;
};

// ============================================
// TOOL SCHEMAS - OPTIMIZED VERSION
// ============================================

// Item type enum
const itemTypeEnum = z.enum([
  "task",
  "note",
  "shopping",
  "labor",
  "survey",
  "contact",
  "shoppingSection",
  "laborSection",
]);

type ItemType = z.infer<typeof itemTypeEnum>;

// Field definitions for each type
const taskFields = z.object({
  title: z.string().describe("Task title"),
  description: z.string().optional().describe("Task description"),
  content: z.string().optional().describe("Rich text content"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("Task priority"),
  status: z.enum(["todo", "in_progress", "review", "done"]).optional().describe("Task status"),
  assignedTo: z.string().optional().describe("Clerk ID of the team member (format: user_xxxxx)"),
  assignedToName: z.string().optional().describe("Display name of the assigned team member"),
  startDate: z.string().optional().describe("Start date in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)"),
  endDate: z.string().optional().describe("End date in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)"),
  tags: z.array(z.string()).optional().describe("Task tags for categorization"),
}).passthrough();

const noteFields = z.object({
  title: z.string().describe("Note title"),
  content: z.string().describe("Note content"),
}).passthrough();

const shoppingFields = z.object({
  name: z.string().describe("Item name"),
  notes: z.string().optional().describe("Additional notes or description"),
  quantity: z.number().optional().describe("Quantity needed"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("Item priority"),
  buyBefore: z.string().optional().describe("Buy before date in ISO format (YYYY-MM-DD)"),
  supplier: z.string().optional().describe("Supplier or store name"),
  category: z.string().optional().describe("Item category"),
  dimensions: z.string().optional().describe("Item dimensions or size"),
  price: z.union([z.number(), z.string()]).optional().describe("Alias for unitPrice (price per unit, project currency)"),
  unitPrice: z.union([z.number(), z.string()]).optional().describe("Price per unit in project currency"),
  totalPrice: z.union([z.number(), z.string()]).optional().describe("Total price in project currency"),
  productLink: z.string().optional().describe("Link to product page"),
  catalogNumber: z.string().optional().describe("Product catalog/model number"),
  sectionId: z.string().optional().describe("Shopping list section ID"),
  sectionName: z.string().optional().describe("Shopping list section name"),
  alternativeToItemId: z.string().optional().describe("Optional base shopping item ID when this item is an alternative option for another item"),
  selectedAlternativeItemId: z.string().optional().describe("Optional selected alternative item ID stored on the base shopping item"),
}).passthrough();

const laborFields = z.object({
  name: z.string().describe("Work description"),
  notes: z.string().optional().describe("Additional notes or description"),
  quantity: z.number().optional().describe("Quantity of work"),
  unit: z.string().optional().describe("Unit of measurement (m², m, hours, pcs, etc.)"),
  price: z.union([z.number(), z.string()]).optional().describe("Alias for unitPrice (price per unit, project currency)"),
  unitPrice: z.union([z.number(), z.string()]).optional().describe("Price per unit in project currency"),
  sectionId: z.string().optional().describe("Labor section ID"),
  sectionName: z.string().optional().describe("Labor section name"),
  assignedTo: z.string().optional().describe("Contractor or team member name"),
}).passthrough();

const surveyQuestionFields = z.object({
  questionText: z.string(),
  questionType: z.enum(["text_short", "text_long", "multiple_choice", "single_choice", "rating", "yes_no", "number", "file"]),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().optional(),
}).passthrough();

const surveyQuestionUpdateFields = z
  .object({
    questionId: z.string().optional().describe("Existing survey question ID (required for edit/delete)"),
    operation: z.enum(["create", "edit", "delete"]).optional().describe("Question operation when editing a survey"),
    questionText: z.string().optional(),
    questionType: z.enum(["text_short", "text_long", "multiple_choice", "single_choice", "rating", "yes_no", "number", "file"]).optional(),
    options: z.array(z.string()).optional(),
    isRequired: z.boolean().optional(),
    order: z.number().optional(),
  })
  .passthrough();

const surveyFields = z.object({
  title: z.string().describe("Survey title"),
  description: z.string().optional().describe("Survey description"),
  isRequired: z.boolean().optional().describe("Whether survey is required"),
  allowMultipleResponses: z.boolean().optional().describe("Allow multiple responses"),
  startDate: z.string().optional().describe("Survey start date in ISO format"),
  endDate: z.string().optional().describe("Survey end date in ISO format"),
  questions: z.array(surveyQuestionFields).optional().describe("Survey questions"),
}).passthrough();

const contactFields = z.object({
  name: z.string().describe("Contact name"),
  companyName: z.string().optional().describe("Company name"),
  email: z.string().optional().describe("Email address"),
  phone: z.string().optional().describe("Phone number"),
  address: z.string().optional().describe("Physical address"),
  city: z.string().optional().describe("City"),
  postalCode: z.string().optional().describe("Postal code"),
  website: z.string().optional().describe("Website URL"),
  taxId: z.string().optional().describe("Tax ID"),
  type: z.enum(["contractor", "supplier", "subcontractor", "other"]).optional().describe("Contact type"),
  notes: z.string().optional().describe("Additional notes"),
}).passthrough();

const sectionFields = z.object({
  name: z.string().describe("Section name. Mandatory for shoppingSection/laborSection confirmation cards. If sectionName exists, copy the same value into name."),
  sectionName: z.string().optional().describe("Optional section name alias. When provided, it should match name."),
}).passthrough();

const projectStatusEnum = z.enum([
  "planning",
  "active",
  "on_hold",
  "completed",
  "cancelled",
]);

const projectCurrencyEnum = z.enum([
  "USD", "EUR", "PLN", "GBP", "CAD", "AUD", "JPY", "CHF", "SEK", "NOK",
  "DKK", "CZK", "HUF", "CNY", "INR", "BRL", "MXN", "KRW", "SGD", "HKD",
]);

export const updateProjectSettingsSchema = z.object({
  name: z.string().optional().describe("Project name (min 2 characters)"),
  description: z.string().optional().describe("Project description"),
  coverImageUrl: z.string().optional().describe("Project cover image URL (or empty string to clear)"),
  status: projectStatusEnum.optional().describe("Project status"),
  customer: z.string().optional().describe("Client name"),
  location: z.string().optional().describe("Project location"),
  budget: z.number().positive().optional().describe("Project budget"),
  currency: projectCurrencyEnum.optional().describe("Project currency"),
});

// Generic create schema
export const createItemSchema = z.object({
  type: itemTypeEnum.describe("Type of item to create"),
  data: z.union([taskFields, noteFields, shoppingFields, laborFields, surveyFields, contactFields, sectionFields]).describe("Item data based on type"),
});

export const createMultipleItemsSchema = z.object({
  type: itemTypeEnum.describe("Type of items to create"),
  items: z
    .array(
      z.union([
        taskFields,
        noteFields,
        shoppingFields,
        laborFields,
        surveyFields,
        contactFields,
        sectionFields,
      ]),
    )
    .describe("Array of items to create"),
});

const updatableTaskFields = taskFields.partial().passthrough();
const updatableNoteFields = noteFields.partial().passthrough();
const updatableShoppingFields = shoppingFields.partial().passthrough();
const updatableLaborFields = laborFields.partial().passthrough();
const updatableSurveyFields = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    isRequired: z.boolean().optional(),
    allowMultipleResponses: z.boolean().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    questions: z.array(surveyQuestionUpdateFields).optional(),
  })
  .passthrough();
const updatableContactFields = contactFields.partial().passthrough();
const updatableSectionFields = sectionFields.partial().passthrough();

const updatableAnyFields = z
  .union([
    updatableTaskFields,
    updatableNoteFields,
    updatableShoppingFields,
    updatableLaborFields,
    updatableSurveyFields,
    updatableContactFields,
    updatableSectionFields,
  ])
  .describe("Fields to update");

// Keep root schema as object for AI SDK compatibility.
export const updateItemSchema = z
  .object({
    type: itemTypeEnum.describe("Type of item to update"),
    itemId: z.string().describe("ID of the item to update"),
    data: updatableAnyFields.optional(),
  })
  .passthrough();

// Keep root schema as object for AI SDK compatibility.
export const updateMultipleItemsSchema = z
  .object({
    type: itemTypeEnum.describe("Type of items to update"),
    updates: z
      .array(
        z
          .object({
            itemId: z.string(),
            data: updatableAnyFields.optional(),
          })
          .passthrough(),
      )
      .describe("Array of items to update with their IDs"),
  })
  .passthrough();

// Generic delete schema
export const deleteItemSchema = z.object({
  type: itemTypeEnum.describe("Type of item to delete"),
  itemId: z.string().describe("ID of the item to delete"),
  name: z.string().optional().describe("Item name for display purposes"),
  reason: z.string().optional().describe("Optional reason for deletion"),
});

// Generic search schema
export const searchItemsSchema = z.object({
  type: z.enum(["task", "note", "shopping", "labor", "survey", "contact"]).describe("Type of items to search"),
  query: z.string().optional().describe("Search query"),
  filters: z
    .record(z.union([z.string(), z.number(), z.boolean()]))
    .optional()
    .describe("Type-specific filters supported by the selected type"),
  limit: z.number().optional().default(10).describe("Maximum number of results"),
});

// Keep specific schemas for dedicated use cases.
export const loadFullProjectContextSchema = z.object({
  reason: z.string().optional().describe("Why you need the full context"),
});

export const generateMoodboardImageSchema = z.object({
  prompt: z
    .string()
    .min(8)
    .describe("Detailed prompt for the moodboard image to generate"),
  section: z
    .string()
    .optional()
    .describe("Moodboard section name, for example Concept, Details, Kitchen, or Materials"),
});

// ============================================
// AI SDK TOOLS (for streaming)
// ============================================

// Types for tool options
interface StreamingToolOptions {
  projectId?: string;
  teamSlug?: string;
  userClerkId?: string;
  runAction?: RunActionFn;
  runQuery?: RunQueryFn;
  runMutation?: RunMutationFn;
  loadSnapshot?: () => Promise<ProjectContextSnapshot>;
  allowedToolNames?: readonly string[];
  crudApprovalMode?: "always_ask" | "auto_confirm";
}

type ToolApprovalMetadata = {
  required: boolean;
  mode: "always_ask" | "auto_confirm";
  reason: string;
};

type AssistantToolPayload = Record<string, unknown> | string;

type AssistantToolDefinition<INPUT> = {
  description: string;
  inputSchema: any;
  inputExamples?: INPUT[];
  requiresConfirmation?: boolean | ((input: INPUT) => boolean | Promise<boolean>);
  confirmationReason?: string | ((input: INPUT) => string);
  execute: (input: INPUT) => Promise<AssistantToolPayload>;
};

type AssistantToolInstance<INPUT> = {
  description?: string;
  inputSchema?: unknown;
  execute: (input: INPUT, options?: unknown) => Promise<string>;
};

export const ALL_RUNTIME_TOOL_NAMES = assistantToolNames;

export function getActiveRuntimeToolNames(
  allowedToolNames?: readonly string[],
): string[] {
  if (!allowedToolNames || allowedToolNames.length === 0) {
    return [...ALL_RUNTIME_TOOL_NAMES];
  }

  const allowed = new Set(allowedToolNames);
  return ALL_RUNTIME_TOOL_NAMES.filter((toolName) => allowed.has(toolName));
}

/**
 * Helper function to map item types to their operation types for the response
 */
function getOperationType(type: ItemType): string {
  const typeMap: Record<ItemType, string> = {
    task: "task",
    note: "note",
    shopping: "shopping",
    labor: "labor",
    survey: "survey",
    contact: "contact",
    shoppingSection: "shoppingSection",
    laborSection: "laborSection",
  };
  return typeMap[type];
}

export function normalizePriceAliases(
  type: ItemType,
  rawData: unknown,
): Record<string, unknown> {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
    return {};
  }

  const data = { ...(rawData as Record<string, unknown>) };
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

  if (type === "shopping" || type === "labor") {
    const aliasPrice = toNumber(data.price);
    if (data.unitPrice === undefined && aliasPrice !== undefined && aliasPrice > 0) {
      data.unitPrice = aliasPrice;
    }

    const quantity = toNumber(data.quantity);
    const totalPrice = toNumber(data.totalPrice);
    if (
      data.unitPrice === undefined &&
      totalPrice !== undefined &&
      totalPrice > 0 &&
      quantity !== undefined &&
      quantity > 0
    ) {
      data.unitPrice = totalPrice / quantity;
    }

    const directUnitPrice = toNumber(data.unitPrice);
    if (directUnitPrice !== undefined) {
      if (directUnitPrice > 0) {
        data.unitPrice = directUnitPrice;
      } else {
        delete data.unitPrice;
      }
    }

    delete data.price;
  }

  return data;
}

function describeWithExamples<INPUT>(
  description: string,
  inputExamples?: INPUT[],
): string {
  if (!inputExamples || inputExamples.length === 0) {
    return description;
  }

  const renderedExamples = inputExamples
    .slice(0, 2)
    .map((example, index) => `Example ${index + 1}: ${JSON.stringify(example)}`)
    .join("\n");

  return `${description}\n\nInput examples:\n${renderedExamples}`;
}

async function resolveApprovalMetadata<INPUT>(
  input: INPUT,
  options: StreamingToolOptions | undefined,
  definition: Pick<
    AssistantToolDefinition<INPUT>,
    "requiresConfirmation" | "confirmationReason"
  >,
): Promise<ToolApprovalMetadata | undefined> {
  const requiresConfirmation = definition.requiresConfirmation;
  if (!requiresConfirmation) {
    return undefined;
  }

  const required = typeof requiresConfirmation === "function"
    ? await requiresConfirmation(input)
    : requiresConfirmation;

  if (!required) {
    return undefined;
  }

  const mode = options?.crudApprovalMode ?? "always_ask";
  const reason = typeof definition.confirmationReason === "function"
    ? definition.confirmationReason(input)
    : definition.confirmationReason;

  return {
    required: mode !== "auto_confirm",
    mode,
    reason:
      reason ??
      (mode === "auto_confirm"
        ? "Project is configured to auto-confirm AI CRUD actions."
        : "This tool changes project data and requires confirmation before execution."),
  };
}

function serializeToolPayload(
  payload: AssistantToolPayload,
): string {
  const normalizedPayload =
    typeof payload === "string"
      ? (() => {
          try {
            return JSON.parse(payload) as Record<string, unknown>;
          } catch {
            return { value: payload };
          }
        })()
      : payload;

  if (typeof normalizedPayload.error === "string") {
    return JSON.stringify(normalizedPayload);
  }

  return JSON.stringify(normalizedPayload);
}

const ACTIONABLE_OPERATIONS = new Set([
  "create",
  "bulk_create",
  "edit",
  "bulk_edit",
  "delete",
]);

type ToolExecutionOutcome =
  | { success: true; message?: string; count?: number }
  | { success: false; message: string };

const BULK_KEYS_BY_TYPE: Record<string, string[]> = {
  task: ["tasks", "items"],
  note: ["notes", "items"],
  shopping: ["items"],
  labor: ["items", "laborItems"],
  survey: ["surveys", "items"],
  contact: ["contacts", "items"],
  shoppingSection: ["items", "sections"],
  laborSection: ["items", "sections"],
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? ({ ...(value as Record<string, unknown>) })
    : {};

const toRecordArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          !!entry && typeof entry === "object" && !Array.isArray(entry),
      )
    : [];

const parsePayloadObject = (
  payload: AssistantToolPayload,
): Record<string, unknown> | null => {
  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return payload;
};

async function executeSinglePayload(
  payload: Record<string, unknown>,
  options?: StreamingToolOptions,
): Promise<ToolExecutionOutcome> {
  const api = getPublicApi();
  const type = typeof payload.type === "string" ? payload.type : undefined;
  const operation =
    typeof payload.operation === "string" ? payload.operation : undefined;
  const data = toRecord(payload.data);
  const updates = toRecord(payload.updates);

  if (!type || !operation || !ACTIONABLE_OPERATIONS.has(operation)) {
    return { success: true };
  }
  if (!options?.runAction && !options?.runMutation) {
    return { success: false, message: "Tool execution is unavailable in this runtime." };
  }
  if (!options.projectId && type !== "contact") {
    return { success: false, message: "Missing active project for tool execution." };
  }

  const projectId = options.projectId as Id<"projects"> | undefined;
  const runAction = options.runAction;
  const runMutation = options.runMutation;

  if (operation === "create") {
    switch (type) {
      case "task": {
        const taskData = { ...data };
        delete taskData.assignedToName;
        return await runAction!(api.ai.confirmedActions.createConfirmedTask, {
          projectId,
          taskData,
        });
      }
      case "note":
        return await runAction!(api.ai.confirmedActions.createConfirmedNote, {
          projectId,
          noteData: data,
        });
      case "shopping":
        return await runAction!(api.ai.confirmedActions.createConfirmedShoppingItem, {
          projectId,
          itemData: {
            ...data,
            quantity:
              typeof data.quantity === "number" && Number.isFinite(data.quantity)
                ? data.quantity
                : 1,
          },
        });
      case "shoppingSection":
        return await runAction!(api.ai.confirmedActions.createConfirmedShoppingSection, {
          projectId,
          sectionData: data,
        });
      case "labor":
        return await runAction!(api.ai.confirmedActions.createConfirmedLaborItem, {
          projectId,
          itemData: {
            ...data,
            quantity:
              typeof data.quantity === "number" && Number.isFinite(data.quantity)
                ? data.quantity
                : 1,
          },
        });
      case "laborSection":
        return await runAction!(api.ai.confirmedActions.createConfirmedLaborSection, {
          projectId,
          sectionData: data,
        });
      case "survey":
        return await runAction!(api.ai.confirmedActions.createConfirmedSurvey, {
          projectId,
          surveyData: data,
        });
      case "contact":
        return await runAction!(api.ai.confirmedActions.createConfirmedContact, {
          teamSlug: options.teamSlug,
          contactData: data,
        });
    }
  }

  if (operation === "edit") {
    switch (type) {
      case "task":
        return await runAction!(api.ai.confirmedActions.editConfirmedTask, {
          projectId,
          taskId: data.itemId,
          updates,
        });
      case "note":
        return await runAction!(api.ai.confirmedActions.editConfirmedNote, {
          projectId,
          noteId: data.itemId,
          updates,
        });
      case "shopping":
        return await runAction!(api.ai.confirmedActions.editConfirmedShoppingItem, {
          projectId,
          itemId: data.itemId,
          updates,
        });
      case "shoppingSection":
        return await runAction!(api.ai.confirmedActions.editConfirmedShoppingSection, {
          sectionId: data.sectionId ?? data.itemId,
          updates,
        });
      case "labor":
        return await runAction!(api.ai.confirmedActions.editConfirmedLaborItem, {
          projectId,
          itemId: data.itemId,
          updates,
        });
      case "laborSection":
        return await runAction!(api.ai.confirmedActions.editConfirmedLaborSection, {
          sectionId: data.sectionId ?? data.itemId,
          updates,
        });
      case "survey":
        return await runAction!(api.ai.confirmedActions.editConfirmedSurvey, {
          projectId,
          surveyId: data.itemId,
          updates,
        });
      case "contact":
        return await runAction!(api.ai.confirmedActions.editConfirmedContact, {
          teamSlug: options.teamSlug,
          contactId: data.itemId,
          updates,
        });
      case "projectSettings":
        return await runMutation!(api.projects.updateProject, {
          projectId,
          ...updates,
        }).then(() => ({ success: true, message: "Project settings updated." }));
    }
  }

  if (operation === "delete") {
    switch (type) {
      case "task":
        return await runAction!(api.ai.confirmedActions.deleteConfirmedTask, {
          taskId: data.itemId,
          reason: data.reason,
        });
      case "note":
        return await runAction!(api.ai.confirmedActions.deleteConfirmedNote, {
          noteId: data.itemId,
          reason: data.reason,
        });
      case "moodboard":
        await runMutation!(api.files.deleteFile, { fileId: data.fileId ?? data.itemId });
        return { success: true, message: "Moodboard image deleted successfully" };
      case "shopping":
        return await runAction!(api.ai.confirmedActions.deleteConfirmedShoppingItem, {
          itemId: data.itemId,
          reason: data.reason,
        });
      case "shoppingSection":
        return await runAction!(api.ai.confirmedActions.deleteConfirmedShoppingSection, {
          sectionId: data.sectionId ?? data.itemId,
          reason: data.reason,
        });
      case "labor":
        return await runAction!(api.ai.confirmedActions.deleteConfirmedLaborItem, {
          itemId: data.itemId,
          reason: data.reason,
        });
      case "laborSection":
        return await runAction!(api.ai.confirmedActions.deleteConfirmedLaborSection, {
          sectionId: data.sectionId ?? data.itemId,
          reason: data.reason,
        });
      case "survey":
        return await runAction!(api.ai.confirmedActions.deleteConfirmedSurvey, {
          surveyId: data.itemId,
          reason: data.reason,
        });
      case "contact":
        return await runAction!(api.ai.confirmedActions.deleteConfirmedContact, {
          contactId: data.itemId,
          reason: data.reason,
        });
    }
  }

  return { success: false, message: `Unsupported tool execution for ${type}:${operation}` };
}

async function executePreparedPayload(
  payload: Record<string, unknown>,
  options?: StreamingToolOptions,
): Promise<ToolExecutionOutcome> {
  const operation =
    typeof payload.operation === "string" ? payload.operation : undefined;
  const type = typeof payload.type === "string" ? payload.type : undefined;
  const data = toRecord(payload.data);

  if (!operation || !type || !ACTIONABLE_OPERATIONS.has(operation)) {
    return { success: true };
  }

  if (operation === "bulk_create") {
    const bulkKeys = BULK_KEYS_BY_TYPE[type] ?? ["items"];
    let count = 0;
    for (const key of bulkKeys) {
      const entries = toRecordArray(data[key]);
      for (const entry of entries) {
        const outcome = await executeSinglePayload(
          { type, operation: "create", data: entry },
          options,
        );
        if (!outcome.success) return outcome;
        count += 1;
      }
      if (entries.length > 0) {
        return { success: true, count, message: `Created ${count} items.` };
      }
    }
    return { success: false, message: "No items were provided for bulk create." };
  }

  if (operation === "bulk_edit") {
    const items = toRecordArray(data.items);
    if (items.length === 0) {
      return { success: false, message: "No items were provided for bulk edit." };
    }
    let count = 0;
    for (const item of items) {
      const outcome = await executeSinglePayload(
        {
          type,
          operation: "edit",
          data: { itemId: item.itemId },
          updates: toRecord(item.updates),
        },
        options,
      );
      if (!outcome.success) return outcome;
      count += 1;
    }
    return { success: true, count, message: `Updated ${count} items.` };
  }

  return executeSinglePayload(payload, options);
}

function createAssistantTool<INPUT>(
  definition: AssistantToolDefinition<INPUT>,
  options?: StreamingToolOptions,
): AssistantToolInstance<INPUT> {
  const toolInstance = createTool<INPUT, string>({
    ctx: {} as ToolCtx,
    description: describeWithExamples(
      definition.description,
      definition.inputExamples,
    ),
    inputSchema: definition.inputSchema,
    needsApproval: async (_ctx, input) => {
      const approval = await resolveApprovalMetadata(
        input as INPUT,
        options,
        definition,
      );
      return Boolean(approval?.required);
    },
    execute: async (_ctx, input, executionOptions) => {
      const payload = await definition.execute(input as INPUT);
      const parsedPayload = parsePayloadObject(payload);
      if (!parsedPayload || typeof parsedPayload.error === "string") {
        return serializeToolPayload(payload);
      }

      const shouldExecute =
        !!executionOptions &&
        Object.keys(executionOptions as unknown as Record<string, unknown>).length > 0;
      if (!shouldExecute) {
        return serializeToolPayload(parsedPayload);
      }

      const outcome = await executePreparedPayload(parsedPayload, options);
      return serializeToolPayload({
        ...parsedPayload,
        ...(outcome.success ? { status: "confirmed" } : {}),
        outcome,
      });
    },
  });

  const execute = async (input: INPUT) =>
    serializeToolPayload(await definition.execute(input));

  return Object.assign(toolInstance, {
    inputSchema: definition.inputSchema,
    execute,
  }) as AssistantToolInstance<INPUT>;
}

function getRequiredPrimaryField(type: ItemType): "title" | "name" {
  switch (type) {
    case "task":
    case "note":
    case "survey":
      return "title";
    default:
      return "name";
  }
}

export function getBulkCreatePayload(
  type: ItemType,
  items: Record<string, unknown>[],
): Record<string, unknown> {
  switch (type) {
    case "task":
      return { tasks: items };
    case "note":
      return { notes: items };
    case "survey":
      return { surveys: items };
    case "contact":
      return { contacts: items };
    case "shopping":
    case "labor":
    case "shoppingSection":
    case "laborSection":
    default:
      return { items };
  }
}

function normalizePrimaryField(
  type: ItemType,
  rawData: unknown,
): Record<string, unknown> {
  const data = toRecord(rawData);
  const requiredField = getRequiredPrimaryField(type);
  const aliasField = requiredField === "title" ? "name" : "title";
  const primaryValue = data[requiredField];
  const aliasValue = data[aliasField];
  const sectionNameValue =
    requiredField === "name" && typeof data.sectionName === "string"
      ? data.sectionName
      : undefined;
  const extraAliasValue =
    requiredField === "name" && typeof data.section === "string"
      ? data.section
      : undefined;

  if (typeof primaryValue === "string") {
    const trimmed = primaryValue.trim();
    if (trimmed.length > 0) {
      data[requiredField] = trimmed;
      return data;
    }
  }

  if (typeof aliasValue === "string") {
    const trimmedAlias = aliasValue.trim();
    if (trimmedAlias.length > 0) {
      data[requiredField] = trimmedAlias;
      return data;
    }
  }

  if (typeof sectionNameValue === "string") {
    const trimmedSectionName = sectionNameValue.trim();
    if (trimmedSectionName.length > 0) {
      data[requiredField] = trimmedSectionName;
      return data;
    }
  }

  if (typeof extraAliasValue === "string") {
    const trimmedSection = extraAliasValue.trim();
    if (trimmedSection.length > 0) {
      data[requiredField] = trimmedSection;
    }
  }

  return data;
}

function normalizeSurveyCreateData(rawData: Record<string, unknown>): Record<string, unknown> {
  const data = { ...rawData };

  if (Array.isArray(data.questions)) {
    const normalizedQuestions = data.questions
      .map((question) => toRecord(question))
      .map((question) => ({
        questionText: question.questionText,
        questionType: question.questionType,
        options: question.options,
        isRequired: question.isRequired,
      }))
      .filter(
        (question) =>
          typeof question.questionText === "string" &&
          question.questionText.trim().length > 0 &&
          typeof question.questionType === "string",
      );

    data.questions = normalizedQuestions;
  }

  delete data.order;
  return data;
}

export function normalizeCreateData(
  type: ItemType,
  rawData: unknown,
): Record<string, unknown> {
  const normalized = normalizePrimaryField(
    type,
    normalizePriceAliases(type, rawData),
  );

  if (type === "survey") {
    return normalizeSurveyCreateData(normalized);
  }

  return normalized;
}

function normalizeSearchFilters(
  type: z.infer<typeof searchItemsSchema>["type"],
  rawFilters: unknown,
): Record<string, string | number | boolean> {
  const filters = toRecord(rawFilters);

  switch (type) {
    case "task":
      return typeof filters.status === "string" &&
        ["todo", "in_progress", "review", "done"].includes(filters.status)
        ? { status: filters.status }
        : {};
    case "shopping":
      return typeof filters.completed === "boolean"
        ? { completed: filters.completed }
        : {};
    case "survey":
      return typeof filters.status === "string" &&
        ["draft", "active", "closed", "completed", "archived"].includes(filters.status)
        ? { status: filters.status }
        : {};
    case "contact":
      return typeof filters.type === "string" &&
        ["contractor", "supplier", "subcontractor", "other"].includes(filters.type)
        ? { type: filters.type }
        : {};
    default:
      return {};
  }
}

function hasRequiredPrimaryField(
  type: ItemType,
  data: Record<string, unknown>,
): boolean {
  const requiredField = getRequiredPrimaryField(type);
  const value = data[requiredField];
  return typeof value === "string" && value.trim().length > 0;
}

function extractUpdateData(rawData: unknown): Record<string, unknown> {
  const data = toRecord(rawData);
  if (Object.keys(data).length === 0) return {};

  const normalized = { ...data };

  // Flatten common wrappers used by models: { updates: {...} }, { data: {...} }, { patch: {...} }.
  const wrapperCandidates = [
    normalized.updates,
    normalized.data,
    normalized.patch,
    normalized.payload,
    normalized.fields,
  ].map(toRecord);

  const wrapper = wrapperCandidates.find((candidate) => Object.keys(candidate).length > 0);
  if (wrapper && Object.keys(normalized).every((key) => ["updates", "data", "patch", "payload", "fields"].includes(key))) {
    return wrapper;
  }

  // Flatten field/value style payloads: { field: "unitPrice", value: 250 }.
  const fieldKey =
    (typeof normalized.field === "string" && normalized.field.trim().length > 0 && normalized.field.trim()) ||
    (typeof normalized.key === "string" && normalized.key.trim().length > 0 && normalized.key.trim()) ||
    undefined;
  if (fieldKey && Object.prototype.hasOwnProperty.call(normalized, "value")) {
    return { [fieldKey]: normalized.value };
  }

  return normalized;
}

export function extractUpdateDataFromSingleArgs(rawArgs: unknown): Record<string, unknown> {
  const argsRecord = toRecord(rawArgs);
  const nestedData = extractUpdateData(argsRecord.data);
  const directData = { ...argsRecord };
  delete directData.type;
  delete directData.itemId;
  delete directData.data;
  const flattenedDirectData = extractUpdateData(directData);

  return Object.keys(nestedData).length > 0
    ? { ...flattenedDirectData, ...nestedData }
    : flattenedDirectData;
}

export function extractUpdateDataFromBulkEntry(rawEntry: unknown): Record<string, unknown> {
  const entry = toRecord(rawEntry);
  const nestedData = extractUpdateData(entry.data);
  const directData = { ...entry };
  delete directData.itemId;
  delete directData.data;
  const flattenedDirectData = extractUpdateData(directData);

  return Object.keys(nestedData).length > 0
    ? { ...flattenedDirectData, ...nestedData }
    : flattenedDirectData;
}

function hasMeaningfulValue(
  value: unknown,
  options?: { allowZeroNumber?: boolean },
): boolean {
  const { allowZeroNumber = true } = options ?? {};
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value) && (allowZeroNumber || value !== 0);
  if (Array.isArray(value)) return value.some((entry) => hasMeaningfulValue(entry, options));
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((entry) => hasMeaningfulValue(entry, options));
  }
  return true;
}

export function hasMeaningfulUpdateFields(
  data: Record<string, unknown>,
): boolean {
  return Object.values(data).some((value) => hasMeaningfulValue(value, { allowZeroNumber: true }));
}

function hasFallbackUpdateFields(
  data: Record<string, unknown>,
): boolean {
  return Object.values(data).some((value) => {
    if (value === undefined || value === null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return hasMeaningfulValue(value, { allowZeroNumber: false });
  });
}

/**
 * Create tools in AI SDK format for use with streamText
 * Using inputSchema (AI SDK v5) instead of parameters
 */
export function createStreamingTools(options?: StreamingToolOptions) {
  const tools = {
    // Generic CRUD operations
    create_item: createAssistantTool({
      description: "Create a new item (task, note, shopping item, labor item, survey, contact, or section). Specify the type and provide the appropriate data fields. ONLY use this when the user explicitly asks to create something.",
      inputSchema: createItemSchema,
      inputExamples: [
        { type: "task", data: { title: "Book electrician", priority: "high" } },
      ],
      requiresConfirmation: true,
      execute: async (args: z.infer<typeof createItemSchema>) => {
        const data = normalizeCreateData(args.type, args.data);
        const requiredField = getRequiredPrimaryField(args.type);

        if (!hasRequiredPrimaryField(args.type, data)) {
          return JSON.stringify({
            error: `Cannot create ${args.type} without ${requiredField}`,
            message: "Please provide item details before creating"
          });
        }

        return JSON.stringify({
          type: getOperationType(args.type),
          operation: "create",
          data
        });
      },
    }, options),

    create_multiple_items: createAssistantTool({
      description: "Create multiple items at once (2+ items of the same type). More efficient than multiple single creates.",
      inputSchema: createMultipleItemsSchema,
      inputExamples: [
        {
          type: "shopping",
          items: [
            { name: "Primer", quantity: 1 },
            { name: "Wall paint", quantity: 3 },
          ],
        },
      ],
      requiresConfirmation: true,
      execute: async (args: z.infer<typeof createMultipleItemsSchema>) => {
        if (args.items.length === 0) {
          return JSON.stringify({
            error: "No items were provided for bulk create",
            type: args.type,
          });
        }

        const items = args.items.map((item) =>
          normalizeCreateData(args.type, item),
        );
        const requiredField = getRequiredPrimaryField(args.type);
        const invalidIndexes = items
          .map((item, index) =>
            hasRequiredPrimaryField(args.type, item) ? null : index + 1,
          )
          .filter((index): index is number => index !== null);

        if (invalidIndexes.length > 0) {
          return JSON.stringify({
            error: `Cannot create ${args.type} items without ${requiredField}`,
            invalidItemPositions: invalidIndexes,
          });
        }

        return JSON.stringify({
          type: getOperationType(args.type),
          operation: "bulk_create",
          data: getBulkCreatePayload(args.type, items)
        });
      },
    }, options),

    update_item: createAssistantTool({
      description: "Update/edit an existing item. Provide the type, item ID, and fields to update. Only changed fields need to be included.",
      inputSchema: updateItemSchema,
      inputExamples: [
        {
          type: "task",
          itemId: "task_123",
          data: { status: "done" },
        },
      ],
      requiresConfirmation: true,
      execute: async (args: z.infer<typeof updateItemSchema>) => {
        const typeToTable: Record<string, string> = {
          task: "tasks",
          note: "notes",
          shopping: "shoppingListItems",
          labor: "laborItems",
          survey: "surveys",
          contact: "contacts",
          shoppingSection: "shoppingListSections",
          laborSection: "laborSections",
        };

        // Fetch original item from database to show in edit form
        let originalItem: { title?: string; name?: string; _id?: string } | null = null;

        if (options?.runQuery) {
          try {
            const tableName = typeToTable[args.type];
            const searchApi = getInternalSearchApi();

            if (tableName) {
              try {
                originalItem = await options.runQuery(searchApi.getItemById, {
                  tableName,
                  itemId: args.itemId,
                });
              } catch {
                // Keep fallback below if lookup fails.
              }
            }
          } catch {
            // Keep fallback below if lookup fails.
          }
        }

        if (
          originalItem &&
          options?.projectId &&
          typeof (originalItem as Record<string, unknown>).projectId === "string" &&
          (originalItem as Record<string, unknown>).projectId !== options.projectId
        ) {
          return JSON.stringify({
            error: "Cannot edit item outside the active project",
            itemId: args.itemId,
            type: args.type,
          });
        }

        const rawUpdates = extractUpdateDataFromSingleArgs(args);
        const normalizedUpdates = normalizePriceAliases(args.type, rawUpdates);
        const updatesPayload = hasMeaningfulUpdateFields(normalizedUpdates)
          ? normalizedUpdates
          : rawUpdates;

        if (!hasMeaningfulUpdateFields(updatesPayload)) {
          return JSON.stringify({
            error: "No valid update fields provided",
            type: args.type,
            itemId: args.itemId,
          });
        }

        return JSON.stringify({
          type: getOperationType(args.type),
          operation: "edit",
          data: { itemId: args.itemId },
          updates: updatesPayload,
          originalItem: originalItem || { _id: args.itemId },
        });
      },
    }, options),

    update_multiple_items: createAssistantTool({
      description: "Update multiple items at once (2+ items of the same type). More efficient than multiple single updates.",
      inputSchema: updateMultipleItemsSchema,
      requiresConfirmation: true,
      execute: async (args: z.infer<typeof updateMultipleItemsSchema>) => {
        const normalizedUpdates = args.updates.map((update) => {
          const rawData = extractUpdateDataFromBulkEntry(update);
          return {
            ...update,
            data: normalizePriceAliases(args.type, rawData),
          };
        }).filter((update) => hasMeaningfulUpdateFields(update.data));

        const rawUpdatesFallback = args.updates.map((update) => ({
          ...update,
          data: extractUpdateDataFromBulkEntry(update),
        })).filter((update) => hasFallbackUpdateFields(update.data));

        const effectiveUpdates =
          normalizedUpdates.length > 0 ? normalizedUpdates : rawUpdatesFallback;

        if (effectiveUpdates.length === 0) {
          return JSON.stringify({
            error: "No valid update fields provided",
            type: args.type,
          });
        }

        // Fetch original items from database for bulk edit
        let usedDbLookup = false;
        const originalItems: Array<{
          itemId: string;
          originalItem: Record<string, unknown>;
          updates: Record<string, unknown>;
        }> = [];
        if (options?.runQuery) {
          usedDbLookup = true;
          try {
            const typeToTable: Record<string, string> = {
              task: "tasks",
              note: "notes",
              shopping: "shoppingListItems",
              labor: "laborItems",
              survey: "surveys",
              contact: "contacts",
              shoppingSection: "shoppingListSections",
              laborSection: "laborSections",
            };
            const tableName = typeToTable[args.type];
            const searchApi = getInternalSearchApi();
            if (tableName) {
              for (const update of effectiveUpdates) {
                const item = await options.runQuery(searchApi.getItemById, {
                  tableName,
                  itemId: update.itemId,
                });
                if (item && typeof item === "object") {
                  if (
                    options?.projectId &&
                    typeof (item as Record<string, unknown>).projectId === "string" &&
                    (item as Record<string, unknown>).projectId !== options.projectId
                  ) {
                    continue;
                  }
                  originalItems.push({
                    itemId: update.itemId,
                    originalItem: item as Record<string, unknown>,
                    updates: update.data as Record<string, unknown>,
                  });
                }
              }
            }
          } catch (error) {
            console.error("Failed to fetch original items for bulk edit:", error);
          }
        }

        if (usedDbLookup && originalItems.length === 0) {
          return JSON.stringify({
            error: "No editable items found in the active project",
            type: args.type,
          });
        }

        return JSON.stringify({
          type: getOperationType(args.type),
          operation: "bulk_edit",
          data: {
            items: originalItems.length > 0
              ? originalItems.map(item => ({
                itemId: item.itemId,
                originalItem: item.originalItem,
                updates: item.updates,
              }))
              : effectiveUpdates.map(u => ({
                itemId: u.itemId,
                originalItem: {},
                updates: u.data
              }))
          }
        });
      },
    }, options),

    delete_item: createAssistantTool({
      description: "Delete/remove an item from the project. Provide the type and item ID.",
      inputSchema: deleteItemSchema,
      requiresConfirmation: true,
      confirmationReason: "Delete operations are destructive and require explicit approval.",
      execute: async (args: z.infer<typeof deleteItemSchema>) => {
        // Fetch original item to show full details in delete confirmation
        let originalItem: { title?: string; name?: string; _id?: string } | null = null;
        if (options?.runQuery) {
          try {
            const searchApi = getInternalSearchApi();
            const typeToTable: Record<string, string> = {
              task: "tasks",
              note: "notes",
              shopping: "shoppingListItems",
              shoppingSection: "shoppingListSections",
              labor: "laborItems",
              laborSection: "laborSections",
              survey: "surveys",
              contact: "contacts",
            };
            const tableName = typeToTable[args.type];
            if (tableName) {
              originalItem = await options.runQuery(searchApi.getItemById, {
                tableName,
                itemId: args.itemId,
              });
            }
          } catch (error) {
            console.error("Failed to fetch original item for deletion:", error);
          }
        }

        if (
          originalItem &&
          options?.projectId &&
          typeof (originalItem as Record<string, unknown>).projectId === "string" &&
          (originalItem as Record<string, unknown>).projectId !== options.projectId
        ) {
          return JSON.stringify({
            error: "Cannot delete item outside the active project",
            itemId: args.itemId,
            type: args.type,
          });
        }

        const originalItemRecord =
          originalItem && typeof originalItem === "object"
            ? (originalItem as Record<string, unknown>)
            : null;
        const isMoodboardFile =
          args.type === "note" &&
          !!originalItemRecord &&
          typeof originalItemRecord.storageId === "string" &&
          typeof originalItemRecord.moodboardSection === "string";
        const resolvedType = isMoodboardFile ? "moodboard" : getOperationType(args.type);
        const isSectionType =
          args.type === "shoppingSection" || args.type === "laborSection";

        return JSON.stringify({
          type: resolvedType,
          operation: "delete",
          data: {
            itemId: args.itemId,
            fileId: isMoodboardFile ? args.itemId : undefined,
            sectionId: isSectionType ? args.itemId : undefined,
            name: args.name || originalItem?.title || originalItem?.name,
            moodboardSection: isMoodboardFile ? originalItemRecord?.moodboardSection : undefined,
            reason: args.reason,
          },
          originalItem: originalItem || { _id: args.itemId, title: args.name, name: args.name },
        });
      },
    }, options),

    // Generic search operation
    search_items: createAssistantTool({
      description: "Search for and list items in the project (tasks, notes, shopping items, labor items, surveys, or contacts). Use this tool when the user asks to see, list, show, or find existing items. Use type-specific filters for advanced queries. This is a READ-ONLY operation - it does not create or modify anything.",
      inputSchema: searchItemsSchema,
      inputExamples: [
        { type: "task", query: "bathroom", limit: 5 },
      ],
      execute: async (args: z.infer<typeof searchItemsSchema>) => {
        if ((!options?.projectId && args.type !== "contact") || !options?.runAction) {
          return JSON.stringify({ error: "Search not available - missing project context" });
        }

        try {
          const searchApi = getInternalSearchApi();
          const filters = normalizeSearchFilters(args.type, args.filters);
          // Route to appropriate search function based on type
          const searchMap = {
            task: searchApi.searchTasks,
            note: searchApi.searchNotes,
            shopping: searchApi.searchShoppingItems,
            labor: searchApi.searchLaborItems,
            survey: searchApi.searchSurveys,
          };

          const result = args.type === "contact"
            ? await (() => {
                if (!options.teamSlug) {
                  return Promise.resolve({
                    error: "Contact search not available - missing team context",
                  });
                }

                return options.runAction!(searchApi.searchContacts, {
                  teamSlug: options.teamSlug,
                  query: args.query,
                  limit: args.limit,
                  ...filters,
                });
              })()
            : await options.runAction(searchMap[args.type], {
                projectId: options.projectId as Id<"projects">,
                query: args.query,
                limit: args.limit,
                ...filters,
              });

          return JSON.stringify(result);
        } catch (error) {
          console.error(`❌ Search failed for type '${args.type}':`, error);
          return JSON.stringify({
            error: `Failed to search ${args.type}s`,
            details: (error as Error).message
          });
        }
      },
    }, options),

    update_project_settings: createAssistantTool({
      description: "Update project General Settings (name, description, cover image URL, status, client, location, budget, currency). Use this when the user asks to change project settings.",
      inputSchema: updateProjectSettingsSchema,
      requiresConfirmation: true,
      confirmationReason: "Project settings affect the whole project and require approval before execution.",
      execute: async (args: z.infer<typeof updateProjectSettingsSchema>) => {
        if (!options?.projectId) {
          return JSON.stringify({
            error: "Project settings update is unavailable without active project context",
          });
        }

        const hasAnyUpdate = Object.values(args).some((value) => value !== undefined);
        if (!hasAnyUpdate) {
          return JSON.stringify({
            error: "No project setting updates were provided",
          });
        }

        const updates: Record<string, unknown> = {};
        const hasOwn = (key: keyof z.infer<typeof updateProjectSettingsSchema>) =>
          Object.prototype.hasOwnProperty.call(args, key);

        if (hasOwn("name")) {
          const rawName = typeof args.name === "string" ? args.name.trim() : "";
          if (rawName.length > 0 && rawName.length < 2) {
            return JSON.stringify({
              error: "Project name must be at least 2 characters",
            });
          }
          updates.name = rawName.length > 0 ? rawName : undefined;
        }
        if (hasOwn("description")) {
          updates.description =
            typeof args.description === "string" && args.description.trim().length > 0
              ? args.description.trim()
              : undefined;
        }
        if (hasOwn("coverImageUrl")) {
          updates.coverImageUrl =
            typeof args.coverImageUrl === "string"
              ? args.coverImageUrl.trim()
              : undefined;
        }
        if (hasOwn("status")) {
          updates.status = args.status;
        }
        if (hasOwn("customer")) {
          updates.customer =
            typeof args.customer === "string" && args.customer.trim().length > 0
              ? args.customer.trim()
              : undefined;
        }
        if (hasOwn("location")) {
          updates.location =
            typeof args.location === "string" && args.location.trim().length > 0
              ? args.location.trim()
              : undefined;
        }
        if (hasOwn("budget")) {
          updates.budget = args.budget;
        }
        if (hasOwn("currency")) {
          updates.currency = args.currency;
        }

        const hasMeaningfulUpdate = Object.values(updates).some(
          (value) => value !== undefined,
        );
        if (!hasMeaningfulUpdate) {
          return JSON.stringify({
            error: "No valid project setting updates were provided",
          });
        }

        const snapshot = options?.loadSnapshot ? await options.loadSnapshot() : undefined;

        return JSON.stringify({
          type: "projectSettings",
          operation: "edit",
          data: {
            projectId: options.projectId,
            ...updates,
          },
          updates,
          originalItem: snapshot?.project || undefined,
        });
      },
    }, options),

    // Full project context loading tool
    load_full_project_context: createAssistantTool({
      description: "Load complete project overview including ALL tasks, notes, shopping items, contacts, and surveys. Use this when you need comprehensive context about the entire project (e.g., for summaries, complex queries spanning multiple areas, or when search results are insufficient). This is more expensive than targeted searches, so use it wisely. The context is cached, so multiple calls are efficient.",
      inputSchema: loadFullProjectContextSchema,
      execute: async () => {
        if (!options?.loadSnapshot) {
          return JSON.stringify({
            error: "Full context loading not available",
            suggestion: "Try using search_items instead"
          });
        }

        try {
          const snapshot = await options.loadSnapshot();
          const { buildContextFromSnapshot } = await import("./helpers/contextBuilder");
          const formattedContext = buildContextFromSnapshot(snapshot);

          let finalContext = formattedContext;
          if (finalContext.length > 500000) {
            finalContext = finalContext.substring(0, 500000) + "\n...[TRUNCATED due to size]...";
          }

          return JSON.stringify({
            success: true,
            context: finalContext,
            counts: {
              tasks: snapshot.tasks.length,
              notes: snapshot.notes.length,
              shoppingItems: snapshot.shoppingItems.length,
              contacts: snapshot.contacts.length,
              surveys: snapshot.surveys.length,
            },
            summary: snapshot.summary,
            message: "Full project context loaded successfully. Use the 'context' field for detailed data.",
          });
        } catch (error) {
          console.error("Error loading full project context:", error);
          return JSON.stringify({
            error: "Failed to load full project context",
            details: (error as Error).message,
          });
        }
      },
    }, options),

    generate_moodboard_image: createAssistantTool({
      description: "Generate a moodboard image with the Gemini image model and save it directly to the current project's moodboard. Use this only when the user explicitly asks to create or render a moodboard image, concept image, or visual. After a successful result, reply with a short confirmation and include the returned markdown image preview.",
      inputSchema: generateMoodboardImageSchema,
      inputExamples: [
        {
          prompt: "Warm minimalist kitchen with oak fronts, travertine counters, and brushed steel details",
          section: "Kitchen",
        },
      ],
      execute: async (args: z.infer<typeof generateMoodboardImageSchema>) => {
        if (!options?.projectId || !options?.runAction) {
          return JSON.stringify({
            error: "Moodboard image generation is unavailable without active project context",
          });
        }

        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
          const apiModule = require("../_generated/api") as { api: any };
          const result = await options.runAction(
            apiModule.api.ai.imageGen.generation.generateMoodboardImageForAssistant,
            {
              projectId: options.projectId as Id<"projects">,
              prompt: args.prompt,
              section: args.section,
              userClerkId: options.userClerkId,
            },
          );
          return JSON.stringify(result);
        } catch (error) {
          console.error("Failed to generate moodboard image:", error);
          return JSON.stringify({
            error: "Failed to generate moodboard image",
            details: (error as Error).message,
          });
        }
      },
    }, options),
  };

  const activeToolNames = getActiveRuntimeToolNames(options?.allowedToolNames);
  if (activeToolNames.length === ALL_RUNTIME_TOOL_NAMES.length) {
    return tools;
  }

  const allowed = new Set(activeToolNames);
  return Object.fromEntries(
    Object.entries(tools).filter(([toolName]) => allowed.has(toolName)),
  ) as typeof tools;
}

// ============================================
// AGENT TOOLS (for Convex Agent)
// ============================================

/**
 * Create tools for Convex Agent - identical to streaming tools
 * This ensures both implementations use the same tool definitions
 */
export function createAgentTools(options?: StreamingToolOptions) {
  // Return the same tools as createStreamingTools
  // Convex Agent and AI SDK use the same tool format
  return createStreamingTools(options);
}
