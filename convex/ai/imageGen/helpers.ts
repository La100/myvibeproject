import { v } from "convex/values";
import { internalMutation, internalQuery } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { r2 } from "../../files";
import { ensureProjectAccess, ensureTeamAccess } from "../../authz";

/**
 * Internal helper functions for image generation
 * These run in the V8 runtime (not Node.js)
 */

const DEFAULT_MOODBOARD_SECTION_KEY = "1";
const DEFAULT_MOODBOARD_SECTION_LABEL = "CONCEPT";

const normalizeMoodboardSectionTitle = (title: string) =>
  title.trim().toUpperCase();

const formatMoodboardSectionLabel = (section: string) => {
  const normalized = section.trim();
  if (normalized === "1") return "CONCEPT";
  if (normalized === "2") return "DETAILS";
  return normalized.toUpperCase();
};

const fallbackMoodboardSection = (section?: string) => {
  const normalized = section?.trim();
  if (!normalized) {
    return {
      key: DEFAULT_MOODBOARD_SECTION_KEY,
      label: DEFAULT_MOODBOARD_SECTION_LABEL,
    };
  }

  const lower = normalized.toLowerCase();
  if (["1", "concept", "concepts", "inspiration"].includes(lower)) {
    return {
      key: DEFAULT_MOODBOARD_SECTION_KEY,
      label: DEFAULT_MOODBOARD_SECTION_LABEL,
    };
  }

  if (["2", "detail", "details", "materials", "finishes"].includes(lower)) {
    return {
      key: "2",
      label: "DETAILS",
    };
  }

  return {
    key: normalized,
    label: formatMoodboardSectionLabel(normalized),
  };
};

const resolveAuthorizedGenerationContext = async (
  ctx: any,
  args: {
    projectId?: Id<"projects">;
    teamId?: Id<"teams">;
  },
) => {
  if (args.projectId) {
    const { project } = await ensureProjectAccess(ctx, args.projectId);
    const team = await ctx.db.get(project.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    return {
      teamId: project.teamId,
      teamSlug: team.slug,
      projectSlug: project.slug,
      projectId: project._id,
    };
  }

  if (args.teamId) {
    const { team } = await ensureTeamAccess(ctx, args.teamId);
    return {
      teamId: team._id,
      teamSlug: team.slug,
      projectSlug: undefined,
      projectId: undefined,
    };
  }

  throw new Error("Either projectId or teamId must be provided.");
};

export const getAuthorizedContextInfo = internalQuery({
  args: {
    projectId: v.optional(v.id("projects")),
    teamId: v.optional(v.id("teams")),
  },
  returns: v.object({
    teamId: v.id("teams"),
    teamSlug: v.string(),
    projectSlug: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
  }),
  handler: async (ctx, args) => {
    return await resolveAuthorizedGenerationContext(ctx, args);
  },
});

/**
 * Resolve assistant-provided moodboard section text to an existing section id.
 */
export const resolveMoodboardSectionForGeneratedImage = internalQuery({
  args: {
    projectId: v.id("projects"),
    section: v.optional(v.string()),
  },
  returns: v.object({
    key: v.string(),
    label: v.string(),
  }),
  handler: async (ctx, args) => {
    const fallback = fallbackMoodboardSection(args.section);
    const requested = args.section?.trim();
    if (!requested) return fallback;

    const normalizedRequested = normalizeMoodboardSectionTitle(requested);
    const project = await ctx.db.get(args.projectId);
    const storedSections = Array.isArray(project?.moodboardSections)
      ? project.moodboardSections.filter(
          (section): section is { id: string; title: string; order: number } =>
            !!section &&
            typeof section === "object" &&
            typeof (section as { id?: unknown }).id === "string" &&
            typeof (section as { title?: unknown }).title === "string" &&
            typeof (section as { order?: unknown }).order === "number",
        )
      : [];

    const matchingStoredSection = storedSections.find(
      (section) =>
        normalizeMoodboardSectionTitle(section.id) === normalizedRequested ||
        normalizeMoodboardSectionTitle(section.title) === normalizedRequested,
    );
    if (matchingStoredSection) {
      return {
        key: matchingStoredSection.id.trim(),
        label: formatMoodboardSectionLabel(matchingStoredSection.title),
      };
    }

    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.neq(q.field("moodboardSection"), undefined))
      .collect();

    const matchingFileSection = files
      .map((file) => file.moodboardSection?.trim())
      .find(
        (sectionId): sectionId is string =>
          !!sectionId &&
          normalizeMoodboardSectionTitle(sectionId) === normalizedRequested,
      );

    if (matchingFileSection) {
      return {
        key: matchingFileSection,
        label: formatMoodboardSectionLabel(matchingFileSection),
      };
    }

    return fallback;
  },
});

