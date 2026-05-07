import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { ensureProjectAccess, ensureTeamAccess } from "./authz";
import { resolveOrganizationTaxSettings } from "../lib/organizationTax";
const internalAny = require("./_generated/api").internal as any;
const r2 = new R2(components.r2);
const normalizeSectionKey = (name: string) => name.trim().toLocaleLowerCase();

const resolveStoredFileUrl = async (
  storageId: string,
  options?: { expiresIn?: number },
) => {
  if (storageId.startsWith("/") || /^https?:\/\//i.test(storageId)) {
    return storageId;
  }

  return await r2.getUrl(storageId, options);
};

const sortPortalMoodboardFiles = <
  T extends { moodboardOrder?: number; uploadedAt: number; name?: string },
>(
  files: T[],
) =>
  [...files].sort(
    (a, b) =>
      (a.moodboardOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.moodboardOrder ?? Number.MAX_SAFE_INTEGER) ||
      a.uploadedAt - b.uploadedAt ||
      (a.name ?? "").localeCompare(b.name ?? ""),
  );

const priceTaxModeValidator = v.union(
  v.literal("unspecified"),
  v.literal("net"),
  v.literal("gross"),
  v.literal("exempt"),
);

const priceTaxRateSnapshotValidator = v.object({
  id: v.optional(v.string()),
  name: v.string(),
  rate: v.number(),
});

const getClientPortalActorName = (rawName?: string | null) => {
  const trimmed = typeof rawName === "string" ? rawName.trim() : "";
  return trimmed.length > 0 ? trimmed : "Client (portal)";
};

const normalizeClientPortalComment = (rawComment?: string | null) => {
  const trimmed = typeof rawComment === "string" ? rawComment.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeIdList = (value?: readonly string[] | null) =>
  Array.from(new Set((value ?? []).map((entry) => String(entry))));

const stableStringify = (value: unknown): string => {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${key}:${stableStringify(entryValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
};

const logClientPortalShoppingActivity = async (
  ctx: any,
  project: { _id: any; teamId: any },
  actionType: string,
  entityId: string,
  details: Record<string, unknown>
) => {
  const recentActivities = await ctx.db
    .query("activityLog")
    .withIndex("by_entity", (q: any) => q.eq("entityId", entityId).eq("entityType", "shopping"))
    .order("desc")
    .take(10);
  const normalizedDetails = stableStringify(details);
  const isDuplicateRecentActivity = recentActivities.some((activity: any) => {
    if (
      activity.projectId !== project._id ||
      activity.actionType !== actionType ||
      typeof activity._creationTime !== "number"
    ) {
      return false;
    }

    if (Math.abs(Date.now() - activity._creationTime) > 5_000) {
      return false;
    }

    return stableStringify((activity.details ?? {}) as Record<string, unknown>) === normalizedDetails;
  });

  if (isDuplicateRecentActivity) {
    return;
  }

  await ctx.db.insert("activityLog", {
    teamId: project.teamId,
    projectId: project._id,
    userId: `client-portal:${project._id}`,
    actionType,
    details,
    entityId,
    entityType: "shopping",
  });
};

const ensureShoppingSectionAccess = async (
  ctx: any,
  sectionId: Id<"shoppingListSections">,
  actorClerkUserId?: string,
) => {
  const section = await ctx.db.get(sectionId);
  if (!section) {
    throw new Error("Section not found");
  }

  await ensureProjectAccess(ctx, section.projectId, actorClerkUserId);
  return section;
};

const ensureShoppingSetAccess = async (
  ctx: any,
  setId: Id<"shoppingSets">,
  actorClerkUserId?: string,
) => {
  const set = await ctx.db.get(setId);
  if (!set) {
    throw new Error("Set not found");
  }

  await ensureProjectAccess(ctx, set.projectId, actorClerkUserId);
  return set;
};

const ensureShoppingItemAccess = async (
  ctx: any,
  itemId: Id<"shoppingListItems">,
  actorClerkUserId?: string,
) => {
  const item = await ctx.db.get(itemId);
  if (!item) {
    throw new Error("Item not found");
  }

  await ensureProjectAccess(ctx, item.projectId, actorClerkUserId);
  return item;
};

const ensureSectionBelongsToProject = async (
  ctx: any,
  sectionId: Id<"shoppingListSections"> | null | undefined,
  projectId: Id<"projects">,
) => {
  if (!sectionId) {
    return null;
  }

  const section = await ctx.db.get(sectionId);
  if (!section || section.projectId !== projectId) {
    throw new Error("Shopping section not found in this project");
  }

  return section;
};

const ensureSetBelongsToProject = async (
  ctx: any,
  setId: Id<"shoppingSets"> | null | undefined,
  projectId: Id<"projects">,
) => {
  if (!setId) {
    return null;
  }

  const set = await ctx.db.get(setId);
  if (!set || set.projectId !== projectId) {
    throw new Error("Shopping set not found in this project");
  }

  return set;
};

// ====== SHOPPING LIST SECTIONS ======

export const getShoppingListSections = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await ensureProjectAccess(ctx, args.projectId);
    return await ctx.db
      .query("shoppingListSections")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("asc")
      .collect();
  },
});

