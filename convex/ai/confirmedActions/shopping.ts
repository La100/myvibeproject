/**
 * Confirmed Actions - Shopping
 * 
 * Shopping item and section CRUD operations that require user confirmation from AI suggestions.
 */

import { action } from "../../_generated/server";
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import type { Id } from "../../_generated/dataModel";
import { ensureProjectAccess, parseOptionalDateToMillis } from "./helpers";

const createShoppingListItemMutationRef =
  makeFunctionReference<"mutation">("shopping:createShoppingListItem");
const createShoppingListSectionMutationRef =
  makeFunctionReference<"mutation">("shopping:createShoppingListSection");
const getShoppingListItemQueryRef =
  makeFunctionReference<"query">("shopping:getShoppingListItem");
const updateShoppingListItemMutationRef =
  makeFunctionReference<"mutation">("shopping:updateShoppingListItem");
const updateShoppingListSectionMutationRef =
  makeFunctionReference<"mutation">("shopping:updateShoppingListSection");
const deleteShoppingListItemMutationRef =
  makeFunctionReference<"mutation">("shopping:deleteShoppingListItem");
const deleteShoppingListSectionMutationRef =
  makeFunctionReference<"mutation">("shopping:deleteShoppingListSection");

export const createConfirmedShoppingItem = action({
  args: {
    projectId: v.id("projects"),
    itemData: v.object({
      name: v.string(),
      quantity: v.number(),
      notes: v.optional(v.string()),
      priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
      buyBefore: v.optional(v.string()),
      supplier: v.optional(v.string()),
      category: v.optional(v.string()),
      unitPrice: v.optional(v.number()),
      totalPrice: v.optional(v.number()),
      sectionId: v.optional(v.id("shoppingListSections")),
      alternativeToItemId: v.optional(v.id("shoppingListItems")),
      selectedAlternativeItemId: v.optional(v.id("shoppingListItems")),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    itemId: v.optional(v.id("shoppingListItems")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await ensureProjectAccess(ctx, args.projectId, true);

      const buyBeforeNumber = parseOptionalDateToMillis(
        args.itemData.buyBefore,
        "shopping buyBefore",
      );

      const itemId = await ctx.runMutation(createShoppingListItemMutationRef, {
        projectId: args.projectId,
        name: args.itemData.name,
        quantity: args.itemData.quantity,
        notes: args.itemData.notes,
        priority: args.itemData.priority || "medium",
        buyBefore: buyBeforeNumber,
        supplier: args.itemData.supplier,
        category: args.itemData.category,
        unitPrice: args.itemData.unitPrice,
        realizationStatus: "PLANNED",
        sectionId: args.itemData.sectionId,
        alternativeToItemId: args.itemData.alternativeToItemId,
        selectedAlternativeItemId: args.itemData.selectedAlternativeItemId,
      });

      return {
        success: true,
        itemId,
        message: "Shopping item created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create shopping item: ${error}`,
      };
    }
  },
});

export const createConfirmedShoppingSection = action({
  args: {
    projectId: v.id("projects"),
    sectionData: v.object({
      name: v.string(),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    sectionId: v.optional(v.id("shoppingListSections")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await ensureProjectAccess(ctx, args.projectId, true);

      const sectionId = await ctx.runMutation(createShoppingListSectionMutationRef, {
        name: args.sectionData.name,
        projectId: args.projectId,
      });

      return {
        success: true,
        sectionId,
        message: "Shopping section created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create shopping section: ${error}`,
      };
    }
  },
});

export const editConfirmedShoppingItem = action({
  args: {
    projectId: v.optional(v.id("projects")),
    itemId: v.id("shoppingListItems"),
    updates: v.object({
      name: v.optional(v.string()),
      notes: v.optional(v.string()),
      buyBefore: v.optional(v.string()),
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
    }),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const item = await ctx.runQuery(getShoppingListItemQueryRef, { itemId: args.itemId });
      if (!item) {
        throw new Error("Shopping item not found");
      }
      if (args.projectId && item.projectId !== args.projectId) {
        throw new Error("Shopping item does not belong to the active project");
      }
      await ensureProjectAccess(ctx, args.projectId ?? item.projectId, true);

      let buyBeforeNumber: number | undefined;
      if (args.updates.buyBefore) {
        buyBeforeNumber = new Date(args.updates.buyBefore).getTime();
      }

      await ctx.runMutation(updateShoppingListItemMutationRef, {
        itemId: args.itemId,
        name: args.updates.name,
        notes: args.updates.notes,
        buyBefore: buyBeforeNumber,
        priority: args.updates.priority,
        imageUrl: args.updates.imageUrl,
        productLink: args.updates.productLink,
        supplier: args.updates.supplier,
        catalogNumber: args.updates.catalogNumber,
        category: args.updates.category,
        dimensions: args.updates.dimensions,
        quantity: args.updates.quantity,
        unitPrice: args.updates.unitPrice,
        alternativeToItemId: args.updates.alternativeToItemId,
        selectedAlternativeItemId: args.updates.selectedAlternativeItemId,
        realizationStatus: args.updates.realizationStatus,
        sectionId: args.updates.sectionId,
        assignedTo: args.updates.assignedTo,
      });

      return {
        success: true,
        message: "Shopping item updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update shopping item: ${error}`,
      };
    }
  },
});

export const editConfirmedShoppingSection = action({
  args: {
    sectionId: v.id("shoppingListSections"),
    updates: v.object({
      name: v.optional(v.string()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const db = (ctx as { db?: { get: (id: unknown) => Promise<unknown> } }).db;
      const section = (db ? await db.get(args.sectionId) : null) as {
        projectId: unknown;
        name?: string;
      } | null;
      if (!section) {
        throw new Error("Shopping section not found");
      }

      await ensureProjectAccess(ctx, section.projectId as Id<"projects">, true);

      await ctx.runMutation(updateShoppingListSectionMutationRef, {
        sectionId: args.sectionId,
        name: args.updates.name ?? section.name,
      });

      return {
        success: true,
        message: "Shopping section updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update shopping section: ${error}`,
      };
    }
  },
});

export const deleteConfirmedShoppingItem = action({
  args: {
    itemId: v.id("shoppingListItems"),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const item = await ctx.runQuery(getShoppingListItemQueryRef, { itemId: args.itemId });
      if (!item) {
        throw new Error("Shopping item not found");
      }
      await ensureProjectAccess(ctx, item.projectId, true);

      await ctx.runMutation(deleteShoppingListItemMutationRef, {
        itemId: args.itemId,
      });

      return {
        success: true,
        message: "Shopping item deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete shopping item: ${error}`,
      };
    }
  },
});

export const deleteConfirmedShoppingSection = action({
  args: {
    sectionId: v.id("shoppingListSections"),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const db = (ctx as { db?: { get: (id: unknown) => Promise<unknown> } }).db;
      const section = (db ? await db.get(args.sectionId) : null) as {
        projectId: unknown;
      } | null;
      if (!section) {
        throw new Error("Shopping section not found");
      }

      await ensureProjectAccess(ctx, section.projectId as Id<"projects">, true);

      await ctx.runMutation(deleteShoppingListSectionMutationRef, {
        sectionId: args.sectionId,
      });

      return {
        success: true,
        message: "Shopping section deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete shopping section: ${error}`,
      };
    }
  },
});









