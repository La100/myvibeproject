import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  query,
  mutation,
} from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { r2 } from "./files";
import { canAccessProjectWithMembership, ensureProjectAccess } from "./authz";
import { summarizeProjectBudget } from "../lib/projectBudgetSummary";
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeOptionalEmail = (
  value?: string | null,
  fieldName = "Customer email",
) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) {
    return undefined;
  }
  if (!EMAIL_REGEX.test(normalized)) {
    throw new Error(`${fieldName} is invalid`);
  }
  return normalized;
};

const resolveClientPortalNotificationSettings = (
  value?: {
    sendToOwner?: boolean;
    sendToResponsible?: boolean;
    sendToAdmins?: boolean;
    recipientClerkUserIds?: string[];
  } | null,
) => ({
  recipientClerkUserIds: Array.from(
    new Set(
      (value?.recipientClerkUserIds ?? [])
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  ),
});

const configuredR2PublicBaseUrl = (() => {
  const rawValue = (
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
    process.env.R2_PUBLIC_URL ||
    ""
  ).trim();
  if (!rawValue) {
    return null;
  }
  try {
    return new URL(rawValue);
  } catch {
    return null;
  }
})();

const extractCoverImageStorageKey = (
  coverImageUrl: string,
): string | undefined => {
  const trimmed = coverImageUrl.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith("/")) {
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
    if (
      configuredR2PublicBaseUrl &&
      configuredHost &&
      host === configuredHost
    ) {
      const basePath = configuredR2PublicBaseUrl.pathname.replace(
        /^\/+|\/+$/g,
        "",
      );
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

const resolveCoverImageDisplayUrl = async (
  coverImageUrl?: string,
): Promise<string | undefined> => {
  const trimmed = coverImageUrl?.trim();
  if (!trimmed) {
    return undefined;
  }

  const storageKey = extractCoverImageStorageKey(trimmed);
  if (!storageKey) {
    return trimmed;
  }

  try {
    const signedUrl = await r2.getUrl(storageKey, {
      expiresIn: 60 * 60 * 24 * 7,
    });
    return signedUrl || trimmed;
  } catch {
    return trimmed;
  }
};

const getLatestTimestamp = (...values: Array<number | null | undefined>): number =>
  values.reduce<number>((latest, value) => {
    if (typeof value !== "number") {
      return latest;
    }
    return Math.max(latest, value);
  }, 0);

const updateRecentActivity = (
  recentActivityByProject: Map<string, number>,
  projectId: unknown,
  timestamp: number,
) => {
  if (!projectId || timestamp <= 0) {
    return;
  }

  const projectKey = String(projectId);
  recentActivityByProject.set(
    projectKey,
    Math.max(recentActivityByProject.get(projectKey) || 0, timestamp),
  );
};

const collectRecentProjectActivity = async (
  ctx: any,
  teamId: Id<"teams">,
  projects: Array<Doc<"projects">>,
) => {
  const accessibleProjectIds = new Set(projects.map((project) => String(project._id)));
  const recentActivityByProject = new Map<string, number>();

  for (const project of projects) {
    updateRecentActivity(
      recentActivityByProject,
      project._id,
      getLatestTimestamp((project as { updatedAt?: number }).updatedAt, project._creationTime),
    );
  }

  const teamScopedCollections = await Promise.all([
    ctx.db.query("activityLog").withIndex("by_team", (q: any) => q.eq("teamId", teamId)).collect(),
    ctx.db.query("tasks").withIndex("by_team", (q: any) => q.eq("teamId", teamId)).collect(),
    ctx.db.query("files").withIndex("by_team", (q: any) => q.eq("teamId", teamId)).collect(),
    ctx.db.query("projectPayments").withIndex("by_team", (q: any) => q.eq("teamId", teamId)).collect(),
    ctx.db.query("costEstimations").withIndex("by_team", (q: any) => q.eq("teamId", teamId)).collect(),
    ctx.db.query("surveys").withIndex("by_team", (q: any) => q.eq("teamId", teamId)).collect(),
    ctx.db.query("projectContacts").withIndex("by_team", (q: any) => q.eq("teamId", teamId)).collect(),
    ctx.db.query("notes").withIndex("by_team", (q: any) => q.eq("teamId", teamId)).collect(),
    ctx.db.query("aiGeneratedImages").withIndex("by_team", (q: any) => q.eq("teamId", teamId)).collect(),
  ]);

  for (const collection of teamScopedCollections) {
    for (const item of collection) {
      if (!item.projectId || !accessibleProjectIds.has(String(item.projectId))) {
        continue;
      }

      updateRecentActivity(
        recentActivityByProject,
        item.projectId,
        getLatestTimestamp(
          item.updatedAt,
          item.submittedAt,
          item.assignedAt,
          item.paidAt,
          item.sentAt,
          item.createdAt,
          item._creationTime,
        ),
      );
    }
  }

  const projectScopedCollections = await Promise.all(
    projects.map(async (project) => {
      const [
        shoppingItems,
        shoppingSets,
        shoppingSections,
        laborItems,
        laborSections,
        surveyResponses,
        folders,
      ] = await Promise.all([
        ctx.db.query("shoppingListItems").withIndex("by_project", (q: any) => q.eq("projectId", project._id)).collect(),
        ctx.db.query("shoppingSets").withIndex("by_project", (q: any) => q.eq("projectId", project._id)).collect(),
        ctx.db.query("shoppingListSections").withIndex("by_project", (q: any) => q.eq("projectId", project._id)).collect(),
        ctx.db.query("laborItems").withIndex("by_project", (q: any) => q.eq("projectId", project._id)).collect(),
        ctx.db.query("laborSections").withIndex("by_project", (q: any) => q.eq("projectId", project._id)).collect(),
        ctx.db.query("surveyResponses").withIndex("by_project", (q: any) => q.eq("projectId", project._id)).collect(),
        ctx.db.query("folders").withIndex("by_project", (q: any) => q.eq("projectId", project._id)).collect(),
      ]);

      return {
        projectId: project._id,
        items: [
          ...shoppingItems,
          ...shoppingSets,
          ...shoppingSections,
          ...laborItems,
          ...laborSections,
          ...surveyResponses,
          ...folders,
        ],
      };
    }),
  );

  for (const { projectId, items } of projectScopedCollections) {
    for (const item of items) {
      updateRecentActivity(
        recentActivityByProject,
        projectId,
        getLatestTimestamp(item.updatedAt, item.submittedAt, item.createdAt, item._creationTime),
      );
    }
  }

  return recentActivityByProject;
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
  // Legacy field kept only so older project documents don't block Convex deploys.
  showApprovals: v.optional(v.boolean()),
  showShoppingList: v.optional(v.boolean()),
  allowShoppingItemDecisions: v.optional(v.boolean()),
  allowShoppingItemComments: v.optional(v.boolean()),
  showFiles: v.optional(v.boolean()),
  showMoodboard: v.optional(v.boolean()),
  showSurveys: v.optional(v.boolean()),
  showTasks: v.optional(v.boolean()),
  showLabor: v.optional(v.boolean()),
  showContacts: v.optional(v.boolean()),
  showBudget: v.optional(v.boolean()),
  showPayments: v.optional(v.boolean()),
  showNotes: v.optional(v.boolean()),
  showSupplier: v.optional(v.boolean()),
  showPrice: v.optional(v.boolean()),
};

const defaultClientPanelDisplaySettings = {
  showShoppingList: false,
  allowShoppingItemDecisions: true,
  allowShoppingItemComments: true,
  showFiles: false,
  showMoodboard: false,
  showSurveys: false,
  showTasks: false,
  showLabor: false,
  showContacts: false,
  showBudget: false,
  showPayments: false,
  showNotes: true,
  showSupplier: true,
  showPrice: true,
};

type ClientPanelDisplaySettings = typeof defaultClientPanelDisplaySettings;
type ClientPanelPublishedSnapshot = NonNullable<
  Doc<"projects">["clientPanelPublishedSnapshot"]
>;

const getStoredMoodboardSectionsForPortal = (project: Doc<"projects">) =>
  Array.isArray(project.moodboardSections)
    ? project.moodboardSections
        .map((section) => ({
          id: section.id,
          title: section.title,
          order: section.order,
        }))
        .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
    : [];

const projectTaskStatusSettingsValidator = v.object({
  todo: v.object({ name: v.string(), color: v.string() }),
  in_progress: v.object({ name: v.string(), color: v.string() }),
  review: v.optional(v.object({ name: v.string(), color: v.string() })),
  done: v.object({ name: v.string(), color: v.string() }),
});

const getResolvedClientPanelDisplaySettings = (
  settings?: Partial<ClientPanelDisplaySettings> | null,
): ClientPanelDisplaySettings => ({
  showShoppingList:
    settings?.showShoppingList ??
    defaultClientPanelDisplaySettings.showShoppingList,
  allowShoppingItemDecisions:
    settings?.allowShoppingItemDecisions ??
    defaultClientPanelDisplaySettings.allowShoppingItemDecisions,
  allowShoppingItemComments:
    settings?.allowShoppingItemComments ??
    defaultClientPanelDisplaySettings.allowShoppingItemComments,
  showFiles: settings?.showFiles ?? defaultClientPanelDisplaySettings.showFiles,
  showMoodboard:
    settings?.showMoodboard ?? defaultClientPanelDisplaySettings.showMoodboard,
  showSurveys:
    settings?.showSurveys ?? defaultClientPanelDisplaySettings.showSurveys,
  showTasks: settings?.showTasks ?? defaultClientPanelDisplaySettings.showTasks,
  showLabor: settings?.showLabor ?? defaultClientPanelDisplaySettings.showLabor,
  showContacts:
    settings?.showContacts ?? defaultClientPanelDisplaySettings.showContacts,
  showBudget:
    settings?.showBudget ?? defaultClientPanelDisplaySettings.showBudget,
  showPayments:
    settings?.showPayments ?? defaultClientPanelDisplaySettings.showPayments,
  showNotes: settings?.showNotes ?? defaultClientPanelDisplaySettings.showNotes,
  showSupplier:
    settings?.showSupplier ?? defaultClientPanelDisplaySettings.showSupplier,
  showPrice: settings?.showPrice ?? defaultClientPanelDisplaySettings.showPrice,
});

const buildClientPanelPublishedSnapshot = async (
  ctx: any,
  project: Doc<"projects">,
  settings: ClientPanelDisplaySettings,
): Promise<ClientPanelPublishedSnapshot> => {
  const tasks = settings.showTasks
    ? await ctx.db
        .query("tasks")
        .withIndex("by_project", (q: any) => q.eq("projectId", project._id))
        .collect()
    : [];
  const laborItems = settings.showLabor
    ? await ctx.db
        .query("laborItems")
        .withIndex("by_project", (q: any) => q.eq("projectId", project._id))
        .collect()
    : [];
  const laborSections = settings.showLabor
    ? await ctx.db
        .query("laborSections")
        .withIndex("by_project", (q: any) => q.eq("projectId", project._id))
        .collect()
    : [];
  const projectContactLinks = settings.showContacts
    ? await ctx.db
        .query("projectContacts")
        .withIndex("by_project", (q: any) => q.eq("projectId", project._id))
        .filter((q: any) => q.eq(q.field("isActive"), true))
        .collect()
    : [];
  const contacts = settings.showContacts
    ? (
        await Promise.all(
          projectContactLinks.map(async (link: Doc<"projectContacts">) => {
            const contact = await ctx.db.get(link.contactId);
            if (!contact || !contact.isActive) {
              return null;
            }

            return {
              _id: contact._id,
              name: contact.name,
              companyName: contact.companyName,
              email: contact.email,
              phone: contact.phone,
              type: contact.type,
              website: contact.website,
              projectRole: link.role,
              projectNotes: link.notes,
            };
          }),
        )
      ).filter(Boolean)
    : [];
  const payments = settings.showPayments
    ? await ctx.db
        .query("projectPayments")
        .withIndex("by_project_and_order", (q: any) =>
          q.eq("projectId", project._id),
        )
        .order("asc")
        .collect()
    : [];
  const moodboardSections = settings.showMoodboard
    ? getStoredMoodboardSectionsForPortal(project)
    : [];
  const estimations = settings.showBudget
    ? await ctx.db
        .query("costEstimations")
        .withIndex("by_project", (q: any) => q.eq("projectId", project._id))
        .collect()
    : [];
  const tasksForPortal: ClientPanelPublishedSnapshot["tasks"] = tasks
    .map((task: Doc<"tasks">) => ({
      _id: task._id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      startDate: task.startDate,
      endDate: task.endDate,
    }))
    .sort(
      (
        a: ClientPanelPublishedSnapshot["tasks"][number],
        b: ClientPanelPublishedSnapshot["tasks"][number],
      ) => {
        const aDate = a.endDate || a.startDate || 0;
        const bDate = b.endDate || b.startDate || 0;
        if (aDate !== bDate) return aDate - bDate;
        return a.title.localeCompare(b.title);
      },
    );

  const laborForPortal: ClientPanelPublishedSnapshot["labor"] = laborItems
    .map((item: Doc<"laborItems">) => ({
      _id: item._id,
      name: item.name,
      notes: item.notes,
      sectionId: item.sectionId,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      assignedTo: item.assignedTo,
      referenceLink: item.referenceLink,
      attachmentFileId: item.attachmentFileId,
      startDate: item.startDate,
      endDate: item.endDate,
      customerDecision: item.customerDecision,
      customerDecisionComment: item.customerDecisionComment,
      customerDecisionUpdatedAt: item.customerDecisionUpdatedAt,
      customerDecisionByName: item.customerDecisionByName,
    }))
    .sort(
      (
        a: ClientPanelPublishedSnapshot["labor"][number],
        b: ClientPanelPublishedSnapshot["labor"][number],
      ) => {
        const aDate = a.startDate || a.endDate || 0;
        const bDate = b.startDate || b.endDate || 0;
        if (aDate !== bDate) return aDate - bDate;
        return a.name.localeCompare(b.name);
      },
    );

  const laborSectionsForPortal: ClientPanelPublishedSnapshot["laborSections"] =
    laborSections
      .map((section: Doc<"laborSections">) => ({
        _id: section._id,
        name: section.name,
        order: section.order,
      }))
      .sort(
        (
          a: ClientPanelPublishedSnapshot["laborSections"][number],
          b: ClientPanelPublishedSnapshot["laborSections"][number],
        ) => a.order - b.order,
      );

  const contactsForPortal: ClientPanelPublishedSnapshot["contacts"] = contacts
    .filter(
      (contact): contact is NonNullable<typeof contact> => contact !== null,
    )
    .sort(
      (
        a: ClientPanelPublishedSnapshot["contacts"][number],
        b: ClientPanelPublishedSnapshot["contacts"][number],
      ) => a.name.localeCompare(b.name),
    );

  const paymentsForPortal: ClientPanelPublishedSnapshot["payments"] = payments
    .filter(
      (payment: Doc<"projectPayments">) =>
        payment.status !== "void" && payment.status !== "draft",
    )
    .map((payment: Doc<"projectPayments">) => ({
      _id: payment._id,
      title: payment.title,
      description: payment.description,
      amount: payment.amount,
      currency: payment.currency,
      dueDate: payment.dueDate,
      status: payment.status,
      invoiceNumber: payment.invoiceNumber || payment.stripeInvoiceNumber,
      hasInvoicePdf: !!payment.invoicePdfStorageKey,
      paymentReference: payment.paymentReference,
      bankAccountHolder: payment.invoiceSellerSnapshot?.bankAccountHolder,
      bankName: payment.invoiceSellerSnapshot?.bankName,
      bankAccountNumber: payment.invoiceSellerSnapshot?.bankAccountNumber,
      bankSwift: payment.invoiceSellerSnapshot?.bankSwift,
      paymentInstructions: payment.invoiceSellerSnapshot?.paymentInstructions,
      hasOnlinePaymentLink: Boolean(
        payment.stripeHostedInvoiceUrl || payment.stripeInvoiceId,
      ),
      canPayOnline:
        payment.status === "open" &&
        Boolean(payment.stripeHostedInvoiceUrl || payment.stripeInvoiceId),
      paidAt: payment.paidAt,
      isOverdue:
        payment.status === "open" &&
        typeof payment.dueDate === "number" &&
        payment.dueDate < Date.now(),
    }));

  const budgetSummary = settings.showBudget
    ? summarizeProjectBudget(
        {
          project: {
            _id: String(project._id),
            budget: project.budget,
            currency: project.currency,
          },
          shoppingItems: await ctx.db
            .query("shoppingListItems")
            .withIndex("by_project", (q: any) => q.eq("projectId", project._id))
            .collect(),
          laborItems,
          estimations,
          payments,
        },
        Date.now(),
      )
    : undefined;

  return {
    tasks: tasksForPortal,
    labor: laborForPortal,
    laborSections: laborSectionsForPortal,
    contacts: contactsForPortal,
    payments: paymentsForPortal,
    moodboardSections,
    ...(budgetSummary ? { budgetSummary } : {}),
  };
};

const getProjectManagerMembership = async (
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

  if (!teamMember) {
    throw new Error("User is not a team member");
  }

  if (teamMember.role === "admin") {
    return { project, teamMember };
  }

  if (teamMember.role === "member") {
    if (Array.isArray(teamMember.projectIds)) {
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
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject),
      )
      .unique();

    if (
      !membership ||
      (membership.role !== "admin" && membership.role !== "member")
    ) {
      throw new Error("User is not a member of this team");
    }

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    return projects
      .filter((project) => canAccessProjectWithMembership(membership, project._id))
      .sort((a, b) => b._creationTime - a._creationTime);
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
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject),
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
        if (Array.isArray(membership.projectIds)) {
          const projectPromises = membership.projectIds.map((id) =>
            ctx.db.get(id),
          );
          const projectResults = await Promise.all(projectPromises);
          projects = projectResults.filter((p) => p !== null);
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

    const recentActivityByProject = await collectRecentProjectActivity(
      ctx,
      team._id,
      projects,
    );

    const projectsWithTasks = await Promise.all(
      projects.map(async (project) => {
        const stats = taskStatsByProject.get(project._id) || {
          taskCount: 0,
          completedTasks: 0,
        };
        const coverImageDisplayUrl = await resolveCoverImageDisplayUrl(
          project.coverImageUrl,
        );

        return {
          ...project,
          coverImageDisplayUrl,
          taskCount: stats.taskCount,
          completedTasks: stats.completedTasks,
          recentActivityAt: recentActivityByProject.get(String(project._id)),
        };
      }),
    );

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
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject),
      )
      .unique();

    if (
      !teamMember ||
      !teamMember.isActive ||
      (teamMember.role !== "admin" && teamMember.role !== "member")
    ) {
      return [];
    }

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    return projects.filter((project) =>
      canAccessProjectWithMembership(teamMember, project._id),
    );
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
    customerEmail: v.optional(v.string()),
    location: v.optional(v.string()),
    budget: v.optional(v.number()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    currency: v.optional(
      v.union(
        v.literal("USD"),
        v.literal("EUR"),
        v.literal("PLN"),
        v.literal("GBP"),
        v.literal("CAD"),
        v.literal("AUD"),
        v.literal("JPY"),
        v.literal("CHF"),
        v.literal("SEK"),
        v.literal("NOK"),
        v.literal("DKK"),
        v.literal("CZK"),
        v.literal("HUF"),
        v.literal("CNY"),
        v.literal("INR"),
        v.literal("BRL"),
        v.literal("MXN"),
        v.literal("KRW"),
        v.literal("SGD"),
        v.literal("HKD"),
      ),
    ),
    measurements: v.optional(
      v.union(v.literal("metric"), v.literal("imperial")),
    ),
    taxEnabled: v.optional(v.boolean()),
    taxRate: v.optional(v.number()),
    projectMemberClerkUserIds: v.optional(v.array(v.string())),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    if (
      typeof args.startDate === "number" &&
      typeof args.endDate === "number" &&
      args.endDate < args.startDate
    ) {
      throw new Error("Project end date cannot be earlier than the start date");
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
        .withIndex("by_team_and_slug", (q) =>
          q.eq("teamId", team._id).eq("slug", slug),
        )
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
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject),
      )
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
    const normalizedCustomerEmail = normalizeOptionalEmail(args.customerEmail);
    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      coverImageUrl: normalizedCoverImageUrl || undefined,
      teamId: args.teamId,
      slug: slug,
      projectId: nextProjectId,
      status: "planning",
      customer: args.customer,
      customerEmail: normalizedCustomerEmail,
      location: args.location,
      budget: args.budget,
      currency: args.currency || team.currency || "PLN",
      measurements: args.measurements || "metric",
      startDate: args.startDate,
      endDate: args.endDate,
      createdBy: identity.subject,
      responsibleClerkUserId: identity.subject,
      clientPortalNotificationSettings: {
        recipientClerkUserIds: [identity.subject],
      },
      assignedTo: [],
      taskStatusSettings: defaultStatusSettings,
      aiAutoConfirmCrud: false,
    });

    if (Array.isArray(args.projectMemberClerkUserIds)) {
      const selectedMemberIds = new Set(
        args.projectMemberClerkUserIds
          .map((clerkUserId) => clerkUserId.trim())
          .filter((clerkUserId) => clerkUserId.length > 0),
      );

      const teamMembers = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      const teamProjects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      const existingProjectIds = teamProjects
        .map((project) => project._id)
        .filter((id) => id !== projectId);

      for (const member of teamMembers) {
        if (member.role !== "member") {
          continue;
        }

        if (selectedMemberIds.has(member.clerkUserId)) {
          if (
            Array.isArray(member.projectIds) &&
            !member.projectIds.includes(projectId)
          ) {
            await ctx.db.patch(member._id, {
              projectIds: [...member.projectIds, projectId],
            });
          }
          continue;
        }

        await ctx.db.patch(member._id, {
          projectIds:
            Array.isArray(member.projectIds)
              ? member.projectIds.filter((id) => id !== projectId)
              : existingProjectIds,
        });
      }
    }

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const team = await ctx.db
      .query("teams")
      .withIndex("by_slug", (q) => q.eq("slug", args.teamSlug))
      .unique();
    if (!team) return null;

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .unique();

    if (!membership) {
      return null;
    }

    const project = await ctx.db
      .query("projects")
      .withIndex("by_team_and_slug", (q) =>
        q.eq("teamId", team._id).eq("slug", args.projectSlug),
      )
      .unique();

    if (!project) {
      return null;
    }

    return canAccessProjectWithMembership(membership, project._id)
      ? project
      : null;
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
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();
    if (!team) return null;

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (
      !membership ||
      (membership.role !== "admin" && membership.role !== "member")
    ) {
      return null;
    }

    const project = await ctx.db
      .query("projects")
      .withIndex("by_team_and_slug", (q) =>
        q.eq("teamId", team._id).eq("slug", args.projectSlug),
      )
      .unique();

    if (!project) return null;

    if (!canAccessProjectWithMembership(membership, project._id)) {
      return null;
    }

    const coverImageDisplayUrl = await resolveCoverImageDisplayUrl(
      project.coverImageUrl,
    );
    return {
      ...project,
      coverImageDisplayUrl,
    };
  },
});

