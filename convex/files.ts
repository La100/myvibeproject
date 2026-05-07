import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { getEffectiveLimits } from "./stripe";
import { Doc, Id } from "./_generated/dataModel";
import { aiDebugLog } from "./ai/helpers/debugLog";
import { canAccessProjectWithMembership } from "./authz";
import { resolveActorFromExtensionSessionToken } from "./extensionSessions";

export const r2 = new R2(components.r2);
const checkStorageLimitQueryRef = makeFunctionReference<"query">(
  "files:checkStorageLimit",
);
const FILE_KNOWLEDGE_INDEX_ACTION =
  "fileKnowledgeActions:indexProjectFileKnowledge";
const FILE_KNOWLEDGE_REMOVE_ACTION =
  "fileKnowledgeActions:removeProjectFileKnowledgeEntry";

const isPdfFile = (file: { name?: string; mimeType?: string }) =>
  file.mimeType === "application/pdf" ||
  file.name?.toLowerCase().endsWith(".pdf") === true;

const resolveStoredFileUrl = async (
  storageId: string,
  options?: { expiresIn?: number },
) => {
  if (storageId.startsWith("/") || /^https?:\/\//i.test(storageId)) {
    return storageId;
  }

  return await r2.getUrl(storageId, options);
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const DEFAULT_MOODBOARD_SECTIONS = [
  { id: "1", title: "CONCEPT", order: 0 },
  { id: "2", title: "DETAILS", order: 1 },
];

const normalizeMoodboardSectionTitle = (title: string) =>
  title.trim().toUpperCase();

const formatMoodboardSectionLabel = (section: string) => {
  const normalized = section.trim();
  if (normalized === "1") return "CONCEPT";
  if (normalized === "2") return "DETAILS";
  return normalized.toUpperCase();
};

const sortMoodboardSections = <T extends { order: number; title: string }>(
  sections: T[],
) =>
  [...sections].sort(
    (a, b) => a.order - b.order || a.title.localeCompare(b.title),
  );

const sortMoodboardFiles = <
  T extends { moodboardOrder?: number; _creationTime: number; name?: string },
>(
  files: T[],
) =>
  [...files].sort(
    (a, b) =>
      (a.moodboardOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.moodboardOrder ?? Number.MAX_SAFE_INTEGER) ||
      a._creationTime - b._creationTime ||
      (a.name ?? "").localeCompare(b.name ?? ""),
  );

const getNextMoodboardFileOrder = async (
  ctx: any,
  projectId: Id<"projects">,
  sectionId: string,
) => {
  const files = await ctx.db
    .query("files")
    .withIndex("by_moodboard_section", (q: any) =>
      q.eq("projectId", projectId).eq("moodboardSection", sectionId),
    )
    .collect();

  if (files.length === 0) return 0;
  return (
    Math.max(
      ...files.map(
        (file: { moodboardOrder?: number; _creationTime: number }) =>
          file.moodboardOrder ?? file._creationTime,
      ),
    ) + 1
  );
};

const resolveMoodboardSections = (
  storedSections: { id: string; title: string; order: number }[] | undefined,
  fileSectionIds: string[],
) => {
  const baseSections =
    storedSections !== undefined
      ? storedSections
      : DEFAULT_MOODBOARD_SECTIONS.map((section) => ({ ...section }));

  const mergedSections = sortMoodboardSections(baseSections);
  const existingIds = new Set(mergedSections.map((section) => section.id));
  let nextOrder =
    mergedSections.length > 0
      ? Math.max(...mergedSections.map((section) => section.order)) + 1
      : 0;

  for (const sectionId of fileSectionIds) {
    if (existingIds.has(sectionId)) continue;
    mergedSections.push({
      id: sectionId,
      title: formatMoodboardSectionLabel(sectionId),
      order: nextOrder,
    });
    existingIds.add(sectionId);
    nextOrder += 1;
  }

  return sortMoodboardSections(mergedSections).map((section, index) => ({
    ...section,
    order: index,
  }));
};

const getProjectAccess = async (
  ctx: any,
  projectId: Id<"projects">,
  clerkUserId: string,
) => {
  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  const teamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q: any) =>
      q.eq("teamId", project.teamId).eq("clerkUserId", clerkUserId),
    )
    .unique();

  if (!teamMember || !teamMember.isActive) {
    throw new Error("No access to this project");
  }

  if (!canAccessProjectWithMembership(teamMember, projectId)) {
    throw new Error("No access to this project");
  }

  return { project, teamMember };
};

const requireCurrentProjectAccess = async (
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const access = await getProjectAccess(ctx, projectId, identity.subject);
  return { identity, membership: access.teamMember, project: access.project };
};

const scheduleKnowledgeIndex = async (
  ctx: MutationCtx,
  fileId: Id<"files">,
) => {
  const scheduler = ctx.scheduler as {
    runAfter: (
      delayMs: number,
      functionReference: string,
      args: { fileId: Id<"files"> },
    ) => Promise<unknown>;
  };

  await scheduler.runAfter(0, FILE_KNOWLEDGE_INDEX_ACTION, { fileId });
};

const scheduleKnowledgeRemoval = async (
  ctx: MutationCtx,
  entryId: string | undefined,
) => {
  if (!entryId) return;

  const scheduler = ctx.scheduler as {
    runAfter: (
      delayMs: number,
      functionReference: string,
      args: { entryId: string },
    ) => Promise<unknown>;
  };

  await scheduler.runAfter(0, FILE_KNOWLEDGE_REMOVE_ACTION, { entryId });
};

const listMoodboardFileSectionIds = async (
  ctx: any,
  projectId: Id<"projects">,
): Promise<string[]> => {
  const files = await ctx.db
    .query("files")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .filter((q: any) => q.neq(q.field("moodboardSection"), undefined))
    .collect();

  return [
    ...new Set(
      files
        .map((file: { moodboardSection?: string }) =>
          file.moodboardSection?.trim(),
        )
        .filter((section: string | undefined): section is string =>
          Boolean(section),
        ),
    ),
  ] as string[];
};

const patchProjectMoodboardSections = async (
  ctx: any,
  projectId: Id<"projects">,
  sections: { id: string; title: string; order: number }[],
) => {
  await ctx.db.patch(projectId, {
    moodboardSections: sortMoodboardSections(sections).map(
      (section, index) => ({
        id: section.id,
        title: section.title,
        order: index,
      }),
    ),
  } as any);
};

const getStoredMoodboardSections = (
  project: unknown,
): { id: string; title: string; order: number }[] | undefined => {
  const sections = (project as { moodboardSections?: unknown })
    ?.moodboardSections;
  if (!Array.isArray(sections)) {
    return undefined;
  }

  return sections
    .map((section) => {
      if (!section || typeof section !== "object") {
        return null;
      }

      const record = section as {
        id?: unknown;
        title?: unknown;
        order?: unknown;
      };
      if (
        typeof record.id !== "string" ||
        typeof record.title !== "string" ||
        typeof record.order !== "number"
      ) {
        return null;
      }

      return {
        id: record.id,
        title: record.title,
        order: record.order,
      };
    })
    .filter(
      (section): section is { id: string; title: string; order: number } =>
        Boolean(section),
    );
};

