"use node";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { v } from "convex/values";

import { internalAction } from "../_generated/server";
import {
  estimateOpenAITextUsageCostCents,
  listOpenAICostBuckets,
  listOpenAICompletionsUsageRows,
  parseScopedChatKitUser,
} from "../../lib/openaiUsage";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const internalAny = require("../_generated/api").internal as any;

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com";

type TeamWindow = {
  teamId: string;
  billingWindowStart: number;
  billingWindowEnd: number;
};

type TeamAllocationTotals = {
  allocatedCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedInputTokens: number;
  totalRequests: number;
};

const extractErrorMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const root = payload as Record<string, unknown>;
  const nestedError = root.error;

  if (typeof nestedError === "string" && nestedError.trim()) {
    return nestedError;
  }

  if (nestedError && typeof nestedError === "object") {
    const message = (nestedError as Record<string, unknown>).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
};

const buildOpenAIUrl = (
  pathname: string,
  params: Record<string, string | number | undefined>,
  arrays: Record<string, string[]>,
) => {
  const url = new URL(pathname, process.env.OPENAI_API_BASE_URL?.trim() || DEFAULT_OPENAI_BASE_URL);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  for (const [key, values] of Object.entries(arrays)) {
    for (const value of values) {
      if (value.trim()) {
        url.searchParams.append(key, value);
      }
    }
  }

  return url.toString();
};

const fetchOpenAIPage = async (url: string, apiKey: string) => {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, `OpenAI request failed with status ${response.status}`));
  }

  return payload as Record<string, unknown> | null;
};

const fetchAllOpenAIData = async (
  pathname: string,
  params: Record<string, string | number | undefined>,
  arrays: Record<string, string[]>,
  apiKey: string,
) => {
  const aggregatedData: unknown[] = [];
  let nextPage: string | null = null;

  for (;;) {
    const url = buildOpenAIUrl(
      pathname,
      nextPage ? { ...params, page: nextPage } : params,
      arrays,
    );
    const payload = await fetchOpenAIPage(url, apiKey);

    const data = Array.isArray(payload?.data) ? payload.data : [];
    aggregatedData.push(...data);

    const next = payload && typeof payload.next_page === "string" && payload.next_page.trim()
      ? payload.next_page.trim()
      : null;

    if (!next) {
      return {
        ...payload,
        data: aggregatedData,
      };
    }

    nextPage = next;
  }
};

const bucketOverlapsWindow = (
  bucketStartMs: number,
  bucketEndMs: number,
  windowStartMs: number,
  windowEndMs: number,
) => bucketStartMs < windowEndMs && bucketEndMs > windowStartMs;

const getTeamTotals = (
  totalsByTeam: Map<string, TeamAllocationTotals>,
  teamId: string,
) => {
  const existing = totalsByTeam.get(teamId);
  if (existing) {
    return existing;
  }

  const created: TeamAllocationTotals = {
    allocatedCostCents: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCachedInputTokens: 0,
    totalRequests: 0,
  };
  totalsByTeam.set(teamId, created);
  return created;
};

