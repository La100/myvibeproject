/**
 * AI Assistant Types
 *
 * Consolidated TypeScript types and interfaces for the AI Assistant feature.
 * This file combines types from ai-assistant/types.ts and AIConfirmationGrid.tsx
 */

import type { Id } from "@/convex/_generated/dataModel";
import type React from "react";

// ==================== PENDING ITEM TYPES ====================

/**
 * Canonical pending item types.
 * The operation (create/edit/delete/bulk_*) is specified in PendingOperation.
 */
export type PendingItemType =
  | 'task'
  | 'note'
  | 'moodboard'
  | 'shopping'
  | 'survey'
  | 'contact'
  | 'shoppingSection'
  | 'labor'
  | 'laborSection'
  | 'projectSettings';

export type PendingContentType = PendingItemType;

/**
 * Operation types for pending items
 */
export type PendingOperation = 'create' | 'edit' | 'delete' | 'bulk_edit' | 'bulk_create';

/**
 * Approval state for pending items (used in UI flow)
 */
export type PendingApprovalState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-denied"
  | "output-error";

/**
 * Display information for pending item UI
 */
export interface PendingDisplay {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  details?: React.ReactNode;
  diff?: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Main pending item structure
 */
export type PendingItem = {
  /** Canonical pending item type */
  type: PendingItemType;
  /** Operation to perform */
  operation: PendingOperation;
  /** Client-side id for UI transitions */
  clientId?: string;
  /** Resolved status for tool approval/result UI */
  status?: "confirmed" | "rejected" | "superseded";
  /** Approval state for UI flow */
  approvalState?: PendingApprovalState;
  /** Reason for approval state */
  approvalReason?: string;
  /** Primary data payload */
  data: Record<string, unknown>;
  /** For edit operations - the specific updates */
  updates?: Record<string, unknown>;
  /** Original item data (for edit/delete operations) */
  originalItem?: Record<string, unknown>;
  /** Selection criteria (for bulk operations) */
  selection?: Record<string, unknown>;
  /** For bulk title edits */
  titleChanges?: Array<{
    taskId?: string;
    id?: string;
    currentTitle?: string;
    originalTitle?: string;
    newTitle: string;
  }>;
  /** Display info for UI */
  display?: PendingDisplay;
  /** Original function call info from AI */
  functionCall?: {
    callId: string;
    functionName: string;
    arguments: string;
  };
  /** Response ID for tracking */
  responseId?: string;
};

export type PendingContentItem = PendingItem;

// ==================== INPUT TYPES ====================

export type TaskInput = {
  title: string;
  status?: 'todo' | 'in_progress' | 'review' | 'done';
  description?: string;
  assignedTo?: string | null;
  assignedToName?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  startDate?: string;
  endDate?: string;
  tags?: string[];
};

export type BulkTaskData = {
  tasks?: TaskInput[];
};

export type NoteInput = {
  title: string;
  content: string;
};

export type BulkNoteData = {
  notes?: NoteInput[];
};

export type ShoppingItemInput = {
  name: string;
  quantity: number;
  notes?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  buyBefore?: string;
  supplier?: string;
  category?: string;
  unitPrice?: number;
  sectionId?: Id<'shoppingListSections'>;
  sectionName?: string;
};

export type BulkShoppingData = {
  items?: ShoppingItemInput[];
};

export type LaborItemInput = {
  name: string;
  quantity: number;
  unit?: string;
  notes?: string;
  unitPrice?: number;
  sectionId?: Id<'laborSections'>;
  sectionName?: string;
  assignedTo?: string;
};

export type BulkLaborData = {
  items?: LaborItemInput[];
};

export type BulkSurveyData = {
  surveys?: Array<Record<string, unknown>>;
};

export type ContactInput = {
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  website?: string;
  taxId?: string;
  type: "contractor" | "supplier" | "subcontractor" | "other";
  notes?: string;
};

// ==================== CHAT TYPES ====================

export type ChatHistoryEntry = {
  role: 'user' | 'assistant';
  content: string;
  messageIndex?: number;
  mode?: "full" | "recent";
  tokenUsage?: { totalTokens: number; estimatedCostUSD: number };
  fileInfo?: { name: string; size: number; type: string; id: string };
  filesInfo?: Array<{ name: string; size: number; type: string; id: string }>;
  status?: "streaming" | "pending" | "success" | "failed";
};

export type SessionTokens = {
  total: number;
  cost: number;
};

export type ThreadListItem = {
  threadId: string;
  title: string;
  lastMessageAt?: number;
  lastMessagePreview?: string;
  lastMessageRole?: "user" | "assistant";
  messageCount?: number;
};

// ==================== SURVEY TYPES ====================

export type SurveyQuestion = {
  questionId?: string;
  operation?: "create" | "edit" | "delete";
  questionText: string;
  questionType: "text_short" | "text_long" | "multiple_choice" | "single_choice" | "rating" | "yes_no" | "number" | "file";
  options?: string[];
  isRequired?: boolean;
  order?: number;
};

export type SurveyData = {
  title: string;
  description?: string;
  isRequired?: boolean;
  allowMultipleResponses?: boolean;
  startDate?: string;
  endDate?: string;
  questions?: SurveyQuestion[];
};

// ==================== CONFIRMATION RESULT TYPES ====================

export type ConfirmationResult = {
  success: boolean;
  message: string;
  taskId?: string;
  noteId?: string;
  itemId?: string;
  surveyId?: string;
  contactId?: string;
  laborItemId?: string;
};

// ==================== QUICK PROMPT TYPE ====================

export type QuickPrompt = {
  label: string;
  prompt: string;
};
