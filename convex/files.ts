import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { SUBSCRIPTION_PLANS } from "./stripe";
import { Id } from "./_generated/dataModel";

export const r2 = new R2(components.r2);

const buildPublicR2FileUrl = (key: string) => {
  const publicBaseUrl = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || "")
    .trim()
    .replace(/\/+$/, "");
  if (!publicBaseUrl) {
    return "";
  }
  return `${publicBaseUrl}/${key}`;
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

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Get all projects for this team
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", q => q.eq("teamId", args.teamId))
      .collect();

    // Sum up all file sizes across projects
    let totalBytes = 0;
    for (const project of projects) {
      const files = await ctx.db
        .query("files")
        .withIndex("by_project", q => q.eq("projectId", project._id))
        .filter(q => q.eq(q.field("isLatest"), true))
        .collect();

      totalBytes += files.reduce((sum, file) => sum + (file.size || 0), 0);
    }

    const plan = (team.subscriptionPlan || "free") as keyof typeof SUBSCRIPTION_PLANS;
    const limits = team.subscriptionLimits || SUBSCRIPTION_PLANS[plan];
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
      .withIndex("by_team", q => q.eq("teamId", args.teamId))
      .collect();

    // Sum up all file sizes
    let totalBytes = 0;
    for (const project of projects) {
      const files = await ctx.db
        .query("files")
        .withIndex("by_project", q => q.eq("projectId", project._id))
        .filter(q => q.eq(q.field("isLatest"), true))
        .collect();

      totalBytes += files.reduce((sum, file) => sum + (file.size || 0), 0);
    }

    const plan = (team.subscriptionPlan || "free") as keyof typeof SUBSCRIPTION_PLANS;
    const limits = team.subscriptionLimits || SUBSCRIPTION_PLANS[plan];
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

// Konfiguracja klienta R2 z walidacją dla projektów architektonicznych
export const { generateUploadUrl, syncMetadata } = r2.clientApi({
  checkUpload: async (ctx, bucket) => {
    // Sprawdź czy użytkownik jest zalogowany
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("You must be logged in to upload files");
    }
    
    // Można dodać dodatkowe sprawdzenia uprawnień
    console.log(`User ${identity.subject} is uploading to bucket ${bucket}`);
  },
  
  onUpload: async (_ctx, key) => {
    // Logika wykonywana po upload - możemy utworzyć rekord w bazie
    console.log(`File uploaded with key: ${key}`);
  },
});

// Generate upload URL with custom folder structure: org/project/file
export const generateUploadUrlWithCustomKey = mutation({
  args: {
    projectId: v.id("projects"),
    taskId: v.optional(v.id("tasks")),
    fileName: v.string(),
    origin: v.optional(v.union(v.literal("ai"), v.literal("general"))),
    fileSize: v.optional(v.number()), // Size in bytes for storage limit check
  },
  returns: v.object({
    url: v.string(),
    key: v.string(),
    publicUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const team = await ctx.db.get(project.teamId);
    if (!team) throw new Error("Team not found");

    // Check access
    const hasAccess = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!hasAccess || !hasAccess.isActive) {
      throw new Error("No access to this project");
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

    const plan = (team.subscriptionPlan || "free") as keyof typeof SUBSCRIPTION_PLANS;
    const limits = team.subscriptionLimits || SUBSCRIPTION_PLANS[plan];
    const limitBytes = limits.maxStorageGB * 1024 * 1024 * 1024;
    const newTotal = totalBytes + (args.fileSize || 0);

    if (newTotal >= limitBytes) {
      throw new Error(`Storage limit reached (${limits.maxStorageGB} GB). Please upgrade your plan.`);
    }

    const contextFolder = args.origin === "ai"
      ? "ai"
      : args.taskId
      ? "tasks"
      : "files";
    const path = `${team.slug}/${project.slug}/${contextFolder}`;

    // Generate folder structure: team/project/context/uuid-filename
    const fileExtension = args.fileName.includes('.')
      ? args.fileName.split('.').pop()
      : '';
    const baseName = args.fileName.replace(/\.[^/.]+$/, ""); // Remove extension
    const uuid = crypto.randomUUID();
    const customKey = `${path}/${uuid}-${baseName}${fileExtension ? '.' + fileExtension : ''}`;

    const uploadData = await r2.generateUploadUrl(customKey);
    
    return {
      url: uploadData.url,
      key: customKey,
      publicUrl: buildPublicR2FileUrl(customKey),
    };
  },
});

const resolveFileType = (mimeType: string) => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf" || mimeType.includes("document")) return "document";
  if (mimeType.includes("dwg") || mimeType.includes("dxf")) return "drawing";
  return "other";
};
const checkStorageLimitRef = { _name: "files:checkStorageLimit" } as const;

