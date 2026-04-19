import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  action,
} from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
// Keep runtime-loaded internal refs here to avoid deep TS instantiation.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const internalAny = require("./_generated/api").internal as any;

const logActivityMutationRef = makeFunctionReference<"mutation">(
  "activityLog:logActivity",
);
const checkAIFeatureAccessByProjectQueryRef = makeFunctionReference<"query">(
  "stripe:checkAIFeatureAccessByProject",
);
const getTeamMembersForIndexingQueryRef = makeFunctionReference<"query">(
  "teams:getTeamMembersForIndexing",
);
const getTaskQueryRef = makeFunctionReference<"query">("tasks:getTask");

const resolveActorClerkUserId = async (
  ctx: any,
  actorClerkUserId?: string,
): Promise<string | null> => {
  if (
    typeof actorClerkUserId === "string" &&
    actorClerkUserId.trim().length > 0
  ) {
    return actorClerkUserId.trim();
  }

  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
};

// Utility function to check project read access
const hasProjectAccess = async (
  ctx: any,
  projectId: Id<"projects">,
  requireWriteAccess = false,
  actorClerkUserId?: string,
): Promise<boolean> => {
  const effectiveActorClerkUserId = await resolveActorClerkUserId(
    ctx,
    actorClerkUserId,
  );
  if (!effectiveActorClerkUserId) return false;

  const project = await ctx.db.get(projectId);
  if (!project) return false;

  const membership = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q: any) =>
      q
        .eq("teamId", project.teamId)
        .eq("clerkUserId", effectiveActorClerkUserId),
    )
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .first();

  if (!membership) return false;

  if (membership.role === "admin") {
    // Admin has full access to all projects
    return true;
  }

  if (membership.role === "member") {
    // Member may have limited access to specific projects
    if (membership.projectIds && membership.projectIds.length > 0) {
      return membership.projectIds.includes(projectId);
    }
    return false;
  }

  return false;
};

// Utility function to check task read/write access
const hasTaskAccess = async (
  ctx: any,
  taskId: Id<"tasks">,
  requireWriteAccess = false,
  actorClerkUserId?: string,
): Promise<boolean> => {
  const task = await ctx.db.get(taskId);
  if (!task) return false;
  return await hasProjectAccess(
    ctx,
    task.projectId,
    requireWriteAccess,
    actorClerkUserId,
  );
};

const scheduleTaskNotification = async (
  ctx: any,
  args: {
    taskId: Id<"tasks">;
    eventType:
      | "task.assigned"
      | "task.unassigned"
      | "task.status_updated"
      | "task.due_date_changed"
      | "task.comment_added";
    recipientClerkUserIds: string[];
    actorClerkUserId?: string;
    fromStatus?: string;
    toStatus?: string;
    previousDueDate?: number | null;
    currentDueDate?: number | null;
    commentPreview?: string;
  },
) => {
  const recipientClerkUserIds = Array.from(
    new Set(
      args.recipientClerkUserIds.map((value) => value.trim()).filter(Boolean),
    ),
  );

  if (recipientClerkUserIds.length === 0) {
    return;
  }

  await ctx.scheduler.runAfter(
    0,
    internalAny.notifications.sendTaskEventEmail,
    {
      ...args,
      recipientClerkUserIds,
    },
  );
};

