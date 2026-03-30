/**
 * Workflow Context Builder
 * 
 * Builds AI context for workflow execution, integrating:
 * - Current workflow step prompt
 * - Previous step responses
 * - File context (if uploaded)
 * - Workflow-specific instructions
 */

import type { WorkflowAIContext, WorkflowSession, WorkflowDefinition, WorkflowStep } from "../workflows/types";
import { getWorkflow, getWorkflowStep } from "../workflows/loader";

/**
 * Build the system prompt section for a workflow step
 */
export function buildWorkflowSystemPrompt(
  workflow: WorkflowDefinition,
  currentStep: WorkflowStep,
  previousResponses: Record<string, string>
): string {
  const parts: string[] = [];

  // Workflow header
  parts.push(`## 🔧 ACTIVE WORKFLOW: ${workflow.name}`);
  parts.push("");
  parts.push(`**Description**: ${workflow.description}`);
  parts.push("");

  // Current step info
  parts.push(`### Current step: ${currentStep.name}`);
  if (currentStep.description) {
    parts.push(`*${currentStep.description}*`);
  }
  parts.push("");

  // Previous responses context (if any)
  if (Object.keys(previousResponses).length > 0) {
    parts.push("### Previous steps:");
    for (const [stepId, response] of Object.entries(previousResponses)) {
      const step = workflow.steps.find((s) => s.id === stepId);
      if (step) {
        parts.push(`**${step.name}**:`);
        // Truncate long responses
        const truncatedResponse = response.length > 500 
          ? response.substring(0, 500) + "..." 
          : response;
        parts.push(truncatedResponse);
        parts.push("");
      }
    }
  }

  // Step-specific instructions
  if (currentStep.prompt) {
    parts.push("### Instructions for this step:");
    parts.push(currentStep.prompt);
    parts.push("");
  }

  // Enabled tools guidance
  if (currentStep.enabledTools && currentStep.enabledTools.length > 0) {
    parts.push("### Preferred tools for this step:");
    parts.push(currentStep.enabledTools.map((t) => `- \`${t}\``).join("\n"));
    parts.push("");
    parts.push("*Stay within the tools above for this workflow step whenever runtime allows it.*");
  }

  // Workflow help content
  if (workflow.content) {
    parts.push("");
    parts.push("### Additional workflow information:");
    parts.push(workflow.content);
  }

  return parts.join("\n");
}

/**
 * Build full AI context for workflow execution
 */
export function buildWorkflowAIContext(session: WorkflowSession): WorkflowAIContext | null {
  const { workflow, currentStepIndex, stepResponses } = session;
  
  if (currentStepIndex >= workflow.steps.length) {
    return null; // Workflow completed
  }

  const currentStep = workflow.steps[currentStepIndex];
  
  return {
    workflowId: workflow.id,
    stepId: currentStep.id,
    stepPrompt: currentStep.prompt || "",
    workflowInstructions: buildWorkflowSystemPrompt(workflow, currentStep, stepResponses),
    previousResponses: stepResponses,
    hasFiles: session.uploadedFileIds.length > 0,
  };
}

/**
 * Create the workflow context section to inject into the main system prompt
 */
export function createWorkflowContextSection(
  workflowId: string,
  stepId: string,
  previousResponses: Record<string, string> = {},
  hasUploadedFile: boolean = false
): string | null {
  const workflow = getWorkflow(workflowId);
  if (!workflow) return null;

  const currentStep = getWorkflowStep(workflowId, stepId);
  if (!currentStep) return null;

  const parts: string[] = [];

  // Workflow mode indicator
  parts.push("=".repeat(60));
  parts.push("WORKFLOW MODE - GUIDED FLOW");
  parts.push("=".repeat(60));
  parts.push("");

  // Core workflow prompt
  parts.push(buildWorkflowSystemPrompt(workflow, currentStep, previousResponses));

  // File upload reminder
  if (hasUploadedFile) {
    parts.push("");
    parts.push("📎 **FILE UPLOADED**: The user uploaded a file. Analyze it in the context of this workflow step.");
  } else if (currentStep.requiresUpload) {
    parts.push("");
    parts.push("⚠️ **WAITING FOR FILE**: This step requires a file upload. Ask the user to upload the required file.");
  }

  // Step navigation info
  const stepIndex = workflow.steps.findIndex((s) => s.id === stepId);
  const totalSteps = workflow.steps.length;
  parts.push("");
  parts.push(`📍 Step ${stepIndex + 1} of ${totalSteps}`);

  if (stepIndex < totalSteps - 1) {
    const nextStep = workflow.steps[stepIndex + 1];
    parts.push(`➡️ Next step: ${nextStep.name}`);
  } else {
    parts.push("✅ This is the final workflow step.");
  }

  parts.push("");
  parts.push("=".repeat(60));

  return parts.join("\n");
}

/**
 * Get the initial message for a workflow step (shown to user)
 */
export function getStepInitialMessage(workflowId: string, stepId: string): string {
  const workflow = getWorkflow(workflowId);
  const step = getWorkflowStep(workflowId, stepId);

  if (!workflow || !step) {
    return "Starting workflow...";
  }

  if (step.requiresUpload && !step.prompt) {
    return `**${step.name}**\n\n${step.description || "Upload a file to continue."}\n\nClick the attachment button to add a file.`;
  }

  return `**${step.name}**\n\n${step.description || ""}`;
}

/**
 * Validate if a step can be executed
 */
export function canExecuteStep(
  workflowId: string,
  stepId: string,
  hasUploadedFile: boolean
): { canExecute: boolean; reason?: string } {
  const step = getWorkflowStep(workflowId, stepId);

  if (!step) {
    return { canExecute: false, reason: "Workflow step not found." };
  }

  if (step.requiresUpload && !hasUploadedFile) {
    return { canExecute: false, reason: "This step requires a file upload." };
  }

  if (!step.prompt && !step.requiresUpload) {
    return { canExecute: false, reason: "This step does not have a defined task." };
  }

  return { canExecute: true };
}

/**
 * Get progress percentage for a workflow
 */
export function getWorkflowProgress(workflowId: string, completedStepIds: string[]): number {
  const workflow = getWorkflow(workflowId);
  if (!workflow) return 0;

  const completedCount = completedStepIds.filter((id) =>
    workflow.steps.some((s) => s.id === id)
  ).length;

  return Math.round((completedCount / workflow.steps.length) * 100);
}

/**
 * Check if workflow is complete
 */
export function isWorkflowComplete(workflowId: string, completedStepIds: string[]): boolean {
  const workflow = getWorkflow(workflowId);
  if (!workflow) return false;

  return workflow.steps.every((step) => completedStepIds.includes(step.id));
}
