import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "../_generated/server";
import type { MessagingPlatform } from "./types";
import type { Id } from "../_generated/dataModel";

// Get or create a messaging channel for a platform user
export const getOrCreateChannel = internalMutation({
    args: {
        platform: v.union(v.literal("telegram"), v.literal("whatsapp")),
        externalUserId: v.string(),
        projectId: v.id("projects"),
        userClerkId: v.optional(v.string()),
        metadata: v.optional(v.any()),
    },
    returns: v.object({
        channelId: v.id("messagingChannels"),
        threadId: v.string(),
        isNew: v.boolean(),
    }),
    handler: async (ctx, args) => {
        // Check if channel already exists
        const existing = await ctx.db
            .query("messagingChannels")
            .withIndex("by_platform_and_external_id", (q) =>
                q.eq("platform", args.platform).eq("externalUserId", args.externalUserId)
            )
            .filter((q) => q.eq(q.field("projectId"), args.projectId))
            .first();

        if (existing) {
            // Update last message time and metadata if provided
            await ctx.db.patch(existing._id, {
                lastMessageAt: Date.now(),
                ...(args.userClerkId && !existing.userClerkId ? { userClerkId: args.userClerkId } : {}),
                ...(args.metadata ? { metadata: args.metadata } : {}),
            });

            return {
                channelId: existing._id,
                threadId: existing.threadId || `${args.platform}-${args.externalUserId}-${Date.now()}`,
                isNew: false,
            };
        }

        // Get project to get teamId
        const project = await ctx.db.get(args.projectId);
        if (!project) {
            throw new Error("Project not found");
        }

        // Create new thread ID
        const threadId = `${args.platform}-${args.externalUserId}-${Date.now()}`;

        // Create new channel
        const channelId = await ctx.db.insert("messagingChannels", {
            teamId: project.teamId,
            projectId: args.projectId,
            platform: args.platform,
            externalUserId: args.externalUserId,
            userClerkId: args.userClerkId,
            threadId,
            isActive: true,
            lastMessageAt: Date.now(),
            metadata: args.metadata,
        });

        return {
            channelId,
            threadId,
            isNew: true,
        };
    },
});

// Get channel by platform and external user ID
export const getChannelByExternalId = internalQuery({
    args: {
        platform: v.union(v.literal("telegram"), v.literal("whatsapp")),
        externalUserId: v.string(),
    },
    returns: v.union(
        v.null(),
        v.object({
            _id: v.id("messagingChannels"),
            projectId: v.id("projects"),
            teamId: v.id("teams"),
            threadId: v.optional(v.string()),
            metadata: v.optional(v.any()),
        })
    ),
    handler: async (ctx, args) => {
        const channel = await ctx.db
            .query("messagingChannels")
            .withIndex("by_platform_and_external_id", (q) =>
                q.eq("platform", args.platform).eq("externalUserId", args.externalUserId)
            )
            .first();

        if (!channel) return null;

        return {
            _id: channel._id,
            projectId: channel.projectId,
            teamId: channel.teamId,
            threadId: channel.threadId,
            metadata: channel.metadata,
        };
    },
});

// Get channel by platform, external user ID and project
export const getChannelByExternalIdForProject = internalQuery({
    args: {
        platform: v.union(v.literal("telegram"), v.literal("whatsapp")),
        externalUserId: v.string(),
        projectId: v.id("projects"),
    },
    returns: v.union(
        v.null(),
        v.object({
            _id: v.id("messagingChannels"),
            projectId: v.id("projects"),
            teamId: v.id("teams"),
            threadId: v.optional(v.string()),
            metadata: v.optional(v.any()),
        })
    ),
    handler: async (ctx, args) => {
        const channel = await ctx.db
            .query("messagingChannels")
            .withIndex("by_platform_and_external_id", (q) =>
                q.eq("platform", args.platform).eq("externalUserId", args.externalUserId)
            )
            .filter((q) => q.eq(q.field("projectId"), args.projectId))
            .first();

        if (!channel) return null;

        return {
            _id: channel._id,
            projectId: channel.projectId,
            teamId: channel.teamId,
            threadId: channel.threadId,
            metadata: channel.metadata,
        };
    },
});

