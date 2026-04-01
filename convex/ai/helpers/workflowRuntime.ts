import { getActiveRuntimeToolNames } from "../tools.ts";
import { createWorkflowContextSection } from "./workflowContextBuilder.ts";
import { getWorkflowStep } from "../workflows/loader.ts";

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
  crudApprovalMode: "always_ask" | "auto_confirm" = "auto_confirm",
): {
  workflowSection: string | null;
  allowedToolNames: string[];
} {
  if (!workflowContext) {
    return {
      workflowSection: null,
      allowedToolNames: getActiveRuntimeToolNames(undefined, crudApprovalMode),
    };
  }

  if (crudApprovalMode !== "auto_confirm") {
    const step = getWorkflowStep(workflowContext.workflowId, workflowContext.stepId);
    return {
      workflowSection: step
        ? createWorkflowContextSection(
            workflowContext.workflowId,
            workflowContext.stepId,
            toPreviousResponsesRecord(workflowContext.previousResponses),
            hasUploadedFile,
          )
        : null,
      allowedToolNames: getActiveRuntimeToolNames(undefined, "always_ask"),
    };
  }

  const step = getWorkflowStep(workflowContext.workflowId, workflowContext.stepId);
  if (!step) {
    return {
      workflowSection: null,
      allowedToolNames: getActiveRuntimeToolNames(undefined, crudApprovalMode),
    };
  }

  return {
    workflowSection: createWorkflowContextSection(
      workflowContext.workflowId,
      workflowContext.stepId,
      toPreviousResponsesRecord(workflowContext.previousResponses),
      hasUploadedFile,
    ),
    allowedToolNames: getActiveRuntimeToolNames(
      step.enabledTools,
      crudApprovalMode,
    ),
  };
}
