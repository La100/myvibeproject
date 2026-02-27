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

test("returns canonical item type as-is", () => {
  assert.equal(getCanonicalType("task" as any), "task");
  assert.equal(getCanonicalType("shopping" as any), "shopping");
  assert.equal(getCanonicalType("task" as any), "task");
});

test("derives operation and approval label/state", () => {
  const pendingItem: any = {
    type: "task",
    status: "pending",
    data: { title: "Kup materialy" },
  };

  assert.equal(getOperation(pendingItem), "create");
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
