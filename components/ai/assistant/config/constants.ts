/**
 * AI Assistant Constants
 *
 * Static configuration and constant values for the AI Assistant.
 */

import type { PendingItemType, AnyPendingItemType, QuickPrompt, ContactInput } from "../data/types";

// ==================== PENDING ITEM TYPES ====================

/** Canonical pending item types (without operation prefix) */
export const CANONICAL_TYPES: PendingItemType[] = [
  "task",
  "note",
  "shopping",
  "survey",
  "contact",
  "shoppingSection",
  "labor",
  "laborSection",
  "projectSettings",
];

/** All valid pending item types including legacy names (for backwards compatibility) */
export const ALL_PENDING_ITEM_TYPES: AnyPendingItemType[] = [
  ...CANONICAL_TYPES,
  "create_task",
  "create_note",
  "create_shopping_item",
  "create_survey",
  "create_contact",
  "create_multiple_tasks",
  "create_multiple_notes",
  "create_multiple_shopping_items",
  "create_multiple_surveys",
  "create_labor_item",
  "create_labor_section",
  "create_multiple_labor_items",
];

/** @deprecated Use CANONICAL_TYPES or ALL_PENDING_ITEM_TYPES */
export const PENDING_ITEM_TYPES = ALL_PENDING_ITEM_TYPES;

/** Maps legacy type names to canonical types */
export const LEGACY_TYPE_TO_CANONICAL: Record<string, PendingItemType> = {
  create_task: "task",
  create_note: "note",
  create_shopping_item: "shopping",
  create_survey: "survey",
  create_contact: "contact",
  create_multiple_tasks: "task",
  create_multiple_notes: "note",
  create_multiple_shopping_items: "shopping",
  create_multiple_surveys: "survey",
  create_labor_item: "labor",
  create_labor_section: "laborSection",
  create_multiple_labor_items: "labor",
};

// ==================== QUICK PROMPTS ====================

export const QUICK_PROMPTS: QuickPrompt[] = [
  {
    label: "Set Up Phases",
    prompt: "Create 6 renovation tasks in sequence: demolition, rough-in electrical, rough-in plumbing, finishing (tiling/painting), fixture installation, and final inspection. Set status to todo, assign priorities, and include dependency notes.",
  },
  {
    label: "Material List",
    prompt: "Create shopping sections by phase (demolition, rough-in, finishing, fixtures) and add a starter material list with estimated quantities and unit prices in project currency. Use quantity=1 when unknown and mark unclear prices as TBD.",
  },
  {
    label: "Labor Costs",
    prompt: "Create labor items by trade (electrician, plumber, tiler, painter, carpenter) with estimated hours, unit=hour, and unitPrice in project currency. Add a note with the total estimated labor cost.",
  },
  {
    label: "Add Contractors",
    prompt: "Create contacts for electrician, plumber, tiler, painter, and general contractor. Set type=contractor and leave unknown fields empty instead of inventing placeholder details.",
  },
  {
    label: "Week Plan",
    prompt: "Starting from next Monday, create a week-by-week renovation plan with start/end dates and milestones for demolition, rough-in, installations, finishing, and handover.",
  },
  {
    label: "Status Check",
    prompt: "Load the full project context and provide a concise status report: completed, in progress, overdue/blocked, top 3 risks, and recommended actions for this week.",
  },
];

// ==================== TOOL NAME MAPPINGS ====================

export const TOOL_NAME_MAPPING: Record<string, { type: PendingItemType; operation: 'create' | 'edit' | 'delete' | 'bulk_edit' | 'bulk_create' }> = {
  edit_task: { type: "task", operation: "edit" },
  edit_multiple_tasks: { type: "task", operation: "bulk_edit" },
  delete_task: { type: "task", operation: "delete" },
  edit_note: { type: "note", operation: "edit" },
  edit_multiple_notes: { type: "note", operation: "bulk_edit" },
  delete_note: { type: "note", operation: "delete" },
  edit_shopping_item: { type: "shopping", operation: "edit" },
  edit_multiple_shopping_items: { type: "shopping", operation: "bulk_edit" },
  delete_shopping_item: { type: "shopping", operation: "delete" },
  create_shopping_section: { type: "shoppingSection", operation: "create" },
  edit_shopping_section: { type: "shoppingSection", operation: "edit" },
  delete_shopping_section: { type: "shoppingSection", operation: "delete" },
  edit_survey: { type: "survey", operation: "edit" },
  edit_multiple_surveys: { type: "survey", operation: "bulk_edit" },
  delete_survey: { type: "survey", operation: "delete" },
  delete_contact: { type: "contact", operation: "delete" },
  // Labor tools
  edit_labor_item: { type: "labor", operation: "edit" },
  edit_multiple_labor_items: { type: "labor", operation: "bulk_edit" },
  delete_labor_item: { type: "labor", operation: "delete" },
  create_labor_section: { type: "laborSection", operation: "create" },
  edit_labor_section: { type: "laborSection", operation: "edit" },
  delete_labor_section: { type: "laborSection", operation: "delete" },
};

// ==================== ALLOWED SHOPPING FIELDS ====================

export const ALLOWED_SHOPPING_FIELDS = [
  "name",
  "quantity",
  "notes",
  "priority",
  "buyBefore",
  "supplier",
  "category",
  "unitPrice",
  "totalPrice",
  "sectionId",
] as const;

// ==================== CONTACT TYPES ====================

export const ALLOWED_CONTACT_TYPES = new Set(["contractor", "supplier", "subcontractor", "other"]);

export const OPTIONAL_CONTACT_STRING_FIELDS: Array<keyof Omit<ContactInput, "name" | "type">> = [
  "companyName",
  "email",
  "phone",
  "address",
  "city",
  "postalCode",
  "website",
  "taxId",
  "notes",
];

// ==================== FILE UPLOAD ====================

export const MAX_FILE_SIZE_MB = 512;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ACCEPTED_FILE_TYPES = "image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.xlsm,.txt,.json,.jsonl,.csv,.md,.py,.js,.ts,.html,.css,.xml,.rtf";

// ==================== UI CONSTANTS ====================

export const MAX_MESSAGE_LENGTH = 4000;
export const AUTO_SCROLL_THRESHOLD = 100;
export const RETRY_DELAYS = [1000, 2000, 4000]; // Retry delays in ms

// ==================== KEYWORDS FOR MESSAGE DETECTION ====================

export const UPDATE_KEYWORDS = [
  "assign",
  "set",
  "set to me",
  "deadline",
  "due",
  "priority",
  "tag",
];

export const CREATE_KEYWORDS = [
  "create",
  "add",
  "new",
  "another",
  "next",
];
