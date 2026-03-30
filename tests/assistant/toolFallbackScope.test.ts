import assert from "node:assert/strict";
import test from "node:test";

import { getInlineConfirmationScope } from "../../components/assistant-ui/tool-fallback-confirmation-scope.ts";
import type { PendingContentItem } from "../../components/ai/assistant/data/types";

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
  responseId: "resp_1",
  ...overrides,
});

test("getInlineConfirmationScope returns only items for the current tool call", () => {
  const scope = getInlineConfirmationScope(
    [
      makePendingItem({
        functionCall: { callId: "call_1", functionName: "create_item", arguments: "{}" },
      }),
      makePendingItem({
        type: "shopping",
        functionCall: { callId: "call_2", functionName: "create_item", arguments: "{}" },
      }),
    ],
    "call_1",
  );

  assert.equal(scope.items.length, 1);
  assert.equal(scope.items[0]?.functionCall?.callId, "call_1");
  assert.equal(scope.suppressToolFallback, false);
});
