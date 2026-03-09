import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";
const internalAny = require("./_generated/api").internal as any;
const r2 = new R2(components.r2);
const normalizeSectionKey = (name: string) => name.trim().toLocaleLowerCase();

const getClientPortalActorName = (rawName?: string | null) => {
  const trimmed = typeof rawName === "string" ? rawName.trim() : "";
  return trimmed.length > 0 ? trimmed : "Client (portal)";
};

const normalizeClientPortalComment = (rawComment?: string | null) => {
  const trimmed = typeof rawComment === "string" ? rawComment.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
};

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

// ====== SHOPPING LIST SECTIONS ======

export const getShoppingListSections = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
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
    return await ctx.db.get(args.sectionId);
  },
});

export const listShoppingListSections = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

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
      createdBy: identity.subject,
    });
  },
});

export const updateShoppingListSection = mutation({
  args: {
    sectionId: v.id("shoppingListSections"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const section = await ctx.db.get(args.sectionId);
    if (!section) throw new Error("Section not found");

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const section = await ctx.db.get(args.sectionId);
    if (!section) throw new Error("Section not found");

    // You might want to check for user permissions here

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

// ====== SHOPPING LIST ITEMS ======

export const listShoppingListItems = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
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

    const settings = {
      showShoppingList: project.clientPanelPublishedSettings?.showShoppingList ?? false,
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
          const url = await r2.getUrl(file.storageId as string, {
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
    const moodboardFiles = visibleFiles.filter((file) => !!file.moodboardSection);
    const standardFiles = visibleFiles.filter((file) => !file.moodboardSection);
    const tasks = settings.showTasks
      ? await ctx.db
          .query("tasks")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect()
      : [];
    const laborItems = settings.showLabor
      ? await ctx.db
          .query("laborItems")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect()
      : [];
    const projectContactLinks = settings.showContacts
      ? await ctx.db
          .query("projectContacts")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect()
      : [];
    const contacts = settings.showContacts
      ? (
          await Promise.all(
            projectContactLinks.map(async (link) => {
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
            })
          )
        ).filter(Boolean)
      : [];

    const tasksForPortal = tasks
      .map((task) => ({
        _id: task._id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        startDate: task.startDate,
        endDate: task.endDate,
      }))
      .sort((a, b) => {
        const aDate = a.endDate || a.startDate || 0;
        const bDate = b.endDate || b.startDate || 0;
        if (aDate !== bDate) return aDate - bDate;
        return a.title.localeCompare(b.title);
      });

    const laborForPortal = laborItems
      .map((item) => ({
        _id: item._id,
        name: item.name,
        notes: item.notes,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        startDate: item.startDate,
        endDate: item.endDate,
      }))
      .sort((a, b) => {
        const aDate = a.startDate || a.endDate || 0;
        const bDate = b.startDate || b.endDate || 0;
        if (aDate !== bDate) return aDate - bDate;
        return a.name.localeCompare(b.name);
      });

    const contactsForPortal = contacts
      .map((contact) => contact!)
      .sort((a, b) => a.name.localeCompare(b.name));
    const payments = settings.showPayments
      ? await ctx.db
          .query("projectPayments")
          .withIndex("by_project_and_order", (q) => q.eq("projectId", project._id))
          .order("asc")
          .collect()
      : [];

    return {
      project: {
        _id: project._id,
        name: project.name,
        currency: project.currency || "PLN",
        budget: project.budget,
      },
      settings,
      version: project.clientPanelDataVersion || 0,
      updatedAt: project.clientPanelDataUpdatedAt || null,
      sections,
      items,
      files: settings.showFiles ? standardFiles : [],
      moodboardFiles: settings.showMoodboard ? moodboardFiles : [],
      tasks: settings.showTasks ? tasksForPortal : [],
      labor: settings.showLabor ? laborForPortal : [],
      contacts: settings.showContacts ? contactsForPortal : [],
      payments: settings.showPayments
        ? payments
            .filter((payment) => payment.status !== "void")
            .map((payment) => ({
              _id: payment._id,
              title: payment.title,
              description: payment.description,
              amount: payment.amount,
              currency: payment.currency,
              dueDate: payment.dueDate,
              status: payment.status,
              stripeHostedInvoiceUrl: payment.stripeHostedInvoiceUrl,
              stripeInvoiceNumber: payment.stripeInvoiceNumber,
              paidAt: payment.paidAt,
              isOverdue:
                payment.status === "open" &&
                typeof payment.dueDate === "number" &&
                payment.dueDate < Date.now(),
            }))
        : [],
      paymentsPortalAvailable:
        settings.showPayments &&
        !!(project.stripeProjectCustomerId || project.paymentCustomerEmail),
    };
  },
});

export const selectShoppingAlternativeByAccessToken = mutation({
  args: {
    accessToken: v.string(),
    itemId: v.id("shoppingListItems"),
    selectedItemId: v.union(v.id("shoppingListItems"), v.null()),
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

    const item = await ctx.db
      .query("clientPanelItems")
      .withIndex("by_project_and_source", (q) =>
        q.eq("projectId", project._id).eq("sourceItemId", args.itemId)
      )
      .unique();
    if (!item) {
      throw new Error("Item not found in this published panel");
    }

    const baseItemId = item.alternativeToSourceItemId || item.sourceItemId;

    const projectItems = await ctx.db
      .query("clientPanelItems")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();

    const allowedOptionIds = new Set(
      projectItems
        .filter(
          (projectItem) =>
            projectItem.sourceItemId === baseItemId ||
            projectItem.alternativeToSourceItemId === baseItemId
        )
        .map((projectItem) => projectItem.sourceItemId)
    );

    if (allowedOptionIds.size === 0) {
      throw new Error("Alternative options not found");
    }

    if (args.selectedItemId && !allowedOptionIds.has(args.selectedItemId)) {
      throw new Error("Selected option does not belong to this alternative group");
    }

    const selectedAlternativeSourceItemId =
      args.selectedItemId && args.selectedItemId !== baseItemId
        ? args.selectedItemId
        : null;

    const basePanelItem = await ctx.db
      .query("clientPanelItems")
      .withIndex("by_project_and_source", (q) =>
        q.eq("projectId", project._id).eq("sourceItemId", baseItemId)
      )
      .unique();
    if (!basePanelItem) {
      throw new Error("Base item not found in published panel");
    }

    await ctx.db.patch(basePanelItem._id, {
      selectedAlternativeSourceItemId,
    });

    await ctx.db.patch(baseItemId, {
      selectedAlternativeItemId: selectedAlternativeSourceItemId,
      updatedAt: Date.now(),
    });

    const selectedSourceItemId = selectedAlternativeSourceItemId || baseItemId;
    const selectedOption = projectItems.find(
      (projectItem) => projectItem.sourceItemId === selectedSourceItemId
    );
    await logClientPortalShoppingActivity(
      ctx,
      { _id: project._id, teamId: project.teamId },
      "shopping.customer.option_selected",
      String(baseItemId),
      {
        actorName: getClientPortalActorName(args.respondentName),
        baseItemId: String(baseItemId),
        selectedItemId: String(selectedSourceItemId),
        selectedItemName: selectedOption?.name || null,
      }
    );

    return {
      success: true,
      baseItemId,
      selectedItemId: selectedAlternativeSourceItemId || baseItemId,
    };
  },
});

export const setShoppingItemFeedbackByAccessToken = mutation({
  args: {
    accessToken: v.string(),
    itemId: v.id("shoppingListItems"),
    decision: v.union(v.literal("accepted"), v.literal("rejected"), v.null()),
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

    const item = await ctx.db
      .query("clientPanelItems")
      .withIndex("by_project_and_source", (q) =>
        q.eq("projectId", project._id).eq("sourceItemId", args.itemId)
      )
      .unique();
    if (!item) {
      throw new Error("Item not found in this published panel");
    }

    const baseItemId = item.alternativeToSourceItemId || item.sourceItemId;
    const basePanelItem = await ctx.db
      .query("clientPanelItems")
      .withIndex("by_project_and_source", (q) =>
        q.eq("projectId", project._id).eq("sourceItemId", baseItemId)
      )
      .unique();
    if (!basePanelItem) {
      throw new Error("Base item not found in published panel");
    }

    const normalizedComment =
      typeof args.comment === "string" ? args.comment.trim() : "";
    if (normalizedComment.length > 2000) {
      throw new Error("Comment is too long (max 2000 characters)");
    }

    const customerDecisionUpdatedAt = Date.now();
    const actorName = getClientPortalActorName(args.respondentName);
    const normalizedDecisionComment = normalizeClientPortalComment(normalizedComment);
    const previousDecision = basePanelItem.customerDecision ?? null;
    const previousDecisionComment = normalizeClientPortalComment(
      basePanelItem.customerDecisionComment ?? null,
    );
    const decisionChanged = previousDecision !== args.decision;
    const commentChanged = previousDecisionComment !== normalizedDecisionComment;

    if (!decisionChanged && !commentChanged) {
      return {
        success: true,
        baseItemId,
        decision: args.decision,
        comment: normalizedDecisionComment,
      };
    }

    await ctx.db.patch(basePanelItem._id, {
      customerDecision: args.decision,
      customerDecisionComment: normalizedDecisionComment,
      customerDecisionUpdatedAt,
    });

    await ctx.db.patch(baseItemId, {
      customerDecision: args.decision,
      customerDecisionComment: normalizedDecisionComment,
      customerDecisionUpdatedAt,
      customerDecisionByName: actorName,
      updatedAt: customerDecisionUpdatedAt,
    });

    if (commentChanged && normalizedDecisionComment) {
      await logClientPortalShoppingActivity(
        ctx,
        { _id: project._id, teamId: project.teamId },
        "shopping.customer.feedback",
        String(baseItemId),
        {
          actorName,
          itemName: basePanelItem.name,
          comment: normalizedDecisionComment,
        }
      );
    }

    if (decisionChanged && (args.decision === "accepted" || args.decision === "rejected")) {
      await logClientPortalShoppingActivity(
        ctx,
        { _id: project._id, teamId: project.teamId },
        "shopping.customer.decision",
        String(baseItemId),
        {
          actorName,
          itemName: basePanelItem.name,
          decision: args.decision,
        }
      );

      await ctx.scheduler.runAfter(
        0,
        internalAny.notifications.sendClientPortalEventEmail,
        {
          projectId: project._id,
          actionType: "shopping.customer.decision",
          actorName,
          itemName: basePanelItem.name,
          decision: args.decision,
        }
      );
    }

    return {
      success: true,
      baseItemId,
      decision: args.decision,
      comment: normalizedDecisionComment,
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
    alternativeToItemId: v.optional(v.union(v.id("shoppingListItems"), v.null())),
    selectedAlternativeItemId: v.optional(v.union(v.id("shoppingListItems"), v.null())),
    realizationStatus: v.union(v.literal("PLANNED"), v.literal("ORDERED"), v.literal("IN_TRANSIT"), v.literal("DELIVERED"), v.literal("COMPLETED"), v.literal("CANCELLED")),
    sectionId: v.optional(v.union(v.id("shoppingListSections"), v.null())),
    assignedTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const totalPrice = args.unitPrice ? args.quantity * args.unitPrice : undefined;

    const itemId = await ctx.db.insert("shoppingListItems", {
      name: args.name,
      notes: args.notes,
      quantity: args.quantity,
      buyBefore: args.buyBefore,
      priority: args.priority,
      projectId: args.projectId,
      teamId: project.teamId,
      createdBy: identity.subject,
      assignedTo: args.assignedTo || undefined,
      supplier: args.supplier || undefined,
      category: args.category || undefined,
      realizationStatus: args.realizationStatus,
      sectionId: args.sectionId || null,
      unitPrice: args.unitPrice || undefined,
      totalPrice: totalPrice,
      alternativeToItemId: args.alternativeToItemId || null,
      selectedAlternativeItemId: args.selectedAlternativeItemId || null,
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
    alternativeToItemId: v.optional(v.union(v.id("shoppingListItems"), v.null())),
    selectedAlternativeItemId: v.optional(v.union(v.id("shoppingListItems"), v.null())),
    realizationStatus: v.optional(v.union(v.literal("PLANNED"), v.literal("ORDERED"), v.literal("IN_TRANSIT"), v.literal("DELIVERED"), v.literal("COMPLETED"), v.literal("CANCELLED"))),
    sectionId: v.optional(v.union(v.id("shoppingListSections"), v.null())),
    assignedTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const { itemId, ...updates } = args;
    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("Item not found");

    let totalPrice = item.totalPrice;
    const quantity = updates.quantity ?? item.quantity;
    const unitPrice = updates.unitPrice ?? item.unitPrice;

    if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
      totalPrice = unitPrice ? quantity * unitPrice : undefined;
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item not found");

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item not found");

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

    const projectItems = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_project", (q) => q.eq("projectId", item.projectId))
      .collect();

    await Promise.all(
      projectItems.map(async (projectItem) => {
        if (projectItem._id === args.itemId) return;

        const patch: Record<string, unknown> = {};

        if (projectItem.alternativeToItemId === args.itemId) {
          patch.alternativeToItemId = null;
        }

        if (projectItem.selectedAlternativeItemId === args.itemId) {
          patch.selectedAlternativeItemId = null;
        }

        if (Object.keys(patch).length > 0) {
          patch.updatedAt = Date.now();
          await ctx.db.patch(projectItem._id, patch);
        }
      }),
    );

    // Actually delete the item from database
    await ctx.db.delete(args.itemId);



    return args.itemId;
  },
});

export const getShoppingListItemsByProject = query({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    const items = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return items;
  },
});

export const getShoppingListItemsByTeam = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get all shopping list items for this team
    const items = await ctx.db
      .query("shoppingListItems")
      .filter((q) => q.eq(q.field("teamId"), args.teamId))
      .collect();

    return items;
  },
});

export const getShoppingListForIndexing = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
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
    return await ctx.db.get(args.itemId);
  },
});

export const getShoppingListItem = query({
  args: { itemId: v.id("shoppingListItems") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.itemId);
  },
});

export const getItemsChangedAfter = query({
  args: {
    projectId: v.id("projects"),
    since: v.number()
  },
  handler: async (ctx, args) => {
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
