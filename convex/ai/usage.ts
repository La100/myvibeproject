import { v } from "convex/values";
import { internalMutation, query } from "../_generated/server";
import { getBillingWindow, SUBSCRIPTION_PLANS } from "../stripe";

// ====== TOKEN USAGE TRACKING ======

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
    
    contextSize: v.optional(v.number()),
    mode: v.optional(v.string()),
    estimatedCostCents: v.optional(v.number()),
    responseTimeMs: v.optional(v.number()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const [hadPreviousTokenUsage, hadPreviousImageUsage] = await Promise.all([
      ctx.db
        .query("aiTokenUsage")
        .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
        .first(),
      ctx.db
        .query("aiGeneratedImages")
        .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
        .first(),
    ]);

    const resolvedFeature =
      args.feature ||
      (args.requestType === "chat" ? "assistant" : "other");

    // Insert usage record
    const usageId = await ctx.db.insert("aiTokenUsage", {
      ...args,
      feature: resolvedFeature,
    });

    // Decrement aiTokens from team. If balance was never initialized, seed from plan limit first.
    const team = await ctx.db.get(args.teamId);
    if (team) {
      const plan = (team.subscriptionPlan || "free") as keyof typeof SUBSCRIPTION_PLANS;
      const defaultPlanTokens = SUBSCRIPTION_PLANS[plan]?.aiMonthlyTokens ?? 0;
      const storedPlanTokens = team.subscriptionLimits?.aiMonthlyTokens;
      const planTokens =
        plan === "free"
          ? defaultPlanTokens
          : (storedPlanTokens ?? defaultPlanTokens);
      const isLegacyFreeZeroBalance =
        plan === "free" &&
        team.aiTokens === 0 &&
        ((storedPlanTokens ?? 0) <= 0) &&
        !hadPreviousTokenUsage &&
        !hadPreviousImageUsage;
      const currentBalance =
        typeof team.aiTokens === "number" && !isLegacyFreeZeroBalance
          ? (
              plan === "free"
                ? Math.min(Math.max(0, team.aiTokens), Math.max(0, planTokens))
                : Math.max(0, team.aiTokens)
            )
          : Math.max(0, planTokens);
      const newBalance = Math.max(0, currentBalance - args.totalTokens);
      await ctx.db.patch(args.teamId, { aiTokens: newBalance });
    }

    return usageId;
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
    const totalTokens = usage.reduce((sum, record) => sum + record.totalTokens, 0);
    const totalCostCents = usage.reduce((sum, record) => sum + (record.estimatedCostCents || 0), 0);
    const totalRequests = usage.length;
    const successfulRequests = usage.filter(r => r.success).length;

    // Calculate by mode
    const fullModeUsage = usage.filter(r => r.mode === "full");
    const smartModeUsage = usage.filter(r => r.mode === "smart");

    // Daily breakdown
    const dailyUsage = usage.reduce((acc, record) => {
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
      acc[date].totalTokens += record.totalTokens;
      acc[date].costCents += record.estimatedCostCents || 0;
      return acc;
    }, {} as Record<string, any>);

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
          tokens: fullModeUsage.reduce((sum, r) => sum + r.totalTokens, 0),
          cost: fullModeUsage.reduce((sum, r) => sum + (r.estimatedCostCents || 0), 0),
        },
        smart: {
          requests: smartModeUsage.length,
          tokens: smartModeUsage.reduce((sum, r) => sum + r.totalTokens, 0),
          cost: smartModeUsage.reduce((sum, r) => sum + (r.estimatedCostCents || 0), 0),
        }
      },
      dailyBreakdown: Object.values(dailyUsage).sort((a: any, b: any) => b.date.localeCompare(a.date)),
      recentRequests: usage
        .sort((a, b) => b._creationTime - a._creationTime)
        .slice(0, 10)
        .map(record => ({
          date: new Date(record._creationTime).toISOString(),
          mode: record.mode,
          inputTokens: record.inputTokens,
          outputTokens: record.outputTokens,
          totalTokens: record.totalTokens,
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

    // TODO: Check if user has access to team

    const days = args.days || 30;
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    const usage = await ctx.db
      .query("aiTokenUsage")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.gte(q.field("_creationTime"), cutoffTime))
      .collect();

    const totalTokens = usage.reduce((sum, record) => sum + record.totalTokens, 0);
    const totalCostCents = usage.reduce((sum, record) => sum + (record.estimatedCostCents || 0), 0);

    // By project breakdown
    const byProject = usage.reduce((acc, record) => {
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
      acc[projectId].tokens += record.totalTokens;
      acc[projectId].costCents += record.estimatedCostCents || 0;
      return acc;
    }, {} as Record<string, any>);

    return {
      totalRequests: usage.length,
      totalTokens,
      totalCostCents,
      totalCostUSD: totalCostCents / 100,
      byProject: Object.values(byProject).sort((a: any, b: any) => b.tokens - a.tokens),
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
        acc.totalTokens += record.totalTokens;
        acc.byFeature[feature] = (acc.byFeature[feature] || 0) + record.totalTokens;
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

    return {
      periodStart: start,
      periodEnd: end,
      totalTokens: totals.totalTokens,
      byFeature: totals.byFeature,
    };
  },
});
