export type BudgetProject = {
  _id: string;
  budget?: number | null;
  currency?: string | null;
};

export type BudgetShoppingItem = {
  totalPrice?: number | null;
  realizationStatus?: string | null;
};

export type BudgetLaborItem = {
  totalPrice?: number | null;
  startDate?: number | null;
  endDate?: number | null;
};

export type BudgetEstimation = {
  status?: string | null;
  grossTotal?: number | null;
  netTotal?: number | null;
};

export type BudgetPayment = {
  status?: string | null;
  amount?: number | null;
};

export type ProjectBudgetSummaryInput = {
  project: BudgetProject;
  shoppingItems: BudgetShoppingItem[];
  laborItems: BudgetLaborItem[];
  estimations: BudgetEstimation[];
  payments: BudgetPayment[];
};

const asAmount = (value: number | null | undefined) => value || 0;

export function summarizeProjectBudget(
  input: ProjectBudgetSummaryInput,
  now: number = Date.now(),
) {
  const { project, shoppingItems, laborItems, estimations, payments } = input;

  const shoppingPlanned = shoppingItems.reduce(
    (sum, item) => sum + asAmount(item.totalPrice),
    0,
  );
  const shoppingCommitted = shoppingItems
    .filter(
      (item) =>
        item.realizationStatus !== "PLANNED" &&
        item.realizationStatus !== "CANCELLED",
    )
    .reduce((sum, item) => sum + asAmount(item.totalPrice), 0);
  const shoppingActual = shoppingItems
    .filter(
      (item) =>
        item.realizationStatus === "DELIVERED" ||
        item.realizationStatus === "COMPLETED",
    )
    .reduce((sum, item) => sum + asAmount(item.totalPrice), 0);

  const laborPlanned = laborItems.reduce(
    (sum, item) => sum + asAmount(item.totalPrice),
    0,
  );
  const laborCommitted = laborItems
    .filter(
      (item) =>
        typeof item.startDate === "number" || typeof item.endDate === "number",
    )
    .reduce((sum, item) => sum + asAmount(item.totalPrice), 0);
  const laborActual = laborItems
    .filter((item) => typeof item.endDate === "number" && item.endDate <= now)
    .reduce((sum, item) => sum + asAmount(item.totalPrice), 0);

  const plannedCost = shoppingPlanned + laborPlanned;
  const committedCost = shoppingCommitted + laborCommitted;
  const actualCost = shoppingActual + laborActual;
  const budget = asAmount(project.budget);
  const variance = budget - actualCost;
  const projectedVariance = budget - plannedCost;

  const acceptedEstimateValue = estimations
    .filter((estimation) => estimation.status === "accepted")
    .reduce(
      (sum, estimation) =>
        sum +
        asAmount(estimation.grossTotal) +
        (estimation.grossTotal ? 0 : asAmount(estimation.netTotal)),
      0,
    );
  const pipelineEstimateValue = estimations
    .filter((estimation) => estimation.status === "sent")
    .reduce(
      (sum, estimation) =>
        sum +
        asAmount(estimation.grossTotal) +
        (estimation.grossTotal ? 0 : asAmount(estimation.netTotal)),
      0,
    );

  const visiblePayments = payments.filter(
    (payment) => payment.status !== "void",
  );
  const scheduledPaymentValue = visiblePayments.reduce(
    (sum, payment) => sum + asAmount(payment.amount),
    0,
  );
  const collectedPaymentValue = visiblePayments
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + asAmount(payment.amount), 0);
  const outstandingPaymentValue = visiblePayments
    .filter(
      (payment) => payment.status === "draft" || payment.status === "open",
    )
    .reduce((sum, payment) => sum + asAmount(payment.amount), 0);

  return {
    currency: project.currency || "PLN",
    budget,
    plannedCost,
    committedCost,
    actualCost,
    variance,
    projectedVariance,
    utilizationPercent:
      budget > 0 ? Math.round((actualCost / budget) * 100) : null,
    projectedUtilizationPercent:
      budget > 0 ? Math.round((plannedCost / budget) * 100) : null,
    breakdown: {
      shopping: {
        planned: shoppingPlanned,
        committed: shoppingCommitted,
        actual: shoppingActual,
      },
      labor: {
        planned: laborPlanned,
        committed: laborCommitted,
        actual: laborActual,
      },
    },
    clientFunding: {
      acceptedEstimations: acceptedEstimateValue,
      pipelineEstimations: pipelineEstimateValue,
      scheduledPayments: scheduledPaymentValue,
      collectedPayments: collectedPaymentValue,
      outstandingPayments: outstandingPaymentValue,
    },
    alerts: [
      budget > 0 && actualCost > budget
        ? { severity: "high", label: "Actual cost exceeds budget" }
        : null,
      budget > 0 && plannedCost > budget
        ? { severity: "medium", label: "Projected cost exceeds budget" }
        : null,
      outstandingPaymentValue > 0 && collectedPaymentValue < actualCost
        ? {
            severity: "medium",
            label: "Collected payments are below current actual cost",
          }
        : null,
    ].filter(
      (alert): alert is { severity: "high" | "medium"; label: string } =>
        alert !== null,
    ),
  };
}
