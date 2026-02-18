import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, query, mutation } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
const internalAny = require("./_generated/api").internal as any;

// Utility function to generate a slug from a string
const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
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

const clientPortalPermissionsValidator = {
  overview: v.optional(v.object({ visible: v.boolean() })),
  tasks: v.optional(v.object({ visible: v.boolean() })),
  moodboard: v.optional(v.object({ visible: v.boolean() })),
  notes: v.optional(v.object({ visible: v.boolean() })),
  contacts: v.optional(v.object({ visible: v.boolean() })),
  surveys: v.optional(v.object({ visible: v.boolean() })),
  calendar: v.optional(v.object({ visible: v.boolean() })),
  gantt: v.optional(v.object({ visible: v.boolean() })),
  files: v.optional(v.object({ visible: v.boolean() })),
  shopping_list: v.optional(v.object({ visible: v.boolean() })),
  labor: v.optional(v.object({ visible: v.boolean() })),
  estimations: v.optional(v.object({ visible: v.boolean() })),
  settings: v.optional(v.object({ visible: v.boolean() })),
};

const defaultClientPortalPermissions = {
  overview: { visible: true },
  tasks: { visible: true },
  moodboard: { visible: true },
  notes: { visible: true },
  contacts: { visible: true },
  surveys: { visible: true },
  calendar: { visible: true },
  gantt: { visible: true },
  files: { visible: true },
  shopping_list: { visible: true },
  labor: { visible: true },
  estimations: { visible: true },
  settings: { visible: false },
};

type ClientPortalPermissionKey = keyof typeof defaultClientPortalPermissions;
type ClientPortalPermissions = Record<ClientPortalPermissionKey, { visible: boolean }>;

const getResolvedClientPortalPermissions = (
  permissions?: Partial<ClientPortalPermissions> | null
): ClientPortalPermissions => {
  const resolved = { ...defaultClientPortalPermissions } as ClientPortalPermissions;
  (Object.keys(defaultClientPortalPermissions) as ClientPortalPermissionKey[]).forEach((key) => {
    resolved[key] = {
      visible: permissions?.[key]?.visible ?? defaultClientPortalPermissions[key].visible,
    };
  });
  return resolved;
};

const hasPermissionChanges = (
  left: ClientPortalPermissions,
  right: ClientPortalPermissions
): boolean =>
  (Object.keys(defaultClientPortalPermissions) as ClientPortalPermissionKey[]).some(
    (key) => left[key].visible !== right[key].visible
  );

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

    if (!membership) {
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
      } else if (membership.role === "customer" && membership.projectIds) {
        // Customer with specific projectIds in teamMembers
        const projectPromises = membership.projectIds.map(id => ctx.db.get(id));
        const projectResults = await Promise.all(projectPromises);
        projects = projectResults.filter(p => p !== null);
      }
    } else {
      // Check if user is a customer with access to specific projects (legacy)
      const customerAccess = await ctx.db
        .query("customers")
        .withIndex("by_clerk_user", q => q.eq("clerkUserId", identity.subject))
        .filter(q => q.and(
          q.eq(q.field("teamId"), team._id),
          q.eq(q.field("status"), "active")
        ))
        .collect();

      if (customerAccess.length > 0) {
        const projectIds = customerAccess.map(c => c.projectId);
        const projectPromises = projectIds.map(id => ctx.db.get(id));
        const projectResults = await Promise.all(projectPromises);
        projects = projectResults.filter(p => p !== null);
      } else {
        return [];
      }
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

    const projectsWithTasks = projects.map((project) => {
      const stats = taskStatsByProject.get(project._id) || {
        taskCount: 0,
        completedTasks: 0,
      };

      return {
        ...project,
        taskCount: stats.taskCount,
        completedTasks: stats.completedTasks,
      };
    });

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

    if (!teamMember || !teamMember.isActive) {
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
    let creatorMembership = await ctx.db
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

    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
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
    const team = await ctx.db
      .query("teams")
      .withIndex("by_clerk_org", q => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();
    if (!team) return null;

    const project = await ctx.db
      .query("projects")
      .withIndex("by_team_and_slug", (q) =>
        q.eq("teamId", team._id).eq("slug", args.projectSlug)
      )
      .unique();

    return project;
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
    telegramBotUsername: v.optional(v.string()),
    telegramBotToken: v.optional(v.string()),
    whatsappNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const { projectId, name, telegramBotToken, ...rest } = args;

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
    } else if (
      membership.role === "customer" &&
      membership.projectIds &&
      membership.projectIds.length > 0
    ) {
      const customerProjects = await Promise.all(
        membership.projectIds.map((id) => ctx.db.get(id))
      );
      projects = customerProjects.filter((p): p is Doc<"projects"> => p !== null);
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

    // Customers have access only to assigned projects
    if (teamMember.role === "customer") {
      return teamMember.projectIds?.includes(args.projectId) ? teamMember : false;
    }
    
    // In other cases, no access
    return false;
  }
});