export const getShoppingListSection = query({
  args: { sectionId: v.id("shoppingListSections") },
  handler: async (ctx, args) => {
    return await ensureShoppingSectionAccess(ctx, args.sectionId);
  },
});

export const listShoppingListSections = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await ensureProjectAccess(ctx, args.projectId);
    return await ctx.db
      .query("shoppingListSections")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("asc")
      .collect();
  },
});

export const createShoppingListSection = mutation({
  args: {
    name: v.string(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const { project, clerkUserId } = await ensureProjectAccess(ctx, args.projectId);

    const normalizedName = args.name.trim();
    if (!normalizedName) throw new Error("Section name is required");

    const existingSections = await ctx.db
      .query("shoppingListSections")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const existingSection = existingSections.find(
      (section) => normalizeSectionKey(section.name) === normalizeSectionKey(normalizedName),
    );
    if (existingSection) {
      return existingSection._id;
    }

    return await ctx.db.insert("shoppingListSections", {
      name: normalizedName,
      projectId: args.projectId,
      teamId: project.teamId,
      order: existingSections.length,
      createdBy: clerkUserId,
    });
  },
});

export const updateShoppingListSection = mutation({
  args: {
    sectionId: v.id("shoppingListSections"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const section = await ensureShoppingSectionAccess(ctx, args.sectionId);

    const normalizedName = args.name.trim();
    if (!normalizedName) throw new Error("Section name is required");

    const projectSections = await ctx.db
      .query("shoppingListSections")
      .withIndex("by_project", (q) => q.eq("projectId", section.projectId))
      .collect();
    const duplicateSection = projectSections.find(
      (projectSection) =>
        projectSection._id !== args.sectionId &&
        normalizeSectionKey(projectSection.name) === normalizeSectionKey(normalizedName),
    );
    if (duplicateSection) {
      throw new Error("Section with this name already exists");
    }

    await ctx.db.patch(args.sectionId, {
      name: normalizedName,
    });
  },
});

export const deleteShoppingListSection = mutation({
  args: { sectionId: v.id("shoppingListSections") },
  handler: async (ctx, args) => {
    await ensureShoppingSectionAccess(ctx, args.sectionId);

    const itemsInSection = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_section", (q) => q.eq("sectionId", args.sectionId))
      .collect();

    for (const item of itemsInSection) {
      await ctx.db.patch(item._id, { sectionId: undefined });
    }

    await ctx.db.delete(args.sectionId);
  },
});

// ====== SHOPPING SETS ======

export const listShoppingSets = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await ensureProjectAccess(ctx, args.projectId);
    return await ctx.db
      .query("shoppingSets")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("asc")
      .collect();
  },
});

export const getShoppingSet = query({
  args: { setId: v.id("shoppingSets") },
  handler: async (ctx, args) => {
    return await ensureShoppingSetAccess(ctx, args.setId);
  },
});

export const createShoppingSet = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    notes: v.optional(v.string()),
    sectionId: v.optional(v.union(v.id("shoppingListSections"), v.null())),
    setType: v.union(v.literal("variant"), v.literal("bundle"), v.literal("reference")),
    selectionMode: v.union(v.literal("single"), v.literal("multiple"), v.literal("none")),
    pricingMode: v.union(v.literal("selected_only"), v.literal("all_selected"), v.literal("none")),
    status: v.optional(v.union(v.literal("draft"), v.literal("active"), v.literal("resolved"), v.literal("archived"))),
    preferredItemIds: v.optional(v.array(v.id("shoppingListItems"))),
    resolvedItemIds: v.optional(v.array(v.id("shoppingListItems"))),
    resolvedBySource: v.optional(
      v.union(v.literal("team"), v.literal("client"), v.null()),
    ),
    resolvedByName: v.optional(v.union(v.string(), v.null())),
    resolvedAt: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const { project, clerkUserId } = await ensureProjectAccess(ctx, args.projectId);
    await ensureSectionBelongsToProject(ctx, args.sectionId ?? null, args.projectId);

    const existingSets = await ctx.db
      .query("shoppingSets")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return await ctx.db.insert("shoppingSets", {
      projectId: args.projectId,
      teamId: project.teamId,
      title: args.title.trim(),
      notes: args.notes?.trim() || undefined,
      sectionId: args.sectionId ?? null,
      setType: args.setType,
      selectionMode: args.selectionMode,
      pricingMode: args.pricingMode,
      status: args.status ?? "active",
      preferredItemIds: args.preferredItemIds ? normalizeIdList(args.preferredItemIds) as any : undefined,
      resolvedItemIds: args.resolvedItemIds ? normalizeIdList(args.resolvedItemIds) as any : undefined,
      resolvedBySource: args.resolvedBySource ?? null,
      resolvedByName: args.resolvedByName?.trim() || null,
      resolvedAt: args.resolvedAt ?? null,
      order: existingSets.length,
      createdBy: clerkUserId,
      updatedAt: Date.now(),
    });
  },
});

