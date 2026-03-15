import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "../../_generated/server";
import { ensureProjectAccess, ensureThreadAccess, requireIdentity } from "../access";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const internalAny = require("../../_generated/api").internal as any;

const groupStatusValidator = v.union(
  v.literal("running"),
  v.literal("awaiting_confirmation"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("aborted"),
);

const confirmationPolicyValidator = v.union(
  v.literal("none"),
  v.literal("group"),
  v.literal("item"),
);

const uploadedFileValidator = v.object({
  fileId: v.string(),
  fileName: v.string(),
  fileType: v.optional(v.string()),
  fileSize: v.optional(v.number()),
});

function createResponseGroupId() {
  return `grp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function ensureThreadForProjectUser(
  ctx: any,
  projectId: any,
  userClerkId: string,
  title?: string,
) {
  const existingThread = await ctx.db
    .query("aiThreads")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .filter((q: any) => q.eq(q.field("userClerkId"), userClerkId))
    .first();

  if (existingThread) {
    return existingThread;
  }

  const threadId = `v2_thread_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  const now = Date.now();
  const threadTitle = title?.trim() || "Assistant Chat";
  const insertedId = await ctx.db.insert("aiThreads", {
    threadId,
    agentThreadId: threadId,
    projectId,
    teamId: project.teamId,
    userClerkId,
    lastMessageAt: now,
    messageCount: 0,
    title: threadTitle,
  });

  const insertedThread = await ctx.db.get(insertedId);
  if (!insertedThread) {
    throw new Error("Failed to create thread");
  }

  return insertedThread;
}

async function createTurnRecord(
  ctx: any,
  args: {
    message: string;
    project: { _id: any; teamId: any };
    thread: { _id: any; threadId: string; projectId: any; messageCount?: number; title?: string };
    title?: string;
    confirmationPolicy?: "none" | "group" | "item";
    userClerkId: string;
  },
) {
  if (args.thread.projectId !== args.project._id) {
    throw new Error("Forbidden");
  }

  const now = Date.now();
  const groupId = createResponseGroupId();
  const confirmationPolicy = args.confirmationPolicy || "group";

  await ctx.db.insert("aiResponseGroups", {
    groupId,
    threadId: args.thread.threadId,
    projectId: args.project._id,
    teamId: args.project.teamId,
    userClerkId: args.userClerkId,
    model: "gpt-5.4",
    provider: "openai.responses",
    status: "running",
    confirmationPolicy,
    createdAt: now,
    updatedAt: now,
  });

  const baseEvents = [
    {
      sequence: 0,
      eventType: "turn.started" as const,
      role: "system" as const,
      data: {
        model: "gpt-5.4",
        provider: "openai.responses",
        confirmationPolicy,
      },
    },
    {
      sequence: 1,
      eventType: "message.user" as const,
      role: "user" as const,
      text: args.message,
    },
  ];

  for (const event of baseEvents) {
    await ctx.db.insert("aiEvents", {
      groupId,
      threadId: args.thread.threadId,
      projectId: args.project._id,
      teamId: args.project.teamId,
      sequence: event.sequence,
      eventType: event.eventType,
      role: event.role,
      text: event.text,
      data: event.data,
      createdAt: now,
    });
  }

  await ctx.db.patch(args.thread._id, {
    lastMessageAt: now,
    lastMessagePreview: args.message.slice(0, 240),
    lastMessageRole: "user",
    messageCount: (args.thread.messageCount || 0) + 1,
    title: args.thread.title || args.title || "Assistant Chat",
  });

  return {
    threadId: args.thread.threadId,
    groupId,
    status: "running" as const,
  };
}

export const startTurn = mutation({
  args: {
    projectId: v.id("projects"),
    threadId: v.optional(v.string()),
    message: v.string(),
    title: v.optional(v.string()),
    confirmationPolicy: v.optional(confirmationPolicyValidator),
    fileId: v.optional(v.union(v.id("files"), v.string())),
    fileIds: v.optional(v.array(v.union(v.id("files"), v.string()))),
    openaiFiles: v.optional(v.array(uploadedFileValidator)),
  },
  returns: v.object({
    threadId: v.string(),
    groupId: v.string(),
    status: groupStatusValidator,
  }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const { project } = await ensureProjectAccess(ctx, args.projectId, identity.subject);

    let thread =
      args.threadId
        ? (await ensureThreadAccess(ctx, args.threadId, identity.subject))?.thread
        : undefined;

    if (!thread) {
      thread = await ensureThreadForProjectUser(
        ctx,
        args.projectId,
        identity.subject,
        args.title,
      );
    }

    if (!thread) {
      throw new Error("Thread not found");
    }

    const result = await createTurnRecord(ctx, {
      message: args.message,
      project,
      thread,
      title: args.title,
      confirmationPolicy: args.confirmationPolicy,
      userClerkId: identity.subject,
    });

    await ctx.scheduler.runAfter(0, internalAny.ai.v2.runtime.runResponseGroup, {
      groupId: result.groupId,
      message: args.message,
      fileId: args.fileId,
      fileIds: args.fileIds,
      openaiFiles: args.openaiFiles,
    });

    return result;
  },
});

export const startTurnInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    threadId: v.optional(v.string()),
    userClerkId: v.string(),
    message: v.string(),
    title: v.optional(v.string()),
    confirmationPolicy: v.optional(confirmationPolicyValidator),
  },
  returns: v.object({
    threadId: v.string(),
    groupId: v.string(),
    status: groupStatusValidator,
  }),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const explicitThreadId = args.threadId;
    let thread = explicitThreadId
      ? await ctx.db
          .query("aiThreads")
          .withIndex("by_thread_id", (q) => q.eq("threadId", explicitThreadId))
          .unique()
      : undefined;

    if (!thread) {
      thread = await ensureThreadForProjectUser(
        ctx,
        args.projectId,
        args.userClerkId,
        args.title,
      );
    }

    if (!thread) {
      throw new Error("Thread not found");
    }

    return createTurnRecord(ctx, {
      message: args.message,
      project,
      thread,
      title: args.title,
      confirmationPolicy: args.confirmationPolicy,
      userClerkId: args.userClerkId,
    });
  },
});

