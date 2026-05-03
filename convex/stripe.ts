import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { components } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { usdToCredits } from "./ai/billing";
import {
  AI_PRO_MONTHLY_TOKENS,
  AI_SCALE_MONTHLY_TOKENS,
  PRO_MONTHLY_TOKENS,
  ENTERPRISE_MONTHLY_TOKENS,
} from "../lib/aiPricing";

const DEFAULT_BILLING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const FREE_TRIAL_AI_BUDGET_USD = 1;
const SUBSCRIPTION_EMAIL_SENDING_TIMEOUT_MS = 10 * 60 * 1000;
const tokenBudgetFromUsd = (usd: number) => usdToCredits(usd);

// Token system - direct token usage tracking
// Stripe subscription plans configuration
export const SUBSCRIPTION_PLANS = {
  free: {
    id: "free",
    name: "Free",
    maxProjects: 3,
    maxTeamMembers: 1,
    maxStorageGB: 1,
    hasAdvancedFeatures: false,
    hasAIFeatures: true,
    price: 0,
    aiMonthlyTokens: tokenBudgetFromUsd(FREE_TRIAL_AI_BUDGET_USD),
  },
  basic: {
    id: "basic",
    name: "Basic",
    maxProjects: 10,
    maxTeamMembers: 15,
    maxStorageGB: 10,
    hasAdvancedFeatures: false,
    hasAIFeatures: false,
    price: 19,
    aiMonthlyTokens: 0,
  },
  ai: {
    id: "ai",
    name: "AI Pro",
    maxProjects: 20,
    maxTeamMembers: 2,
    maxStorageGB: 50,
    hasAdvancedFeatures: true,
    hasAIFeatures: true,
    price: 39,
    aiMonthlyTokens: AI_PRO_MONTHLY_TOKENS, // 60k credits per $1
  },
  ai_scale: {
    id: "ai_scale",
    name: "AI Scale",
    maxProjects: 75,
    maxTeamMembers: 100,
    maxStorageGB: 250,
    hasAdvancedFeatures: true,
    hasAIFeatures: true,
    price: 99,
    aiMonthlyTokens: AI_SCALE_MONTHLY_TOKENS, // ~91k credits per $1, 34% better value vs AI Pro
  },
  pro: {
    id: "pro",
    name: "Pro",
    maxProjects: 50,
    maxTeamMembers: 50,
    maxStorageGB: 100,
    hasAdvancedFeatures: true,
    hasAIFeatures: true,
    price: 49,
    aiMonthlyTokens: PRO_MONTHLY_TOKENS, // 60k credits per $1
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    maxProjects: 999,
    maxTeamMembers: 999,
    maxStorageGB: 1000,
    hasAdvancedFeatures: true,
    hasAIFeatures: true,
    price: 199,
    aiMonthlyTokens: ENTERPRISE_MONTHLY_TOKENS, // 60k credits per $1
  },
} as const;

const subscriptionLimitsValidator = v.object({
  id: v.string(),
  name: v.string(),
  maxProjects: v.number(),
  maxTeamMembers: v.number(),
  maxStorageGB: v.number(),
  hasAdvancedFeatures: v.boolean(),
  hasAIFeatures: v.optional(v.boolean()),
  price: v.number(),
  aiMonthlyTokens: v.optional(v.number()),
});

const teamLimitsAdditionalDataValidator = v.optional(
  v.object({
    bytes: v.optional(v.number()),
    current: v.optional(v.number()),
  }),
);

export function getEffectiveLimits(team: any) {
  const plan = (team.subscriptionPlan ||
    "free") as keyof typeof SUBSCRIPTION_PLANS;
  const defaultLimits = SUBSCRIPTION_PLANS[plan];
  const storedLimits = team.subscriptionLimits;

  if (plan === "free") {
    const mergedLimits = {
      ...defaultLimits,
      ...(storedLimits || {}),
    };

    return {
      ...mergedLimits,
      maxTeamMembers: Math.min(
        storedLimits?.maxTeamMembers ?? defaultLimits.maxTeamMembers,
        defaultLimits.maxTeamMembers,
      ),
      hasAIFeatures: true,
      aiMonthlyTokens: defaultLimits.aiMonthlyTokens ?? 0,
    };
  }

  if (plan === "enterprise") {
    return {
      ...defaultLimits,
      ...(storedLimits || {}),
    };
  }

  return {
    ...(storedLimits || {}),
    ...defaultLimits,
  };
}

