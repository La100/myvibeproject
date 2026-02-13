/**
 * Pairing Requests - Approval-based connection flow (like MoltBot)
 */

import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "../_generated/server";
import { ensureProjectAccess } from "../ai/confirmedActions/helpers";
const internalAny = require("../_generated/api").internal as any;

/**
 * Create a pairing request (internal - called from bot)
 */
export const createPairingRequest = internalMutation({
    args: {
        projectId: v.id("projects"),
        platform: v.union(v.literal("telegram"), v.literal("whatsapp")),
        externalUserId: v.string(),
        pairingCode: v.string(),
        metadata: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("messagingPairingRequests", {
            projectId: args.projectId,
            platform: args.platform,
            externalUserId: args.externalUserId,
            pairingCode: args.pairingCode,
            metadata: args.metadata,
            status: "pending",
            createdAt: Date.now(),
        });
    },
});

/**
 * Get pending request for external user (internal)
 */
export const getPendingRequest = internalQuery({
    args: {
        projectId: v.id("projects"),
        platform: v.union(v.literal("telegram"), v.literal("whatsapp")),
        externalUserId: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("messagingPairingRequests")
            .withIndex("by_external_id", (q) =>
                q.eq("platform", args.platform).eq("externalUserId", args.externalUserId)
            )
            .filter((q) => q.eq(q.field("projectId"), args.projectId))
            .filter((q) => q.eq(q.field("status"), "pending"))
            .first();
    },
});

/**
 * List pending pairing requests for a project (for UI)
 */
export const listPendingRequests = query({
    args: {
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];

        return await ctx.db
            .query("messagingPairingRequests")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .filter((q) => q.eq(q.field("status"), "pending"))
            .collect();
    },
});

/**
 * Approve a pairing request
 */
export const approvePairingRequest = mutation({
    args: {
        requestId: v.id("messagingPairingRequests"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const request = await ctx.db.get(args.requestId);
        if (!request) {
            throw new Error("Request not found");
        }

        if (request.status !== "pending") {
            throw new Error("Request already processed");
        }

        // Create the messaging channel
        await ctx.runMutation(internalAny.messaging.channels.getOrCreateChannel, {
            platform: request.platform,
            externalUserId: request.externalUserId,
            projectId: request.projectId,
            userClerkId: identity.subject,
            metadata: request.metadata,
        });

        // Mark request as approved
        await ctx.db.patch(args.requestId, {
            status: "approved",
            resolvedAt: Date.now(),
            resolvedBy: identity.subject,
        });

        // Notify user via bot
        if (request.platform === "telegram") {
            const project = await ctx.db.get(request.projectId);
            await ctx.scheduler.runAfter(0, internalAny.messaging.telegramActions.sendApprovalNotification, {
                chatId: request.externalUserId,
                projectId: request.projectId,
                projectName: project?.name || "Unknown Project",
            });
        }

        return { success: true };
    },
});

/**
 * Approve a pairing request by pairing code (for assistant-driven flow)
 */
export const approvePairingCode = mutation({
    args: {
        projectId: v.id("projects"),
        pairingCode: v.string(),
    },
    handler: async (ctx, args) => {
        const { identity } = await ensureProjectAccess(ctx, args.projectId, true);

        const code = args.pairingCode.trim().toUpperCase();
        if (!code) {
            throw new Error("Pairing code is required");
        }

        const request = await ctx.db
            .query("messagingPairingRequests")
            .withIndex("by_code", (q) => q.eq("pairingCode", code))
            .filter((q) => q.eq(q.field("projectId"), args.projectId))
            .first();

        if (!request) {
            throw new Error("Pairing request not found");
        }

        if (request.status !== "pending") {
            return { success: false, status: request.status };
        }

        // Create the messaging channel
        await ctx.runMutation(internalAny.messaging.channels.getOrCreateChannel, {
            platform: request.platform,
            externalUserId: request.externalUserId,
            projectId: request.projectId,
            userClerkId: identity.subject,
            metadata: request.metadata,
        });

        // Mark request as approved
        await ctx.db.patch(request._id, {
            status: "approved",
            resolvedAt: Date.now(),
            resolvedBy: identity.subject,
        });

        // Notify user via bot
        if (request.platform === "telegram") {
            const project = await ctx.db.get(request.projectId);
            await ctx.scheduler.runAfter(0, internalAny.messaging.telegramActions.sendApprovalNotification, {
                chatId: request.externalUserId,
                projectId: request.projectId,
                projectName: project?.name || "Unknown Project",
            });
        }

        return { success: true };
    },
});

/**
 * Approve a pairing request by pairing code (internal - for server/agent tool execution)
 *
 * This version does not rely on `ctx.auth` (which is not available in internal actions/tools).
 * Instead, it authorizes using the provided actorUserId and team membership.
 */
export const approvePairingCodeInternal = internalMutation({
    args: {
        projectId: v.id("projects"),
        pairingCode: v.string(),
        actorUserId: v.string(),
    },
    handler: async (ctx, args) => {
        const project = await ctx.db.get(args.projectId);
        if (!project) {
            throw new Error("Project not found");
        }

        const membership = await ctx.db
            .query("teamMembers")
            .withIndex("by_team_and_user", (q) =>
                q.eq("teamId", project.teamId).eq("clerkUserId", args.actorUserId)
            )
            .filter((q) => q.eq(q.field("isActive"), true))
            .first();

        if (!membership || (membership.role !== "admin" && membership.role !== "member")) {
            throw new Error("Not authorized");
        }

        const code = args.pairingCode.trim().toUpperCase();
        if (!code) {
            throw new Error("Pairing code is required");
        }

        const request = await ctx.db
            .query("messagingPairingRequests")
            .withIndex("by_code", (q) => q.eq("pairingCode", code))
            .filter((q) => q.eq(q.field("projectId"), args.projectId))
            .first();

        if (!request) {
            throw new Error("Pairing request not found");
        }

        if (request.status !== "pending") {
            return { success: false, status: request.status };
        }

        await ctx.runMutation(internalAny.messaging.channels.getOrCreateChannel, {
            platform: request.platform,
            externalUserId: request.externalUserId,
            projectId: request.projectId,
            userClerkId: args.actorUserId,
            metadata: request.metadata,
        });

        await ctx.db.patch(request._id, {
            status: "approved",
            resolvedAt: Date.now(),
            resolvedBy: args.actorUserId,
        });

        if (request.platform === "telegram") {
            await ctx.scheduler.runAfter(0, internalAny.messaging.telegramActions.sendApprovalNotification, {
                chatId: request.externalUserId,
                projectId: request.projectId,
                projectName: project?.name || "Unknown Project",
            });
        }

        return { success: true };
    },
});

/**
 * Reject a pairing request
 */
export const rejectPairingRequest = mutation({
    args: {
        requestId: v.id("messagingPairingRequests"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const request = await ctx.db.get(args.requestId);
        if (!request) {
            throw new Error("Request not found");
        }

        if (request.status !== "pending") {
            throw new Error("Request already processed");
        }

        // Mark request as rejected
        await ctx.db.patch(args.requestId, {
            status: "rejected",
            resolvedAt: Date.now(),
            resolvedBy: identity.subject,
        });

        return { success: true };
    },
});
