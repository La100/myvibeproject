/**
 * Confirmed Actions - Access Control Helpers
 * 
 * Shared helpers for authentication and authorization in AI confirmed actions.
 */
import type { Id } from "../../_generated/dataModel";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const apiLoose = require("../../_generated/api").api as unknown as {
  projects: { getProject: unknown };
  teams: { getCurrentUserTeamMember: unknown };
};

type ResolvedActor = {
  clerkUserId: string;
  identity: any;
};

type ConfirmedProjectAccess = {
  clerkUserId: string;
  identity: any;
  project: any;
  membership: any;
};

type ConfirmedTeamMembership = {
  clerkUserId: string;
  identity: any;
  membership: any;
};

// Basic access control helpers for confirmed AI actions
export const requireIdentity = async (ctx: any) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }
  return identity;
};

const resolveActor = async (
  ctx: any,
  actorUserId?: string,
): Promise<ResolvedActor> => {
  const identity = await requireIdentity(ctx);

  if (typeof actorUserId === "string" && actorUserId.trim().length > 0) {
    const normalizedActorUserId = actorUserId.trim();
    if (normalizedActorUserId !== identity.subject) {
      throw new Error("Forbidden");
    }
  }

  return {
    clerkUserId: identity.subject,
    identity,
  };
};

export const ensureProjectAccess = async (
  ctx: any,
  projectId: Id<"projects">,
  requireWriteAccess = true,
  actorUserId?: string,
): Promise<ConfirmedProjectAccess> => {
  const { identity, clerkUserId } = await resolveActor(ctx, actorUserId);
  const project = await ctx.runQuery(apiLoose.projects.getProject, { projectId });
  if (!project) {
    throw new Error("Project not found");
  }

  const membership = await ctx.runQuery(apiLoose.teams.getCurrentUserTeamMember, {
    teamId: project.teamId,
  });

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

  return { clerkUserId, identity, project, membership };
};

export const ensureTeamMembership = async (
  ctx: any,
  teamId: Id<"teams">,
  actorUserId?: string,
): Promise<ConfirmedTeamMembership> => {
  const { identity, clerkUserId } = await resolveActor(ctx, actorUserId);
  const membership = await ctx.runQuery(apiLoose.teams.getCurrentUserTeamMember, {
    teamId,
  });

  if (!membership || membership.isActive === false) {
    throw new Error("Forbidden");
  }

  return { clerkUserId, identity, membership };
};

export const parseOptionalDateToMillis = (
  value: string | undefined,
  fieldName: string,
) => {
  if (!value) {
    return undefined;
  }

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }

  return timestamp;
};











