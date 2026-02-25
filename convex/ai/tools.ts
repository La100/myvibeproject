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
import type { Id } from "../_generated/dataModel";
import type { ProjectContextSnapshot } from "./types";

// RunAction type matches ctx.runAction signature
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunActionFn = (action: any, args: any) => Promise<any>;
// RunQuery type matches ctx.runQuery signature
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunQueryFn = (query: any, args: any) => Promise<any>;

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
});

const noteFields = z.object({
  title: z.string().describe("Note title"),
  content: z.string().describe("Note content"),
});

const shoppingFields = z.object({
  name: z.string().describe("Item name"),
  notes: z.string().optional().describe("Additional notes or description"),
  quantity: z.number().optional().describe("Quantity needed"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("Item priority"),
  buyBefore: z.string().optional().describe("Buy before date in ISO format (YYYY-MM-DD)"),
  supplier: z.string().optional().describe("Supplier or store name"),
  category: z.string().optional().describe("Item category"),
  dimensions: z.string().optional().describe("Item dimensions or size"),
  unitPrice: z.number().optional().describe("Price per unit"),
  totalPrice: z.number().optional().describe("Total price"),
  productLink: z.string().optional().describe("Link to product page"),
  catalogNumber: z.string().optional().describe("Product catalog/model number"),
  sectionId: z.string().optional().describe("Shopping list section ID"),
  sectionName: z.string().optional().describe("Shopping list section name"),
});

const laborFields = z.object({
  name: z.string().describe("Work description"),
  notes: z.string().optional().describe("Additional notes or description"),
  quantity: z.number().optional().describe("Quantity of work"),
  unit: z.string().optional().describe("Unit of measurement (m², m, hours, pcs, etc.)"),
  unitPrice: z.number().optional().describe("Price per unit"),
  sectionId: z.string().optional().describe("Labor section ID"),
  sectionName: z.string().optional().describe("Labor section name"),
  assignedTo: z.string().optional().describe("Contractor or team member name"),
});

const surveyFields = z.object({
  title: z.string().describe("Survey title"),
  description: z.string().optional().describe("Survey description"),
  isRequired: z.boolean().optional().describe("Whether survey is required"),
  allowMultipleResponses: z.boolean().optional().describe("Allow multiple responses"),
  startDate: z.string().optional().describe("Survey start date in ISO format"),
  endDate: z.string().optional().describe("Survey end date in ISO format"),
  targetAudience: z.enum(["all_customers", "specific_customers", "team_members"]).optional().describe("Target audience"),
  targetCustomerIds: z.array(z.string()).optional().describe("Specific customer IDs"),
  questions: z.array(z.object({
    questionText: z.string(),
    questionType: z.enum(["text_short", "text_long", "multiple_choice", "single_choice", "rating", "yes_no", "number", "file"]),
    options: z.array(z.string()).optional(),
    isRequired: z.boolean().optional(),
  })).optional().describe("Survey questions"),
});

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
});

const sectionFields = z.object({
  name: z.string().describe("Section name"),
});

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
  items: z.array(z.union([taskFields, noteFields, shoppingFields, laborFields, surveyFields, contactFields])).describe("Array of items to create"),
});

// Generic update schema
export const updateItemSchema = z.object({
  type: itemTypeEnum.describe("Type of item to update"),
  itemId: z.string().describe("ID of the item to update"),
  data: z.union([
    taskFields.partial(),
    noteFields.partial(),
    shoppingFields.partial(),
    laborFields.partial(),
    surveyFields.partial(),
    contactFields.partial(),
    sectionFields.partial(),
  ]).describe("Fields to update"),
});

export const updateMultipleItemsSchema = z.object({
  type: itemTypeEnum.describe("Type of items to update"),
  updates: z.array(z.object({
    itemId: z.string(),
    data: z.union([
      taskFields.partial(),
      noteFields.partial(),
      shoppingFields.partial(),
      laborFields.partial(),
      surveyFields.partial(),
      contactFields.partial(),
    ]),
  })).describe("Array of items to update with their IDs"),
});

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
  filters: z.record(z.any()).optional().describe("Type-specific filters (e.g., status, sectionName, contactType)"),
  limit: z.number().optional().default(10).describe("Maximum number of results"),
});

// Keep specific schemas for backward compatibility and specific use cases
export const loadFullProjectContextSchema = z.object({
  reason: z.string().optional().describe("Why you need the full context"),
});

// ============================================
// AI SDK TOOLS (for streaming)
// ============================================