const getProjectAccessForUser = async (ctx: any, projectId: Id<"projects">, actorUserId: string) => {
  const project = await ctx.db.get(projectId) as any;
  if (!project) {
    return null;
  }

  const membership = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q: any) =>
      q.eq("teamId", project.teamId).eq("clerkUserId", actorUserId)
    )
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .first();

  if (!membership || (membership.role !== "admin" && membership.role !== "member")) {
    return null;
  }

  return { project, membership };
};

// Internal upload URL generator used by Telegram attachment ingestion.
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
    const access = await getProjectAccessForUser(ctx, args.projectId, args.actorUserId);
    if (!access) throw new Error("No access to this project");

    const project = access.project;
    const team = await ctx.db.get(project.teamId) as any;
    if (!team) throw new Error("Team not found");

    const storageCheck = await ctx.runQuery(checkStorageLimitRef as any, {
      teamId: project.teamId,
      additionalBytes: args.fileSize,
    });
    if (!storageCheck.allowed) {
      throw new Error(storageCheck.message);
    }

    const contextFolder = args.origin === "ai" ? "ai" : "files";
    const path = `${team.slug}/${project.slug}/${contextFolder}`;
    const fileExtension = args.fileName.includes(".") ? args.fileName.split(".").pop() : "";
    const baseName = args.fileName.replace(/\.[^/.]+$/, "");
    const uuid = crypto.randomUUID();
    const customKey = `${path}/${uuid}-${baseName}${fileExtension ? "." + fileExtension : ""}`;

    const uploadData = await r2.generateUploadUrl(customKey);
    return { url: uploadData.url, key: customKey };
  },
});

// Internal file record creation used by Telegram attachment ingestion.
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
    const access = await getProjectAccessForUser(ctx, args.projectId, args.actorUserId);
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    // Sprawdź uprawnienia do projektu
    const hasAccess = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!hasAccess || !hasAccess.isActive) {
      throw new Error("No access to this project");
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const hasAccess = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!hasAccess || !hasAccess.isActive) {
      throw new Error("No access to this project");
    }

    const rootFolders = await ctx.db
      .query("folders")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("parentFolderId"), undefined))
      .collect();

    const existingLaborFolder = rootFolders.find(
      (folder) => folder.name.trim().toLowerCase() === "labor"
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

// Dodaj plik do projektu/folderu
export const addFile = mutation({
  args: {
    projectId: v.id("projects"),
    taskId: v.optional(v.id("tasks")),
    folderId: v.optional(v.id("folders")),
    fileKey: v.string(),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.optional(v.number()),
    moodboardSection: v.optional(v.string()),
    origin: v.optional(v.union(v.literal("ai"), v.literal("general"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    // Sprawdź uprawnienia do projektu
    const hasAccess = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!hasAccess || !hasAccess.isActive) {
      throw new Error("No access to this project");
    }

    const origin = args.origin ?? "general";

    // Sprawdź czy folder istnieje i należy do projektu
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.projectId !== args.projectId) {
        throw new Error("Invalid folder");
      }
    }

    // Określ typ pliku na podstawie MIME type
    const getFileType = (mimeType: string) => {
      if (mimeType.startsWith("image/")) return "image";
      if (mimeType.startsWith("video/")) return "video";
      if (mimeType === "application/pdf" || mimeType.includes("document")) return "document";
      if (mimeType.includes("dwg") || mimeType.includes("dxf")) return "drawing";
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
      size: args.fileSize || 0,
      mimeType: args.fileType,
      uploadedBy: identity.subject,
      version: 1,
      isLatest: true,
      origin,
      moodboardSection: args.moodboardSection,
      showInClientPortal: false,
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
        details: { taskTitle: task?.title, fileName: args.fileName, fileType: getFileType(args.fileType) },
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
    parentFolderId: v.optional(v.id("folders"))
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const project = await ctx.db.get(args.projectId);
    if (!project) return [];

    // Sprawdź uprawnienia
    const hasAccess = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!hasAccess || !hasAccess.isActive) return [];

    return await ctx.db
      .query("folders")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .filter(q => q.eq(q.field("parentFolderId"), args.parentFolderId))
      .collect();
  },
});

// Pobierz pliki projektu (w określonym folderze lub root)
export const getProjectFiles = query({
  args: { 
    projectId: v.id("projects"),
    folderId: v.optional(v.id("folders"))
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const project = await ctx.db.get(args.projectId);
    if (!project) return [];

    // Sprawdź uprawnienia
    const hasAccess = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!hasAccess || !hasAccess.isActive) return [];

    const files = await ctx.db
      .query("files")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .filter(q => q.eq(q.field("folderId"), args.folderId))
      .collect();

    const visibleFiles = files.filter((file) => file.origin !== "ai");

    // Generuj URLs dla plików
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
      })
    );

    return filesWithUrls;
  },
});

