import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { query, mutation, internalQuery, action } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// Utility function to check project read access
const hasProjectAccess = async (ctx: any, projectId: Id<"projects">, requireWriteAccess = false): Promise<boolean> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;

  const project = await ctx.db.get(projectId);
  if (!project) return false;

  const membership = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q: any) =>
      q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
    )
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .first();

  if (!membership) return false;

  if (membership.role === 'admin') {
    // Admin has full access to all projects
    return true;
  }

  if (membership.role === 'member') {
    // Member may have limited access to specific projects
    if (membership.projectIds && membership.projectIds.length > 0) {
      return membership.projectIds.includes(projectId);
    }
    // Member without projectIds has access to all projects (backward compatibility)
    return true;
  }

  if (membership.role === 'customer') {
    if (requireWriteAccess) return false; // Customers never have write access
    return membership.projectIds?.includes(projectId) ?? false;
  }

  if (membership.role === 'client') {
    if (requireWriteAccess) return false; // Clients never have write access
    return membership.projectIds?.includes(projectId) ?? false;
  }

  return false;
};

// Utility function to check task read/write access
const hasTaskAccess = async (ctx: any, taskId: Id<"tasks">, requireWriteAccess = false): Promise<boolean> => {
  const task = await ctx.db.get(taskId);
  if (!task) return false;
  return await hasProjectAccess(ctx, task.projectId, requireWriteAccess);
}

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
      })
    ),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  async handler(ctx, args) {
    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) return [];

    let tasks = await ctx.db.query("tasks").withIndex("by_project", (q) => q.eq("projectId", args.projectId)).collect();

    // Apply filters
    if (args.filters) {
      tasks = tasks.filter((task) => {
        const { status, priority, searchQuery, assignedTo, tags } = args.filters!;
        if (status && status.length > 0 && !status.includes(task.status)) return false;
        if (priority && priority.length > 0 && task.priority && !priority.includes(task.priority)) return false;
        if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (assignedTo && assignedTo.length > 0 && (!task.assignedTo || !assignedTo.includes(task.assignedTo))) return false;
        if (tags && tags.length > 0) {
          if (!task.tags || !tags.some(filterTag => task.tags.includes(filterTag))) return false;
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
        if (fieldA == null) return args.sortOrder === 'desc' ? 1 : -1;
        if (fieldB == null) return args.sortOrder === 'desc' ? -1 : 1;
        let comparison = 0;
        if (fieldA > fieldB) comparison = 1;
        else if (fieldA < fieldB) comparison = -1;
        return args.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return await Promise.all(
      tasks.map(async (task) => {
        let assignedToName: string | undefined;
        let assignedToImageUrl: string | undefined;
        if (task.assignedTo) {
          const user = await ctx.db.query("users").withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", task.assignedTo!)).unique();
          if (user) { assignedToName = user.name; assignedToImageUrl = user.imageUrl; }
        }
        const createdByUser = await ctx.db.query("users").withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", task.createdBy)).unique();
        const commentCount = (await ctx.db.query("comments").withIndex("by_task", q => q.eq("taskId", task._id)).collect()).length;
        return { ...task, assignedToName, assignedToImageUrl, createdByName: createdByUser?.name, commentCount };
      })
    );
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
    })
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
    })
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
      cost: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
    })
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
      cost: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
    })
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
      const user = await ctx.db.query("users").withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", task.assignedTo!)).unique();
      assignedToName = user?.name ?? user?.email;
      assignedToImageUrl = user?.imageUrl;
    }
    const createdByUser = await ctx.db.query("users").withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", task.createdBy)).unique();

    return {
      ...task,
      assignedToName,
      assignedToImageUrl,
      createdByName: createdByUser?.name
    };
  },
});

export const getCommentsForTask = query({
  args: { taskId: v.id("tasks") },
  async handler(ctx, args) {
    const hasAccess = await hasTaskAccess(ctx, args.taskId);
    if (!hasAccess) return [];
    const comments = await ctx.db.query("comments").withIndex("by_task", (q) => q.eq("taskId", args.taskId)).order("desc").collect();
    return Promise.all(
      comments.map(async (comment) => {
        const author = await ctx.db.query("users").withIndex("by_clerk_user_id", q => q.eq("clerkUserId", comment.authorId)).unique();
        return { ...comment, authorName: author?.name, authorImageUrl: author?.imageUrl };
      })
    );
  }
});

