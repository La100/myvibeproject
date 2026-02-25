import { v } from "convex/values";
import { internalMutation, internalQuery, query, mutation } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { r2 } from "./files";
const internalAny = require("./_generated/api").internal as any;

// Utility function to generate a slug from a string
const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
};

const generateClientPanelAccessToken = () =>
  crypto.randomUUID().replace(/-/g, "");

const configuredR2PublicBaseUrl = (() => {
  const rawValue = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || "").trim();
  if (!rawValue) {
    return null;
  }
  try {
    return new URL(rawValue);
  } catch {
    return null;
  }
})();

const extractCoverImageStorageKey = (coverImageUrl: string): string | undefined => {
  const trimmed = coverImageUrl.trim();
  if (!trimmed) {
    return undefined;
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^\/+/, "") || undefined;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const configuredHost = configuredR2PublicBaseUrl?.hostname.toLowerCase();
    const isLikelyR2Host =
      host.endsWith(".r2.cloudflarestorage.com") ||
      host.endsWith(".r2.dev") ||
      (configuredHost ? host === configuredHost : false);

    if (!isLikelyR2Host) {
      return undefined;
    }

    let key = parsed.pathname.replace(/^\/+/, "");
    if (configuredR2PublicBaseUrl && configuredHost && host === configuredHost) {
      const basePath = configuredR2PublicBaseUrl.pathname.replace(/^\/+|\/+$/g, "");
      if (basePath) {
        if (key.startsWith(`${basePath}/`)) {
          key = key.slice(basePath.length + 1);
        } else if (key === basePath) {
          key = "";
        }
      }
    }

    if (!key) {
      return undefined;
    }
    return decodeURIComponent(key);
  } catch {
    return undefined;
  }
};

const resolveCoverImageDisplayUrl = async (coverImageUrl?: string): Promise<string | undefined> => {
  const trimmed = coverImageUrl?.trim();
  if (!trimmed) {
    return undefined;
  }

  const storageKey = extractCoverImageStorageKey(trimmed);
  if (!storageKey) {
    return trimmed;
  }

  try {
    const signedUrl = await r2.getUrl(storageKey, { expiresIn: 60 * 60 * 24 * 7 });
    return signedUrl || trimmed;
  } catch {
    return trimmed;
  }
};

// Utility function to generate next project ID
const generateNextProjectId = async (ctx: any) => {
  const lastProject = await ctx.db
    .query("projects")
    .withIndex("by_project_id")
    .order("desc")
    .first();

  return (lastProject?.projectId || 0) + 1;
};

const clientPanelDisplaySettingsValidator = {
  showShoppingList: v.optional(v.boolean()),
  showFiles: v.optional(v.boolean()),
  showMoodboard: v.optional(v.boolean()),
  showSurveys: v.optional(v.boolean()),
  showTasks: v.optional(v.boolean()),
  showLabor: v.optional(v.boolean()),
  showContacts: v.optional(v.boolean()),
  showBudget: v.optional(v.boolean()),
  showNotes: v.optional(v.boolean()),
  showSupplier: v.optional(v.boolean()),
  showPrice: v.optional(v.boolean()),
};

const defaultClientPanelDisplaySettings = {
  showShoppingList: false,
  showFiles: false,
  showMoodboard: false,
  showSurveys: false,
  showTasks: false,
  showLabor: false,
  showContacts: false,
  showBudget: false,
  showNotes: true,
  showSupplier: true,
  showPrice: true,
};

type ClientPanelDisplaySettings = typeof defaultClientPanelDisplaySettings;

