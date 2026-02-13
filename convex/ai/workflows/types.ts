/**
 * Workflow Types for Myvibe project Renovation Workflows
 * 
 * Defines the structure for guided multi-step workflows loaded from .md files.
 */

/**
 * Supported file types for workflow uploads
 */
export type WorkflowFileType = "image" | "pdf" | "document" | "any";

/**
 * Icons available for workflows
 */
export type WorkflowIcon = 
  | "floor-plan" 
  | "kitchen" 
  | "bathroom" 
  | "materials" 
  | "visualization"
  | "calendar"
  | "checklist"
  | "tools"
  | "paint"
  | "furniture";

/**
 * A single step within a workflow
 */
export interface WorkflowStep {
  /** Unique identifier for the step */
  id: string;
  /** Display name for the step */
  name: string;
  /** AI prompt to execute for this step (null for upload-only steps) */
  prompt: string | null;
  /** Whether this step requires file upload */
  requiresUpload?: boolean;
  /** Optional description shown to user */
  description?: string;
  /** Tools that should be enabled for this step */
  enabledTools?: string[];
  /** Whether to auto-advance after AI response */
  autoAdvance?: boolean;
}

/**
 * Complete workflow definition parsed from .md file
 */
export interface WorkflowDefinition {
  /** Unique identifier matching filename (without .md) */
  id: string;
  /** Display name for the workflow */
  name: string;
  /** Short description shown in selector */
  description: string;
  /** Icon identifier for UI */
  icon: WorkflowIcon;
  /** File types accepted by this workflow */
  requiredFileTypes: WorkflowFileType[];
  /** Whether file upload is mandatory to start */
  fileRequired: boolean;
  /** Ordered list of workflow steps */
  steps: WorkflowStep[];
  /** Full markdown content (after frontmatter) for help/info display */
  content: string;
  /** Category for grouping workflows */
  category?: "renovation" | "design" | "planning" | "analysis";
  /** Estimated time to complete in minutes */
  estimatedMinutes?: number;
}

/**
 * Runtime state for an active workflow session
 */
export interface WorkflowSession {
  /** Workflow definition being executed */
  workflow: WorkflowDefinition;
  /** Current step index (0-based) */
  currentStepIndex: number;
  /** ID of uploaded file(s) for this session */
  uploadedFileIds: string[];
  /** Responses collected per step */
  stepResponses: Record<string, string>;
  /** Thread ID for the chat session */
  threadId: string;
  /** Timestamp when session started */
  startedAt: number;
  /** Whether workflow is completed */
  isCompleted: boolean;
}

/**
 * Workflow metadata for selector UI (lighter than full definition)
 */
export interface WorkflowMetadata {
  id: string;
  name: string;
  description: string;
  icon: WorkflowIcon;
  category?: string;
  stepCount: number;
  estimatedMinutes?: number;
  requiredFileTypes: WorkflowFileType[];
}

/**
 * Result of parsing a workflow .md file
 */
export interface ParsedWorkflow {
  /** Parsed frontmatter data */
  frontmatter: Omit<WorkflowDefinition, "content">;
  /** Markdown content after frontmatter */
  content: string;
}

/**
 * Context passed to AI for workflow execution
 */
export interface WorkflowAIContext {
  /** Current workflow being executed */
  workflowId: string;
  /** Current step being executed */
  stepId: string;
  /** Step-specific prompt */
  stepPrompt: string;
  /** Full workflow context/instructions from .md content */
  workflowInstructions: string;
  /** Previous step responses for context */
  previousResponses: Record<string, string>;
  /** Whether files are attached */
  hasFiles: boolean;
}