export const updateShoppingSet = mutation({
  args: {
    setId: v.id("shoppingSets"),
    title: v.optional(v.string()),
    notes: v.optional(v.string()),
    sectionId: v.optional(v.union(v.id("shoppingListSections"), v.null())),
    setType: v.optional(v.union(v.literal("variant"), v.literal("bundle"), v.literal("reference"))),
    selectionMode: v.optional(v.union(v.literal("single"), v.literal("multiple"), v.literal("none"))),
    pricingMode: v.optional(v.union(v.literal("selected_only"), v.literal("all_selected"), v.literal("none"))),
    status: v.optional(v.union(v.literal("draft"), v.literal("active"), v.literal("resolved"), v.literal("archived"))),
    preferredItemIds: v.optional(v.array(v.id("shoppingListItems"))),
    resolvedItemIds: v.optional(v.array(v.id("shoppingListItems"))),
    resolvedBySource: v.optional(
      v.union(v.literal("team"), v.literal("client"), v.null()),
    ),
    resolvedByName: v.optional(v.union(v.string(), v.null())),
    resolvedAt: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const set = await ensureShoppingSetAccess(ctx, args.setId);
    if (Object.prototype.hasOwnProperty.call(args, "sectionId")) {
      await ensureSectionBelongsToProject(ctx, args.sectionId ?? null, set.projectId);
    }

    const projectItems = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_project", (q) => q.eq("projectId", set.projectId))
      .collect();
    const validItemIds = new Set(
      projectItems
        .filter((item) => String(item.setId ?? "") === String(args.setId))
        .map((item) => String(item._id)),
    );

    const normalizeIdsForSet = (ids?: readonly string[]) =>
      ids ? normalizeIdList(ids).filter((id) => validItemIds.has(id)) : undefined;
    const nextResolvedItemIds = normalizeIdsForSet(args.resolvedItemIds);
    const isUpdatingResolvedSelection = args.resolvedItemIds !== undefined;
    const hasResolvedSelection = Boolean(nextResolvedItemIds && nextResolvedItemIds.length > 0);
    const normalizedResolvedByName =
      args.resolvedByName === undefined ? undefined : args.resolvedByName?.trim() || null;

    await ctx.db.patch(args.setId, {
      ...(args.title !== undefined ? { title: args.title.trim() } : {}),
      ...(args.notes !== undefined ? { notes: args.notes.trim() || undefined } : {}),
      ...(Object.prototype.hasOwnProperty.call(args, "sectionId") ? { sectionId: args.sectionId ?? null } : {}),
      ...(args.setType !== undefined ? { setType: args.setType } : {}),
      ...(args.selectionMode !== undefined ? { selectionMode: args.selectionMode } : {}),
      ...(args.pricingMode !== undefined ? { pricingMode: args.pricingMode } : {}),
      ...(args.status !== undefined ? { status: args.status } : {}),
      ...(args.preferredItemIds !== undefined ? { preferredItemIds: normalizeIdsForSet(args.preferredItemIds) as any } : {}),
      ...(isUpdatingResolvedSelection
        ? {
            resolvedItemIds: nextResolvedItemIds as any,
            resolvedBySource:
              args.resolvedBySource !== undefined
                ? args.resolvedBySource
                : hasResolvedSelection
                  ? "team"
                  : null,
            resolvedByName:
              normalizedResolvedByName !== undefined
                ? normalizedResolvedByName
                : null,
            resolvedAt:
              args.resolvedAt !== undefined
                ? args.resolvedAt
                : hasResolvedSelection
                  ? Date.now()
                  : null,
          }
        : {}),
      updatedAt: Date.now(),
    });
  },
});

export const deleteShoppingSet = mutation({
  args: { setId: v.id("shoppingSets") },
  handler: async (ctx, args) => {
    const set = await ensureShoppingSetAccess(ctx, args.setId);

    const projectItems = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_project", (q) => q.eq("projectId", set.projectId))
      .collect();

    await Promise.all(
      projectItems
        .filter((item) => item.setId === args.setId)
        .map((item) =>
          ctx.db.patch(item._id, {
            setId: null,
            updatedAt: Date.now(),
          }),
        ),
    );

    await ctx.db.delete(args.setId);
  },
});

// ====== SHOPPING LIST ITEMS ======

