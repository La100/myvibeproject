import assert from "node:assert/strict";
import test from "node:test";

import { summarizeProjectBudget } from "../../lib/projectBudgetSummary.ts";

test("summarizeProjectBudget computes costs, revenue and alerts", () => {
  const summary = summarizeProjectBudget(
    {
      project: { _id: "project-1", budget: 1000, currency: "EUR" },
      shoppingItems: [
        { totalPrice: 100, realizationStatus: "PLANNED" },
        { totalPrice: 150, realizationStatus: "ORDERED" },
        { totalPrice: 200, realizationStatus: "DELIVERED" },
      ],
      laborItems: [
        { totalPrice: 300 },
        { totalPrice: 250, startDate: 50 },
        { totalPrice: 200, endDate: 99 },
        { totalPrice: 125, endDate: 101 },
      ],
      estimations: [
        { status: "accepted", grossTotal: 1200 },
        { status: "sent", netTotal: 400 },
      ],
      payments: [
        { status: "paid", amount: 500 },
        { status: "open", amount: 350 },
        { status: "void", amount: 999 },
      ],
      milestones: [{ budgetAmount: 250 }, { budgetAmount: 100 }],
    },
    100,
  );

  assert.equal(summary.currency, "EUR");
  assert.equal(summary.plannedCost, 1325);
  assert.equal(summary.committedCost, 925);
  assert.equal(summary.actualCost, 400);
  assert.equal(summary.variance, 600);
  assert.equal(summary.projectedVariance, -325);
  assert.equal(summary.utilizationPercent, 40);
  assert.equal(summary.projectedUtilizationPercent, 133);
  assert.deepEqual(summary.breakdown.shopping, {
    planned: 450,
    committed: 350,
    actual: 200,
  });
  assert.deepEqual(summary.breakdown.labor, {
    planned: 875,
    committed: 575,
    actual: 200,
  });
  assert.deepEqual(summary.revenue, {
    acceptedEstimations: 1200,
    pipelineEstimations: 400,
    scheduledPayments: 850,
    collectedPayments: 500,
    outstandingPayments: 350,
  });
  assert.deepEqual(summary.milestones, {
    count: 2,
    budgetAllocated: 350,
  });
  assert.deepEqual(summary.alerts, [
    { severity: "medium", label: "Projected cost exceeds budget" },
  ]);
});

test("summarizeProjectBudget handles zero budget without utilization percentages", () => {
  const summary = summarizeProjectBudget(
    {
      project: { _id: "project-2", budget: 0, currency: null },
      shoppingItems: [],
      laborItems: [],
      estimations: [],
      payments: [],
      milestones: [],
    },
    100,
  );

  assert.equal(summary.currency, "PLN");
  assert.equal(summary.utilizationPercent, null);
  assert.equal(summary.projectedUtilizationPercent, null);
  assert.deepEqual(summary.alerts, []);
});
