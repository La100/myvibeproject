import assert from "node:assert/strict";
import test from "node:test";

import type { PendingContentItem } from "../../components/ai/assistant/data/types";
import { prepareInlineConfirmationViewModel } from "../../components/ai/assistant/ui/confirmations/viewModel.ts";

const makePendingItem = (
  overrides: Partial<PendingContentItem> = {},
): PendingContentItem => ({
  type: "task",
  operation: "create",
  data: { title: "Example" },
  status: undefined,
  ...overrides,
});

test("prepareInlineConfirmationViewModel expands bulk items and exposes unresolved cards", () => {
  const viewModel = prepareInlineConfirmationViewModel([
    makePendingItem({
      type: "shopping",
      operation: "bulk_create",
      clientId: "pending:shopping:create:1",
      data: {
        items: [{ name: "Sink" }, { name: "Mirror" }],
      },
    }),
  ]);

  assert.equal(viewModel.visibleItems.length, 2);
  assert.equal(viewModel.unresolvedItems.length, 2);
  assert.equal(viewModel.visibleItems[0]?.item.clientId, "pending:shopping:create:1::0");
  assert.equal(viewModel.visibleItems[1]?.item.clientId, "pending:shopping:create:1::1");
});

test("prepareInlineConfirmationViewModel hides inferred section cards and produces resolved summary", () => {
  const viewModel = prepareInlineConfirmationViewModel([
    makePendingItem({
      type: "shoppingSection",
      operation: "create",
      status: "confirmed",
      data: { name: "Kitchen" },
    }),
    makePendingItem({
      type: "shopping",
      operation: "create",
      status: "confirmed",
      data: { name: "Sink", sectionName: "Kitchen" },
    }),
  ]);

  assert.equal(viewModel.visibleItems.length, 1);
  assert.equal(viewModel.unresolvedItems.length, 0);
  assert.equal(viewModel.hiddenSectionLabels[0], 'shopping section "Kitchen"');
  assert.deepEqual(viewModel.resolvedSummary, {
    confirmedCount: 1,
    rejectedCount: 0,
    typeSummaries: [["shopping", { confirmed: 1, rejected: 0 }]],
  });
});