export function getBillingWindow(team: any) {
  const now = Date.now();
  const start =
    typeof team?.currentPeriodStart === "number"
      ? team.currentPeriodStart
      : now - DEFAULT_BILLING_WINDOW_MS;

  const end =
    typeof team?.currentPeriodEnd === "number"
      ? team.currentPeriodEnd
      : now + DEFAULT_BILLING_WINDOW_MS;

  return { start, end };
}

export const ensureBillingWindow = mutation({
  args: { teamId: v.id("teams") },
  returns: v.object({
    updated: v.boolean(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
  }),
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject),
      )
      .unique();

    if (!membership || !membership.isActive) {
      throw new Error("Not authorized");
    }

    const now = Date.now();
    const hasStart = typeof team.currentPeriodStart === "number";
    const hasEnd = typeof team.currentPeriodEnd === "number";
    const start = hasStart ? team.currentPeriodStart! : now;
    const end = hasEnd
      ? team.currentPeriodEnd!
      : now + DEFAULT_BILLING_WINDOW_MS;

    const canOverride =
      !team.stripeCustomerId ||
      (team.subscriptionStatus !== "active" &&
        team.subscriptionStatus !== "trialing");
    const needsUpdate =
      canOverride &&
      (!hasStart ||
        !hasEnd ||
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        end <= start ||
        end < now);

    if (!needsUpdate) {
      return {
        updated: false,
        currentPeriodStart: start,
        currentPeriodEnd: end,
      };
    }

    const currentPeriodStart = now;
    const currentPeriodEnd = now + DEFAULT_BILLING_WINDOW_MS;

    await ctx.db.patch(args.teamId, {
      currentPeriodStart,
      currentPeriodEnd,
    });

    return {
      updated: true,
      currentPeriodStart,
      currentPeriodEnd,
    };
  },
});

async function evaluateAIAccess(ctx: any, team: any) {
  const plan = (team.subscriptionPlan ||
    "free") as keyof typeof SUBSCRIPTION_PLANS;
  const planTokens = Math.max(
    0,
    getEffectiveLimits(team)?.aiMonthlyTokens ?? 0,
  );
  const shouldUsePlanTokensAsBalance = typeof team.aiTokens !== "number";

  // Simple token system: aiTokens = remaining balance (gets decremented on use)
  const storedRemainingTokens = Math.max(0, team.aiTokens || 0);
  const cappedStoredRemainingTokens =
    plan === "free"
      ? Math.min(storedRemainingTokens, planTokens)
      : storedRemainingTokens;

  const remainingTokens = shouldUsePlanTokensAsBalance
    ? planTokens
    : cappedStoredRemainingTokens;
  const totalTokens =
    plan === "free" ? planTokens : Math.max(remainingTokens, planTokens);
  const usedTokens = shouldUsePlanTokensAsBalance
    ? 0
    : Math.max(0, totalTokens - remainingTokens);

  // If no tokens, deny access
  if (remainingTokens <= 0) {
    return {
      allowed: false,
      message:
        "AI credits are exhausted. Upgrade your plan or manage billing to continue.",
      currentPlan: plan,
      subscriptionStatus: team.subscriptionStatus || null,
      totalTokens,
      usedTokens,
      remainingTokens: 0,
    };
  }

  return {
    allowed: true,
    message: "AI features available",
    currentPlan: plan,
    subscriptionStatus: team.subscriptionStatus || null,
    totalTokens,
    usedTokens,
    remainingTokens,
  };
}

// Add tokens to team (can be called by admin)
export const addAITokens = mutation({
  args: {
    teamId: v.id("teams"),
    tokens: v.number(), // tokens to add
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Only team admin can add tokens
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject),
      )
      .unique();

    if (!membership || membership.role !== "admin") {
      throw new Error("Only admins can add AI tokens");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const currentTokens = team.aiTokens || 0;
    const newTokens = currentTokens + Math.max(args.tokens, 0);

    await ctx.db.patch(args.teamId, {
      aiTokens: newTokens,
    });

    return {
      success: true,
      aiTokens: newTokens,
    };
  },
});

