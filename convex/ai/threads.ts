import { v } from "convex/values";
import { createThread, listMessages } from "@convex-dev/agent";
import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalQuery, internalMutation, mutation, query } from "../_generated/server";
import { ensureProjectAccess, ensureThreadAccess, requireIdentity } from "./access";
import type { ThreadWorkflowContext } from "./helpers/workflowRuntime";

const workflowContextValidator = v.object({
  workflowId: v.string(),
  stepId: v.string(),
  previousResponses: v.optional(
    v.array(
      v.object({
        stepId: v.string(),
        response: v.string(),
      }),
    ),
  ),
});

function resolveAgentThreadId(thread: { threadId: string; agentThreadId?: string | undefined }) {
  return thread.agentThreadId ?? thread.threadId;
}

export const updateThreadSummary = internalMutation({
  args: {
    threadId: v.string(),
    lastMessageAt: v.optional(v.number()),
    lastMessagePreview: v.optional(v.string()),
    lastMessageRole: v.optional(v.union(v.literal("user"), v.literal("assistant"))),
    messageCountDelta: v.optional(v.number()),
    title: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("aiThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!thread) {
      return null;
    }

    const updates: Record<string, unknown> = {};

    if (args.lastMessageAt !== undefined) {
      updates.lastMessageAt = args.lastMessageAt;
    }

    if (args.lastMessagePreview !== undefined) {
      updates.lastMessagePreview = args.lastMessagePreview;
    }

    if (args.lastMessageRole !== undefined) {
      updates.lastMessageRole = args.lastMessageRole;
    }

    if (args.messageCountDelta !== undefined) {
      const nextCount = (thread.messageCount ?? 0) + args.messageCountDelta;
      updates.messageCount = Math.max(0, nextCount);
    }

    if (args.title !== undefined) {
      updates.title = args.title;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(thread._id, updates);
    }

    return null;
  },
});

// Public helper used by web client: ensure a project thread exists for a user.
export const getProjectThread = mutation({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.string(),
    title: v.optional(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    if (identity.subject !== args.userClerkId) {
      throw new Error("Forbidden");
    }

    const { project } = await ensureProjectAccess(ctx, args.projectId, identity.subject);

    const existingThread = await ctx.db
      .query("aiThreads")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("userClerkId"), args.userClerkId))
      .first();

    if (existingThread) {
      return existingThread.threadId;
    }

    const threadTitle = args.title ?? "Assistant Chat";
    const threadId = await createThread(ctx, components.agent, {
      userId: args.userClerkId,
      title: threadTitle,
    });

    await ctx.db.insert("aiThreads", {
      threadId,
      agentThreadId: threadId,
      projectId: args.projectId,
      teamId: project.teamId,
      userClerkId: args.userClerkId,
      lastMessageAt: Date.now(),
      messageCount: 0,
      title: threadTitle,
    });

    return threadId;
  },
});

export const setThreadWorkflowContext = mutation({
  args: {
    threadId: v.string(),
    projectId: v.id("projects"),
    userClerkId: v.string(),
    workflowContext: workflowContextValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    if (identity.subject !== args.userClerkId) {
      throw new Error("Forbidden");
    }

    const authorizedThread = await ensureThreadAccess(ctx, args.threadId, identity.subject);
    const thread = authorizedThread?.thread;
    if (!thread || thread.projectId !== args.projectId) {
      throw new Error("Thread not found");
    }

    await ctx.db.patch(thread._id, {
      workflowContext: args.workflowContext,
    });

    return null;
  },
});

export const clearThreadWorkflowContext = mutation({
  args: {
    threadId: v.string(),
    projectId: v.id("projects"),
    userClerkId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    if (identity.subject !== args.userClerkId) {
      throw new Error("Forbidden");
    }

    const authorizedThread = await ensureThreadAccess(ctx, args.threadId, identity.subject);
    const thread = authorizedThread?.thread;
    if (!thread || thread.projectId !== args.projectId) {
      throw new Error("Thread not found");
    }

    await ctx.db.patch(thread._id, {
      workflowContext: undefined,
    });

    return null;
  },
});

// Internal helper for bot/webhook flows: ensure a project thread exists for a user.
export const getProjectThreadInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.string(),
    title: v.optional(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const existingThread = await ctx.db
      .query("aiThreads")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("userClerkId"), args.userClerkId))
      .first();

    if (existingThread) {
      return existingThread.threadId;
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const threadTitle = args.title ?? "Assistant Chat";
    const threadId = await createThread(ctx, components.agent, {
      userId: args.userClerkId,
      title: threadTitle,
    });

    await ctx.db.insert("aiThreads", {
      threadId,
      agentThreadId: threadId,
      projectId: args.projectId,
      teamId: project.teamId,
      userClerkId: args.userClerkId,
      lastMessageAt: Date.now(),
      messageCount: 0,
      title: threadTitle,
    });

    return threadId;
  },
});

