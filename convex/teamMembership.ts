import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { ensureDemoProjectForNewWorkspace } from "./demoProjectSeed";
import { SUBSCRIPTION_PLANS } from "./stripe";
const internalAny = require("./_generated/api").internal as any;

const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
};

const DEFAULT_WORKSPACE_CURRENCY = "PLN" as const;
const DEFAULT_WORKSPACE_TIMEZONE = "Europe/Warsaw";

const automaticWorkspaceDefaults = () => {
  const now = Date.now();

  return {
    currency: DEFAULT_WORKSPACE_CURRENCY,
    timezone: DEFAULT_WORKSPACE_TIMEZONE,
    onboardingCompletedAt: now,
    subscriptionPlan: "free" as const,
    subscriptionLimits: SUBSCRIPTION_PLANS.free,
    aiTokens: SUBSCRIPTION_PLANS.free.aiMonthlyTokens,
    currentPeriodStart: now,
    currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
  };
};

const syncPending = (reason: "missing_active_org" | "stale_active_org") => ({
  status: "sync_pending" as const,
  reason,
});

const ready = (teamId: Id<"teams">) => ({
  status: "ready" as const,
  teamId,
});

export const ensureCurrentUserTeamMembership = mutation({
  args: {
    clerkOrgId: v.string(),
    orgName: v.optional(v.string()),
    locale: v.optional(v.union(v.literal("en"), v.literal("pl"))),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const activeOrgId = (identity.org_id as string | undefined) ?? (identity.orgId as string | undefined);
    if (!activeOrgId) {
      const existingTeam = await ctx.db
        .query("teams")
        .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
        .unique();

      if (existingTeam) {
        const existingMembership = await ctx.db
          .query("teamMembers")
          .withIndex("by_team_and_user", (q) =>
            q.eq("teamId", existingTeam._id).eq("clerkUserId", identity.subject)
          )
          .filter((q) => q.eq(q.field("isActive"), true))
          .unique();

        if (existingMembership) {
          await ensureDemoProjectForNewWorkspace(ctx, {
            teamId: existingTeam._id,
            clerkOrgId: args.clerkOrgId,
            createdByClerkUserId: identity.subject,
            locale: args.locale,
          });
          return ready(existingTeam._id);
        }
      }

      return syncPending("missing_active_org");
    }

    if (activeOrgId !== args.clerkOrgId) {
      return syncPending("stale_active_org");
    }

    const activeMemberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("clerkUserId", identity.subject))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    const conflictingMembership = activeMemberships.find(
      (entry) => entry.clerkOrgId !== args.clerkOrgId,
    );
    if (conflictingMembership) {
      throw new Error("User already belongs to another workspace");
    }

    let team = await ctx.db
      .query("teams")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();

    let createdTeam = false;
    if (!team) {
      const fallbackName = args.orgName?.trim() || "Organization";
      const teamId = await ctx.db.insert("teams", {
        clerkOrgId: args.clerkOrgId,
        name: fallbackName,
        slug: generateSlug(fallbackName || args.clerkOrgId),
        ...automaticWorkspaceDefaults(),
      });
      team = await ctx.db.get(teamId);
      if (!team) {
        throw new Error("Failed to create team");
      }
      createdTeam = true;
    } else {
      const patch: Record<string, unknown> = {};

      if (args.orgName && args.orgName !== team.name) {
        patch.name = args.orgName;
        patch.slug = generateSlug(args.orgName.trim()) || generateSlug(args.clerkOrgId) || args.clerkOrgId;
      }
      if (!team.onboardingCompletedAt || team.onboardingCompletedAt <= 0) {
        patch.onboardingCompletedAt = Date.now();
      }
      if (!team.currency) {
        patch.currency = DEFAULT_WORKSPACE_CURRENCY;
      }
      if (!team.timezone) {
        patch.timezone = DEFAULT_WORKSPACE_TIMEZONE;
      }

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(team._id, patch);
        team = (await ctx.db.get(team._id)) ?? team;
      }
    }

    const roleClaimRaw = String(
      (identity.org_role as string | undefined) ??
      (identity.orgRole as string | undefined) ??
      ""
    ).toLowerCase();

    const derivedRole: "admin" | "member" =
      roleClaimRaw.includes("admin")
        ? "admin"
        : "member";

    let fallbackRole = derivedRole;

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject)
      )
      .unique();

    const existingMembers = !membership
      ? await ctx.db
          .query("teamMembers")
          .withIndex("by_team", (q) => q.eq("teamId", team._id))
          .collect()
      : [];
    const isFirstTeamMembership =
      !membership && existingMembers.every((member) => !member.isActive);

    if (!membership && !roleClaimRaw) {
      if (isFirstTeamMembership) {
        fallbackRole = "admin";
      }
    }

    if (membership) {
      if (!membership.isActive) {
        throw new Error("Workspace membership is inactive");
      }

      const patch: Record<string, unknown> = {};

      if (membership.clerkOrgId !== args.clerkOrgId) {
        patch.clerkOrgId = args.clerkOrgId;
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(membership._id, patch);
      }
    } else {
      await ctx.db.insert("teamMembers", {
        teamId: team._id,
        clerkUserId: identity.subject,
        clerkOrgId: args.clerkOrgId,
        role: fallbackRole,
        permissions: [],
        joinedAt: Date.now(),
        isActive: true,
      });
      await ctx.scheduler.runAfter(
        0,
        internalAny.stripeActions.syncTeamSeatQuantity,
        { teamId: team._id },
      );
    }

    if (createdTeam || isFirstTeamMembership || membership) {
      await ensureDemoProjectForNewWorkspace(ctx, {
        teamId: team._id,
        clerkOrgId: args.clerkOrgId,
        createdByClerkUserId: identity.subject,
        locale: args.locale,
      });
    }

    return ready(team._id);
  },
});