// Get subscription info for a team
export const getTeamSubscription = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Check if user is member of this team
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject),
      )
      .unique();

    if (!membership || !membership.isActive) {
      throw new Error("Not authorized to view this team");
    }

    const plan = (team.subscriptionPlan ||
      "free") as keyof typeof SUBSCRIPTION_PLANS;
    const subscriptionLimits = getEffectiveLimits(team);

    return {
      teamId: args.teamId,
      subscriptionStatus: team.subscriptionStatus || null,
      subscriptionPlan: plan,
      subscriptionId: team.subscriptionId,
      stripeCustomerId: team.stripeCustomerId,
      currentPeriodStart: team.currentPeriodStart,
      currentPeriodEnd: team.currentPeriodEnd,
      trialEnd: team.trialEnd,
      cancelAtPeriodEnd: team.cancelAtPeriodEnd || false,
      limits: subscriptionLimits,
      planDetails: SUBSCRIPTION_PLANS[plan] || SUBSCRIPTION_PLANS.free,
      checkoutPlans: {
        ai: process.env.STRIPE_AI_PRICE_ID || null,
        ai_scale: process.env.STRIPE_AI_SCALE_PRICE_ID || null,
      },
    };
  },
});

// Internal query to get team for Stripe operations
export const getTeamForStripe = internalQuery({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    return await ctx.db.get(args.teamId);
  },
});

// Internal mutation to update team's Stripe customer ID
export const updateTeamStripeCustomer = internalMutation({
  args: {
    teamId: v.id("teams"),
    stripeCustomerId: v.string(),
  },
  async handler(ctx, args) {
    await ctx.db.patch(args.teamId, {
      stripeCustomerId: args.stripeCustomerId,
    });
  },
});

export const updateTeamStripeConnect = internalMutation({
  args: {
    teamId: v.id("teams"),
    stripeConnectAccountId: v.string(),
    stripeConnectAccountType: v.optional(
      v.union(v.literal("express"), v.literal("standard")),
    ),
    stripeConnectChargesEnabled: v.boolean(),
    stripeConnectPayoutsEnabled: v.boolean(),
    stripeConnectDetailsSubmitted: v.boolean(),
    stripeConnectOnboardingComplete: v.boolean(),
    stripeConnectLastSyncedAt: v.number(),
  },
  async handler(ctx, args) {
    await ctx.db.patch(args.teamId, {
      stripeConnectAccountId: args.stripeConnectAccountId,
      stripeConnectAccountType: args.stripeConnectAccountType,
      stripeConnectChargesEnabled: args.stripeConnectChargesEnabled,
      stripeConnectPayoutsEnabled: args.stripeConnectPayoutsEnabled,
      stripeConnectDetailsSubmitted: args.stripeConnectDetailsSubmitted,
      stripeConnectOnboardingComplete: args.stripeConnectOnboardingComplete,
      stripeConnectLastSyncedAt: args.stripeConnectLastSyncedAt,
    });
  },
});

// Internal mutation to sync team subscription from Stripe
export const syncTeamSubscriptionFromStripe = internalMutation({
  args: {
    teamId: v.string(),
    stripeSubscriptionId: v.string(),
    userId: v.optional(v.string()),
  },
  async handler(ctx, args) {
    // Get subscription from Stripe component's database
    const subscription = await ctx.runQuery(
      components.stripe.public.getSubscription,
      { stripeSubscriptionId: args.stripeSubscriptionId },
    );

    if (!subscription) {
      console.log(
        `Subscription ${args.stripeSubscriptionId} not found in Stripe component`,
      );
      return;
    }

    // Determine plan from price ID
    const plan = determinePlanFromPriceId(subscription.priceId);
    const planKey = plan as keyof typeof SUBSCRIPTION_PLANS;
    const limits = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.free;

    // Update team with subscription data
    await ctx.db.patch(args.teamId as Id<"teams">, {
      subscriptionId: subscription.stripeSubscriptionId,
      subscriptionStatus: subscription.status as any,
      subscriptionPlan: planKey,
      subscriptionPriceId: subscription.priceId,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      subscriptionLimits: limits,
    });

    console.log(
      `Team ${args.teamId} subscription synced: plan=${plan}, status=${subscription.status}`,
    );
  },
});

