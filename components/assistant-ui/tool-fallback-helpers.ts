import type { PendingContentItem } from "@/components/ai/assistant/data/types";
import { toPendingItemsFromToolResult } from "../ai/assistant/data/utils/toolResultPendingItems.ts";
import type { InlineConfirmationScope } from "@/components/assistant-ui/tool-fallback-confirmation-scope";

export function toPendingItemsFromResult(
  toolCallId: string,
  result: unknown,
): PendingContentItem[] {
  return toPendingItemsFromToolResult(toolCallId, result);
}

export function resolveInlineConfirmationItems({
  inlineConfirmationScope,
  matchedPendingItemsByCallId,
  fallbackPendingItems,
}: {
  inlineConfirmationScope: InlineConfirmationScope;
  matchedPendingItemsByCallId: PendingContentItem[];
  fallbackPendingItems: PendingContentItem[];
}): PendingContentItem[] {
  if (inlineConfirmationScope.items.length > 0) {
    return inlineConfirmationScope.items;
  }
  if (inlineConfirmationScope.suppressToolFallback) {
    return [];
  }
  if (matchedPendingItemsByCallId.length > 0) {
    return matchedPendingItemsByCallId;
  }
  return fallbackPendingItems;
}
