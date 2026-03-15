import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "../../_generated/server";
import { ensureThreadAccess, requireIdentity } from "../access";

const eventTypeValidator = v.union(
  v.literal("turn.started"),
  v.literal("message.user"),
  v.literal("message.assistant.delta"),
  v.literal("message.assistant.completed"),
  v.literal("reasoning.summary.delta"),
  v.literal("reasoning.summary.completed"),
  v.literal("tool.called"),
  v.literal("tool.output.delta"),
  v.literal("tool.awaiting_confirmation"),
  v.literal("tool.confirmed"),
  v.literal("tool.rejected"),
  v.literal("tool.completed"),
  v.literal("tool.failed"),
  v.literal("turn.awaiting_confirmation"),
  v.literal("turn.completed"),
  v.literal("turn.failed"),
  v.literal("turn.aborted"),
);

const roleValidator = v.optional(
  v.union(
    v.literal("system"),
    v.literal("user"),
    v.literal("assistant"),
    v.literal("tool"),
  ),
);

export const appendGroupEvents = internalMutation({
  args: {
    groupId: v.string(),
    events: v.array(
      v.object({
        eventType: eventTypeValidator,
        role: roleValidator,
        callId: v.optional(v.string()),
        text: v.optional(v.string()),
        data: v.optional(v.any()),
      }),
    ),
  },
  returns: v.object({
    inserted: v.number(),
    nextSequence: v.number(),
  }),
  handler: async (ctx, args) => {
    const group = await ctx.db
      .query("aiResponseGroups")
      .withIndex("by_group_id", (q) => q.eq("groupId", args.groupId))
      .unique();

    if (!group) {
      throw new Error("Response group not found");
    }

    const existing = await ctx.db
      .query("aiEvents")
      .withIndex("by_group_and_sequence", (q) => q.eq("groupId", args.groupId))
      .collect();

    let sequence = existing.length;
    const now = Date.now();

    for (const event of args.events) {
      await ctx.db.insert("aiEvents", {
        groupId: group.groupId,
        threadId: group.threadId,
        projectId: group.projectId,
        teamId: group.teamId,
        sequence,
        eventType: event.eventType,
        role: event.role,
        callId: event.callId,
        text: event.text,
        data: event.data,
        createdAt: now,
      });
      sequence += 1;
    }

    await ctx.db.patch(group._id, {
      updatedAt: now,
    });

    return {
      inserted: args.events.length,
      nextSequence: sequence,
    };
  },
});

export const listGroupEvents = query({
  args: {
    threadId: v.string(),
    groupId: v.string(),
  },
  returns: v.array(
    v.object({
      sequence: v.number(),
      eventType: eventTypeValidator,
      role: roleValidator,
      callId: v.optional(v.string()),
      text: v.optional(v.string()),
      data: v.optional(v.any()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const access = await ensureThreadAccess(ctx, args.threadId, identity.subject);
    if (!access) {
      return [];
    }

    const group = await ctx.db
      .query("aiResponseGroups")
      .withIndex("by_group_id", (q) => q.eq("groupId", args.groupId))
      .unique();

    if (!group || group.threadId !== args.threadId) {
      throw new Error("Forbidden");
    }

    const events = await ctx.db
      .query("aiEvents")
      .withIndex("by_group_and_sequence", (q) => q.eq("groupId", args.groupId))
      .collect();

    return events.map((event) => ({
      sequence: event.sequence,
      eventType: event.eventType,
      role: event.role,
      callId: event.callId,
      text: event.text,
      data: event.data,
      createdAt: event.createdAt,
    }));
  },
});

export const getLatestAssistantMessageForGroup = internalQuery({
  args: {
    groupId: v.string(),
  },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args) => {
    const group = await ctx.db
      .query("aiResponseGroups")
      .withIndex("by_group_id", (q) => q.eq("groupId", args.groupId))
      .unique();

    if (!group) {
      return null;
    }

    const events = await ctx.db
      .query("aiEvents")
      .withIndex("by_group_and_sequence", (q) => q.eq("groupId", args.groupId))
      .collect();

    const latestAssistantEvent = events
      .slice()
      .reverse()
      .find(
        (event) =>
          event.eventType === "message.assistant.completed" &&
          typeof event.text === "string" &&
          event.text.trim().length > 0,
      );

    if (latestAssistantEvent?.text) {
      return latestAssistantEvent.text;
    }

    return group.summary ?? null;
  },
});
