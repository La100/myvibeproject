import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Common unit types for labor
export const LABOR_UNITS = [
  "m²",      // square meters
  "m",       // linear meters
  "hours",   // hours of work
  "pcs",     // pieces
  "m³",      // cubic meters
  "kg",      // kilograms
  "set",     // complete set
  "room",    // per room
  "item",    // per item
] as const;

const normalizeReferenceLink = (input?: string | null) => {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Invalid protocol");
    }
    return url.toString();
  } catch {
    throw new Error("Invalid link format");
  }
};

const assertAttachmentBelongsToProject = async (
  ctx: {
    db: {
      get: (id: Id<"files">) => Promise<{ projectId?: Id<"projects"> } | null>;
    };
  },
  projectId: Id<"projects">,
  fileId?: Id<"files"> | null,
) => {
  if (!fileId) return;
  const file = await ctx.db.get(fileId);
  if (!file) throw new Error("Attachment file not found");
  if (file.projectId !== projectId) {
    throw new Error("Attachment must belong to the same project");
  }
};

// Use a lightweight function reference to avoid deep generated type instantiation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const logActivityMutationRef = { _name: "activityLog:logActivity" } as any;

// ====== LABOR SECTIONS ======

export const getLaborSections = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("laborSections")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("asc")
      .collect();
  },
});

export const getLaborSection = query({
  args: { sectionId: v.id("laborSections") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sectionId);
  },
});

export const listLaborSections = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("laborSections")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("asc")
      .collect();
  },
});

export const createLaborSection = mutation({
  args: {
    name: v.string(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const existingSections = await ctx.db
      .query("laborSections")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return await ctx.db.insert("laborSections", {
      name: args.name,
      projectId: args.projectId,
      teamId: project.teamId,
      order: existingSections.length,
      createdBy: identity.subject,
    });
  },
});

export const updateLaborSection = mutation({
  args: {
    sectionId: v.id("laborSections"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    await ctx.db.patch(args.sectionId, {
      name: args.name,
    });
  },
});

export const deleteLaborSection = mutation({
  args: { sectionId: v.id("laborSections") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const section = await ctx.db.get(args.sectionId);
    if (!section) throw new Error("Section not found");

    // Move items in this section to no section
    const itemsInSection = await ctx.db
      .query("laborItems")
      .withIndex("by_section", (q) => q.eq("sectionId", args.sectionId))
      .collect();

    for (const item of itemsInSection) {
      await ctx.db.patch(item._id, { sectionId: undefined });
    }

    await ctx.db.delete(args.sectionId);
  },
});

// ====== LABOR ITEMS ======

export const listLaborItems = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("laborItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const getLaborItem = query({
  args: { itemId: v.id("laborItems") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.itemId);
  },
});

export const createLaborItem = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    notes: v.optional(v.string()),
    referenceLink: v.optional(v.union(v.string(), v.null())),
    attachmentFileId: v.optional(v.union(v.id("files"), v.null())),
    quantity: v.number(),
    unit: v.string(),
    unitPrice: v.optional(v.number()),
    sectionId: v.optional(v.union(v.id("laborSections"), v.null())),
    assignedTo: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const normalizedReferenceLink = normalizeReferenceLink(args.referenceLink);
    await assertAttachmentBelongsToProject(ctx, args.projectId, args.attachmentFileId);

    const totalPrice = args.unitPrice ? args.quantity * args.unitPrice : undefined;

    const itemId = await ctx.db.insert("laborItems", {
      name: args.name,
      notes: args.notes,
      referenceLink: normalizedReferenceLink,
      attachmentFileId: args.attachmentFileId || null,
      quantity: args.quantity,
      unit: args.unit,
      unitPrice: args.unitPrice || undefined,
      totalPrice: totalPrice,
      sectionId: args.sectionId || null,
      projectId: args.projectId,
      teamId: project.teamId,
      createdBy: identity.subject,
      assignedTo: args.assignedTo || undefined,
      updatedAt: Date.now(),
    });

    await (ctx.runMutation as any)(logActivityMutationRef, {
      teamId: project.teamId,
      projectId: args.projectId,
      actionType: "labor.create",
      entityId: itemId,
      entityType: "labor",
      details: {
        name: args.name,
        quantity: args.quantity,
        unit: args.unit,
        hasAttachment: Boolean(args.attachmentFileId),
        hasReferenceLink: Boolean(normalizedReferenceLink),
      },
    });

    return itemId;
  },
});

export const updateLaborItem = mutation({
  args: {
    itemId: v.id("laborItems"),
    name: v.optional(v.string()),
    notes: v.optional(v.string()),
    referenceLink: v.optional(v.union(v.string(), v.null())),
    attachmentFileId: v.optional(v.union(v.id("files"), v.null())),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    unitPrice: v.optional(v.number()),
    sectionId: v.optional(v.union(v.id("laborSections"), v.null())),
    assignedTo: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
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

    if ("referenceLink" in updates) {
      patch.referenceLink = normalizeReferenceLink(updates.referenceLink);
    }

    if ("attachmentFileId" in updates) {
      await assertAttachmentBelongsToProject(ctx, item.projectId, updates.attachmentFileId);
      patch.attachmentFileId = updates.attachmentFileId || null;
    }

    await ctx.db.patch(itemId, patch);

    await (ctx.runMutation as any)(logActivityMutationRef, {
      teamId: item.teamId,
      projectId: item.projectId,
      actionType: "labor.update",
      entityId: args.itemId,
      entityType: "labor",
      details: {
        name: item.name,
        updates: patch,
      },
    });

    return args.itemId;
  },
});

export const deleteLaborItem = mutation({
  args: { itemId: v.id("laborItems") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item not found");

    await (ctx.runMutation as any)(logActivityMutationRef, {
      teamId: item.teamId,
      projectId: item.projectId,
      actionType: "labor.delete",
      entityId: args.itemId,
      entityType: "labor",
      details: {
        name: item.name,
      },
    });

    await ctx.db.delete(args.itemId);

    return args.itemId;
  },
});

// ====== HELPER QUERIES ======

export const getLaborItemsByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("laborItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const getLaborTotalByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("laborItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  },
});

export const getLaborForIndexing = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("laborItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});