export const updateProjectSidebarPermissions = mutation({
  args: {
    projectId: v.id("projects"),
    sidebarPermissions: v.object(clientPortalPermissionsValidator),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    await getProjectManagerMembership(ctx, args.projectId, identity.subject);

    await ctx.db.patch(args.projectId, {
      sidebarPermissions: args.sidebarPermissions,
    });

    return { success: true };
  },
});

export const publishClientPortal = mutation({
  args: {
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { project } = await getProjectManagerMembership(ctx, args.projectId, identity.subject);
    const publishedAt = Date.now();
    const nextVersion = (project.clientPortalVersion || 0) + 1;
    const draftPermissions = getResolvedClientPortalPermissions(
      project.sidebarPermissions as Partial<ClientPortalPermissions> | null
    );

    await ctx.db.patch(args.projectId, {
      clientPortalPublishedPermissions: draftPermissions,
      clientPortalVersion: nextVersion,
      clientPortalPublishedAt: publishedAt,
      clientPortalPublishedBy: identity.subject,
    });

    return {
      success: true,
      version: nextVersion,
      publishedAt,
      publishedBy: identity.subject,
    };
  },
});

export const getClientPortalConfiguration = query({
  args: {
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const { project } = await getProjectManagerMembership(ctx, args.projectId, identity.subject);
    const portalVersion = project.clientPortalVersion || 0;
    const draftPermissions = getResolvedClientPortalPermissions(
      project.sidebarPermissions as Partial<ClientPortalPermissions> | null
    );
    const publishedPermissions = getResolvedClientPortalPermissions(
      (project.clientPortalPublishedPermissions ||
        project.sidebarPermissions) as Partial<ClientPortalPermissions> | null
    );
    const hasUnpublishedChanges =
      portalVersion === 0 || hasPermissionChanges(draftPermissions, publishedPermissions);

    const projectCustomers = await ctx.db
      .query("customers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    let acceptedCustomers = 0;
    if (portalVersion > 0) {
      const acceptances = await ctx.db
        .query("clientPortalAcceptances")
        .withIndex("by_project_and_version", (q) =>
          q.eq("projectId", args.projectId).eq("version", portalVersion)
        )
        .collect();
      acceptedCustomers = acceptances.length;
    }

    return {
      draftPermissions,
      publishedPermissions,
      hasUnpublishedChanges,
      version: portalVersion,
      publishedAt: project.clientPortalPublishedAt || null,
      publishedBy: project.clientPortalPublishedBy || null,
      stats: {
        totalCustomers: projectCustomers.length,
        activeCustomers: projectCustomers.filter((customer) => customer.status === "active").length,
        pendingCustomers: projectCustomers.filter((customer) => customer.status === "invited").length,
        acceptedCustomers,
      },
    };
  },
});

export const acceptLatestClientPortal = mutation({
  args: {
    projectId: v.id("projects"),
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

    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .unique();

    const customerRecord = await ctx.db
      .query("customers")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .filter((q) =>
        q.and(
          q.eq(q.field("projectId"), args.projectId),
          q.eq(q.field("status"), "active")
        )
      )
      .first();

    const hasCustomerRoleInProject =
      teamMember?.role === "customer" &&
      (!teamMember.projectIds ||
        teamMember.projectIds.length === 0 ||
        teamMember.projectIds.includes(args.projectId));

    if (!hasCustomerRoleInProject && !customerRecord) {
      throw new Error("Only project customers can accept portal updates.");
    }

    const latestVersion = project.clientPortalVersion || 0;
    if (latestVersion === 0) {
      throw new Error("No portal update has been published yet.");
    }

    const acceptedAt = Date.now();
    const existingAcceptance = await ctx.db
      .query("clientPortalAcceptances")
      .withIndex("by_project_and_user", (q) =>
        q.eq("projectId", args.projectId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (existingAcceptance) {
      await ctx.db.patch(existingAcceptance._id, {
        version: latestVersion,
        acceptedAt,
      });
    } else {
      await ctx.db.insert("clientPortalAcceptances", {
        teamId: project.teamId,
        projectId: args.projectId,
        clerkUserId: identity.subject,
        version: latestVersion,
        acceptedAt,
      });
    }

    return {
      success: true,
      version: latestVersion,
      acceptedAt,
    };
  },
});

export const getProjectSidebarPermissions = query({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    // Check user role
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    // Check if user is a project customer
    const customerAccess = await ctx.db
      .query("customers")
      .withIndex("by_clerk_user", q => q.eq("clerkUserId", identity.subject))
      .filter(q => q.and(
        q.eq(q.field("projectId"), args.projectId),
        q.eq(q.field("status"), "active")
      ))
      .unique();

    const acceptance = await ctx.db
      .query("clientPortalAcceptances")
      .withIndex("by_project_and_user", (q) =>
        q.eq("projectId", args.projectId).eq("clerkUserId", identity.subject)
      )
      .unique();

    const portalVersion = project.clientPortalVersion || 0;
    const acceptedVersion = acceptance?.version || 0;
    const portalState = {
      version: portalVersion,
      publishedAt: project.clientPortalPublishedAt || null,
      acceptedVersion,
      acceptedAt: acceptance?.acceptedAt || null,
      hasPendingUpdate: portalVersion > 0 && acceptedVersion < portalVersion,
    };

    const managerPermissions = getResolvedClientPortalPermissions(null);
    managerPermissions.settings = { visible: true };

    // Check if user has access to the project
    if (teamMember && teamMember.role === "admin") {
      // Admin always has full permissions
      return {
        permissions: managerPermissions,
        userRole: teamMember.role,
        isCustomer: false,
        portal: portalState,
      };
    }

    if (teamMember && teamMember.role === "member") {
      // Check if member has access to this project
      let hasAccess = true;
      if (teamMember.projectIds && teamMember.projectIds.length > 0) {
        hasAccess = teamMember.projectIds.includes(args.projectId);
      }
      
      if (hasAccess) {
        return {
          permissions: managerPermissions,
          userRole: teamMember.role,
          isCustomer: false,
          portal: portalState,
        };
      }
      // If no access, treat as customer
    }

    // If user is a customer, apply restrictions
    if (teamMember?.role === "customer" || customerAccess) {
      const publishedPermissions = getResolvedClientPortalPermissions(
        (project.clientPortalPublishedPermissions ||
          project.sidebarPermissions) as Partial<ClientPortalPermissions> | null
      );
      
      return {
        permissions: publishedPermissions,
        userRole: teamMember?.role || "customer",
        isCustomer: true,
        portal: portalState,
      };
    }

    // If user has no access
    return null;
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

    // Delete all files related to the project or its tasks
    const projectFiles = await ctx.db
      .query("files")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();

    const taskFiles = await Promise.all(
      tasks.map(task => 
        ctx.db
          .query("files")
          .withIndex("by_task", q => q.eq("taskId", task._id))
          .collect()
      )
    ).then(results => results.flat());

    // Delete all customer records associated with this project
    const projectCustomers = await ctx.db
      .query("customers")
      .filter(q => q.eq(q.field("projectId"), args.projectId))
      .collect();

    // Handle team members with role "customer" - remove project or delete member entirely
    const customerTeamMembers = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", q => q.eq("teamId", project.teamId))
      .filter(q => q.eq(q.field("role"), "customer"))
      .collect();

    const memberOperationPromises = customerTeamMembers.map(async (member) => {
      const currentProjectIds = member.projectIds || [];
      
      if (currentProjectIds.includes(args.projectId) || currentProjectIds.length === 0) {
        const updatedProjectIds = currentProjectIds.filter(id => id !== args.projectId);
        
        if (updatedProjectIds.length === 0) {
          // If this was the customer's only project or they had no projects, remove member completely
          await ctx.db.delete(member._id);
          console.log(`Deleted customer team member ${member.clerkUserId} - no more projects`);
        } else {
          // If they have more projects, just remove this project from the list
          await ctx.db.patch(member._id, { projectIds: updatedProjectIds });
          console.log(`Updated customer team member ${member.clerkUserId} - removed project from list`);
        }
      } else {
        // Check if customer has access to this project through customers table
        const customerRecord = await ctx.db
          .query("customers")
          .withIndex("by_clerk_user", q => q.eq("clerkUserId", member.clerkUserId))
          .filter(q => q.eq(q.field("projectId"), args.projectId))
          .first();
        
        if (customerRecord) {
          // Customer was linked to this project - check if they have other projects
          const otherCustomerRecords = await ctx.db
            .query("customers")
            .withIndex("by_clerk_user", q => q.eq("clerkUserId", member.clerkUserId))
            .filter(q => q.neq(q.field("projectId"), args.projectId))
            .collect();
          
          if (otherCustomerRecords.length === 0) {
            // No other projects - remove member
            await ctx.db.delete(member._id);
            console.log(`Deleted customer team member ${member.clerkUserId} - was only connected to deleted project`);
          }
        }
      }
    });
    await Promise.all(memberOperationPromises);

    // Delete all customer records for this project
    const customerDeletionPromises = projectCustomers.map(customer => ctx.db.delete(customer._id));
    await Promise.all(customerDeletionPromises);

    // Delete all client portal acceptance records for this project
    const portalAcceptances = await ctx.db
      .query("clientPortalAcceptances")
      .withIndex("by_project_and_version", (q) => q.eq("projectId", args.projectId))
      .collect();
    await Promise.all(portalAcceptances.map((acceptance) => ctx.db.delete(acceptance._id)));

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
