import { v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getBillingWindow, getEffectiveLimits, SUBSCRIPTION_PLANS } from "../stripe";
import { ensureProjectAccess } from "./access";
import { ensureTeamAccess } from "../authz";

// ====== TOKEN USAGE TRACKING ======

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

const INTERNAL_CREDIT_COST_PER_1M_USD = 5;
const CLOUDFLARE_BROWSER_RENDERING_COST_PER_HOUR_USD = 0.09;
const MAX_PUBLIC_USAGE_TOKENS = 100_000;
const MAX_BROWSER_RENDERING_MS = 60_000;

const normalizePublicUsageNumber = (
  value: number | undefined,
  max = MAX_PUBLIC_USAGE_TOKENS,
) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.min(Math.round(value), max);
};

const creditsFromBrowserRenderingMs = (browserMs: number) => {
  const normalizedMs = normalizePublicUsageNumber(browserMs, MAX_BROWSER_RENDERING_MS);
  const costUsd =
    (normalizedMs / 3_600_000) * CLOUDFLARE_BROWSER_RENDERING_COST_PER_HOUR_USD;
  return Math.max(
    0,
    Math.ceil((costUsd / INTERNAL_CREDIT_COST_PER_1M_USD) * 1_000_000),
  );
};

type DailyUsageRow = {
  date: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costCents: number;
};

type ProjectUsageRow = {
  projectId: Id<"projects"> | "unknown";
  requests: number;
  tokens: number;
  costCents: number;
};

/**
 * Save AI token usage statistics
 * Called internally after each AI request
 */
export const saveTokenUsage = internalMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    teamId: v.id("teams"),
    userClerkId: v.string(),
    threadId: v.optional(v.string()),
    
    model: v.string(),
    feature: v.optional(v.union(
      v.literal("assistant"),
      v.literal("visualizations"),
      v.literal("other")
    )),
    requestType: v.union(v.literal("chat"), v.literal("embedding"), v.literal("other")),
    
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    billableTokens: v.optional(v.number()),
    
    contextSize: v.optional(v.number()),
    mode: v.optional(v.string()),
    estimatedCostCents: v.optional(v.number()),
    responseTimeMs: v.optional(v.number()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const resolvedFeature =
      args.feature ||
      (args.requestType === "chat" ? "assistant" : "other");
    const billableTokens = Math.max(0, args.billableTokens ?? args.totalTokens);

    const usageId = await ctx.db.insert("aiTokenUsage", {
      ...args,
      feature: resolvedFeature,
      billableTokens,
    });

    const team = await ctx.db.get(args.teamId);
    if (team) {
      const currentBalance = getTeamTokenBalance(team);
      const newBalance = Math.max(0, currentBalance - billableTokens);
      await ctx.db.patch(args.teamId, { aiTokens: newBalance });
    }

    return usageId;
  },
});