const insertTaskRecord = async (
  ctx: any,
  args: {
    title: string;
    projectId: Id<"projects">;
    teamId: Id<"teams">;
    description?: string;
    status: "todo" | "in_progress" | "review" | "done";
    priority?: "low" | "medium" | "high" | "urgent";
    assignedTo?: string | null;
    startDate?: number;
    endDate?: number;
    tags?: string[];
    content?: string;
  },
  createdBy: string,
) => {
  const taskId = await ctx.db.insert("tasks", {
    projectId: args.projectId,
    teamId: args.teamId,
    title: args.title,
    description: args.description,
    status: args.status,
    priority: args.priority,
    assignedTo: args.assignedTo,
    createdBy,
    startDate: args.startDate,
    endDate: args.endDate,
    tags: args.tags ?? [],
    updatedAt: Date.now(),
    content: args.content ?? undefined,
  });

  await ctx.runMutation(logActivityMutationRef, {
    teamId: args.teamId,
    projectId: args.projectId,
    taskId,
    actionType: "task.create",
    details: { title: args.title },
    entityId: taskId,
    entityType: "task",
  });

  if (args.assignedTo) {
    await scheduleTaskNotification(ctx, {
      taskId,
      eventType: "task.assigned",
      recipientClerkUserIds: [args.assignedTo],
      actorClerkUserId: createdBy,
    });
  }

  return taskId;
};

const updateTaskRecord = async (
  ctx: any,
  taskId: Id<"tasks">,
  updates: {
    title?: string;
    description?: string;
    status?: "todo" | "in_progress" | "review" | "done";
    priority?: "low" | "medium" | "high" | "urgent" | null;
    assignedTo?: string | null;
    startDate?: number;
    endDate?: number;
    tags?: string[];
    content?: string;
  },
  actorClerkUserId?: string,
) => {
  const task = await ctx.db.get(taskId);
  if (!task) throw new Error("Task not found");

  const hadAssignedToUpdate = Object.prototype.hasOwnProperty.call(
    updates,
    "assignedTo",
  );
  const hadStatusUpdate = Object.prototype.hasOwnProperty.call(
    updates,
    "status",
  );
  const hadDueDateUpdate = Object.prototype.hasOwnProperty.call(
    updates,
    "endDate",
  );
  const nextAssignedTo = hadAssignedToUpdate
    ? (updates.assignedTo ?? null)
    : (task.assignedTo ?? null);

  const updatePayload = { ...updates, updatedAt: Date.now() };
  await ctx.db.patch(taskId, updatePayload as Partial<Doc<"tasks">>);

  await ctx.runMutation(logActivityMutationRef, {
    teamId: task.teamId,
    projectId: task.projectId,
    taskId,
    actionType: "task.update",
    details: { title: task.title, updatedFields: Object.keys(updatePayload) },
    entityId: taskId,
    entityType: "task",
  });

  if (hadAssignedToUpdate && task.assignedTo !== nextAssignedTo) {
    if (task.assignedTo) {
      await scheduleTaskNotification(ctx, {
        taskId,
        eventType: "task.unassigned",
        recipientClerkUserIds: [task.assignedTo],
        actorClerkUserId,
      });
    }

    if (nextAssignedTo) {
      await scheduleTaskNotification(ctx, {
        taskId,
        eventType: "task.assigned",
        recipientClerkUserIds: [nextAssignedTo],
        actorClerkUserId,
      });
    }
  }

  if (
    hadStatusUpdate &&
    updates.status &&
    updates.status !== task.status &&
    nextAssignedTo
  ) {
    await scheduleTaskNotification(ctx, {
      taskId,
      eventType: "task.status_updated",
      recipientClerkUserIds: [nextAssignedTo],
      actorClerkUserId,
      fromStatus: task.status,
      toStatus: updates.status,
    });
  }

  if (hadDueDateUpdate && updates.endDate !== task.endDate && nextAssignedTo) {
    await scheduleTaskNotification(ctx, {
      taskId,
      eventType: "task.due_date_changed",
      recipientClerkUserIds: [nextAssignedTo],
      actorClerkUserId,
      previousDueDate: task.endDate ?? null,
      currentDueDate: updates.endDate ?? null,
    });
  }
};

const deleteTaskRecord = async (ctx: any, taskId: Id<"tasks">) => {
  const task = await ctx.db.get(taskId);
  if (!task) return;

  await ctx.runMutation(logActivityMutationRef, {
    teamId: task.teamId,
    projectId: task.projectId,
    taskId,
    actionType: "task.delete",
    details: { title: task.title },
    entityId: taskId,
    entityType: "task",
  });

  await ctx.db.delete(taskId);
};

