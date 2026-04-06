
import { v } from "convex/values";
import { query } from "./_generated/server";
import { listActiveTeamIdsForUser, requireIdentity } from "./authz";

const getVisibleClerkUserIds = async (
  ctx: any,
  requestedClerkUserIds: string[],
): Promise<string[]> => {
  const callerClerkUserId = await requireIdentity(ctx);
  const callerTeamIds = new Set(
    (await listActiveTeamIdsForUser(ctx, callerClerkUserId)).map((teamId) => String(teamId)),
  );

  if (callerTeamIds.size === 0) {
    return [];
  }

  const uniqueIds = Array.from(
    new Set(
      requestedClerkUserIds
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  );

  const visibleIds: string[] = [];
  for (const clerkUserId of uniqueIds) {
    if (clerkUserId === callerClerkUserId) {
      visibleIds.push(clerkUserId);
      continue;
    }

    const targetTeamIds = new Set(
      (await listActiveTeamIdsForUser(ctx, clerkUserId)).map((teamId) => String(teamId)),
    );

    if (Array.from(targetTeamIds).some((teamId) => callerTeamIds.has(teamId))) {
      visibleIds.push(clerkUserId);
    }
  }

  return visibleIds;
};

/**
 * Get a user by their Clerk ID. 
 * Returns the user document or null if not found.
 */
export const getByClerkId = query({
  args: { clerkUserId: v.string() },
  returns: v.union(v.object({
    _id: v.id("users"),
    _creationTime: v.number(),
    clerkUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  }), v.null()),
  async handler(ctx, args) {
    const [visibleClerkUserId] = await getVisibleClerkUserIds(ctx, [args.clerkUserId]);
    if (!visibleClerkUserId) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", visibleClerkUserId))
      .unique();

    return user;
  },
});

/**
 * Get a list of users by their Clerk IDs.
 * Useful for fetching data for multiple users at once (e.g., team members, assignees).
 * @param clerkUserIds - An array of Clerk user IDs.
 * @returns A list of user documents.
 */
export const getByClerkIds = query({
    args: { clerkUserIds: v.array(v.string()) },
    async handler(ctx, args) {
        if (args.clerkUserIds.length === 0) {
            return [];
        }

        const visibleClerkUserIds = await getVisibleClerkUserIds(ctx, args.clerkUserIds);
        if (visibleClerkUserIds.length === 0) {
            return [];
        }
        
        const users = await ctx.db
            .query("users")
            .filter(q => q.or(...visibleClerkUserIds.map(id => q.eq(q.field("clerkUserId"), id))))
            .collect();
        
        return users;
    }
});
