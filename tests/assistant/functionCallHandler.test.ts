import assert from "node:assert/strict";
import test from "node:test";

import { processFunctionCalls } from "../../convex/ai/helpers/functionCallHandler.ts";

const buildSnapshot = async () =>
  ({
    tasks: [],
    notes: [],
    shoppingItems: [],
    contacts: [],
    surveys: [],
    project: null,
  }) as any;

test("stages pending shopping item for legacy create_shopping_item", async () => {
  const result = await processFunctionCalls(
    [
      {
        call_id: "call-1",
        name: "create_shopping_item",
        arguments: JSON.stringify({
          name: "Farba biala",
          quantity: 2,
          priority: "high",
        }),
      },
    ],
    "Czekam na potwierdzenie.",
    [],
    buildSnapshot,
    "resp-1",
  );

  assert.equal(result.pendingItems.length, 1);
  assert.equal(result.pendingItems[0].type, "shopping");
  assert.equal(result.pendingItems[0].operation, "create");
  assert.equal((result.pendingItems[0].data as any).name, "Farba biala");
  assert.equal((result.pendingItems[0].data as any).quantity, 2);
  assert.match(result.finalResponse, /add "Farba biala" to shopping list/i);
});

test("stages pending shopping item for generic create_item", async () => {
  const result = await processFunctionCalls(
    [
      {
        call_id: "call-2",
        name: "create_item",
        arguments: JSON.stringify({
          type: "shopping",
          data: {
            name: "Tasma malarska",
            quantity: 1,
          },
        }),
      },
    ],
    "Daj znac czy zatwierdzic.",
    [],
    buildSnapshot,
    "resp-2",
  );

  assert.equal(result.pendingItems.length, 1);
  assert.equal(result.pendingItems[0].type, "shopping");
  assert.equal(result.pendingItems[0].operation, "create");
  assert.equal((result.pendingItems[0].data as any).name, "Tasma malarska");
  assert.equal(result.actionSummaries[0], 'shopping: "Tasma malarska"');
  assert.match(result.finalResponse, /create a shopping/i);
});