export const reconcileHostedChatKitUsage = internalAction({
  args: {},
  returns: v.object({
    processedTeams: v.number(),
    skippedTeams: v.number(),
    failedTeams: v.number(),
  }),
  handler: async (ctx) => {
    const adminApiKey = process.env.OPENAI_ADMIN_API_KEY?.trim();
    const openaiProjectId = process.env.OPENAI_PROJECT_ID?.trim();

    if (!adminApiKey || !openaiProjectId) {
      return {
        processedTeams: 0,
        skippedTeams: 0,
        failedTeams: 0,
      };
    }

    const teams = (await ctx.runQuery(
      internalAny.ai.hostedChatkitBilling.listTeamsForHostedChatKitReconciliation,
      {},
    )) as Array<{
      teamId: string;
      billingWindowStart: number;
      billingWindowEnd: number;
      syncedCostCents: number;
      syncedWindowStart?: number;
      syncedWindowEnd?: number;
    }>;

    if (teams.length === 0) {
      return {
        processedTeams: 0,
        skippedTeams: 0,
        failedTeams: 0,
      };
    }

    const syncedAt = Date.now();
    const minWindowStart = Math.min(...teams.map((team) => team.billingWindowStart));
    const maxWindowEnd = Math.max(...teams.map((team) => team.billingWindowEnd));
    const startTime = Math.floor(minWindowStart / 1000);
    const endTime = Math.floor(maxWindowEnd / 1000);

    try {
      const [usagePayload, costPayload] = await Promise.all([
        fetchAllOpenAIData(
          "/v1/organization/usage/completions",
          {
            start_time: startTime,
            end_time: endTime,
            bucket_width: "1d",
          },
          {
            project_ids: [openaiProjectId],
            group_by: ["user_id", "model"],
          },
          adminApiKey,
        ),
        fetchAllOpenAIData(
          "/v1/organization/costs",
          {
            start_time: startTime,
            end_time: endTime,
            bucket_width: "1d",
          },
          {
            project_ids: [openaiProjectId],
          },
          adminApiKey,
        ),
      ]);

      const usageRows = listOpenAICompletionsUsageRows(usagePayload)
        .map((row) => ({
          ...row,
          scopedUser: parseScopedChatKitUser(row.userId),
          estimatedCostCents: estimateOpenAITextUsageCostCents(row),
        }))
        .filter((row) => row.scopedUser && row.bucketStartMs > 0 && row.bucketEndMs > 0);

      const usageRowsByBucket = new Map<
        string,
        Array<typeof usageRows[number]>
      >();

      for (const row of usageRows) {
        const key = `${row.bucketStartMs}:${row.bucketEndMs}`;
        const bucketRows = usageRowsByBucket.get(key) ?? [];
        bucketRows.push(row);
        usageRowsByBucket.set(key, bucketRows);
      }

      const totalsByTeam = new Map<string, TeamAllocationTotals>();
      const teamWindowsById = new Map<string, TeamWindow>(
        teams.map((team) => [
          team.teamId,
          {
            teamId: team.teamId,
            billingWindowStart: team.billingWindowStart,
            billingWindowEnd: team.billingWindowEnd,
          },
        ]),
      );

      for (const bucket of listOpenAICostBuckets(costPayload)) {
        if (bucket.bucketStartMs <= 0 || bucket.bucketEndMs <= 0) {
          continue;
        }

        const key = `${bucket.bucketStartMs}:${bucket.bucketEndMs}`;
        const bucketUsageRows = usageRowsByBucket.get(key) ?? [];

        const estimatedByTeam = new Map<string, number>();
        let totalEstimatedCostCents = 0;

        for (const row of bucketUsageRows) {
          const scopedUser = row.scopedUser;
          if (!scopedUser) continue;

          const teamWindow = teamWindowsById.get(scopedUser.teamId);
          if (!teamWindow) continue;
          if (!bucketOverlapsWindow(
            row.bucketStartMs,
            row.bucketEndMs,
            teamWindow.billingWindowStart,
            teamWindow.billingWindowEnd,
          )) {
            continue;
          }

          const nextEstimated =
            (estimatedByTeam.get(scopedUser.teamId) ?? 0) + row.estimatedCostCents;
          estimatedByTeam.set(scopedUser.teamId, nextEstimated);
          totalEstimatedCostCents += row.estimatedCostCents;

          const totals = getTeamTotals(totalsByTeam, scopedUser.teamId);
          totals.totalInputTokens += row.inputTokens;
          totals.totalOutputTokens += row.outputTokens;
          totals.totalCachedInputTokens += row.cachedInputTokens;
          totals.totalRequests += row.requests;
        }

        if (bucket.totalCostCents <= 0 || totalEstimatedCostCents <= 0) {
          continue;
        }

        for (const [teamId, estimatedCostCents] of estimatedByTeam.entries()) {
          const share = estimatedCostCents / totalEstimatedCostCents;
          const allocatedCostCents = Math.round(bucket.totalCostCents * share);
          const totals = getTeamTotals(totalsByTeam, teamId);
          totals.allocatedCostCents += allocatedCostCents;
        }
      }

      let processedTeams = 0;
      let failedTeams = 0;

      for (const team of teams) {
        const totals = totalsByTeam.get(team.teamId) ?? {
          allocatedCostCents: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCachedInputTokens: 0,
          totalRequests: 0,
        };

        try {
          await ctx.runMutation(
            internalAny.ai.hostedChatkitBilling.applyTeamHostedChatKitReconciliation,
            {
              teamId: team.teamId,
              sourceProjectId: openaiProjectId,
              billingWindowStart: team.billingWindowStart,
              billingWindowEnd: team.billingWindowEnd,
              allocatedTotalCostCents: totals.allocatedCostCents,
              totalInputTokens: totals.totalInputTokens,
              totalOutputTokens: totals.totalOutputTokens,
              totalCachedInputTokens: totals.totalCachedInputTokens,
              totalRequests: totals.totalRequests,
              syncedAt,
            },
          );
          processedTeams += 1;
        } catch (error) {
          failedTeams += 1;
          await ctx.runMutation(
            internalAny.ai.hostedChatkitBilling.recordHostedChatKitSyncError,
            {
              teamId: team.teamId,
              sourceProjectId: openaiProjectId,
              billingWindowStart: team.billingWindowStart,
              billingWindowEnd: team.billingWindowEnd,
              syncedAt,
              errorMessage:
                error instanceof Error ? error.message : "Failed to apply hosted ChatKit reconciliation.",
            },
          );
        }
      }

      return {
        processedTeams,
        skippedTeams: 0,
        failedTeams,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to reconcile hosted ChatKit usage.";

      for (const team of teams) {
        await ctx.runMutation(
          internalAny.ai.hostedChatkitBilling.recordHostedChatKitSyncError,
          {
            teamId: team.teamId,
            sourceProjectId: openaiProjectId,
            billingWindowStart: team.billingWindowStart,
            billingWindowEnd: team.billingWindowEnd,
            syncedAt,
            errorMessage,
          },
        );
      }

      return {
        processedTeams: 0,
        skippedTeams: 0,
        failedTeams: teams.length,
      };
    }
  },
});