const getResolvedClientPanelDisplaySettings = (
  settings?: Partial<ClientPanelDisplaySettings> | null
): ClientPanelDisplaySettings => ({
  showShoppingList: settings?.showShoppingList ?? defaultClientPanelDisplaySettings.showShoppingList,
  showFiles: settings?.showFiles ?? defaultClientPanelDisplaySettings.showFiles,
  showMoodboard: settings?.showMoodboard ?? defaultClientPanelDisplaySettings.showMoodboard,
  showSurveys: settings?.showSurveys ?? defaultClientPanelDisplaySettings.showSurveys,
  showTasks: settings?.showTasks ?? defaultClientPanelDisplaySettings.showTasks,
  showLabor: settings?.showLabor ?? defaultClientPanelDisplaySettings.showLabor,
  showContacts: settings?.showContacts ?? defaultClientPanelDisplaySettings.showContacts,
  showBudget: settings?.showBudget ?? defaultClientPanelDisplaySettings.showBudget,
  showNotes: settings?.showNotes ?? defaultClientPanelDisplaySettings.showNotes,
  showSupplier: settings?.showSupplier ?? defaultClientPanelDisplaySettings.showSupplier,
  showPrice: settings?.showPrice ?? defaultClientPanelDisplaySettings.showPrice,
});

const getProjectManagerMembership = async (
  ctx: any,
  projectId: Id<"projects">,
  clerkUserId: string
) => {
  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  const teamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q: any) =>
      q.eq("teamId", project.teamId).eq("clerkUserId", clerkUserId)
    )
    .unique();

  if (!teamMember) {
    throw new Error("User is not a team member");
  }

  if (teamMember.role === "admin") {
    return { project, teamMember };
  }

  if (teamMember.role === "member") {
    if (teamMember.projectIds && teamMember.projectIds.length > 0) {
      if (!teamMember.projectIds.includes(projectId)) {
        throw new Error("Insufficient permissions to manage this project");
      }
    }
    return { project, teamMember };
  }

  throw new Error("Insufficient permissions to manage this project");
};

// ====== CORE PROJECT FUNCTIONS ======

// Get projects by team ID
export const getProjectsByTeam = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if user is member of this team
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!membership || (membership.role !== "admin" && membership.role !== "member")) {
      throw new Error("User is not a member of this team");
    }

    // Get all projects for the team
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    return projects.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const listProjectsByClerkOrg = query({
  args: { clerkOrgId: v.string() },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      // During Clerk -> Convex auth handoff (e.g. right after onboarding),
      // this query can run before identity is available.
      // Return an empty list instead of crashing the client.
      return [];
    }

    const team = await ctx.db
      .query("teams")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();

    if (!team) {
      return [];
    }

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject)
      )
      .unique();

    let projects: any[] = [];
    
    if (membership && membership.isActive) {
      if (membership.role === "admin") {
        // Admin sees all team projects
        projects = await ctx.db
          .query("projects")
          .withIndex("by_team", (q) => q.eq("teamId", team._id))
          .collect();
      } else if (membership.role === "member") {
        // Member may have limited access
        if (membership.projectIds && membership.projectIds.length > 0) {
          // Member with limited access - only assigned projects
          const projectPromises = membership.projectIds.map(id => ctx.db.get(id));
          const projectResults = await Promise.all(projectPromises);
          projects = projectResults.filter(p => p !== null);
        } else {
          // Member without restrictions - all team projects
          projects = await ctx.db
            .query("projects")
            .withIndex("by_team", (q) => q.eq("teamId", team._id))
            .collect();
        }
      }
    } else {
      return [];
    }

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();

    const taskStatsByProject = new Map<
      Id<"projects">,
      { taskCount: number; completedTasks: number }
    >();

    for (const task of tasks) {
      const currentStats = taskStatsByProject.get(task.projectId) || {
        taskCount: 0,
        completedTasks: 0,
      };

      currentStats.taskCount += 1;
      if (task.status === "done") {
        currentStats.completedTasks += 1;
      }

      taskStatsByProject.set(task.projectId, currentStats);
    }

    const projectsWithTasks = await Promise.all(projects.map(async (project) => {
      const stats = taskStatsByProject.get(project._id) || {
        taskCount: 0,
        completedTasks: 0,
      };
      const coverImageDisplayUrl = await resolveCoverImageDisplayUrl(project.coverImageUrl);

      return {
        ...project,
        coverImageDisplayUrl,
        taskCount: stats.taskCount,
        completedTasks: stats.completedTasks,
      };
    }));

    return projectsWithTasks;
  },
});

