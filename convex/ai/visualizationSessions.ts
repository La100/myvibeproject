import { v } from "convex/values";
import { mutation, query, internalMutation } from "../_generated/server";

// Create a new visualization session
export const createSession = mutation({
  args: {
    teamId: v.id("teams"),
    projectId: v.optional(v.id("projects")),
    initialPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userClerkId = identity.subject;
    const now = Date.now();

    // Generate title from first prompt (truncate to 60 chars)
    const title = args.initialPrompt
      ? args.initialPrompt.slice(0, 60) + (args.initialPrompt.length > 60 ? "..." : "")
      : undefined;

    const sessionId = await ctx.db.insert("aiVisualizationSessions", {
      teamId: args.teamId,
      projectId: args.projectId,
      userClerkId,
      title,
      lastMessageAt: now,
      messageCount: 0,
      imageCount: 0,
    });

    return sessionId;
  },
});

// Get all sessions for a team/user
export const listSessions = query({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const userClerkId = identity.subject;

    const sessions = await ctx.db
      .query("aiVisualizationSessions")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("userClerkId", userClerkId)
      )
      .order("desc")
      .collect();

    return sessions;
  },
});

// Get a single session with its messages
export const getSession = query({
  args: {
    sessionId: v.id("aiVisualizationSessions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    // Verify user owns this session
    if (session.userClerkId !== identity.subject) return null;

    return session;
  },
});

import { r2 } from "../files";

// ... existing imports ...

// Get messages for a session
export const getSessionMessages = query({
  args: {
    sessionId: v.id("aiVisualizationSessions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userClerkId !== identity.subject) return [];

    const messages = await ctx.db
      .query("aiVisualizationMessages")
      .withIndex("by_session_and_index", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();

    // Generate fresh signed URLs for images
    const messagesWithUrls = await Promise.all(
      messages.map(async (msg) => {
        if (msg.imageStorageKey) {
          try {
            const url = await r2.getUrl(msg.imageStorageKey, {
              expiresIn: 60 * 60 * 24, // 24 hours
            });
            if (url) {
              return { ...msg, imageUrl: url };
            }
          } catch (error) {
            console.error("Failed to generate URL for image:", error);
          }
        }
        return msg;
      })
    );

    return messagesWithUrls;
  },
});

// Add a user message to session
export const addUserMessage = mutation({
  args: {
    sessionId: v.id("aiVisualizationSessions"),
    text: v.string(),
    referenceImages: v.optional(
      v.array(
        v.object({
          storageKey: v.string(),
          mimeType: v.string(),
          name: v.string(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userClerkId !== identity.subject) throw new Error("Unauthorized");

    // Get current message count
    const messageIndex = session.messageCount;

    // Add the message
    const messageId = await ctx.db.insert("aiVisualizationMessages", {
      sessionId: args.sessionId,
      teamId: session.teamId,
      role: "user",
      text: args.text,
      messageIndex,
      referenceImages: args.referenceImages,
    });

    // Update session
    await ctx.db.patch(args.sessionId, {
      messageCount: messageIndex + 1,
      lastMessageAt: Date.now(),
      // Set title from first message if not set
      ...(session.title ? {} : { title: args.text.slice(0, 60) + (args.text.length > 60 ? "..." : "") }),
    });

    return { messageId, messageIndex };
  },
});

// Add a model response to session (called after generation)
export const addModelMessage = internalMutation({
  args: {
    sessionId: v.id("aiVisualizationSessions"),
    text: v.string(),
    imageStorageKey: v.optional(v.string()),
    imageMimeType: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    generationId: v.optional(v.id("aiGeneratedImages")),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    const messageIndex = session.messageCount;

    // Add the message
    const messageId = await ctx.db.insert("aiVisualizationMessages", {
      sessionId: args.sessionId,
      teamId: session.teamId,
      role: "model",
      text: args.text,
      messageIndex,
      imageStorageKey: args.imageStorageKey,
      imageMimeType: args.imageMimeType,
      imageUrl: args.imageUrl,
      generationId: args.generationId,
    });

    // Update session with preview
    await ctx.db.patch(args.sessionId, {
      messageCount: messageIndex + 1,
      lastMessageAt: Date.now(),
      imageCount: session.imageCount + (args.imageStorageKey ? 1 : 0),
      ...(args.imageUrl ? { previewImageUrl: args.imageUrl } : {}),
      ...(args.imageStorageKey ? { previewStorageKey: args.imageStorageKey } : {}),
    });

    return { messageId, messageIndex };
  },
});

// Delete a session and all its messages
export const deleteSession = mutation({
  args: {
    sessionId: v.id("aiVisualizationSessions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userClerkId !== identity.subject) throw new Error("Unauthorized");

    // Delete all messages in session
    const messages = await ctx.db
      .query("aiVisualizationMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete the session
    await ctx.db.delete(args.sessionId);

    return { success: true };
  },
});

// Update session title
export const updateSessionTitle = mutation({
  args: {
    sessionId: v.id("aiVisualizationSessions"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userClerkId !== identity.subject) throw new Error("Unauthorized");

    await ctx.db.patch(args.sessionId, {
      title: args.title,
    });

    return { success: true };
  },
});

// Get session history formatted for generation API
export const getSessionHistory = query({
  args: {
    sessionId: v.id("aiVisualizationSessions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userClerkId !== identity.subject) return [];

    const messages = await ctx.db
      .query("aiVisualizationMessages")
      .withIndex("by_session_and_index", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();

    // Format for generation API
    return messages.map((msg) => ({
      role: msg.role,
      text: msg.text,
      imageStorageKey: msg.imageStorageKey,
      imageMimeType: msg.imageMimeType,
    }));
  },
});
