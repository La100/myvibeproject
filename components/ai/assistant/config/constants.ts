/**
 * AI Assistant Constants
 *
 * Static configuration and constant values for the AI Assistant.
 */

import type { PendingItemType, QuickPrompt, ContactInput } from "../data/types";

// ==================== PENDING ITEM TYPES ====================

/** Canonical pending item types (without operation prefix) */
export const CANONICAL_TYPES: PendingItemType[] = [
  "task",
  "note",
  "moodboard",
  "shopping",
  "survey",
  "contact",
  "shoppingSection",
  "labor",
  "laborSection",
  "projectSettings",
];

export const PENDING_ITEM_TYPES: PendingItemType[] = CANONICAL_TYPES;

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
  update_project_settings: { type: "projectSettings", operation: "edit" },
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

export const MAX_FILE_SIZE_MB = 32;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ACCEPTED_FILE_TYPES =
  "image/*,application/pdf,.txt,.md,.csv,.tsv,.json,.jsonl,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.xlsm,.xml,.html,.py,.js,.ts,.css,.rtf";

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