// Helper function to determine plan from Stripe price ID
function determinePlanFromPriceId(priceId: string): string {
  const aiPriceId = process.env.STRIPE_AI_PRICE_ID;
  const aiScalePriceId = process.env.STRIPE_AI_SCALE_PRICE_ID;

  if (aiScalePriceId && priceId === aiScalePriceId) return "ai_scale";
  if (aiPriceId && priceId === aiPriceId) return "ai";
  return "ai"; // Default to base AI plan if unknown
}

const resolveTeamId = (ctx: any, teamId: string): Id<"teams"> | null =>
  ctx.db.normalizeId("teams", teamId);

const buildSubscriptionPatch = (
  team: any,
  args: {
    subscriptionId: string;
    status: string;
    priceId: string;
    currentPeriodStart?: number;
    currentPeriodEnd: number;
    cancelAtPeriodEnd: boolean;
  },
) => {
  const plan = determinePlanFromPriceId(args.priceId);
  const planKey = plan as keyof typeof SUBSCRIPTION_PLANS;
  const limits = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.free;
  const isPaidActivePlan =
    (args.status === "active" || args.status === "trialing") &&
    (limits.aiMonthlyTokens || 0) > 0;
  const shouldRestorePaidCredits =
    isPaidActivePlan &&
    (typeof team.aiTokens !== "number" ||
      team.aiTokens <= 0 ||
      team.subscriptionId !== args.subscriptionId ||
      team.subscriptionPlan !== planKey);

  return {
    plan,
    patch: {
      subscriptionId: args.subscriptionId,
      subscriptionStatus: args.status as any,
      subscriptionPlan: planKey,
      subscriptionPriceId: args.priceId,
      ...(typeof args.currentPeriodStart === "number"
        ? { currentPeriodStart: args.currentPeriodStart }
        : {}),
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      subscriptionLimits: limits,
      ...(shouldRestorePaidCredits
        ? { aiTokens: limits.aiMonthlyTokens || 0 }
        : {}),
    },
  };
};

// Update team to free plan
export const updateTeamToFree = internalMutation({
  args: { teamId: v.string() },
  async handler(ctx, args) {
    const teamId = resolveTeamId(ctx, args.teamId);
    if (!teamId) {
      console.warn(`Ignoring Stripe subscription delete for invalid teamId: ${args.teamId}`);
      return { success: false, reason: "invalid_team_id" };
    }

    await ctx.db.patch(teamId, {
      subscriptionStatus: null,
      subscriptionId: undefined,
      subscriptionPlan: "free",
      subscriptionPriceId: undefined,
      currentPeriodStart: undefined,
      currentPeriodEnd: undefined,
      trialEnd: undefined,
      cancelAtPeriodEnd: false,
      subscriptionLimits: SUBSCRIPTION_PLANS.free,
      aiTokens: SUBSCRIPTION_PLANS.free.aiMonthlyTokens,
    });

    return { success: true, teamId };
  },
});

// Direct subscription sync mutation (for manual sync from Stripe API)
export const syncSubscriptionDirectly = internalMutation({
  args: {
    teamId: v.id("teams"),
    subscriptionId: v.string(),
    status: v.string(),
    priceId: v.string(),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
  },
  async handler(ctx, args) {
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const { plan, patch } = buildSubscriptionPatch(team, args);

    await ctx.db.patch(args.teamId, patch);

    console.log(
      `Team ${args.teamId} subscription synced directly: plan=${plan}, status=${args.status}`,
    );
    return { success: true, plan, status: args.status };
  },
});

