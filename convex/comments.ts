import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";

export const addComment = mutation({
    args: {
        taskId: v.id("tasks"),
        content: v.string(),
        parentId: v.optional(v.id("comments")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const task = await ctx.db.get(args.taskId);
        if (!task) {
            throw new Error("Task not found");
        }

        const hasAccess = await ctx.runQuery(api.projects.checkUserProjectAccess, {
            projectId: task.projectId,
        });

        if (!hasAccess) {
            throw new Error("You don't have permission to comment on this task.");
        }

        const commentId = await ctx.db.insert("comments", {
            authorId: identity.subject,
            taskId: args.taskId,
            projectId: task.projectId,
            teamId: task.teamId,
            content: args.content,
            parentCommentId: args.parentId,
            isEdited: false,
        });

        // Log activity for task comment
        await ctx.runMutation(internal.activityLog.logActivity, {
            teamId: task.teamId,
            projectId: task.projectId,
            taskId: args.taskId,
            actionType: "task.comment.add",
            details: { taskTitle: task.title, commentPreview: args.content.substring(0, 100) },
            entityId: commentId,
            entityType: "comment",
        });

        return commentId;
    },
});

export const getCommentsForTask = query({
    args: {
        taskId: v.id("tasks"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const task = await ctx.db.get(args.taskId);
        if (!task) {
            return [];
        }

        const hasAccess = await ctx.runQuery(api.projects.checkUserProjectAccess, {
            projectId: task.projectId,
        });

        if (!hasAccess) {
            return [];
        }

        const comments = await ctx.db
            .query("comments")
            .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
            .order("desc")
            .collect();

        const commentsWithAuthors = await Promise.all(
            comments.map(async (comment) => {
                const author = await ctx.db
                    .query("users")
                    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", comment.authorId))
                    .unique();
                return {
                    ...comment,
                    authorName: author?.name,
                    authorImageUrl: author?.imageUrl,
                };
            })
        );

        return commentsWithAuthors;
    },
});
