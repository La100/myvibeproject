/**
 * Confirmed Actions - Notes
 * 
 * Note CRUD operations that require user confirmation from AI suggestions.
 */

import { action } from "../../_generated/server";
import { v } from "convex/values";
import { api } from "../../_generated/api";
import { ensureProjectAccess } from "./helpers";

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

      const noteId: any = await ctx.runMutation(api.notes.createNote, {
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
      const currentNote = await ctx.runQuery(api.notes.getNote, { noteId: args.noteId });
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

      await ctx.runMutation(api.notes.updateNote, {
        noteId: args.noteId,
        title: args.updates.title || currentNote.title,
        content: args.updates.content || currentNote.content,
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
      const note = await ctx.runQuery(api.notes.getNote, { noteId: args.noteId });
      if (!note) {
        throw new Error("Note not found");
      }
      await ensureProjectAccess(ctx, note.projectId, true, args.userClerkId);

      await ctx.runMutation(api.notes.deleteNote, {
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

