/**
 * Get context info (project/team) for file storage path
 */
export const getContextInfo = internalQuery({
  args: {
    projectId: v.optional(v.id("projects")),
    teamId: v.optional(v.id("teams")),
  },
  returns: v.union(
    v.object({
      teamId: v.id("teams"),
      teamSlug: v.string(),
      projectSlug: v.optional(v.string()),
      projectId: v.optional(v.id("projects")),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (!project) return null;

      const team = await ctx.db.get(project.teamId);
      if (!team) return null;

      return {
        teamId: project.teamId,
        teamSlug: team.slug,
        projectSlug: project.slug,
        projectId: project._id,
      };
    }

    if (args.teamId) {
      const team = await ctx.db.get(args.teamId);
      if (!team) return null;

      return {
        teamId: team._id,
        teamSlug: team.slug,
        projectSlug: undefined,
        projectId: undefined,
      };
    }

    return null;
  },
});

/**
 * Generate R2 upload URL for storing generated image
 */
export const generateR2UploadUrl = internalMutation({
  args: {
    key: v.string(),
  },
  returns: v.object({
    url: v.string(),
  }),
  handler: async (_ctx, args) => {
    const uploadData = await r2.generateUploadUrl(args.key);
    return { url: uploadData.url };
  },
});

/**
 * Create file record in database with "Generated" folder
 */
export const createFileRecord = internalMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    teamId: v.id("teams"),
    fileName: v.string(),
    fileKey: v.string(),
    mimeType: v.string(),
    size: v.number(),
    description: v.optional(v.string()),
    aiPrompt: v.optional(v.string()),
  },
  returns: v.id("files"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const uploadedBy = identity?.subject || "system";

    let folderId: Id<"folders"> | undefined = undefined;

    // Only try to find/create folder if we are in a project
    if (args.projectId) {
      // Find or create "Generated" folder
      const generatedFolder = await ctx.db
        .query("folders")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId!))
        .filter((q) => q.eq(q.field("name"), "Generated"))
        .first();

      if (!generatedFolder) {
        const newFolderId = await ctx.db.insert("folders", {
          name: "Generated",
          teamId: args.teamId,
          projectId: args.projectId,
          createdBy: uploadedBy,
        });
        folderId = newFolderId;
      } else {
        folderId = generatedFolder._id;
      }
    }

    const fileType = args.mimeType.startsWith("video/") ? "video" : "image";

    return await ctx.db.insert("files", {
      name: args.fileName,
      description: args.description,
      teamId: args.teamId,
      projectId: args.projectId,
      folderId: folderId,
      fileType: fileType,
      storageId: args.fileKey,
      size: args.size,
      mimeType: args.mimeType,
      uploadedBy,
      version: 1,
      isLatest: true,
      origin: "general", // Keep as general so files appear in the list
      aiPrompt: args.aiPrompt, // Store the prompt for display
      showInClientPortal: false,
    });
  },
});

/**
 * Get project info for file storage path (project-specific lookup)
 * Used by functions that always require a projectId
 */
export const getProjectInfo = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.union(
    v.object({
      teamId: v.id("teams"),
      teamSlug: v.string(),
      projectSlug: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    const team = await ctx.db.get(project.teamId);
    if (!team) return null;

    return {
      teamId: project.teamId,
      teamSlug: team.slug,
      projectSlug: project.slug,
    };
  },
});

/**
 * Get signed URL for file
 */
