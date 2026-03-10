import assert from "node:assert/strict";
import test from "node:test";

import { getInlineConfirmationScope } from "../../components/assistant-ui/tool-fallback-confirmation-scope.ts";

test("groups mixed tool calls from the same response into one inline confirmation", () => {
  const pendingItems: any[] = [
    {
      clientId: "a",
      type: "shoppingSection",
      operation: "create",
      data: {},
      responseId: "resp-1",
      functionCall: { callId: "call-1", functionName: "create_item", arguments: "{}" },
    },
    {
      clientId: "b",
      type: "shopping",
      operation: "create",
      data: {},
      responseId: "resp-1",
      functionCall: { callId: "call-2", functionName: "create_item", arguments: "{}" },
    },
  ];

  const firstScope = getInlineConfirmationScope(pendingItems, "call-1");
  assert.equal(firstScope.items.length, 2);
  assert.equal(firstScope.suppressToolFallback, false);

  const secondScope = getInlineConfirmationScope(pendingItems, "call-2");
  assert.equal(secondScope.items.length, 0);
  assert.equal(secondScope.suppressToolFallback, true);
});

test("keeps separate responses in separate confirmation scopes", () => {
  const pendingItems: any[] = [
    {
      clientId: "a",
      type: "shoppingSection",
      operation: "create",
      data: {},
      responseId: "resp-1",
      functionCall: { callId: "call-1", functionName: "create_item", arguments: "{}" },
    },
    {
      clientId: "b",
      type: "shopping",
      operation: "create",
      data: {},
      responseId: "resp-2",
      functionCall: { callId: "call-2", functionName: "create_item", arguments: "{}" },
    },
  ];

  const firstScope = getInlineConfirmationScope(pendingItems, "call-1");
  assert.deepEqual(firstScope.items.map((item) => item.clientId), ["a"]);

  const secondScope = getInlineConfirmationScope(pendingItems, "call-2");
  assert.deepEqual(secondScope.items.map((item) => item.clientId), ["b"]);
});

test("falls back to call-scoped confirmations when responseId is missing", () => {
  const pendingItems: any[] = [
    {
      clientId: "a",
      type: "shopping",
      operation: "create",
      data: {},
      functionCall: { callId: "call-1", functionName: "create_item", arguments: "{}" },
    },
  ];

  const scope = getInlineConfirmationScope(pendingItems, "call-1");
  assert.deepEqual(scope.items.map((item) => item.clientId), ["a"]);
  assert.equal(scope.suppressToolFallback, false);
});
