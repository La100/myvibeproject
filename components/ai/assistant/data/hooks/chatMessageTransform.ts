import type { useUIMessages } from "@convex-dev/agent/react";

export type UIMessagesResult = ReturnType<typeof useUIMessages>["results"];
type UIMessageItem = NonNullable<UIMessagesResult>[number];
type MessagePart = NonNullable<UIMessageItem["parts"]>[number];
type ToolResultPart = MessagePart & { result?: string };
type ToolCallishPart = MessagePart & {
  toolCallId?: string;
  callId?: string;
  id?: string;
  toolName?: string;
  name?: string;
};

export type PersistentCall = {
  callId: string;
  status?: string;
  result?: string;
  arguments: string;
};

const parseJson = <T>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const areJsonValuesEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => areJsonValuesEqual(item, b[index]));
  }

  if (
    typeof a === "object" &&
    a !== null &&
    typeof b === "object" &&
    b !== null &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const aKeys = Object.keys(aRecord);
    const bKeys = Object.keys(bRecord);

    if (aKeys.length !== bKeys.length) return false;

    return aKeys.every(
      (key) => key in bRecord && areJsonValuesEqual(aRecord[key], bRecord[key]),
    );
  }

  return false;
};

const stripThinking = (text: string) => {
  if (!text.includes("<thinking>")) return text;
  const withoutBlocks = text.replace(/<thinking>[\s\S]*?<\/thinking>/g, "");
  const withoutOpen = withoutBlocks.replace(/<thinking>[\s\S]*$/g, "");
  return withoutOpen.replace(/<\/thinking>/g, "");
};

const getToolCallId = (part: ToolCallishPart) =>
  part.toolCallId || part.callId || part.id;

const isToolCallPart = (part: MessagePart) => {
  const toolPart = part as ToolCallishPart;
  const hasCallId =
    "toolCallId" in toolPart || "callId" in toolPart || "id" in toolPart;
  const isToolType =
    typeof part.type === "string" && part.type.startsWith("tool-");
  return (isToolType || hasCallId) && !part.type.startsWith("tool-result");
};

const normalizeTextPart = (part: MessagePart): MessagePart | null => {
  if (
    part.type !== "text" ||
    typeof (part as { text?: unknown }).text !== "string"
  ) {
    return part;
  }

  const rawText = (part as { text: string }).text;
  const cleanedText = stripThinking(rawText).trimEnd();
  if (!cleanedText) return null;
  if (cleanedText === rawText) return part;

  return {
    ...part,
    text: cleanedText,
  } as MessagePart;
};

const sanitizeMessageText = (msg: UIMessageItem): UIMessageItem => {
  if (msg.parts) return msg;
  if (typeof (msg as { text?: unknown }).text !== "string") return msg;

  const rawText = (msg as { text: string }).text;
  const cleanedText = stripThinking(rawText).trimEnd();
  if (cleanedText === rawText) return msg;
  return { ...msg, text: cleanedText };
};

