import { v } from "convex/values";
import { mutation } from "./_generated/server";

const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
};

const DEFAULT_WORKSPACE_CURRENCY = "PLN" as const;
const DEFAULT_WORKSPACE_TIMEZONE = "Europe/Warsaw";

const automaticWorkspaceDefaults = () => ({
  currency: DEFAULT_WORKSPACE_CURRENCY,
  timezone: DEFAULT_WORKSPACE_TIMEZONE,
  onboardingCompletedAt: Date.now(),
});

export const ensureCurrentUserTeamMembership = mutation({
  args: {
    clerkOrgId: v.string(),
    orgName: v.optional(v.string()),
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
          return { teamId: existingTeam._id };
        }
      }

      throw new Error("Active organization is still syncing. Please try again.");
    }

    if (activeOrgId !== args.clerkOrgId) {
      throw new Error("Selected organization does not match active auth context");
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

    if (!membership && !roleClaimRaw) {
      const existingMembers = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      if (existingMembers.every((member) => !member.isActive)) {
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
    }

    return { teamId: team._id };
  },
});