export const recordSelfHostedChatKitUsage = mutation({
  args: {
    projectId: v.optional(v.id("projects")),
    teamId: v.id("teams"),
    threadId: v.optional(v.string()),
    model: v.string(),
    feature: v.optional(
      v.union(v.literal("assistant"), v.literal("visualizations"), v.literal("other")),
    ),
    requestType: v.union(v.literal("chat"), v.literal("embedding"), v.literal("other")),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    billableTokens: v.optional(v.number()),
    contextSize: v.optional(v.number()),
    mode: v.optional(v.string()),
    estimatedCostCents: v.optional(v.number()),
    responseTimeMs: v.optional(v.number()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    let clerkUserId: string;

    if (args.projectId) {
      const { clerkUserId: nextClerkUserId, project } = await ensureProjectAccess(ctx, args.projectId);
      if (project.teamId !== args.teamId) {
        throw new Error("Project does not belong to the provided team");
      }
      clerkUserId = nextClerkUserId;
    } else {
      const teamAccess = await ensureTeamAccess(ctx, args.teamId);
      clerkUserId = teamAccess.clerkUserId;
    }

    const normalizedResponseTimeMs =
      args.responseTimeMs === undefined
        ? undefined
        : normalizePublicUsageNumber(args.responseTimeMs, MAX_BROWSER_RENDERING_MS);
    const sanitizedTotalTokens = normalizePublicUsageNumber(args.totalTokens);
    const payload = {
      ...args,
      inputTokens: normalizePublicUsageNumber(args.inputTokens),
      outputTokens: normalizePublicUsageNumber(args.outputTokens),
      totalTokens: sanitizedTotalTokens,
      billableTokens:
        args.mode === "chatkit_scrape"
          ? creditsFromBrowserRenderingMs(normalizedResponseTimeMs ?? 0)
          : normalizePublicUsageNumber(args.billableTokens ?? sanitizedTotalTokens),
      estimatedCostCents:
        args.estimatedCostCents === undefined
          ? undefined
          : normalizePublicUsageNumber(args.estimatedCostCents, 10_000),
      responseTimeMs: normalizedResponseTimeMs,
      userClerkId: clerkUserId,
    };
    const resolvedFeature =
      payload.feature ||
      (payload.requestType === "chat" ? "assistant" : "other");
    const billableTokens = payload.billableTokens;

    const usageId = await ctx.db.insert("aiTokenUsage", {
      ...payload,
      feature: resolvedFeature,
      billableTokens,
    });

    const team = await ctx.db.get(payload.teamId);
    if (team) {
      const currentBalance = getTeamTokenBalance(team);
      const newBalance = Math.max(0, currentBalance - billableTokens);
      await ctx.db.patch(payload.teamId, { aiTokens: newBalance });
    }

    return usageId;
  },
});

export const refundTokenUsage = internalMutation({
  args: {
    usageId: v.id("aiTokenUsage"),
    errorMessage: v.string(),
  },
  returns: v.object({
    refunded: v.boolean(),
    refundedTokens: v.number(),
  }),
  handler: async (ctx, args) => {
    const usage = await ctx.db.get(args.usageId);
    if (!usage) {
      return { refunded: false, refundedTokens: 0 };
    }

    const refundedTokens = Math.max(0, usage.billableTokens ?? usage.totalTokens);
    const existingError = usage.errorMessage?.trim();
    const nextErrorMessage = existingError
      ? `${existingError} | Refunded: ${args.errorMessage}`
      : `Refunded: ${args.errorMessage}`;

    await ctx.db.patch(args.usageId, {
      billableTokens: 0,
      estimatedCostCents: 0,
      success: false,
      errorMessage: nextErrorMessage,
    });

    if (refundedTokens <= 0) {
      return { refunded: false, refundedTokens: 0 };
    }

    const team = await ctx.db.get(usage.teamId);
    if (team) {
      const currentBalance = getTeamTokenBalance(team);
      await ctx.db.patch(usage.teamId, {
        aiTokens: currentBalance + refundedTokens,
      });
    }

    return {
      refunded: true,
      refundedTokens,
    };
  },
});

/**
 * Get token usage statistics for a project
 */
export const getProjectTokenUsage = query({
  args: {
    projectId: v.id("projects"),
    days: v.optional(v.number()), // Last N days, default 30
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");
    if (!project.teamId) throw new Error("Project has no team assigned");

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();
    if (!membership || !membership.isActive) {
      throw new Error("Not authorized to view this project usage");
    }

    const days = args.days || 30;
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    const usage = await ctx.db
      .query("aiTokenUsage")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.gte(q.field("_creationTime"), cutoffTime))
      .collect();

    // Calculate totals
    const totalInputTokens = usage.reduce((sum, record) => sum + record.inputTokens, 0);
    const totalOutputTokens = usage.reduce((sum, record) => sum + record.outputTokens, 0);
    const totalTokens = usage.reduce(
      (sum, record) => sum + (record.billableTokens ?? record.totalTokens),
      0
    );
    const totalCostCents = usage.reduce((sum, record) => sum + (record.estimatedCostCents || 0), 0);
    const totalRequests = usage.length;
    const successfulRequests = usage.filter(r => r.success).length;

    // Calculate by mode
    const fullModeUsage = usage.filter(r => r.mode === "full");
    const smartModeUsage = usage.filter(r => r.mode === "smart");

    // Daily breakdown
    const dailyUsage = usage.reduce<Record<string, DailyUsageRow>>((acc, record) => {
      const date = new Date(record._creationTime).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costCents: 0
        };
      }
      acc[date].requests++;
      acc[date].inputTokens += record.inputTokens;
      acc[date].outputTokens += record.outputTokens;
      acc[date].totalTokens += record.billableTokens ?? record.totalTokens;
      acc[date].costCents += record.estimatedCostCents || 0;
      return acc;
    }, {});

    return {
      summary: {
        totalRequests,
        successfulRequests,
        successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
        totalInputTokens,
        totalOutputTokens,
        totalTokens,
        totalCostCents,
        totalCostUSD: totalCostCents / 100,
        averageTokensPerRequest: totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0,
        averageCostPerRequest: totalRequests > 0 ? totalCostCents / totalRequests : 0,
      },
      byMode: {
        full: {
          requests: fullModeUsage.length,
          tokens: fullModeUsage.reduce(
            (sum, r) => sum + (r.billableTokens ?? r.totalTokens),
            0
          ),
          cost: fullModeUsage.reduce((sum, r) => sum + (r.estimatedCostCents || 0), 0),
        },
        smart: {
          requests: smartModeUsage.length,
          tokens: smartModeUsage.reduce(
            (sum, r) => sum + (r.billableTokens ?? r.totalTokens),
            0
          ),
          cost: smartModeUsage.reduce((sum, r) => sum + (r.estimatedCostCents || 0), 0),
        }
      },
      dailyBreakdown: Object.values(dailyUsage).sort((a, b) => b.date.localeCompare(a.date)),
      recentRequests: usage
        .sort((a, b) => b._creationTime - a._creationTime)
        .slice(0, 10)
        .map(record => ({
          date: new Date(record._creationTime).toISOString(),
          mode: record.mode,
          inputTokens: record.inputTokens,
          outputTokens: record.outputTokens,
          totalTokens: record.billableTokens ?? record.totalTokens,
          costCents: record.estimatedCostCents,
          success: record.success,
          responseTime: record.responseTimeMs,
        }))
    };
  },
});