// Types for tool options
interface StreamingToolOptions {
  projectId?: string;
  runAction?: RunActionFn;
  runQuery?: RunQueryFn;
  loadSnapshot?: () => Promise<ProjectContextSnapshot>;
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

/**
 * Create tools in AI SDK format for use with streamText
 * Using inputSchema (AI SDK v5) instead of parameters
 */
export function createStreamingTools(options?: StreamingToolOptions) {
  return {
    // Generic CRUD operations
    create_item: {
      description: "Create a new item (task, note, shopping item, labor item, survey, contact, or section). Specify the type and provide the appropriate data fields. ONLY use this when the user explicitly asks to create something.",
      inputSchema: createItemSchema,
      execute: async (args: z.infer<typeof createItemSchema>) => {
        // Validate that we have minimum required fields
        const data = args.data as Record<string, unknown>;
        const hasTitle = data.title && typeof data.title === 'string' && data.title.trim().length > 0;
        const hasName = data.name && typeof data.name === 'string' && data.name.trim().length > 0;

        // Require at least title or name
        if (!hasTitle && !hasName) {
          return JSON.stringify({
            error: "Cannot create item without title or name",
            message: "Please provide item details before creating"
          });
        }

        return JSON.stringify({
          type: getOperationType(args.type),
          operation: "create",
          data: args.data
        });
      },
    },

    create_multiple_items: {
      description: "Create multiple items at once (2+ items of the same type). More efficient than multiple single creates.",
      inputSchema: createMultipleItemsSchema,
      execute: async (args: z.infer<typeof createMultipleItemsSchema>) => {
        return JSON.stringify({
          type: getOperationType(args.type),
          operation: "bulk_create",
          data: { items: args.items }
        });
      },
    },

    update_item: {
      description: "Update/edit an existing item. Provide the type, item ID, and fields to update. Only changed fields need to be included.",
      inputSchema: updateItemSchema,
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

        return JSON.stringify({
          type: getOperationType(args.type),
          operation: "edit",
          data: { itemId: args.itemId },
          updates: args.data,
          originalItem: originalItem || { _id: args.itemId },
        });
      },
    },

    update_multiple_items: {
      description: "Update multiple items at once (2+ items of the same type). More efficient than multiple single updates.",
      inputSchema: updateMultipleItemsSchema,
      execute: async (args: z.infer<typeof updateMultipleItemsSchema>) => {
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
              for (const update of args.updates) {
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
              : args.updates.map(u => ({
                itemId: u.itemId,
                originalItem: {},
                updates: u.data
              }))
          }
        });
      },
    },

    delete_item: {
      description: "Delete/remove an item from the project. Provide the type and item ID.",
      inputSchema: deleteItemSchema,
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

        return JSON.stringify({
          type: getOperationType(args.type),
          operation: "delete",
          data: { itemId: args.itemId, name: args.name || originalItem?.title || originalItem?.name, reason: args.reason },
          originalItem: originalItem || { _id: args.itemId, title: args.name, name: args.name },
        });
      },
    },

    // Generic search operation
    search_items: {
      description: "Search for and list items in the project (tasks, notes, shopping items, labor items, surveys, or contacts). Use this tool when the user asks to see, list, show, or find existing items. Use type-specific filters for advanced queries. This is a READ-ONLY operation - it does not create or modify anything.",
      inputSchema: searchItemsSchema,
      execute: async (args: z.infer<typeof searchItemsSchema>) => {
        if (!options?.projectId || !options?.runAction) {
          return JSON.stringify({ error: "Search not available - missing project context" });
        }

        try {
          const searchApi = getInternalSearchApi();
          // Route to appropriate search function based on type
          const searchMap = {
            task: searchApi.searchTasks,
            note: searchApi.searchNotes,
            shopping: searchApi.searchShoppingItems,
            labor: searchApi.searchLaborItems,
            survey: searchApi.searchSurveys,
            contact: searchApi.searchContacts,
          };

          const searchFn = searchMap[args.type];
          const result = await options.runAction(searchFn, {
            projectId: options.projectId as Id<"projects">,
            query: args.query,
            limit: args.limit,
            ...args.filters,
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
    },

    update_project_settings: {
      description: "Update project General Settings (name, description, cover image URL, status, client, location, budget, currency). Use this when the user asks to change project settings.",
      inputSchema: updateProjectSettingsSchema,
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
    },

    // Full project context loading tool
    load_full_project_context: {
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
    },
  };
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
