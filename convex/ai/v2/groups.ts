import { v } from "convex/values";
import { internalMutation, mutation, query } from "../../_generated/server";
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

export const startExperimentalTurn = mutation({
  args: {
    projectId: v.id("projects"),
    threadId: v.optional(v.string()),
    message: v.string(),
    title: v.optional(v.string()),
    confirmationPolicy: v.optional(confirmationPolicyValidator),
    seedStubEvents: v.optional(v.boolean()),
  },
  returns: v.object({
    threadId: v.string(),
    groupId: v.string(),
    status: groupStatusValidator,
  }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const { project } = await ensureProjectAccess(ctx, args.projectId, identity.subject);

    const thread =
      args.threadId
        ? (await ensureThreadAccess(ctx, args.threadId, identity.subject))?.thread
        : await ensureThreadForProjectUser(ctx, args.projectId, identity.subject, args.title);

    if (!thread) {
      throw new Error("Thread not found");
    }

    if (thread.projectId !== args.projectId) {
      throw new Error("Forbidden");
    }

    const now = Date.now();
    const groupId = createResponseGroupId();
    const confirmationPolicy = args.confirmationPolicy || "group";
    const seedStubEvents = args.seedStubEvents === true;
    let status: "running" | "completed" = "running";
    let summary: string | undefined;

    const baseEvents: Array<{
      sequence: number;
      eventType:
        | "turn.started"
        | "message.user"
        | "reasoning.summary.completed"
        | "message.assistant.completed"
        | "turn.completed";
      role?: "system" | "user" | "assistant";
      text?: string;
      data?: any;
    }> = [
      {
        sequence: 0,
        eventType: "turn.started",
        role: "system",
        data: {
          model: "gpt-5.4",
          provider: "openai.responses",
          confirmationPolicy,
        },
      },
      {
        sequence: 1,
        eventType: "message.user",
        role: "user",
        text: args.message,
      },
    ];

    if (seedStubEvents) {
      const reasoningSummary =
        "Experimental v2 flow stored this turn in the new response group and event log. This is a stub reasoning summary until the real Responses API orchestrator is connected.";
      const assistantSummary =
        "Experimental assistant v2 recorded this turn successfully. Next step: connect the live OpenAI Responses API runtime, tool execution, and confirmation replay.";

      baseEvents.push(
        {
          sequence: 2,
          eventType: "reasoning.summary.completed",
          role: "assistant",
          text: reasoningSummary,
          data: { stub: true },
        },
        {
          sequence: 3,
          eventType: "message.assistant.completed",
          role: "assistant",
          text: assistantSummary,
          data: { stub: true },
        },
        {
          sequence: 4,
          eventType: "turn.completed",
          role: "system",
          data: { stub: true },
        },
      );

      status = "completed";
      summary = assistantSummary;
    }

    await ctx.db.insert("aiResponseGroups", {
      groupId,
      threadId: thread.threadId,
      projectId: project._id,
      teamId: project.teamId,
      userClerkId: identity.subject,
      model: "gpt-5.4",
      provider: "openai.responses",
      status,
      confirmationPolicy,
      summary,
      createdAt: now,
      updatedAt: now,
    });

    for (const event of baseEvents) {
      await ctx.db.insert("aiEvents", {
        groupId,
        threadId: thread.threadId,
        projectId: project._id,
        teamId: project.teamId,
        sequence: event.sequence,
        eventType: event.eventType,
        role: event.role,
        text: event.text,
        data: event.data,
        createdAt: now,
      });
    }

    await ctx.db.patch(thread._id, {
      lastMessageAt: now,
      lastMessagePreview: (summary || args.message).slice(0, 240),
      lastMessageRole: summary ? "assistant" : "user",
      messageCount: (thread.messageCount || 0) + (seedStubEvents ? 2 : 1),
      title: thread.title || args.title || "Assistant Chat",
    });

    if (!seedStubEvents) {
      await ctx.scheduler.runAfter(0, internalAny.ai.v2.runtime.runResponseGroup, {
        groupId,
        message: args.message,
      });
    }

    return {
      threadId: thread.threadId,
      groupId,
      status,
    };
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
