export const assistantToolNames = [
  "create_item",
  "create_multiple_items",
  "update_item",
  "update_multiple_items",
  "delete_item",
  "search_items",
  "update_project_settings",
  "load_full_project_context",
  "generate_moodboard_image",
] as const;

export type AssistantToolName = (typeof assistantToolNames)[number];
export type AssistantToolApprovalMode = "read-only" | "requires-confirmation";

export type AssistantToolPayload = {
  type?: unknown;
  operation?: unknown;
  error?: unknown;
};

type ToolApprovalContext = {
  autoConfirmCrud?: boolean;
};

type ToolMetadata = {
  readOnly: boolean;
  promptSummary: string;
  approvalMode: AssistantToolApprovalMode;
  shouldPersistPending: (
    payload: AssistantToolPayload | null,
    context?: ToolApprovalContext,
  ) => boolean;
  defaults?: {
    type?: string;
    operation?: "create" | "bulk_create" | "edit" | "bulk_edit" | "delete";
  };
};

const assistantToolMetadata: Record<AssistantToolName, ToolMetadata> = {
  create_item: {
    readOnly: false,
    promptSummary: "Create one project item.",
    approvalMode: "requires-confirmation",
    defaults: { operation: "create" },
    shouldPersistPending: () => true,
  },
  create_multiple_items: {
    readOnly: false,
    promptSummary: "Create multiple project items of the same type.",
    approvalMode: "requires-confirmation",
    defaults: { operation: "bulk_create" },
    shouldPersistPending: () => true,
  },
  update_item: {
    readOnly: false,
    promptSummary: "Update one existing project item.",
    approvalMode: "requires-confirmation",
    defaults: { operation: "edit" },
    shouldPersistPending: () => true,
  },
  update_multiple_items: {
    readOnly: false,
    promptSummary: "Update multiple existing project items of the same type.",
    approvalMode: "requires-confirmation",
    defaults: { operation: "bulk_edit" },
    shouldPersistPending: () => true,
  },
  delete_item: {
    readOnly: false,
    promptSummary: "Delete one project item.",
    approvalMode: "requires-confirmation",
    defaults: { operation: "delete" },
    shouldPersistPending: () => true,
  },
  search_items: {
    readOnly: true,
    promptSummary: "Search existing tasks, notes, shopping, labor, surveys, or contacts.",
    approvalMode: "read-only",
    shouldPersistPending: () => false,
  },
  update_project_settings: {
    readOnly: false,
    promptSummary: "Update project-level settings such as name, status, budget, or currency.",
    approvalMode: "requires-confirmation",
    defaults: { type: "projectSettings", operation: "edit" },
    shouldPersistPending: () => true,
  },
  load_full_project_context: {
    readOnly: true,
    promptSummary: "Load a broad project snapshot for summaries or audits.",
    approvalMode: "read-only",
    shouldPersistPending: () => false,
  },
  generate_moodboard_image: {
    readOnly: false,
    promptSummary: "Generate and save a moodboard image to the project.",
    approvalMode: "requires-confirmation",
    shouldPersistPending: () => false,
  },
};

export function isAssistantToolName(value: string): value is AssistantToolName {
  return Object.prototype.hasOwnProperty.call(assistantToolMetadata, value);
}

export function getAssistantToolMetadata(
  toolName: AssistantToolName,
): ToolMetadata {
  return assistantToolMetadata[toolName];
}

export function getAssistantToolDefaults(toolName: string) {
  return isAssistantToolName(toolName)
    ? assistantToolMetadata[toolName].defaults
    : undefined;
}

export function isReadOnlyAssistantTool(toolName: string): boolean {
  return isAssistantToolName(toolName)
    ? assistantToolMetadata[toolName].readOnly
    : false;
}

export function getAssistantToolApprovalMode(
  toolName: string,
): AssistantToolApprovalMode | undefined {
  return isAssistantToolName(toolName)
    ? assistantToolMetadata[toolName].approvalMode
    : undefined;
}

export function shouldPersistPendingToolCall(
  toolName: string,
  payload: AssistantToolPayload | null,
  context?: ToolApprovalContext,
): boolean {
  if (!isAssistantToolName(toolName)) return false;
  if (payload && typeof payload.error === "string") return false;
  return assistantToolMetadata[toolName].shouldPersistPending(payload, context);
}

export function buildToolPromptList(
  activeToolNames?: readonly string[],
): string[] {
  const allowed = activeToolNames
    ? new Set(activeToolNames.filter(isAssistantToolName))
    : null;

  return assistantToolNames
    .filter((toolName) => !allowed || allowed.has(toolName))
    .map(
      (toolName) =>
        `- ${toolName}: ${assistantToolMetadata[toolName].promptSummary} [${assistantToolMetadata[toolName].approvalMode}]`,
    );
}

export function buildToolExecutionPolicy(
  activeToolNames?: readonly string[],
): string[] {
  const allowed = activeToolNames
    ? new Set(activeToolNames.filter(isAssistantToolName))
    : null;

  const activeTools = assistantToolNames.filter(
    (toolName) => !allowed || allowed.has(toolName),
  );
  const readOnlyTools = activeTools.filter(
    (toolName) => assistantToolMetadata[toolName].approvalMode === "read-only",
  );
  const mutatingTools = activeTools.filter(
    (toolName) =>
      assistantToolMetadata[toolName].approvalMode === "requires-confirmation",
  );

  return [
    readOnlyTools.length > 0
      ? `- Read-only tools execute immediately: ${readOnlyTools.join(", ")}.`
      : "- No read-only tools are active in this runtime.",
    mutatingTools.length > 0
      ? `- Mutating tools create drafts that require UI confirmation before persistence: ${mutatingTools.join(", ")}.`
      : "- No mutating tools are active in this runtime.",
  ];
}
