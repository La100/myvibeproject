import { internalQuery } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";

// Internal queries: Pobierz dane do indeksowania
export const getProjectTasks = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Add assignedToName for each task
    return await Promise.all(
      tasks.map(async (task) => {
        let assignedToName: string | undefined;
        if (task.assignedTo) {
          const user = await ctx.db.query("users").withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", task.assignedTo!)).unique();
          if (user) { assignedToName = user.name || user.email; }
        }
        return { ...task, assignedToName };
      })
    );
  },
});

export const getProjectNotes = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const getProjectShoppingItems = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const [items, sections, sets] = await Promise.all([
      ctx.db
        .query("shoppingListItems")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
      ctx.db
        .query("shoppingListSections")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
      ctx.db
        .query("shoppingSets")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
    ]);

    const sectionMap = new Map(sections.map((s) => [s._id, s.name]));
    const setMap = new Map(sets.map((set) => [set._id, set]));

    return items.map((item) => ({
      ...(item.setId
        ? (() => {
            const set = setMap.get(item.setId);
            return {
              ...item,
              sectionName: item.sectionId ? sectionMap.get(item.sectionId) : undefined,
              setTitle: set?.title,
              setType: set?.setType,
              isPreferredInSet: !!set?.preferredItemIds?.some((id) => id === item._id),
              isResolvedInSet: !!set?.resolvedItemIds?.some((id) => id === item._id),
            };
          })()
        : {
            ...item,
            sectionName: item.sectionId ? sectionMap.get(item.sectionId) : undefined,
            setTitle: undefined,
            setType: undefined,
            isPreferredInSet: false,
            isResolvedInSet: false,
          }),
    }));
  },
});

export const getProjectContacts = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    // Pobierz kontakty przypisane do projektu
    const projectContacts = await ctx.db
      .query("projectContacts")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const contacts: Doc<"contacts">[] = [];
    for (const pc of projectContacts) {
      const contact = await ctx.db.get(pc.contactId);
      if (contact) {
        contacts.push(contact);
      }
    }
    return contacts;
  },
});

export const getProjectSurveys = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("surveys")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const getTeamContacts = internalQuery({
  args: { teamSlug: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_slug", (q) => q.eq("slug", args.teamSlug))
      .unique();

    if (!team) return [];

    return await ctx.db
      .query("contacts")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const getProjectLaborItems = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("laborItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

// Helper queries
export const getTaskById = internalQuery({
  args: { taskId: v.id("tasks") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    // Add assignedToName
    let assignedToName: string | undefined;
    if (task.assignedTo) {
      const user = await ctx.db.query("users").withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", task.assignedTo!)).unique();
      if (user) { assignedToName = user.name || user.email; }
    }
    return { ...task, assignedToName };
  },
});

export const getNoteById = internalQuery({
  args: { noteId: v.id("notes") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.noteId);
  },
});

export const getShoppingItemById = internalQuery({
  args: { itemId: v.id("shoppingListItems") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.itemId);
  },
});

export const getContactById = internalQuery({
  args: { contactId: v.id("contacts") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.contactId);
  },
});

export const getSurveyById = internalQuery({
  args: { surveyId: v.id("surveys") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.surveyId);
  },
});

export const getSurveyQuestionsById = internalQuery({
  args: { surveyId: v.id("surveys") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("surveyQuestions")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.surveyId))
      .order("asc")
      .collect();
  },
});