export const mergePersistentCallState = (
  rawUiMessages: UIMessagesResult | undefined,
  persistentCalls: readonly PersistentCall[] | undefined,
): UIMessagesResult | undefined => {
  if (!rawUiMessages) return undefined;
  if (!persistentCalls) {
    return rawUiMessages.map((msg) => sanitizeMessageText(msg));
  }

  const callMap = new Map<string, PersistentCall>(
    persistentCalls.map((call) => [call.callId, call]),
  );

  return rawUiMessages
    .map((msg) => {
      if (!msg.parts) return sanitizeMessageText(msg);

      let hasUpdates = false;
      let parts = [...msg.parts];

      parts = parts.map((part) => {
        if (!part.type.startsWith("tool-result")) {
          return part;
        }

        const callId = part.type.replace("tool-result:", "");
        const persistentCall = callMap.get(callId);
        const partWithResult = part as ToolResultPart;
        if (!persistentCall?.status || !partWithResult.result) {
          if (!persistentCall?.arguments || !partWithResult.result) {
            return part;
          }

          const currentResult = parseJson<Record<string, unknown>>(
            partWithResult.result,
          );
          const nextArguments = parseJson<Record<string, unknown>>(
            persistentCall.arguments,
          );

          if (!currentResult || !nextArguments) {
            return part;
          }

          if (areJsonValuesEqual(currentResult, nextArguments)) {
            return part;
          }

          hasUpdates = true;
          return {
            ...part,
            result: JSON.stringify(nextArguments),
          } as MessagePart;
        }

        const currentResult = parseJson<Record<string, unknown>>(
          partWithResult.result,
        );
        const nextArguments = parseJson<Record<string, unknown>>(
          persistentCall.arguments,
        );
        if (!currentResult || !nextArguments) {
          return part;
        }

        const outcome = persistentCall.result
          ? parseJson<unknown>(persistentCall.result)
          : undefined;
        const nextResult = {
          ...nextArguments,
          status: persistentCall.status,
          outcome,
        };

        if (areJsonValuesEqual(currentResult, nextResult)) {
          return part;
        }

        hasUpdates = true;
        return {
          ...part,
          result: JSON.stringify(nextResult),
        } as MessagePart;
      });

      const toolCallParts = parts.filter((part) => isToolCallPart(part));
      for (const toolCallPart of toolCallParts) {
        const callish = toolCallPart as ToolCallishPart;
        const callId = getToolCallId(callish);
        if (!callId) continue;

        const persistentCall = callMap.get(callId);
        const hasResult = parts.some((part) => part.type === `tool-result:${callId}`);
        if (!persistentCall || hasResult || !persistentCall.arguments) {
          continue;
        }

        const parsedArguments = parseJson<Record<string, unknown>>(
          persistentCall.arguments,
        );
        if (!parsedArguments) continue;

        hasUpdates = true;
        const outcome = persistentCall.result
          ? parseJson<unknown>(persistentCall.result)
          : undefined;
        parts.push({
          type: `tool-result:${callId}`,
          toolCallId: callId,
          toolName: callish.toolName || callish.name,
          result: JSON.stringify({
            ...parsedArguments,
            status: persistentCall.status,
            outcome,
          }),
        } as MessagePart);
      }

      let partsChanged = false;
      const normalizedParts: MessagePart[] = [];
      for (const part of parts) {
        const normalizedPart = normalizeTextPart(part);
        if (!normalizedPart) {
          partsChanged = true;
          hasUpdates = true;
          continue;
        }

        if (normalizedPart !== part) {
          partsChanged = true;
          hasUpdates = true;
        }

        normalizedParts.push(normalizedPart);
      }

      if (!hasUpdates) return msg;

      if (!partsChanged) {
        return {
          ...msg,
          parts,
        };
      }

      const flattenedText = normalizedParts
        .filter(
          (part) =>
            part.type === "text" &&
            typeof (part as { text?: unknown }).text === "string",
        )
        .map((part) => (part as { text: string }).text)
        .join("");

      return {
        ...msg,
        parts: normalizedParts,
        text: flattenedText,
      };
    })
    .map((msg) => sanitizeMessageText(msg));
};

export const supersedeStaleApprovalMessages = (
  rawUiMessages: UIMessagesResult | undefined,
): UIMessagesResult | undefined => {
  if (!rawUiMessages) return undefined;

  const lastUserMessageIndex = [...rawUiMessages]
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => (message.role ?? "assistant") === "user")
    .at(-1)?.index;

  if (lastUserMessageIndex === undefined || lastUserMessageIndex <= 0) {
    return rawUiMessages.map((msg) => sanitizeMessageText(msg));
  }

  return rawUiMessages.map((msg, index) => {
    if (!msg.parts) return sanitizeMessageText(msg);
    if ((msg.role ?? "assistant") !== "assistant") return sanitizeMessageText(msg);
    if (index >= lastUserMessageIndex) return sanitizeMessageText(msg);

    const hasPendingApproval = msg.parts.some((part) => {
      const toolPart = part as ToolCallishPart & { state?: unknown };
      return (
        typeof toolPart.state === "string" &&
        toolPart.state === "approval-requested"
      );
    });

    if (!hasPendingApproval) {
      return sanitizeMessageText(msg);
    }

    const filteredParts = msg.parts.filter((part) => {
      const toolPart = part as ToolCallishPart & { state?: unknown };
      if (
        typeof toolPart.state === "string" &&
        toolPart.state === "approval-requested"
      ) {
        return false;
      }

      if (
        typeof part.type === "string" &&
        part.type.startsWith("tool-result:")
      ) {
        const resultPart = part as ToolResultPart;
        const parsedResult =
          typeof resultPart.result === "string"
            ? parseJson<Record<string, unknown>>(resultPart.result)
            : null;
        if (parsedResult?.approvalState === "approval-requested") {
          return false;
        }
      }

      return true;
    });

    if (filteredParts.length === msg.parts.length) {
      return sanitizeMessageText(msg);
    }

    const flattenedText = filteredParts
      .filter(
        (part) =>
          part.type === "text" &&
          typeof (part as { text?: unknown }).text === "string",
      )
      .map((part) => (part as { text: string }).text)
      .join("");

    return sanitizeMessageText({
      ...msg,
      parts: filteredParts,
      text: flattenedText,
    });
  });
};