// Internal helper: resolve the latest assistant message text for external delivery.
export const getLatestAssistantMessageText = internalQuery({
  args: {
    threadId: v.string(),
  },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args) => {
    const latestMessages = await listMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: { cursor: null, numItems: 5 },
      excludeToolMessages: true,
    });

    const latestAssistant = latestMessages.page.find(
      (msg) => msg.message?.role === "assistant"
    );

    return latestAssistant?.text ?? null;
  },
});

export const listThreadsForUser = query({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.string(),
  },
  returns: v.array(
    v.object({
      threadId: v.string(),
      title: v.string(),
      lastMessageAt: v.number(),
      lastMessagePreview: v.optional(v.string()),
      lastMessageRole: v.optional(v.union(v.literal("user"), v.literal("assistant"))),
      messageCount: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }
    if (identity.subject !== args.userClerkId) {
      throw new Error("Forbidden");
    }

    const threads = await ctx.db
      .query("aiThreads")
      .withIndex("by_user", (q) => q.eq("userClerkId", args.userClerkId))
      .collect();

    const filtered = threads.filter((thread) => thread.projectId === args.projectId);

    const summaries = await Promise.all(
      filtered.map(async (thread) => {
        let preview = thread.lastMessagePreview;
        let previewRole = thread.lastMessageRole;
        let messageCount = thread.messageCount;

        if (preview === undefined || previewRole === undefined || messageCount === undefined) {
          const agentThreadId = resolveAgentThreadId(thread);
          if (agentThreadId) {
            const latestMessages = await listMessages(ctx, components.agent, {
              threadId: agentThreadId,
              paginationOpts: { cursor: null, numItems: 1 },
              excludeToolMessages: true,
            });
            const latest = latestMessages.page[0];
            if (latest) {
              preview = latest.text ?? "";
              const role = latest.message?.role;
              if (role === "user" || role === "assistant") {
                previewRole = role;
              }
              messageCount = latest.order + 1;
            }
          }
        }

        return {
          threadId: thread.threadId,
          title: thread.title && thread.title.trim().length > 0 ? thread.title : "Untitled chat",
          lastMessageAt: thread.lastMessageAt || thread._creationTime,
          lastMessagePreview: preview,
          lastMessageRole: previewRole,
          messageCount: messageCount ?? 0,
        };
      })
    );

    summaries.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

    return summaries;
  },
});


// Public mutation to clear a user's thread (messages + pending function calls)
export const clearThreadForUser = mutation({
  args: {
    threadId: v.string(),
    projectId: v.id("projects"),
    userClerkId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }
    if (identity.subject !== args.userClerkId) {
      throw new Error("Forbidden");
    }

    const thread = await ctx.db
      .query("aiThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!thread) {
      return { success: true, message: "Thread already cleared" };
    }

    if (thread.projectId !== args.projectId || thread.userClerkId !== args.userClerkId) {
      throw new Error("Thread does not belong to this project or user");
    }

    const agentThreadId = resolveAgentThreadId(thread);
    if (agentThreadId) {
      await ctx.scheduler.runAfter(0, components.agent.threads.deleteAllForThreadIdAsync, {
        threadId: agentThreadId,
      });
    }

    await ctx.db.delete(thread._id);

    return { success: true, message: "Thread deleted" };
  },
});

// Remove all previous threads for a user (optionally keep the active one)
export const clearPreviousThreadsForUser = mutation({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.string(),
    keepThreadId: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    removedThreads: v.number(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }
    if (identity.subject !== args.userClerkId) {
      throw new Error("Forbidden");
    }

    const threads = await ctx.db
      .query("aiThreads")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const threadsToRemove = threads.filter(
      (thread) =>
        thread.userClerkId === args.userClerkId &&
        thread.threadId !== args.keepThreadId
    );

    for (const thread of threadsToRemove) {
      const agentThreadId = resolveAgentThreadId(thread);
      if (agentThreadId) {
        await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
          threadId: agentThreadId,
        });
      }

      await ctx.db.delete(thread._id);
    }

    return { success: true, removedThreads: threadsToRemove.length };
  },
});


// Save function calls for later replay (Rodrigo's approach)
export const saveFunctionCalls = internalMutation({
  args: {
    threadId: v.string(),
    projectId: v.id("projects"),
    responseId: v.string(),
    functionCalls: v.array(v.object({
      callId: v.string(),
      functionName: v.string(),
      arguments: v.string(),
    })),
  },
  returns: v.null(),
  handler: async (_ctx, _args) => {
    return null;
  },
});

