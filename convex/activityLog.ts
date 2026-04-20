import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ensureProjectAccess, ensureTeamAccess } from "./authz";
import { isClientNotificationAction } from "../lib/projectClientNotifications";

/**
 * Log an activity in the project changelog.
 * This is an internal mutation, so it can only be called from other Convex functions.
 */
export const logActivity = internalMutation({
  args: {
    teamId: v.id("teams"),
    projectId: v.optional(v.id("projects")),
    taskId: v.optional(v.id("tasks")),
    actionType: v.string(),
    details: v.any(),
    entityId: v.string(),
    entityType: v.optional(v.string()),
  },
  handler: async (ctx, { teamId, projectId, taskId, actionType, details, entityId, entityType }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      // Should not happen when called from other mutations, but as a safeguard.
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    await ctx.db.insert("activityLog", {
      teamId,
      projectId,
      taskId,
      userId,
      actionType,
      details,
      entityId,
      entityType,
    });
  },
});

/**
 * Get the activity log for a project.
 */
export const getForProject = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    await ensureProjectAccess(ctx, projectId);

    const activities = await ctx.db
      .query("activityLog")
      .filter((q) => q.eq(q.field("projectId"), projectId))
      .order("desc")
      .take(100); // Get the 100 most recent activities

    const activitiesWithUsers = await Promise.all(
      activities.map(async (activity) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", activity.userId))
          .unique();
        return {
          ...activity,
          userName: user?.name,
          userImageUrl: user?.imageUrl,
        };
      })
    );

    return activitiesWithUsers;
  },
});

/**
 * Get the activity log for a specific task.
 */
export const getForTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) {
      return [];
    }
    await ensureProjectAccess(ctx, task.projectId);

    const activities = await ctx.db
      .query("activityLog")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .order("desc")
      .take(50); // Get the 50 most recent task activities

    const activitiesWithUsers = await Promise.all(
      activities.map(async (activity) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", activity.userId))
          .unique();
        return {
          ...activity,
          userName: user?.name,
          userImageUrl: user?.imageUrl,
        };
      })
    );

    return activitiesWithUsers;
  },
}); 

export const getForTeam = query({
  args: {
    clerkOrgId: v.string(),
  },
  handler: async (ctx, args) => {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();

    if (!team) {
      return [];
    }

    const { membership } = await ensureTeamAccess(ctx, team._id);
    const teamProjects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();
    const accessibleProjects =
      membership.role === "admin" ||
      !Array.isArray(membership.projectIds) ||
      membership.projectIds.length === 0
        ? teamProjects
        : teamProjects.filter((project) =>
            membership.projectIds?.some(
              (projectId) => String(projectId) === String(project._id),
            ),
          );

    if (accessibleProjects.length === 0) {
      return [];
    }

    const accessibleProjectIds = new Set(
      accessibleProjects.map((project) => String(project._id)),
    );
    const projectLookup = new Map<string, { name?: string; slug?: string }>(
      accessibleProjects.map((project) => [
        String(project._id),
        { name: project.name, slug: project.slug },
      ]),
    );

    const activities = await ctx.db
      .query("activityLog")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .order("desc")
      .take(200);

    const visibleActivities = activities.filter((activity) => {
      if (!activity.projectId) {
        return true;
      }
      return accessibleProjectIds.has(String(activity.projectId));
    });

    return await Promise.all(
      visibleActivities.map(async (activity) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", activity.userId))
          .unique();
        const project = activity.projectId
          ? projectLookup.get(String(activity.projectId))
          : undefined;

        return {
          ...activity,
          userName: user?.name,
          userImageUrl: user?.imageUrl,
          projectName: project?.name ?? undefined,
          projectSlug: project?.slug ?? undefined,
        };
      }),
    );
  },
});

export const getClientNotificationsForTeam = query({
  args: {
    clerkOrgId: v.string(),
  },
  handler: async (ctx, args) => {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();

    if (!team) {
      return [];
    }

    const { membership, clerkUserId } = await ensureTeamAccess(ctx, team._id);
    const teamProjects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();
    const accessibleProjects =
      membership.role === "admin" ||
      !Array.isArray(membership.projectIds) ||
      membership.projectIds.length === 0
        ? teamProjects
        : teamProjects.filter((project) =>
            membership.projectIds?.some(
              (projectId) => String(projectId) === String(project._id),
            ),
          );

    if (accessibleProjects.length === 0) {
      return [];
    }

    const accessibleProjectIds = new Set(
      accessibleProjects.map((project) => String(project._id)),
    );
    const projectLookup = new Map<string, { name?: string; slug?: string }>(
      accessibleProjects.map((project) => [
        String(project._id),
        { name: project.name, slug: project.slug },
      ]),
    );

    const allTeamActivities = await ctx.db
      .query("activityLog")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .order("desc")
      .take(200);

    const clientNotificationActivities = allTeamActivities.filter((activity) => {
      if (!activity.projectId) {
        return false;
      }

      if (!isClientNotificationAction(activity.actionType)) {
        return false;
      }

      return accessibleProjectIds.has(String(activity.projectId));
    });

    const readStates = await ctx.db
      .query("clientNotificationReads")
      .withIndex("by_user", (q) => q.eq("clerkUserId", clerkUserId))
      .collect();

    const projectReadStateById = new Map<string, number>();
    for (const readState of readStates) {
      const projectId = String(readState.projectId);
      if (!accessibleProjectIds.has(projectId)) {
        continue;
      }
      projectReadStateById.set(
        projectId,
        Math.max(projectReadStateById.get(projectId) ?? 0, readState.lastReadAt ?? 0),
      );
    }

    const organizationLastReadAt = Math.max(
      0,
      Number(
        (
          membership as unknown as {
            organizationClientNotificationsLastReadAt?: number;
          }
        ).organizationClientNotificationsLastReadAt ?? 0,
      ) || 0,
    );

    return await Promise.all(
      clientNotificationActivities.map(async (activity) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", activity.userId))
          .unique();
        const project = projectLookup.get(String(activity.projectId));
        const projectLastReadAt = projectReadStateById.get(String(activity.projectId)) ?? 0;

        return {
          ...activity,
          userName: user?.name,
          userImageUrl: user?.imageUrl,
          projectName: project?.name ?? "Project",
          projectSlug: project?.slug ?? "",
          effectiveLastReadAt: Math.max(organizationLastReadAt, projectLastReadAt),
        };
      }),
    );
  },
});

export const getTeamProductKpis = query({
  args: {
    teamId: v.id("teams"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
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

    const days = Math.max(1, Math.min(args.days ?? 30, 365));
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const analyticsEvents = await ctx.db
      .query("activityLog")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    let onboardingCompleted = 0;
    let projectsCreated = 0;
    let aiMessagesSent = 0;
    const activeUsers = new Set<string>();

    for (const event of analyticsEvents) {
      if (event._creationTime < since) {
        continue;
      }

      if (event.actionType === "analytics.onboarding.completed") {
        onboardingCompleted += 1;
        activeUsers.add(event.userId);
      } else if (event.actionType === "analytics.project.created") {
        projectsCreated += 1;
        activeUsers.add(event.userId);
      } else if (event.actionType === "analytics.ai.message_sent") {
        aiMessagesSent += 1;
        activeUsers.add(event.userId);
      }
    }

    return {
      days,
      since,
      onboardingCompleted,
      projectsCreated,
      aiMessagesSent,
      activeUsers: activeUsers.size,
    };
  },
});
