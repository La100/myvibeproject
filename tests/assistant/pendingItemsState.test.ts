import assert from "node:assert/strict";
import test from "node:test";

import {
  findPendingItemIndex,
  isResolvedPendingItem,
  normalizePendingLookupId,
} from "../../components/ai/assistant/data/hooks/pendingItemsState.ts";
import type { PendingItem } from "../../components/ai/assistant/data/types";

const makePendingItem = (
  overrides: Partial<PendingItem> = {},
): PendingItem => ({
  type: "task",
  operation: "create",
  data: { title: "Example" },
  status: undefined,
  clientId: "pending:task:create:1",
  functionCall: {
    callId: "call_1",
    functionName: "create_item",
    arguments: "{}",
  },
  responseId: "resp_1",
  ...overrides,
});

test("normalizePendingLookupId strips derived bulk suffix", () => {
  assert.equal(
    normalizePendingLookupId("pending:task:create:1::2"),
    "pending:task:create:1",
  );
});

test("findPendingItemIndex resolves derived bulk client ids back to source item", () => {
  const items = [makePendingItem()];

  assert.equal(findPendingItemIndex(items, "pending:task:create:1::2"), 0);
});

test("findPendingItemIndex falls back to function call id lookup", () => {
  const items = [
    makePendingItem({
      clientId: "pending:task:create:99",
      functionCall: {
        callId: "call_bulk",
        functionName: "create_multiple_items",
        arguments: "{}",
      },
    }),
  ];

  assert.equal(findPendingItemIndex(items, "call_bulk"), 0);
});

test("isResolvedPendingItem only treats confirmed and rejected items as resolved", () => {
  assert.equal(isResolvedPendingItem(makePendingItem({ status: "confirmed" })), true);
  assert.equal(isResolvedPendingItem(makePendingItem({ status: "rejected" })), true);
  assert.equal(isResolvedPendingItem(makePendingItem({ status: undefined })), false);
});