export const listShoppingListItems = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await ensureProjectAccess(ctx, args.projectId);
    return await ctx.db
      .query("shoppingListItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const getPublicShoppingListByAccessToken = query({
  args: { accessToken: v.string() },
  handler: async (ctx, args) => {
    const token = args.accessToken.trim();
    if (!token) {
      return null;
    }

    const project = await ctx.db
      .query("projects")
      .withIndex("by_client_panel_access_token", (q) =>
        q.eq("clientPanelAccessToken", token)
      )
      .unique();

    if (!project) {
      return null;
    }

    const team = await ctx.db.get(project.teamId);

    const settings = {
      showShoppingList: project.clientPanelPublishedSettings?.showShoppingList ?? false,
      allowShoppingItemDecisions:
        project.clientPanelPublishedSettings?.allowShoppingItemDecisions ?? true,
      allowShoppingItemComments:
        project.clientPanelPublishedSettings?.allowShoppingItemComments ?? true,
      showFiles: project.clientPanelPublishedSettings?.showFiles ?? false,
      showMoodboard: project.clientPanelPublishedSettings?.showMoodboard ?? false,
      showSurveys: project.clientPanelPublishedSettings?.showSurveys ?? false,
      showTasks: project.clientPanelPublishedSettings?.showTasks ?? false,
      showLabor: project.clientPanelPublishedSettings?.showLabor ?? false,
      showContacts: project.clientPanelPublishedSettings?.showContacts ?? false,
      showBudget: project.clientPanelPublishedSettings?.showBudget ?? false,
      showPayments: project.clientPanelPublishedSettings?.showPayments ?? false,
      showNotes: project.clientPanelPublishedSettings?.showNotes ?? true,
      showSupplier: project.clientPanelPublishedSettings?.showSupplier ?? true,
      showPrice: project.clientPanelPublishedSettings?.showPrice ?? true,
    };

    const sections = settings.showShoppingList
      ? await ctx.db
          .query("clientPanelSections")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .order("asc")
          .collect()
      : [];

    const items = settings.showShoppingList
      ? await ctx.db
          .query("clientPanelItems")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect()
      : [];

    const files = settings.showFiles || settings.showMoodboard
      ? await ctx.db
          .query("clientPanelFiles")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect()
      : [];
    const filesWithUrls = await Promise.all(
      files.map(async (file) => {
        try {
          const url = await resolveStoredFileUrl(file.storageId as string, {
            expiresIn: 60 * 60 * 24,
          });
          return { ...file, url };
        } catch (error) {
          console.error(`Error generating URL for client panel file ${file._id}:`, error);
          return { ...file, url: null };
        }
      })
    );

    const visibleFiles = filesWithUrls.filter((file) => !!file.url);
    const moodboardFiles = sortPortalMoodboardFiles(
      visibleFiles.filter((file) => !!file.moodboardSection),
    );
    const standardFiles = visibleFiles.filter((file) => !file.moodboardSection);
    const publishedSnapshot = project.clientPanelPublishedSnapshot;
    const tasksForPortal =
      settings.showTasks && publishedSnapshot ? publishedSnapshot.tasks : [];
    const laborForPortal =
      settings.showLabor && publishedSnapshot ? publishedSnapshot.labor : [];
    const laborSections =
      settings.showLabor && publishedSnapshot ? publishedSnapshot.laborSections : [];
    const contactsForPortal =
      settings.showContacts && publishedSnapshot ? publishedSnapshot.contacts : [];
    const paymentsForPortal =
      settings.showPayments && publishedSnapshot ? publishedSnapshot.payments : [];

    return {
      project: {
        _id: project._id,
        name: project.name,
        currency: project.currency || "PLN",
        budget: settings.showBudget ? project.budget : undefined,
      },
      organizationTaxSettings: resolveOrganizationTaxSettings(
        team?.organizationTaxSettings,
      ),
      settings,
      version: project.clientPanelDataVersion || 0,
      updatedAt: project.clientPanelDataUpdatedAt || null,
      sections,
      items,
      files: settings.showFiles ? standardFiles : [],
      moodboardFiles: settings.showMoodboard ? moodboardFiles : [],
      moodboardSections:
        settings.showMoodboard && publishedSnapshot
          ? publishedSnapshot.moodboardSections ?? []
          : [],
      tasks: tasksForPortal,
      labor: laborForPortal,
      laborSections,
      contacts: contactsForPortal,
      payments: paymentsForPortal,
      paymentsPortalAvailable: paymentsForPortal.some((payment) => payment.canPayOnline),
    };
  },
});

