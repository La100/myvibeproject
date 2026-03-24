/**
 * Myvibe project AI Streaming Queries
 * 
 * Queries for real-time streaming subscriptions.
 * Clients subscribe to these queries to receive stream deltas.
 * 
 * Note: This file must NOT have "use node" directive
 * as queries can only run in V8 runtime.
 * 
 * See: https://docs.convex.dev/agents/streaming
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { components } from "../_generated/api";
import { query, mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { createThread, vStreamArgs, listUIMessages, syncStreams } from "@convex-dev/agent";
import type { SyncStreamsReturnValue } from "@convex-dev/agent";
import { ensureProjectAccess, ensureThreadAccess, requireIdentity } from "./access";

/**
 * Query for useUIMessages hook - the main streaming query
 * 
 * This is the query that useUIMessages from @convex-dev/agent/react subscribes to.
 * It returns paginated messages with streaming support.
 * 
 * IMPORTANT: Must include streamArgs to support real-time streaming!
 * 
 * Usage:
 * ```tsx
 * const { results, status, loadMore } = useUIMessages(
 *   api.ai.streamingQueries.listThreadMessages,
 *   { threadId },
 *   { initialNumItems: 10, stream: true }
 * );
 * ```
 */
export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: v.optional(vStreamArgs), // Required for streaming support!
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    // Empty streams object for cases where we can't get real streams
    const emptyStreams: SyncStreamsReturnValue = { kind: "list", messages: [] };

    // Handle placeholder threadId (when client has no real thread yet)
    if (!args.threadId || args.threadId === "__no_thread__") {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
        streams: emptyStreams,
      };
    }

    const identity = await requireIdentity(ctx);
    const authorizedThread = await ensureThreadAccess(ctx, args.threadId, identity.subject);
    if (!authorizedThread) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
        streams: emptyStreams,
      };
    }

    // Get paginated messages when pagination opts are provided
    const paginated = args.paginationOpts
      ? await listUIMessages(ctx, components.agent, {
          threadId: args.threadId,
          paginationOpts: args.paginationOpts,
        })
      : { page: [], isDone: true, continueCursor: "" };

    // Get streaming deltas for real-time updates
    let streams: SyncStreamsReturnValue = emptyStreams;
    if (args.streamArgs) {
      try {
        streams =
          (await syncStreams(ctx, components.agent, {
          threadId: args.threadId,
          streamArgs: args.streamArgs,
          // Include "finished" status for longer to smooth transition to persisted messages
          // This prevents flickering when streaming completes but DB hasn't updated yet
          includeStatuses: ["streaming", "finished", "aborted"],
        })) ?? emptyStreams;
      } catch {
        // Keep emptyStreams on error
      }
    }

    return {
      ...paginated,
      streams,
    };
  },
});

/**
 * Mutation to initiate streaming chat
 * 
 * This mutation:
 * 1. Creates/validates the thread
 * 2. Schedules the streaming action in the background
 * 3. Returns immediately for optimistic UI updates
 * 
 * Usage with optimistic updates:
 * ```tsx
 * const sendMessage = useMutation(
 *   api.ai.streamingQueries.initiateStreaming
 * ).withOptimisticUpdate(
 *   optimisticallySendMessage(api.ai.streamingQueries.listThreadMessages)
 * );
 * ```
 */
