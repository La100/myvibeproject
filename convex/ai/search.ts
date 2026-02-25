import { internalAction, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

/**
 * Search tools for AI Agent
 * These allow the AI to search for tasks, shopping items, etc. on-demand
 * instead of loading all data upfront
 */

export const searchTasks = internalAction({
  args: {
    projectId: v.id("projects"),
    query: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done")
    )),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    count: v.number(),
    total: v.number(),
    tasks: v.array(v.any()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    // Get all tasks for the project
    const allTasks = await ctx.runQuery(internal.rag.getProjectTasks, {
      projectId: args.projectId,
    }) as any[];

    let filteredTasks: any[] = allTasks;

    // Filter by status if provided
    if (args.status) {
      filteredTasks = filteredTasks.filter((task: any) => task.status === args.status);
    }

    // Search by query if provided
    if (args.query && args.query.trim().length > 0) {
      const queryLower = args.query.toLowerCase();
      filteredTasks = filteredTasks.filter((task: any) => {
        const titleMatch = task.title?.toLowerCase().includes(queryLower);
        const descMatch = task.description?.toLowerCase().includes(queryLower);
        const assigneeMatch = task.assignedToName?.toLowerCase().includes(queryLower);
        const tagsMatch = task.tags?.some((tag: string) => tag.toLowerCase().includes(queryLower));
        return titleMatch || descMatch || assigneeMatch || tagsMatch;
      });
    }

    // Sort by creation time (most recent first)
    filteredTasks.sort((a: any, b: any) => (b._creationTime || 0) - (a._creationTime || 0));

    // Limit results
    const results = filteredTasks.slice(0, limit);

    return {
      count: results.length,
      total: filteredTasks.length,
      tasks: results,
    };
  },
});