export const selectShoppingSetItemsByAccessToken = mutation({
  args: {
    accessToken: v.string(),
    setId: v.id("shoppingSets"),
    selectedItemIds: v.array(v.id("shoppingListItems")),
    respondentName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const token = args.accessToken.trim();
    if (!token) {
      throw new Error("Invalid panel link");
    }

    const project = await ctx.db
      .query("projects")
      .withIndex("by_client_panel_access_token", (q) =>
        q.eq("clientPanelAccessToken", token)
      )
      .unique();

    if (!project) {
      throw new Error("Invalid panel link");
    }
    if (project.clientPanelPublishedSettings?.showShoppingList !== true) {
      throw new Error("Shopping list is hidden in this portal");
    }
    if (project.clientPanelPublishedSettings?.allowShoppingItemDecisions !== true) {
      throw new Error("Shopping item decisions are disabled in this portal");
    }

    const set = await ctx.db.get(args.setId);
    if (!set || set.projectId !== project._id) {
      throw new Error("Set not found in this project");
    }

    const snapshotItems = await ctx.db
      .query("clientPanelItems")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    const setSnapshotItems = snapshotItems.filter(
      (item) => String(item.setId ?? "") === String(args.setId),
    );

    if (setSnapshotItems.length === 0) {
      throw new Error("Set is not available in this published panel");
    }

    const allowedItemIds = new Set(setSnapshotItems.map((item) => String(item.sourceItemId)));
    const requestedIds = normalizeIdList(args.selectedItemIds).filter((id) =>
      allowedItemIds.has(id),
    );

    if (requestedIds.length !== args.selectedItemIds.length) {
      throw new Error("Selected item does not belong to this set");
    }
    if (set.selectionMode === "single" && requestedIds.length > 1) {
      throw new Error("Only one item can be selected for this set");
    }
    if (set.selectionMode === "none" && requestedIds.length > 0) {
      throw new Error("This set does not accept a selection");
    }

    await ctx.db.patch(set._id, {
      resolvedItemIds: requestedIds as any,
      status: requestedIds.length > 0 ? "resolved" : set.status,
      resolvedBySource: requestedIds.length > 0 ? "client" : null,
      resolvedByName:
        requestedIds.length > 0
          ? getClientPortalActorName(args.respondentName)
          : null,
      resolvedAt: requestedIds.length > 0 ? Date.now() : null,
      updatedAt: Date.now(),
    });

    await Promise.all(
      setSnapshotItems.map((snapshotItem) =>
        ctx.db.patch(snapshotItem._id, {
          setResolvedSourceItemIds: requestedIds as any,
          setStatus: requestedIds.length > 0 ? "resolved" : snapshotItem.setStatus ?? null,
        }),
      ),
    );

    await logClientPortalShoppingActivity(
      ctx,
      { _id: project._id, teamId: project.teamId },
      "shopping.portal.set_selection_saved",
      String(args.setId),
      {
        actorName: getClientPortalActorName(args.respondentName),
        setId: String(args.setId),
        selectedItemIds: requestedIds,
      },
    );

    return {
      success: true,
      setId: args.setId,
      selectedItemIds: requestedIds,
    };
  },
});

export const respondToShoppingItemByAccessToken = mutation({
  args: {
    accessToken: v.string(),
    itemId: v.id("shoppingListItems"),
    decision: v.union(v.literal("accepted"), v.literal("rejected")),
    comment: v.optional(v.union(v.string(), v.null())),
    respondentName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const token = args.accessToken.trim();
    if (!token) {
      throw new Error("Invalid panel link");
    }

    const project = await ctx.db
      .query("projects")
      .withIndex("by_client_panel_access_token", (q) =>
        q.eq("clientPanelAccessToken", token)
      )
      .unique();

    if (!project) {
      throw new Error("Invalid panel link");
    }
    if (project.clientPanelPublishedSettings?.showShoppingList !== true) {
      throw new Error("Shopping list is hidden in this portal");
    }
    if (project.clientPanelPublishedSettings?.allowShoppingItemDecisions !== true) {
      throw new Error("Shopping item decisions are disabled in this portal");
    }
    const commentsAllowed =
      project.clientPanelPublishedSettings?.allowShoppingItemComments !== false;
    const requestedComment = normalizeClientPortalComment(args.comment);
    if (!commentsAllowed && requestedComment) {
      throw new Error("Shopping item comments are disabled in this portal");
    }

    const item = await ctx.db.get(args.itemId);
    if (!item || item.projectId !== project._id) {
      throw new Error("Shopping item not found");
    }

    const snapshotItem = await ctx.db
      .query("clientPanelItems")
      .withIndex("by_project_and_source", (q) =>
        q.eq("projectId", project._id).eq("sourceItemId", args.itemId),
      )
      .unique();

    const now = Date.now();
    const normalizedComment = commentsAllowed ? requestedComment : null;
    const normalizedRespondentName = typeof args.respondentName === "string" ? args.respondentName.trim() : "";

    await ctx.db.patch(args.itemId, {
      customerDecision: args.decision,
      customerDecisionComment: normalizedComment,
      customerDecisionUpdatedAt: now,
      customerDecisionByName: normalizedRespondentName || undefined,
      updatedAt: now,
    });

    if (snapshotItem) {
      await ctx.db.patch(snapshotItem._id, {
        customerDecision: args.decision,
        customerDecisionComment: normalizedComment,
        customerDecisionUpdatedAt: now,
      });
    }

    await logClientPortalShoppingActivity(
      ctx,
      { _id: project._id, teamId: project.teamId },
      "shopping.customer.decision",
      String(args.itemId),
      {
        actorName: getClientPortalActorName(args.respondentName),
        itemId: String(args.itemId),
        itemName: item.name,
        decision: args.decision,
        comment: normalizedComment,
      },
    );

    await ctx.scheduler.runAfter(0, internalAny.notifications.enqueueClientPortalDigestEvent, {
      projectId: project._id,
      event: {
        createdAt: now,
        actionType: "shopping.customer.decision",
        actorName: getClientPortalActorName(args.respondentName),
        entityId: String(args.itemId),
        entityType: "shopping",
        itemName: item.name,
        decision: args.decision,
        ...(normalizedComment ? { comment: normalizedComment } : {}),
      },
    });

    return {
      success: true,
      itemId: args.itemId,
      decision: args.decision,
      comment: normalizedComment,
      updatedAt: now,
    };
  },
});

