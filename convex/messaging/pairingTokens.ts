/**
 * Pairing Tokens - Generate and validate tokens for auto-connect flow
 */

import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import crypto from "crypto";

const TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Generate a unique pairing token for connecting messaging platform
 */
export const generatePairingToken = mutation({
    args: {
        projectId: v.id("projects"),
        platform: v.union(v.literal("telegram"), v.literal("whatsapp")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const userClerkId = identity.subject;

        // Get project to verify access and get teamId
        const project = await ctx.db.get(args.projectId);
        if (!project) {
            throw new Error("Project not found");
        }

        // Generate random token
        const token = generateRandomToken();

        // Delete any existing unused tokens for this user/project/platform
        const existing = await ctx.db
            .query("messagingPairingTokens")
            .withIndex("by_project_and_platform", (q) =>
                q.eq("projectId", args.projectId).eq("platform", args.platform)
            )
            .filter((q) => q.eq(q.field("userClerkId"), userClerkId))
            .filter((q) => q.eq(q.field("usedAt"), undefined))
            .collect();

        for (const token of existing) {
            await ctx.db.delete(token._id);
        }

        // Create new token
        await ctx.db.insert("messagingPairingTokens", {
            token,
            projectId: args.projectId,
            teamId: project.teamId,
            userClerkId,
            platform: args.platform,
            expiresAt: Date.now() + TOKEN_EXPIRY_MS,
        });

        return { token };
    },
});

/**
 * Get active pairing token for a project (for UI display)
 */
export const getActivePairingToken = query({
    args: {
        projectId: v.id("projects"),
        platform: v.union(v.literal("telegram"), v.literal("whatsapp")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;

        const token = await ctx.db
            .query("messagingPairingTokens")
            .withIndex("by_project_and_platform", (q) =>
                q.eq("projectId", args.projectId).eq("platform", args.platform)
            )
            .filter((q) => q.eq(q.field("userClerkId"), identity.subject))
            .filter((q) => q.eq(q.field("usedAt"), undefined))
            .filter((q) => q.gt(q.field("expiresAt"), Date.now()))
            .first();

        if (!token) return null;

        return {
            token: token.token,
            expiresAt: token.expiresAt,
        };
    },
});

/**
 * Validate pairing token (internal use from webhook)
 */
export const validatePairingToken = internalQuery({
    args: {
        token: v.string(),
        platform: v.union(v.literal("telegram"), v.literal("whatsapp")),
    },
    handler: async (ctx, args) => {
        const tokenDoc = await ctx.db
            .query("messagingPairingTokens")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .first();

        if (!tokenDoc) {
            return { valid: false, reason: "Token not found" };
        }

        if (tokenDoc.platform !== args.platform) {
            return { valid: false, reason: "Wrong platform" };
        }

        if (tokenDoc.usedAt) {
            return { valid: false, reason: "Token already used" };
        }

        if (tokenDoc.expiresAt < Date.now()) {
            return { valid: false, reason: "Token expired" };
        }

        return {
            valid: true,
            projectId: tokenDoc.projectId,
            teamId: tokenDoc.teamId,
            userClerkId: tokenDoc.userClerkId,
            tokenId: tokenDoc._id,
        };
    },
});

/**
 * Mark token as used (internal use from webhook)
 */
export const markTokenUsed = internalMutation({
    args: {
        tokenId: v.id("messagingPairingTokens"),
        externalUserId: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.tokenId, {
            usedAt: Date.now(),
            usedByExternalId: args.externalUserId,
        });
    },
});

/**
 * Get connected channels for a project
 */
export const getConnectedChannels = query({
    args: {
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];

        const channels = await ctx.db
            .query("messagingChannels")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .filter((q) => q.eq(q.field("isActive"), true))
            .collect();

        return channels.map((ch) => ({
            platform: ch.platform,
            externalUserId: ch.externalUserId,
            lastMessageAt: ch.lastMessageAt,
            metadata: ch.metadata,
        }));
    },
});

/**
 * Get messaging configuration (bot usernames) for a project
 */
export const getMessagingConfig = query({
    args: {
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;

        // Get project to access bot configuration
        const project = await ctx.db.get(args.projectId);
        if (!project) return null;

        return {
            telegramBotUsername: project.telegramBotUsername || null,
            whatsappNumber: project.whatsappNumber || null,
        };
    },
});

// Helper function to generate random token
function generateRandomToken(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No ambiguous chars (0/O, 1/I/L)
    let token = "";
    for (let i = 0; i < 8; i++) {
        token += chars[Math.floor(Math.random() * chars.length)];
    }
    return token;
}
