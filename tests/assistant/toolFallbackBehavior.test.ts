import assert from "node:assert/strict";
import test from "node:test";

import type { PendingContentItem } from "../../components/ai/assistant/data/types";
import {
  buildToolPreviewSummary,
  toPendingItemsFromResult,
} from "../../components/assistant-ui/tool-fallback-helpers.ts";

const makePendingItem = (
  overrides: Partial<PendingContentItem> = {},
): PendingContentItem => ({
  type: "task",
  operation: "create",
  data: { title: "Example" },
  functionCall: {
    callId: "call_1",
    functionName: "manage_tasks",
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

test("toPendingItemsFromResult expands bulk surveys and contacts consistently", () => {
  const surveys = toPendingItemsFromResult(
    "call_survey",
    JSON.stringify({
      type: "survey",
      operation: "bulk_create",
      data: {
        surveys: [{ title: "Survey A" }, { title: "Survey B" }],
      },
    }),
  );
  const contacts = toPendingItemsFromResult(
    "call_contact",
    JSON.stringify({
      type: "contact",
      operation: "bulk_create",
      data: {
        contacts: [{ name: "Anna" }],
      },
    }),
  );

  assert.equal(surveys.length, 2);
  assert.equal(surveys[0]?.type, "survey");
  assert.equal(contacts.length, 1);
  assert.equal(contacts[0]?.type, "contact");
});

test("toPendingItemsFromResult expands bulk edits into edit items", () => {
  const items = toPendingItemsFromResult(
    "call_bulk_edit",
    JSON.stringify({
      type: "task",
      operation: "bulk_edit",
      data: {
        items: [
          {
            itemId: "task_1",
            originalItem: { _id: "task_1", title: "Old" },
            updates: { title: "New" },
          },
        ],
      },
    }),
  );

  assert.equal(items.length, 1);
  assert.equal(items[0]?.operation, "edit");
  assert.equal((items[0]?.originalItem as { _id?: string })?._id, "task_1");
  assert.equal((items[0]?.updates as { title?: string })?.title, "New");
});

test("buildToolPreviewSummary summarizes bulk edit results as human-readable cards", () => {
  const pendingItems = toPendingItemsFromResult(
    "call_bulk_edit",
    JSON.stringify({
      type: "task",
      operation: "bulk_edit",
      data: {
        items: [
          {
            itemId: "task_1",
            originalItem: { _id: "task_1", title: "Measure kitchen" },
            updates: { title: "Measure the kitchen", priority: "medium" },
          },
          {
            itemId: "task_2",
            originalItem: { _id: "task_2", title: "Paint walls" },
            updates: { status: "in_progress" },
          },
        ],
      },
    }),
  );

  const summary = buildToolPreviewSummary({
    toolName: "manage_tasks",
    result: JSON.stringify({
      type: "task",
      operation: "bulk_edit",
      data: {
        items: [],
      },
    }),
    pendingItems,
  });

  assert.ok(summary);
  assert.equal(summary?.title, "Update 2 tasks");
  assert.equal(summary?.items?.[0]?.title, "Measure kitchen");
  assert.equal(summary?.items?.[0]?.description, "Changes: Title, Priority");
});

test("buildToolPreviewSummary summarizes search results without raw json", () => {
  const summary = buildToolPreviewSummary({
    toolName: "search_items",
    argsText: JSON.stringify({ type: "shopping", query: "farba" }),
    result: JSON.stringify({
      count: 2,
      items: [
        { _id: "shopping_1", name: "Farba biala", notes: "Mat" },
        { _id: "shopping_2", name: "Farba gruntujaca" },
      ],
    }),
  });

  assert.ok(summary);
  assert.equal(summary?.title, "Found 2 shopping items");
  assert.equal(summary?.subtitle, "Search query: farba");
  assert.equal(summary?.items?.[0]?.title, "Farba biala");
});

test("buildToolPreviewSummary summarizes create tool args before approval", () => {
  const summary = buildToolPreviewSummary({
    toolName: "manage_shopping",
    argsText: JSON.stringify({
      action: "create",
      entity: "item",
      data: {
        name: "Testowy item",
        notes: "Testowy shopping list item",
        quantity: 1,
      },
    }),
  });

  assert.ok(summary);
  assert.equal(summary?.title, "Create 1 shopping item");
  assert.equal(summary?.items?.[0]?.title, "Testowy item");
  assert.equal(summary?.items?.[0]?.description, "Testowy shopping list item");
});

test("buildToolPreviewSummary summarizes full project context counts", () => {
  const summary = buildToolPreviewSummary({
    toolName: "load_full_project_context",
    result: JSON.stringify({
      success: true,
      counts: {
        tasks: 4,
        notes: 2,
        shoppingItems: 6,
      },
      message: "Full project context loaded successfully.",
    }),
  });

  assert.ok(summary);
  assert.equal(summary?.title, "Loaded full project context");
  assert.equal(summary?.items?.[0]?.title, "Tasks: 4");
});
