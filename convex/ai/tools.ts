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
import OpenAI from "openai";
import type { Id } from "../_generated/dataModel";
import type { ProjectContextSnapshot } from "./types";
import { assistantToolNames } from "./toolMetadata.ts";
import {
  buildMoodboardPromptFromShoppingItems,
  selectShoppingItemsForMoodboard,
  toShoppingReferenceImages,
  type ShoppingMoodboardSourceItem,
} from "./helpers/shoppingMoodboard.ts";

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
  searchPayments: unknown;
  searchShoppingItems: unknown;
  searchLaborItems: unknown;
  searchSurveys: unknown;
  searchContacts: unknown;
  searchMoodboard: unknown;
};

type PublicApi = {
  ai: {
    confirmedActions: Record<string, unknown>;
    imageGen: {
      generation: {
        generateMoodboardImageForAssistant: unknown;
      };
    };
  };
  projects: {
    updateProject: unknown;
  };
  teams: {
    getTeamMembers: unknown;
  };
  files: {
    deleteFile: unknown;
  };
};

const getInternalSearchApi = (): InternalSearchApi => {
  // Keep this runtime-loaded to avoid deep type instantiation in TS.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const apiModule = require("../_generated/api") as { internal: unknown };
  return (
    apiModule.internal as { ai: { search: InternalSearchApi } }
  ).ai.search;
};

const getPublicApi = (): PublicApi => {
  // Keep this runtime-loaded to avoid deep type instantiation in TS.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const apiModule = require("../_generated/api") as { api: unknown };
  return apiModule.api as PublicApi;
};

// ============================================
// TOOL SCHEMAS - OPTIMIZED VERSION
// ============================================

// Item type enum
const itemTypeEnum = z.enum([
  "task",
  "note",
  "payment",
  "shopping",
  "shoppingSet",
  "labor",
  "survey",
  "contact",
  "shoppingSection",
  "laborSection",
  "moodboardSection",
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
  startDate: z.string().optional().describe("Start date in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ). If the user mentions a single deadline or appointment time for the task, set this to the same moment as endDate."),
  endDate: z.string().optional().describe("End date in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ). If the user mentions any due date, deadline, schedule, or relative time such as tomorrow/today/next week or Polish phrases like jutro/dzisiaj/pojutrze, you must set endDate."),
  tags: z.array(z.string()).optional().describe("Task tags for categorization"),
}).passthrough();

const noteFields = z.object({
  title: z.string().describe("Note title"),
  content: z.string().describe("Note content"),
}).passthrough();

const paymentStatusEnum = z.enum([
  "draft",
  "open",
  "paid",
  "void",
  "uncollectible",
]);

const paymentFields = z.object({
  title: z.string().describe("Invoice or payment title"),
  description: z.string().optional().describe("Invoice description or memo"),
  amount: z.union([z.number(), z.string()]).optional().describe("Invoice gross amount in project currency"),
  dueDate: z.string().optional().describe("Due date in ISO format (YYYY-MM-DD or full ISO timestamp)"),
  invoiceNumber: z.string().optional().describe("Invoice number for already issued invoices"),
  status: paymentStatusEnum.optional().describe("Invoice payment status"),
}).passthrough();

