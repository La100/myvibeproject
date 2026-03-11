import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
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
    name: user?.name || user?.displayName || user?.email || "Unknown user",
    imageUrl: user?.imageUrl,
  };
};

const sortMilestones = (milestones: Array<Doc<"projectMilestones">>) =>
  [...milestones].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    return left._creationTime - right._creationTime;
  });

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
        const linkedTasks = tasks.filter((task) => task.milestoneId === milestone._id);
        const completedTasks = linkedTasks.filter((task) => task.status === "done");
        const owner = await resolveMilestoneOwner(ctx, milestone.ownerClerkUserId ?? null);
        const plannedEndDate = milestone.plannedEndDate ?? null;
        const isOverdue =
          milestone.status !== "completed" &&
          typeof plannedEndDate === "number" &&
          plannedEndDate < Date.now();

        return {
          ...milestone,
          owner,
          taskCount: linkedTasks.length,
          completedTaskCount: completedTasks.length,
          openTaskCount: linkedTasks.length - completedTasks.length,
          tasks: linkedTasks
            .sort((left, right) => {
              const leftDate = left.endDate || left.startDate || Number.MAX_SAFE_INTEGER;
              const rightDate = right.endDate || right.startDate || Number.MAX_SAFE_INTEGER;
              if (leftDate !== rightDate) return leftDate - rightDate;
              return left.title.localeCompare(right.title);
            })
            .map((task) => ({
              _id: task._id,
              title: task.title,
              status: task.status,
              priority: task.priority ?? null,
              endDate: task.endDate,
              assignedTo: task.assignedTo ?? null,
            })),
          isOverdue,
        };
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

    if (milestones.length === 0) {
      return {
        total: 0,
        completed: 0,
        atRisk: 0,
        blocked: 0,
        progress: 0,
        nextMilestone: null,
      };
    }

    const orderedMilestones = sortMilestones(milestones);
    const completed = orderedMilestones.filter((milestone) => milestone.status === "completed").length;
    const atRisk = orderedMilestones.filter((milestone) => milestone.status === "at_risk").length;
    const blocked = orderedMilestones.filter((milestone) => milestone.status === "blocked").length;
    const nextMilestone = orderedMilestones.find((milestone) => milestone.status !== "completed") || null;
    const aggregateProgress = Math.round(
      orderedMilestones.reduce((sum, milestone) => sum + Math.max(0, Math.min(100, milestone.progress || 0)), 0) /
        Math.max(orderedMilestones.length, 1),
    );

    return {
      total: orderedMilestones.length,
      completed,
      atRisk,
      blocked,
      progress: aggregateProgress,
      nextMilestone: nextMilestone
        ? {
            ...nextMilestone,
            taskCount: tasks.filter((task) => task.milestoneId === nextMilestone._id).length,
          }
        : null,
    };
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
    const milestoneId = await ctx.db.insert("projectMilestones", {
      projectId: args.projectId,
      teamId: project.teamId,
      name: args.name.trim(),
      description: args.description?.trim() || undefined,
      order,
      status: args.status || "planned",
      ownerClerkUserId: args.ownerClerkUserId ?? undefined,
      plannedStartDate: args.plannedStartDate ?? undefined,
      plannedEndDate: args.plannedEndDate ?? undefined,
      actualStartDate: args.actualStartDate ?? undefined,
      actualEndDate: args.actualEndDate ?? undefined,
      progress: Math.max(0, Math.min(100, Math.round(args.progress ?? 0))),
      blockedReason: args.blockedReason?.trim() || undefined,
      budgetAmount: args.budgetAmount ?? undefined,
      color: args.color?.trim() || undefined,
      createdBy: identity.subject,
      updatedAt: Date.now(),
    });

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
    const patch: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.name !== undefined) {
      patch.name = args.name.trim();
    }
    if (args.description !== undefined) {
      patch.description = args.description?.trim() || undefined;
    }
    if (args.status !== undefined) {
      patch.status = args.status;
    }
    if (args.ownerClerkUserId !== undefined) {
      patch.ownerClerkUserId = args.ownerClerkUserId ?? undefined;
    }
    if (args.plannedStartDate !== undefined) {
      patch.plannedStartDate = args.plannedStartDate ?? undefined;
    }
    if (args.plannedEndDate !== undefined) {
      patch.plannedEndDate = args.plannedEndDate ?? undefined;
    }
    if (args.actualStartDate !== undefined) {
      patch.actualStartDate = args.actualStartDate ?? undefined;
    }
    if (args.actualEndDate !== undefined) {
      patch.actualEndDate = args.actualEndDate ?? undefined;
    }
    if (args.progress !== undefined) {
      patch.progress = Math.max(0, Math.min(100, Math.round(args.progress)));
    }
    if (args.blockedReason !== undefined) {
      patch.blockedReason = args.blockedReason?.trim() || undefined;
    }
    if (args.budgetAmount !== undefined) {
      patch.budgetAmount = args.budgetAmount ?? undefined;
    }
    if (args.color !== undefined) {
      patch.color = args.color?.trim() || undefined;
    }

    await ctx.db.patch(args.milestoneId, patch);

    if (args.taskIds) {
      const projectTasks = await ctx.db
        .query("tasks")
        .withIndex("by_project", (q) => q.eq("projectId", milestone.projectId))
        .collect();

      const desiredTaskIds = new Set(args.taskIds.map((taskId) => String(taskId)));

      for (const task of projectTasks) {
        if (task.milestoneId === args.milestoneId && !desiredTaskIds.has(String(task._id))) {
          await ctx.db.patch(task._id, {
            milestoneId: null,
            updatedAt: Date.now(),
          });
        } else if (desiredTaskIds.has(String(task._id)) && task.milestoneId !== args.milestoneId) {
          await ctx.db.patch(task._id, {
            milestoneId: args.milestoneId,
            updatedAt: Date.now(),
          });
        }
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