export const saveShoppingItemCommentByAccessToken = mutation({
  args: {
    accessToken: v.string(),
    itemId: v.id("shoppingListItems"),
    comment: v.optional(v.union(v.string(), v.null())),
    respondentName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const token = args.accessToken.trim();
    if (!token) {
      throw new Error("Invalid panel link");
    }

    const project = await ctx.db
      .query("projects")
      .withIndex("by_client_panel_access_token", (q) =>
        q.eq("clientPanelAccessToken", token)
      )
      .unique();

    if (!project) {
      throw new Error("Invalid panel link");
    }
    if (project.clientPanelPublishedSettings?.showShoppingList !== true) {
      throw new Error("Shopping list is hidden in this portal");
    }

    const item = await ctx.db.get(args.itemId);
    if (!item || item.projectId !== project._id) {
      throw new Error("Shopping item not found");
    }

    const snapshotItem = await ctx.db
      .query("clientPanelItems")
      .withIndex("by_project_and_source", (q) =>
        q.eq("projectId", project._id).eq("sourceItemId", args.itemId),
      )
      .unique();

    const now = Date.now();
    const normalizedComment = normalizeClientPortalComment(args.comment);
    const normalizedRespondentName =
      typeof args.respondentName === "string" ? args.respondentName.trim() : "";

    const patch: {
      customerDecisionComment: string | null;
      updatedAt: number;
      customerDecisionUpdatedAt?: number;
      customerDecisionByName?: string | undefined;
    } = {
      customerDecisionComment: normalizedComment,
      updatedAt: now,
    };

    if (item.customerDecision) {
      patch.customerDecisionUpdatedAt = now;
      patch.customerDecisionByName = normalizedRespondentName || undefined;
    }

    await ctx.db.patch(args.itemId, patch);

    if (snapshotItem) {
      await ctx.db.patch(snapshotItem._id, {
        customerDecisionComment: normalizedComment,
        ...(item.customerDecision ? { customerDecisionUpdatedAt: now } : {}),
      });
    }

    const previousComment = normalizeClientPortalComment(item.customerDecisionComment);
    const shouldNotifyCommentOnlyFeedback =
      !item.customerDecision &&
      normalizedComment !== null &&
      normalizedComment !== previousComment &&
      previousComment === null;

    if (shouldNotifyCommentOnlyFeedback) {
      await logClientPortalShoppingActivity(
        ctx,
        { _id: project._id, teamId: project.teamId },
        "shopping.customer.feedback",
        String(args.itemId),
        {
          actorName: getClientPortalActorName(args.respondentName),
          itemId: String(args.itemId),
          itemName: item.name,
          comment: normalizedComment,
        },
      );

      await ctx.scheduler.runAfter(0, internalAny.notifications.enqueueClientPortalDigestEvent, {
        projectId: project._id,
        event: {
          createdAt: now,
          actionType: "shopping.customer.feedback",
          actorName: getClientPortalActorName(args.respondentName),
          entityId: String(args.itemId),
          entityType: "shopping",
          itemName: item.name,
          comment: normalizedComment ?? undefined,
        },
      });
    }

    return {
      success: true,
      itemId: args.itemId,
      comment: normalizedComment,
      updatedAt: now,
    };
  },
});

