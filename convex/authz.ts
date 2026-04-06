import { Doc, Id } from "./_generated/dataModel";

type TeamMembership = Doc<"teamMembers">;

export const requireIdentity = async (
  ctx: any,
  actorClerkUserId?: string,
): Promise<string> => {
  if (typeof actorClerkUserId === "string" && actorClerkUserId.trim().length > 0) {
    return actorClerkUserId.trim();
  }

  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new Error("Not authenticated");
  }

  return identity.subject;
};

export const getActiveTeamMembership = async (
  ctx: any,
  teamId: Id<"teams">,
  clerkUserId: string,
): Promise<TeamMembership | null> => {
  return await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q: any) =>
      q.eq("teamId", teamId).eq("clerkUserId", clerkUserId),
    )
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .unique();
};

export const canAccessProjectWithMembership = (
  membership: TeamMembership | null,
  projectId: Id<"projects">,
): boolean => {
  if (!membership) {
    return false;
  }

  if (membership.role === "admin") {
    return true;
  }

  if (membership.role === "member") {
    return Array.isArray(membership.projectIds) && membership.projectIds.includes(projectId);
  }

  return false;
};

export const ensureTeamAccess = async (
  ctx: any,
  teamId: Id<"teams">,
  actorClerkUserId?: string,
) => {
  const clerkUserId = await requireIdentity(ctx, actorClerkUserId);
  const team = await ctx.db.get(teamId);
  if (!team) {
    throw new Error("Team not found");
  }

  const membership = await getActiveTeamMembership(ctx, teamId, clerkUserId);
  if (!membership) {
    throw new Error("Permission denied.");
  }

  return { team, membership, clerkUserId };
};

export const ensureProjectAccess = async (
  ctx: any,
  projectId: Id<"projects">,
  actorClerkUserId?: string,
) => {
  const clerkUserId = await requireIdentity(ctx, actorClerkUserId);
  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  const membership = await getActiveTeamMembership(ctx, project.teamId, clerkUserId);
  if (!canAccessProjectWithMembership(membership, projectId)) {
    throw new Error("Permission denied.");
  }

  return { project, membership: membership!, clerkUserId };
};

export const listActiveTeamIdsForUser = async (
  ctx: any,
  clerkUserId: string,
): Promise<Id<"teams">[]> => {
  const memberships = await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q: any) => q.eq("clerkUserId", clerkUserId))
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .collect();

  return memberships.map((membership: TeamMembership) => membership.teamId);
};