export const listProjectsByTeam = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if user has access to this team
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (
      !teamMember ||
      !teamMember.isActive ||
      (teamMember.role !== "admin" && teamMember.role !== "member")
    ) {
      return [];
    }

    // Get all projects for this team
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    return projects;
  },
});

export const createProjectInOrg = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
    clerkOrgId: v.string(),
    teamId: v.id("teams"),
    customer: v.optional(v.string()),
    location: v.optional(v.string()),
    budget: v.optional(v.number()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db
      .query("teams")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();

    if (!team) {
      throw new Error("Team not found for this organization");
    }

    const baseSlug = generateSlug(args.name);
    let slug = baseSlug;
    let counter = 1;
    while (true) {
        const existing = await ctx.db
            .query("projects")
            .withIndex("by_team_and_slug", (q) => q.eq("teamId", team._id).eq("slug", slug))
            .first();
        if (!existing) {
            break;
        }
        slug = `${baseSlug}-${counter}`;
        counter++;
    }

    const defaultStatusSettings = {
      todo: { name: "To Do", color: "#808080" },
      in_progress: { name: "In Progress", color: "#3b82f6" },
      review: { name: "Review", color: "#a855f7" },
      done: { name: "Done", color: "#22c55e" },
    };

    const nextProjectId = await generateNextProjectId(ctx);

    // Check if creator is already a team member
    const creatorMembership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) => q.eq("teamId", team._id).eq("clerkUserId", identity.subject))
      .unique();

    if (!creatorMembership) {
      // If not a member, add as admin
      await ctx.db.insert("teamMembers", {
        teamId: team._id,
        clerkUserId: identity.subject,
        clerkOrgId: args.clerkOrgId,
        role: "admin",
        isActive: true,
        joinedAt: Date.now(),
        permissions: [],
      });
    } else if (creatorMembership.role !== "admin") {
      // If already a member but not admin, promote to admin
      await ctx.db.patch(creatorMembership._id, { role: "admin" });
    }

    const normalizedCoverImageUrl = args.coverImageUrl?.trim();

    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      coverImageUrl: normalizedCoverImageUrl || undefined,
      teamId: args.teamId,
      slug: slug,
      projectId: nextProjectId,
      status: "planning",
      customer: args.customer,
      location: args.location,
      budget: args.budget,
      currency: team.currency || "PLN", // Inherit currency from team, default PLN
      startDate: args.startDate,
      endDate: args.endDate,
      createdBy: identity.subject,
      assignedTo: [],
      taskStatusSettings: defaultStatusSettings,
      aiAutoConfirmCrud: false,
    });

    await ctx.runMutation(internalAny.activityLog.logActivity, {
      teamId: team._id,
      actionType: "analytics.project.created",
      details: {
        name: args.name,
        status: "planning",
      },
      entityId: projectId,
      entityType: "project",
    });

    return { id: projectId, slug: slug };
  },
});

export const getProjectBySlug = query({
  args: { 
    teamSlug: v.string(),
    projectSlug: v.string(),
  },
  async handler(ctx, args) {
    const team = await ctx.db.query("teams").withIndex("by_slug", q => q.eq("slug", args.teamSlug)).unique();
    if(!team) return null;

    const project = await ctx.db
      .query("projects")
      .withIndex("by_team_and_slug", (q) =>
        q.eq("teamId", team._id).eq("slug", args.projectSlug)
      )
      .unique();
    
    return project;
  },
});

