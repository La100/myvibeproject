import assert from "node:assert/strict";
import test from "node:test";

import { processFunctionCalls } from "../../convex/ai/helpers/functionCallHandler.ts";
import type { ProjectContextSnapshot } from "../../convex/ai/types.ts";

const buildSnapshot = async () =>
  ({
    tasks: [],
    notes: [],
    shoppingItems: [],
    contacts: [],
    surveys: [],
    files: [],
    summary: "",
    project: null,
  }) as ProjectContextSnapshot;

test("stages pending shopping item for manage_shopping create", async () => {
  const result = await processFunctionCalls(
    [
      {
        call_id: "call-1",
        name: "manage_shopping",
        arguments: JSON.stringify({
          action: "create",
          entity: "item",
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
  assert.equal((result.pendingItems[0].data as Record<string, unknown>).name, "Farba biala");
  assert.equal((result.pendingItems[0].data as Record<string, unknown>).quantity, 2);
  assert.match(result.finalResponse, /create a shopping/i);
});

test("skips malformed function call arguments and continues processing", async () => {
  const result = await processFunctionCalls(
    [
      {
        call_id: "call-bad",
        name: "manage_shopping",
        arguments: "{bad-json",
      },
      {
        call_id: "call-good",
        name: "manage_shopping",
        arguments: JSON.stringify({
          action: "create",
          entity: "item",
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
  assert.equal((result.pendingItems[0].data as Record<string, unknown>).name, "Walek");
});

test("stages pending shopping item for manage_shopping create", async () => {
  const result = await processFunctionCalls(
    [
      {
        call_id: "call-2",
        name: "manage_shopping",
        arguments: JSON.stringify({
          action: "create",
          entity: "item",
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
  assert.equal((result.pendingItems[0].data as Record<string, unknown>).name, "Tasma malarska");
  assert.equal(result.actionSummaries[0], 'shopping: "Tasma malarska"');
  assert.match(result.finalResponse, /create a shopping/i);
});

test("stages pending contact edit for manage_contacts update", async () => {
  const result = await processFunctionCalls(
    [
      {
        call_id: "call-3",
        name: "manage_contacts",
        arguments: JSON.stringify({
          action: "update",
          contactId: "contact_1",
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
        files: [],
        summary: "",
        project: null,
      }) as ProjectContextSnapshot,
    "resp-3",
  );

  assert.equal(result.pendingItems.length, 1);
  assert.equal(result.pendingItems[0].type, "contact");
  assert.equal(result.pendingItems[0].operation, "edit");
  assert.equal((result.pendingItems[0].updates as Record<string, unknown>).phone, "+48 500 100 200");
  assert.equal((result.pendingItems[0].originalItem as { _id?: string })._id, "contact_1");
});

test("keeps survey question update metadata in manage_surveys edit payload", async () => {
  const result = await processFunctionCalls(
    [
      {
        call_id: "call-4",
        name: "manage_surveys",
        arguments: JSON.stringify({
          action: "update",
          surveyId: "survey_1",
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
            status: "active",
            isRequired: false,
            allowMultipleResponses: false,
            questions: [
              {
                _id: "question_1",
                questionText: "Jak oceniasz komunikacje?",
                questionType: "rating",
              },
            ],
          },
        ],
        files: [],
        summary: "",
        project: null,
      }) as ProjectContextSnapshot,
    "resp-4",
  );

  assert.equal(result.pendingItems.length, 1);
  assert.equal(result.pendingItems[0].type, "survey");
  assert.equal(result.pendingItems[0].operation, "edit");
  const questions = (result.pendingItems[0].updates as { questions?: Array<Record<string, unknown>> }).questions;
  assert.equal(questions?.[0]?.questionId, "question_1");
  assert.equal(questions?.[0]?.operation, "edit");
});