export const searchShoppingItems = internalAction({
  args: {
    projectId: v.id("projects"),
    query: v.optional(v.string()),
    completed: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    count: v.number(),
    total: v.number(),
    items: v.array(v.any()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    // Get all shopping items for the project
    const allItems = await ctx.runQuery(internal.rag.getProjectShoppingItems, {
      projectId: args.projectId,
    }) as any[];

    let filteredItems: any[] = allItems;

    // Filter by completion status if provided
    if (args.completed !== undefined) {
      filteredItems = filteredItems.filter((item: any) => {
        const isCompleted = item.realizationStatus === "COMPLETED";
        return isCompleted === args.completed;
      });
    }

    // Search by query if provided
    if (args.query && args.query.trim().length > 0) {
      const queryLower = args.query.toLowerCase();
      filteredItems = filteredItems.filter((item: any) => {
        const nameMatch = item.name?.toLowerCase().includes(queryLower);
        const notesMatch = item.notes?.toLowerCase().includes(queryLower);
        const categoryMatch = item.category?.toLowerCase().includes(queryLower);
        const supplierMatch = item.supplier?.toLowerCase().includes(queryLower);
        const sectionMatch = item.sectionName?.toLowerCase().includes(queryLower);
        return nameMatch || notesMatch || categoryMatch || supplierMatch || sectionMatch;
      });
    }

    // Sort by creation time (most recent first)
    filteredItems.sort((a: any, b: any) => (b._creationTime || 0) - (a._creationTime || 0));

    // Limit results
    const results = filteredItems.slice(0, limit);

    return {
      count: results.length,
      total: filteredItems.length,
      items: results,
    };
  },
});

export const searchNotes = internalAction({
  args: {
    projectId: v.id("projects"),
    query: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    count: v.number(),
    total: v.number(),
    notes: v.array(v.any()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    // Get all notes for the project
    const allNotes = await ctx.runQuery(internal.rag.getProjectNotes, {
      projectId: args.projectId,
    }) as any[];

    let filteredNotes: any[] = allNotes;

    // Search by query if provided
    if (args.query && args.query.trim().length > 0) {
      const queryLower = args.query.toLowerCase();
      filteredNotes = filteredNotes.filter((note: any) => {
        const titleMatch = note.title?.toLowerCase().includes(queryLower);
        const contentMatch = note.content?.toLowerCase().includes(queryLower);
        return titleMatch || contentMatch;
      });
    }

    // Sort by update time (most recent first)
    filteredNotes.sort((a: any, b: any) => (b.updatedAt || b._creationTime || 0) - (a.updatedAt || a._creationTime || 0));

    // Limit results
    const results = filteredNotes.slice(0, limit);

    return {
      count: results.length,
      total: filteredNotes.length,
      notes: results,
    };
  },
});

export const searchSurveys = internalAction({
  args: {
    projectId: v.id("projects"),
    query: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("closed"),
      v.literal("completed"),
      v.literal("archived")
    )),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    count: v.number(),
    total: v.number(),
    surveys: v.array(v.any()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    // Get all surveys for the project
    const allSurveys = await ctx.runQuery(internal.rag.getProjectSurveys, {
      projectId: args.projectId,
    }) as any[];

    let filteredSurveys: any[] = allSurveys;

    // Filter by status if provided
    if (args.status) {
      const normalizedStatus = args.status === "completed" || args.status === "archived"
        ? "closed"
        : args.status;
      filteredSurveys = filteredSurveys.filter((survey: any) => survey.status === normalizedStatus);
    }

    // Search by query if provided
    if (args.query && args.query.trim().length > 0) {
      const queryLower = args.query.toLowerCase();
      filteredSurveys = filteredSurveys.filter((survey: any) => {
        const titleMatch = survey.title?.toLowerCase().includes(queryLower);
        const descMatch = survey.description?.toLowerCase().includes(queryLower);
        return titleMatch || descMatch;
      });
    }

    // Sort by creation time (most recent first)
    filteredSurveys.sort((a: any, b: any) => (b._creationTime || 0) - (a._creationTime || 0));

    // Limit results
    const results = filteredSurveys.slice(0, limit);
    const surveysWithQuestions = await Promise.all(
      results.map(async (survey: any) => {
        const questions = await ctx.runQuery(internal.rag.getSurveyQuestionsById, {
          surveyId: survey._id,
        }) as any[];

        return {
          ...survey,
          questions,
        };
      }),
    );

    return {
      count: surveysWithQuestions.length,
      total: filteredSurveys.length,
      surveys: surveysWithQuestions,
    };
  },
});

export const searchContacts = internalAction({
  args: {
    teamSlug: v.string(),
    query: v.optional(v.string()),
    type: v.optional(v.union(
      v.literal("contractor"),
      v.literal("supplier"),
      v.literal("subcontractor"),
      v.literal("other")
    )),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    count: v.number(),
    total: v.number(),
    contacts: v.array(v.any()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    // Get all contacts for the team
    const allContacts = await ctx.runQuery(internal.rag.getTeamContacts, {
      teamSlug: args.teamSlug,
    }) as any[];

    let filteredContacts: any[] = allContacts;

    // Filter by type if provided
    if (args.type) {
      filteredContacts = filteredContacts.filter((contact: any) => contact.type === args.type);
    }

    // Search by query if provided
    if (args.query && args.query.trim().length > 0) {
      const queryLower = args.query.toLowerCase();
      filteredContacts = filteredContacts.filter((contact: any) => {
        const nameMatch = contact.name?.toLowerCase().includes(queryLower);
        const companyMatch = contact.companyName?.toLowerCase().includes(queryLower);
        const emailMatch = contact.email?.toLowerCase().includes(queryLower);
        const phoneMatch = contact.phone?.toLowerCase().includes(queryLower);
        const notesMatch = contact.notes?.toLowerCase().includes(queryLower);
        return nameMatch || companyMatch || emailMatch || phoneMatch || notesMatch;
      });
    }

    // Sort by creation time (most recent first)
    filteredContacts.sort((a: any, b: any) => (b._creationTime || 0) - (a._creationTime || 0));

    // Limit results
    const results = filteredContacts.slice(0, limit);

    return {
      count: results.length,
      total: filteredContacts.length,
      contacts: results,
    };
  },
});

export const searchLaborItems = internalAction({
  args: {
    projectId: v.id("projects"),
    query: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    count: v.number(),
    total: v.number(),
    items: v.array(v.any()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    // Get all labor items for the project
    const allItems = await ctx.runQuery(internal.rag.getProjectLaborItems, {
      projectId: args.projectId,
    }) as any[];

    let filteredItems: any[] = allItems;

    // Search by query if provided
    if (args.query && args.query.trim().length > 0) {
      const queryLower = args.query.toLowerCase();
      filteredItems = filteredItems.filter((item: any) => {
        const nameMatch = item.name?.toLowerCase().includes(queryLower);
        const notesMatch = item.notes?.toLowerCase().includes(queryLower);
        const unitMatch = item.unit?.toLowerCase().includes(queryLower);
        return nameMatch || notesMatch || unitMatch;
      });
    }

    // Sort by creation time (most recent first)
    filteredItems.sort((a: any, b: any) => (b._creationTime || 0) - (a._creationTime || 0));

    // Limit results
    const results = filteredItems.slice(0, limit);

    return {
      count: results.length,
      total: filteredItems.length,
      items: results,
    };
  },
});

/**
 * Get a single item by ID - used for edit operations to fetch original data
 */
export const getItemById = internalQuery({
  args: {
    tableName: v.string(),
    itemId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Direct DB lookup is faster and avoids auth issues in nested queries
      // We trust the calling function (listPendingItems) to verify access if needed
      // or we accept that AI needs to see the item to edit it.
      const item = await ctx.db.get(args.itemId as any);
      return item;
    } catch (error) {
      console.error(`Failed to fetch ${args.tableName} item ${args.itemId}:`, error);
      return null;
    }
  },
});
