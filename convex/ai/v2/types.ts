export const ASSISTANT_V2_GROUP_STATUSES = [
  "running",
  "awaiting_confirmation",
  "completed",
  "failed",
  "aborted",
] as const;

export type AssistantV2GroupStatus =
  (typeof ASSISTANT_V2_GROUP_STATUSES)[number];

export const ASSISTANT_V2_CONFIRMATION_POLICIES = [
  "none",
  "group",
  "item",
] as const;

export type AssistantV2ConfirmationPolicy =
  (typeof ASSISTANT_V2_CONFIRMATION_POLICIES)[number];

export const ASSISTANT_V2_EVENT_TYPES = [
  "turn.started",
  "message.user",
  "message.assistant.delta",
  "message.assistant.completed",
  "reasoning.summary.delta",
  "reasoning.summary.completed",
  "tool.called",
  "tool.output.delta",
  "tool.awaiting_confirmation",
  "tool.confirmed",
  "tool.rejected",
  "tool.completed",
  "tool.failed",
  "turn.awaiting_confirmation",
  "turn.completed",
  "turn.failed",
  "turn.aborted",
] as const;

export type AssistantV2EventType =
  (typeof ASSISTANT_V2_EVENT_TYPES)[number];

export const ASSISTANT_V2_TOOL_KINDS = [
  "read",
  "write",
  "shell",
  "computer",
  "external",
] as const;

export type AssistantV2ToolKind =
  (typeof ASSISTANT_V2_TOOL_KINDS)[number];

export const ASSISTANT_V2_TOOL_STATUSES = [
  "called",
  "running",
  "awaiting_confirmation",
  "confirmed",
  "rejected",
  "completed",
  "failed",
  "cancelled",
] as const;

export type AssistantV2ToolStatus =
  (typeof ASSISTANT_V2_TOOL_STATUSES)[number];

export const ASSISTANT_V2_ENABLED_TOOLS = [
  "app",
  "web_search",
  "shell",
  "computer",
  "mcp",
  "files",
] as const;

export type AssistantV2EnabledTool =
  (typeof ASSISTANT_V2_ENABLED_TOOLS)[number];

export const ASSISTANT_V2_FEATURE_FLAGS = [
  "responses_api",
  "reasoning_summary",
  "group_confirmation",
  "shell",
  "computer_use",
  "event_replay",
] as const;

export type AssistantV2FeatureFlag =
  (typeof ASSISTANT_V2_FEATURE_FLAGS)[number];

export function isAssistantV2TerminalGroupStatus(
  status: AssistantV2GroupStatus,
) {
  return status === "completed" || status === "failed" || status === "aborted";
}
