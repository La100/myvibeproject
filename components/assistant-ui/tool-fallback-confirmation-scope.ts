import type { PendingContentItem } from "@/components/ai/assistant/data/types";

type InlineConfirmationScope = {
  items: PendingContentItem[];
  suppressToolFallback: boolean;
};

export function getInlineConfirmationScope(
  pendingItems: readonly PendingContentItem[] | undefined,
  toolCallId: string | undefined,
): InlineConfirmationScope {
  if (!toolCallId || !pendingItems || pendingItems.length === 0) {
    return { items: [], suppressToolFallback: false };
  }

  const matchedByCallId = pendingItems.filter(
    (item) => item.functionCall?.callId === toolCallId,
  );
  if (matchedByCallId.length === 0) {
    return { items: [], suppressToolFallback: false };
  }

  const responseId = matchedByCallId[0]?.responseId;
  if (!responseId) {
    return { items: matchedByCallId, suppressToolFallback: false };
  }

  const responseScopedItems = pendingItems.filter(
    (item) => item.responseId === responseId,
  );
  const primaryToolCallId = responseScopedItems.find(
    (item) => item.functionCall?.callId,
  )?.functionCall?.callId;

  if (!primaryToolCallId || primaryToolCallId === toolCallId) {
    return { items: responseScopedItems, suppressToolFallback: false };
  }

  return { items: [], suppressToolFallback: true };
}
