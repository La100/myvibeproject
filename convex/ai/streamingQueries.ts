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

import { components } from "../_generated/api";
import { query, mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { createThread, vStreamArgs, listUIMessages, syncStreams } from "@convex-dev/agent";
import type { SyncStreamsReturnValue } from "@convex-dev/agent";

/**
 * Check if a thread ID is a legacy/custom format (not a Convex agent thread ID)
 */
function isLegacyThreadId(threadId: string): boolean {
  return threadId.startsWith("thread-") || threadId.startsWith("thread_");
}

/**
 * Query to list streaming messages with delta support
 * Clients subscribe to this for real-time streaming updates
 * 
 * Uses Convex Agent's listUIMessages + syncStreams for seamless streaming
 */
export const listStreamingMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  returns: v.any(), // Complex return type from agent
  handler: async (ctx, args) => {
    console.log("📡 listStreamingMessages called for:", args.threadId);
    let agentThreadId = args.threadId;
    let mappingFound = false;

    // Handle legacy/custom thread IDs (e.g. "thread-123" or "thread_123")
    // Lookup the corresponding agent thread ID
    if (isLegacyThreadId(args.threadId)) {
      const mapping = await ctx.db
        .query("aiThreads")
        .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
        .first();
      
      if (mapping && mapping.agentThreadId) {
        agentThreadId = mapping.agentThreadId;
        mappingFound = true;
        console.log("🔗 Mapped thread:", args.threadId, "->", agentThreadId);
      } else {
        // If no mapping found yet, return empty
        // This is normal during initial setup - the action will save the mapping
        console.log("⏳ No mapping found yet for:", args.threadId);
        return { 
          page: [], 
          isDone: true, 
          continueCursor: "", 
          streams: { messages: [], deltas: [] },
          // Add metadata for debugging
          _meta: {
            requestedThreadId: args.threadId,
            agentThreadId: null,
            mappingFound: false,
          }
        };
      }
    }

    try {
      // Get paginated messages (non-streaming)
      const paginated = await listUIMessages(ctx, components.agent, {
        threadId: agentThreadId,
        paginationOpts: args.paginationOpts,
      });

      // Get streaming deltas - include all statuses to capture in-progress and finished
      const streams = await syncStreams(ctx, components.agent, {
        threadId: agentThreadId,
        streamArgs: args.streamArgs,
        // Include streaming, finished, and aborted to show all states
        includeStatuses: ["streaming", "finished", "aborted"],
      });

      const deltasCount = streams && 'deltas' in streams ? streams.deltas.length : 0;
      console.log(`📦 Returning ${deltasCount} deltas for ${agentThreadId}`);

      return { 
        ...paginated, 
        streams,
        // Add metadata for debugging
        _meta: {
          requestedThreadId: args.threadId,
          agentThreadId,
          mappingFound: mappingFound || !isLegacyThreadId(args.threadId),
        }
      };
    } catch (error) {
      console.error("❌ listStreamingMessages error:", error);
      // Return empty result on error rather than throwing
      return { 
        page: [], 
        isDone: true, 
        continueCursor: "", 
        streams: { messages: [], deltas: [] },
        _meta: {
          requestedThreadId: args.threadId,
          agentThreadId,
          error: (error as Error).message,
        }
      };
    }
  },
});

/**
 * Query to get streaming deltas for useStreamingUIMessages hook
 * 
 * This query must return syncStreams result DIRECTLY (not wrapped in object)
 * as useStreamingUIMessages expects the raw sync result
 * 
 * See: https://docs.convex.dev/agents/streaming#advanced-streaming-deltas-asynchronously-without-using-an-agent
 */
export const getStreamDeltas = query({
  args: {
    threadId: v.string(),
    streamArgs: v.optional(vStreamArgs), // Optional - hook provides defaults
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    // Handle placeholder threadId (when client has no real thread yet)
    if (args.threadId === "__no_thread__" || !args.threadId) {
      return { kind: "list", messages: [] };
    }

    let agentThreadId = args.threadId;

    // Handle legacy thread IDs
    if (isLegacyThreadId(args.threadId)) {
      const mapping = await ctx.db
        .query("aiThreads")
        .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
        .first();
      
      if (mapping && mapping.agentThreadId) {
        agentThreadId = mapping.agentThreadId;
      } else {
        // No mapping yet - return empty sync result
        // Return format that useStreamingUIMessages expects (empty list mode)
        return { kind: "list", messages: [] };
      }
    }

    try {
      // Return syncStreams result DIRECTLY - this is what useStreamingUIMessages expects
      const result = await syncStreams(ctx, components.agent, {
        threadId: agentThreadId,
        streamArgs: args.streamArgs, // Hook provides defaults
        // Include all statuses to capture in-progress and completed streams
        includeStatuses: ["streaming", "finished", "aborted"],
      });

      return result; // Return raw result, not wrapped!
    } catch (error) {
      console.error("❌ getStreamDeltas error:", error);
      // Return empty list mode on error
      return { kind: "list", messages: [] };
    }
  },
});

/**
 * Query to get thread info including mapping status
 * Useful for debugging streaming issues
 */
