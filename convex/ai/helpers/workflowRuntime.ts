import { getActiveRuntimeToolNames } from "../tools";
import { createWorkflowContextSection } from "./workflowContextBuilder";
import { getWorkflowStep } from "../workflows/loader";

export type WorkflowResponseEntry = {
  stepId: string;
  response: string;
};

export type ThreadWorkflowContext = {
  workflowId: string;
  stepId: string;
  previousResponses?: WorkflowResponseEntry[];
};

function toPreviousResponsesRecord(
  previousResponses?: WorkflowResponseEntry[],
): Record<string, string> {
  if (!previousResponses || previousResponses.length === 0) {
    return {};
  }

  return previousResponses.reduce<Record<string, string>>((acc, entry) => {
    const stepId = entry.stepId.trim();
    const response = entry.response.trim();
    if (!stepId || !response) {
      return acc;
    }
    acc[stepId] = response;
    return acc;
  }, {});
}

export function buildWorkflowRuntimeContext(
  workflowContext?: ThreadWorkflowContext | null,
  hasUploadedFile: boolean = false,
): {
  workflowSection: string | null;
  allowedToolNames: string[];
} {
  if (!workflowContext) {
    return {
      workflowSection: null,
      allowedToolNames: getActiveRuntimeToolNames(),
    };
  }

  const step = getWorkflowStep(workflowContext.workflowId, workflowContext.stepId);
  if (!step) {
    return {
      workflowSection: null,
      allowedToolNames: getActiveRuntimeToolNames(),
    };
  }

  return {
    workflowSection: createWorkflowContextSection(
      workflowContext.workflowId,
      workflowContext.stepId,
      toPreviousResponsesRecord(workflowContext.previousResponses),
      hasUploadedFile,
    ),
    allowedToolNames: getActiveRuntimeToolNames(step.enabledTools),
  };
}