export const syncSubscriptionFromStripeEvent = internalMutation({
  args: {
    teamId: v.string(),
    subscriptionId: v.string(),
    status: v.string(),
    priceId: v.string(),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
  },
  async handler(ctx, args) {
    const teamId = resolveTeamId(ctx, args.teamId);
    if (!teamId) {
      console.warn(
        `Ignoring Stripe subscription event for invalid teamId metadata: ${args.teamId}`,
      );
      return { success: false, reason: "invalid_team_id" };
    }

    const team = await ctx.db.get(teamId);
    if (!team) {
      console.warn(
        `Ignoring Stripe subscription event for missing team: ${args.teamId}`,
      );
      return { success: false, reason: "team_not_found" };
    }

    const { plan, patch } = buildSubscriptionPatch(team, args);
    await ctx.db.patch(teamId, patch);

    console.log(
      `Team ${teamId} subscription synced from Stripe event: plan=${plan}, status=${args.status}`,
    );
    return { success: true, plan, status: args.status, teamId };
  },
});

const claimSubscriptionEmailEvent = async (
  ctx: any,
  args: {
    teamId: Id<"teams">;
    subscriptionId: string;
    eventType: "activated" | "canceled";
    recipientEmail?: string;
  },
) => {
  const existing = await ctx.db
    .query("subscriptionEmailEvents")
    .withIndex("by_subscription_event", (q: any) =>
      q
        .eq("subscriptionId", args.subscriptionId)
        .eq("eventType", args.eventType),
    )
    .unique();

  if (existing?.status === "sent") {
    return { claimed: false };
  }

  const now = Date.now();

  if (existing?.status === "sending") {
    const lastClaimedAt = existing.updatedAt ?? existing._creationTime;
    if (now - lastClaimedAt < SUBSCRIPTION_EMAIL_SENDING_TIMEOUT_MS) {
      return { claimed: false };
    }
  }

  if (existing) {
    await ctx.db.patch(existing._id, {
      status: "sending",
      recipientEmail: args.recipientEmail,
      attempts: existing.attempts + 1,
      lastError: undefined,
      updatedAt: now,
    });
    return { claimed: true };
  }

  await ctx.db.insert("subscriptionEmailEvents", {
    teamId: args.teamId,
    subscriptionId: args.subscriptionId,
    eventType: args.eventType,
    recipientEmail: args.recipientEmail,
    status: "sending",
    attempts: 1,
    createdAt: now,
    updatedAt: now,
  });

  return { claimed: true };
};

const markSubscriptionEmailEvent = async (
  ctx: any,
  args: {
    subscriptionId: string;
    eventType: "activated" | "canceled";
    status: "sent" | "failed";
    recipientEmail?: string;
    lastError?: string;
  },
) => {
  const existing = await ctx.db
    .query("subscriptionEmailEvents")
    .withIndex("by_subscription_event", (q: any) =>
      q
        .eq("subscriptionId", args.subscriptionId)
        .eq("eventType", args.eventType),
    )
    .unique();

  if (!existing) {
    return null;
  }

  await ctx.db.patch(existing._id, {
    status: args.status,
    recipientEmail: args.recipientEmail ?? existing.recipientEmail,
    lastError: args.lastError,
    updatedAt: Date.now(),
    sentAt: args.status === "sent" ? Date.now() : existing.sentAt,
  });

  return null;
};

export const claimSubscriptionActivatedEmail = internalMutation({
  args: {
    teamId: v.id("teams"),
    subscriptionId: v.string(),
    recipientEmail: v.optional(v.string()),
  },
  async handler(ctx, args) {
    return await claimSubscriptionEmailEvent(ctx, {
      ...args,
      eventType: "activated",
    });
  },
});

export const markSubscriptionActivatedEmail = internalMutation({
  args: {
    subscriptionId: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    recipientEmail: v.optional(v.string()),
    lastError: v.optional(v.string()),
  },
  async handler(ctx, args) {
    return await markSubscriptionEmailEvent(ctx, {
      ...args,
      eventType: "activated",
    });
  },
});

export const claimSubscriptionCanceledEmail = internalMutation({
  args: {
    teamId: v.id("teams"),
    subscriptionId: v.string(),
    recipientEmail: v.optional(v.string()),
  },
  async handler(ctx, args) {
    return await claimSubscriptionEmailEvent(ctx, {
      ...args,
      eventType: "canceled",
    });
  },
});

export const markSubscriptionCanceledEmail = internalMutation({
  args: {
    subscriptionId: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    recipientEmail: v.optional(v.string()),
    lastError: v.optional(v.string()),
  },
  async handler(ctx, args) {
    return await markSubscriptionEmailEvent(ctx, {
      ...args,
      eventType: "canceled",
    });
  },
});

