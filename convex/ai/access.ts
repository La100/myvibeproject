import type { Id } from "../_generated/dataModel";

type TeamMembership = {
  teamId: Id<"teams">;
  clerkUserId: string;
  role: "admin" | "member";
  isActive: boolean;
  projectIds?: Id<"projects">[];
};

type ProjectRecord = {
  _id: Id<"projects">;
  name: string;
  teamId: Id<"teams">;
};

export const requireIdentity = async (ctx: any) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }
  return identity;
};

const ensureProjectScopedMembership = async (
  ctx: any,
  teamId: Id<"teams">,
  projectId: Id<"projects">,
  clerkUserId: string,
): Promise<TeamMembership> => {
  const membership = (await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q: any) =>
      q.eq("teamId", teamId).eq("clerkUserId", clerkUserId),
    )
    .unique()) as TeamMembership | null;

  if (!membership || membership.isActive === false) {
    throw new Error("Forbidden");
  }

  if (
    membership.role === "member" &&
    membership.projectIds &&
    membership.projectIds.length > 0 &&
    !membership.projectIds.includes(projectId)
  ) {
    throw new Error("Forbidden");
  }

  return membership;
};

export const ensureProjectAccess = async (
  ctx: any,
  projectId: Id<"projects">,
  clerkUserId?: string,
) => {
  const effectiveUserId = clerkUserId ?? (await requireIdentity(ctx)).subject;
  const project = (await ctx.db.get(projectId)) as ProjectRecord | null;

  if (!project) {
    throw new Error("Project not found");
  }

  const membership = await ensureProjectScopedMembership(
    ctx,
    project.teamId,
    projectId,
    effectiveUserId,
  );

  return {
    clerkUserId: effectiveUserId,
    membership,
    project,
  };
};