export const getProjectBySlugInClerkOrg = query({
  args: {
    clerkOrgId: v.string(),
    projectSlug: v.string(),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const team = await ctx.db
      .query("teams")
      .withIndex("by_clerk_org", q => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();
    if (!team) return null;

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!membership || (membership.role !== "admin" && membership.role !== "member")) {
      return null;
    }

    const project = await ctx.db
      .query("projects")
      .withIndex("by_team_and_slug", (q) =>
        q.eq("teamId", team._id).eq("slug", args.projectSlug)
      )
      .unique();

    if (!project) return null;

    const coverImageDisplayUrl = await resolveCoverImageDisplayUrl(project.coverImageUrl);
    return {
      ...project,
      coverImageDisplayUrl,
    };
  },
});


export const getProject = query({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }
    const team = await ctx.db.get(project.teamId);
    if (!team) {
      return { ...project, teamName: "Unknown Team" };
    }
    return { ...project, teamName: team.name };
  }
});

// Internal query used by messaging/webhook actions.
export const getProjectByIdInternal = internalQuery({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }
    const team = await ctx.db.get(project.teamId);
    return { ...project, teamName: team?.name || "Unknown Team" };
  },
});

// Resolve project by Telegram webhook secret sent in header.
export const getProjectByTelegramWebhookSecret = internalQuery({
  args: { telegramWebhookSecret: v.string() },
  async handler(ctx, args) {
    return await ctx.db
      .query("projects")
      .withIndex("by_telegram_webhook_secret", (q) =>
        q.eq("telegramWebhookSecret", args.telegramWebhookSecret)
      )
      .first();
  },
});

// Internal entrypoint for assistant/tools to configure Telegram credentials.
export const updateProjectTelegramConfigInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    actorUserId: v.string(),
    telegramBotToken: v.string(),
    telegramBotUsername: v.optional(v.string()),
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

    const isTokenUpdated = args.telegramBotToken !== project.telegramBotToken;
    const shouldRotateTelegramSecret =
      !!args.telegramBotToken &&
      (!project.telegramWebhookSecret || isTokenUpdated);
    const telegramWebhookSecret = shouldRotateTelegramSecret
      ? generateTelegramWebhookSecret()
      : project.telegramWebhookSecret;

    await ctx.db.patch(args.projectId, {
      telegramBotToken: args.telegramBotToken,
      ...(args.telegramBotUsername ? { telegramBotUsername: args.telegramBotUsername } : {}),
      ...(shouldRotateTelegramSecret ? { telegramWebhookSecret } : {}),
    });

    if (isTokenUpdated || shouldRotateTelegramSecret) {
      await ctx.scheduler.runAfter(0, internalAny.messaging.telegramActions.setTelegramWebhook, {
        projectId: args.projectId,
      });
    }

    return { success: true };
  },
});