// Fix team AI access (one-time fix for existing teams)
export const fixTeamAIAccess = internalMutation({
  args: { teamId: v.string() },
  async handler(ctx, args) {
    const team = await ctx.db.get(args.teamId as Id<"teams">);
    if (!team) {
      throw new Error("Team not found");
    }

    const plan = team.subscriptionPlan || "free";
    const planKey = plan as keyof typeof SUBSCRIPTION_PLANS;
    const limits = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.free;

    await ctx.db.patch(args.teamId as Id<"teams">, {
      subscriptionLimits: limits,
      ...(plan === "free" && team.aiTokens === undefined
        ? { aiTokens: limits.aiMonthlyTokens || 0 }
        : {}),
    });

    return { success: true, plan, limits };
  },
});

// Public mutation to refresh team subscription limits (syncs with current plan definitions)
export const refreshTeamLimits = mutation({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Check if user is admin of this team
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject),
      )
      .unique();

    if (!membership || !membership.isActive || membership.role !== "admin") {
      throw new Error("Not authorized - admin access required");
    }

    const plan = team.subscriptionPlan || "free";
    const planKey = plan as keyof typeof SUBSCRIPTION_PLANS;
    const limits = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.free;

    await ctx.db.patch(args.teamId, {
      subscriptionLimits: limits,
      ...(plan === "free" && team.aiTokens === undefined
        ? { aiTokens: limits.aiMonthlyTokens || 0 }
        : {}),
    });

    return { success: true, plan, limits };
  },
});

// Check if team can perform an action based on subscription limits
export const checkTeamLimits = query({
  args: {
    teamId: v.id("teams"),
    action: v.union(
      v.literal("create_project"),
      v.literal("add_member"),
      v.literal("use_advanced_features"),
      v.literal("upload_file"),
    ),
    additionalData: teamLimitsAdditionalDataValidator,
  },
  returns: v.union(
    v.object({
      allowed: v.literal(true),
    }),
    v.object({
      allowed: v.literal(false),
      reason: v.string(),
      message: v.string(),
      current: v.optional(v.number()),
      limit: v.optional(v.number()),
    }),
  ),
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject),
      )
      .unique();

    if (!membership || !membership.isActive) {
      throw new Error("Not authorized to view this team");
    }

    const plan = (team.subscriptionPlan ||
      "free") as keyof typeof SUBSCRIPTION_PLANS;
    const limits = getEffectiveLimits(team);

    // Check subscription status
    if (
      team.subscriptionStatus &&
      !["active", "trialing"].includes(team.subscriptionStatus)
    ) {
      return {
        allowed: false as const,
        reason: "subscription_inactive",
        message:
          "Your subscription is not active. Please update your billing information.",
      };
    }

    switch (args.action) {
      case "create_project": {
        const projectCount = await ctx.db
          .query("projects")
          .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
          .collect()
          .then((projects) => projects.length);

        if (projectCount >= limits.maxProjects) {
          return {
            allowed: false as const,
            reason: "project_limit_reached",
            message: `You've reached the maximum number of projects (${limits.maxProjects}) for your ${plan} plan.`,
            current: projectCount,
            limit: limits.maxProjects,
          };
        }
        break;
      }

      case "add_member": {
        const memberCount = await ctx.db
          .query("teamMembers")
          .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect()
          .then((members) => members.length);

        if (memberCount >= limits.maxTeamMembers) {
          return {
            allowed: false as const,
            reason: "member_limit_reached",
            message: `You've reached the maximum number of team members (${limits.maxTeamMembers}) for your ${plan} plan.`,
            current: memberCount,
            limit: limits.maxTeamMembers,
          };
        }
        break;
      }

      case "use_advanced_features": {
        if (!limits.hasAdvancedFeatures) {
          return {
            allowed: false as const,
            reason: "feature_not_available",
            message:
              "Advanced features are not available on your current plan.",
          };
        }
        break;
      }
    }

    return { allowed: true as const };
  },
});