// Refine an existing pending call in-place instead of rejecting/recreating it.
export const replacePendingFunctionCall = internalMutation({
  args: {
    threadId: v.string(),
    responseId: v.string(),
    callId: v.string(),
    functionName: v.string(),
    arguments: v.string(),
  },
  returns: v.null(),
  handler: async (_ctx, _args) => {
    return null;
  },
});

export const supersedePendingFunctionCalls = internalMutation({
  args: {
    threadId: v.string(),
    excludedCallIds: v.optional(v.array(v.string())),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    supersededCount: v.number(),
  }),
  handler: async (_ctx, _args) => {
    return { supersededCount: 0 };
  },
});

// Get pending function calls to replay in next message
export const getPendingFunctionCalls = internalQuery({
  args: {
    threadId: v.string(),
  },
  returns: v.array(v.object({
    _id: v.string(),
    callId: v.string(),
    functionName: v.string(),
    arguments: v.string(),
    result: v.optional(v.string()),
    status: v.optional(v.string()),
  })),
  handler: async (_ctx, _args) => {
    return [];
  },
});

export const listPendingItemsInternal = internalQuery({
  args: {
    threadId: v.string(),
    userClerkId: v.string(),
  },
  returns: v.array(v.object({
    _id: v.string(),
    callId: v.string(),
    functionName: v.string(),
    arguments: v.string(),
    responseId: v.string(),
    status: v.optional(v.string()),
    result: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const authorizedThread = await ensureThreadAccess(ctx, args.threadId, args.userClerkId);
    if (!authorizedThread) {
      return [];
    }
    return [];
  },
});

export const getThreadRuntimeState = internalQuery({
  args: {
    threadId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      abortedAt: v.optional(v.number()),
      workflowContext: v.optional(workflowContextValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("aiThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!thread) {
      return null;
    }

    return {
      abortedAt: thread.abortedAt,
      workflowContext: thread.workflowContext as ThreadWorkflowContext | undefined,
    };
  },
});

// Get pending items for UI confirmation
export const listPendingItems = query({
  args: {
    threadId: v.string(),
  },
  returns: v.array(v.object({
    _id: v.string(),
    callId: v.string(),
    functionName: v.string(),
    arguments: v.string(),
    responseId: v.string(),
    status: v.optional(v.string()),
    result: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const authorizedThread = await ensureThreadAccess(ctx, args.threadId, identity.subject);
    if (!authorizedThread) {
      return [];
    }
    return [];
  },
});

// Mark function calls as replayed
export const markFunctionCallsAsReplayed = internalMutation({
  args: {
    callIds: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (_ctx, _args) => {
    return null;
  },
});

// Mark function calls as confirmed (called from frontend after user confirmation or rejection)
export const markFunctionCallsAsConfirmed = mutation({
  args: {
    threadId: v.string(),
    responseId: v.string(),
    results: v.array(v.object({
      callId: v.string(),
      result: v.optional(v.string()),
      status: v.optional(v.union(v.literal("confirmed"), v.literal("rejected"))),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const authorizedThread = await ensureThreadAccess(ctx, args.threadId, identity.subject);
    if (!authorizedThread) {
      return null;
    }
    return null;
  },
});

// Clear ALL threads for a user in a project (for settings page)
export const clearAllThreadsForUser = mutation({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    removedThreads: v.number(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }
    if (identity.subject !== args.userClerkId) {
      throw new Error("Forbidden");
    }

    const threads = await ctx.db
      .query("aiThreads")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const threadsToRemove = threads.filter(
      (thread) => thread.userClerkId === args.userClerkId
    );

    for (const thread of threadsToRemove) {
      const agentThreadId = resolveAgentThreadId(thread);
      if (agentThreadId) {
        await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
          threadId: agentThreadId,
        });
      }

      await ctx.db.delete(thread._id);
    }

    return { success: true, removedThreads: threadsToRemove.length };
  },
});

// Internal helper for bot flows: clear an entire thread without user auth context.
export const clearThreadInternal = internalMutation({
  args: {
    threadId: v.string(),
    projectId: v.id("projects"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("aiThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!thread) {
      return { success: true };
    }

    if (thread.projectId !== args.projectId) {
      throw new Error("Thread does not belong to this project");
    }

    const agentThreadId = resolveAgentThreadId(thread);
    if (agentThreadId) {
      await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
        threadId: agentThreadId,
      });
    }

    await ctx.db.delete(thread._id);
    return { success: true };
  },
});