export const getFileUrl = internalQuery({
  args: {
    fileKey: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (_ctx, args) => {
    try {
      const url = await r2.getUrl(args.fileKey, {
        expiresIn: 60 * 60 * 24, // 24 hours
      });
      return url;
    } catch {
      return null;
    }
  },
});

const normalizePromptForGallery = (prompt: string): string => {
  const trimmed = prompt.trim();
  if (!trimmed) return trimmed;

  const conversationMarker = "Previous conversation:";
  const nowMarker = "Now:";
  const conversationIndex = trimmed.indexOf(conversationMarker);
  if (conversationIndex === -1) {
    return trimmed;
  }

  const nowIndex = trimmed.indexOf(nowMarker, conversationIndex);
  if (nowIndex !== -1) {
    return trimmed.slice(nowIndex + nowMarker.length).trim();
  }

  return trimmed.replace(conversationMarker, "").trim();
};

/**
 * Log image generation to aiGeneratedImages table
 */
export const logImageGeneration = internalMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    teamId: v.id("teams"),
    userClerkId: v.string(),
    sessionId: v.optional(v.id("aiVisualizationSessions")),
    prompt: v.string(),
    model: v.string(),
    storageKey: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
    mimeType: v.string(),
    sizeBytes: v.optional(v.number()),
    durationMs: v.number(),
    promptTokens: v.optional(v.number()),
    responseTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    billableTokens: v.optional(v.number()),
    estimatedCostCents: v.optional(v.number()),
    referenceImageCount: v.optional(v.number()),
    textResponse: v.optional(v.string()),
    error: v.optional(v.string()),
    success: v.boolean(),
  },
  returns: v.id("aiGeneratedImages"),
  handler: async (ctx, args) => {
    const promptForGallery = normalizePromptForGallery(args.prompt);
    const generationId = await ctx.db.insert("aiGeneratedImages", {
      projectId: args.projectId,
      teamId: args.teamId,
      userClerkId: args.userClerkId,
      sessionId: args.sessionId,
      prompt: promptForGallery,
      model: args.model,
      storageKey: args.storageKey,
      fileUrl: args.fileUrl,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
      durationMs: args.durationMs,
      promptTokens: args.promptTokens,
      responseTokens: args.responseTokens,
      totalTokens: args.totalTokens,
      billableTokens: args.billableTokens,
      estimatedCostCents: args.estimatedCostCents,
      savedToFiles: false,
      referenceImageCount: args.referenceImageCount,
      textResponse: args.textResponse,
      error: args.error,
      success: args.success,
    });

    return generationId;
  },
});

/**
 * Get generated images gallery for a project or team
 */
export const getGeneratedImagesGallery = internalQuery({
  args: {
    projectId: v.optional(v.id("projects")),
    teamId: v.optional(v.id("teams")),
  },
  returns: v.array(
    v.object({
      _id: v.id("aiGeneratedImages"),
      _creationTime: v.number(),
      storageKey: v.optional(v.string()),
      fileUrl: v.optional(v.string()),
      prompt: v.string(),
      mimeType: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    let query;
    
    if (args.projectId) {
      query = ctx.db
        .query("aiGeneratedImages")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId!));
    } else if (args.teamId) {
      query = ctx.db
        .query("aiGeneratedImages")
        .withIndex("by_team", (q) => q.eq("teamId", args.teamId!));
    } else {
      return [];
    }

    const images = await query
      .filter((q) => q.eq(q.field("success"), true))
      .order("desc")
      .collect();

    return images.map((img) => ({
      _id: img._id,
      _creationTime: img._creationTime,
      storageKey: img.storageKey,
      fileUrl: img.fileUrl,
      prompt: normalizePromptForGallery(img.prompt),
      mimeType: img.mimeType,
    }));
  },
});

/**
 * Delete generated image
 */
export const deleteGeneratedImage = internalMutation({
  args: {
    generationId: v.id("aiGeneratedImages"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const image = await ctx.db.get(args.generationId);
    if (!image) return null;

    if (image.projectId) {
      await ensureProjectAccess(ctx, image.projectId);
    } else {
      await ensureTeamAccess(ctx, image.teamId);
    }

    // Delete from R2 if we have a storage key
    if (image.storageKey) {
      try {
        await ctx.runMutation(
          // Convex component handles are not typed in this runtime path.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { kind: "function", functionHandle: "components/r2/lib:deleteObject" } as any,
          {
            accessKeyId: process.env.R2_ACCESS_KEY_ID!,
            bucket: process.env.R2_BUCKET!,
            endpoint: process.env.R2_ENDPOINT!,
            key: image.storageKey,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
          }
        );
      } catch (error) {
        console.error("Failed to delete from R2:", error);
      }
    }

    // Delete from database
    await ctx.db.delete(args.generationId);
    return null;
  },
});
