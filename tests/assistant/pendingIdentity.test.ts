import assert from "node:assert/strict";
import test from "node:test";

import { ensurePendingClientIds } from "../../components/ai/assistant/data/utils/pendingIdentity.ts";
import type { PendingItem } from "../../components/ai/assistant/data/types";

const makePendingItem = (
  overrides: Partial<PendingItem> = {},
): PendingItem => ({
  type: "shopping",
  operation: "create",
  data: { name: "Sink" },
  functionCall: {
    callId: "call_1",
    functionName: "create_multiple_items",
    arguments: "{}",
  },
  ...overrides,
});

test("ensurePendingClientIds derives stable ids from payload shape", () => {
  const [first, second] = ensurePendingClientIds([
    makePendingItem({ data: { name: "Sink" } }),
    makePendingItem({ data: { name: "Mirror" } }),
  ]);

  assert.match(first?.clientId ?? "", /^call_1:\{.*"name":"Sink".*\}:0$/);
  assert.match(second?.clientId ?? "", /^call_1:\{.*"name":"Mirror".*\}:0$/);
});

test("ensurePendingClientIds increments duplicate signatures deterministically", () => {
  const items = ensurePendingClientIds([
    makePendingItem(),
    makePendingItem(),
  ]);

  assert.equal(items[0]?.clientId?.endsWith(":0"), true);
  assert.equal(items[1]?.clientId?.endsWith(":1"), true);
});
