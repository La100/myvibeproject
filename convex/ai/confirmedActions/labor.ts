/**
 * Confirmed Actions - Labor
 * 
 * Labor item and section CRUD operations that require user confirmation from AI suggestions.
 */

import { action } from "../../_generated/server";
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { ensureProjectAccess } from "./helpers";

const createLaborItemMutationRef =
  makeFunctionReference<"mutation">("labor:createLaborItem");
const createLaborSectionMutationRef =
  makeFunctionReference<"mutation">("labor:createLaborSection");
const getLaborItemQueryRef =
  makeFunctionReference<"query">("labor:getLaborItem");
const updateLaborItemMutationRef =
  makeFunctionReference<"mutation">("labor:updateLaborItem");
const updateLaborSectionMutationRef =
  makeFunctionReference<"mutation">("labor:updateLaborSection");
const deleteLaborItemMutationRef =
  makeFunctionReference<"mutation">("labor:deleteLaborItem");
const deleteLaborSectionMutationRef =
  makeFunctionReference<"mutation">("labor:deleteLaborSection");

function hasDefinedUpdates(updates: Record<string, unknown>): boolean {
  return Object.values(updates).some((value) => value !== undefined);
}

export const createConfirmedLaborItem = action({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.optional(v.string()),
    itemData: v.object({
      name: v.string(),
      quantity: v.number(),
      unit: v.optional(v.string()),
      notes: v.optional(v.string()),
      unitPrice: v.optional(v.number()),
      sectionId: v.optional(v.id("laborSections")),
      assignedTo: v.optional(v.string()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    itemId: v.optional(v.id("laborItems")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await ensureProjectAccess(ctx, args.projectId, true, args.userClerkId);

      const itemId = await ctx.runMutation(createLaborItemMutationRef, {
        projectId: args.projectId,
        name: args.itemData.name,
        quantity: args.itemData.quantity,
        unit: args.itemData.unit || "m²",
        notes: args.itemData.notes,
        unitPrice: args.itemData.unitPrice,
        sectionId: args.itemData.sectionId,
        assignedTo: args.itemData.assignedTo,
      });

      return {
        success: true,
        itemId,
        message: "Labor item created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create labor item: ${error}`,
      };
    }
  },
});

const getLaborSectionQueryRef =
  makeFunctionReference<"query">("labor:getLaborSection");

export const createConfirmedLaborSection = action({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.optional(v.string()),
    sectionData: v.object({
      name: v.string(),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    sectionId: v.optional(v.id("laborSections")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await ensureProjectAccess(ctx, args.projectId, true, args.userClerkId);

      const sectionId = await ctx.runMutation(createLaborSectionMutationRef, {
        name: args.sectionData.name,
        projectId: args.projectId,
      });

      return {
        success: true,
        sectionId,
        message: "Labor section created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create labor section: ${error}`,
      };
    }
  },
});

export const editConfirmedLaborItem = action({
  args: {
    projectId: v.optional(v.id("projects")),
    userClerkId: v.optional(v.string()),
    itemId: v.id("laborItems"),
    updates: v.object({
      name: v.optional(v.string()),
      notes: v.optional(v.string()),
      quantity: v.optional(v.number()),
      unit: v.optional(v.string()),
      unitPrice: v.optional(v.number()),
      sectionId: v.optional(v.union(v.id("laborSections"), v.null())),
      assignedTo: v.optional(v.string()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      if (!hasDefinedUpdates(args.updates)) {
        throw new Error("No valid labor item update fields were provided");
      }

      const item = await ctx.runQuery(getLaborItemQueryRef, { itemId: args.itemId });
      if (!item) {
        throw new Error("Labor item not found");
      }
      if (args.projectId && item.projectId !== args.projectId) {
        throw new Error("Labor item does not belong to the active project");
      }
      await ensureProjectAccess(ctx, args.projectId ?? item.projectId, true, args.userClerkId);

      await ctx.runMutation(updateLaborItemMutationRef, {
        itemId: args.itemId,
        name: args.updates.name,
        notes: args.updates.notes,
        quantity: args.updates.quantity,
        unit: args.updates.unit,
        unitPrice: args.updates.unitPrice,
        sectionId: args.updates.sectionId,
        assignedTo: args.updates.assignedTo,
      });

      return {
        success: true,
        message: "Labor item updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update labor item: ${error}`,
      };
    }
  },
});

export const editConfirmedLaborSection = action({
  args: {
    sectionId: v.id("laborSections"),
    userClerkId: v.optional(v.string()),
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
      if (!hasDefinedUpdates(args.updates)) {
        throw new Error("No valid labor section update fields were provided");
      }

      const section = await ctx.runQuery(getLaborSectionQueryRef, {
        sectionId: args.sectionId,
      });
      if (!section) {
        throw new Error("Labor section not found");
      }

      await ensureProjectAccess(ctx, section.projectId, true, args.userClerkId);

      await ctx.runMutation(updateLaborSectionMutationRef, {
        sectionId: args.sectionId,
        name: args.updates.name ?? section.name,
      });

      return {
        success: true,
        message: "Labor section updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update labor section: ${error}`,
      };
    }
  },
});

export const deleteConfirmedLaborItem = action({
  args: {
    itemId: v.id("laborItems"),
    userClerkId: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const item = await ctx.runQuery(getLaborItemQueryRef, { itemId: args.itemId });
      if (!item) {
        throw new Error("Labor item not found");
      }
      await ensureProjectAccess(ctx, item.projectId, true, args.userClerkId);

      await ctx.runMutation(deleteLaborItemMutationRef, {
        itemId: args.itemId,
      });

      return {
        success: true,
        message: "Labor item deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete labor item: ${error}`,
      };
    }
  },
});

export const deleteConfirmedLaborSection = action({
  args: {
    sectionId: v.id("laborSections"),
    userClerkId: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const section = await ctx.runQuery(getLaborSectionQueryRef, {
        sectionId: args.sectionId,
      });
      if (!section) {
        throw new Error("Labor section not found");
      }

      await ensureProjectAccess(ctx, section.projectId, true, args.userClerkId);

      await ctx.runMutation(deleteLaborSectionMutationRef, {
        sectionId: args.sectionId,
      });

      return {
        success: true,
        message: "Labor section deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete labor section: ${error}`,
      };
    }
  },
});