export const initiateStreaming = mutation({
  args: {
    threadId: v.optional(v.string()),
    projectId: v.id("projects"),
    prompt: v.string(),
    fileId: v.optional(v.union(v.id("files"), v.string())),
    fileIds: v.optional(v.array(v.union(v.id("files"), v.string()))),
    openaiFiles: v.optional(
      v.array(
        v.object({
          fileId: v.string(),
          fileName: v.string(),
          fileType: v.optional(v.string()),
          fileSize: v.optional(v.number()),
        }),
      ),
    ),
  },
  returns: v.object({
    threadId: v.string(),
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    console.log("🎯 [MUTATION] initiateStreaming called:", {
      hasThreadId: !!args.threadId,
      projectId: args.projectId,
      promptLength: args.prompt.length,
      hasFiles: !!(
        args.fileId ||
        args.fileIds ||
        (args.openaiFiles && args.openaiFiles.length > 0)
      ),
    });

    // Validate user identity + project access
    const identity = await requireIdentity(ctx);
    const userClerkId = identity.subject;

    console.log("👤 [MUTATION] User authenticated:", userClerkId);

    const { project } = await ensureProjectAccess(ctx, args.projectId, userClerkId);

    console.log("📁 [MUTATION] Project found:", {
      projectName: project.name,
      teamId: project.teamId,
    });

    const trimmedPrompt = args.prompt.trim();
    const threadTitle = trimmedPrompt.slice(0, 120) || "New conversation";
    let threadId = args.threadId?.trim();

    if (!threadId) {
      console.log("🆕 [MUTATION] Creating new thread");
      const agentThreadId = await createThread(ctx, components.agent, {
        userId: userClerkId,
        title: threadTitle,
      });

      console.log("💾 [MUTATION] Inserting new thread document:", {
        agentThreadId,
        title: threadTitle,
      });

      // For new threads, use the created agent thread ID directly.
      await ctx.db.insert("aiThreads", {
        threadId: agentThreadId,
        agentThreadId: agentThreadId, // Store agent thread ID in both fields
        projectId: args.projectId,
        teamId: project.teamId,
        userClerkId,
        lastMessageAt: Date.now(),
        title: threadTitle,
        messageCount: 1,
        lastMessagePreview: args.prompt,
        lastMessageRole: "user",
      });

      threadId = agentThreadId;
    } else {
      console.log("🔄 [MUTATION] Using existing thread:", threadId);
      if (!threadId) {
        throw new Error("Missing thread ID");
      }
      const assuredThreadId = threadId;

      const authorizedThread = await ensureThreadAccess(ctx, assuredThreadId, userClerkId);
      const existingThread = authorizedThread?.thread ?? null;

      if (!existingThread) {
        console.log("⚠️ [MUTATION] Unknown thread ID supplied, creating a fresh thread");
        const agentThreadId = await createThread(ctx, components.agent, {
          userId: userClerkId,
          title: threadTitle,
        });

        await ctx.db.insert("aiThreads", {
          threadId: agentThreadId,
          agentThreadId,
          projectId: args.projectId,
          teamId: project.teamId,
          userClerkId,
          lastMessageAt: Date.now(),
          title: threadTitle,
          messageCount: 1,
          lastMessagePreview: args.prompt,
          lastMessageRole: "user",
        });
        threadId = agentThreadId;
      } else {

        const titlePatch =
          (!existingThread.title || existingThread.title.trim().length === 0) && trimmedPrompt.length > 0
            ? threadTitle
            : undefined;

        const threadUpdates: {
          lastMessageAt: number;
          lastMessagePreview: string;
          lastMessageRole: "user";
          messageCount: number;
          title?: string;
          abortedAt?: undefined;
        } = {
          lastMessageAt: Date.now(),
          lastMessagePreview: args.prompt,
          lastMessageRole: "user",
          messageCount: Math.max(0, (existingThread.messageCount ?? 0) + 1),
          abortedAt: undefined,
        };
        if (titlePatch !== undefined) {
          threadUpdates.title = titlePatch;
        }

        await ctx.db.patch(existingThread._id, threadUpdates);
      }
    }

    if (!threadId) {
      console.error("❌ [MUTATION] Missing thread ID after creation/lookup");
      throw new Error("Missing thread ID");
    }

    console.log("📅 [MUTATION] Scheduling streaming action:", {
      threadId,
      promptLength: args.prompt.length,
    });

    // Use string function reference to avoid deep TS instantiation on generated API types.
    const internalDoStreaming = "ai/streaming:internalDoStreaming" as any;

    // Schedule the streaming action to run in the background
    await ctx.scheduler.runAfter(0, internalDoStreaming, {
      message: args.prompt,
      projectId: args.projectId,
      userClerkId,
      threadId,
      fileId: args.fileId,
      fileIds: args.fileIds,
      openaiFiles: args.openaiFiles,
    });

    console.log("✅ [MUTATION] Streaming action scheduled successfully:", threadId);

    return {
      threadId,
      success: true,
    };
  },
});

/**
 * Internal mutation to abort a streaming response
 * Called when user clicks "Stop" button
 * 
 * Note: We cannot actually stop a running Convex action.
 * This mutation marks the thread as "aborted" so the UI can:
 * 1. Stop showing new content
 * 2. Display "Response stopped" indicator
 * The backend action will complete in the background but results are ignored.
 */
export const abortStreamByOrder = internalMutation({
  args: {
    threadId: v.string(),
    order: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    console.log(`🛑 Abort requested for thread ${args.threadId}, order ${args.order}`);

    // Mark the thread as having an abort request
    const thread = await ctx.db
      .query("aiThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();

    const resolvedAgentThreadId = thread?.agentThreadId ?? thread?.threadId;

    if (resolvedAgentThreadId) {
      try {
        await ctx.runMutation(components.agent.streams.abortByOrder, {
          threadId: resolvedAgentThreadId,
          order: args.order,
          reason: "user_stop",
        });
      } catch (error) {
        console.error("❌ Failed to abort stream by order:", {
          threadId: args.threadId,
          agentThreadId: resolvedAgentThreadId,
          order: args.order,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (thread) {
      await ctx.db.patch(thread._id, {
        abortedAt: Date.now(),
      });
    }

    return null;
  },
});

/**
 * Public mutation to abort a streaming response
 * 
 * This aborts active Convex Agent streams for the thread so the UI
 * receives "aborted" status and stops rendering new deltas.
 */
export const abortStream = mutation({
  args: {
    threadId: v.string(),
    order: v.optional(v.number()),
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

    // Validate thread belongs to user
    const thread = await ctx.db
      .query("aiThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!thread || thread.userClerkId !== identity.subject) {
      throw new Error("Thread not found or unauthorized");
    }

    console.log(`🛑 User requested abort for thread ${args.threadId}`);

    const resolvedAgentThreadId = thread.agentThreadId ?? thread.threadId;

    let abortedStreams = 0;

    if (resolvedAgentThreadId) {
      try {
        const activeStreams = await ctx.runQuery(components.agent.streams.list, {
          threadId: resolvedAgentThreadId,
          statuses: ["streaming"],
        });

        const candidateOrders =
          args.order !== undefined
            ? [args.order]
            : activeStreams.map((stream) => stream.order);

        for (const order of candidateOrders) {
          try {
            const didAbort = await ctx.runMutation(components.agent.streams.abortByOrder, {
              threadId: resolvedAgentThreadId,
              order,
              reason: "user_stop",
            });
            if (didAbort) {
              abortedStreams += 1;
            }
          } catch (error) {
            console.error("❌ Failed to abort active stream:", {
              threadId: args.threadId,
              agentThreadId: resolvedAgentThreadId,
              order,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      } catch (error) {
        console.error("❌ Failed to list active streams for abort:", {
          threadId: args.threadId,
          agentThreadId: resolvedAgentThreadId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Keep local metadata for troubleshooting/history.
    await ctx.db.patch(thread._id, {
      abortedAt: Date.now(),
    });

    return {
      success: true,
      message:
        abortedStreams > 0
          ? `Response stopped (${abortedStreams} stream${abortedStreams === 1 ? "" : "s"} aborted).`
          : "Stop requested. No active stream was found to abort.",
    };
  },
});