export const markClientNotificationsRead = mutation({
  args: {
    projectId: v.id("projects"),
    lastReadAt: v.number(),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { project } = await getProjectManagerMembership(
      ctx,
      args.projectId,
      identity.subject,
    );
    const normalizedLastReadAt = Number.isFinite(args.lastReadAt)
      ? args.lastReadAt
      : Date.now();
    const existingReadState = await ctx.db
      .query("clientNotificationReads")
      .withIndex("by_project_and_user", (q) =>
        q.eq("projectId", args.projectId).eq("clerkUserId", identity.subject),
      )
      .unique();
    const currentLastReadAt = Math.max(
      project.clientNotificationsLastReadAt ?? 0,
      existingReadState?.lastReadAt ?? 0,
    );

    if (normalizedLastReadAt <= currentLastReadAt) {
      return { success: true, lastReadAt: currentLastReadAt };
    }

    if (existingReadState) {
      await ctx.db.patch(existingReadState._id, {
        lastReadAt: normalizedLastReadAt,
      });
    } else {
      await ctx.db.insert("clientNotificationReads", {
        projectId: args.projectId,
        teamId: project.teamId,
        clerkUserId: identity.subject,
        lastReadAt: normalizedLastReadAt,
      });
    }

    return { success: true, lastReadAt: normalizedLastReadAt };
  },
});

