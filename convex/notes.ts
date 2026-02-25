import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Utility function to check project access
const hasProjectAccess = async (ctx: any, projectId: Id<"projects">, requireWriteAccess = false): Promise<boolean> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const project = await ctx.db.get(projectId);
    if (!project) return false;

    const membership = await ctx.db
        .query("teamMembers")
        .withIndex("by_team_and_user", (q: any) =>
            q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
        )
        .filter((q: any) => q.eq(q.field("isActive"), true))
        .first();

    if (!membership) return false;
    
    if (membership.role === 'admin') {
        return true;
    }
    
    if (membership.role === 'member') {
        if (membership.projectIds && membership.projectIds.length > 0) {
            return membership.projectIds.includes(projectId);
        }
        return true;
    }
    
    return false;
};

// Get all notes for a project
export const getProjectNotes = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        const hasAccess = await hasProjectAccess(ctx, args.projectId);
        if (!hasAccess) {
            throw new Error("Access denied");
        }

        const notes = await ctx.db
            .query("notes")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .order("desc")
            .collect();

        // Get user details for each note
        const notesWithUsers = await Promise.all(
            notes.map(async (note) => {
                const user = await ctx.db
                    .query("users")
                    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", note.createdBy))
                    .first();

                return {
                    ...note,
                    createdByUser: user ? {
                        name: user.name || "Unknown User",
                        imageUrl: user.imageUrl
                    } : {
                        name: "Unknown User",
                        imageUrl: undefined
                    }
                };
            })
        );

        return notesWithUsers;
    },
});

// Create a new note
export const createNote = mutation({
    args: {
        title: v.string(),
        content: v.string(),
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const hasAccess = await hasProjectAccess(ctx, args.projectId, true);
        if (!hasAccess) {
            throw new Error("Access denied");
        }

        const project = await ctx.db.get(args.projectId);
        if (!project) {
            throw new Error("Project not found");
        }

        const now = Date.now();
        const noteId = await ctx.db.insert("notes", {
            title: args.title,
            content: args.content,
            projectId: args.projectId,
            teamId: project.teamId,
            createdBy: identity.subject,
            createdAt: now,
            updatedAt: now,
        });

        return noteId;
    },
});

// Update a note
export const updateNote = mutation({
    args: {
        noteId: v.id("notes"),
        title: v.string(),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const note = await ctx.db.get(args.noteId);
        if (!note) {
            throw new Error("Note not found");
        }

        const hasAccess = await hasProjectAccess(ctx, note.projectId, true);
        if (!hasAccess) {
            throw new Error("Access denied");
        }

        // Only allow the creator or admin to edit
        const membership = await ctx.db
            .query("teamMembers")
            .withIndex("by_team_and_user", (q) =>
                q.eq("teamId", note.teamId).eq("clerkUserId", identity.subject)
            )
            .filter((q) => q.eq(q.field("isActive"), true))
            .first();

        if (!membership || (note.createdBy !== identity.subject && membership.role !== 'admin')) {
            throw new Error("Permission denied");
        }

        await ctx.db.patch(args.noteId, {
            title: args.title,
            content: args.content,
            updatedAt: Date.now(),
        });

        return args.noteId;
    },
});

// Delete a note
export const deleteNote = mutation({
    args: { noteId: v.id("notes") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const note = await ctx.db.get(args.noteId);
        if (!note) {
            throw new Error("Note not found");
        }

        const hasAccess = await hasProjectAccess(ctx, note.projectId, true);
        if (!hasAccess) {
            throw new Error("Access denied");
        }

        // Only allow the creator or admin to delete
        const membership = await ctx.db
            .query("teamMembers")
            .withIndex("by_team_and_user", (q) =>
                q.eq("teamId", note.teamId).eq("clerkUserId", identity.subject)
            )
            .filter((q) => q.eq(q.field("isActive"), true))
            .first();

        if (!membership || (note.createdBy !== identity.subject && membership.role !== 'admin')) {
            throw new Error("Permission denied");
        }

        await ctx.db.delete(args.noteId);

        return args.noteId;
    },
});

// Get a single note by ID
export const getNote = query({
    args: { noteId: v.id("notes") },
    handler: async (ctx, args) => {
        const note = await ctx.db.get(args.noteId);
        if (!note) {
            return null;
        }

        const hasAccess = await hasProjectAccess(ctx, note.projectId);
        if (!hasAccess) {
            throw new Error("Access denied");
        }

        // Get user details
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", note.createdBy))
            .first();

        return {
            ...note,
            createdByUser: user ? {
                name: user.name || "Unknown User",
                imageUrl: user.imageUrl
            } : {
                name: "Unknown User",
                imageUrl: undefined
            }
        };
    },
});

export const getNotesForIndexing = internalQuery({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        const notes = await ctx.db
            .query("notes")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .collect();

        return notes;
    },
});

export const getNoteById = internalQuery({
    args: { noteId: v.id("notes") },
    handler: async (ctx, args) => {
        const note = await ctx.db.get(args.noteId);
        return note;
    },
});

export const getNotesChangedAfter = internalQuery({
    args: {
        projectId: v.id("projects"),
        since: v.number()
    },
    handler: async (ctx, args) => {
        const notes = await ctx.db
            .query("notes")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .filter((q) => q.gte(q.field("updatedAt"), args.since))
            .collect();

        return notes;
    },
});
