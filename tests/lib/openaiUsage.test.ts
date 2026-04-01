import assert from "node:assert/strict";
import test from "node:test";

import {
  estimateOpenAITextUsageCostCents,
  listOpenAICostBuckets,
  listOpenAICompletionsUsageRows,
  parseScopedChatKitUser,
  sumOpenAICostsInCents,
  sumOpenAICompletionsUsage,
} from "../../lib/openaiUsage.ts";

test("listOpenAICompletionsUsageRows parses bucketed usage rows", () => {
  const rows = listOpenAICompletionsUsageRows({
    data: [
      {
        start_time: 100,
        end_time: 200,
        results: [
          {
            user_id: "clerk:user_123:team:team_abc:project:project_xyz",
            model: "gpt-4o-mini-2024-07-18",
            input_tokens: 1200,
            output_tokens: 400,
            input_cached_tokens: 300,
            num_model_requests: 2,
          },
        ],
      },
    ],
  });

  assert.deepEqual(rows, [
    {
      bucketStartMs: 100_000,
      bucketEndMs: 200_000,
      userId: "clerk:user_123:team:team_abc:project:project_xyz",
      model: "gpt-4o-mini-2024-07-18",
      inputTokens: 1200,
      outputTokens: 400,
      cachedInputTokens: 300,
      requests: 2,
    },
  ]);
});

test("sumOpenAICompletionsUsage aggregates parsed rows", () => {
  const totals = sumOpenAICompletionsUsage({
    data: [
      {
        start_time: 100,
        end_time: 200,
        results: [
          {
            user_id: "clerk:user_123:team:team_abc:project:project_xyz",
            model: "gpt-4o-mini-2024-07-18",
            input_tokens: 1200,
            output_tokens: 400,
            input_cached_tokens: 300,
            num_model_requests: 2,
          },
          {
            user_id: "clerk:user_456:team:team_def:project:project_qwe",
            model: "gpt-4o-2024-08-06",
            input_tokens: 800,
            output_tokens: 100,
            input_cached_tokens: 50,
            num_model_requests: 1,
          },
        ],
      },
    ],
  });

  assert.deepEqual(totals, {
    inputTokens: 2000,
    outputTokens: 500,
    cachedInputTokens: 350,
    requests: 3,
  });
});

test("parseScopedChatKitUser extracts team and project scope", () => {
  assert.deepEqual(
    parseScopedChatKitUser("clerk:user_123:team:team_abc:project:project_xyz"),
    {
      rawUserId: "clerk:user_123:team:team_abc:project:project_xyz",
      clerkUserId: "user_123",
      teamId: "team_abc",
      projectId: "project_xyz",
    },
  );
});

test("parseScopedChatKitUser rejects malformed user ids", () => {
  assert.equal(parseScopedChatKitUser("user_123"), null);
});

test("estimateOpenAITextUsageCostCents respects cached input pricing", () => {
  const costCents = estimateOpenAITextUsageCostCents({
    model: "gpt-5-mini-2025-08-07",
    inputTokens: 2_000_000,
    cachedInputTokens: 1_000_000,
    outputTokens: 500_000,
  });

  assert.equal(costCents, 127);
});

test("sumOpenAICostsInCents aggregates line item amounts", () => {
  const totalCostCents = sumOpenAICostsInCents({
    data: [
      {
        start_time: 100,
        end_time: 200,
        results: [
          {
            line_items: [
              { amount: { value: 1.25, currency: "usd" } },
              { amount: { value: 0.5, currency: "usd" } },
            ],
          },
        ],
      },
      {
        start_time: 200,
        end_time: 300,
        results: [
          {
            amount: { value: 0.25, currency: "usd" },
          },
        ],
      },
    ],
  });

  assert.equal(totalCostCents, 200);
});

test("listOpenAICostBuckets returns timestamped bucket totals", () => {
  const buckets = listOpenAICostBuckets({
    data: [
      {
        start_time: 100,
        end_time: 200,
        results: [
          {
            amount: { value: 1.25, currency: "usd" },
          },
        ],
      },
      {
        start_time: 200,
        end_time: 300,
        results: [
          {
            line_items: [
              { amount: { amount_cents: 99 } },
              { amount: { cents: 51 } },
            ],
          },
        ],
      },
    ],
  });

  assert.deepEqual(buckets, [
    {
      bucketStartMs: 100_000,
      bucketEndMs: 200_000,
      totalCostCents: 125,
    },
    {
      bucketStartMs: 200_000,
      bucketEndMs: 300_000,
      totalCostCents: 150,
    },
  ]);
});