const shoppingFields = z.object({
  name: z.string().describe("Item name"),
  notes: z.string().optional().describe("Additional notes or description"),
  quantity: z.number().optional().describe("Quantity needed"),
  unit: z.string().optional().describe("Unit of measurement (pcs, m², m/linear meter, m³, kg, l, set, box, pack, roll)"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("Item priority"),
  buyBefore: z.string().optional().describe("Buy before date in ISO format (YYYY-MM-DD)"),
  supplier: z.string().optional().describe("Supplier or store name"),
  category: z.string().optional().describe("Item category"),
  dimensions: z.string().optional().describe("Item dimensions or size"),
  price: z.union([z.number(), z.string()]).optional().describe("Alias for unitPrice (price per unit, project currency)"),
  unitPrice: z.union([z.number(), z.string()]).optional().describe("Price per unit in project currency"),
  totalPrice: z.union([z.number(), z.string()]).optional().describe("Total price in project currency"),
  imageUrl: z.string().optional().describe("Image URL for the item; when creating from a moodboard image, copy that moodboard imageUrl here"),
  productLink: z.string().optional().describe("Link to product page"),
  catalogNumber: z.string().optional().describe("Product catalog/model number"),
  sectionId: z.string().optional().describe("Shopping list section ID"),
  sectionName: z.string().optional().describe("Shopping list section name"),
  setId: z.string().optional().describe("Optional shopping set ID when this item belongs to a set"),
  setName: z.string().optional().describe("Optional shopping set title when grouping related items"),
}).passthrough();

const shoppingSetFields = z.object({
  title: z.string().describe("Shopping set title"),
  name: z.string().optional().describe("Alias for title"),
  notes: z.string().optional().describe("Context or decision notes for the set"),
  sectionId: z.string().optional().describe("Shopping list section ID"),
  sectionName: z.string().optional().describe("Shopping list section name"),
  setType: z.enum(["variant", "bundle", "reference"]).optional().describe("Type of shopping set"),
  selectionMode: z.enum(["single", "multiple", "none"]).optional().describe("How selections work inside the set"),
  pricingMode: z.enum(["selected_only", "all_selected", "none"]).optional().describe("How the set contributes to totals"),
  status: z.enum(["draft", "active", "resolved", "archived"]).optional().describe("Current lifecycle status of the set"),
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
  startDate: z.string().optional().describe("Start date in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ). For a single scheduled labor item, set this to the same moment as endDate."),
  endDate: z.string().optional().describe("End date in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ). If the user gives any labor schedule, date, deadline, or time window, set endDate."),
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

function asSurveyQuestionType(value: unknown) {
  if (
    value === "text_short" ||
    value === "text_long" ||
    value === "multiple_choice" ||
    value === "single_choice" ||
    value === "rating" ||
    value === "yes_no" ||
    value === "number" ||
    value === "file"
  ) {
    return value;
  }
  return undefined;
}

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
  name: z.string().describe("Section name. Mandatory for shoppingSection/laborSection/moodboardSection confirmation cards. If sectionName exists, copy the same value into name."),
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
  startDate: z.string().optional().describe("Project start date in ISO format (YYYY-MM-DD or full ISO timestamp). Use this for timeline updates, including relative requests such as tomorrow/jutro."),
  endDate: z.string().optional().describe("Project end date in ISO format (YYYY-MM-DD or full ISO timestamp). Use this for timeline updates, including durations such as for a month / przez miesiac."),
  customer: z.string().optional().describe("Client name"),
  customerEmail: z.string().email().optional().describe("Client email address"),
  location: z.string().optional().describe("Project location"),
  budget: z.number().positive().optional().describe("Project budget"),
  currency: projectCurrencyEnum.optional().describe("Project currency"),
});

// Generic create schema
export const createItemSchema = z.object({
  type: itemTypeEnum.describe("Type of item to create"),
  data: z.union([taskFields, noteFields, paymentFields, shoppingFields, shoppingSetFields, laborFields, surveyFields, contactFields, sectionFields]).describe("Item data based on type"),
});

export const createMultipleItemsSchema = z.object({
  type: itemTypeEnum.describe("Type of items to create"),
  items: z
    .array(
      z.union([
        taskFields,
        noteFields,
        paymentFields,
        shoppingFields,
        shoppingSetFields,
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
const updatablePaymentFields = paymentFields.partial().passthrough();
const updatableShoppingFields = shoppingFields.partial().passthrough();
const updatableShoppingSetFields = shoppingSetFields.partial().passthrough();
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
    updatablePaymentFields,
    updatableShoppingFields,
    updatableShoppingSetFields,
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
  type: z.enum(["task", "note", "payment", "shopping", "labor", "survey", "contact", "team_members", "moodboard"]).describe("Type of items to search"),
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
    .describe("Existing moodboard section id or title to save into, for example Concept, Details, Kitchen, or Materials. If the user names a room/section, reuse the matching existing section instead of creating a new one."),
  useShoppingListAsReference: z
    .boolean()
    .optional()
    .describe("When true, ground the moodboard in shopping list items that have images"),
  shoppingItemIds: z
    .array(z.string())
    .optional()
    .describe("Optional shopping item IDs to use as direct visual references"),
  shoppingQuery: z
    .string()
    .optional()
    .describe("Optional shopping search query to narrow the reference items"),
  shoppingSectionName: z
    .string()
    .optional()
    .describe("Optional shopping section name to use as the reference source"),
  shoppingSetName: z
    .string()
    .optional()
    .describe("Optional shopping set title to use as the reference source"),
  onlySetPreferredItems: z
    .boolean()
    .optional()
    .describe("When using a shopping set, restrict references to preferred/selected items"),
  maxReferenceImages: z
    .number()
    .int()
    .min(1)
    .max(12)
    .optional()
    .describe("Maximum number of shopping reference images to attach"),
});

const managedCrudActionEnum = z.enum(["create", "update", "delete"]);
const managedEntityEnum = z.enum(["item", "section"]);
const managedShoppingEntityEnum = z.enum(["item", "section", "set"]);

const manageTasksSchema = z
  .object({
    action: managedCrudActionEnum,
    taskId: z.string().optional(),
    itemId: z.string().optional(),
    id: z.string().optional(),
    data: taskFields.partial().passthrough().optional(),
  })
  .passthrough();

const manageNotesSchema = z
  .object({
    action: managedCrudActionEnum,
    noteId: z.string().optional(),
    itemId: z.string().optional(),
    id: z.string().optional(),
    data: noteFields.partial().passthrough().optional(),
  })
  .passthrough();

const manageContactsSchema = z
  .object({
    action: managedCrudActionEnum,
    contactId: z.string().optional(),
    itemId: z.string().optional(),
    id: z.string().optional(),
    data: contactFields.partial().passthrough().optional(),
  })
  .passthrough();

const managePaymentsSchema = z
  .object({
    action: managedCrudActionEnum,
    paymentId: z.string().optional(),
    invoiceId: z.string().optional(),
    itemId: z.string().optional(),
    id: z.string().optional(),
    data: paymentFields.partial().passthrough().optional(),
  })
  .passthrough();

const manageSurveysSchema = z
  .object({
    action: managedCrudActionEnum,
    surveyId: z.string().optional(),
    itemId: z.string().optional(),
    id: z.string().optional(),
    data: updatableSurveyFields.partial().passthrough().optional(),
  })
  .passthrough();

const manageShoppingSchema = z
  .object({
    action: managedCrudActionEnum,
    entity: managedShoppingEntityEnum,
    itemId: z.string().optional(),
    sectionId: z.string().optional(),
    setId: z.string().optional(),
    id: z.string().optional(),
    data: z.union([shoppingFields.partial().passthrough(), shoppingSetFields.partial().passthrough(), sectionFields.partial().passthrough()]).optional(),
  })
  .passthrough();

const manageLaborSchema = z
  .object({
    action: managedCrudActionEnum,
    entity: managedEntityEnum,
    itemId: z.string().optional(),
    sectionId: z.string().optional(),
    id: z.string().optional(),
    data: z.union([laborFields.partial().passthrough(), sectionFields.partial().passthrough()]).optional(),
  })
  .passthrough();

const manageMoodboardSchema = z
  .object({
    action: managedCrudActionEnum,
    sectionId: z.string().optional(),
    itemId: z.string().optional(),
    id: z.string().optional(),
    data: sectionFields.partial().passthrough().optional(),
  })
  .passthrough();

const webSearchSchema = z.object({
  query: z
    .string()
    .min(2)
    .describe("Search query for public web results and current external facts"),
  searchContextSize: z
    .enum(["low", "medium", "high"])
    .optional()
    .describe("How much web context the search should use"),
});

// ============================================
// AI SDK TOOLS (for streaming)
// ============================================

// Types for tool options
interface StreamingToolOptions {
  projectId?: string;
  teamId?: string;
  teamSlug?: string;
  userClerkId?: string;
  runAction?: RunActionFn;
  runQuery?: RunQueryFn;
  runMutation?: RunMutationFn;
  loadSnapshot?: () => Promise<ProjectContextSnapshot>;
  runWebSearch?: (args: z.infer<typeof webSearchSchema>) => Promise<AssistantToolPayload>;
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
  inputSchema: z.ZodTypeAny;
  inputExamples?: INPUT[];
  requiresConfirmation?: boolean | ((input: INPUT) => boolean | Promise<boolean>);
  confirmationReason?: string | ((input: INPUT) => string);
  execute: (input: INPUT) => Promise<AssistantToolPayload>;
};

type AssistantToolInstance<INPUT> = {
  description?: string;
  inputSchema?: unknown;
  execute: (input: INPUT, options?: unknown) => Promise<string>;
  prepare: (input: INPUT) => Promise<string>;
};

let openAIClient: OpenAI | null = null;

function getOpenAIClient() {
  if (openAIClient) return openAIClient;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable.");
  }

  openAIClient = new OpenAI({ apiKey });
  return openAIClient;
}

function extractWebSearchCitations(response: {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      annotations?: Array<{
        type?: string;
        title?: string;
        url?: string;
      }>;
    }>;
  }>;
}) {
  const citations = new Map<string, { title: string; url: string }>();

  for (const item of response.output ?? []) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part.type !== "output_text" || !Array.isArray(part.annotations)) continue;
      for (const annotation of part.annotations) {
        if (
          annotation.type === "url_citation" &&
          typeof annotation.url === "string" &&
          annotation.url.trim().length > 0
        ) {
          citations.set(annotation.url, {
            title:
              typeof annotation.title === "string" && annotation.title.trim().length > 0
                ? annotation.title.trim()
                : annotation.url,
            url: annotation.url,
          });
        }
      }
    }
  }

  return Array.from(citations.values());
}

async function runDefaultWebSearch(
  args: z.infer<typeof webSearchSchema>,
): Promise<AssistantToolPayload> {
  const client = getOpenAIClient();
  const model = process.env.OPENAI_WEB_SEARCH_MODEL?.trim() || "gpt-4.1-mini";
  const response = await client.responses.create({
    model,
    input: [
      {
        role: "system",
        content:
          "You are a concise web research assistant. Answer with short factual findings and rely on citations from the web search tool.",
      },
      {
        role: "user",
        content: args.query,
      },
    ],
    tools: [
      {
        type: "web_search_preview",
        ...(args.searchContextSize
          ? { search_context_size: args.searchContextSize }
          : {}),
      },
    ],
  });

  return {
    ok: true,
    query: args.query,
    model,
    summary: response.output_text,
    sources: extractWebSearchCitations(response),
  };
}

export const ALL_RUNTIME_TOOL_NAMES = assistantToolNames;
export const READ_ONLY_RUNTIME_TOOL_NAMES = [
  "web_search",
  "search_items",
] as const;

export function getActiveRuntimeToolNames(
  allowedToolNames?: readonly string[],
  crudApprovalMode: "always_ask" | "auto_confirm" = "auto_confirm",
): string[] {
  const modeScopedToolNames =
    crudApprovalMode === "auto_confirm"
      ? ALL_RUNTIME_TOOL_NAMES
      : READ_ONLY_RUNTIME_TOOL_NAMES;

  if (!allowedToolNames || allowedToolNames.length === 0) {
    return [...modeScopedToolNames];
  }

  const allowed = new Set(allowedToolNames);
  return modeScopedToolNames.filter((toolName) => allowed.has(toolName));
}

/**
 * Helper function to map item types to their operation types for the response
 */