export const getThreadInfo = query({
  args: {
    threadId: v.string(),
  },
  returns: v.object({
    exists: v.boolean(),
    agentThreadId: v.optional(v.string()),
    isLegacyId: v.boolean(),
    hasMapping: v.boolean(),
  }),
  handler: async (ctx, args): Promise<{
    exists: boolean;
    agentThreadId: string | undefined;
    isLegacyId: boolean;
    hasMapping: boolean;
  }> => {
    const isLegacy = isLegacyThreadId(args.threadId);
    
    if (!isLegacy) {
      return {
        exists: true,
        agentThreadId: args.threadId,
        isLegacyId: false,
        hasMapping: true, // Not a legacy ID, so no mapping needed
      };
    }

    const mapping = await ctx.db
      .query("aiThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .first();

    return {
      exists: !!mapping,
      agentThreadId: mapping?.agentThreadId ?? undefined,
      isLegacyId: true,
      hasMapping: !!mapping?.agentThreadId,
    };
  },
});

/**
 * Query to list messages for useStreamingUIMessages hook
 * Returns just the paginated messages, no streaming deltas
 */
export const listMessagesForUI = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    let agentThreadId = args.threadId;

    // Handle legacy/custom thread IDs
    if (isLegacyThreadId(args.threadId)) {
      const mapping = await ctx.db
        .query("aiThreads")
        .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
        .first();
      
      if (mapping && mapping.agentThreadId) {
        agentThreadId = mapping.agentThreadId;
      } else {
        // No mapping yet - return empty page
        return { 
          page: [], 
          isDone: true, 
          continueCursor: "", 
        };
      }
    }

    return await listUIMessages(ctx, components.agent, {
      threadId: agentThreadId,
      paginationOpts: args.paginationOpts,
    });
  },
});

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

    let agentThreadId = args.threadId;

    // Handle legacy/custom thread IDs (e.g. "thread-123" or "thread_123")
    if (isLegacyThreadId(args.threadId)) {
      // Check if thread document exists first - this is a reactive query
      const threadDoc = await ctx.db
        .query("aiThreads")
        .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
        .first();

      if (!threadDoc) {
        // Thread doesn't exist yet - this is a brand new chat
        // Return empty but query will re-run when thread is created
        return {
          page: [],
          isDone: true,
          continueCursor: "",
          streams: emptyStreams,
          _waiting: true,
        };
      }

      // Thread exists, check for agent mapping
      if (threadDoc.agentThreadId) {
        agentThreadId = threadDoc.agentThreadId;
      } else {
        // Thread exists but no mapping yet - action is working on it
        // Return empty but query will re-run when mapping is saved
        return {
          page: [],
          isDone: true,
          continueCursor: "",
          streams: emptyStreams,
          _waiting: true,
        };
      }
    }

    // Get paginated messages when pagination opts are provided
    const paginated = args.paginationOpts
      ? await listUIMessages(ctx, components.agent, {
          threadId: agentThreadId,
          paginationOpts: args.paginationOpts,
        })
      : { page: [], isDone: true, continueCursor: "" };

    // Get streaming deltas for real-time updates
    let streams: SyncStreamsReturnValue = emptyStreams;
    if (args.streamArgs) {
      try {
        streams =
          (await syncStreams(ctx, components.agent, {
          threadId: agentThreadId,
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
      hasFiles: !!(args.fileId || args.fileIds),
    });

    // Validate user identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      console.error("❌ [MUTATION] Unauthorized - no identity");
      throw new Error("Unauthorized");
    }
    const userClerkId = identity.subject;

    console.log("👤 [MUTATION] User authenticated:", userClerkId);

    // Validate project access
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      console.error("❌ [MUTATION] Project not found:", args.projectId);
      throw new Error("Project not found");
    }

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

      // For new threads, we directly use the agent thread ID
      // No mapping needed since it's not a legacy thread ID
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

      const existingThread = await ctx.db
        .query("aiThreads")
        .withIndex("by_thread_id", (q) => q.eq("threadId", assuredThreadId))
        .unique();

      if (!existingThread) {
        await ctx.db.insert("aiThreads", {
          threadId: assuredThreadId,
          projectId: args.projectId,
          teamId: project.teamId,
          userClerkId,
          lastMessageAt: Date.now(),
          title: threadTitle,
          messageCount: 1,
          lastMessagePreview: args.prompt,
          lastMessageRole: "user",
        });
      } else {
        if (existingThread.userClerkId !== userClerkId || existingThread.projectId !== args.projectId) {
          throw new Error("Thread does not belong to this project or user");
        }

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
        } = {
          lastMessageAt: Date.now(),
          lastMessagePreview: args.prompt,
          lastMessageRole: "user",
          messageCount: Math.max(0, (existingThread.messageCount ?? 0) + 1),
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

    const resolvedAgentThreadId = thread?.agentThreadId
      ? thread.agentThreadId
      : thread?.threadId && !isLegacyThreadId(thread.threadId)
        ? thread.threadId
        : undefined;

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

    const resolvedAgentThreadId = thread.agentThreadId
      ? thread.agentThreadId
      : !isLegacyThreadId(thread.threadId)
        ? thread.threadId
        : undefined;

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
