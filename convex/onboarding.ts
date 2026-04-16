import { v } from "convex/values";
import type { UserIdentity } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const internalAny = require("./_generated/api").internal as any;

const currencyValidator = v.union(
  v.literal("USD"),
  v.literal("EUR"),
  v.literal("PLN"),
  v.literal("GBP"),
  v.literal("CAD"),
  v.literal("AUD"),
  v.literal("JPY"),
  v.literal("CHF"),
  v.literal("SEK"),
  v.literal("NOK"),
  v.literal("DKK"),
  v.literal("CZK"),
  v.literal("HUF"),
  v.literal("CNY"),
  v.literal("INR"),
  v.literal("BRL"),
  v.literal("MXN"),
  v.literal("KRW"),
  v.literal("SGD"),
  v.literal("HKD"),
);

type OnboardingUserDoc = {
  _id: Id<"users">;
  clerkUserId: string;
  email: string;
  name?: string;
  imageUrl?: string;
  onboardingCompletedAt?: number;
  clipperConnectedAt?: number;
};

type ActiveTeamContext = {
  team: {
    _id: Id<"teams">;
    name: string;
    currency?: string;
    timezone?: string;
    onboardingCompletedAt?: number;
  };
  membership: {
    role: "admin" | "member";
    isActive: boolean;
  };
};

const isOrganizationSetupCompleted = (team: ActiveTeamContext["team"]) =>
  team.onboardingCompletedAt === undefined || team.onboardingCompletedAt > 0;

const getCurrentUser = async (ctx: QueryCtx, identity: UserIdentity): Promise<OnboardingUserDoc | null> => {
  return (await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
    .unique()) as unknown as OnboardingUserDoc | null;
};

const getOrCreateCurrentUser = async (ctx: MutationCtx, identity: UserIdentity): Promise<OnboardingUserDoc> => {
  const existing = await getCurrentUser(ctx, identity);

  if (existing) {
    return existing;
  }

  const userId = await ctx.db.insert("users", {
    clerkUserId: identity.subject,
    email: identity.email ?? `${identity.subject}@placeholder.local`,
    name: identity.name ?? undefined,
    imageUrl: identity.pictureUrl ?? undefined,
  });

  const user = (await ctx.db.get(userId)) as unknown as OnboardingUserDoc | null;
  if (!user) {
    throw new Error("Failed to create user profile");
  }
  return user;
};

const getActiveTeamContext = async (ctx: QueryCtx, identity: UserIdentity): Promise<ActiveTeamContext | null> => {
  const activeOrgId = (identity.org_id as string | undefined) ?? (identity.orgId as string | undefined);
  if (activeOrgId) {
    const team = (await ctx.db
      .query("teams")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", activeOrgId))
      .unique()) as unknown as ActiveTeamContext["team"] | null;

    if (team) {
      const membership = (await ctx.db
        .query("teamMembers")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", team._id).eq("clerkUserId", identity.subject),
        )
        .unique()) as unknown as ActiveTeamContext["membership"] | null;

      if (membership?.isActive) {
        return {
          team,
          membership,
        };
      }
    }
  }

  // Fallback for onboarding right after organization creation:
  // auth claims can temporarily miss `org_id`, but DB membership already exists.
  const memberships = (await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("clerkUserId", identity.subject))
    .collect()) as unknown as Array<{
    teamId: Id<"teams">;
    role: "admin" | "member";
    isActive: boolean;
  }>;

  const activeMemberships = memberships.filter((membership) => membership.isActive);
  if (activeMemberships.length !== 1) {
    return null;
  }

  const membership = activeMemberships[0];
  const team = (await ctx.db.get(membership.teamId)) as unknown as ActiveTeamContext["team"] | null;
  if (!team) {
    return null;
  }

  return {
    team,
    membership: {
      role: membership.role,
      isActive: membership.isActive,
    },
  };
};

export const getStatus = query({
  args: {},
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        authenticated: false,
        completed: false,
        profile: {
          displayName: undefined,
        },
        activeOrganization: null,
        clipperConnected: false,
      };
    }

    const user = await getCurrentUser(ctx, identity);
    const teamContext = await getActiveTeamContext(ctx, identity);

    return {
      authenticated: true,
      completed: Boolean(user?.onboardingCompletedAt),
      profile: {
        displayName: user?.name ?? identity.name ?? undefined,
      },
      clipperConnected: Boolean(user?.clipperConnectedAt),
      activeOrganization: teamContext
        ? {
            teamId: teamContext.team._id,
            teamName: teamContext.team.name,
            role: teamContext.membership.role,
            currency: teamContext.team.currency ?? undefined,
            timezone: teamContext.team.timezone ?? undefined,
            onboardingCompleted: isOrganizationSetupCompleted(teamContext.team),
            canUpdateTeamSettings: teamContext.membership.role === "admin",
          }
        : null,
    };
  },
});

export const markClipperConnected = mutation({
  args: {},
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await getOrCreateCurrentUser(ctx, identity);
    const userDb = ctx.db as unknown as {
      patch: (id: Id<"users">, value: Record<string, unknown>) => Promise<void>;
    };

    await userDb.patch(user._id, {
      clipperConnectedAt: Date.now(),
    });

    return { success: true };
  },
});

export const completeOnboarding = mutation({
  args: {
    organizationCurrency: v.optional(currencyValidator),
    organizationTimezone: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await getOrCreateCurrentUser(ctx, identity);
    const organizationTimezone = args.organizationTimezone?.trim();
    if (args.organizationTimezone !== undefined && !organizationTimezone) {
      throw new Error("Organization timezone cannot be empty");
    }

    const userDb = ctx.db as unknown as {
      patch: (id: Id<"users">, value: Record<string, unknown>) => Promise<void>;
    };
    await userDb.patch(user._id, {
      onboardingCompletedAt: Date.now(),
    });

    const teamContext = await getActiveTeamContext(ctx, identity);
    let appliedToTeam = false;

    if (teamContext && teamContext.membership.role === "admin") {
      const teamPatch: Record<string, string> = {};
      if (args.organizationCurrency !== undefined) {
        teamPatch.currency = args.organizationCurrency;
      }
      if (organizationTimezone !== undefined) {
        teamPatch.timezone = organizationTimezone;
      }

      if (Object.keys(teamPatch).length > 0) {
        const teamDb = ctx.db as unknown as {
          patch: (id: Id<"teams">, value: Record<string, unknown>) => Promise<void>;
        };
        await teamDb.patch(teamContext.team._id, teamPatch);
        appliedToTeam = true;
      }

      const teamDb = ctx.db as unknown as {
        patch: (id: Id<"teams">, value: Record<string, unknown>) => Promise<void>;
      };
      await teamDb.patch(teamContext.team._id, {
        onboardingCompletedAt: Date.now(),
      });
    }

    if (teamContext?.team._id) {
      await ctx.runMutation(internalAny.activityLog.logActivity, {
        teamId: teamContext.team._id,
        actionType: "analytics.onboarding.completed",
        details: {
          appliedToTeam,
          organizationCurrency: args.organizationCurrency ?? null,
          organizationTimezone: organizationTimezone ?? null,
        },
        entityId: user._id,
        entityType: "user",
      });
    }

    return {
      success: true,
      appliedToTeam,
      activeOrganizationId: teamContext?.team._id ?? null,
    };
  },
});
