/**
 * Confirmed Actions - Notes
 * 
 * Note CRUD operations that require user confirmation from AI suggestions.
 */

import { action } from "../../_generated/server";
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { ensureProjectAccess } from "./helpers";

const createNoteMutationRef = makeFunctionReference<"mutation">("notes:createNote");
const getNoteQueryRef = makeFunctionReference<"query">("notes:getNote");
const updateNoteMutationRef = makeFunctionReference<"mutation">("notes:updateNote");
const deleteNoteMutationRef = makeFunctionReference<"mutation">("notes:deleteNote");

function hasDefinedUpdates(updates: Record<string, unknown>): boolean {
  return Object.values(updates).some((value) => value !== undefined);
}

export const createConfirmedNote = action({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.optional(v.string()),
    noteData: v.object({
      title: v.string(),
      content: v.string(),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    noteId: v.optional(v.id("notes")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await ensureProjectAccess(ctx, args.projectId, true, args.userClerkId);

      const noteId: any = await ctx.runMutation(createNoteMutationRef, {
        projectId: args.projectId,
        title: args.noteData.title,
        content: args.noteData.content,
      });

      return {
        success: true,
        noteId,
        message: "Note created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create note: ${error}`,
      };
    }
  },
});

export const editConfirmedNote = action({
  args: {
    projectId: v.optional(v.id("projects")),
    userClerkId: v.optional(v.string()),
    noteId: v.id("notes"),
    updates: v.object({
      title: v.optional(v.string()),
      content: v.optional(v.string()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      if (!hasDefinedUpdates(args.updates)) {
        throw new Error("No valid note update fields were provided");
      }

      const currentNote = await ctx.runQuery(getNoteQueryRef, { noteId: args.noteId });
      if (!currentNote) {
        return {
          success: false,
          message: "Note not found",
        };
      }

      if (args.projectId && currentNote.projectId !== args.projectId) {
        return {
          success: false,
          message: "Note does not belong to the active project",
        };
      }

      await ensureProjectAccess(ctx, args.projectId ?? currentNote.projectId, true, args.userClerkId);

      await ctx.runMutation(updateNoteMutationRef, {
        noteId: args.noteId,
        title:
          Object.prototype.hasOwnProperty.call(args.updates, "title")
            ? args.updates.title ?? currentNote.title
            : currentNote.title,
        content:
          Object.prototype.hasOwnProperty.call(args.updates, "content")
            ? args.updates.content ?? currentNote.content
            : currentNote.content,
      });

      return {
        success: true,
        message: "Note updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update note: ${error}`,
      };
    }
  },
});

export const deleteConfirmedNote = action({
  args: {
    noteId: v.id("notes"),
    userClerkId: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const note = await ctx.runQuery(getNoteQueryRef, { noteId: args.noteId });
      if (!note) {
        throw new Error("Note not found");
      }
      await ensureProjectAccess(ctx, note.projectId, true, args.userClerkId);

      await ctx.runMutation(deleteNoteMutationRef, {
        noteId: args.noteId,
      });

      return {
        success: true,
        message: "Note deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete note: ${error}`,
      };
    }
  },
});