export const createShoppingListItem = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    notes: v.optional(v.string()),
    buyBefore: v.optional(v.number()),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    imageUrl: v.optional(v.string()),
    productLink: v.optional(v.string()),
    supplier: v.optional(v.string()),
    catalogNumber: v.optional(v.string()),
    category: v.optional(v.string()),
    dimensions: v.optional(v.string()),
    quantity: v.number(),
    unitPrice: v.optional(v.number()),
    priceTaxMode: v.optional(priceTaxModeValidator),
    taxRateId: v.optional(v.union(v.string(), v.null())),
    taxRateSnapshot: v.optional(v.union(priceTaxRateSnapshotValidator, v.null())),
    setId: v.optional(v.union(v.id("shoppingSets"), v.null())),
    realizationStatus: v.union(v.literal("PLANNED"), v.literal("ORDERED"), v.literal("IN_TRANSIT"), v.literal("DELIVERED"), v.literal("COMPLETED"), v.literal("CANCELLED")),
    sectionId: v.optional(v.union(v.id("shoppingListSections"), v.null())),
    assignedTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { project, clerkUserId } = await ensureProjectAccess(ctx, args.projectId);
    await ensureSectionBelongsToProject(ctx, args.sectionId ?? null, args.projectId);
    await ensureSetBelongsToProject(ctx, args.setId ?? null, args.projectId);

    const unitPrice = args.unitPrice;
    const hasUnitPrice = unitPrice !== undefined;
    const totalPrice = hasUnitPrice ? args.quantity * unitPrice : undefined;

    const itemId = await ctx.db.insert("shoppingListItems", {
      name: args.name,
      notes: args.notes,
      quantity: args.quantity,
      buyBefore: args.buyBefore,
      priority: args.priority,
      projectId: args.projectId,
      teamId: project.teamId,
      createdBy: clerkUserId,
      assignedTo: args.assignedTo || undefined,
      supplier: args.supplier || undefined,
      category: args.category || undefined,
      realizationStatus: args.realizationStatus,
      sectionId: args.sectionId || null,
      setId: args.setId || null,
      unitPrice: hasUnitPrice ? unitPrice : undefined,
      totalPrice: totalPrice,
      priceTaxMode: args.priceTaxMode ?? "unspecified",
      taxRateId: args.taxRateId ?? null,
      taxRateSnapshot: args.taxRateSnapshot ?? null,
      catalogNumber: args.catalogNumber || undefined,
      productLink: args.productLink || undefined,
      imageUrl: args.imageUrl || undefined,
      updatedAt: Date.now(),
      dimensions: args.dimensions || undefined,
      completed: false,
    });

    await ctx.runMutation(internalAny.activityLog.logActivity, {
      teamId: project.teamId,
      projectId: args.projectId,

      actionType: "shopping.create",
      entityId: itemId,
      entityType: "shopping",
      details: {
        name: args.name,
        quantity: args.quantity,
        status: args.realizationStatus,
      },
    });



    return itemId;
  },
});

export const updateShoppingListItem = mutation({
  args: {
    itemId: v.id("shoppingListItems"),
    name: v.optional(v.string()),
    notes: v.optional(v.string()),
    buyBefore: v.optional(v.number()),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    imageUrl: v.optional(v.string()),
    productLink: v.optional(v.string()),
    supplier: v.optional(v.string()),
    catalogNumber: v.optional(v.string()),
    category: v.optional(v.string()),
    dimensions: v.optional(v.string()),
    quantity: v.optional(v.number()),
    unitPrice: v.optional(v.number()),
    priceTaxMode: v.optional(priceTaxModeValidator),
    taxRateId: v.optional(v.union(v.string(), v.null())),
    taxRateSnapshot: v.optional(v.union(priceTaxRateSnapshotValidator, v.null())),
    setId: v.optional(v.union(v.id("shoppingSets"), v.null())),
    realizationStatus: v.optional(v.union(v.literal("PLANNED"), v.literal("ORDERED"), v.literal("IN_TRANSIT"), v.literal("DELIVERED"), v.literal("COMPLETED"), v.literal("CANCELLED"))),
    sectionId: v.optional(v.union(v.id("shoppingListSections"), v.null())),
    assignedTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { itemId, ...updates } = args;
    const item = await ensureShoppingItemAccess(ctx, itemId);

    if (Object.prototype.hasOwnProperty.call(updates, "sectionId")) {
      await ensureSectionBelongsToProject(ctx, updates.sectionId ?? null, item.projectId);
    }
    if (Object.prototype.hasOwnProperty.call(updates, "setId")) {
      await ensureSetBelongsToProject(ctx, updates.setId ?? null, item.projectId);
    }

    let totalPrice = item.totalPrice;
    const quantity = updates.quantity ?? item.quantity;
    const unitPrice = updates.unitPrice ?? item.unitPrice;

    if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
      totalPrice = unitPrice !== undefined ? quantity * unitPrice : undefined;
    }

    const patch: Record<string, unknown> = {
      ...updates,
      totalPrice,
      updatedAt: Date.now(),
    };

    await ctx.db.patch(itemId, patch);

    await ctx.runMutation(internalAny.activityLog.logActivity, {
      teamId: item.teamId,
      projectId: item.projectId,

      actionType: "shopping.update",
      entityId: args.itemId,
      entityType: "shopping",
      details: {
        name: item.name,
        updates: patch,
      },
    });

    return args.itemId;
  },
});