// ====== QUERIES ======

export const listProjectTasks = query({
  args: {
    projectId: v.id("projects"),
    filters: v.optional(
      v.object({
        status: v.optional(v.array(v.string())),
        priority: v.optional(v.array(v.string())),
        searchQuery: v.optional(v.string()),
        assignedTo: v.optional(v.array(v.string())),
        tags: v.optional(v.array(v.string())),
      }),
    ),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  async handler(ctx, args) {
    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) return [];

    let tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Apply filters
    if (args.filters) {
      tasks = tasks.filter((task) => {
        const { status, priority, searchQuery, assignedTo, tags } =
          args.filters!;
        if (status && status.length > 0 && !status.includes(task.status))
          return false;
        if (
          priority &&
          priority.length > 0 &&
          task.priority &&
          !priority.includes(task.priority)
        )
          return false;
        if (
          searchQuery &&
          !task.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
          return false;
        if (
          assignedTo &&
          assignedTo.length > 0 &&
          (!task.assignedTo || !assignedTo.includes(task.assignedTo))
        )
          return false;
        if (tags && tags.length > 0) {
          if (
            !task.tags ||
            !tags.some((filterTag) => task.tags.includes(filterTag))
          )
            return false;
        }
        return true;
      });
    }

    // Apply sorting
    if (args.sortBy) {
      tasks.sort((a, b) => {
        const fieldA = a[args.sortBy as keyof typeof a] as any;
        const fieldB = b[args.sortBy as keyof typeof b] as any;
        if (fieldA == null && fieldB == null) return 0;
        if (fieldA == null) return args.sortOrder === "desc" ? 1 : -1;
        if (fieldB == null) return args.sortOrder === "desc" ? -1 : 1;
        let comparison = 0;
        if (fieldA > fieldB) comparison = 1;
        else if (fieldA < fieldB) comparison = -1;
        return args.sortOrder === "desc" ? -comparison : comparison;
      });
    }

    const userIds = Array.from(
      new Set(
        tasks.flatMap((task) => {
          const ids = [task.createdBy];
          if (task.assignedTo) ids.push(task.assignedTo);
          return ids;
        }),
      ),
    );

    const [users, projectComments] = await Promise.all([
      Promise.all(
        userIds.map(
          async (userId) =>
            [
              userId,
              await ctx.db
                .query("users")
                .withIndex("by_clerk_user_id", (q) =>
                  q.eq("clerkUserId", userId),
                )
                .unique(),
            ] as const,
        ),
      ),
      ctx.db
        .query("comments")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
    ]);

    const usersByClerkId = new Map(users);
    const commentCountByTaskId = new Map<string, number>();

    for (const comment of projectComments) {
      if (!comment.taskId) continue;
      const taskId = comment.taskId as string;
      commentCountByTaskId.set(
        taskId,
        (commentCountByTaskId.get(taskId) ?? 0) + 1,
      );
    }

    return tasks.map((task) => {
      const assignedUser = task.assignedTo
        ? usersByClerkId.get(task.assignedTo)
        : undefined;
      const createdByUser = usersByClerkId.get(task.createdBy);
      return {
        ...task,
        assignedToName: assignedUser?.name,
        assignedToImageUrl: assignedUser?.imageUrl,
        createdByName: createdByUser?.name,
        commentCount: commentCountByTaskId.get(task._id as string) ?? 0,
      };
    });
  },
});

export const listProjectTasksForAI = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.array(
    v.object({
      _id: v.id("tasks"),
      projectId: v.id("projects"),
      assignedTo: v.union(v.string(), v.null()),
    }),
  ),
  async handler(ctx, args) {
    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) return [];

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return tasks.map((task) => ({
      _id: task._id,
      projectId: task.projectId,
      assignedTo: task.assignedTo ?? null,
    }));
  },
});

