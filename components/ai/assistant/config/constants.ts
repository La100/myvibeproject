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
    label: "Plan",
    prompt: "Sketch a focused architectural project plan for this week with key tasks and owners.",
  },
  {
    label: "Budget",
    prompt: "Review our project budget and flag any cost overruns we should tackle.",
  },
  {
    label: "Supplies",
    prompt: "Prepare a materials shopping list for the upcoming work sessions.",
  },
  {
    label: "Update",
    prompt: "Draft a client update summarizing today's architectural project progress.",
  },
  {
    label: "Risks",
    prompt: "List potential blockers that might delay the architectural project timeline.",
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
  "przypisz",
  "do mnie",
  "ustaw",
  "termin",
  "deadline",
  "due",
  "priorytet",
  "priority",
  "tag",
];

export const CREATE_KEYWORDS = [
  "dodaj",
  "utworz",
  "stworz",
  "create",
  "add",
  "nowy",
  "kolejny",
  "another",
  "next",
];