export const getActiveTelegramChannelForUser = internalQuery({
    args: {
        projectId: v.id("projects"),
        userClerkId: v.string(),
    },
    returns: v.union(
        v.null(),
        v.object({
            _id: v.id("messagingChannels"),
            projectId: v.id("projects"),
            teamId: v.id("teams"),
            externalUserId: v.string(),
            threadId: v.optional(v.string()),
            metadata: v.optional(v.any()),
        })
    ),
    handler: async (ctx, args) => {
        const channel = await ctx.db
            .query("messagingChannels")
            .withIndex("by_user", (q) => q.eq("userClerkId", args.userClerkId))
            .filter((q) => q.eq(q.field("projectId"), args.projectId))
            .filter((q) => q.eq(q.field("platform"), "telegram"))
            .filter((q) => q.eq(q.field("isActive"), true))
            .first();

        if (!channel) return null;

        return {
            _id: channel._id,
            projectId: channel.projectId,
            teamId: channel.teamId,
            externalUserId: channel.externalUserId,
            threadId: channel.threadId,
            metadata: channel.metadata,
        };
    },
});

// Update channel's thread ID
export const updateChannelThreadId = internalMutation({
    args: {
        channelId: v.id("messagingChannels"),
        threadId: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.channelId, {
            threadId: args.threadId,
            lastMessageAt: Date.now(),
        });
    },
});

// Count total Telegram messages tracked for a team (stored in channel metadata)
export const getTeamTelegramMessageUsage = internalQuery({
    args: {
        teamId: v.id("teams"),
    },
    returns: v.object({
        totalMessages: v.number(),
    }),
    handler: async (ctx, args) => {
        const channels = await ctx.db
            .query("messagingChannels")
            .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
            .filter((q) => q.eq(q.field("platform"), "telegram"))
            .collect();

        const totalMessages = channels.reduce((sum, channel) => {
            const count = Number((channel.metadata as { freeTelegramMessagesCount?: number } | undefined)?.freeTelegramMessagesCount || 0);
            return sum + (Number.isFinite(count) ? count : 0);
        }, 0);

        return { totalMessages };
    },
});

// Increment Telegram message usage counter for a single channel
export const incrementTelegramMessageUsage = internalMutation({
    args: {
        channelId: v.id("messagingChannels"),
    },
    returns: v.object({
        newCount: v.number(),
    }),
    handler: async (ctx, args) => {
        const channel = await ctx.db.get(args.channelId);
        if (!channel) {
            throw new Error("Channel not found");
        }

        const metadata = (channel.metadata as Record<string, unknown> | undefined) || {};
        const currentCount = Number(metadata.freeTelegramMessagesCount || 0);
        const nextCount = (Number.isFinite(currentCount) ? currentCount : 0) + 1;

        await ctx.db.patch(args.channelId, {
            metadata: {
                ...metadata,
                freeTelegramMessagesCount: nextCount,
            },
            lastMessageAt: Date.now(),
        });

        return { newCount: nextCount };
    },
});

// List channels for a project (for admin UI)
export const listChannelsForProject = query({
    args: {
        projectId: v.id("projects"),
    },
    returns: v.array(
        v.object({
            _id: v.id("messagingChannels"),
            platform: v.union(v.literal("telegram"), v.literal("whatsapp")),
            externalUserId: v.string(),
            isActive: v.boolean(),
            lastMessageAt: v.optional(v.number()),
            metadata: v.optional(v.any()),
        })
    ),
    handler: async (ctx, args) => {
        const channels = await ctx.db
            .query("messagingChannels")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .collect();

        return channels.map((c) => ({
            _id: c._id,
            platform: c.platform,
            externalUserId: c.externalUserId,
            isActive: c.isActive,
            lastMessageAt: c.lastMessageAt,
            metadata: c.metadata,
        }));
    },
});

// Disconnect a messaging channel (sets isActive to false)
export const disconnectChannel = mutation({
    args: {
        projectId: v.id("projects"),
        platform: v.string(),
        externalUserId: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        // Find the channel
        const channel = await ctx.db
            .query("messagingChannels")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .filter((q) => q.eq(q.field("platform"), args.platform))
            .filter((q) => q.eq(q.field("externalUserId"), args.externalUserId))
            .first();

        if (!channel) {
            throw new Error("Channel not found");
        }

        // Set channel as inactive
        await ctx.db.patch(channel._id, {
            isActive: false,
        });
    },
});