export const getTaskForAI = internalQuery({
  args: {
    taskId: v.id("tasks"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("tasks"),
      projectId: v.id("projects"),
      assignedTo: v.union(v.string(), v.null()),
    }),
  ),
  async handler(ctx, args) {
    const hasAccess = await hasTaskAccess(ctx, args.taskId);
    if (!hasAccess) return null;

    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    return {
      _id: task._id,
      projectId: task.projectId,
      assignedTo: task.assignedTo ?? null,
    };
  },
});

export const listProjectTasksInternal = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.array(
    v.object({
      _id: v.id("tasks"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      teamId: v.id("teams"),
      title: v.string(),
      description: v.optional(v.string()),
      content: v.optional(v.string()),
      status: v.union(
        v.literal("todo"),
        v.literal("in_progress"),
        v.literal("review"),
        v.literal("done"),
      ),
      priority: v.optional(
        v.union(
          v.literal("low"),
          v.literal("medium"),
          v.literal("high"),
          v.literal("urgent"),
          v.null(),
        ),
      ),
      assignedTo: v.optional(v.union(v.string(), v.null())),
      createdBy: v.string(),
      startDate: v.optional(v.number()),
      endDate: v.optional(v.number()),
      tags: v.array(v.string()),
      updatedAt: v.optional(v.number()),
    }),
  ),
  async handler(ctx, args) {
    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) return [];

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return tasks;
  },
});

export const getTaskInternal = internalQuery({
  args: {
    taskId: v.id("tasks"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("tasks"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      teamId: v.id("teams"),
      title: v.string(),
      description: v.optional(v.string()),
      content: v.optional(v.string()),
      status: v.union(
        v.literal("todo"),
        v.literal("in_progress"),
        v.literal("review"),
        v.literal("done"),
      ),
      priority: v.optional(
        v.union(
          v.literal("low"),
          v.literal("medium"),
          v.literal("high"),
          v.literal("urgent"),
          v.null(),
        ),
      ),
      assignedTo: v.optional(v.union(v.string(), v.null())),
      createdBy: v.string(),
      startDate: v.optional(v.number()),
      endDate: v.optional(v.number()),
      tags: v.array(v.string()),
      updatedAt: v.optional(v.number()),
    }),
  ),
  async handler(ctx, args) {
    const hasAccess = await hasTaskAccess(ctx, args.taskId);
    if (!hasAccess) return null;

    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    return task;
  },
});

export const getTask = query({
  args: { taskId: v.id("tasks") },
  async handler(ctx, args) {
    const hasAccess = await hasTaskAccess(ctx, args.taskId);
    if (!hasAccess) return null;
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    let assignedToName, assignedToImageUrl;
    if (task.assignedTo) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q) =>
          q.eq("clerkUserId", task.assignedTo!),
        )
        .unique();
      assignedToName = user?.name ?? user?.email;
      assignedToImageUrl = user?.imageUrl;
    }
    const createdByUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", task.createdBy))
      .unique();

    return {
      ...task,
      assignedToName,
      assignedToImageUrl,
      createdByName: createdByUser?.name,
    };
  },
});

export const getCommentsForTask = query({
  args: { taskId: v.id("tasks") },
  async handler(ctx, args) {
    const hasAccess = await hasTaskAccess(ctx, args.taskId);
    if (!hasAccess) return [];
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .order("desc")
      .collect();
    return Promise.all(
      comments.map(async (comment) => {
        const author = await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", (q) =>
            q.eq("clerkUserId", comment.authorId),
          )
          .unique();
        return {
          ...comment,
          authorName: author?.name,
          authorImageUrl: author?.imageUrl,
        };
      }),
    );
  },
});

export const listTeamTasks = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    const tasksWithProjects = await Promise.all(
      tasks.map(async (task) => {
        const project = await ctx.db.get(task.projectId);
        return {
          ...task,
          projectName: project?.name || "Unknown Project",
          projectSlug: project?.slug || "",
        };
      }),
    );

    return tasksWithProjects;
  },
});

export const getTasksForIndexing = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

// ====== MUTATIONS ======