function getOperationType(type: ItemType): string {
  const typeMap: Record<ItemType, string> = {
    task: "task",
    note: "note",
    payment: "payment",
    shopping: "shopping",
    shoppingSet: "shoppingSet",
    labor: "labor",
    survey: "survey",
    contact: "contact",
    shoppingSection: "shoppingSection",
    laborSection: "laborSection",
    moodboardSection: "moodboardSection",
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

  if (type === "payment") {
    const amount = toNumber(data.amount);
    if (amount !== undefined) {
      data.amount = amount;
    } else {
      delete data.amount;
    }
  }

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
  payment: ["payments", "items"],
  shopping: ["items"],
  shoppingSet: ["items", "sets"],
  labor: ["items", "laborItems"],
  survey: ["surveys", "items"],
  contact: ["contacts", "items"],
  shoppingSection: ["items", "sections"],
  laborSection: ["items", "sections"],
  moodboardSection: ["items", "sections"],
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

const pickFirstNonEmptyString = (
  value: Record<string, unknown>,
  keys: string[],
): string | undefined => {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return undefined;
};

const extractManagedToolData = (
  rawInput: unknown,
  reservedKeys: string[],
): Record<string, unknown> => {
  const input = toRecord(rawInput);
  const nestedData = toRecord(input.data);
  const reserved = new Set(["data", ...reservedKeys]);
  const flattened: Record<string, unknown> = { ...nestedData };

  for (const [key, value] of Object.entries(input)) {
    if (reserved.has(key) || value === undefined) continue;
    flattened[key] = value;
  }

  return flattened;
};

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

function compactRecord<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

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
  const actorArgs =
    typeof options.userClerkId === "string" && options.userClerkId.length > 0
      ? { userClerkId: options.userClerkId }
      : {};

  const normalizeSectionName = (value: Record<string, unknown>) => {
    const name =
      pickFirstNonEmptyString(value, ["name", "sectionName", "title"]) ?? "";
    return compactRecord({ name });
  };

  const taskCreateData = compactRecord({
    title: typeof data.title === "string" ? data.title : "",
    status: data.status,
    description: typeof data.description === "string" ? data.description : undefined,
    content: typeof data.content === "string" ? data.content : undefined,
    assignedTo:
      typeof data.assignedTo === "string" || data.assignedTo === null
        ? data.assignedTo
        : undefined,
    priority: data.priority,
    startDate: typeof data.startDate === "string" ? data.startDate : undefined,
    endDate: typeof data.endDate === "string" ? data.endDate : undefined,
    tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === "string") : undefined,
  });

  const taskUpdateData = compactRecord({
    title: typeof updates.title === "string" ? updates.title : undefined,
    description: typeof updates.description === "string" ? updates.description : undefined,
    content: typeof updates.content === "string" ? updates.content : undefined,
    status: updates.status,
    assignedTo:
      typeof updates.assignedTo === "string" || updates.assignedTo === null
        ? updates.assignedTo
        : undefined,
    priority: updates.priority,
    startDate: typeof updates.startDate === "string" ? updates.startDate : undefined,
    endDate: typeof updates.endDate === "string" ? updates.endDate : undefined,
    tags: Array.isArray(updates.tags)
      ? updates.tags.filter((tag): tag is string => typeof tag === "string")
      : undefined,
  });

  const paymentCreateData = compactRecord({
    title: pickFirstNonEmptyString(data, ["title", "name"]) ?? "",
    description: typeof data.description === "string" ? data.description : undefined,
    amount: typeof data.amount === "number" ? data.amount : undefined,
    dueDate: typeof data.dueDate === "string" ? data.dueDate : undefined,
  });

  const paymentUpdateData = compactRecord({
    title: typeof updates.title === "string" ? updates.title : undefined,
    description: typeof updates.description === "string" ? updates.description : undefined,
    amount: typeof updates.amount === "number" ? updates.amount : undefined,
    dueDate: typeof updates.dueDate === "string" ? updates.dueDate : undefined,
    invoiceNumber:
      typeof updates.invoiceNumber === "string" ? updates.invoiceNumber : undefined,
    status: updates.status,
  });

  const shoppingCreateData = compactRecord({
    name: pickFirstNonEmptyString(data, ["name", "title"]) ?? "",
    quantity:
      typeof data.quantity === "number" && Number.isFinite(data.quantity)
        ? data.quantity
        : 1,
    unit: typeof data.unit === "string" ? data.unit : undefined,
    notes: typeof data.notes === "string" ? data.notes : undefined,
    priority: data.priority,
    buyBefore: typeof data.buyBefore === "string" ? data.buyBefore : undefined,
    supplier: typeof data.supplier === "string" ? data.supplier : undefined,
    category: typeof data.category === "string" ? data.category : undefined,
    imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
    productLink: typeof data.productLink === "string" ? data.productLink : undefined,
    catalogNumber:
      typeof data.catalogNumber === "string" ? data.catalogNumber : undefined,
    dimensions: typeof data.dimensions === "string" ? data.dimensions : undefined,
    unitPrice: typeof data.unitPrice === "number" ? data.unitPrice : undefined,
    totalPrice: typeof data.totalPrice === "number" ? data.totalPrice : undefined,
    sectionId: data.sectionId,
    setId: data.setId,
  });

  const shoppingSetCreateData = compactRecord({
    title: pickFirstNonEmptyString(data, ["title", "name"]) ?? "",
    notes: typeof data.notes === "string" ? data.notes : undefined,
    sectionId: data.sectionId,
    setType: data.setType,
    selectionMode: data.selectionMode,
    pricingMode: data.pricingMode,
    status: data.status,
  });

  const shoppingUpdateData = compactRecord({
    name: typeof updates.name === "string" ? updates.name : undefined,
    notes: typeof updates.notes === "string" ? updates.notes : undefined,
    buyBefore: typeof updates.buyBefore === "string" ? updates.buyBefore : undefined,
    priority: updates.priority,
    imageUrl: typeof updates.imageUrl === "string" ? updates.imageUrl : undefined,
    productLink: typeof updates.productLink === "string" ? updates.productLink : undefined,
    supplier: typeof updates.supplier === "string" ? updates.supplier : undefined,
    catalogNumber:
      typeof updates.catalogNumber === "string" ? updates.catalogNumber : undefined,
    category: typeof updates.category === "string" ? updates.category : undefined,
    dimensions: typeof updates.dimensions === "string" ? updates.dimensions : undefined,
    quantity: typeof updates.quantity === "number" ? updates.quantity : undefined,
    unit: typeof updates.unit === "string" ? updates.unit : undefined,
    unitPrice: typeof updates.unitPrice === "number" ? updates.unitPrice : undefined,
    setId: updates.setId === null || typeof updates.setId === "string" ? updates.setId : undefined,
    realizationStatus: updates.realizationStatus,
    sectionId:
      updates.sectionId === null || typeof updates.sectionId === "string"
        ? updates.sectionId
        : undefined,
    assignedTo: typeof updates.assignedTo === "string" ? updates.assignedTo : undefined,
  });

  const shoppingSetUpdateData = compactRecord({
    title: typeof updates.title === "string" ? updates.title : undefined,
    notes: typeof updates.notes === "string" ? updates.notes : undefined,
    sectionId:
      updates.sectionId === null || typeof updates.sectionId === "string"
        ? updates.sectionId
        : undefined,
    setType: updates.setType,
    selectionMode: updates.selectionMode,
    pricingMode: updates.pricingMode,
    status: updates.status,
  });

  const laborCreateData = compactRecord({
    name: pickFirstNonEmptyString(data, ["name", "title"]) ?? "",
    quantity:
      typeof data.quantity === "number" && Number.isFinite(data.quantity)
        ? data.quantity
        : 1,
    unit: typeof data.unit === "string" ? data.unit : undefined,
    notes: typeof data.notes === "string" ? data.notes : undefined,
    unitPrice: typeof data.unitPrice === "number" ? data.unitPrice : undefined,
    sectionId: data.sectionId,
    assignedTo: typeof data.assignedTo === "string" ? data.assignedTo : undefined,
    startDate: typeof data.startDate === "string" ? data.startDate : undefined,
    endDate: typeof data.endDate === "string" ? data.endDate : undefined,
  });

  const laborUpdateData = compactRecord({
    name: typeof updates.name === "string" ? updates.name : undefined,
    notes: typeof updates.notes === "string" ? updates.notes : undefined,
    quantity: typeof updates.quantity === "number" ? updates.quantity : undefined,
    unit: typeof updates.unit === "string" ? updates.unit : undefined,
    unitPrice: typeof updates.unitPrice === "number" ? updates.unitPrice : undefined,
    sectionId:
      updates.sectionId === null || typeof updates.sectionId === "string"
        ? updates.sectionId
        : undefined,
    assignedTo: typeof updates.assignedTo === "string" ? updates.assignedTo : undefined,
    startDate: typeof updates.startDate === "string" ? updates.startDate : undefined,
    endDate: typeof updates.endDate === "string" ? updates.endDate : undefined,
  });

  const surveyCreateQuestions = Array.isArray(data.questions)
    ? data.questions
        .map((question, index) => {
          if (typeof question === "string" && question.trim().length > 0) {
            return {
              questionText: question.trim(),
              questionType: "text_long" as const,
              order: index + 1,
            };
          }

          if (!question || typeof question !== "object" || Array.isArray(question)) {
            return null;
          }

          const questionRecord = question as Record<string, unknown>;
          const options = Array.isArray(questionRecord.options)
            ? questionRecord.options.filter((option): option is string => typeof option === "string")
            : undefined;
          const questionText =
            typeof questionRecord.questionText === "string"
              ? questionRecord.questionText
              : typeof questionRecord.title === "string"
                ? questionRecord.title
                : typeof questionRecord.text === "string"
                  ? questionRecord.text
                  : "";

          return {
            questionText,
            questionType:
              asSurveyQuestionType(questionRecord.questionType) ??
              asSurveyQuestionType(questionRecord.type) ??
              (options ? "single_choice" : "text_long"),
            options,
            isRequired:
              typeof questionRecord.isRequired === "boolean" ? questionRecord.isRequired : undefined,
            order: typeof questionRecord.order === "number" ? questionRecord.order : index + 1,
          };
        })
        .filter(
          (question): question is NonNullable<typeof question> =>
            Boolean(question?.questionText),
        )
    : typeof data.questionText === "string" && typeof data.questionType === "string"
      ? [{
          questionText: data.questionText,
          questionType: data.questionType,
          options: Array.isArray(data.options)
            ? data.options.filter((option): option is string => typeof option === "string")
            : undefined,
          isRequired:
            typeof data.isRequired === "boolean" ? data.isRequired : undefined,
        }]
      : undefined;

  const surveyCreateData = compactRecord({
    title: typeof data.title === "string" ? data.title : "",
    description: typeof data.description === "string" ? data.description : undefined,
    isRequired: typeof data.isRequired === "boolean" ? data.isRequired : undefined,
    allowMultipleResponses:
      typeof data.allowMultipleResponses === "boolean"
        ? data.allowMultipleResponses
        : undefined,
    startDate: typeof data.startDate === "string" ? data.startDate : undefined,
    endDate: typeof data.endDate === "string" ? data.endDate : undefined,
    questions: surveyCreateQuestions,
  });

  if (operation === "create") {
    switch (type) {
      case "task": {
        return await runAction!(api.ai.confirmedActions.createConfirmedTask, {
          projectId,
          ...actorArgs,
          taskData: taskCreateData,
        });
      }
      case "note":
        return await runAction!(api.ai.confirmedActions.createConfirmedNote, {
          projectId,
          ...actorArgs,
          noteData: data,
        });
      case "payment":
        return await runAction!(api.ai.confirmedActions.createConfirmedPayment, {
          projectId,
          ...actorArgs,
          paymentData: paymentCreateData,
        });
      case "shopping":
        return await runAction!(api.ai.confirmedActions.createConfirmedShoppingItem, {
          projectId,
          ...actorArgs,
          itemData: shoppingCreateData,
        });
      case "shoppingSet":
        return await runAction!(api.ai.confirmedActions.createConfirmedShoppingSet, {
          projectId,
          ...actorArgs,
          setData: shoppingSetCreateData,
        });
      case "shoppingSection":
        return await runAction!(api.ai.confirmedActions.createConfirmedShoppingSection, {
          projectId,
          ...actorArgs,
          sectionData: normalizeSectionName(data),
        });
      case "labor":
        return await runAction!(api.ai.confirmedActions.createConfirmedLaborItem, {
          projectId,
          ...actorArgs,
          itemData: laborCreateData,
        });
      case "laborSection":
        return await runAction!(api.ai.confirmedActions.createConfirmedLaborSection, {
          projectId,
          ...actorArgs,
          sectionData: normalizeSectionName(data),
        });
      case "moodboardSection":
        return await runAction!(api.ai.confirmedActions.createConfirmedMoodboardSection, {
          projectId,
          ...actorArgs,
          sectionData: normalizeSectionName(data),
        });
      case "survey":
        return await runAction!(api.ai.confirmedActions.createConfirmedSurvey, {
          projectId,
          ...actorArgs,
          surveyData: surveyCreateData,
        });
      case "contact":
        return await runAction!(api.ai.confirmedActions.createConfirmedContact, {
          teamSlug: options.teamSlug,
          ...actorArgs,
          contactData: data,
        });
    }
  }

  if (operation === "edit") {
    switch (type) {
      case "task":
        return await runAction!(api.ai.confirmedActions.editConfirmedTask, {
          projectId,
          ...actorArgs,
          taskId: data.itemId,
          updates: taskUpdateData,
        });
      case "note":
        return await runAction!(api.ai.confirmedActions.editConfirmedNote, {
          projectId,
          ...actorArgs,
          noteId: data.itemId,
          updates,
        });
      case "payment":
        return await runAction!(api.ai.confirmedActions.editConfirmedPayment, {
          projectId,
          ...actorArgs,
          paymentId: data.itemId,
          updates: paymentUpdateData,
        });
      case "shopping":
        return await runAction!(api.ai.confirmedActions.editConfirmedShoppingItem, {
          projectId,
          ...actorArgs,
          itemId: data.itemId,
          updates: shoppingUpdateData,
        });
      case "shoppingSet":
        return await runAction!(api.ai.confirmedActions.editConfirmedShoppingSet, {
          ...actorArgs,
          setId: data.setId ?? data.itemId,
          updates: shoppingSetUpdateData,
        });
      case "shoppingSection":
        return await runAction!(api.ai.confirmedActions.editConfirmedShoppingSection, {
          ...actorArgs,
          sectionId: data.sectionId ?? data.itemId,
          updates: normalizeSectionName(updates),
        });
      case "labor":
        return await runAction!(api.ai.confirmedActions.editConfirmedLaborItem, {
          projectId,
          ...actorArgs,
          itemId: data.itemId,
          updates: laborUpdateData,
        });
      case "laborSection":
        return await runAction!(api.ai.confirmedActions.editConfirmedLaborSection, {
          ...actorArgs,
          sectionId: data.sectionId ?? data.itemId,
          updates: normalizeSectionName(updates),
        });
      case "moodboardSection":
        return await runAction!(api.ai.confirmedActions.editConfirmedMoodboardSection, {
          projectId,
          ...actorArgs,
          sectionId: data.sectionId ?? data.itemId,
          updates: normalizeSectionName(updates),
        });
      case "survey":
        return await runAction!(api.ai.confirmedActions.editConfirmedSurvey, {
          projectId,
          ...actorArgs,
          surveyId: data.itemId,
          updates,
        });
      case "contact":
        return await runAction!(api.ai.confirmedActions.editConfirmedContact, {
          ...actorArgs,
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
          ...actorArgs,
          taskId: data.itemId,
          reason: data.reason,
        });
      case "note":
        return await runAction!(api.ai.confirmedActions.deleteConfirmedNote, {
          ...actorArgs,
          noteId: data.itemId,
          reason: data.reason,
        });
      case "payment":
        return await runAction!(api.ai.confirmedActions.deleteConfirmedPayment, {
          projectId,
          ...actorArgs,
          paymentId: data.itemId,
          reason: data.reason,
        });
      case "moodboard":
        await runMutation!(api.files.deleteFile, { fileId: data.fileId ?? data.itemId });
        return { success: true, message: "Moodboard image deleted successfully" };
      case "shopping":
        return await runAction!(api.ai.confirmedActions.deleteConfirmedShoppingItem, {
          ...actorArgs,
          itemId: data.itemId,
          reason: data.reason,
        });
      case "shoppingSet":
        return await runAction!(api.ai.confirmedActions.deleteConfirmedShoppingSet, {
          ...actorArgs,
          setId: data.setId ?? data.itemId,
        });
      case "shoppingSection":
        return await runAction!(api.ai.confirmedActions.deleteConfirmedShoppingSection, {
          ...actorArgs,
          sectionId: data.sectionId ?? data.itemId,
          reason: data.reason,
        });
      case "labor":
        return await runAction!(api.ai.confirmedActions.deleteConfirmedLaborItem, {
          ...actorArgs,
          itemId: data.itemId,
          reason: data.reason,
        });
      case "laborSection":
        return await runAction!(api.ai.confirmedActions.deleteConfirmedLaborSection, {
          ...actorArgs,
          sectionId: data.sectionId ?? data.itemId,
          reason: data.reason,
        });
      case "moodboardSection":
        return await runAction!(api.ai.confirmedActions.deleteConfirmedMoodboardSection, {
          projectId,
          ...actorArgs,
          sectionId: data.sectionId ?? data.itemId,
          reason: data.reason,
        });
      case "survey":
        return await runAction!(api.ai.confirmedActions.deleteConfirmedSurvey, {
          ...actorArgs,
          surveyId: data.itemId,
          reason: data.reason,
        });
      case "contact":
        return await runAction!(api.ai.confirmedActions.deleteConfirmedContact, {
          ...actorArgs,
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
    execute: async (_ctx, input) => {
      const payload = await definition.execute(input as INPUT);
      const parsedPayload = parsePayloadObject(payload);
      if (!parsedPayload || typeof parsedPayload.error === "string") {
        return serializeToolPayload(payload);
      }

      const operation =
        typeof parsedPayload.operation === "string" ? parsedPayload.operation : undefined;
      const type = typeof parsedPayload.type === "string" ? parsedPayload.type : undefined;
      const isActionablePayload =
        !!type &&
        !!operation &&
        ACTIONABLE_OPERATIONS.has(operation);

      if (!isActionablePayload) {
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

  const prepare = async (input: INPUT) =>
    serializeToolPayload(await definition.execute(input));

  return Object.assign(toolInstance, {
    inputSchema: definition.inputSchema,
    prepare,
  }) as AssistantToolInstance<INPUT>;
}

function getRequiredPrimaryField(type: ItemType): "title" | "name" {
  switch (type) {
    case "task":
    case "note":
    case "payment":
    case "shoppingSet":
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
    case "payment":
      return { payments: items };
    case "survey":
      return { surveys: items };
    case "contact":
      return { contacts: items };
    case "shopping":
    case "shoppingSet":
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
      .map((question, index) => {
        if (typeof question === "string" && question.trim().length > 0) {
          return {
            questionText: question.trim(),
            questionType: "text_long",
            order: index + 1,
          };
        }

        const questionRecord = toRecord(question);
        const options = Array.isArray(questionRecord.options)
          ? questionRecord.options.filter((option): option is string => typeof option === "string")
          : undefined;
        return {
          questionText:
            typeof questionRecord.questionText === "string"
              ? questionRecord.questionText
              : typeof questionRecord.title === "string"
                ? questionRecord.title
                : typeof questionRecord.text === "string"
                  ? questionRecord.text
                  : undefined,
          questionType:
            asSurveyQuestionType(questionRecord.questionType) ??
            asSurveyQuestionType(questionRecord.type) ??
            (options ? "single_choice" : "text_long"),
          options,
          isRequired: questionRecord.isRequired,
          order:
            typeof questionRecord.order === "number"
              ? questionRecord.order
              : index + 1,
        };
      })
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
    case "payment":
      return typeof filters.status === "string" &&
        ["draft", "open", "paid", "void", "uncollectible"].includes(filters.status)
        ? { status: filters.status }
        : {};
    case "shopping":
      {
        const shoppingFilters: Record<string, string | number | boolean> = {};
        if (typeof filters.completed === "boolean") {
          shoppingFilters.completed = filters.completed;
        }
        if (typeof filters.hasImage === "boolean") {
          shoppingFilters.hasImage = filters.hasImage;
        }
        if (typeof filters.sectionName === "string" && filters.sectionName.trim().length > 0) {
          shoppingFilters.sectionName = filters.sectionName.trim();
        }
        if (typeof filters.setName === "string" && filters.setName.trim().length > 0) {
          shoppingFilters.setName = filters.setName.trim();
        }
        if (typeof filters.preferredOnly === "boolean") {
          shoppingFilters.preferredOnly = filters.preferredOnly;
        }
        return shoppingFilters;
      }
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
    case "moodboard":
      return {};
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

function normalizeShoppingMoodboardItems(
  items: unknown,
): ShoppingMoodboardSourceItem[] {
  return toRecordArray(items).map((item) => ({
    _id: typeof item._id === "string" ? item._id : "",
    name: typeof item.name === "string" ? item.name : "Unnamed item",
    notes: typeof item.notes === "string" ? item.notes : undefined,
    category: typeof item.category === "string" ? item.category : undefined,
    supplier: typeof item.supplier === "string" ? item.supplier : undefined,
    dimensions: typeof item.dimensions === "string" ? item.dimensions : undefined,
    quantity: typeof item.quantity === "number" ? item.quantity : undefined,
    unit: typeof item.unit === "string" ? item.unit : undefined,
    unitPrice: typeof item.unitPrice === "number" ? item.unitPrice : undefined,
    imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : undefined,
    productLink: typeof item.productLink === "string" ? item.productLink : undefined,
    sectionName: typeof item.sectionName === "string" ? item.sectionName : undefined,
    setId:
      typeof item.setId === "string" || item.setId === null
        ? (item.setId as string | null)
        : undefined,
    setTitle: typeof item.setTitle === "string" ? item.setTitle : undefined,
    setType:
      typeof item.setType === "string" &&
      ["variant", "bundle", "reference"].includes(item.setType)
        ? (item.setType as "variant" | "bundle" | "reference")
        : undefined,
    isPreferredInSet: item.isPreferredInSet === true,
    isResolvedInSet: item.isResolvedInSet === true,
  }))
    .filter((item) => item._id.length > 0);
}

async function loadShoppingMoodboardSourceItems(
  args: z.infer<typeof generateMoodboardImageSchema>,
  options?: StreamingToolOptions,
): Promise<ShoppingMoodboardSourceItem[]> {
  if (options?.loadSnapshot) {
    const snapshot = await options.loadSnapshot();
    return normalizeShoppingMoodboardItems(snapshot.shoppingItems);
  }

  if (!options?.projectId || !options?.runAction) {
    return [];
  }

  const searchApi = getInternalSearchApi();
  const searchResult = await options.runAction(searchApi.searchShoppingItems, {
    projectId: options.projectId as Id<"projects">,
    query: args.shoppingQuery,
    limit: 200,
    hasImage: true,
    ...(typeof args.shoppingSectionName === "string" && args.shoppingSectionName.trim().length > 0
      ? { sectionName: args.shoppingSectionName.trim() }
      : {}),
    ...(typeof args.shoppingSetName === "string" && args.shoppingSetName.trim().length > 0
      ? { setName: args.shoppingSetName.trim() }
      : {}),
    ...(args.onlySetPreferredItems ? { preferredOnly: true } : {}),
  });

  const resultRecord = toRecord(searchResult);
  return normalizeShoppingMoodboardItems(resultRecord.items);
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

type PrepareToolOptions = Pick<
  StreamingToolOptions,
  "projectId" | "teamId" | "runQuery" | "loadSnapshot" | "runAction" | "userClerkId" | "teamSlug"
>;

export async function prepareCreatePayload(
  args: z.infer<typeof createItemSchema>,
): Promise<string> {
  const data = normalizeCreateData(args.type, args.data);
  const requiredField = getRequiredPrimaryField(args.type);

  if (!hasRequiredPrimaryField(args.type, data)) {
    return JSON.stringify({
      error: `Cannot create ${args.type} without ${requiredField}`,
      message: "Please provide item details before creating",
    });
  }

  return JSON.stringify({
    type: getOperationType(args.type),
    operation: "create",
    data,
  });
}

export async function prepareBulkCreatePayload(
  args: z.infer<typeof createMultipleItemsSchema>,
): Promise<string> {
  if (args.items.length === 0) {
    return JSON.stringify({
      error: "No items were provided for bulk create",
      type: args.type,
    });
  }

  const items = args.items.map((item) => normalizeCreateData(args.type, item));
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
    data: getBulkCreatePayload(args.type, items),
  });
}

export async function prepareUpdatePayload(
  args: z.infer<typeof updateItemSchema>,
  options?: PrepareToolOptions,
): Promise<string> {
  const typeToTable: Record<string, string> = {
    task: "tasks",
    note: "notes",
    payment: "projectPayments",
    shopping: "shoppingListItems",
    shoppingSet: "shoppingSets",
    labor: "laborItems",
    survey: "surveys",
    contact: "contacts",
    shoppingSection: "shoppingListSections",
    laborSection: "laborSections",
  };

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
}

export async function prepareBulkUpdatePayload(
  args: z.infer<typeof updateMultipleItemsSchema>,
  options?: PrepareToolOptions,
): Promise<string> {
  const normalizedUpdates = args.updates
    .map((update) => {
      const rawData = extractUpdateDataFromBulkEntry(update);
      return {
        ...update,
        data: normalizePriceAliases(args.type, rawData),
      };
    })
    .filter((update) => hasMeaningfulUpdateFields(update.data));

  const rawUpdatesFallback = args.updates
    .map((update) => ({
      ...update,
      data: extractUpdateDataFromBulkEntry(update),
    }))
    .filter((update) => hasFallbackUpdateFields(update.data));

  const effectiveUpdates =
    normalizedUpdates.length > 0 ? normalizedUpdates : rawUpdatesFallback;

  if (effectiveUpdates.length === 0) {
    return JSON.stringify({
      error: "No valid update fields provided",
      type: args.type,
    });
  }

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
        payment: "projectPayments",
        shopping: "shoppingListItems",
        shoppingSet: "shoppingSets",
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
      items:
        originalItems.length > 0
          ? originalItems.map((item) => ({
              itemId: item.itemId,
              originalItem: item.originalItem,
              updates: item.updates,
            }))
          : effectiveUpdates.map((u) => ({
              itemId: u.itemId,
              originalItem: {},
              updates: u.data,
            })),
    },
  });
}

export async function prepareDeletePayload(
  args: z.infer<typeof deleteItemSchema>,
  options?: PrepareToolOptions,
): Promise<string> {
  let originalItem: { title?: string; name?: string; _id?: string } | null = null;
  if (options?.runQuery) {
    try {
      const searchApi = getInternalSearchApi();
      const typeToTable: Record<string, string> = {
        task: "tasks",
        note: "notes",
        payment: "projectPayments",
        shopping: "shoppingListItems",
        shoppingSet: "shoppingSets",
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
  return JSON.stringify({
    type: resolvedType,
    operation: "delete",
    data: {
      itemId: args.itemId,
      fileId: isMoodboardFile ? args.itemId : undefined,
      sectionId:
        args.type === "shoppingSection" ||
        args.type === "laborSection" ||
        args.type === "moodboardSection"
          ? args.itemId
          : undefined,
      setId: args.type === "shoppingSet" ? args.itemId : undefined,
      name: args.name || originalItem?.title || originalItem?.name,
      moodboardSection: isMoodboardFile ? originalItemRecord?.moodboardSection : undefined,
      reason: args.reason,
    },
    originalItem: originalItem || { _id: args.itemId, title: args.name, name: args.name },
  });
}

/**
 * Create tools in AI SDK format for use with streamText
 * Using inputSchema (AI SDK v5) instead of parameters
 */
export function createStreamingTools(options?: StreamingToolOptions) {
  const baseTools = {
    web_search: createAssistantTool({
      description:
        "Search the public web for current external information and return a cited summary. Use this for news, products, brands, regulations, market data, and any fact outside the current project.",
      inputSchema: webSearchSchema,
      inputExamples: [
        { query: "latest interior design trends for boutique hotels", searchContextSize: "medium" },
      ],
      execute: async (args: z.infer<typeof webSearchSchema>) => {
        try {
          const result = options?.runWebSearch
            ? await options.runWebSearch(args)
            : await runDefaultWebSearch(args);
          return JSON.stringify(result);
        } catch (error) {
          return JSON.stringify({
            error: "Failed to search the web",
            details: error instanceof Error ? error.message : "Unknown web search error",
          });
        }
      },
    }, options),

    search_items: createAssistantTool({
      description: "Search for and list items in the project (tasks, notes, invoices/payments, shopping items, labor items, surveys, contacts, team members, or moodboard sections/images). Use this tool when the user asks to see, list, show, or find existing items. Use type-specific filters for advanced queries. This is a READ-ONLY operation - it does not create or modify anything.",
      inputSchema: searchItemsSchema,
      inputExamples: [
        { type: "task", query: "bathroom", limit: 5 },
        { type: "moodboard", query: "kitchen", limit: 5 },
      ],
      execute: async (args: z.infer<typeof searchItemsSchema>) => {
        const toolOptions = options;
        const needsProjectContext = args.type !== "contact";
        const canRunSearch =
          args.type === "moodboard" ||
          args.type === "payment" ||
          args.type === "team_members"
            ? !!toolOptions?.runQuery
            : !!toolOptions?.runAction;

        if ((!toolOptions?.projectId && needsProjectContext) || !canRunSearch) {
          return JSON.stringify({ error: "Search not available - missing project context" });
        }

        try {
          const searchApi = getInternalSearchApi();
          const filters = normalizeSearchFilters(args.type, args.filters);
          // Route to appropriate search function based on type
          const searchMap = {
            task: searchApi.searchTasks,
            note: searchApi.searchNotes,
            payment: searchApi.searchPayments,
            shopping: searchApi.searchShoppingItems,
            labor: searchApi.searchLaborItems,
            survey: searchApi.searchSurveys,
            moodboard: searchApi.searchMoodboard,
          };

          const result = args.type === "contact"
            ? await (() => {
                if (!toolOptions?.teamSlug || !toolOptions.runAction) {
                  return Promise.resolve({
                    error: "Contact search not available - missing team context",
                  });
                }

                return toolOptions.runAction(searchApi.searchContacts, {
                  teamSlug: toolOptions.teamSlug,
                  query: args.query,
                  limit: args.limit,
                  ...filters,
                });
              })()
            : args.type === "moodboard"
              ? await (() => {
                  if (!toolOptions?.projectId || !toolOptions.runQuery) {
                    return Promise.resolve({
                      error: "Moodboard search not available - missing project context",
                    });
                  }

                  return toolOptions.runQuery(searchApi.searchMoodboard, {
                    projectId: toolOptions.projectId as Id<"projects">,
                    query: args.query,
                    limit: args.limit,
                    ...filters,
                  });
                })()
            : args.type === "payment"
              ? await (() => {
                  if (!toolOptions?.projectId || !toolOptions.runQuery) {
                    return Promise.resolve({
                      error: "Payment search not available - missing project context",
                    });
                  }

                  return toolOptions.runQuery(searchApi.searchPayments, {
                    projectId: toolOptions.projectId as Id<"projects">,
                    query: args.query,
                    limit: args.limit,
                    ...filters,
                  });
                })()
            : args.type === "team_members"
              ? await (async () => {
                  if (!toolOptions?.runQuery) {
                    return {
                      error:
                        "Team member search not available - missing query runtime",
                    };
                  }

                  const publicApi = getPublicApi();
                  let teamId = toolOptions.teamId;
                  if (!teamId && toolOptions.loadSnapshot) {
                    const snapshot = await toolOptions.loadSnapshot();
                    teamId = snapshot.project?.teamId;
                  }
                  if (!teamId) {
                    return {
                      error:
                        "Team member search not available - project has no team",
                    };
                  }

                  const members = await toolOptions.runQuery(
                    publicApi.teams.getTeamMembers,
                    { teamId },
                  );
                  const query = (args.query ?? "").trim().toLowerCase();
                  const filtered = Array.isArray(members)
                    ? members
                        .map((member) => {
                          const record = member as Record<string, unknown>;
                          return {
                            clerkUserId:
                              typeof record.clerkUserId === "string"
                                ? record.clerkUserId
                                : undefined,
                            name:
                              typeof record.name === "string"
                                ? record.name
                                : undefined,
                            email:
                              typeof record.email === "string"
                                ? record.email
                                : undefined,
                            role:
                              typeof record.role === "string"
                                ? record.role
                                : undefined,
                            isActive:
                              typeof record.isActive === "boolean"
                                ? record.isActive
                                : undefined,
                          };
                        })
                        .filter((member) => {
                          if (!query) return true;
                          return [
                            member.clerkUserId,
                            member.name,
                            member.email,
                            member.role,
                            member.isActive === false ? "inactive" : "active",
                          ].some((value) =>
                            String(value ?? "").toLowerCase().includes(query),
                          );
                        })
                        .slice(0, args.limit)
                    : [];

                  return {
                    ok: true,
                    type: "team_members",
                    results: filtered,
                    count: filtered.length,
                  };
                })()
            : await (() => {
                if (!toolOptions?.projectId || !toolOptions.runAction) {
                  return Promise.resolve({
                    error: "Search not available - missing project context",
                  });
                }

                return toolOptions.runAction(searchMap[args.type], {
                  projectId: toolOptions.projectId as Id<"projects">,
                  query: args.query,
                  limit: args.limit,
                  ...filters,
                });
              })();

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
      description: "Update project General Settings and timeline (name, description, cover image URL, status, start date, end date, client, customer email, location, budget, currency). Use this when the user asks to change project settings or project dates/timeline.",
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
        if (hasOwn("startDate")) {
          const rawStartDate =
            typeof args.startDate === "string" ? args.startDate.trim() : "";
          if (rawStartDate.length > 0 && !Number.isFinite(Date.parse(rawStartDate))) {
            return JSON.stringify({
              error: "Project start date must be a valid ISO date or timestamp",
            });
          }
          updates.startDate = rawStartDate.length > 0 ? rawStartDate : undefined;
        }
        if (hasOwn("endDate")) {
          const rawEndDate =
            typeof args.endDate === "string" ? args.endDate.trim() : "";
          if (rawEndDate.length > 0 && !Number.isFinite(Date.parse(rawEndDate))) {
            return JSON.stringify({
              error: "Project end date must be a valid ISO date or timestamp",
            });
          }
          updates.endDate = rawEndDate.length > 0 ? rawEndDate : undefined;
        }
        if (hasOwn("customer")) {
          updates.customer =
            typeof args.customer === "string" && args.customer.trim().length > 0
              ? args.customer.trim()
              : undefined;
        }
        if (hasOwn("customerEmail")) {
          updates.customerEmail =
            typeof args.customerEmail === "string" &&
            args.customerEmail.trim().length > 0
              ? args.customerEmail.trim().toLowerCase()
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

        const startTimestamp =
          typeof updates.startDate === "string"
            ? Date.parse(updates.startDate)
            : undefined;
        const endTimestamp =
          typeof updates.endDate === "string" ? Date.parse(updates.endDate) : undefined;
        if (
          typeof startTimestamp === "number" &&
          Number.isFinite(startTimestamp) &&
          typeof endTimestamp === "number" &&
          Number.isFinite(endTimestamp) &&
          endTimestamp < startTimestamp
        ) {
          return JSON.stringify({
            error: "Project end date cannot be earlier than the start date",
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
      description: "Generate a moodboard image with GPT Image and save it directly to the current project's moodboard. Use this when the user explicitly asks to create a moodboard, concept image, or visual. If the user mentions a room or moodboard section, pass that existing section title/id in `section`; do not call manage_moodboard to create a duplicate section unless the user explicitly asks for a new section. If the moodboard should be based on shopping list items, pass the shopping reference fields so the tool can collect project product images automatically.",
      inputSchema: generateMoodboardImageSchema,
      inputExamples: [
        {
          prompt: "Warm minimalist kitchen with oak fronts, travertine counters, and brushed steel details",
          section: "Kitchen",
        },
        {
          prompt: "Create a cohesive living room moodboard grounded in the selected furniture and lighting.",
          section: "Living room",
          useShoppingListAsReference: true,
          shoppingSectionName: "Living Room",
          onlySetPreferredItems: true,
          maxReferenceImages: 6,
        },
      ],
      execute: async (args: z.infer<typeof generateMoodboardImageSchema>) => {
        if (!options?.projectId || !options?.runAction) {
          return JSON.stringify({
            error: "Moodboard image generation is unavailable without active project context",
          });
        }

        try {
          const wantsShoppingReferences =
            args.useShoppingListAsReference === true ||
            (Array.isArray(args.shoppingItemIds) && args.shoppingItemIds.length > 0) ||
            typeof args.shoppingQuery === "string" ||
            typeof args.shoppingSectionName === "string" ||
            typeof args.shoppingSetName === "string";

          let finalPrompt = args.prompt.trim();
          let selectedShoppingItems: ShoppingMoodboardSourceItem[] = [];
          let referenceImages: Array<{ name: string; imageUrl: string }> = [];

          if (wantsShoppingReferences) {
            const sourceItems = await loadShoppingMoodboardSourceItems(args, options);
            selectedShoppingItems = selectShoppingItemsForMoodboard(sourceItems, {
              itemIds: args.shoppingItemIds,
              query: args.shoppingQuery,
              sectionName: args.shoppingSectionName,
              setName: args.shoppingSetName,
              onlySetPreferredItems: args.onlySetPreferredItems,
              maxItems: args.maxReferenceImages ?? 6,
            });

            if (selectedShoppingItems.length === 0) {
              return JSON.stringify({
                error: "No shopping items with images matched the requested criteria.",
                criteria: compactRecord({
                  shoppingItemIds: args.shoppingItemIds,
                  shoppingQuery: args.shoppingQuery,
                  shoppingSectionName: args.shoppingSectionName,
                  shoppingSetName: args.shoppingSetName,
                  onlySetPreferredItems: args.onlySetPreferredItems,
                }),
              });
            }

            referenceImages = toShoppingReferenceImages(
              selectedShoppingItems,
              args.maxReferenceImages ?? 6,
            );

            if (referenceImages.length === 0) {
              return JSON.stringify({
                error: "Selected shopping items do not have usable image URLs.",
              });
            }

            finalPrompt = buildMoodboardPromptFromShoppingItems(finalPrompt, selectedShoppingItems, {
              query: args.shoppingQuery,
              sectionName: args.shoppingSectionName,
              setName: args.shoppingSetName,
            });
          }

          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
          const apiModule = require("../_generated/api") as { api: any };
          const result = await options.runAction(
            apiModule.api.ai.imageGen.generation.generateMoodboardImageForAssistant,
            {
              projectId: options.projectId as Id<"projects">,
              prompt: finalPrompt,
              section: args.section,
              userClerkId: options.userClerkId,
              ...(referenceImages.length > 0 ? { referenceImages } : {}),
            },
          );
          return JSON.stringify({
            ...result,
            ...(referenceImages.length > 0
              ? {
                  referenceImageCount: referenceImages.length,
                  sourceShoppingItems: selectedShoppingItems.map((item) => ({
                    _id: item._id,
                    name: item.name,
                    sectionName: item.sectionName,
                    setTitle: item.setTitle,
                    imageUrl: item.imageUrl,
                  })),
                }
              : {}),
          });
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

  const manageTools = {
    manage_tasks: createAssistantTool({
      description: "Manage tasks with one tool. Use action=create|update|delete and provide task fields plus taskId for updates or deletes. If the user specifies any task date or time, include endDate; for a single deadline or appointment, set both startDate and endDate to that same ISO timestamp.",
      inputSchema: manageTasksSchema,
      requiresConfirmation: true,
      execute: async (args: z.infer<typeof manageTasksSchema>) => {
        const taskId = pickFirstNonEmptyString(args as Record<string, unknown>, [
          "taskId",
          "itemId",
          "id",
        ]);
        const data = extractManagedToolData(args, ["action", "taskId", "itemId", "id"]);

        if (args.action === "create") {
          return await prepareCreatePayload({
            type: "task",
            data: data as z.infer<typeof createItemSchema>["data"],
          });
        }

        if (!taskId) {
          return JSON.stringify({
            error: `manage_tasks requires taskId for ${args.action}`,
          });
        }

        if (args.action === "update") {
          return await prepareUpdatePayload({
            type: "task",
            itemId: taskId,
            data,
          }, options);
        }

        return await prepareDeletePayload({
          type: "task",
          itemId: taskId,
          name: pickFirstNonEmptyString(data, ["title", "name"]),
          reason: pickFirstNonEmptyString(data, ["reason"]),
        });
      },
    }, options),

    manage_notes: createAssistantTool({
      description: "Manage notes with one tool. Use action=create|update|delete and provide note fields plus noteId for updates or deletes.",
      inputSchema: manageNotesSchema,
      requiresConfirmation: true,
      execute: async (args: z.infer<typeof manageNotesSchema>) => {
        const noteId = pickFirstNonEmptyString(args as Record<string, unknown>, [
          "noteId",
          "itemId",
          "id",
        ]);
        const data = extractManagedToolData(args, ["action", "noteId", "itemId", "id"]);

        if (args.action === "create") {
          return await prepareCreatePayload({
            type: "note",
            data: data as z.infer<typeof createItemSchema>["data"],
          });
        }

        if (!noteId) {
          return JSON.stringify({
            error: `manage_notes requires noteId for ${args.action}`,
          });
        }

        if (args.action === "update") {
          return await prepareUpdatePayload({
            type: "note",
            itemId: noteId,
            data,
          }, options);
        }

        return await prepareDeletePayload({
          type: "note",
          itemId: noteId,
          name: pickFirstNonEmptyString(data, ["title", "name"]),
          reason: pickFirstNonEmptyString(data, ["reason"]),
        });
      },
    }, options),

    manage_contacts: createAssistantTool({
      description: "Manage contacts with one tool. Use action=create|update|delete and provide contact fields plus contactId for updates or deletes.",
      inputSchema: manageContactsSchema,
      requiresConfirmation: true,
      execute: async (args: z.infer<typeof manageContactsSchema>) => {
        const contactId = pickFirstNonEmptyString(args as Record<string, unknown>, [
          "contactId",
          "itemId",
          "id",
        ]);
        const data = extractManagedToolData(args, ["action", "contactId", "itemId", "id"]);

        if (args.action === "create") {
          return await prepareCreatePayload({
            type: "contact",
            data: data as z.infer<typeof createItemSchema>["data"],
          });
        }

        if (!contactId) {
          return JSON.stringify({
            error: `manage_contacts requires contactId for ${args.action}`,
          });
        }

        if (args.action === "update") {
          return await prepareUpdatePayload({
            type: "contact",
            itemId: contactId,
            data,
          }, options);
        }

        return await prepareDeletePayload({
          type: "contact",
          itemId: contactId,
          name: pickFirstNonEmptyString(data, ["name", "title"]),
          reason: pickFirstNonEmptyString(data, ["reason"]),
        });
      },
    }, options),

    manage_payments: createAssistantTool({
      description: "Manage project invoices and payments with one tool. Use action=create|update|delete and provide paymentId for updates or deletes.",
      inputSchema: managePaymentsSchema,
      requiresConfirmation: true,
      execute: async (args: z.infer<typeof managePaymentsSchema>) => {
        const paymentId = pickFirstNonEmptyString(args as Record<string, unknown>, [
          "paymentId",
          "invoiceId",
          "itemId",
          "id",
        ]);
        const data = extractManagedToolData(args, [
          "action",
          "paymentId",
          "invoiceId",
          "itemId",
          "id",
        ]);

        if (args.action === "create") {
          return await prepareCreatePayload({
            type: "payment",
            data: data as z.infer<typeof createItemSchema>["data"],
          });
        }

        if (!paymentId) {
          return JSON.stringify({
            error: `manage_payments requires paymentId for ${args.action}`,
          });
        }

        if (args.action === "update") {
          return await prepareUpdatePayload({
            type: "payment",
            itemId: paymentId,
            data,
          }, options);
        }

        return await prepareDeletePayload({
          type: "payment",
          itemId: paymentId,
          name: pickFirstNonEmptyString(data, ["title", "invoiceNumber", "name"]),
          reason: pickFirstNonEmptyString(data, ["reason"]),
        });
      },
    }, options),

    manage_surveys: createAssistantTool({
      description: "Manage surveys with one tool. Use action=create|update|delete and provide survey fields plus surveyId for updates or deletes.",
      inputSchema: manageSurveysSchema,
      requiresConfirmation: true,
      execute: async (args: z.infer<typeof manageSurveysSchema>) => {
        const surveyId = pickFirstNonEmptyString(args as Record<string, unknown>, [
          "surveyId",
          "itemId",
          "id",
        ]);
        const data = extractManagedToolData(args, ["action", "surveyId", "itemId", "id"]);

        if (args.action === "create") {
          return await prepareCreatePayload({
            type: "survey",
            data: data as z.infer<typeof createItemSchema>["data"],
          });
        }

        if (!surveyId) {
          return JSON.stringify({
            error: `manage_surveys requires surveyId for ${args.action}`,
          });
        }

        if (args.action === "update") {
          return await prepareUpdatePayload({
            type: "survey",
            itemId: surveyId,
            data,
          }, options);
        }

        return await prepareDeletePayload({
          type: "survey",
          itemId: surveyId,
          name: pickFirstNonEmptyString(data, ["title", "name"]),
          reason: pickFirstNonEmptyString(data, ["reason"]),
        });
      },
    }, options),

    manage_shopping: createAssistantTool({
      description: "Manage shopping items, shopping sections, or shopping sets with one tool. Use action=create|update|delete and entity=item|section|set.",
      inputSchema: manageShoppingSchema,
      requiresConfirmation: true,
      execute: async (args: z.infer<typeof manageShoppingSchema>) => {
        const type =
          args.entity === "section"
            ? "shoppingSection"
            : args.entity === "set"
              ? "shoppingSet"
              : "shopping";
        const id = pickFirstNonEmptyString(args as Record<string, unknown>, [
          args.entity === "section"
            ? "sectionId"
            : args.entity === "set"
              ? "setId"
              : "itemId",
          "itemId",
          "setId",
          "sectionId",
          "id",
        ]);
        const data = extractManagedToolData(args, [
          "action",
          "entity",
          "itemId",
          "sectionId",
          "setId",
          "id",
        ]);

        if (args.action === "create") {
          return await prepareCreatePayload({
            type,
            data: data as z.infer<typeof createItemSchema>["data"],
          });
        }

        if (!id) {
          return JSON.stringify({
            error: `manage_shopping requires ${args.entity === "section" ? "sectionId" : args.entity === "set" ? "setId" : "itemId"} for ${args.action}`,
          });
        }

        if (args.action === "update") {
          return await prepareUpdatePayload({
            type,
            itemId: id,
            data,
          }, options);
        }

        return await prepareDeletePayload({
          type,
          itemId: id,
          name: pickFirstNonEmptyString(data, ["name", "sectionName", "title"]),
          reason: pickFirstNonEmptyString(data, ["reason"]),
        });
      },
    }, options),

    manage_labor: createAssistantTool({
      description: "Manage labor items or labor sections with one tool. Use action=create|update|delete and entity=item|section. If the user specifies any labor date or time, include endDate; for a single scheduled slot, set both startDate and endDate to that same ISO timestamp.",
      inputSchema: manageLaborSchema,
      requiresConfirmation: true,
      execute: async (args: z.infer<typeof manageLaborSchema>) => {
        const type = args.entity === "section" ? "laborSection" : "labor";
        const id = pickFirstNonEmptyString(args as Record<string, unknown>, [
          args.entity === "section" ? "sectionId" : "itemId",
          "itemId",
          "sectionId",
          "id",
        ]);
        const data = extractManagedToolData(args, [
          "action",
          "entity",
          "itemId",
          "sectionId",
          "id",
        ]);

        if (args.action === "create") {
          return await prepareCreatePayload({
            type,
            data: data as z.infer<typeof createItemSchema>["data"],
          });
        }

        if (!id) {
          return JSON.stringify({
            error: `manage_labor requires ${args.entity === "section" ? "sectionId" : "itemId"} for ${args.action}`,
          });
        }

        if (args.action === "update") {
          return await prepareUpdatePayload({
            type,
            itemId: id,
            data,
          }, options);
        }

        return await prepareDeletePayload({
          type,
          itemId: id,
          name: pickFirstNonEmptyString(data, ["name", "sectionName", "title"]),
          reason: pickFirstNonEmptyString(data, ["reason"]),
        });
      },
    }, options),

    manage_moodboard: createAssistantTool({
      description: "Manage moodboard sections with one tool. Use action=create|update|delete.",
      inputSchema: manageMoodboardSchema,
      requiresConfirmation: true,
      execute: async (args: z.infer<typeof manageMoodboardSchema>) => {
        const id = pickFirstNonEmptyString(args as Record<string, unknown>, [
          "sectionId",
          "itemId",
          "id",
        ]);
        const data = extractManagedToolData(args, [
          "action",
          "sectionId",
          "itemId",
          "id",
        ]);

        if (args.action === "create") {
          return await prepareCreatePayload({
            type: "moodboardSection",
            data: data as z.infer<typeof createItemSchema>["data"],
          });
        }

        if (!id) {
          return JSON.stringify({
            error: `manage_moodboard requires sectionId for ${args.action}`,
          });
        }

        if (args.action === "update") {
          return await prepareUpdatePayload({
            type: "moodboardSection",
            itemId: id,
            data,
          }, options);
        }

        return await prepareDeletePayload({
          type: "moodboardSection",
          itemId: id,
          name: pickFirstNonEmptyString(data, ["name", "sectionName", "title"]),
          reason: pickFirstNonEmptyString(data, ["reason"]),
        });
      },
    }, options),
  };

  const allTools = {
    ...manageTools,
    ...baseTools,
  };

  const activeToolNames = getActiveRuntimeToolNames(
    options?.allowedToolNames,
    options?.crudApprovalMode ?? "auto_confirm",
  );
  const allowed = new Set(activeToolNames);
  return Object.fromEntries(
    Object.entries(allTools).filter(([toolName]) => allowed.has(toolName)),
  ) as typeof allTools;
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