export const listTeamTasks = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_team", q => q.eq("teamId", args.teamId))
      .collect();

    const tasksWithProjects = await Promise.all(
      tasks.map(async (task) => {
        const project = await ctx.db.get(task.projectId);
        return {
          ...task,
          projectName: project?.name || "Unknown Project",
          projectSlug: project?.slug || "",
        };
      })
    );

    return tasksWithProjects;
  }
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
    status: v.union(v.literal("todo"), v.literal("in_progress"), v.literal("review"), v.literal("done")),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    assignedTo: v.optional(v.union(v.string(), v.null())),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    cost: v.optional(v.number()),
    content: v.optional(v.string()),
    sectionId: v.optional(v.union(v.id("taskSections"), v.null())),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const hasAccess = await hasProjectAccess(ctx, args.projectId, true);
    if (!hasAccess) throw new Error("Permission denied.");
    const taskId = await ctx.db.insert("tasks", {
      projectId: args.projectId,
      teamId: args.teamId,
      title: args.title,
      description: args.description,
      status: args.status,
      priority: args.priority,
      assignedTo: args.assignedTo,
      createdBy: identity.subject,
      startDate: args.startDate,
      endDate: args.endDate,
      tags: args.tags ?? [],
      cost: args.cost,
      updatedAt: Date.now(),
      content: args.content ?? undefined,
    });
    // @ts-ignore
    await ctx.runMutation((internal as any).activityLog.logActivity, {
      teamId: args.teamId,
      projectId: args.projectId,
      taskId: taskId,
      actionType: "task.create",
      details: { title: args.title },
      entityId: taskId,
      entityType: "task",
    });

    return taskId;
  },
});

export const updateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("review"), v.literal("done"))),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"), v.null())),
    assignedTo: v.optional(v.union(v.string(), v.null())),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    cost: v.optional(v.number()),
    content: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const hasAccess = await hasTaskAccess(ctx, args.taskId, true);
    if (!hasAccess) throw new Error("Permission denied.");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const { taskId, ...updates } = args;
    const updatePayload = { ...updates, updatedAt: Date.now() };

    await ctx.db.patch(taskId, updatePayload as Partial<Doc<"tasks">>);

    await ctx.runMutation(internal.activityLog.logActivity, {
      teamId: task.teamId,
      projectId: task.projectId,
      taskId: args.taskId,
      actionType: "task.update",
      details: { title: task.title, updatedFields: Object.keys(updatePayload) },
      entityId: args.taskId,
      entityType: "task",
    });

  },
});

export const updateTaskStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    status: v.union(v.literal("todo"), v.literal("in_progress"), v.literal("review"), v.literal("done")),
  },
  async handler(ctx, args) {
    const hasAccess = await hasTaskAccess(ctx, args.taskId, true);
    if (!hasAccess) throw new Error("Permission denied.");
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    const originalStatus = task.status;
    if (originalStatus === args.status) return;
    await ctx.db.patch(args.taskId, { status: args.status, updatedAt: Date.now() });
    await ctx.runMutation(internal.activityLog.logActivity, {
      teamId: task.teamId,
      projectId: task.projectId,
      taskId: args.taskId,
      actionType: "task.status_change",
      details: { title: task.title, fromStatus: originalStatus, toStatus: args.status },
      entityId: args.taskId,
      entityType: "task",
    });
  },
});

export const deleteTask = mutation({
  args: { taskId: v.id("tasks") },
  async handler(ctx, args) {
    const hasAccess = await hasTaskAccess(ctx, args.taskId, true);
    if (!hasAccess) throw new Error("Permission denied.");
    const task = await ctx.db.get(args.taskId);
    if (!task) return;
    await ctx.runMutation(internal.activityLog.logActivity, {
      teamId: task.teamId,
      projectId: task.projectId,
      taskId: args.taskId,
      actionType: "task.delete",
      details: { title: task.title },
      entityId: args.taskId,
      entityType: "task",
    });
    await ctx.db.delete(args.taskId);


  },
});

export const assignTask = mutation({
  args: { taskId: v.id("tasks"), userId: v.optional(v.string()) },
  async handler(ctx, args) {
    const hasAccess = await hasTaskAccess(ctx, args.taskId, true);
    if (!hasAccess) throw new Error("Permission denied.");
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    const originalAssignee = task.assignedTo;
    if (originalAssignee === args.userId) return;
    await ctx.db.patch(args.taskId, { assignedTo: args.userId });
    await ctx.runMutation(internal.activityLog.logActivity, {
      teamId: task.teamId,
      projectId: task.projectId,
      taskId: args.taskId,
      actionType: "task.assign",
      details: { title: task.title, from: originalAssignee || "unassigned", to: args.userId || "unassigned" },
      entityId: args.taskId,
      entityType: "task",
    });

  },
});