export const updateProject = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("planning"),
      v.literal("active"),
      v.literal("on_hold"),
      v.literal("completed"),
      v.literal("cancelled")
    )),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    budget: v.optional(v.number()),
    customer: v.optional(v.string()),
    location: v.optional(v.string()),
    currency: v.optional(v.union(
      v.literal("USD"), v.literal("EUR"), v.literal("PLN"), v.literal("GBP"),
      v.literal("CAD"), v.literal("AUD"), v.literal("JPY"), v.literal("CHF"),
      v.literal("SEK"), v.literal("NOK"), v.literal("DKK"), v.literal("CZK"),
      v.literal("HUF"), v.literal("CNY"), v.literal("INR"), v.literal("BRL"),
      v.literal("MXN"), v.literal("KRW"), v.literal("SGD"), v.literal("HKD")
    )),
    taskStatusSettings: v.optional(v.any()), // Allow any object for simplification
    customAiPrompt: v.optional(v.string()),
    aiAutoConfirmCrud: v.optional(v.boolean()),
    telegramBotUsername: v.optional(v.string()),
    telegramBotToken: v.optional(v.string()),
    whatsappNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const { projectId, name, telegramBotToken, coverImageUrl, ...rest } = args;

    const existingProject = await ctx.db.get(projectId);
    if (!existingProject) {
      throw new Error("Project not found");
    }

    // Permission check (example)
    // const member = await ctx.db.query("teamMembers").withIndex("by_team_and_user", q => q.eq("teamId", existingProject.teamId).eq("clerkUserId", identity.subject)).first();
    // if (!member || (member.role !== 'admin' && member.role !== 'member')) {
    //   throw new Error("You don't have permission to update this project.");
    // }

    const telegramTokenProvided = Object.prototype.hasOwnProperty.call(args, "telegramBotToken");
    const isTokenUpdated =
      telegramTokenProvided && telegramBotToken !== existingProject.telegramBotToken;
    const shouldRotateTelegramSecret =
      !!((telegramTokenProvided ? telegramBotToken : existingProject.telegramBotToken)) &&
      (!existingProject.telegramWebhookSecret || isTokenUpdated);
    const telegramWebhookSecret = shouldRotateTelegramSecret
      ? generateTelegramWebhookSecret()
      : existingProject.telegramWebhookSecret;
    const telegramTokenPatch = telegramTokenProvided ? { telegramBotToken } : {};
    const coverImageProvided = Object.prototype.hasOwnProperty.call(args, "coverImageUrl");
    const normalizedCoverImageUrl = coverImageProvided ? coverImageUrl?.trim() : undefined;
    const coverImagePatch = coverImageProvided
      ? { coverImageUrl: normalizedCoverImageUrl || undefined }
      : {};
    
    if (name && name !== existingProject.name) {
      const baseSlug = generateSlug(name);
      let slug = baseSlug;
      let counter = 1;
      
      let existing;
      do {
        existing = await ctx.db
          .query("projects")
          .withIndex("by_team_and_slug", (q) => 
            q.eq("teamId", existingProject.teamId).eq("slug", slug)
          )
          .first();
        if (existing) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
      } while (existing);
      
      await ctx.db.patch(projectId, {
        name,
        slug,
        ...telegramTokenPatch,
        ...coverImagePatch,
        ...(shouldRotateTelegramSecret ? { telegramWebhookSecret } : {}),
        ...rest,
      });

      if (isTokenUpdated || shouldRotateTelegramSecret) {
        await ctx.scheduler.runAfter(0, internalAny.messaging.telegramActions.setTelegramWebhook, {
          projectId,
        });
      }

      return { slug };
    } else {
      await ctx.db.patch(projectId, {
        ...telegramTokenPatch,
        ...coverImagePatch,
        ...(shouldRotateTelegramSecret ? { telegramWebhookSecret } : {}),
        ...rest,
      });

      if (isTokenUpdated || shouldRotateTelegramSecret) {
        await ctx.scheduler.runAfter(0, internalAny.messaging.telegramActions.setTelegramWebhook, {
          projectId,
        });
      }

      return { slug: existingProject.slug };
    }
  }
});

function generateTelegramWebhookSecret(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export const listTeamProjects = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", q => q.eq("teamId", args.teamId))
      .collect();

    const projectsWithTaskCounts = await Promise.all(
      projects.map(async (project) => {
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        const completedTasks = tasks.filter(
          (task) => task.status === "done"
        ).length;
        return {
          ...project,
          taskCount: tasks.length,
          completedTasks: completedTasks,
        };
      })
    );

    return projectsWithTaskCounts;
  }
});

export const getProjectsForTeam = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const clerkUserId = identity.subject;

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", clerkUserId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!membership) {
      return [];
    }

    let projects: Doc<"projects">[] = [];

    if (membership.role === "admin") {
      // Admin sees all team projects
      projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
        .collect();
    } else if (membership.role === "member") {
      // Member may have limited access
      if (membership.projectIds && membership.projectIds.length > 0) {
        // Member with limited access - only assigned projects
        const memberProjects = await Promise.all(
          membership.projectIds.map((id) => ctx.db.get(id))
        );
        projects = memberProjects.filter((p): p is Doc<"projects"> => p !== null);
      } else {
        // Member without restrictions - all team projects
        projects = await ctx.db
          .query("projects")
          .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
          .collect();
      }
    }

    projects.sort((a, b) => a.name.localeCompare(b.name));
    return projects;
  },
});