// Internal query to check AI feature access by project ID
export const checkAIFeatureAccessByProject = internalQuery({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return {
        allowed: false,
        message: "Project not found",
      };
    }

    const team = await ctx.db.get(project.teamId);
    if (!team) {
      return {
        allowed: false,
        message: "Team not found",
      };
    }

    const access = await evaluateAIAccess(ctx, team);
    return {
      ...access,
      limits: getEffectiveLimits(team),
    };
  },
});

// Internal query to check AI feature access
export const checkAIFeatureAccess = internalQuery({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      return {
        allowed: false,
        message: "Team not found",
      };
    }

    const access = await evaluateAIAccess(ctx, team);
    return {
      ...access,
      limits: getEffectiveLimits(team),
    };
  },
});

// Public query to check AI access for a team (by teamId)
export const checkTeamAIAccess = query({
  args: { teamId: v.id("teams") },
  returns: v.object({
    hasAccess: v.boolean(),
    message: v.string(),
    currentPlan: v.string(),
    subscriptionStatus: v.optional(
      v.union(
        v.literal("active"),
        v.literal("past_due"),
        v.literal("canceled"),
        v.literal("trialing"),
        v.literal("incomplete"),
        v.literal("incomplete_expired"),
        v.literal("paused"),
        v.literal("unpaid"),
        v.null(),
      ),
    ),
    subscriptionLimits: v.optional(subscriptionLimitsValidator),
    // Simple token balance
    totalTokens: v.optional(v.number()),
    usedTokens: v.optional(v.number()),
    remainingTokens: v.optional(v.number()),
  }),
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        hasAccess: false,
        message: "Not authenticated",
        currentPlan: "free",
        subscriptionStatus: null,
      };
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      return {
        hasAccess: false,
        message: "Team not found",
        currentPlan: "free",
        subscriptionStatus: null,
      };
    }

    // Check membership
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject),
      )
      .unique();

    if (!membership || !membership.isActive) {
      return {
        hasAccess: false,
        message: "Not a member of this team",
        currentPlan: "free",
        subscriptionStatus: null,
      };
    }

    const access = await evaluateAIAccess(ctx, team);
    const hasAccess = access.allowed;

    return {
      hasAccess,
      message:
        access.message ||
        (hasAccess ? "AI features available" : "AI features unavailable"),
      currentPlan: team.subscriptionPlan || "free",
      subscriptionStatus: team.subscriptionStatus || null,
      subscriptionLimits: getEffectiveLimits(team),
      // Simple token balance
      totalTokens: access.totalTokens,
      usedTokens: access.usedTokens,
      remainingTokens: access.remainingTokens,
    };
  },
});

// Query to get user's subscriptions from Stripe component
export const getUserSubscriptions = query({
  args: {},
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.runQuery(
      components.stripe.public.listSubscriptionsByUserId,
      { userId: identity.subject },
    );
  },
});

// Query to get user's payments from Stripe component
export const getUserPayments = query({
  args: {},
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.runQuery(components.stripe.public.listPaymentsByUserId, {
      userId: identity.subject,
    });
  },
});

// Query to get user's invoices from Stripe component
export const getUserInvoices = query({
  args: {},
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.runQuery(components.stripe.public.listInvoicesByUserId, {
      userId: identity.subject,
    });
  },
});

// Query to get team's subscriptions from Stripe component (by org ID)
export const getTeamSubscriptionsFromStripe = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const team = await ctx.db.get(args.teamId);
    if (!team || !team.stripeCustomerId) return [];

    return await ctx.runQuery(components.stripe.public.listSubscriptions, {
      stripeCustomerId: team.stripeCustomerId,
    });
  },
});

// Query to get team's subscription invoices from Stripe component.
export const getTeamInvoices = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const team = await ctx.db.get(args.teamId);
    if (!team) return [];

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject),
      )
      .unique();

    if (!membership || !membership.isActive) return [];

    const invoices = team.stripeCustomerId
      ? await ctx.runQuery(components.stripe.public.listInvoices, {
          stripeCustomerId: team.stripeCustomerId,
        })
      : await ctx.runQuery(components.stripe.public.listInvoicesByOrgId, {
          orgId: team.clerkOrgId,
        });

    return invoices.sort((a, b) => b.created - a.created);
  },
});
