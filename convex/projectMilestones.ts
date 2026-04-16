import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import {
  buildCreateMilestoneRecord,
  buildMilestonePatch,
  buildMilestoneViewModel,
  buildProjectMilestonesSummary,
  getMilestoneTaskUpdates,
  sortMilestones,
} from "../lib/projectMilestones";
const internalAny = require("./_generated/api").internal as any;

const milestoneStatusValidator = v.union(
  v.literal("planned"),
  v.literal("in_progress"),
  v.literal("at_risk"),
  v.literal("blocked"),
  v.literal("completed"),
);

const getProjectMembership = async (ctx: any, projectId: Id<"projects">, clerkUserId: string) => {
  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  const membership = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q: any) =>
      q.eq("teamId", project.teamId).eq("clerkUserId", clerkUserId),
    )
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .first();

  if (!membership || (membership.role !== "admin" && membership.role !== "member")) {
    throw new Error("Insufficient permissions to manage project milestones");
  }

  if (membership.role === "member" && membership.projectIds?.length > 0) {
    if (!membership.projectIds.includes(projectId)) {
      throw new Error("Insufficient permissions to manage project milestones");
    }
  }

  return { project, membership };
};

const resolveMilestoneOwner = async (ctx: any, ownerClerkUserId?: string | null) => {
  if (!ownerClerkUserId) {
    return null;
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", ownerClerkUserId))
    .unique();

  return {
    clerkUserId: ownerClerkUserId,
    name: user?.name || user?.email || "Unknown user",
    imageUrl: user?.imageUrl,
  };
};

export const listProjectMilestones = query({
  args: {
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    await getProjectMembership(ctx, args.projectId, identity.subject);

    const [milestones, tasks] = await Promise.all([
      ctx.db
        .query("projectMilestones")
        .withIndex("by_project_and_order", (q) => q.eq("projectId", args.projectId))
        .collect(),
      ctx.db.query("tasks").withIndex("by_project", (q) => q.eq("projectId", args.projectId)).collect(),
    ]);

    const orderedMilestones = sortMilestones(milestones);

    return await Promise.all(
      orderedMilestones.map(async (milestone) => {
        const owner = await resolveMilestoneOwner(ctx, milestone.ownerClerkUserId ?? null);

        return buildMilestoneViewModel(
          {
            ...milestone,
            _id: String(milestone._id),
          },
          tasks.map((task) => ({
            ...task,
            _id: String(task._id),
            milestoneId: task.milestoneId ? String(task.milestoneId) : null,
          })),
          owner,
          Date.now(),
        );
      }),
    );
  },
});

export const getProjectMilestonesSummary = query({
  args: {
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    await getProjectMembership(ctx, args.projectId, identity.subject);

    const [milestones, tasks] = await Promise.all([
      ctx.db.query("projectMilestones").withIndex("by_project", (q) => q.eq("projectId", args.projectId)).collect(),
      ctx.db.query("tasks").withIndex("by_project", (q) => q.eq("projectId", args.projectId)).collect(),
    ]);

    return buildProjectMilestonesSummary(
      milestones.map((milestone) => ({
        ...milestone,
        _id: String(milestone._id),
      })),
      tasks.map((task) => ({
        milestoneId: task.milestoneId ? String(task.milestoneId) : null,
      })),
    );
  },
});

export const createProjectMilestone = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    description: v.optional(v.string()),
    status: v.optional(milestoneStatusValidator),
    ownerClerkUserId: v.optional(v.union(v.string(), v.null())),
    plannedStartDate: v.optional(v.union(v.number(), v.null())),
    plannedEndDate: v.optional(v.union(v.number(), v.null())),
    actualStartDate: v.optional(v.union(v.number(), v.null())),
    actualEndDate: v.optional(v.union(v.number(), v.null())),
    progress: v.optional(v.number()),
    blockedReason: v.optional(v.union(v.string(), v.null())),
    budgetAmount: v.optional(v.union(v.number(), v.null())),
    color: v.optional(v.union(v.string(), v.null())),
    taskIds: v.optional(v.array(v.id("tasks"))),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { project } = await getProjectMembership(ctx, args.projectId, identity.subject);
    const milestones = await ctx.db
      .query("projectMilestones")
      .withIndex("by_project_and_order", (q) => q.eq("projectId", args.projectId))
      .collect();

    const order =
      milestones.length > 0 ? Math.max(...milestones.map((milestone) => milestone.order)) + 1 : 0;
    const milestoneId = await ctx.db.insert(
      "projectMilestones",
      buildCreateMilestoneRecord(
        {
          projectId: String(args.projectId),
          teamId: String(project.teamId),
          name: args.name,
          description: args.description,
          order,
          status: args.status,
          ownerClerkUserId: args.ownerClerkUserId,
          plannedStartDate: args.plannedStartDate,
          plannedEndDate: args.plannedEndDate,
          actualStartDate: args.actualStartDate,
          actualEndDate: args.actualEndDate,
          progress: args.progress,
          blockedReason: args.blockedReason,
          budgetAmount: args.budgetAmount,
          color: args.color,
          createdBy: identity.subject,
        },
        Date.now(),
      ) as any,
    );

    if (args.taskIds?.length) {
      for (const taskId of args.taskIds) {
        const task = await ctx.db.get(taskId);
        if (!task || task.projectId !== args.projectId) continue;
        await ctx.db.patch(taskId, {
          milestoneId,
          updatedAt: Date.now(),
        });
      }
    }

    await ctx.runMutation(internalAny.activityLog.logActivity, {
      teamId: project.teamId,
      projectId: args.projectId,
      actionType: "milestone.create",
      details: { name: args.name.trim() },
      entityId: String(milestoneId),
      entityType: "milestone",
    });

    return milestoneId;
  },
});