// Soft delete - marks item as CANCELLED (for rejected orders)
export const cancelShoppingListItem = mutation({
  args: { itemId: v.id("shoppingListItems") },
  handler: async (ctx, args) => {
    const item = await ensureShoppingItemAccess(ctx, args.itemId);

    await ctx.runMutation(internalAny.activityLog.logActivity, {
      teamId: item.teamId,
      projectId: item.projectId,

      actionType: "shopping.cancel",
      entityId: args.itemId,
      entityType: "shopping",
      details: {
        name: item.name,
      },
    });

    await ctx.db.patch(args.itemId, {
      realizationStatus: "CANCELLED",
      updatedAt: Date.now(),
    });

    return args.itemId;
  },
});

// Hard delete - permanently removes item from database
export const deleteShoppingListItem = mutation({
  args: { itemId: v.id("shoppingListItems") },
  handler: async (ctx, args) => {
    const item = await ensureShoppingItemAccess(ctx, args.itemId);
    const itemSetId = item.setId ?? null;

    await ctx.runMutation(internalAny.activityLog.logActivity, {
      teamId: item.teamId,
      projectId: item.projectId,

      actionType: "shopping.delete",
      entityId: args.itemId,
      entityType: "shopping",
      details: {
        name: item.name,
      },
    });

    const projectSets = await ctx.db
      .query("shoppingSets")
      .withIndex("by_project", (q) => q.eq("projectId", item.projectId))
      .collect();

    await Promise.all(
      projectSets.map(async (set) => {
        const resolvedItemIds = normalizeIdList(set.resolvedItemIds as string[] | undefined).filter(
          (id) => id !== String(args.itemId),
        );
        const preferredItemIds = normalizeIdList(set.preferredItemIds as string[] | undefined).filter(
          (id) => id !== String(args.itemId),
        );

        if (
          resolvedItemIds.length !== normalizeIdList(set.resolvedItemIds as string[] | undefined).length ||
          preferredItemIds.length !== normalizeIdList(set.preferredItemIds as string[] | undefined).length
        ) {
          await ctx.db.patch(set._id, {
            resolvedItemIds: resolvedItemIds as any,
            preferredItemIds: preferredItemIds as any,
            updatedAt: Date.now(),
          });
        }
      }),
    );

    // Actually delete the item from database
    await ctx.db.delete(args.itemId);

    if (itemSetId) {
      const remainingItemsInSet = (
        await ctx.db
          .query("shoppingListItems")
          .withIndex("by_project", (q) => q.eq("projectId", item.projectId))
          .collect()
      ).filter((entry) => String(entry.setId ?? "") === String(itemSetId));

      const setId = itemSetId as Id<"shoppingSets">;
      const currentSet = await ctx.db.get(setId);
      if (currentSet) {
        if (remainingItemsInSet.length === 0) {
          await ctx.db.delete(setId);
        } else {
          const fallbackItemId = remainingItemsInSet[0]?._id;
          if (
            fallbackItemId &&
            (!currentSet.preferredItemIds || currentSet.preferredItemIds.length === 0)
          ) {
            await ctx.db.patch(setId, {
              preferredItemIds: [fallbackItemId] as any,
              title: remainingItemsInSet[0]?.name || currentSet.title,
              updatedAt: Date.now(),
            });
          }
        }
      }
    }

    return args.itemId;
  },
});

export const getShoppingListItemsByProject = query({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    await ensureProjectAccess(ctx, args.projectId);
    const items = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
    return items;
  },
});

export const getShoppingListItemsByTeam = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    await ensureTeamAccess(ctx, args.teamId);
    const items = await ctx.db
      .query("shoppingListItems")
      .filter((q) => q.eq(q.field("teamId"), args.teamId))
      .collect();

    return items;
  },
});

export const getShoppingSetsByTeam = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    await ensureTeamAccess(ctx, args.teamId);
    return await ctx.db
      .query("shoppingSets")
      .filter((q) => q.eq(q.field("teamId"), args.teamId))
      .collect();
  },
});

export const getShoppingListForIndexing = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    await ensureProjectAccess(ctx, args.projectId);
    return await ctx.db
      .query("shoppingListItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

// ====== HELPER FUNCTIONS FOR INCREMENTAL INDEXING ======

export const getShoppingItemById = query({
  args: { itemId: v.id("shoppingListItems") },
  handler: async (ctx, args) => {
    return await ensureShoppingItemAccess(ctx, args.itemId);
  },
});

export const getShoppingListItem = query({
  args: { itemId: v.id("shoppingListItems") },
  handler: async (ctx, args) => {
    return await ensureShoppingItemAccess(ctx, args.itemId);
  },
});

export const getItemsChangedAfter = query({
  args: {
    projectId: v.id("projects"),
    since: v.number()
  },
  handler: async (ctx, args) => {
    await ensureProjectAccess(ctx, args.projectId);
    return await ctx.db
      .query("shoppingListItems")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .filter(q => q.or(
        q.gt(q.field("_creationTime"), args.since),
        q.gt(q.field("updatedAt"), args.since)
      ))
      .collect();
  },
}); 