/**
 * Get team-wide token usage statistics
 */
export const getTeamTokenUsage = query({
  args: {
    teamId: v.id("teams"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();
    if (!membership || !membership.isActive) {
      throw new Error("Not authorized to view this team usage");
    }

    const days = args.days || 30;
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    const usage = await ctx.db
      .query("aiTokenUsage")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.gte(q.field("_creationTime"), cutoffTime))
      .collect();

    const totalTokens = usage.reduce(
      (sum, record) => sum + (record.billableTokens ?? record.totalTokens),
      0
    );
    const totalCostCents = usage.reduce((sum, record) => sum + (record.estimatedCostCents || 0), 0);

    // By project breakdown
    const byProject = usage.reduce<Record<string, ProjectUsageRow>>((acc, record) => {
      const projectId = record.projectId ?? "unknown";
      if (!acc[projectId]) {
        acc[projectId] = {
          projectId,
          requests: 0,
          tokens: 0,
          costCents: 0,
        };
      }
      acc[projectId].requests++;
      acc[projectId].tokens += record.billableTokens ?? record.totalTokens;
      acc[projectId].costCents += record.estimatedCostCents || 0;
      return acc;
    }, {});

    return {
      totalRequests: usage.length,
      totalTokens,
      totalCostCents,
      totalCostUSD: totalCostCents / 100,
      byProject: Object.values(byProject).sort((a, b) => b.tokens - a.tokens),
    };
  },
});

/**
 * Get team token usage breakdown by feature for current billing period
 */
export const getTeamUsageBreakdown = query({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!membership || !membership.isActive) {
      throw new Error("Not authorized to view this team");
    }

    const { start, end } = getBillingWindow(team);

    const usage = await ctx.db
      .query("aiTokenUsage")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) =>
        q.and(
          q.gte(q.field("_creationTime"), start),
          q.lte(q.field("_creationTime"), end)
        )
      )
      .collect();

    const totals = usage.reduce(
      (acc, record) => {
        const feature =
          record.feature ||
          (record.requestType === "chat" ? "assistant" : "other");
        const billable = record.billableTokens ?? record.totalTokens;
        acc.totalTokens += billable;
        acc.byFeature[feature] = (acc.byFeature[feature] || 0) + billable;
        return acc;
      },
      {
        totalTokens: 0,
        byFeature: {
          assistant: 0,
          visualizations: 0,
          other: 0,
        } as Record<string, number>,
      }
    );
    const plan = (team.subscriptionPlan ||
      "free") as keyof typeof SUBSCRIPTION_PLANS;
    const planTokens = Math.max(
      0,
      getEffectiveLimits(team)?.aiMonthlyTokens ?? 0,
    );
    const balanceDerivedUsed =
      plan === "free" && typeof team.aiTokens === "number"
        ? Math.max(0, planTokens - Math.max(0, team.aiTokens))
        : 0;
    const totalTokens = Math.max(totals.totalTokens, balanceDerivedUsed);

    return {
      periodStart: start,
      periodEnd: end,
      totalTokens,
      byFeature: totals.byFeature,
    };
  },
});
