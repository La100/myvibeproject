import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

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