export const updateProjectMilestone = mutation({
  args: {
    milestoneId: v.id("projectMilestones"),
    name: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    status: v.optional(milestoneStatusValidator),
    ownerClerkUserId: v.optional(v.union(v.string(), v.null())),
    plannedStartDate: v.optional(v.union(v.number(), v.null())),
    plannedEndDate: v.optional(v.union(v.number(), v.null())),
    actualStartDate: v.optional(v.union(v.number(), v.null())),
    actualEndDate: v.optional(v.union(v.number(), v.null())),
    progress: v.optional(v.number()),
    blockedReason: v.optional(v.union(v.string(), v.null())),
    budgetAmount: v.optional(v.union(v.number(), v.null())),
    color: v.optional(v.union(v.string(), v.null())),
    taskIds: v.optional(v.array(v.id("tasks"))),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const milestone = await ctx.db.get(args.milestoneId);
    if (!milestone) {
      throw new Error("Milestone not found");
    }

    const { project } = await getProjectMembership(ctx, milestone.projectId, identity.subject);
    const patch = buildMilestonePatch(args, Date.now());

    await ctx.db.patch(args.milestoneId, patch);

    if (args.taskIds) {
      const projectTasks = await ctx.db
        .query("tasks")
        .withIndex("by_project", (q) => q.eq("projectId", milestone.projectId))
        .collect();

      const updates = getMilestoneTaskUpdates(
        projectTasks.map((task) => ({
          _id: String(task._id),
          milestoneId: task.milestoneId ? String(task.milestoneId) : null,
        })),
        String(args.milestoneId),
        args.taskIds.map(String),
        Date.now(),
      );

      for (const update of updates) {
        await ctx.db.patch(update.taskId as any, update.patch);
      }
    }

    await ctx.runMutation(internalAny.activityLog.logActivity, {
      teamId: project.teamId,
      projectId: milestone.projectId,
      actionType: "milestone.update",
      details: { name: patch.name || milestone.name },
      entityId: String(args.milestoneId),
      entityType: "milestone",
    });

    return args.milestoneId;
  },
});

export const reorderProjectMilestones = mutation({
  args: {
    projectId: v.id("projects"),
    milestoneIds: v.array(v.id("projectMilestones")),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { project } = await getProjectMembership(ctx, args.projectId, identity.subject);

    for (let index = 0; index < args.milestoneIds.length; index += 1) {
      const milestoneId = args.milestoneIds[index];
      const milestone = await ctx.db.get(milestoneId);
      if (!milestone || milestone.projectId !== args.projectId) {
        continue;
      }

      await ctx.db.patch(milestoneId, {
        order: index,
        updatedAt: Date.now(),
      });
    }

    await ctx.runMutation(internalAny.activityLog.logActivity, {
      teamId: project.teamId,
      projectId: args.projectId,
      actionType: "milestone.reorder",
      details: { count: args.milestoneIds.length },
      entityId: String(args.projectId),
      entityType: "project",
    });

    return { success: true };
  },
});

export const deleteProjectMilestone = mutation({
  args: {
    milestoneId: v.id("projectMilestones"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const milestone = await ctx.db.get(args.milestoneId);
    if (!milestone) {
      throw new Error("Milestone not found");
    }

    const { project } = await getProjectMembership(ctx, milestone.projectId, identity.subject);
    const linkedTasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", milestone.projectId))
      .collect();

    for (const task of linkedTasks.filter((task) => task.milestoneId === args.milestoneId)) {
      await ctx.db.patch(task._id, {
        milestoneId: null,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.delete(args.milestoneId);

    await ctx.runMutation(internalAny.activityLog.logActivity, {
      teamId: project.teamId,
      projectId: milestone.projectId,
      actionType: "milestone.delete",
      details: { name: milestone.name },
      entityId: String(args.milestoneId),
      entityType: "milestone",
    });

    return args.milestoneId;
  },
});
