import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
const internalAny = internal as any;

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

    const totalPrice = args.unitPrice ? args.quantity * args.unitPrice : undefined;

    const itemId = await ctx.db.insert("laborItems", {
      name: args.name,
      notes: args.notes,
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

    await ctx.runMutation(internalAny.activityLog.logActivity, {
      teamId: project.teamId,
      projectId: args.projectId,
      actionType: "labor.create",
      entityId: itemId,
      entityType: "labor",
      details: {
        name: args.name,
        quantity: args.quantity,
        unit: args.unit,
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

    await ctx.db.patch(itemId, patch);

    await ctx.runMutation(internalAny.activityLog.logActivity, {
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

    await ctx.runMutation(internalAny.activityLog.logActivity, {
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
