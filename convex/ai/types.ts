import type { Id } from "../_generated/dataModel";

export interface ProjectContextSnapshot {
  project: ProjectSummary | null;
  tasks: Array<TaskContext>;
  notes: Array<NoteContext>;
  shoppingItems: Array<ShoppingItemContext>;
  contacts: Array<ContactContext>;
  surveys: Array<SurveyContext>;
  files: Array<FileContext>;
  summary: string;
}

export interface ProjectSummary {
  _id: string;
  name: string;
  description?: string;
  coverImageUrl?: string;
  status: "planning" | "active" | "on_hold" | "completed" | "cancelled";
  startDate?: number;
  endDate?: number;
  budget?: number;
  customer?: string;
  location?: string;
  currency?:
    | "USD" | "EUR" | "PLN" | "GBP" | "CAD" | "AUD" | "JPY" | "CHF" | "SEK" | "NOK"
    | "DKK" | "CZK" | "HUF" | "CNY" | "INR" | "BRL" | "MXN" | "KRW" | "SGD" | "HKD";
  tags?: Array<string>;
  teamId?: Id<"teams">;
}

export interface TaskContext {
  _id: string;
  title: string;
  description?: string;
  content?: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority?: "low" | "medium" | "high" | "urgent";
  assignedTo?: string | null;
  assignedToName?: string;
  startDate?: number;
  endDate?: number;
  tags: Array<string>;
}

export interface NoteContext {
  _id: string;
  title: string;
  content: string;
  isArchived: boolean;
  updatedAt: number;
}

export interface ShoppingItemContext {
  _id: string;
  name: string;
  notes?: string;
  category?: string;
  supplier?: string;
  dimensions?: string;
  imageUrl?: string;
  productLink?: string;
  quantity: number;
  unit?: string;
  unitPrice?: number;
  totalPrice?: number;
  realizationStatus:
    | "PLANNED"
    | "ORDERED"
    | "IN_TRANSIT"
    | "DELIVERED"
    | "COMPLETED"
    | "CANCELLED";
  assignedTo?: string | null;
  sectionId?: Id<"shoppingListSections"> | null;
  sectionName?: string;
  setId?: Id<"shoppingSets"> | null;
  setTitle?: string;
  setType?: "variant" | "bundle" | "reference";
  isPreferredInSet?: boolean;
  isResolvedInSet?: boolean;
}

export interface ContactContext {
  _id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  notes?: string;
  type: "contractor" | "supplier" | "subcontractor" | "other";
}

export interface SurveyContext {
  _id: string;
  title: string;
  description?: string;
  status: "draft" | "active" | "closed";
  isRequired: boolean;
  allowMultipleResponses: boolean;
  questions: Array<SurveyQuestionContext>;
}

export interface SurveyQuestionContext {
  _id: string;
  questionText: string;
  questionType:
    | "text_short"
    | "text_long"
    | "multiple_choice"
    | "single_choice"
    | "rating"
    | "yes_no"
    | "number"
    | "file";
  options?: Array<string>;
}

export interface FileContext {
  _id: string;
  name: string;
  description?: string;
  fileType: "image" | "video" | "document" | "drawing" | "model" | "other";
  size: number;
  mimeType: string;
  moodboardSection?: string;
  extractedText?: string;
  pdfAnalysis?: string;
  aiKnowledgeEnabled?: boolean;
  aiKnowledgeStatus?: "excluded" | "pending" | "ready" | "failed";
  aiKnowledgeEntryId?: string;
  aiKnowledgeIndexedAt?: number;
}

// Additional types for AI processing
export interface ShoppingSectionContext {
  _id: string;
  name: string;
}

export interface TeamMember {
  name?: string | null;
  email?: string | null;
  clerkUserId?: string;
}

export interface AITokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUSD: number;
}

export interface PendingItem {
  type:
    | "task"
    | "note"
    | "payment"
    | "shopping"
    | "survey"
    | "contact"
    | "shoppingSection"
  | "labor"
  | "laborSection"
  | "projectSettings";
  operation?: "create" | "edit" | "delete" | "bulk_edit" | "bulk_create";
  data: Record<string, unknown>;
  updates?: Record<string, unknown>;
  originalItem?: unknown;
  functionCall?: {
    callId: string;
    functionName: string;
    arguments: string;
  };
  responseId?: string;
}
