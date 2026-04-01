type UnknownRecord = Record<string, unknown>;

export type OpenAICompletionsUsageTotals = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  requests: number;
};

export type OpenAICompletionsUsageRow = {
  bucketStartMs: number;
  bucketEndMs: number;
  userId: string | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  requests: number;
};

export type ScopedChatKitUser = {
  rawUserId: string;
  clerkUserId: string;
  teamId: string;
  projectId: string;
};

type ModelPricing = {
  inputPer1M: number;
  cachedInputPer1M: number;
  outputPer1M: number;
};

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;

const asFiniteNumber = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return value;
};

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const MODEL_PRICING: Array<[prefix: string, pricing: ModelPricing]> = [
  ["gpt-5-mini", { inputPer1M: 0.25, cachedInputPer1M: 0.025, outputPer1M: 2 }],
  ["gpt-5-nano", { inputPer1M: 0.05, cachedInputPer1M: 0.005, outputPer1M: 0.4 }],
  ["gpt-5", { inputPer1M: 1.25, cachedInputPer1M: 0.125, outputPer1M: 10 }],
  ["gpt-4.1-mini", { inputPer1M: 0.4, cachedInputPer1M: 0.1, outputPer1M: 1.6 }],
  ["gpt-4.1-nano", { inputPer1M: 0.1, cachedInputPer1M: 0.025, outputPer1M: 0.4 }],
  ["gpt-4.1", { inputPer1M: 2, cachedInputPer1M: 0.5, outputPer1M: 8 }],
  ["gpt-4o-mini", { inputPer1M: 0.15, cachedInputPer1M: 0.075, outputPer1M: 0.6 }],
  ["gpt-4o", { inputPer1M: 2.5, cachedInputPer1M: 1.25, outputPer1M: 10 }],
  ["o4-mini", { inputPer1M: 1.1, cachedInputPer1M: 0.275, outputPer1M: 4.4 }],
  ["o3", { inputPer1M: 2, cachedInputPer1M: 0.5, outputPer1M: 8 }],
];

const DEFAULT_PRICING: ModelPricing = {
  inputPer1M: 2.5,
  cachedInputPer1M: 1.25,
  outputPer1M: 10,
};

const dollarsToCents = (value: number): number => Math.round(value * 100);

const resolveModelPricing = (model: string | null): ModelPricing => {
  if (!model) {
    return DEFAULT_PRICING;
  }

  const normalized = model.toLowerCase();

  for (const [prefix, pricing] of MODEL_PRICING) {
    if (normalized.startsWith(prefix)) {
      return pricing;
    }
  }

  return DEFAULT_PRICING;
};

const extractBucketTimestamps = (bucketRecord: UnknownRecord) => {
  const startSeconds =
    asFiniteNumber(bucketRecord.start_time) ||
    asFiniteNumber(bucketRecord.start_timestamp);
  const endSeconds =
    asFiniteNumber(bucketRecord.end_time) ||
    asFiniteNumber(bucketRecord.end_timestamp);

  return {
    bucketStartMs: startSeconds > 0 ? startSeconds * 1000 : 0,
    bucketEndMs: endSeconds > 0 ? endSeconds * 1000 : 0,
  };
};

export function listOpenAICompletionsUsageRows(payload: unknown): OpenAICompletionsUsageRow[] {
  const rows: OpenAICompletionsUsageRow[] = [];

  for (const bucket of asArray(asRecord(payload)?.data)) {
    const bucketRecord = asRecord(bucket);
    if (!bucketRecord) continue;

    const { bucketStartMs, bucketEndMs } = extractBucketTimestamps(bucketRecord);

    for (const result of asArray(bucketRecord.results)) {
      const resultRecord = asRecord(result);
      if (!resultRecord) continue;

      rows.push({
        bucketStartMs,
        bucketEndMs,
        userId: asString(resultRecord.user_id),
        model: asString(resultRecord.model),
        inputTokens: asFiniteNumber(resultRecord.input_tokens),
        outputTokens: asFiniteNumber(resultRecord.output_tokens),
        cachedInputTokens: asFiniteNumber(resultRecord.input_cached_tokens),
        requests: asFiniteNumber(resultRecord.num_model_requests),
      });
    }
  }

  return rows;
}