// Pobierz wszystkie pliki i foldery dla konkretnej lokalizacji
export const getProjectContent = query({
  args: { 
    projectId: v.id("projects"),
    folderId: v.optional(v.id("folders"))
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { folders: [], files: [] };

    const project = await ctx.db.get(args.projectId);
    if (!project) return { folders: [], files: [] };

    // Sprawdź uprawnienia
    const hasAccess = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!hasAccess || !hasAccess.isActive) return { folders: [], files: [] };

    // Pobierz foldery
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .filter(q => q.eq(q.field("parentFolderId"), args.folderId))
      .collect();

    // Pobierz pliki
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .filter(q => q.eq(q.field("folderId"), args.folderId))
      .collect();

    const visibleFiles = files.filter((file) => file.origin !== "ai");

    // Generuj URLs dla plików
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
      })
    );

    return { folders, files: filesWithUrls };
  },
});

// Usuń folder
export const deleteFolder = mutation({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const folder = await ctx.db.get(args.folderId);
    if (!folder) throw new Error("Folder not found");

    // Sprawdź uprawnienia
    const project = await ctx.db.get(folder.projectId!);
    if (project) {
      const member = await ctx.db
        .query("teamMembers")
        .withIndex("by_team_and_user", q => 
          q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
        )
        .unique();
      
      if (!member || !member.isActive) {
        throw new Error("No permission to delete this folder");
      }
    }

    // Sprawdź czy folder jest pusty (brak plików i podfolderów)
    const filesInFolder = await ctx.db
      .query("files")
      .withIndex("by_folder", q => q.eq("folderId", args.folderId))
      .first();

    const subfolders = await ctx.db
      .query("folders")
      .withIndex("by_parent", q => q.eq("parentFolderId", args.folderId))
      .first();

    if (filesInFolder || subfolders) {
      throw new Error("Cannot delete folder that contains files or subfolders");
    }

    // Usuń folder
    await ctx.db.delete(args.folderId);
    
    return { success: true };
  },
});

// Usuń plik
export const deleteFile = mutation({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const file = await ctx.db.get(args.fileId);
    if (!file) throw new Error("File not found");

    // Sprawdź czy użytkownik może usunąć plik
    if (file.uploadedBy !== identity.subject) {
      const project = await ctx.db.get(file.projectId!);
      if (project) {
        const member = await ctx.db
          .query("teamMembers")
          .withIndex("by_team_and_user", q => 
            q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
          )
          .unique();
        
        if (!member || (member.role !== "admin" && member.role !== "member")) {
          throw new Error("No permission to delete this file");
        }
      }
    }

    // Usuń z R2 używając komponentu
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
    
    // Usuń z bazy danych
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
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!member || !member.isActive) {
      throw new Error("No access to this project");
    }

    if (member.role === "member" && member.projectIds && member.projectIds.length > 0) {
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

// Get moodboard images for a project by section
export const getMoodboardImagesBySection = query({
  args: { 
    projectId: v.id("projects"),
    section: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const project = await ctx.db.get(args.projectId);
    if (!project) return [];

    // Check access
    const hasAccess = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!hasAccess || !hasAccess.isActive) return [];

    // Get only image files for this specific moodboard section
    const files = await ctx.db
      .query("files")
      .withIndex("by_moodboard_section", q => 
        q.eq("projectId", args.projectId).eq("moodboardSection", args.section)
      )
      .filter(q => q.eq(q.field("fileType"), "image"))
      .collect();

    // Generate URLs for files
    const filesWithUrls = await Promise.all(
      files.map(async (file) => {
        try {
          const url = await r2.getUrl(file.storageId as string, {
            expiresIn: 60 * 60 * 24, // 24 hours
          });
          return { 
            id: file.storageId as string,
            url,
            name: file.name,
            _creationTime: file._creationTime
          };
        } catch (error) {
          console.error(`Error generating URL for file ${file._id}:`, error);
          return { 
            id: file.storageId as string,
            url: "",
            name: file.name,
            _creationTime: file._creationTime
          };
        }
      })
    );

    return filesWithUrls;
  },
});

// Get moodboard images for a project (legacy - keep for compatibility)
export const getMoodboardImages = query({
  args: { 
    projectId: v.id("projects")
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const project = await ctx.db.get(args.projectId);
    if (!project) return [];

    // Check access
    const hasAccess = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!hasAccess || !hasAccess.isActive) return [];

    // Get only image files without folder (moodboard images)
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .filter(q => q.and(
        q.eq(q.field("folderId"), undefined),
        q.eq(q.field("fileType"), "image")
      ))
      .collect();

    // Generate URLs for files
    const filesWithUrls = await Promise.all(
      files.map(async (file) => {
        try {
          const url = await r2.getUrl(file.storageId as string, {
            expiresIn: 60 * 60 * 24, // 24 hours
          });
          return { 
            id: file.storageId as string,
            url,
            name: file.name,
            _creationTime: file._creationTime
          };
        } catch (error) {
          console.error(`Error generating URL for file ${file._id}:`, error);
          return { 
            id: file.storageId as string,
            url: "",
            name: file.name,
            _creationTime: file._creationTime
          };
        }
      })
    );

    return filesWithUrls;
  },
});

