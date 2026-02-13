import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
};

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
    if (activeOrgId && activeOrgId !== args.clerkOrgId) {
      throw new Error("Selected organization does not match active auth context");
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
      });
      team = await ctx.db.get(teamId);
      if (!team) {
        throw new Error("Failed to create team");
      }
    } else if (args.orgName && args.orgName !== team.name) {
      const updatedSlug = generateSlug(args.orgName.trim()) || generateSlug(args.clerkOrgId) || args.clerkOrgId;
      await ctx.db.patch(team._id, { name: args.orgName, slug: updatedSlug });
    }

    const roleClaimRaw = String(
      (identity.org_role as string | undefined) ??
      (identity.orgRole as string | undefined) ??
      ""
    ).toLowerCase();

    const derivedRole: "admin" | "member" | "customer" =
      roleClaimRaw.includes("admin")
        ? "admin"
        : roleClaimRaw.includes("customer")
          ? "customer"
          : "member";

    let fallbackRole = derivedRole;
    let fallbackProjectIds: Id<"projects">[] | undefined = undefined;

    const activeCustomerRecords = await ctx.db
      .query("customers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("clerkOrgId", args.clerkOrgId).eq("clerkUserId", identity.subject)
      )
      .collect();

    const nonInactiveCustomerRecords = activeCustomerRecords.filter((record) => record.status !== "inactive");

    if (nonInactiveCustomerRecords.length > 0) {
      fallbackRole = "customer";
      fallbackProjectIds = Array.from(new Set(nonInactiveCustomerRecords.map((record) => record.projectId)));
    } else if (identity.email) {
      const invitedCustomerRecords = await ctx.db
        .query("customers")
        .withIndex("by_email", (q) => q.eq("email", identity.email!))
        .filter((q) =>
          q.and(
            q.eq(q.field("clerkOrgId"), args.clerkOrgId),
            q.or(
              q.eq(q.field("status"), "invited"),
              q.eq(q.field("status"), "active")
            )
          )
        )
        .collect();

      if (invitedCustomerRecords.length > 0) {
        fallbackRole = "customer";
        fallbackProjectIds = Array.from(new Set(invitedCustomerRecords.map((record) => record.projectId)));

        for (const record of invitedCustomerRecords) {
          if (record.status === "invited") {
            await ctx.db.patch(record._id, {
              status: "active",
              clerkUserId: identity.subject,
              joinedAt: Date.now(),
            });
          }
        }
      }
    }

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject)
      )
      .unique();

    // Right after Clerk setActive(), auth claims may temporarily miss org context.
    // In that window, grant admin only when creating the very first team member.
    if (!activeOrgId && !membership && !roleClaimRaw) {
      const existingMembers = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      if (existingMembers.every((member) => !member.isActive)) {
        fallbackRole = "admin";
      }
    }

    if (membership) {
      const patch: Record<string, unknown> = {};

      if (!membership.isActive) {
        patch.isActive = true;
      }
      if (membership.clerkOrgId !== args.clerkOrgId) {
        patch.clerkOrgId = args.clerkOrgId;
      }
      if (derivedRole === "admin" && membership.role !== "admin") {
        patch.role = "admin";
      }
      if (fallbackRole === "customer" && membership.role !== "customer") {
        patch.role = "customer";
      }
      if (fallbackProjectIds && fallbackProjectIds.length > 0) {
        const existingProjectIds = membership.projectIds || [];
        patch.projectIds = Array.from(new Set([...existingProjectIds, ...fallbackProjectIds]));
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
        projectIds: fallbackProjectIds,
        permissions: [],
        joinedAt: Date.now(),
        isActive: true,
      });
    }

    return { teamId: team._id };
  },
});