export const createTask = mutation({
  args: {
    title: v.string(),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done"),
    ),
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent"),
      ),
    ),
    assignedTo: v.optional(v.union(v.string(), v.null())),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    content: v.optional(v.string()),
    sectionId: v.optional(v.union(v.id("taskSections"), v.null())),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const hasAccess = await hasProjectAccess(
      ctx,
      args.projectId,
      true,
      identity.subject,
    );
    if (!hasAccess) throw new Error("Permission denied.");
    return await insertTaskRecord(ctx, args, identity.subject);
  },
});

export const updateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("todo"),
        v.literal("in_progress"),
        v.literal("review"),
        v.literal("done"),
      ),
    ),
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent"),
        v.null(),
      ),
    ),
    assignedTo: v.optional(v.union(v.string(), v.null())),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    content: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const hasAccess = await hasTaskAccess(
      ctx,
      args.taskId,
      true,
      identity.subject,
    );
    if (!hasAccess) throw new Error("Permission denied.");
    const { taskId, ...updates } = args;
    await updateTaskRecord(ctx, taskId, updates, identity.subject);
  },
});

export const updateTaskStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done"),
    ),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const hasAccess = await hasTaskAccess(
      ctx,
      args.taskId,
      true,
      identity.subject,
    );
    if (!hasAccess) throw new Error("Permission denied.");
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    const originalStatus = task.status;
    if (originalStatus === args.status) return;
    await ctx.db.patch(args.taskId, {
      status: args.status,
      updatedAt: Date.now(),
    });
    await ctx.runMutation(logActivityMutationRef, {
      teamId: task.teamId,
      projectId: task.projectId,
      taskId: args.taskId,
      actionType: "task.status_change",
      details: {
        title: task.title,
        fromStatus: originalStatus,
        toStatus: args.status,
      },
      entityId: args.taskId,
      entityType: "task",
    });

    if (task.assignedTo) {
      await scheduleTaskNotification(ctx, {
        taskId: args.taskId,
        eventType: "task.status_updated",
        recipientClerkUserIds: [task.assignedTo],
        actorClerkUserId: identity.subject,
        fromStatus: originalStatus,
        toStatus: args.status,
      });
    }
  },
});

export const deleteTask = mutation({
  args: { taskId: v.id("tasks") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const hasAccess = await hasTaskAccess(
      ctx,
      args.taskId,
      true,
      identity.subject,
    );
    if (!hasAccess) throw new Error("Permission denied.");
    await deleteTaskRecord(ctx, args.taskId);
  },
});

export const createTaskInternal = internalMutation({
  args: {
    actorClerkUserId: v.string(),
    title: v.string(),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done"),
    ),
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent"),
      ),
    ),
    assignedTo: v.optional(v.union(v.string(), v.null())),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    content: v.optional(v.string()),
    sectionId: v.optional(v.union(v.id("taskSections"), v.null())),
  },
  async handler(ctx, args) {
    const hasAccess = await hasProjectAccess(
      ctx,
      args.projectId,
      true,
      args.actorClerkUserId,
    );
    if (!hasAccess) throw new Error("Permission denied.");
    const { actorClerkUserId, ...taskArgs } = args;
    return await insertTaskRecord(ctx, taskArgs, actorClerkUserId);
  },
});

export const updateTaskInternal = internalMutation({
  args: {
    actorClerkUserId: v.string(),
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("todo"),
        v.literal("in_progress"),
        v.literal("review"),
        v.literal("done"),
      ),
    ),
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent"),
        v.null(),
      ),
    ),
    assignedTo: v.optional(v.union(v.string(), v.null())),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    content: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const hasAccess = await hasTaskAccess(
      ctx,
      args.taskId,
      true,
      args.actorClerkUserId,
    );
    if (!hasAccess) throw new Error("Permission denied.");
    const { actorClerkUserId, taskId, ...updates } = args;
    await updateTaskRecord(ctx, taskId, updates, actorClerkUserId);
  },
});

