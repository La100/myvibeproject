/* eslint-disable @typescript-eslint/no-explicit-any */
import { internalAction, internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Search tools for AI Agent
 * These allow the AI to search for tasks, shopping items, etc. on-demand
 * instead of loading all data upfront
 */

type InternalRagApi = {
  getProjectTasks: any;
  getProjectShoppingItems: any;
  getProjectNotes: any;
  getProjectSurveys: any;
  getSurveyQuestionsById: any;
  getTeamContacts: any;
  getProjectLaborItems: any;
};

const getInternalRagApi = (): InternalRagApi => {
  // Keep this runtime-loaded to avoid deep type instantiation in TS.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const apiModule = require("../_generated/api") as { internal: unknown };
  return (apiModule.internal as { rag: InternalRagApi }).rag;
};

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
    const ragApi = getInternalRagApi();

    // Get all tasks for the project
    const allTasks = await ctx.runQuery(ragApi.getProjectTasks, {
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
    const ragApi = getInternalRagApi();

    // Get all shopping items for the project
    const allItems = await ctx.runQuery(ragApi.getProjectShoppingItems, {
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
    const ragApi = getInternalRagApi();

    // Get all notes for the project
    const allNotes = await ctx.runQuery(ragApi.getProjectNotes, {
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
    const ragApi = getInternalRagApi();

    // Get all surveys for the project
    const allSurveys = await ctx.runQuery(ragApi.getProjectSurveys, {
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
        const questions = await ctx.runQuery(ragApi.getSurveyQuestionsById, {
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
    const ragApi = getInternalRagApi();

    // Get all contacts for the team
    const allContacts = await ctx.runQuery(ragApi.getTeamContacts, {
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
    const ragApi = getInternalRagApi();

    // Get all labor items for the project
    const allItems = await ctx.runQuery(ragApi.getProjectLaborItems, {
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

export const searchMoodboard = internalQuery({
  args: {
    projectId: v.id("projects"),
    query: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    count: v.number(),
    total: v.number(),
    sections: v.array(v.any()),
    images: v.array(v.any()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return {
        count: 0,
        total: 0,
        sections: [],
        images: [],
      };
    }

    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.neq(q.field("moodboardSection"), undefined))
      .collect();

    const sectionsFromProject = Array.isArray(project.moodboardSections)
      ? project.moodboardSections
          .filter(
            (section): section is { id: string; title: string; order: number } =>
              !!section &&
              typeof section === "object" &&
              typeof (section as { id?: unknown }).id === "string" &&
              typeof (section as { title?: unknown }).title === "string" &&
              typeof (section as { order?: unknown }).order === "number",
          )
          .map((section) => ({
            id: section.id.trim(),
            title: section.title.trim(),
            order: section.order,
          }))
      : [];

    const sectionMap = new Map<
      string,
      {
        id: string;
        title: string;
        order: number;
        imageCount: number;
        latestImageName?: string;
        latestCreatedAt?: number;
      }
    >();

    for (const section of sectionsFromProject) {
      sectionMap.set(section.id, {
        ...section,
        imageCount: 0,
      });
    }

    const allImages = files
      .map((file) => {
        const sectionId = file.moodboardSection?.trim();
        if (!sectionId) return null;

        const existingSection = sectionMap.get(sectionId);
        if (!existingSection) {
          sectionMap.set(sectionId, {
            id: sectionId,
            title: sectionId,
            order: Number.MAX_SAFE_INTEGER,
            imageCount: 0,
          });
        }

        const summary = sectionMap.get(sectionId)!;
        summary.imageCount += 1;
        if (
          !summary.latestImageName ||
          file._creationTime > (summary.latestCreatedAt ?? 0)
        ) {
          summary.latestImageName = file.name;
          summary.latestCreatedAt = file._creationTime;
        }

        return {
          id: String(file._id),
          name: file.name,
          storageId: file.storageId,
          sectionId,
          sectionTitle: summary.title,
          fileType: file.fileType,
          createdAt: file._creationTime,
        };
      })
      .filter((image): image is NonNullable<typeof image> => Boolean(image));

    let filteredSections = Array.from(sectionMap.values()).map((section) => {
      const { latestCreatedAt, ...sectionSummary } = section;
      void latestCreatedAt;
      return sectionSummary;
    });
    let filteredImages = allImages;

    if (args.query && args.query.trim().length > 0) {
      const queryLower = args.query.toLowerCase();
      filteredSections = filteredSections.filter((section) => {
        return (
          section.title.toLowerCase().includes(queryLower) ||
          section.id.toLowerCase().includes(queryLower) ||
          (section.latestImageName ?? "").toLowerCase().includes(queryLower)
        );
      });
      filteredImages = filteredImages.filter((image) => {
        return (
          image.name.toLowerCase().includes(queryLower) ||
          image.sectionTitle.toLowerCase().includes(queryLower) ||
          image.sectionId.toLowerCase().includes(queryLower)
        );
      });
    }

    filteredSections.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    filteredImages.sort((a, b) => b.createdAt - a.createdAt);

    const sectionResults = filteredSections.slice(0, limit);
    const imageResults = filteredImages.slice(0, limit);

    return {
      count: sectionResults.length + imageResults.length,
      total: filteredSections.length + filteredImages.length,
      sections: sectionResults,
      images: imageResults,
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
/* eslint-enable @typescript-eslint/no-explicit-any */