// ====== PROJECT ACCESS FUNCTIONS ======

export const checkUserProjectAccess = query({
  args: {
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const project = await ctx.db.get(args.projectId);
    if (!project) return false;

    // Check team membership
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .filter(q => q.eq(q.field("isActive"), true))
      .unique();

    if (!teamMember) {
      return false;
    }

    // Admin has access to all projects in the team
    if (teamMember.role === "admin") {
      return teamMember;
    }

    // Member may have limited access to projects
    if (teamMember.role === "member") {
      // If member has assigned projectIds, check if they have access to this project
      if (teamMember.projectIds && teamMember.projectIds.length > 0) {
        return teamMember.projectIds.includes(args.projectId) ? teamMember : false;
      }
      // If no projectIds = access to all (backward compatibility)
      return teamMember;
    }
    
    // In other cases, no access
    return false;
  }
});

export const ensureClientPanelAccessToken = mutation({
  args: {
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { project } = await getProjectManagerMembership(ctx, args.projectId, identity.subject);

    if (project.clientPanelAccessToken) {
      return { token: project.clientPanelAccessToken };
    }

    const token = generateClientPanelAccessToken();
    await ctx.db.patch(args.projectId, {
      clientPanelAccessToken: token,
    });

    return { token };
  },
});

export const regenerateClientPanelAccessToken = mutation({
  args: {
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    await getProjectManagerMembership(ctx, args.projectId, identity.subject);

    const token = generateClientPanelAccessToken();
    await ctx.db.patch(args.projectId, {
      clientPanelAccessToken: token,
    });

    return { token };
  },
});

