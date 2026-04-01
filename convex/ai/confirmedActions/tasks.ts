/**
 * Confirmed Actions - Tasks
 * 
 * Task CRUD operations that require user confirmation from AI suggestions.
 */

import { action } from "../../_generated/server";
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { ensureProjectAccess, parseOptionalDateToMillis } from "./helpers";

const getTaskQueryRef = makeFunctionReference<"query">("tasks:getTask");
const createTaskInternalMutationRef =
  makeFunctionReference<"mutation">("tasks:createTaskInternal");
const updateTaskInternalMutationRef =
  makeFunctionReference<"mutation">("tasks:updateTaskInternal");
const deleteTaskInternalMutationRef =
  makeFunctionReference<"mutation">("tasks:deleteTaskInternal");

export const createConfirmedTask = action({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.optional(v.string()),
    taskData: v.object({
      title: v.string(),
      status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("review"), v.literal("done"))),
      description: v.optional(v.string()),
      content: v.optional(v.string()),
      assignedTo: v.optional(v.union(v.string(), v.null())),
      priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    taskId: v.optional(v.id("tasks")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const { clerkUserId, project } = await ensureProjectAccess(
        ctx,
        args.projectId,
        true,
        args.userClerkId,
      );

      const startDateNumber = parseOptionalDateToMillis(
        args.taskData.startDate,
        "task startDate",
      );
      const endDateNumber = parseOptionalDateToMillis(
        args.taskData.endDate,
        "task endDate",
      );

      const taskId = await ctx.runMutation(createTaskInternalMutationRef, {
        actorClerkUserId: clerkUserId,
        projectId: args.projectId,
        teamId: project.teamId,
        title: args.taskData.title,
        description: args.taskData.description,
        content: args.taskData.content,
        assignedTo: args.taskData.assignedTo,
        priority: args.taskData.priority || "medium",
        status: args.taskData.status || "todo",
        startDate: startDateNumber,
        endDate: endDateNumber,
        tags: args.taskData.tags || [],
      });

      return {
        success: true,
        taskId,
        message: "Task created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create task: ${error}`,
      };
    }
  },
});

export const editConfirmedTask = action({
  args: {
    projectId: v.optional(v.id("projects")),
    userClerkId: v.optional(v.string()),
    taskId: v.id("tasks"),
    updates: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      content: v.optional(v.string()),
      status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("review"), v.literal("done"))),
      assignedTo: v.optional(v.union(v.string(), v.null())),
      priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const task = await ctx.runQuery(getTaskQueryRef, { taskId: args.taskId });
      if (!task) {
        throw new Error("Task not found");
      }
      if (args.projectId && task.projectId !== args.projectId) {
        throw new Error("Task does not belong to the active project");
      }
      const { clerkUserId } = await ensureProjectAccess(
        ctx,
        args.projectId ?? task.projectId,
        true,
        args.userClerkId,
      );

      const startDateNumber = parseOptionalDateToMillis(
        args.updates.startDate,
        "task startDate",
      );
      const endDateNumber = parseOptionalDateToMillis(
        args.updates.endDate,
        "task endDate",
      );

      await ctx.runMutation(updateTaskInternalMutationRef, {
        actorClerkUserId: clerkUserId,
        taskId: args.taskId,
        title: args.updates.title,
        description: args.updates.description,
        content: args.updates.content,
        status: args.updates.status,
        assignedTo: args.updates.assignedTo,
        priority: args.updates.priority,
        startDate: startDateNumber,
        endDate: endDateNumber,
        tags: args.updates.tags,
      });

      return {
        success: true,
        message: "Task updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update task: ${error}`,
      };
    }
  },
});

export const deleteConfirmedTask = action({
  args: {
    taskId: v.id("tasks"),
    userClerkId: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const task = await ctx.runQuery(getTaskQueryRef, { taskId: args.taskId });
      if (!task) {
        throw new Error("Task not found");
      }
      const { clerkUserId } = await ensureProjectAccess(
        ctx,
        task.projectId,
        true,
        args.userClerkId,
      );

      await ctx.runMutation(deleteTaskInternalMutationRef, {
        actorClerkUserId: clerkUserId,
        taskId: args.taskId,
      });

      return {
        success: true,
        message: "Task deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete task: ${error}`,
      };
    }
  },
});












