import assert from "node:assert/strict";
import test from "node:test";

import type { PendingContentItem } from "../../components/ai/assistant/data/types";
import {
  extractBulkCreateEntries,
  getApprovalState,
  shouldHideSectionCard,
} from "../../components/ai/assistant/ui/confirmations/helpers.ts";

const makePendingItem = (
  overrides: Partial<PendingContentItem> = {},
): PendingContentItem => ({
  type: "task",
  operation: "create",
  data: { title: "Example" },
  status: undefined,
  ...overrides,
});

test("getApprovalState prefers explicit approval state over status", () => {
  assert.equal(
    getApprovalState(
      makePendingItem({
        status: "confirmed",
        approvalState: "output-denied",
      }),
    ),
    "output-denied",
  );
});

test("getApprovalState maps resolved statuses to output states", () => {
  assert.equal(getApprovalState(makePendingItem({ status: "confirmed" })), "output-available");
  assert.equal(getApprovalState(makePendingItem({ status: "rejected" })), "output-denied");
  assert.equal(getApprovalState(makePendingItem({ status: undefined })), "approval-requested");
});

test("extractBulkCreateEntries reads supported bulk payload keys", () => {
  assert.deepEqual(
    extractBulkCreateEntries(
      makePendingItem({
        operation: "bulk_create",
        data: { items: [{ name: "One" }, { name: "Two" }] },
      }),
    ),
    [{ name: "One" }, { name: "Two" }],
  );

  assert.deepEqual(
    extractBulkCreateEntries(
      makePendingItem({
        operation: "bulk_create",
        type: "task",
        data: { tasks: [{ title: "Task 1" }] },
      }),
    ),
    [{ title: "Task 1" }],
  );

  assert.deepEqual(
    extractBulkCreateEntries(
      makePendingItem({
        operation: "bulk_create",
        type: "survey",
        data: { surveys: [{ title: "Survey 1" }] },
      }),
    ),
    [{ title: "Survey 1" }],
  );
});

test("extractBulkCreateEntries filters out invalid bulk entries", () => {
  assert.deepEqual(
    extractBulkCreateEntries(
      makePendingItem({
        operation: "bulk_create",
        data: { laborItems: [{ name: "Valid" }, null, "bad"] },
      }),
    ),
    [{ name: "Valid" }],
  );
});

test("shouldHideSectionCard keeps unrelated shopping section visible", () => {
  const hidden = shouldHideSectionCard({
    canonicalType: "shoppingSection",
    sectionCardName: "Bathroom",
    referencedSectionNames: {
      shopping: new Set(["Kitchen"]),
      labor: new Set(),
    },
    hiddenSectionMeta: {},
  });

  assert.equal(hidden, false);
});

test("shouldHideSectionCard hides section only when referenced by shopping items", () => {
  const hidden = shouldHideSectionCard({
    canonicalType: "shoppingSection",
    sectionCardName: "Bathroom",
    referencedSectionNames: {
      shopping: new Set(["Bathroom"]),
      labor: new Set(),
    },
    hiddenSectionMeta: {},
  });

  assert.equal(hidden, true);
});

test("shouldHideSectionCard hides inferred sections via hidden meta for shopping and labor", () => {
  assert.equal(
    shouldHideSectionCard({
      canonicalType: "shoppingSection",
      sectionCardName: undefined,
      referencedSectionNames: {
        shopping: new Set(),
        labor: new Set(),
      },
      hiddenSectionMeta: { shopping: "Kitchen" },
    }),
    true,
  );

  assert.equal(
    shouldHideSectionCard({
      canonicalType: "laborSection",
      sectionCardName: "Wet Works",
      referencedSectionNames: {
        shopping: new Set(),
        labor: new Set(),
      },
      hiddenSectionMeta: { labor: "Wet Works" },
    }),
    true,
  );
});