const deleteStoredFile = async (ctx: any, storageId: string) => {
  try {
    await ctx.runMutation(components.r2.lib.deleteObject, {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      bucket: process.env.R2_BUCKET!,
      endpoint: process.env.R2_ENDPOINT!,
      key: storageId,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    });
  } catch (error) {
    console.error(`Failed to delete file from R2: ${error}`);
  }
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const buildPublicR2FileUrl = (key: string) => {
  const publicBaseUrl = (
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
    process.env.R2_PUBLIC_URL ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");
  if (!publicBaseUrl) {
    return "";
  }
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${publicBaseUrl}/${encodedKey}`;
};

const getPortalSurveyContext = async (
  ctx: QueryCtx | MutationCtx,
  args: {
    accessToken: string;
    surveyId: Id<"surveys">;
    questionId: Id<"surveyQuestions">;
  },
) => {
  const token = args.accessToken.trim();
  if (!token) {
    throw new Error("Invalid portal link");
  }

  const project = await ctx.db
    .query("projects")
    .withIndex("by_client_panel_access_token", (q) =>
      q.eq("clientPanelAccessToken", token),
    )
    .unique();

  if (!project) {
    throw new Error("Invalid portal link");
  }
  if (project.clientPanelPublishedSettings?.showSurveys !== true) {
    throw new Error("Surveys are hidden in this portal");
  }

  const survey = await ctx.db.get(args.surveyId);
  if (!survey || survey.projectId !== project._id) {
    throw new Error("Survey not found");
  }
  if (survey.status === "closed") {
    throw new Error("Survey is not available");
  }
  const now = Date.now();
  if (typeof survey.startDate === "number" && survey.startDate > now) {
    throw new Error("Survey is not available");
  }
  if (typeof survey.endDate === "number" && survey.endDate < now) {
    throw new Error("Survey is not available");
  }

  const question = await ctx.db.get(args.questionId);
  if (
    !question ||
    question.surveyId !== survey._id ||
    question.questionType !== "file"
  ) {
    throw new Error("File upload question not found");
  }

  const team = (await ctx.db.get(project.teamId)) as Doc<"teams"> | null;
  if (!team) {
    throw new Error("Team not found");
  }

  return { project, question, survey, team };
};

// Get team storage usage in bytes
export const getTeamStorageUsage = query({
  args: { teamId: v.id("teams") },
  returns: v.object({
    usedBytes: v.number(),
    usedGB: v.number(),
    limitGB: v.number(),
    percentUsed: v.number(),
    canUpload: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .unique();

    if (!membership) {
      throw new Error("Not authorized to view team storage usage");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Get all projects for this team
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    // Sum up all file sizes across projects
    let totalBytes = 0;
    for (const project of projects) {
      const files = await ctx.db
        .query("files")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .filter((q) => q.eq(q.field("isLatest"), true))
        .collect();

      totalBytes += files.reduce((sum, file) => sum + (file.size || 0), 0);
    }

    const limits = getEffectiveLimits(team);
    const limitGB = limits.maxStorageGB;
    const limitBytes = limitGB * 1024 * 1024 * 1024;

    const usedGB = totalBytes / (1024 * 1024 * 1024);
    const percentUsed = limitBytes > 0 ? (totalBytes / limitBytes) * 100 : 0;

    return {
      usedBytes: totalBytes,
      usedGB: Math.round(usedGB * 100) / 100,
      limitGB,
      percentUsed: Math.round(percentUsed * 10) / 10,
      canUpload: totalBytes < limitBytes,
    };
  },
});

// Internal query to check storage limit
export const checkStorageLimit = internalQuery({
  args: {
    teamId: v.id("teams"),
    additionalBytes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      return { allowed: false, message: "Team not found" };
    }

    // Get all projects for this team
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    // Sum up all file sizes
    let totalBytes = 0;
    for (const project of projects) {
      const files = await ctx.db
        .query("files")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .filter((q) => q.eq(q.field("isLatest"), true))
        .collect();

      totalBytes += files.reduce((sum, file) => sum + (file.size || 0), 0);
    }

    const limits = getEffectiveLimits(team);
    const limitBytes = limits.maxStorageGB * 1024 * 1024 * 1024;

    const newTotal = totalBytes + (args.additionalBytes || 0);

    if (newTotal >= limitBytes) {
      return {
        allowed: false,
        message: `Storage limit reached (${limits.maxStorageGB} GB). Please upgrade your plan.`,
        usedBytes: totalBytes,
        limitBytes,
      };
    }

    return {
      allowed: true,
      message: "OK",
      usedBytes: totalBytes,
      limitBytes,
    };
  },
});

// R2 client configuration with validation for architectural projects
export const { generateUploadUrl, syncMetadata } = r2.clientApi({
  checkUpload: async (ctx, bucket) => {
    // Check whether the user is signed in
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("You must be logged in to upload files");
    }

    // Additional permission checks can be added here
    aiDebugLog(`User ${identity.subject} is uploading to bucket ${bucket}`);
  },

  onUpload: async (_ctx, key) => {
    // Logic executed after upload - we can create a database record
    aiDebugLog(`File uploaded with key: ${key}`);
  },
});

// Generate upload URL with custom folder structure: org/project/file
export const generateUploadUrlWithCustomKey = mutation({
  args: {
    projectId: v.id("projects"),
    taskId: v.optional(v.id("tasks")),
    fileName: v.string(),
    origin: v.optional(v.union(v.literal("ai"), v.literal("general"))),
    fileSize: v.number(), // Size in bytes for storage limit check
  },
  returns: v.object({
    url: v.string(),
    key: v.string(),
    publicUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.fileSize) || args.fileSize < 0) {
      throw new Error("Invalid file size");
    }

    const { project } = await requireCurrentProjectAccess(ctx, args.projectId);
    const team = (await ctx.db.get(project.teamId)) as Doc<"teams"> | null;
    if (!team) throw new Error("Team not found");

    if (args.taskId) {
      const task = await ctx.db.get(args.taskId);
      if (!task || task.projectId !== args.projectId) {
        throw new Error("Invalid task");
      }
    }

    // Check storage limit locally to avoid cross-function type instantiation depth issues.
    const teamProjects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", project.teamId))
      .collect();

    let totalBytes = 0;
    for (const teamProject of teamProjects) {
      const files = await ctx.db
        .query("files")
        .withIndex("by_project", (q) => q.eq("projectId", teamProject._id))
        .filter((q) => q.eq(q.field("isLatest"), true))
        .collect();
      totalBytes += files.reduce((sum, file) => sum + (file.size || 0), 0);
    }

    const limits = getEffectiveLimits(team);
    const limitBytes = limits.maxStorageGB * 1024 * 1024 * 1024;
    const newTotal = totalBytes + args.fileSize;

    if (newTotal >= limitBytes) {
      throw new Error(
        `Storage limit reached (${limits.maxStorageGB} GB). Please upgrade your plan.`,
      );
    }

    const contextFolder =
      args.origin === "ai" ? "ai" : args.taskId ? "tasks" : "files";
    const path = `${team.slug}/${project.slug}/${contextFolder}`;

    // Generate folder structure: team/project/context/uuid-filename
    const fileExtension = args.fileName.includes(".")
      ? args.fileName.split(".").pop()
      : "";
    const baseName = args.fileName.replace(/\.[^/.]+$/, ""); // Remove extension
    const uuid = crypto.randomUUID();
    const customKey = `${path}/${uuid}-${baseName}${fileExtension ? "." + fileExtension : ""}`;

    const uploadData = await r2.generateUploadUrl(customKey);

    return {
      url: uploadData.url,
      key: customKey,
      publicUrl: buildPublicR2FileUrl(customKey),
    };
  },
});

export const generateUploadUrlWithCustomKeyForExtensionSession = mutation({
  args: {
    extensionToken: v.string(),
    projectId: v.id("projects"),
    fileName: v.string(),
    origin: v.optional(v.union(v.literal("ai"), v.literal("general"))),
    fileSize: v.number(),
  },
  returns: v.object({
    url: v.string(),
    key: v.string(),
    publicUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.fileSize) || args.fileSize < 0) {
      throw new Error("Invalid file size");
    }

    const user = await resolveActorFromExtensionSessionToken(
      ctx,
      args.extensionToken,
    );
    const access = await getProjectAccessForUser(
      ctx,
      args.projectId,
      user.clerkUserId,
    );
    if (!access) {
      throw new Error("Permission denied.");
    }

    const { project } = access;
    const team = (await ctx.db.get(project.teamId)) as Doc<"teams"> | null;
    if (!team) throw new Error("Team not found");

    const teamProjects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", project.teamId))
      .collect();

    let totalBytes = 0;
    for (const teamProject of teamProjects) {
      const files = await ctx.db
        .query("files")
        .withIndex("by_project", (q) => q.eq("projectId", teamProject._id))
        .filter((q) => q.eq(q.field("isLatest"), true))
        .collect();
      totalBytes += files.reduce((sum, file) => sum + (file.size || 0), 0);
    }

    const limits = getEffectiveLimits(team);
    const limitBytes = limits.maxStorageGB * 1024 * 1024 * 1024;
    const newTotal = totalBytes + args.fileSize;

    if (newTotal >= limitBytes) {
      throw new Error(
        `Storage limit reached (${limits.maxStorageGB} GB). Please upgrade your plan.`,
      );
    }

    const path = `${team.slug}/${project.slug}/files`;
    const fileExtension = args.fileName.includes(".")
      ? args.fileName.split(".").pop()
      : "";
    const baseName = args.fileName.replace(/\.[^/.]+$/, "");
    const uuid = crypto.randomUUID();
    const customKey = `${path}/${uuid}-${baseName}${fileExtension ? "." + fileExtension : ""}`;
    const uploadData = await r2.generateUploadUrl(customKey);

    return {
      url: uploadData.url,
      key: customKey,
      publicUrl: buildPublicR2FileUrl(customKey),
    };
  },
});

export const generatePublicSurveyUploadUrl = mutation({
  args: {
    accessToken: v.string(),
    surveyId: v.id("surveys"),
    questionId: v.id("surveyQuestions"),
    respondentKey: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
  },
  returns: v.object({
    url: v.string(),
    key: v.string(),
    publicUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    if (!args.respondentKey.trim()) {
      throw new Error("Invalid survey respondent");
    }
    if (!Number.isFinite(args.fileSize) || args.fileSize < 0) {
      throw new Error("Invalid file size");
    }
    const maxPublicUploadBytes = 25 * 1024 * 1024;
    if (args.fileSize > maxPublicUploadBytes) {
      throw new Error("File is too large. Maximum upload size is 25 MB.");
    }

    const { project, team } = await getPortalSurveyContext(ctx, args);
    const storageCheck = (await ctx.runQuery(checkStorageLimitQueryRef, {
      teamId: project.teamId,
      additionalBytes: args.fileSize,
    })) as { allowed: boolean; message: string };
    if (!storageCheck.allowed) {
      throw new Error(storageCheck.message);
    }

    const fileExtension = args.fileName.includes(".")
      ? args.fileName.split(".").pop()
      : "";
    const baseName = args.fileName.replace(/\.[^/.]+$/, "");
    const uuid = crypto.randomUUID();
    const respondentSegment = args.respondentKey
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 64);
    const customKey = `${team.slug}/${project.slug}/survey-uploads/${args.surveyId}/${args.questionId}/${respondentSegment}/${uuid}-${baseName}${fileExtension ? "." + fileExtension : ""}`;

    const uploadData = await r2.generateUploadUrl(customKey);

    return {
      url: uploadData.url,
      key: customKey,
      publicUrl: buildPublicR2FileUrl(customKey),
    };
  },
});

export const addPublicSurveyFile = mutation({
  args: {
    accessToken: v.string(),
    surveyId: v.id("surveys"),
    questionId: v.id("surveyQuestions"),
    respondentKey: v.string(),
    fileKey: v.string(),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
  },
  returns: v.object({
    fileId: v.id("files"),
    fileName: v.string(),
    fileSize: v.number(),
    fileType: v.string(),
    fileUrl: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    if (!args.respondentKey.trim()) {
      throw new Error("Invalid survey respondent");
    }
    if (!Number.isFinite(args.fileSize) || args.fileSize < 0) {
      throw new Error("Invalid file size");
    }

    const { project, survey } = await getPortalSurveyContext(ctx, args);
    if (
      !args.fileKey.includes(
        `/survey-uploads/${args.surveyId}/${args.questionId}/`,
      )
    ) {
      throw new Error("Invalid uploaded file");
    }

    const fileId = await ctx.db.insert("files", {
      name: args.fileName,
      teamId: project.teamId,
      projectId: project._id,
      fileType: resolveFileType(args.fileType),
      storageId: args.fileKey,
      size: args.fileSize,
      mimeType: args.fileType,
      uploadedBy: `client-portal:${project._id}`,
      version: 1,
      isLatest: true,
      origin: "general",
      aiKnowledgeEnabled: false,
      aiKnowledgeStatus: "excluded",
      aiKnowledgeEntryId: undefined,
      aiKnowledgeIndexedAt: undefined,
      showInClientPortal: false,
    });

    await ctx.db.insert("activityLog", {
      teamId: project.teamId,
      projectId: project._id,
      userId: `client-portal:${project._id}`,
      actionType: "survey.file.upload",
      entityId: fileId,
      entityType: "file",
      details: {
        surveyTitle: survey.title,
        fileName: args.fileName,
      },
    });

    let fileUrl: string | undefined;
    try {
      fileUrl = await r2.getUrl(args.fileKey, {
        expiresIn: 60 * 60 * 24,
      });
    } catch (error) {
      console.error(`Error generating survey upload URL ${fileId}:`, error);
    }

    return {
      fileId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      fileType: args.fileType,
      fileUrl,
    };
  },
});

const resolveFileType = (mimeType: string) => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf" || mimeType.includes("document"))
    return "document";
  if (mimeType.includes("dwg") || mimeType.includes("dxf")) return "drawing";
  return "other";
};
const getProjectAccessForUser = async (
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
  actorUserId: string,
) => {
  const project = (await ctx.db.get(projectId)) as Doc<"projects"> | null;
  if (!project) {
    return null;
  }

  const membership = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("teamId", project.teamId).eq("clerkUserId", actorUserId),
    )
    .filter((q) => q.eq(q.field("isActive"), true))
    .first();

  if (
    !membership ||
    (membership.role !== "admin" && membership.role !== "member")
  ) {
    return null;
  }

  if (!canAccessProjectWithMembership(membership, projectId)) {
    return null;
  }

  return { project, membership };
};

// Internal upload URL generator for server-side project file ingestion.
export const generateUploadUrlWithCustomKeyInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    actorUserId: v.string(),
    fileName: v.string(),
    origin: v.optional(v.union(v.literal("ai"), v.literal("general"))),
    fileSize: v.optional(v.number()),
  },
  returns: v.object({
    url: v.string(),
    key: v.string(),
  }),
  handler: async (ctx, args) => {
    const access = await getProjectAccessForUser(
      ctx,
      args.projectId,
      args.actorUserId,
    );
    if (!access) throw new Error("No access to this project");

    const project = access.project;
    const team = (await ctx.db.get(project.teamId)) as Doc<"teams"> | null;
    if (!team) throw new Error("Team not found");

    const storageCheck = (await ctx.runQuery(checkStorageLimitQueryRef, {
      teamId: project.teamId,
      additionalBytes: args.fileSize,
    })) as { allowed: boolean; message: string };
    if (!storageCheck.allowed) {
      throw new Error(storageCheck.message);
    }

    const contextFolder = args.origin === "ai" ? "ai" : "files";
    const path = `${team.slug}/${project.slug}/${contextFolder}`;
    const fileExtension = args.fileName.includes(".")
      ? args.fileName.split(".").pop()
      : "";
    const baseName = args.fileName.replace(/\.[^/.]+$/, "");
    const uuid = crypto.randomUUID();
    const customKey = `${path}/${uuid}-${baseName}${fileExtension ? "." + fileExtension : ""}`;

    const uploadData = await r2.generateUploadUrl(customKey);
    return { url: uploadData.url, key: customKey };
  },
});

// Internal file record creation for server-side project file ingestion.
export const createFileRecordInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    actorUserId: v.string(),
    fileKey: v.string(),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.optional(v.number()),
    origin: v.optional(v.union(v.literal("ai"), v.literal("general"))),
  },
  handler: async (ctx, args) => {
    const access = await getProjectAccessForUser(
      ctx,
      args.projectId,
      args.actorUserId,
    );
    if (!access) throw new Error("No access to this project");

    const project = access.project;
    const origin = args.origin ?? "general";

    const fileId = await ctx.db.insert("files", {
      name: args.fileName,
      teamId: project.teamId,
      projectId: args.projectId,
      fileType: resolveFileType(args.fileType),
      storageId: args.fileKey,
      size: args.fileSize || 0,
      mimeType: args.fileType,
      uploadedBy: args.actorUserId,
      version: 1,
      isLatest: true,
      origin,
      aiKnowledgeEnabled: false,
      aiKnowledgeStatus: "excluded",
      aiKnowledgeEntryId: undefined,
      aiKnowledgeIndexedAt: undefined,
      showInClientPortal: false,
    });

    return fileId;
  },
});

// Create folder
export const createFolder = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    parentFolderId: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    const { project, identity } = await requireCurrentProjectAccess(
      ctx,
      args.projectId,
    );

    if (args.parentFolderId) {
      const parentFolder = await ctx.db.get(args.parentFolderId);
      if (!parentFolder || parentFolder.projectId !== args.projectId) {
        throw new Error("Invalid parent folder");
      }
    }

    return await ctx.db.insert("folders", {
      name: args.name,
      teamId: project.teamId,
      projectId: args.projectId,
      parentFolderId: args.parentFolderId,
      createdBy: identity.subject,
    });
  },
});

// Ensure root "labor" folder exists for project attachments.
export const ensureLaborFolder = mutation({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.id("folders"),
  handler: async (ctx, args) => {
    const { project, identity } = await requireCurrentProjectAccess(
      ctx,
      args.projectId,
    );

    const rootFolders = await ctx.db
      .query("folders")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("parentFolderId"), undefined))
      .collect();

    const existingLaborFolder = rootFolders.find(
      (folder) => folder.name.trim().toLowerCase() === "labor",
    );

    if (existingLaborFolder) {
      return existingLaborFolder._id;
    }

    return await ctx.db.insert("folders", {
      name: "labor",
      teamId: project.teamId,
      projectId: args.projectId,
      createdBy: identity.subject,
    });
  },
});

// Ensure root "moodboard" folder exists for project attachments.
export const ensureMoodboardFolder = mutation({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.id("folders"),
  handler: async (ctx, args) => {
    const { project, identity } = await requireCurrentProjectAccess(
      ctx,
      args.projectId,
    );

    const rootFolders = await ctx.db
      .query("folders")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("parentFolderId"), undefined))
      .collect();

    const existingMoodboardFolder = rootFolders.find(
      (folder) => folder.name.trim().toLowerCase() === "moodboard",
    );

    if (existingMoodboardFolder) {
      return existingMoodboardFolder._id;
    }

    return await ctx.db.insert("folders", {
      name: "Moodboard",
      teamId: project.teamId,
      projectId: args.projectId,
      createdBy: identity.subject,
    });
  },
});

// Dodaj plik do projektu/folderu
export const addFile = mutation({
  args: {
    projectId: v.id("projects"),
    taskId: v.optional(v.id("tasks")),
    folderId: v.optional(v.id("folders")),
    fileKey: v.string(),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    moodboardSection: v.optional(v.string()),
    origin: v.optional(v.union(v.literal("ai"), v.literal("general"))),
  },
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.fileSize) || args.fileSize < 0) {
      throw new Error("Invalid file size");
    }

    const { project, identity } = await requireCurrentProjectAccess(
      ctx,
      args.projectId,
    );

    const origin = args.origin ?? "general";
    const hasMoodboardSection =
      typeof args.moodboardSection === "string" &&
      args.moodboardSection.trim().length > 0;
    const moodboardSection = hasMoodboardSection
      ? args.moodboardSection?.trim()
      : undefined;
    const moodboardOrder = moodboardSection
      ? await getNextMoodboardFileOrder(ctx, args.projectId, moodboardSection)
      : undefined;

    // Check whether the folder exists and belongs to the project
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.projectId !== args.projectId) {
        throw new Error("Invalid folder");
      }
    }

    if (args.taskId) {
      const task = await ctx.db.get(args.taskId);
      if (!task || task.projectId !== args.projectId) {
        throw new Error("Invalid task");
      }
    }

    // Determine the file type from the MIME type
    const getFileType = (mimeType: string) => {
      if (mimeType.startsWith("image/")) return "image";
      if (mimeType.startsWith("video/")) return "video";
      if (mimeType === "application/pdf" || mimeType.includes("document"))
        return "document";
      if (mimeType.includes("dwg") || mimeType.includes("dxf"))
        return "drawing";
      return "other";
    };

    // Create file record
    const fileId = await ctx.db.insert("files", {
      name: args.fileName,
      teamId: project.teamId,
      projectId: args.projectId,
      taskId: args.taskId,
      folderId: args.folderId,
      fileType: getFileType(args.fileType),
      storageId: args.fileKey, // R2 key stored as string
      size: args.fileSize,
      mimeType: args.fileType,
      uploadedBy: identity.subject,
      version: 1,
      isLatest: true,
      origin,
      moodboardSection,
      moodboardOrder,
      aiKnowledgeEnabled: false,
      aiKnowledgeStatus: "excluded",
      aiKnowledgeEntryId: undefined,
      aiKnowledgeIndexedAt: undefined,
      // Moodboard uploads should be visible in the client portal by default.
      showInClientPortal: hasMoodboardSection,
    });

    // Log activity if file is attached to a task
    if (args.taskId) {
      const task = await ctx.db.get(args.taskId);
      await ctx.db.insert("activityLog", {
        teamId: project.teamId,
        projectId: args.projectId,
        taskId: args.taskId,
        userId: identity.subject,
        actionType: "task.file.add",
        details: {
          taskTitle: task?.title,
          fileName: args.fileName,
          fileType: getFileType(args.fileType),
        },
        entityId: fileId,
        entityType: "file",
      });
    }

    return fileId;
  },
});

// Pobierz foldery projektu
export const getProjectFolders = query({
  args: {
    projectId: v.id("projects"),
    parentFolderId: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    try {
      await requireCurrentProjectAccess(ctx, args.projectId);
    } catch {
      return [];
    }

    return await ctx.db
      .query("folders")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("parentFolderId"), args.parentFolderId))
      .collect();
  },
});

// Get project files (in a specific folder or root)
export const getProjectFiles = query({
  args: {
    projectId: v.id("projects"),
    folderId: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    try {
      await requireCurrentProjectAccess(ctx, args.projectId);
    } catch {
      return [];
    }

    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("folderId"), args.folderId))
      .collect();

    const visibleFiles = files.filter((file) => file.origin !== "ai");

    // Generate URLs for files
    const filesWithUrls = await Promise.all(
      visibleFiles.map(async (file) => {
        try {
          const url = await r2.getUrl(file.storageId as string, {
            expiresIn: 60 * 60 * 24, // 24 godziny
          });
          return { ...file, url };
        } catch (error) {
          console.error(`Error generating URL for file ${file._id}:`, error);
          return { ...file, url: null };
        }
      }),
    );

    return filesWithUrls;
  },
});

// Pobierz wszystkie pliki i foldery dla konkretnej lokalizacji
export const getProjectContent = query({
  args: {
    projectId: v.id("projects"),
    folderId: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    try {
      await requireCurrentProjectAccess(ctx, args.projectId);
    } catch {
      return { folders: [], files: [] };
    }

    // Pobierz foldery
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("parentFolderId"), args.folderId))
      .collect();

    // Pobierz pliki
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("folderId"), args.folderId))
      .collect();

    const visibleFiles = files.filter((file) => file.origin !== "ai");

    // Generate URLs for files
    const filesWithUrls = await Promise.all(
      visibleFiles.map(async (file) => {
        try {
          const url = await r2.getUrl(file.storageId as string, {
            expiresIn: 60 * 60 * 24, // 24 godziny
          });
          return { ...file, url };
        } catch (error) {
          console.error(`Error generating URL for file ${file._id}:`, error);
          return { ...file, url: null };
        }
      }),
    );

    return { folders, files: filesWithUrls };
  },
});

// Delete folder
export const deleteFolder = mutation({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.folderId);
    if (!folder) throw new Error("Folder not found");
    if (!folder.projectId)
      throw new Error("Folder is not attached to a project");

    await requireCurrentProjectAccess(ctx, folder.projectId);

    // Check whether the folder is empty (no files or subfolders)
    const filesInFolder = await ctx.db
      .query("files")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .first();

    const subfolders = await ctx.db
      .query("folders")
      .withIndex("by_parent", (q) => q.eq("parentFolderId", args.folderId))
      .first();

    if (filesInFolder || subfolders) {
      throw new Error("Cannot delete folder that contains files or subfolders");
    }

    // Delete folder
    await ctx.db.delete(args.folderId);

    return { success: true };
  },
});

// Delete file
export const deleteFile = mutation({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const file = await ctx.db.get(args.fileId);
    if (!file) throw new Error("File not found");
    if (!file.projectId) throw new Error("File is not attached to a project");

    const { membership } = await requireCurrentProjectAccess(
      ctx,
      file.projectId,
    );

    // Check whether the user can delete the file
    if (
      file.uploadedBy !== identity.subject &&
      membership.role !== "admin" &&
      membership.role !== "member"
    ) {
      throw new Error("No permission to delete this file");
    }

    // Delete from R2 using the component
    try {
      await ctx.runMutation(components.r2.lib.deleteObject, {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        bucket: process.env.R2_BUCKET!,
        endpoint: process.env.R2_ENDPOINT!,
        key: file.storageId,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      });
    } catch (error) {
      console.error(`Failed to delete file from R2: ${error}`);
      // Continue with database deletion even if R2 deletion fails
      // This prevents orphaned database records if R2 service is temporarily unavailable
    }

    await scheduleKnowledgeRemoval(ctx, file.aiKnowledgeEntryId);

    // Delete from the database
    await ctx.db.delete(args.fileId);

    return { success: true };
  },
});

export const setFileCustomerPortalVisibility = mutation({
  args: {
    fileId: v.id("files"),
    showInClientPortal: v.boolean(),
  },
  returns: v.object({
    success: v.boolean(),
    fileId: v.id("files"),
    showInClientPortal: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const file = await ctx.db.get(args.fileId);
    if (!file || !file.projectId) throw new Error("File not found");

    const project = await ctx.db.get(file.projectId);
    if (!project) throw new Error("Project not found");

    const member = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject),
      )
      .unique();

    if (!member || !member.isActive) {
      throw new Error("No access to this project");
    }

    if (member.role === "member" && Array.isArray(member.projectIds)) {
      if (!member.projectIds.includes(project._id)) {
        throw new Error("No access to this project");
      }
    } else if (member.role !== "admin" && member.role !== "member") {
      throw new Error("No permission to manage customer portal files");
    }

    await ctx.db.patch(args.fileId, {
      showInClientPortal: args.showInClientPortal,
    });

    return {
      success: true,
      fileId: args.fileId,
      showInClientPortal: args.showInClientPortal,
    };
  },
});

export const setFileAiKnowledgeInclusion = mutation({
  args: {
    fileId: v.id("files"),
    enabled: v.boolean(),
  },
  returns: v.object({
    success: v.boolean(),
    fileId: v.id("files"),
    aiKnowledgeEnabled: v.boolean(),
    aiKnowledgeStatus: v.union(
      v.literal("excluded"),
      v.literal("pending"),
      v.literal("ready"),
      v.literal("failed"),
    ),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const file = await ctx.db.get(args.fileId);
    if (!file || !file.projectId) throw new Error("File not found");

    const project = await ctx.db.get(file.projectId);
    if (!project) throw new Error("Project not found");

    const member = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject),
      )
      .unique();

    if (!member || !member.isActive) {
      throw new Error("No access to this project");
    }

    if (member.role === "member" && Array.isArray(member.projectIds)) {
      if (!member.projectIds.includes(project._id)) {
        throw new Error("No access to this project");
      }
    } else if (member.role !== "admin" && member.role !== "member") {
      throw new Error("No permission to manage AI knowledge files");
    }

    if (args.enabled && !isPdfFile(file)) {
      throw new Error("AI knowledge is only available for PDF files");
    }

    const nextStatus: "pending" | "excluded" = args.enabled
      ? "pending"
      : "excluded";
    await ctx.db.patch(args.fileId, {
      aiKnowledgeEnabled: args.enabled,
      aiKnowledgeStatus: nextStatus,
      aiKnowledgeError: undefined,
      aiKnowledgeEntryId: args.enabled ? file.aiKnowledgeEntryId : undefined,
      aiKnowledgeIndexedAt: args.enabled
        ? file.aiKnowledgeIndexedAt
        : undefined,
    });

    if (args.enabled) {
      await scheduleKnowledgeIndex(ctx, args.fileId);
    } else {
      await scheduleKnowledgeRemoval(ctx, file.aiKnowledgeEntryId);
      await ctx.db.patch(args.fileId, {
        aiKnowledgeEntryId: undefined,
        aiKnowledgeIndexedAt: undefined,
      });
    }

    return {
      success: true,
      fileId: args.fileId,
      aiKnowledgeEnabled: args.enabled,
      aiKnowledgeStatus: nextStatus,
    };
  },
});

export const setFileAiKnowledgeStateInternal = internalMutation({
  args: {
    fileId: v.id("files"),
    status: v.optional(
      v.union(
        v.literal("excluded"),
        v.literal("pending"),
        v.literal("ready"),
        v.literal("failed"),
      ),
    ),
    error: v.optional(v.union(v.string(), v.null())),
    entryId: v.optional(v.union(v.string(), v.null())),
    indexedAt: v.optional(v.union(v.number(), v.null())),
    extractedText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {};

    if (args.status !== undefined) {
      patch.aiKnowledgeStatus = args.status;
    }
    if (args.error !== undefined) {
      patch.aiKnowledgeError = args.error ?? undefined;
    }
    if (args.entryId !== undefined) {
      patch.aiKnowledgeEntryId = args.entryId ?? undefined;
    }
    if (args.indexedAt !== undefined) {
      patch.aiKnowledgeIndexedAt = args.indexedAt ?? undefined;
    }
    if (args.extractedText !== undefined) {
      patch.extractedText = args.extractedText;
      patch.textExtractionStatus = "completed";
    }

    await ctx.db.patch(args.fileId, patch);
  },
});

export const getProjectAiKnowledgeFiles = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const project = await ctx.db.get(args.projectId);
    if (!project) return [];

    const hasAccess = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject),
      )
      .unique();

    if (!hasAccess || !hasAccess.isActive) return [];

    const files = await ctx.db
      .query("files")
      .withIndex("by_project_and_ai_knowledge", (q) =>
        q.eq("projectId", args.projectId).eq("aiKnowledgeEnabled", true),
      )
      .collect();

    const visibleFiles = files.filter(
      (file) => file.origin !== "ai" && isPdfFile(file),
    );

    return Promise.all(
      visibleFiles.map(async (file) => {
        try {
          const url = await r2.getUrl(file.storageId as string, {
            expiresIn: 60 * 60 * 24,
          });
          return { ...file, url };
        } catch (error) {
          console.error(
            `Error generating URL for AI knowledge file ${file._id}:`,
            error,
          );
          return { ...file, url: null };
        }
      }),
    );
  },
});

// Get moodboard images for a project by section
export const getMoodboardImagesBySection = query({
  args: {
    projectId: v.id("projects"),
    section: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    try {
      await getProjectAccess(ctx, args.projectId, identity.subject);
    } catch {
      return [];
    }

    // Get only image files for this specific moodboard section
    const files = await ctx.db
      .query("files")
      .withIndex("by_moodboard_section", (q) =>
        q.eq("projectId", args.projectId).eq("moodboardSection", args.section),
      )
      .filter((q) => q.eq(q.field("fileType"), "image"))
      .collect();

    // Generate URLs for files
    const filesWithUrls = await Promise.all(
      sortMoodboardFiles(files).map(async (file, index) => {
        try {
          const url = await resolveStoredFileUrl(file.storageId as string, {
            expiresIn: 60 * 60 * 24, // 24 hours
          });
          return {
            id: file.storageId as string,
            url,
            name: file.name,
            order: file.moodboardOrder ?? index,
            _creationTime: file._creationTime,
          };
        } catch (error) {
          console.error(`Error generating URL for file ${file._id}:`, error);
          return {
            id: file.storageId as string,
            url: "",
            name: file.name,
            order: file.moodboardOrder ?? index,
            _creationTime: file._creationTime,
          };
        }
      }),
    );

    return filesWithUrls;
  },
});

export const getMoodboardSections = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.array(
    v.object({
      id: v.string(),
      title: v.string(),
      order: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const { project } = await getProjectAccess(
      ctx,
      args.projectId,
      identity.subject,
    );
    const fileSectionIds = await listMoodboardFileSectionIds(
      ctx,
      args.projectId,
    );

    return resolveMoodboardSections(
      getStoredMoodboardSections(project),
      fileSectionIds,
    );
  },
});

export const createMoodboardSection = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
  },
  returns: v.object({
    id: v.string(),
    title: v.string(),
    order: v.number(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { project } = await getProjectAccess(
      ctx,
      args.projectId,
      identity.subject,
    );
    const normalizedTitle = normalizeMoodboardSectionTitle(args.title);
    if (!normalizedTitle) {
      throw new Error("Section title is required");
    }

    const fileSectionIds = await listMoodboardFileSectionIds(
      ctx,
      args.projectId,
    );
    const sections = resolveMoodboardSections(
      getStoredMoodboardSections(project),
      fileSectionIds,
    );
    const titleAlreadyExists = sections.some(
      (section) =>
        normalizeMoodboardSectionTitle(section.title) === normalizedTitle ||
        normalizeMoodboardSectionTitle(section.id) === normalizedTitle,
    );

    if (titleAlreadyExists) {
      throw new Error("Section with this name already exists");
    }

    const createdSection = {
      id: normalizedTitle,
      title: normalizedTitle,
      order: sections.length,
    };

    await patchProjectMoodboardSections(ctx, args.projectId, [
      ...sections,
      createdSection,
    ]);

    return createdSection;
  },
});

export const renameMoodboardSection = mutation({
  args: {
    projectId: v.id("projects"),
    sectionId: v.string(),
    title: v.string(),
  },
  returns: v.object({
    id: v.string(),
    title: v.string(),
    order: v.number(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { project } = await getProjectAccess(
      ctx,
      args.projectId,
      identity.subject,
    );
    const normalizedTitle = normalizeMoodboardSectionTitle(args.title);
    if (!normalizedTitle) {
      throw new Error("Section title is required");
    }

    const fileSectionIds = await listMoodboardFileSectionIds(
      ctx,
      args.projectId,
    );
    const sections = resolveMoodboardSections(
      getStoredMoodboardSections(project),
      fileSectionIds,
    );
    const sectionToRename = sections.find(
      (section) => section.id === args.sectionId,
    );

    if (!sectionToRename) {
      throw new Error("Section not found");
    }

    const duplicateSection = sections.find(
      (section) =>
        section.id !== args.sectionId &&
        (normalizeMoodboardSectionTitle(section.title) === normalizedTitle ||
          normalizeMoodboardSectionTitle(section.id) === normalizedTitle),
    );

    if (duplicateSection) {
      throw new Error("Section with this name already exists");
    }

    const updatedSectionId = normalizedTitle;
    const nextSections = sections.map((section) =>
      section.id === args.sectionId
        ? {
            id: updatedSectionId,
            title: normalizedTitle,
            order: section.order,
          }
        : section,
    );

    if (args.sectionId !== updatedSectionId) {
      const filesInSection = await ctx.db
        .query("files")
        .withIndex("by_moodboard_section", (q) =>
          q
            .eq("projectId", args.projectId)
            .eq("moodboardSection", args.sectionId),
        )
        .collect();

      for (const file of filesInSection) {
        await ctx.db.patch(file._id, {
          moodboardSection: updatedSectionId,
        });
      }
    }

    await patchProjectMoodboardSections(ctx, args.projectId, nextSections);

    return {
      id: updatedSectionId,
      title: normalizedTitle,
      order: sectionToRename.order,
    };
  },
});

export const deleteMoodboardSection = mutation({
  args: {
    projectId: v.id("projects"),
    sectionId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    deletedFilesCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { project } = await getProjectAccess(
      ctx,
      args.projectId,
      identity.subject,
    );
    const fileSectionIds = await listMoodboardFileSectionIds(
      ctx,
      args.projectId,
    );
    const sections = resolveMoodboardSections(
      getStoredMoodboardSections(project),
      fileSectionIds,
    );

    if (!sections.some((section) => section.id === args.sectionId)) {
      throw new Error("Section not found");
    }

    const filesInSection = await ctx.db
      .query("files")
      .withIndex("by_moodboard_section", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("moodboardSection", args.sectionId),
      )
      .collect();

    for (const file of filesInSection) {
      await deleteStoredFile(ctx, file.storageId);
      await scheduleKnowledgeRemoval(ctx, file.aiKnowledgeEntryId);
      await ctx.db.delete(file._id);
    }

    const remainingSections = sections.filter(
      (section) => section.id !== args.sectionId,
    );
    await patchProjectMoodboardSections(ctx, args.projectId, remainingSections);

    return {
      success: true,
      deletedFilesCount: filesInSection.length,
    };
  },
});

export const reorderMoodboardSections = mutation({
  args: {
    projectId: v.id("projects"),
    orderedSectionIds: v.array(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { project } = await getProjectAccess(
      ctx,
      args.projectId,
      identity.subject,
    );
    const fileSectionIds = await listMoodboardFileSectionIds(
      ctx,
      args.projectId,
    );
    const sections = resolveMoodboardSections(
      getStoredMoodboardSections(project),
      fileSectionIds,
    );
    const byId = new Map(sections.map((section) => [section.id, section]));
    const seen = new Set<string>();
    const orderedSections: { id: string; title: string; order: number }[] = [];

    for (const sectionId of args.orderedSectionIds) {
      const section = byId.get(sectionId);
      if (!section || seen.has(sectionId)) continue;
      orderedSections.push(section);
      seen.add(sectionId);
    }

    for (const section of sections) {
      if (!seen.has(section.id)) {
        orderedSections.push(section);
      }
    }

    await patchProjectMoodboardSections(ctx, args.projectId, orderedSections);
    return true;
  },
});

export const moveMoodboardImage = mutation({
  args: {
    projectId: v.id("projects"),
    storageId: v.string(),
    targetSectionId: v.string(),
    targetIndex: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { project } = await getProjectAccess(
      ctx,
      args.projectId,
      identity.subject,
    );
    const fileSectionIds = await listMoodboardFileSectionIds(
      ctx,
      args.projectId,
    );
    const sections = resolveMoodboardSections(
      getStoredMoodboardSections(project),
      fileSectionIds,
    );
    if (!sections.some((section) => section.id === args.targetSectionId)) {
      throw new Error("Target section not found");
    }

    const movingFile = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("storageId"), args.storageId))
      .unique();

    if (!movingFile || !movingFile.moodboardSection) {
      throw new Error("Moodboard image not found");
    }

    const sourceSectionId = movingFile.moodboardSection;
    const affectedSectionIds = new Set([sourceSectionId, args.targetSectionId]);

    for (const sectionId of affectedSectionIds) {
      const sectionFiles = await ctx.db
        .query("files")
        .withIndex("by_moodboard_section", (q) =>
          q.eq("projectId", args.projectId).eq("moodboardSection", sectionId),
        )
        .filter((q) => q.eq(q.field("fileType"), "image"))
        .collect();
      const orderedFiles = sortMoodboardFiles(sectionFiles).filter(
        (file) => file._id !== movingFile._id,
      );

      if (sectionId === args.targetSectionId) {
        const insertIndex = Math.max(
          0,
          Math.min(args.targetIndex, orderedFiles.length),
        );
        orderedFiles.splice(insertIndex, 0, movingFile);
      }

      for (const [index, file] of orderedFiles.entries()) {
        await ctx.db.patch(file._id, {
          moodboardSection: sectionId,
          moodboardOrder: index,
        });
      }
    }

    return true;
  },
});

export const saveGeneratedMoodboardImageInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    fileKey: v.string(),
    fileName: v.string(),
    mimeType: v.string(),
    fileSize: v.optional(v.number()),
    moodboardSection: v.string(),
    uploadedBy: v.string(),
    aiPrompt: v.optional(v.string()),
    generationId: v.optional(v.id("aiGeneratedImages")),
  },
  returns: v.id("files"),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const existingFile = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("storageId"), args.fileKey))
      .unique();

    if (existingFile) {
      if (args.generationId) {
        await ctx.db.patch(args.generationId, { savedToFiles: true });
      }
      return existingFile._id;
    }

    const rootFolders = await ctx.db
      .query("folders")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("parentFolderId"), undefined))
      .collect();

    const existingMoodboardFolder = rootFolders.find(
      (folder) => folder.name.trim().toLowerCase() === "moodboard",
    );

    const folderId =
      existingMoodboardFolder?._id ??
      (await ctx.db.insert("folders", {
        name: "Moodboard",
        teamId: project.teamId,
        projectId: args.projectId,
        createdBy: args.uploadedBy,
      }));
    const moodboardSection = args.moodboardSection.trim();
    const moodboardOrder = await getNextMoodboardFileOrder(
      ctx,
      args.projectId,
      moodboardSection,
    );

    const fileId = await ctx.db.insert("files", {
      name: args.fileName,
      teamId: project.teamId,
      projectId: args.projectId,
      folderId,
      fileType: args.mimeType.startsWith("image/") ? "image" : "other",
      storageId: args.fileKey,
      size: args.fileSize || 0,
      mimeType: args.mimeType,
      uploadedBy: args.uploadedBy,
      version: 1,
      isLatest: true,
      origin: "ai",
      moodboardSection,
      moodboardOrder,
      aiPrompt: args.aiPrompt,
      showInClientPortal: true,
    });

    if (args.generationId) {
      await ctx.db.patch(args.generationId, { savedToFiles: true });
    }

    return fileId;
  },
});

// Find file by storageId for moodboard deletion
export const getFileByStorageId = query({
  args: {
    projectId: v.id("projects"),
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      await requireCurrentProjectAccess(ctx, args.projectId);
    } catch {
      return null;
    }

    // Find file by storageId
    const file = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("storageId"), args.storageId))
      .unique();

    return file;
  },
});

export const getFileUrlByStorageId = query({
  args: {
    projectId: v.id("projects"),
    storageId: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    try {
      await requireCurrentProjectAccess(ctx, args.projectId);
    } catch {
      return null;
    }

    try {
      return await r2.getUrl(args.storageId, {
        expiresIn: 60 * 60 * 2,
      });
    } catch (error) {
      console.error(
        `Error generating signed URL for storage key ${args.storageId}:`,
        error,
      );
      return null;
    }
  },
});

// Delete file by storageId (for moodboard)
export const deleteFileByStorageId = mutation({
  args: {
    projectId: v.id("projects"),
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const { membership } = await requireCurrentProjectAccess(
      ctx,
      args.projectId,
    );

    // Find file by storageId
    const file = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("storageId"), args.storageId))
      .unique();

    if (!file) {
      throw new Error("File not found");
    }

    // Check if user can delete file (same logic as deleteFile)
    if (
      file.uploadedBy !== identity.subject &&
      membership.role !== "admin" &&
      membership.role !== "member"
    ) {
      throw new Error("No permission to delete this file");
    }

    // Delete from R2
    await deleteStoredFile(ctx, file.storageId);

    await scheduleKnowledgeRemoval(ctx, file.aiKnowledgeEntryId);

    // Delete from database
    await ctx.db.delete(file._id);

    return { success: true };
  },
});

// Pobierz metadane pliku
export const getFileMetadata = query({
  args: { fileKey: v.string() },
  handler: async (ctx, args) => {
    return await r2.getMetadata(ctx, args.fileKey);
  },
});

// Pobierz informacje o konkretnym folderze
export const getFolder = query({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.folderId);
    if (!folder) return null;
    if (!folder.projectId) return null;
    try {
      await requireCurrentProjectAccess(ctx, folder.projectId);
    } catch {
      return null;
    }

    return folder;
  },
});

export const getFilesForTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return [];

    if (!task.projectId) return [];
    try {
      await requireCurrentProjectAccess(ctx, task.projectId);
    } catch {
      return [];
    }

    const files = await ctx.db
      .query("files")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    return Promise.all(
      files.map(async (file) => {
        const url = await r2.getUrl(file.storageId);
        return { ...file, url };
      }),
    );
  },
});

// ====== TEXT EXTRACTION SUPPORT ======

// Internal mutation to update file with extracted text
export const updateFileWithExtractedText = internalMutation({
  args: {
    fileId: v.id("files"),
    extractedText: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.fileId, {
      extractedText: args.extractedText,
      textExtractionStatus: "completed",
    });
  },
});

// Update file text extraction status
export const updateTextExtractionStatus = internalMutation({
  args: {
    fileId: v.id("files"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.fileId, {
      textExtractionStatus: args.status,
    });
  },
});

// Get file by ID (for text extraction)
export const getFileById = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const file = await ctx.db.get(args.fileId);
    if (!file || !file.projectId) return null;

    try {
      await getProjectAccess(ctx, file.projectId, identity.subject);
      return file;
    } catch {
      return null;
    }
  },
});

export const getFileByIdInternal = internalQuery({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.fileId);
  },
});

// Get file with URL for thumbnails
export const getFileWithURL = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.fileId);
    if (!file || !file.projectId) return null;
    try {
      await requireCurrentProjectAccess(ctx, file.projectId);
    } catch {
      return null;
    }

    // Generate URL
    try {
      const url = await r2.getUrl(file.storageId as string, {
        expiresIn: 60 * 60 * 2, // 2 hours
      });
      return { ...file, url };
    } catch (error) {
      console.error(`Error generating URL for file ${file._id}:`, error);
      return { ...file, url: null };
    }
  },
});

// Update file with PDF analysis results
export const updateFileAnalysis = internalMutation({
  args: {
    fileId: v.id("files"),
    analysis: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.fileId, {
      pdfAnalysis: args.analysis,
      analysisStatus: "completed",
    });
  },
});
