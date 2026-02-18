import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
const internalAny = internal as any;

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

    const existingSections = await ctx.db.query("shoppingListSections").withIndex("by_project", q => q.eq("projectId", args.projectId)).collect();

    return await ctx.db.insert("shoppingListSections", {
      name: args.name,
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

    await ctx.db.patch(args.sectionId, {
      name: args.name,
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
