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

test("stages pending shopping item for generic create_item", async () => {
  const result = await processFunctionCalls(
    [
      {
        call_id: "call-1",
        name: "create_item",
        arguments: JSON.stringify({
          type: "shopping",
          data: {
            name: "Farba biala",
            quantity: 2,
            priority: "high",
          },
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
  assert.match(result.finalResponse, /create a shopping/i);
});

test("skips malformed function call arguments and continues processing", async () => {
  const result = await processFunctionCalls(
    [
      {
        call_id: "call-bad",
        name: "create_item",
        arguments: "{bad-json",
      },
      {
        call_id: "call-good",
        name: "create_item",
        arguments: JSON.stringify({
          type: "shopping",
          data: {
            name: "Walek",
            quantity: 1,
          },
        }),
      },
    ],
    "Czekam na potwierdzenie.",
    [],
    buildSnapshot,
    "resp-bad-json",
  );

  assert.equal(result.pendingItems.length, 1);
  assert.equal(result.pendingItems[0].type, "shopping");
  assert.equal((result.pendingItems[0].data as any).name, "Walek");
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

test("stages pending contact edit for generic update_item", async () => {
  const result = await processFunctionCalls(
    [
      {
        call_id: "call-3",
        name: "update_item",
        arguments: JSON.stringify({
          type: "contact",
          itemId: "contact_1",
          data: {
            phone: "+48 500 100 200",
          },
        }),
      },
    ],
    "Czekam na potwierdzenie.",
    [],
    async () =>
      ({
        tasks: [],
        notes: [],
        shoppingItems: [],
        contacts: [{ _id: "contact_1", name: "Jan Kowalski", type: "contractor" }],
        surveys: [],
        project: null,
      }) as any,
    "resp-3",
  );

  assert.equal(result.pendingItems.length, 1);
  assert.equal(result.pendingItems[0].type, "contact");
  assert.equal(result.pendingItems[0].operation, "edit");
  assert.equal((result.pendingItems[0].updates as any).phone, "+48 500 100 200");
  assert.equal((result.pendingItems[0].originalItem as any)._id, "contact_1");
});

test("keeps survey question update metadata in pending survey edit payload", async () => {
  const result = await processFunctionCalls(
    [
      {
        call_id: "call-4",
        name: "update_item",
        arguments: JSON.stringify({
          type: "survey",
          itemId: "survey_1",
          data: {
            questions: [
              {
                questionId: "question_1",
                operation: "edit",
                questionText: "How clear was communication?",
                questionType: "rating",
                order: 1,
              },
            ],
          },
        }),
      },
    ],
    "Czekam na potwierdzenie.",
    [],
    async () =>
      ({
        tasks: [],
        notes: [],
        shoppingItems: [],
        contacts: [],
        surveys: [
          {
            _id: "survey_1",
            title: "Weekly Check-in",
            questions: [
              {
                _id: "question_1",
                questionText: "Jak oceniasz komunikacje?",
                questionType: "rating",
                order: 1,
              },
            ],
          },
        ],
        project: null,
      }) as any,
    "resp-4",
  );

  assert.equal(result.pendingItems.length, 1);
  assert.equal(result.pendingItems[0].type, "survey");
  assert.equal(result.pendingItems[0].operation, "edit");
  assert.equal(((result.pendingItems[0].updates as any).questions?.[0] as any).questionId, "question_1");
  assert.equal(((result.pendingItems[0].updates as any).questions?.[0] as any).operation, "edit");
});