export function sumOpenAICompletionsUsage(payload: unknown): OpenAICompletionsUsageTotals {
  return listOpenAICompletionsUsageRows(payload).reduce<OpenAICompletionsUsageTotals>(
    (totals, row) => {
      totals.inputTokens += row.inputTokens;
      totals.outputTokens += row.outputTokens;
      totals.cachedInputTokens += row.cachedInputTokens;
      totals.requests += row.requests;
      return totals;
    },
    {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      requests: 0,
    },
  );
}

export function parseScopedChatKitUser(rawUserId: string | null): ScopedChatKitUser | null {
  if (!rawUserId) {
    return null;
  }

  const match = /^clerk:(.+):team:([^:]+):project:([^:]+)$/.exec(rawUserId.trim());
  if (!match) {
    return null;
  }

  const [, clerkUserId, teamId, projectId] = match;
  if (!clerkUserId || !teamId || !projectId) {
    return null;
  }

  return {
    rawUserId: rawUserId,
    clerkUserId,
    teamId,
    projectId,
  };
}

export function estimateOpenAITextUsageCostCents(row: {
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}): number {
  const pricing = resolveModelPricing(row.model);
  const cachedInputTokens = Math.max(0, row.cachedInputTokens);
  const inputTokens = Math.max(0, row.inputTokens);
  const nonCachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  const outputTokens = Math.max(0, row.outputTokens);

  const estimatedDollars =
    (nonCachedInputTokens / 1_000_000) * pricing.inputPer1M +
    (cachedInputTokens / 1_000_000) * pricing.cachedInputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M;

  return dollarsToCents(estimatedDollars);
}

const extractCostAmountCents = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return dollarsToCents(value);
  }

  const record = asRecord(value);
  if (!record) {
    return 0;
  }

  if (typeof record.amount_cents === "number" && Number.isFinite(record.amount_cents)) {
    return Math.round(record.amount_cents);
  }

  if (typeof record.cents === "number" && Number.isFinite(record.cents)) {
    return Math.round(record.cents);
  }

  if (typeof record.value === "number" && Number.isFinite(record.value)) {
    return dollarsToCents(record.value);
  }

  if (typeof record.amount === "number" && Number.isFinite(record.amount)) {
    return dollarsToCents(record.amount);
  }

  return 0;
};

export function sumOpenAICostsInCents(payload: unknown): number {
  let totalCostCents = 0;

  for (const bucket of asArray(asRecord(payload)?.data)) {
    const bucketRecord = asRecord(bucket);

    for (const result of asArray(bucketRecord?.results)) {
      const resultRecord = asRecord(result);
      const lineItems = asArray(resultRecord?.line_items);

      if (lineItems.length > 0) {
        for (const lineItem of lineItems) {
          totalCostCents += extractCostAmountCents(asRecord(lineItem)?.amount ?? lineItem);
        }
        continue;
      }

      totalCostCents += extractCostAmountCents(resultRecord?.amount ?? resultRecord);
    }
  }

  return totalCostCents;
}

export function listOpenAICostBuckets(payload: unknown): Array<{
  bucketStartMs: number;
  bucketEndMs: number;
  totalCostCents: number;
}> {
  const buckets: Array<{
    bucketStartMs: number;
    bucketEndMs: number;
    totalCostCents: number;
  }> = [];

  for (const bucket of asArray(asRecord(payload)?.data)) {
    const bucketRecord = asRecord(bucket);
    if (!bucketRecord) continue;

    const { bucketStartMs, bucketEndMs } = extractBucketTimestamps(bucketRecord);
    let totalCostCents = 0;

    for (const result of asArray(bucketRecord.results)) {
      const resultRecord = asRecord(result);
      const lineItems = asArray(resultRecord?.line_items);

      if (lineItems.length > 0) {
        for (const lineItem of lineItems) {
          totalCostCents += extractCostAmountCents(asRecord(lineItem)?.amount ?? lineItem);
        }
        continue;
      }

      totalCostCents += extractCostAmountCents(resultRecord?.amount ?? resultRecord);
    }

    buckets.push({
      bucketStartMs,
      bucketEndMs,
      totalCostCents,
    });
  }

  return buckets;
}
