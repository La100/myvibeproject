/**
 * Confirmed Actions - Moodboard
 *
 * Moodboard section CRUD operations that require user confirmation from AI suggestions.
 */

import { action } from "../../_generated/server";
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { ensureProjectAccess } from "./helpers";

const createMoodboardSectionMutationRef =
  makeFunctionReference<"mutation">("files:createMoodboardSection");
const renameMoodboardSectionMutationRef =
  makeFunctionReference<"mutation">("files:renameMoodboardSection");
const deleteMoodboardSectionMutationRef =
  makeFunctionReference<"mutation">("files:deleteMoodboardSection");

export const createConfirmedMoodboardSection = action({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.optional(v.string()),
    sectionData: v.object({
      name: v.string(),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    sectionId: v.optional(v.string()),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await ensureProjectAccess(ctx, args.projectId, true, args.userClerkId);

      const section = await ctx.runMutation(createMoodboardSectionMutationRef, {
        projectId: args.projectId,
        title: args.sectionData.name,
      });

      return {
        success: true,
        sectionId: section.id,
        message: "Moodboard section created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create moodboard section: ${error}`,
      };
    }
  },
});

export const editConfirmedMoodboardSection = action({
  args: {
    projectId: v.id("projects"),
    sectionId: v.string(),
    userClerkId: v.optional(v.string()),
    updates: v.object({
      name: v.optional(v.string()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    sectionId: v.optional(v.string()),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await ensureProjectAccess(ctx, args.projectId, true, args.userClerkId);

      const nextName = args.updates.name?.trim();
      if (!nextName) {
        throw new Error("Moodboard section name is required");
      }

      const section = await ctx.runMutation(renameMoodboardSectionMutationRef, {
        projectId: args.projectId,
        sectionId: args.sectionId,
        title: nextName,
      });

      return {
        success: true,
        sectionId: section.id,
        message: "Moodboard section updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update moodboard section: ${error}`,
      };
    }
  },
});

export const deleteConfirmedMoodboardSection = action({
  args: {
    projectId: v.id("projects"),
    sectionId: v.string(),
    userClerkId: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    deletedFilesCount: v.optional(v.number()),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await ensureProjectAccess(ctx, args.projectId, true, args.userClerkId);

      const result = await ctx.runMutation(deleteMoodboardSectionMutationRef, {
        projectId: args.projectId,
        sectionId: args.sectionId,
      });

      return {
        success: true,
        deletedFilesCount: result.deletedFilesCount,
        message:
          result.deletedFilesCount > 0
            ? `Moodboard section deleted with ${result.deletedFilesCount} image${result.deletedFilesCount === 1 ? "" : "s"}`
            : "Moodboard section deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete moodboard section: ${error}`,
      };
    }
  },
});
