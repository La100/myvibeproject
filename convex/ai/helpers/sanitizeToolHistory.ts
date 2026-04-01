import type { ModelMessage } from "ai";

export function sanitizeIncompleteToolHistory(messages: ModelMessage[]): ModelMessage[] {
  const approvalToCallId = new Map<string, string>();
  const resolvedCallIds = new Set<string>();

  for (const message of messages) {
    if (!Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (part.type === "tool-result" && typeof part.toolCallId === "string") {
        resolvedCallIds.add(part.toolCallId);
        continue;
      }
      if (
        part.type === "tool-approval-request" &&
        typeof part.approvalId === "string" &&
        typeof part.toolCallId === "string"
      ) {
        approvalToCallId.set(part.approvalId, part.toolCallId);
        continue;
      }
      if (
        part.type === "tool-approval-response" &&
        typeof part.approvalId === "string"
      ) {
        const toolCallId = approvalToCallId.get(part.approvalId);
        if (toolCallId) {
          resolvedCallIds.add(toolCallId);
        }
      }
    }
  }

  const sanitized: ModelMessage[] = [];

  for (const message of messages) {
    if (!Array.isArray(message.content)) {
      sanitized.push(message);
      continue;
    }

    const filteredContent = message.content.filter((part) => {
      if (
        part.type === "tool-approval-response" &&
        typeof part.approvalId === "string" &&
        !approvalToCallId.has(part.approvalId)
      ) {
        return false;
      }
      return true;
    });

    if (message.role !== "assistant") {
      sanitized.push(
        {
          ...message,
          content: filteredContent,
        } as unknown as ModelMessage,
      );
      continue;
    }

    const toolCalls = filteredContent.filter(
      (part): part is Extract<typeof part, { type: "tool-call" }> =>
        part.type === "tool-call" && typeof part.toolCallId === "string",
    );

    if (toolCalls.length === 0) {
      sanitized.push(
        {
          ...message,
          content: filteredContent,
        } as unknown as ModelMessage,
      );
      continue;
    }

    const hasUnresolvedCall = toolCalls.some(
      (part) => !resolvedCallIds.has(part.toolCallId),
    );

    if (!hasUnresolvedCall) {
      sanitized.push(
        {
          ...message,
          content: filteredContent,
        } as unknown as ModelMessage,
      );
      continue;
    }

    const remainingParts = filteredContent.filter((part) => part.type === "text");
    if (remainingParts.length === 0) {
      continue;
    }

    sanitized.push(
      {
        ...message,
        content: remainingParts,
      } as unknown as ModelMessage,
    );
  }

  return sanitized;
}