export const deleteTaskInternal = internalMutation({
  args: {
    actorClerkUserId: v.string(),
    taskId: v.id("tasks"),
  },
  async handler(ctx, args) {
    const hasAccess = await hasTaskAccess(
      ctx,
      args.taskId,
      true,
      args.actorClerkUserId,
    );
    if (!hasAccess) throw new Error("Permission denied.");
    await deleteTaskRecord(ctx, args.taskId);
  },
});

export const assignTask = mutation({
  args: { taskId: v.id("tasks"), userId: v.optional(v.string()) },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const hasAccess = await hasTaskAccess(
      ctx,
      args.taskId,
      true,
      identity.subject,
    );
    if (!hasAccess) throw new Error("Permission denied.");
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    const originalAssignee = task.assignedTo;
    if (originalAssignee === args.userId) return;
    await ctx.db.patch(args.taskId, {
      assignedTo: args.userId,
      updatedAt: Date.now(),
    });
    await ctx.runMutation(logActivityMutationRef, {
      teamId: task.teamId,
      projectId: task.projectId,
      taskId: args.taskId,
      actionType: "task.assign",
      details: {
        title: task.title,
        from: originalAssignee || "unassigned",
        to: args.userId || "unassigned",
      },
      entityId: args.taskId,
      entityType: "task",
    });

    if (originalAssignee) {
      await scheduleTaskNotification(ctx, {
        taskId: args.taskId,
        eventType: "task.unassigned",
        recipientClerkUserIds: [originalAssignee],
        actorClerkUserId: identity.subject,
      });
    }

    if (args.userId) {
      await scheduleTaskNotification(ctx, {
        taskId: args.taskId,
        eventType: "task.assigned",
        recipientClerkUserIds: [args.userId],
        actorClerkUserId: identity.subject,
      });
    }
  },
});

export const updateTaskContent = mutation({
  args: { taskId: v.id("tasks"), content: v.string() },
  async handler(ctx, args) {
    const hasAccess = await hasTaskAccess(ctx, args.taskId, true);
    if (!hasAccess) throw new Error("Permission denied.");
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await ctx.db.patch(args.taskId, {
      content: args.content,
      updatedAt: Date.now(),
    });
    await ctx.runMutation(logActivityMutationRef, {
      teamId: task.teamId,
      projectId: task.projectId,
      taskId: args.taskId,
      actionType: "task.content.update",
      details: { title: task.title },
      entityId: args.taskId,
      entityType: "task",
    });
  },
});

