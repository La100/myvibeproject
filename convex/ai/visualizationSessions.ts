import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { internalMutation, mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { r2 } from "../files";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;
const SESSION_TITLE_MAX_LENGTH = 60;

const buildSessionTitle = (input?: string) => {
  const trimmed = input?.trim();
  if (!trimmed) return undefined;

  return trimmed.length > SESSION_TITLE_MAX_LENGTH
    ? `${trimmed.slice(0, SESSION_TITLE_MAX_LENGTH)}...`
    : trimmed;
};

const getSignedVisualizationUrls = async (storageKeys: string[]) => {
  const uniqueKeys = [...new Set(storageKeys)];
  const entries = await Promise.all(
    uniqueKeys.map(async (storageKey) => {
      try {
        const url = await r2.getUrl(storageKey, { expiresIn: SIGNED_URL_TTL_SECONDS });
        return [storageKey, url] as const;
      } catch (error) {
        console.error("Failed to generate URL for image:", error);
        return [storageKey, null] as const;
      }
    })
  );

  return new Map(entries);
};

const getOwnedSessionOrNull = async (
  ctx: QueryCtx | MutationCtx,
  sessionId: Id<"aiVisualizationSessions">,
  userClerkId: string
) => {
  const session = await ctx.db.get(sessionId);
  if (!session || session.userClerkId !== userClerkId) {
    return null;
  }

  return session;
};

const getOwnedSessionOrThrow = async (
  ctx: MutationCtx,
  sessionId: Id<"aiVisualizationSessions">,
  userClerkId: string
) => {
  const session = await getOwnedSessionOrNull(ctx, sessionId, userClerkId);
  if (!session) {
    throw new Error("Unauthorized");
  }

  return session;
};

export const createSession = mutation({
  args: {
    teamId: v.id("teams"),
    projectId: v.optional(v.id("projects")),
    initialPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    return ctx.db.insert("aiVisualizationSessions", {
      teamId: args.teamId,
      projectId: args.projectId,
      userClerkId: identity.subject,
      title: buildSessionTitle(args.initialPrompt),
      lastMessageAt: Date.now(),
      messageCount: 0,
      imageCount: 0,
    });
  },
});

export const listSessions = query({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return ctx.db
      .query("aiVisualizationSessions")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("userClerkId", identity.subject)
      )
      .order("desc")
      .collect();
  },
});

export const getSession = query({
  args: {
    sessionId: v.id("aiVisualizationSessions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return getOwnedSessionOrNull(ctx, args.sessionId, identity.subject);
  },
});

export const getSessionMessages = query({
  args: {
    sessionId: v.id("aiVisualizationSessions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const session = await getOwnedSessionOrNull(ctx, args.sessionId, identity.subject);
    if (!session) return [];

    const messages = await ctx.db
      .query("aiVisualizationMessages")
      .withIndex("by_session_and_index", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();

    const storageKeys = messages.flatMap((message) =>
      [
        ...(message.imageStorageKey ? [message.imageStorageKey] : []),
        ...(message.referenceImages?.map((image) => image.storageKey) ?? []),
      ]
    );
    const signedUrls = await getSignedVisualizationUrls(storageKeys);

    return messages.map((message) => {
      const referenceImages = message.referenceImages?.map((image) => ({
        ...image,
        imageUrl: signedUrls.get(image.storageKey) || undefined,
      }));

      if (!message.imageStorageKey) {
        return referenceImages ? { ...message, referenceImages } : message;
      }

      const imageUrl = signedUrls.get(message.imageStorageKey) || message.imageUrl;
      return {
        ...message,
        ...(referenceImages ? { referenceImages } : {}),
        ...(imageUrl ? { imageUrl } : {}),
      };
    });
  },
});

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

    const session = await getOwnedSessionOrThrow(ctx, args.sessionId, identity.subject);
    const messageIndex = session.messageCount;

    const messageId = await ctx.db.insert("aiVisualizationMessages", {
      sessionId: args.sessionId,
      teamId: session.teamId,
      role: "user",
      text: args.text,
      messageIndex,
      referenceImages: args.referenceImages,
    });

    await ctx.db.patch(args.sessionId, {
      messageCount: messageIndex + 1,
      lastMessageAt: Date.now(),
      ...(session.title ? {} : { title: buildSessionTitle(args.text) }),
    });

    return { messageId, messageIndex };
  },
});

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

export const deleteSession = mutation({
  args: {
    sessionId: v.id("aiVisualizationSessions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    await getOwnedSessionOrThrow(ctx, args.sessionId, identity.subject);

    const messages = await ctx.db
      .query("aiVisualizationMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    await Promise.all(messages.map((message) => ctx.db.delete(message._id)));
    await ctx.db.delete(args.sessionId);

    return { success: true };
  },
});

export const updateSessionTitle = mutation({
  args: {
    sessionId: v.id("aiVisualizationSessions"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    await getOwnedSessionOrThrow(ctx, args.sessionId, identity.subject);
    await ctx.db.patch(args.sessionId, {
      title: args.title,
    });

    return { success: true };
  },
});

export const getSessionHistory = query({
  args: {
    sessionId: v.id("aiVisualizationSessions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const session = await getOwnedSessionOrNull(ctx, args.sessionId, identity.subject);
    if (!session) return [];

    const messages = await ctx.db
      .query("aiVisualizationMessages")
      .withIndex("by_session_and_index", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();

    return messages.map((message) => ({
      role: message.role,
      text: message.text,
      imageStorageKey: message.imageStorageKey,
      imageMimeType: message.imageMimeType,
    }));
  },
});
