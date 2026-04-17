import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { ensureTeamAccess } from "./authz";
import {
  DEFAULT_ORGANIZATION_TAX_SETTINGS,
  clampOrganizationTaxRate,
  normalizeOrganizationTaxLabel,
  normalizeTeamTaxRates,
  resolveOrganizationTaxSettingsFromRates,
  type TeamTaxRate,
} from "../lib/organizationTax";

function getTeamTaxRates(team: unknown): TeamTaxRate[] {
  const source =
    typeof team === "object" && team !== null && "taxRates" in team
      ? (team as { taxRates?: unknown[] }).taxRates
      : undefined;
  const organizationTaxSettings =
    typeof team === "object" && team !== null && "organizationTaxSettings" in team
      ? (team as { organizationTaxSettings?: typeof DEFAULT_ORGANIZATION_TAX_SETTINGS })
          .organizationTaxSettings
      : undefined;

  return normalizeTeamTaxRates(source, organizationTaxSettings);
}

function syncTeamTaxState(team: unknown, taxRates: TeamTaxRate[]) {
  const currentTaxSettings =
    typeof team === "object" && team !== null && "organizationTaxSettings" in team
      ? (team as { organizationTaxSettings?: typeof DEFAULT_ORGANIZATION_TAX_SETTINGS })
          .organizationTaxSettings
      : undefined;

  return {
    taxRates,
    organizationTaxSettings: resolveOrganizationTaxSettingsFromRates(
      taxRates,
      currentTaxSettings,
    ),
  };
}

export const getTeamTaxRatesByClerkOrg = query({
  args: {
    clerkOrgId: v.string(),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const team = await ctx.db
      .query("teams")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();

    if (!team) {
      return null;
    }

    try {
      await ensureTeamAccess(ctx, team._id);
    } catch {
      return null;
    }

    const taxRates = getTeamTaxRates(team);
    return {
      teamId: team._id,
      taxRates,
      organizationTaxSettings: resolveOrganizationTaxSettingsFromRates(
        taxRates,
        (team as { organizationTaxSettings?: typeof DEFAULT_ORGANIZATION_TAX_SETTINGS })
          .organizationTaxSettings,
      ),
    };
  },
});

export const createTaxRate = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.string(),
    rate: v.number(),
    makeDefault: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    const { membership, team } = await ensureTeamAccess(ctx, args.teamId);
    if (membership.role !== "admin") {
      throw new Error("Only admins can manage tax rates");
    }

    const now = Date.now();
    const baseRates = getTeamTaxRates(team).filter((entry) => entry.id !== "legacy-default");
    const nextRate: TeamTaxRate = {
      id: crypto.randomUUID(),
      name: normalizeOrganizationTaxLabel(args.name),
      rate: clampOrganizationTaxRate(args.rate),
      isDefault: args.makeDefault === true || baseRates.every((entry) => entry.isArchived),
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };

    const nextRates = normalizeTeamTaxRates(
      [
        ...baseRates.map((entry) => ({
          ...entry,
          isDefault: nextRate.isDefault ? false : entry.isDefault,
        })),
        nextRate,
      ],
      team.organizationTaxSettings,
    );

    await ctx.db.patch(args.teamId, syncTeamTaxState(team, nextRates) as any);
    return { success: true, taxRateId: nextRate.id };
  },
});

export const updateTaxRate = mutation({
  args: {
    teamId: v.id("teams"),
    taxRateId: v.string(),
    name: v.optional(v.string()),
    rate: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const { membership, team } = await ensureTeamAccess(ctx, args.teamId);
    if (membership.role !== "admin") {
      throw new Error("Only admins can manage tax rates");
    }

    const currentRates = getTeamTaxRates(team);
    const target = currentRates.find((entry) => entry.id === args.taxRateId);
    if (!target) {
      throw new Error("Tax rate not found");
    }

    const nextRates = normalizeTeamTaxRates(
      currentRates.map((entry) =>
        entry.id === args.taxRateId
          ? {
              ...entry,
              name:
                args.name !== undefined
                  ? normalizeOrganizationTaxLabel(args.name)
                  : entry.name,
              rate:
                args.rate !== undefined
                  ? clampOrganizationTaxRate(args.rate)
                  : entry.rate,
              updatedAt: Date.now(),
            }
          : entry,
      ),
      team.organizationTaxSettings,
    );

    await ctx.db.patch(args.teamId, syncTeamTaxState(team, nextRates) as any);
    return { success: true };
  },
});

export const archiveTaxRate = mutation({
  args: {
    teamId: v.id("teams"),
    taxRateId: v.string(),
    archived: v.boolean(),
  },
  async handler(ctx, args) {
    const { membership, team } = await ensureTeamAccess(ctx, args.teamId);
    if (membership.role !== "admin") {
      throw new Error("Only admins can manage tax rates");
    }

    const currentRates = getTeamTaxRates(team);
    const target = currentRates.find((entry) => entry.id === args.taxRateId);
    if (!target) {
      throw new Error("Tax rate not found");
    }

    const nextRates = normalizeTeamTaxRates(
      currentRates.map((entry) =>
        entry.id === args.taxRateId
          ? {
              ...entry,
              isArchived: args.archived,
              isDefault: args.archived ? false : entry.isDefault,
              updatedAt: Date.now(),
            }
          : entry,
      ),
      team.organizationTaxSettings,
    );

    await ctx.db.patch(args.teamId, syncTeamTaxState(team, nextRates) as any);
    return { success: true };
  },
});

export const setDefaultTaxRate = mutation({
  args: {
    teamId: v.id("teams"),
    taxRateId: v.string(),
  },
  async handler(ctx, args) {
    const { membership, team } = await ensureTeamAccess(ctx, args.teamId);
    if (membership.role !== "admin") {
      throw new Error("Only admins can manage tax rates");
    }

    const currentRates = getTeamTaxRates(team);
    const target = currentRates.find((entry) => entry.id === args.taxRateId);
    if (!target) {
      throw new Error("Tax rate not found");
    }

    if (target.isArchived) {
      throw new Error("Archived tax rates cannot be the default");
    }

    const nextRates = normalizeTeamTaxRates(
      currentRates.map((entry) => ({
        ...entry,
        isDefault: entry.id === args.taxRateId,
        updatedAt: entry.id === args.taxRateId ? Date.now() : entry.updatedAt,
      })),
      team.organizationTaxSettings,
    );

    await ctx.db.patch(args.teamId, syncTeamTaxState(team, nextRates) as any);
    return { success: true };
  },
});
