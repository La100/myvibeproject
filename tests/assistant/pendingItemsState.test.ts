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
    functionName: "manage_tasks",
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
        functionName: "manage_tasks",
        arguments: "{}",
      },
    }),
  ];

  assert.equal(findPendingItemIndex(items, "call_bulk"), 0);
});

test("findPendingItemIndex returns -1 for invalid numeric and empty string lookups", () => {
  const items = [makePendingItem()];

  assert.equal(findPendingItemIndex(items, -1), -1);
  assert.equal(findPendingItemIndex(items, 5), -1);
  assert.equal(findPendingItemIndex(items, ""), -1);
});

test("findPendingItemIndex prefers clientId before function call id", () => {
  const items = [
    makePendingItem({
      clientId: "shared_id",
      functionCall: {
        callId: "call_first",
        functionName: "manage_tasks",
        arguments: "{}",
      },
    }),
    makePendingItem({
      clientId: "other_id",
      functionCall: {
        callId: "shared_id",
        functionName: "manage_tasks",
        arguments: "{}",
      },
    }),
  ];

  assert.equal(findPendingItemIndex(items, "shared_id"), 0);
});

test("normalizePendingLookupId leaves plain ids unchanged", () => {
  assert.equal(normalizePendingLookupId("call_123"), "call_123");
});

test("isResolvedPendingItem treats confirmed, rejected, and superseded items as resolved", () => {
  assert.equal(isResolvedPendingItem(makePendingItem({ status: "confirmed" })), true);
  assert.equal(isResolvedPendingItem(makePendingItem({ status: "rejected" })), true);
  assert.equal(isResolvedPendingItem(makePendingItem({ status: "superseded" })), true);
  assert.equal(isResolvedPendingItem(makePendingItem({ status: undefined })), false);
});