// ====== ACTIONS ======

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const generateTaskDetailsFromPrompt = action({
  args: {
    prompt: v.string(),
    projectId: v.id("projects"),
    timezoneOffsetInMinutes: v.number(),
    taskId: v.optional(v.id("tasks")),
  },
  handler: async (ctx, args): Promise<any> => {
    // 🔒 CHECK SUBSCRIPTION: AI features require Pro+ subscription
    const subscriptionCheck = await ctx.runQuery(
      checkAIFeatureAccessByProjectQueryRef,
      {
        projectId: args.projectId,
      },
    );

    if (!subscriptionCheck.allowed) {
      throw new Error(
        subscriptionCheck.message ||
          "🚫 AI features require Pro or Enterprise subscription. Please upgrade your plan to use AI task generation.",
      );
    }

    const teamMembers: any[] = await ctx.runQuery(
      getTeamMembersForIndexingQueryRef,
      {
        projectId: args.projectId,
      },
    );
    const memberList = teamMembers.map((m: any) => ({
      name: m.name || m.email || "Unknown User",
      email: m.email,
      id: m.clerkUserId,
    }));

    const offsetHours = -args.timezoneOffsetInMinutes / 60;
    const offsetSign = offsetHours >= 0 ? "+" : "-";
    const offsetString = `UTC${offsetSign}${String(Math.floor(Math.abs(offsetHours))).padStart(2, "0")}:${String(Math.abs(args.timezoneOffsetInMinutes) % 60).padStart(2, "0")}`;

    let taskContext = "";
    if (args.taskId) {
      const task = await ctx.runQuery(getTaskQueryRef, { taskId: args.taskId });
      if (task) {
        taskContext = `
The user is editing an existing task. Here is the current state of the task:
- Current Title: ${task.title}
- Current Description: ${task.description || "N/A"}
- Current Status: ${task.status}
- Current Priority: ${task.priority || "N/A"}
- Current Assignee: ${task.assignedToName || "N/A"}
- Current Tags: ${task.tags?.join(", ") || "N/A"}

Your goal is to intelligently modify this task based on the user's prompt. For example, if the user says 'add X to the description', you must append 'X' to the current description. If the user asks to add a tag, append it to the existing array of tags. Do not just replace fields unless the user's intent is clearly to replace.
`;
      }
    }

    const systemPrompt: string = `
You are an intelligent assistant for a project management app.
Parse the user's request to extract task properties into a JSON object.
Today's date is ${new Date().toISOString().split("T")[0]}.
The user's local timezone is ${offsetString}. Please interpret all times in the user's prompt (e.g., "at 3 PM", "15:00") as being in this user's local timezone.
${taskContext}
The available properties are:
- title: string
- description: string
- priority: 'low' | 'medium' | 'high' | 'urgent' | null. To remove priority, return null.
- status: 'todo' | 'in_progress' | 'review' | 'done'
- startDate: ISO 8601 date-time string (e.g., YYYY-MM-DDTHH:mm:ss.sssZ). IMPORTANT: After interpreting the time in the user's local timezone, convert it to UTC for the final ISO string. If the user does NOT provide a specific time, the time part of the string MUST be set to midnight UTC (T00:00:00.000Z).
- endDate: ISO 8601 date-time string (e.g., YYYY-MM-DDTHH:mm:ss.sssZ). IMPORTANT: After interpreting the time in the user's local timezone, convert it to UTC for the final ISO string. If the user does NOT provide a specific time, the time part of the string MUST be set to midnight UTC (T00:00:00.000Z).
- assignedTo: string (must be one of the user IDs from the provided list)
- tags: string[] (array of strings)

The title is a short, concise summary. The description contains all other details, notes, and context.
If a single date or deadline is mentioned, set both startDate and endDate to that date. For date ranges like "from Monday to Friday", set startDate to Monday and endDate to Friday.
This applies to relative dates and multilingual phrasing, including Polish requests such as "jutro", "dzisiaj", "pojutrze", "w poniedzialek", and times like "na 13" or "o 13:00".

Here are the available team members for assignment. When assigning a task, match the name or email mentioned in the prompt to one of these users and return their ID (clerkUserId).
For example, if the prompt mentions "assign to John" or "assign to john@example.com", find the matching user in this list and use their 'id' value for the assignedTo field.
IMPORTANT: The assignedTo field must contain the user's ID (from the 'id' field below), NOT their name or email.

Team Members:
${JSON.stringify(memberList, null, 2)}

Analyze the following prompt and return ONLY the JSON object.
Prompt: "${args.prompt}"
`;
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "system", content: systemPrompt }],
        response_format: { type: "json_object" },
      });

      const jsonResponse: string | null = response.choices[0].message.content;
      if (!jsonResponse) {
        throw new Error("AI did not return a response.");
      }

      return JSON.parse(jsonResponse);
    } catch (error) {
      console.error("Error parsing task from AI:", error);
      throw new Error("Failed to generate task details from prompt.");
    }
  },
});

// ====== HELPER FUNCTIONS FOR INCREMENTAL INDEXING ======

export const getTaskById = internalQuery({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.taskId);
  },
});

export const getTasksChangedAfter = internalQuery({
  args: {
    projectId: v.id("projects"),
    since: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) =>
        q.or(
          q.gt(q.field("_creationTime"), args.since),
          q.gt(q.field("updatedAt"), args.since),
        ),
      )
      .collect();
  },
});
