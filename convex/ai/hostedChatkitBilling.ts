import { v } from "convex/values";

import { internalMutation, internalQuery } from "../_generated/server";
import { centsToCredits } from "./billing";
import { getBillingWindow, getEffectiveLimits, SUBSCRIPTION_PLANS } from "../stripe";

const getTeamTokenBalance = (team: {
  subscriptionPlan?: string;
  aiTokens?: number;
}) => {
  const plan = (team.subscriptionPlan || "free") as keyof typeof SUBSCRIPTION_PLANS;
  const planTokens = Math.max(0, getEffectiveLimits(team)?.aiMonthlyTokens ?? 0);

  if (typeof team.aiTokens !== "number") {
    return Math.max(0, planTokens);
  }

  if (plan === "free") {
    return Math.min(Math.max(0, team.aiTokens), Math.max(0, planTokens));
  }

  return Math.max(0, team.aiTokens);
};

export const listTeamsForHostedChatKitReconciliation = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      teamId: v.id("teams"),
      billingWindowStart: v.number(),
      billingWindowEnd: v.number(),
      syncedCostCents: v.number(),
      syncedWindowStart: v.optional(v.number()),
      syncedWindowEnd: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const teams = await ctx.db.query("teams").collect();

    return teams.map((team) => {
      const { start, end } = getBillingWindow(team);

      return {
        teamId: team._id,
        billingWindowStart: start,
        billingWindowEnd: end,
        syncedCostCents: Math.max(0, team.aiHostedChatKitSyncedCostCents ?? 0),
        syncedWindowStart: team.aiHostedChatKitSyncedWindowStart,
        syncedWindowEnd: team.aiHostedChatKitSyncedWindowEnd,
      };
    });
  },
});

export const applyTeamHostedChatKitReconciliation = internalMutation({
  args: {
    teamId: v.id("teams"),
    sourceProjectId: v.string(),
    billingWindowStart: v.number(),
    billingWindowEnd: v.number(),
    allocatedTotalCostCents: v.number(),
    totalInputTokens: v.optional(v.number()),
    totalOutputTokens: v.optional(v.number()),
    totalCachedInputTokens: v.optional(v.number()),
    totalRequests: v.optional(v.number()),
    syncedAt: v.number(),
  },
  returns: v.object({
    deltaCostCents: v.number(),
    deltaCredits: v.number(),
    syncStatus: v.union(
      v.literal("applied"),
      v.literal("noop"),
      v.literal("refunded"),
    ),
  }),
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const sameBillingWindow =
      team.aiHostedChatKitSyncedWindowStart === args.billingWindowStart &&
      team.aiHostedChatKitSyncedWindowEnd === args.billingWindowEnd;
    const previousCostCents = sameBillingWindow
      ? Math.max(0, team.aiHostedChatKitSyncedCostCents ?? 0)
      : 0;
    const totalCostCents = Math.max(0, Math.round(args.allocatedTotalCostCents));
    const deltaCostCents = totalCostCents - previousCostCents;
    const deltaCredits = centsToCredits(Math.abs(deltaCostCents));

    let nextBalance = getTeamTokenBalance(team);
    let syncStatus: "applied" | "noop" | "refunded" = "noop";

    if (deltaCostCents > 0 && deltaCredits > 0) {
      nextBalance = Math.max(0, nextBalance - deltaCredits);
      syncStatus = "applied";
    } else if (deltaCostCents < 0 && deltaCredits > 0) {
      nextBalance += deltaCredits;
      syncStatus = "refunded";
    }

    await ctx.db.patch(args.teamId, {
      aiTokens: nextBalance,
      aiHostedChatKitSyncedCostCents: totalCostCents,
      aiHostedChatKitSyncedWindowStart: args.billingWindowStart,
      aiHostedChatKitSyncedWindowEnd: args.billingWindowEnd,
      aiHostedChatKitLastSyncedAt: args.syncedAt,
      aiHostedChatKitLastSyncError: undefined,
    });

    await ctx.db.insert("aiProviderUsageSnapshots", {
      teamId: args.teamId,
      provider: "openai",
      product: "chatkit_hosted",
      openaiProjectId: args.sourceProjectId,
      billingWindowStart: args.billingWindowStart,
      billingWindowEnd: args.billingWindowEnd,
      totalCostCents,
      deltaCostCents,
      deltaCredits,
      totalInputTokens: args.totalInputTokens,
      totalOutputTokens: args.totalOutputTokens,
      totalCachedInputTokens: args.totalCachedInputTokens,
      totalRequests: args.totalRequests,
      syncStatus,
      syncedAt: args.syncedAt,
    });

    return {
      deltaCostCents,
      deltaCredits,
      syncStatus,
    };
  },
});

export const recordHostedChatKitSyncError = internalMutation({
  args: {
    teamId: v.id("teams"),
    sourceProjectId: v.string(),
    billingWindowStart: v.number(),
    billingWindowEnd: v.number(),
    syncedAt: v.number(),
    errorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.teamId, {
      aiHostedChatKitLastSyncedAt: args.syncedAt,
      aiHostedChatKitLastSyncError: args.errorMessage,
    });

    await ctx.db.insert("aiProviderUsageSnapshots", {
      teamId: args.teamId,
      provider: "openai",
      product: "chatkit_hosted",
      openaiProjectId: args.sourceProjectId,
      billingWindowStart: args.billingWindowStart,
      billingWindowEnd: args.billingWindowEnd,
      totalCostCents: 0,
      deltaCostCents: 0,
      deltaCredits: 0,
      syncStatus: "error",
      syncedAt: args.syncedAt,
      errorMessage: args.errorMessage,
    });

    return null;
  },
});