export const updateGroupStatus = internalMutation({
  args: {
    groupId: v.string(),
    status: groupStatusValidator,
    summary: v.optional(v.string()),
  },
  returns: v.object({
    updated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const group = await ctx.db
      .query("aiResponseGroups")
      .withIndex("by_group_id", (q) => q.eq("groupId", args.groupId))
      .unique();

    if (!group) {
      throw new Error("Response group not found");
    }

    await ctx.db.patch(group._id, {
      status: args.status,
      summary: args.summary,
      updatedAt: Date.now(),
    });

    return { updated: true };
  },
});

export const requestGroupAbort = mutation({
  args: {
    threadId: v.string(),
    groupId: v.string(),
  },
  returns: v.object({
    requested: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const access = await ensureThreadAccess(ctx, args.threadId, identity.subject);
    if (!access) {
      throw new Error("Forbidden");
    }

    const group = await ctx.db
      .query("aiResponseGroups")
      .withIndex("by_group_id", (q) => q.eq("groupId", args.groupId))
      .unique();

    if (!group || group.threadId !== args.threadId) {
      throw new Error("Forbidden");
    }

    if (group.status !== "running") {
      return { requested: false };
    }

    await ctx.db.patch(group._id, {
      abortRequestedAt: group.abortRequestedAt || Date.now(),
      updatedAt: Date.now(),
    });

    return { requested: true };
  },
});

export const getGroupAbortState = internalQuery({
  args: {
    groupId: v.string(),
  },
  returns: v.object({
    abortRequested: v.boolean(),
    status: groupStatusValidator,
  }),
  handler: async (ctx, args) => {
    const group = await ctx.db
      .query("aiResponseGroups")
      .withIndex("by_group_id", (q) => q.eq("groupId", args.groupId))
      .unique();

    if (!group) {
      throw new Error("Response group not found");
    }

    return {
      abortRequested: Boolean(group.abortRequestedAt),
      status: group.status,
    };
  },
});

export const listThreadResponseGroups = query({
  args: {
    threadId: v.string(),
  },
  returns: v.array(
    v.object({
      groupId: v.string(),
      status: groupStatusValidator,
      confirmationPolicy: confirmationPolicyValidator,
      model: v.string(),
      provider: v.string(),
      summary: v.optional(v.string()),
      abortRequestedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const access = await ensureThreadAccess(ctx, args.threadId, identity.subject);
    if (!access) {
      return [];
    }

    const groups = await ctx.db
      .query("aiResponseGroups")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    return groups
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((group) => ({
        groupId: group.groupId,
        status: group.status,
        confirmationPolicy: group.confirmationPolicy,
        model: group.model,
        provider: group.provider,
        summary: group.summary,
        abortRequestedAt: group.abortRequestedAt,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      }));
  },
});

export const getResponseGroup = query({
  args: {
    threadId: v.string(),
    groupId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      groupId: v.string(),
      status: groupStatusValidator,
      confirmationPolicy: confirmationPolicyValidator,
      model: v.string(),
      provider: v.string(),
      summary: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const access = await ensureThreadAccess(ctx, args.threadId, identity.subject);
    if (!access) {
      return null;
    }

    const group = await ctx.db
      .query("aiResponseGroups")
      .withIndex("by_group_id", (q) => q.eq("groupId", args.groupId))
      .unique();

    if (!group || group.threadId !== args.threadId) {
      return null;
    }

    return {
      groupId: group.groupId,
      status: group.status,
      confirmationPolicy: group.confirmationPolicy,
      model: group.model,
      provider: group.provider,
      summary: group.summary,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  },
});