export const getClientPanelConfiguration = query({
  args: {
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const { project } = await getProjectManagerMembership(ctx, args.projectId, identity.subject);

    const snapshotItems = await ctx.db
      .query("clientPanelItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const itemCount = snapshotItems.length;
    const fileCount = (
      await ctx.db
        .query("clientPanelFiles")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect()
    ).length;
    const productFeedback = snapshotItems
      .filter((item) => !item.alternativeToSourceItemId)
      .map((item) => ({
        sourceItemId: item.sourceItemId,
        itemName: item.name,
        sectionName: item.sectionName,
        decision: item.customerDecision ?? null,
        comment: item.customerDecisionComment ?? null,
        updatedAt: item.customerDecisionUpdatedAt ?? null,
      }))
      .sort((a, b) => {
        const aDate = a.updatedAt || 0;
        const bDate = b.updatedAt || 0;
        if (aDate !== bDate) {
          return bDate - aDate;
        }
        return a.itemName.localeCompare(b.itemName);
      });
    const feedbackSummary = {
      acceptedCount: productFeedback.filter((item) => item.decision === "accepted").length,
      rejectedCount: productFeedback.filter((item) => item.decision === "rejected").length,
      commentedCount: productFeedback.filter(
        (item) => typeof item.comment === "string" && item.comment.trim().length > 0
      ).length,
    };

    return {
      accessToken: project.clientPanelAccessToken || null,
      settings: getResolvedClientPanelDisplaySettings(
        project.clientPanelPublishedSettings as Partial<ClientPanelDisplaySettings> | null
      ),
      version: project.clientPanelDataVersion || 0,
      updatedAt: project.clientPanelDataUpdatedAt || null,
      itemCount,
      fileCount,
      productFeedback,
      feedbackSummary,
    };
  },
});

export const publishClientPanelData = mutation({
  args: {
    projectId: v.id("projects"),
    settings: v.object(clientPanelDisplaySettingsValidator),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { project } = await getProjectManagerMembership(ctx, args.projectId, identity.subject);

    const sections = await ctx.db
      .query("shoppingListSections")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("asc")
      .collect();

    const sectionMetaById = new Map(
      sections.map((section) => [String(section._id), { name: section.name, order: section.order }])
    );

    const items = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const existingSnapshotItems = await ctx.db
      .query("clientPanelItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const existingSnapshotItemBySourceId = new Map(
      existingSnapshotItems.map((snapshotItem) => [
        String(snapshotItem.sourceItemId),
        snapshotItem,
      ])
    );
    await Promise.all(existingSnapshotItems.map((item) => ctx.db.delete(item._id)));

    const existingSnapshotSections = await ctx.db
      .query("clientPanelSections")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    await Promise.all(existingSnapshotSections.map((section) => ctx.db.delete(section._id)));

    const existingSnapshotFiles = await ctx.db
      .query("clientPanelFiles")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    await Promise.all(existingSnapshotFiles.map((file) => ctx.db.delete(file._id)));

    for (const section of sections) {
      await ctx.db.insert("clientPanelSections", {
        projectId: args.projectId,
        name: section.name,
        order: section.order,
      });
    }

    for (const item of items) {
      const sectionMeta =
        item.sectionId && sectionMetaById.has(String(item.sectionId))
          ? sectionMetaById.get(String(item.sectionId))
          : null;
      const existingSnapshotItem = existingSnapshotItemBySourceId.get(String(item._id));

      await ctx.db.insert("clientPanelItems", {
        projectId: args.projectId,
        sourceItemId: item._id,
        name: item.name,
        realizationStatus: item.realizationStatus,
        notes: item.notes,
        supplier: item.supplier,
        catalogNumber: item.catalogNumber,
        category: item.category,
        dimensions: item.dimensions,
        imageUrl: item.imageUrl,
        productLink: item.productLink,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        sectionName: sectionMeta?.name,
        sectionOrder: sectionMeta?.order ?? Number.MAX_SAFE_INTEGER,
        alternativeToSourceItemId: item.alternativeToItemId || null,
        selectedAlternativeSourceItemId: item.selectedAlternativeItemId || null,
        customerDecision: existingSnapshotItem?.customerDecision ?? item.customerDecision ?? null,
        customerDecisionComment:
          existingSnapshotItem?.customerDecisionComment ??
          item.customerDecisionComment ??
          null,
        customerDecisionUpdatedAt:
          existingSnapshotItem?.customerDecisionUpdatedAt ??
          item.customerDecisionUpdatedAt,
      });
    }

    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const selectedFiles = files.filter((file) => file.showInClientPortal === true);
    const folderNameById = new Map<string, string>();
    const folderIds = [
      ...new Set(
        selectedFiles
          .map((file) => file.folderId)
          .filter((folderId): folderId is Id<"folders"> => !!folderId)
      ),
    ];
    const folderRecords = await Promise.all(folderIds.map((folderId) => ctx.db.get(folderId)));
    for (const folder of folderRecords) {
      if (!folder) continue;
      folderNameById.set(String(folder._id), folder.name);
    }

    for (const file of selectedFiles) {
      await ctx.db.insert("clientPanelFiles", {
        projectId: args.projectId,
        sourceFileId: file._id,
        name: file.name,
        fileType: file.fileType,
        storageId: file.storageId,
        mimeType: file.mimeType,
        size: file.size,
        folderName: file.folderId ? folderNameById.get(String(file.folderId)) : undefined,
        moodboardSection: file.moodboardSection,
        uploadedAt: file._creationTime,
      });
    }

    const resolvedSettings = getResolvedClientPanelDisplaySettings(args.settings);
    const version = (project.clientPanelDataVersion || 0) + 1;
    const updatedAt = Date.now();
    const token = project.clientPanelAccessToken || generateClientPanelAccessToken();

    await ctx.db.patch(args.projectId, {
      clientPanelAccessToken: token,
      clientPanelPublishedSettings: resolvedSettings,
      clientPanelDataVersion: version,
      clientPanelDataUpdatedAt: updatedAt,
    });

    return {
      success: true,
      token,
      version,
      updatedAt,
      itemCount: items.length,
      fileCount: selectedFiles.length,
    };
  },
});

// ====== PROJECT DELETION ======

export const deleteProject = mutation({
  args: {
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get the project to check permissions
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    // Check if user has permission to delete (only admin role)
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || teamMember.role !== "admin") {
      throw new Error("Insufficient permissions to delete this project. Only admin can delete projects.");
    }

    // Unregister Telegram webhook before deleting the project.
    if (project.telegramBotToken) {
      await ctx.scheduler.runAfter(
        0,
        internalAny.messaging.telegramActions.deleteTelegramWebhook,
        { botToken: project.telegramBotToken }
      );
    }

    // Delete all tasks associated with the project
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();

    const taskDeletionPromises = tasks.map(task => ctx.db.delete(task._id));
    await Promise.all(taskDeletionPromises);

    // Delete all comments related to the project or its tasks
    const projectComments = await ctx.db
      .query("comments")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();

    const taskComments = await Promise.all(
      tasks.map(task => 
        ctx.db
          .query("comments")
          .withIndex("by_task", q => q.eq("taskId", task._id))
          .collect()
      )
    ).then(results => results.flat());

    const allComments = [...projectComments, ...taskComments];
    const commentDeletionPromises = allComments.map(comment => ctx.db.delete(comment._id));
    await Promise.all(commentDeletionPromises);

    // Delete messaging channels and pairing artifacts.
    const messagingChannels = await ctx.db
      .query("messagingChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    await Promise.all(messagingChannels.map((channel) => ctx.db.delete(channel._id)));

    const pairingRequests = await ctx.db
      .query("messagingPairingRequests")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    await Promise.all(pairingRequests.map((request) => ctx.db.delete(request._id)));

    const pairingTokensTelegram = await ctx.db
      .query("messagingPairingTokens")
      .withIndex("by_project_and_platform", (q) =>
        q.eq("projectId", args.projectId).eq("platform", "telegram")
      )
      .collect();
    const pairingTokensWhatsapp = await ctx.db
      .query("messagingPairingTokens")
      .withIndex("by_project_and_platform", (q) =>
        q.eq("projectId", args.projectId).eq("platform", "whatsapp")
      )
      .collect();
    await Promise.all(
      [...pairingTokensTelegram, ...pairingTokensWhatsapp].map((token) => ctx.db.delete(token._id))
    );

    // Delete all folders related to the project
    const projectFolders = await ctx.db
      .query("folders")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();

    const folderDeletionPromises = projectFolders.map(folder => ctx.db.delete(folder._id));
    await Promise.all(folderDeletionPromises);

    // Delete all shopping list sections and items for this project
    const shoppingListSections = await ctx.db
      .query("shoppingListSections")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();

    const shoppingListItems = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();

    const shoppingSectionDeletionPromises = shoppingListSections.map(section => ctx.db.delete(section._id));
    const shoppingItemDeletionPromises = shoppingListItems.map(item => ctx.db.delete(item._id));
    
    await Promise.all([...shoppingSectionDeletionPromises, ...shoppingItemDeletionPromises]);

    // Finally, delete the project itself
    await ctx.db.delete(args.projectId);

    return { success: true };
  }
}); 

// Update project task status settings
export const updateProjectTaskStatusSettings = mutation({
  args: {
    projectId: v.id("projects"),
    settings: v.object({
      todo: v.object({ name: v.string(), color: v.string() }),
      in_progress: v.object({ name: v.string(), color: v.string() }),
      review: v.object({ name: v.string(), color: v.string() }),
      done: v.object({ name: v.string(), color: v.string() }),
    }),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject),
      )
      .unique();

    const hasAccess = Boolean(
      membership &&
        membership.isActive &&
        (membership.role === "admin" ||
          (membership.role === "member" &&
            (!membership.projectIds ||
              membership.projectIds.length === 0 ||
              membership.projectIds.includes(args.projectId)))),
    );

    if (!hasAccess) {
      throw new Error("You don't have permission to update these settings.");
    }

    await ctx.db.patch(args.projectId, {
      taskStatusSettings: args.settings,
    });

    return { success: true };
  }
}); 