export const getMyClientNotificationsReadState = query({
  args: {
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { lastReadAt: 0 };
    }

    const { project } = await getProjectManagerMembership(
      ctx,
      args.projectId,
      identity.subject,
    );
    const existingReadState = await ctx.db
      .query("clientNotificationReads")
      .withIndex("by_project_and_user", (q) =>
        q.eq("projectId", args.projectId).eq("clerkUserId", identity.subject),
      )
      .unique();

    return {
      lastReadAt: Math.max(
        project.clientNotificationsLastReadAt ?? 0,
        existingReadState?.lastReadAt ?? 0,
      ),
    };
  },
});

export const getProject = query({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    let project: Doc<"projects">;
    try {
      ({ project } = await ensureProjectAccess(ctx, args.projectId));
    } catch {
      return null;
    }
    const team = await ctx.db.get(project.teamId);
    if (!team) {
      return { ...project, teamName: "Unknown Team" };
    }
    return { ...project, teamName: team.name };
  },
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

export const updateProject = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("planning"),
        v.literal("active"),
        v.literal("on_hold"),
        v.literal("completed"),
        v.literal("cancelled"),
      ),
    ),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    budget: v.optional(v.number()),
    customer: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    location: v.optional(v.string()),
    currency: v.optional(
      v.union(
        v.literal("USD"),
        v.literal("EUR"),
        v.literal("PLN"),
        v.literal("GBP"),
        v.literal("CAD"),
        v.literal("AUD"),
        v.literal("JPY"),
        v.literal("CHF"),
        v.literal("SEK"),
        v.literal("NOK"),
        v.literal("DKK"),
        v.literal("CZK"),
        v.literal("HUF"),
        v.literal("CNY"),
        v.literal("INR"),
        v.literal("BRL"),
        v.literal("MXN"),
        v.literal("KRW"),
        v.literal("SGD"),
        v.literal("HKD"),
      ),
    ),
    measurements: v.optional(
      v.union(v.literal("metric"), v.literal("imperial")),
    ),
    taxEnabled: v.optional(v.boolean()),
    taxRate: v.optional(v.number()),
    responsibleClerkUserId: v.optional(v.string()),
    clientPortalNotificationSettings: v.optional(
      v.object({
        sendToOwner: v.optional(v.boolean()),
        sendToResponsible: v.optional(v.boolean()),
        sendToAdmins: v.optional(v.boolean()),
        recipientClerkUserIds: v.optional(v.array(v.string())),
      }),
    ),
    taskStatusSettings: v.optional(projectTaskStatusSettingsValidator),
    aiAutoConfirmCrud: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const {
      projectId,
      name,
      coverImageUrl,
      taxEnabled: _ignoredTaxEnabled,
      taxRate: _ignoredTaxRate,
      responsibleClerkUserId,
      customerEmail,
      clientPortalNotificationSettings,
      ...rest
    } = args;

    const existingProject = await ctx.db.get(projectId);
    if (!existingProject) {
      throw new Error("Project not found");
    }

    await getProjectManagerMembership(ctx, projectId, identity.subject);

    const coverImageProvided = Object.prototype.hasOwnProperty.call(
      args,
      "coverImageUrl",
    );
    const normalizedCoverImageUrl = coverImageProvided
      ? coverImageUrl?.trim()
      : undefined;
    const coverImagePatch = coverImageProvided
      ? { coverImageUrl: normalizedCoverImageUrl || undefined }
      : {};
    const customerEmailProvided = Object.prototype.hasOwnProperty.call(
      args,
      "customerEmail",
    );
    const customerEmailPatch = customerEmailProvided
      ? {
          customerEmail: normalizeOptionalEmail(customerEmail),
        }
      : {};
    const responsibleProvided = Object.prototype.hasOwnProperty.call(
      args,
      "responsibleClerkUserId",
    );
    let responsiblePatch: { responsibleClerkUserId?: string } = {};
    const clientPortalSettingsProvided = Object.prototype.hasOwnProperty.call(
      args,
      "clientPortalNotificationSettings",
    );
    let clientPortalSettingsPatch: {
      clientPortalNotificationSettings?: { recipientClerkUserIds: string[] };
    } = {};

    if (responsibleProvided) {
      const normalizedResponsibleUserId = (responsibleClerkUserId || "").trim();
      const effectiveResponsibleUserId =
        normalizedResponsibleUserId || existingProject.createdBy;

      const responsibleMember = await ctx.db
        .query("teamMembers")
        .withIndex("by_team_and_user", (q) =>
          q
            .eq("teamId", existingProject.teamId)
            .eq("clerkUserId", effectiveResponsibleUserId),
        )
        .unique();

      if (
        !responsibleMember ||
        !responsibleMember.isActive ||
        (responsibleMember.role !== "admin" &&
          responsibleMember.role !== "member")
      ) {
        throw new Error(
          "Selected responsible person must be an active team member",
        );
      }

      responsiblePatch = { responsibleClerkUserId: effectiveResponsibleUserId };
    }

    if (clientPortalSettingsProvided) {
      const normalizedRecipientIds = resolveClientPortalNotificationSettings(
        clientPortalNotificationSettings,
      ).recipientClerkUserIds;

      let resolvedRecipientIds = normalizedRecipientIds;
      const teamMembers = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", existingProject.teamId))
        .collect();
      const activeMemberIds = new Set(
        teamMembers
          .filter(
            (member) =>
              member.isActive &&
              (member.role === "admin" || member.role === "member"),
          )
          .map((member) => member.clerkUserId),
      );

      if (
        resolvedRecipientIds.some((clerkUserId) => !activeMemberIds.has(clerkUserId))
      ) {
        throw new Error(
          "Selected digest recipients must be active team members",
        );
      }

      if (resolvedRecipientIds.length === 0) {
        const settings = clientPortalNotificationSettings ?? {};
        const activeMembers = teamMembers.filter(
          (member) =>
            member.isActive &&
            (member.role === "admin" || member.role === "member"),
        );
        const effectiveResponsibleClerkUserId =
          responsiblePatch.responsibleClerkUserId ??
          existingProject.responsibleClerkUserId ??
          existingProject.createdBy;

        const legacyRecipientIds: string[] = [];
        if (settings.sendToOwner ?? true) {
          legacyRecipientIds.push(existingProject.createdBy);
        }
        if (settings.sendToResponsible ?? true) {
          legacyRecipientIds.push(effectiveResponsibleClerkUserId);
        }
        if (settings.sendToAdmins ?? false) {
          legacyRecipientIds.push(
            ...activeMembers
              .filter((member) => member.role === "admin")
              .map((member) => member.clerkUserId),
          );
        }

        resolvedRecipientIds = Array.from(
          new Set(
            legacyRecipientIds
              .map((item) => item.trim())
              .filter((item) => item.length > 0),
          ),
        );
      }

      clientPortalSettingsPatch = {
        clientPortalNotificationSettings: {
          recipientClerkUserIds: resolvedRecipientIds,
        },
      };
    }

    const effectiveStartDate =
      Object.prototype.hasOwnProperty.call(args, "startDate")
        ? args.startDate
        : existingProject.startDate;
    const effectiveEndDate =
      Object.prototype.hasOwnProperty.call(args, "endDate")
        ? args.endDate
        : existingProject.endDate;

    if (
      typeof effectiveStartDate === "number" &&
      typeof effectiveEndDate === "number" &&
      effectiveEndDate < effectiveStartDate
    ) {
      throw new Error("Project end date cannot be earlier than the start date");
    }

    const currencyChanged =
      typeof rest.currency === "string" &&
      rest.currency !== existingProject.currency;

    if (name && name !== existingProject.name) {
      const baseSlug = generateSlug(name);
      let slug = baseSlug;
      let counter = 1;

      let existing;
      do {
        existing = await ctx.db
          .query("projects")
          .withIndex("by_team_and_slug", (q) =>
            q.eq("teamId", existingProject.teamId).eq("slug", slug),
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
        ...coverImagePatch,
        ...customerEmailPatch,
        ...responsiblePatch,
        ...clientPortalSettingsPatch,
        ...rest,
      });

      if (currencyChanged) {
        const draftPayments = await ctx.db
          .query("projectPayments")
          .withIndex("by_project", (q) => q.eq("projectId", projectId))
          .filter((q) => q.eq(q.field("status"), "draft"))
          .collect();

        for (const payment of draftPayments) {
          await ctx.db.patch(payment._id, {
            currency: rest.currency,
            updatedAt: Date.now(),
          });
        }
      }

      return { slug };
    } else {
      await ctx.db.patch(projectId, {
        ...coverImagePatch,
        ...customerEmailPatch,
        ...responsiblePatch,
        ...clientPortalSettingsPatch,
        ...rest,
      });

      if (currencyChanged) {
        const draftPayments = await ctx.db
          .query("projectPayments")
          .withIndex("by_project", (q) => q.eq("projectId", projectId))
          .filter((q) => q.eq(q.field("status"), "draft"))
          .collect();

        for (const payment of draftPayments) {
          await ctx.db.patch(payment._id, {
            currency: rest.currency,
            updatedAt: Date.now(),
          });
        }
      }

      return { slug: existingProject.slug };
    }
  },
});

