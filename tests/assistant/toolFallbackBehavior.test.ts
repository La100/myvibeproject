import assert from "node:assert/strict";
import test from "node:test";

import type { PendingContentItem } from "../../components/ai/assistant/data/types";
import {
  resolveInlineConfirmationItems,
  toPendingItemsFromResult,
} from "../../components/assistant-ui/tool-fallback-helpers.ts";
import type { InlineConfirmationScope } from "../../components/assistant-ui/tool-fallback-confirmation-scope";

const makePendingItem = (
  overrides: Partial<PendingContentItem> = {},
): PendingContentItem => ({
  type: "task",
  operation: "create",
  data: { title: "Example" },
  functionCall: {
    callId: "call_1",
    functionName: "create_item",
    arguments: "{}",
  },
  ...overrides,
});

test("toPendingItemsFromResult preserves bulk labor item type", () => {
  const items = toPendingItemsFromResult(
    "call_labor",
    JSON.stringify({
      type: "labor",
      operation: "bulk_create",
      data: {
        items: [{ name: "Malowanie", quantity: 2 }],
      },
    }),
  );

  assert.equal(items.length, 1);
  assert.equal(items[0]?.type, "labor");
  assert.equal(items[0]?.operation, "create");
  assert.equal(items[0]?.functionCall?.callId, "call_labor");
});

test("resolveInlineConfirmationItems keeps fallback items when other calls are already pending", () => {
  const fallbackItems = [
    makePendingItem({
      type: "contact",
      functionCall: {
        callId: "call_current",
        functionName: "create_item",
        arguments: "{}",
      },
    }),
  ];
  const matchedPendingItemsByCallId: PendingContentItem[] = [];
  const inlineConfirmationScope: InlineConfirmationScope = {
    items: [],
    suppressToolFallback: false,
  };

  const resolved = resolveInlineConfirmationItems({
    inlineConfirmationScope,
    matchedPendingItemsByCallId,
    fallbackPendingItems: fallbackItems,
  });

  assert.equal(resolved.length, 1);
  assert.equal(resolved[0]?.functionCall?.callId, "call_current");
  assert.equal(resolved[0]?.type, "contact");
});