// Find file by storageId for moodboard deletion
export const getFileByStorageId = query({
  args: { 
    projectId: v.id("projects"),
    storageId: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    // Check access
    const hasAccess = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!hasAccess || !hasAccess.isActive) return null;

    // Find file by storageId
    const file = await ctx.db
      .query("files")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .filter(q => q.eq(q.field("storageId"), args.storageId))
      .unique();

    return file;
  },
});

// Delete file by storageId (for moodboard)
export const deleteFileByStorageId = mutation({
  args: { 
    projectId: v.id("projects"),
    storageId: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    // Check access
    const hasAccess = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!hasAccess || !hasAccess.isActive) {
      throw new Error("No access to this project");
    }

    // Find file by storageId
    const file = await ctx.db
      .query("files")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .filter(q => q.eq(q.field("storageId"), args.storageId))
      .unique();

    if (!file) {
      throw new Error("File not found");
    }

    // Check if user can delete file (same logic as deleteFile)
    if (file.uploadedBy !== identity.subject) {
      const member = await ctx.db
        .query("teamMembers")
        .withIndex("by_team_and_user", q => 
          q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
        )
        .unique();
      
      if (!member || (member.role !== "admin" && member.role !== "member")) {
        throw new Error("No permission to delete this file");
      }
    }

    // Delete from R2
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
    }
    
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const folder = await ctx.db.get(args.folderId);
    if (!folder) return null;

    // Sprawdź uprawnienia
    const project = await ctx.db.get(folder.projectId!);
    if (!project) return null;

    const hasAccess = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!hasAccess || !hasAccess.isActive) return null;

    return folder;
  },
});

export const getFilesForTask = query({
    args: { taskId: v.id("tasks") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];

        const task = await ctx.db.get(args.taskId);
        if (!task) return [];

        if (!task.projectId) return [];

        const project = await ctx.db.get(task.projectId);
        if (!project) return [];

        const hasAccess = await ctx.db
            .query("teamMembers")
            .withIndex("by_team_and_user", (q) =>
              q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
            )
            .unique();
        if (!hasAccess) return [];
        if (!hasAccess.isActive) return [];

        const files = await ctx.db
            .query("files")
            .withIndex("by_task", q => q.eq("taskId", args.taskId))
            .collect();

        return Promise.all(
            files.map(async (file) => {
                const url = await r2.getUrl(file.storageId);
                return { ...file, url };
            })
        );
    }
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
      v.literal("failed")
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
    return await ctx.db.get(args.fileId);
  },
});

// Get file with URL for thumbnails
export const getFileWithURL = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const file = await ctx.db.get(args.fileId);
    if (!file || !file.projectId) return null;

    // Check project access
    const project = await ctx.db.get(file.projectId);
    if (!project) return null;

    const hasAccess = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!hasAccess || !hasAccess.isActive) return null;

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