export const listTeamProjects = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .unique();

    if (!membership) {
      return [];
    }

    let projects: Doc<"projects">[] = [];

    if (membership.role === "admin") {
      projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
        .collect();
    } else if (membership.role === "member") {
      if (Array.isArray(membership.projectIds)) {
        const memberProjects = await Promise.all(
          membership.projectIds.map((id) => ctx.db.get(id)),
        );
        projects = memberProjects.filter(
          (project): project is Doc<"projects"> =>
            project !== null && project.teamId === args.teamId,
        );
      } else {
        projects = await ctx.db
          .query("projects")
          .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
          .collect();
      }
    }

    const projectsWithTaskCounts = await Promise.all(
      projects.map(async (project) => {
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        const completedTasks = tasks.filter(
          (task) => task.status === "done",
        ).length;
        return {
          ...project,
          taskCount: tasks.length,
          completedTasks: completedTasks,
        };
      }),
    );

    return projectsWithTaskCounts;
  },
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
        q.eq("teamId", args.teamId).eq("clerkUserId", clerkUserId),
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
      if (Array.isArray(membership.projectIds)) {
        const memberProjects = await Promise.all(
          membership.projectIds.map((id) => ctx.db.get(id)),
        );
        projects = memberProjects.filter(
          (p): p is Doc<"projects"> => p !== null,
        );
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
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .unique();

    if (!teamMember) {
      return false;
    }

    return canAccessProjectWithMembership(teamMember, args.projectId)
      ? teamMember
      : false;
  },
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

    const { project } = await getProjectManagerMembership(
      ctx,
      args.projectId,
      identity.subject,
    );

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

    const { project } = await getProjectManagerMembership(
      ctx,
      args.projectId,
      identity.subject,
    );

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
    const productFeedback: Array<{
      sourceItemId: Id<"shoppingListItems">;
      itemName: string;
      sectionName?: string;
      decision: null;
      comment: null;
      updatedAt: null;
    }> = [];
    const feedbackSummary = {
      acceptedCount: 0,
      rejectedCount: 0,
      commentedCount: 0,
    };
    return {
      accessToken: project.clientPanelAccessToken || null,
      settings: getResolvedClientPanelDisplaySettings(
        project.clientPanelPublishedSettings as Partial<ClientPanelDisplaySettings> | null,
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

    const { project } = await getProjectManagerMembership(
      ctx,
      args.projectId,
      identity.subject,
    );

    const sections = await ctx.db
      .query("shoppingListSections")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("asc")
      .collect();

    const sectionMetaById = new Map(
      sections.map((section) => [
        String(section._id),
        { name: section.name, order: section.order },
      ]),
    );

    const items = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const sets = await ctx.db
      .query("shoppingSets")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const setById = new Map(sets.map((set) => [String(set._id), set]));

    const existingSnapshotItems = await ctx.db
      .query("clientPanelItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const existingSnapshotItemBySourceId = new Map(
      existingSnapshotItems.map((snapshotItem) => [
        String(snapshotItem.sourceItemId),
        snapshotItem,
      ]),
    );
    await Promise.all(
      existingSnapshotItems.map((item) => ctx.db.delete(item._id)),
    );

    const existingSnapshotSections = await ctx.db
      .query("clientPanelSections")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    await Promise.all(
      existingSnapshotSections.map((section) => ctx.db.delete(section._id)),
    );

    const existingSnapshotFiles = await ctx.db
      .query("clientPanelFiles")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    await Promise.all(
      existingSnapshotFiles.map((file) => ctx.db.delete(file._id)),
    );

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
      const existingSnapshotItem = existingSnapshotItemBySourceId.get(
        String(item._id),
      );
      const set = item.setId ? setById.get(String(item.setId)) : null;

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
        setId: item.setId || null,
        setTitle: set?.title,
        setType: set?.setType ?? null,
        setSelectionMode: set?.selectionMode ?? null,
        setPricingMode: set?.pricingMode ?? null,
        setStatus: set?.status ?? null,
        setNotes: set?.notes ?? null,
        setResolvedSourceItemIds: set?.resolvedItemIds ?? [],
        setPreferredSourceItemIds: set?.preferredItemIds ?? [],
      });
    }

    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    // Moodboard files are a dedicated portal section, so include them in the snapshot
    // even when they were uploaded before per-file visibility was introduced.
    const selectedFiles = files.filter(
      (file) => file.showInClientPortal === true || !!file.moodboardSection,
    );
    const folderNameById = new Map<string, string>();
    const folderIds = [
      ...new Set(
        selectedFiles
          .map((file) => file.folderId)
          .filter((folderId): folderId is Id<"folders"> => !!folderId),
      ),
    ];
    const folderRecords = await Promise.all(
      folderIds.map((folderId) => ctx.db.get(folderId)),
    );
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
        folderName: file.folderId
          ? folderNameById.get(String(file.folderId))
          : undefined,
        moodboardSection: file.moodboardSection,
        moodboardOrder: file.moodboardOrder,
        uploadedAt: file._creationTime,
      });
    }

    const resolvedSettings = getResolvedClientPanelDisplaySettings(
      args.settings,
    );
    const publishedSnapshot = await buildClientPanelPublishedSnapshot(
      ctx,
      project,
      resolvedSettings,
    );
    const version = (project.clientPanelDataVersion || 0) + 1;
    const updatedAt = Date.now();
    const token =
      project.clientPanelAccessToken || generateClientPanelAccessToken();

    await ctx.db.patch(args.projectId, {
      clientPanelAccessToken: token,
      clientPanelPublishedSettings: resolvedSettings,
      clientPanelDataVersion: version,
      clientPanelDataUpdatedAt: updatedAt,
      clientPanelPublishedSnapshot: publishedSnapshot,
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
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject),
      )
      .unique();

    if (!teamMember || teamMember.role !== "admin") {
      throw new Error(
        "Insufficient permissions to delete this project. Only admin can delete projects.",
      );
    }

    // Delete all tasks associated with the project
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const taskDeletionPromises = tasks.map((task) => ctx.db.delete(task._id));
    await Promise.all(taskDeletionPromises);

    // Delete all comments related to the project or its tasks
    const projectComments = await ctx.db
      .query("comments")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const taskComments = await Promise.all(
      tasks.map((task) =>
        ctx.db
          .query("comments")
          .withIndex("by_task", (q) => q.eq("taskId", task._id))
          .collect(),
      ),
    ).then((results) => results.flat());

    const allComments = [...projectComments, ...taskComments];
    const commentDeletionPromises = allComments.map((comment) =>
      ctx.db.delete(comment._id),
    );
    await Promise.all(commentDeletionPromises);

    // Delete all folders related to the project
    const projectFolders = await ctx.db
      .query("folders")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const folderDeletionPromises = projectFolders.map((folder) =>
      ctx.db.delete(folder._id),
    );
    await Promise.all(folderDeletionPromises);

    // Delete all shopping list sections and items for this project
    const shoppingListSections = await ctx.db
      .query("shoppingListSections")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const shoppingListItems = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const shoppingSectionDeletionPromises = shoppingListSections.map(
      (section) => ctx.db.delete(section._id),
    );
    const shoppingItemDeletionPromises = shoppingListItems.map((item) =>
      ctx.db.delete(item._id),
    );

    await Promise.all([
      ...shoppingSectionDeletionPromises,
      ...shoppingItemDeletionPromises,
    ]);

    // Finally, delete the project itself
    await ctx.db.delete(args.projectId);

    return { success: true };
  },
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
            (!Array.isArray(membership.projectIds) ||
              membership.projectIds.includes(args.projectId)))),
    );

    if (!hasAccess) {
      throw new Error("You don't have permission to update these settings.");
    }

    await ctx.db.patch(args.projectId, {
      taskStatusSettings: args.settings,
    });

    return { success: true };
  },
});