export const updateTaskContent = mutation({
  args: { taskId: v.id("tasks"), content: v.string() },
  async handler(ctx, args) {
    const hasAccess = await hasTaskAccess(ctx, args.taskId, true);
    if (!hasAccess) throw new Error("Permission denied.");
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await ctx.db.patch(args.taskId, { content: args.content, updatedAt: Date.now() });
    await ctx.runMutation(internal.activityLog.logActivity, {
      teamId: task.teamId,
      projectId: task.projectId,
      taskId: args.taskId,
      actionType: "task.content.update",
      details: { title: task.title },
      entityId: args.taskId,
      entityType: "task",
    });
  }
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
    const subscriptionCheck = await ctx.runQuery(internal.stripe.checkAIFeatureAccessByProject, {
      projectId: args.projectId
    });

    if (!subscriptionCheck.allowed) {
      throw new Error(subscriptionCheck.message || "🚫 AI features require Pro or Enterprise subscription. Please upgrade your plan to use AI task generation.");
    }

    const teamMembers: any[] = await ctx.runQuery(internal.teams.getTeamMembersForIndexing, { projectId: args.projectId });
    const memberList = teamMembers.map((m: any) => ({
      name: m.name || m.email || 'Unknown User',
      email: m.email,
      id: m.clerkUserId
    }));

    const offsetHours = -args.timezoneOffsetInMinutes / 60;
    const offsetSign = offsetHours >= 0 ? "+" : "-";
    const offsetString = `UTC${offsetSign}${String(Math.floor(Math.abs(offsetHours))).padStart(2, '0')}:${String(Math.abs(args.timezoneOffsetInMinutes) % 60).padStart(2, '0')}`;

    let taskContext = "";
    if (args.taskId) {
      // @ts-ignore
      const task = await ctx.runQuery((api as any).tasks.getTask, { taskId: args.taskId });
      if (task) {
        taskContext = `
The user is editing an existing task. Here is the current state of the task:
- Current Title: ${task.title}
- Current Description: ${task.description || 'N/A'}
- Current Status: ${task.status}
- Current Priority: ${task.priority || 'N/A'}
- Current Assignee: ${task.assignedToName || 'N/A'}
- Current Tags: ${task.tags?.join(', ') || 'N/A'}
- Current Cost: ${task.cost || 'N/A'}

Your goal is to intelligently modify this task based on the user's prompt. For example, if the user says 'add X to the description', you must append 'X' to the current description. If the user asks to add a tag, append it to the existing array of tags. Do not just replace fields unless the user's intent is clearly to replace.
`;
      }
    }

    const systemPrompt: string = `
You are an intelligent assistant for a project management app.
Parse the user's request to extract task properties into a JSON object.
Today's date is ${new Date().toISOString().split('T')[0]}.
The user's local timezone is ${offsetString}. Please interpret all times in the user's prompt (e.g., "at 3 PM", "15:00") as being in this user's local timezone.
${taskContext}
The available properties are:
- title: string
- description: string
- priority: 'low' | 'medium' | 'high' | 'urgent' | null. To remove priority, return null.
- status: 'todo' | 'in_progress' | 'review' | 'done'
- startDate: ISO 8601 date-time string (e.g., YYYY-MM-DDTHH:mm:ss.sssZ). IMPORTANT: After interpreting the time in the user's local timezone, convert it to UTC for the final ISO string. If the user does NOT provide a specific time, the time part of the string MUST be set to midnight UTC (T00:00:00.000Z).
- endDate: ISO 8601 date-time string (e.g., YYYY-MM-DDTHH:mm:ss.sssZ). IMPORTANT: After interpreting the time in the user's local timezone, convert it to UTC for the final ISO string. If the user does NOT provide a specific time, the time part of the string MUST be set to midnight UTC (T00:00:00.000Z).
- cost: number
- assignedTo: string (must be one of the user IDs from the provided list)
- tags: string[] (array of strings)

The title is a short, concise summary. The description contains all other details, notes, and context.
If a single date or deadline is mentioned, set both startDate and endDate to that date. For date ranges like "from Monday to Friday", set startDate to Monday and endDate to Friday.

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
    since: v.number()
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .filter(q => q.or(
        q.gt(q.field("_creationTime"), args.since),
        q.gt(q.field("updatedAt"), args.since)
      ))
      .collect();
  },
});
