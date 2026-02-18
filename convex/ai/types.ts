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
  status: "planning" | "active" | "on_hold" | "completed" | "cancelled";
  startDate?: number;
  endDate?: number;
  customer?: string;
  location?: string;
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
  quantity: number;
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
  targetAudience: "all_customers" | "specific_customers" | "team_members";
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
  type: "task" | "note" | "shopping" | "survey" | "contact" | "shoppingSection";
  operation?: "create" | "edit" | "delete" | "bulk_edit" | "bulk_create";
  data: any;
  updates?: any;
  originalItem?: any;
  functionCall?: {
    callId: string;
    functionName: string;
    arguments: string;
  };
  responseId?: string;
}
