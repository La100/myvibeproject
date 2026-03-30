import type { PendingContentItem } from "@/components/ai/assistant/data/types";

export type InlineConfirmationScope = {
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
  return {
    items: matchedByCallId,
    suppressToolFallback: false,
  };
}
