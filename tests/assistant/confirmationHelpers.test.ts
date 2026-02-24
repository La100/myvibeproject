import assert from "node:assert/strict";
import test from "node:test";

import {
  extractBulkCreateEntries,
  getApprovalLabel,
  getApprovalState,
  getCanonicalType,
  getOperation,
  shouldRenderByState,
} from "../../components/ai/assistant/ui/confirmations/helpers.ts";

test("maps create_multiple_* type to canonical item type", () => {
  assert.equal(getCanonicalType("create_multiple_tasks" as any), "task");
  assert.equal(getCanonicalType("create_shopping_item" as any), "shopping_item");
  assert.equal(getCanonicalType("task" as any), "task");
});

test("derives operation and approval label/state", () => {
  const pendingItem: any = {
    type: "create_multiple_tasks",
    status: "pending",
    data: { title: "Kup materialy" },
  };

  assert.equal(getOperation(pendingItem), "bulk_create");
  assert.equal(getApprovalState({ ...pendingItem, status: "confirmed" }), "output-available");
  assert.equal(getApprovalLabel("output-available" as any), "Approved");
  assert.equal(shouldRenderByState("input-streaming" as any), false);
});

test("extracts only object entries for bulk create payload", () => {
  const item: any = {
    operation: "bulk_create",
    data: {
      items: [{ name: "Farba" }, null, "bad", { name: "Walek" }],
    },
  };

  const entries = extractBulkCreateEntries(item);

  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0], { name: "Farba" });
  assert.deepEqual(entries[1], { name: "Walek" });
});
