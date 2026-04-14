import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { canAccessProjectWithMembership, ensureProjectAccess } from "./authz";

async function getActiveTeamMember(ctx: any, teamId: Id<"teams">, clerkUserId: string) {
  return await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q: any) => q.eq("clerkUserId", clerkUserId))
    .filter((q: any) =>
      q.and(
        q.eq(q.field("teamId"), teamId),
        q.eq(q.field("isActive"), true),
      ),
    )
    .unique();
}

export const getTeamsAndProjects = query({
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { user: null, teams: [] };
    }
    const clerkUserId = identity.subject;

    const user = {
      id: clerkUserId,
      name: identity.name,
      email: identity.email,
    };

    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("clerkUserId", clerkUserId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    if (memberships.length === 0) {
      return { user, teams: [] };
    }

    const teamIds = [...new Set(memberships.map((m) => m.teamId))];

    const membershipsByTeamId = new Map(
      memberships.map((membership) => [String(membership.teamId), membership]),
    );

    const teams = await Promise.all(
      teamIds.map(async (teamId) => {
        const team = await ctx.db.get(teamId);
        if (!team) return null;
        const membership = membershipsByTeamId.get(String(teamId));
        if (!membership) return null;

        // Fetch projects for this specific team
        const allProjects = await ctx.db
          .query("projects")
          .withIndex("by_team", (q) => q.eq("teamId", teamId))
          .collect();

        const projects = membership.role === "admin"
          ? allProjects
          : allProjects.filter((project) =>
              canAccessProjectWithMembership(membership, project._id),
            );
        
        // Dla każdego projektu pobierz od razu jego sekcje
        const projectsWithSections = await Promise.all(
          projects.map(async (project) => {
            const sections = await ctx.db
              .query("shoppingListSections")
              .withIndex("by_project", (q) => q.eq("projectId", project._id))
              .collect();
            return { ...project, sections };
          })
        );
        
        projectsWithSections.sort((a, b) => a.name.localeCompare(b.name));

        return {
          team,
          projects: projectsWithSections,
        };
      })
    );

    const validTeams = teams.filter((t) => t !== null) as { team: Doc<"teams">; projects: (Doc<"projects"> & { sections: Doc<"shoppingListSections">[] })[] }[];

    validTeams.sort((a, b) => a.team.name.localeCompare(b.team.name));

    // Mapujemy do prostej struktury, której oczekuje frontend
    const finalTeams = validTeams.map(item => ({
      ...item.team, // Rozpakowujemy cały obiekt team
      projects: item.projects // Dołączamy do niego listę projektów
    }));

    return { user, teams: finalTeams };
  },
});

export const getProjectsForTeam = query({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const member = await getActiveTeamMember(ctx, args.teamId, identity.subject);

    if (!member) {
      throw new Error("You are not a member of this team or you must be logged in.");
    }

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    if (member.role === "admin") {
      return projects;
    }

    return projects.filter((project) => canAccessProjectWithMembership(member, project._id));
  },
});

export const saveProduct = mutation({
    args: {
        projectId: v.id("projects"),
        teamId: v.id("teams"),
        name: v.string(),
        notes: v.optional(v.string()),
        supplier: v.optional(v.string()),
        catalogNumber: v.optional(v.string()),
        quantity: v.optional(v.number()),
        price: v.optional(v.number()),
        productLink: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { project, clerkUserId } = await ensureProjectAccess(ctx, args.projectId);
        if (project.teamId !== args.teamId) {
          throw new Error("Project does not belong to this team");
        }

        const quantity = args.quantity ?? 1;
        const totalPrice = args.price ? quantity * args.price : undefined;

        return await ctx.db.insert("shoppingListItems", {
            projectId: args.projectId,
            teamId: project.teamId,
            createdBy: clerkUserId,
            name: args.name,
            notes: args.notes,
            supplier: args.supplier,
            catalogNumber: args.catalogNumber,
            quantity: quantity,
            unitPrice: args.price,
            productLink: args.productLink,
            imageUrl: args.imageUrl,
            totalPrice,
            completed: false,
            priority: "medium",
            realizationStatus: "PLANNED",
        });
    },
});

/**
 * Zapytanie do pobierania sekcji listy zakupów dla projektu.
 * Dostępne tylko dla zalogowanych użytkowników.
 */
export const getShoppingListSections = query({
  args: {
    projectId: v.id("projects"),
    teamId: v.id("teams"),
  },
  handler: async (ctx, args): Promise<Doc<"shoppingListSections">[]> => {
    const { project } = await ensureProjectAccess(ctx, args.projectId);
    if (project.teamId !== args.teamId) {
      throw new Error("Project does not belong to the selected team");
    }

    return await ctx.db
      .query("shoppingListSections")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const getShoppingSetsForProject = query({
  args: {
    projectId: v.id("projects"),
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const { project } = await ensureProjectAccess(ctx, args.projectId);
    if (project.teamId !== args.teamId) {
      throw new Error("Project does not belong to the selected team");
    }

    const sets = await ctx.db
      .query("shoppingSets")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return sets.map((set) => ({
      _id: set._id,
      title: set.title,
      sectionId: set.sectionId ?? null,
      setType: set.setType,
    }));
  },
});

/**
 * Mutacja do dodawania nowego przedmiotu do listy zakupów z rozszerzenia.
 */
export const addShoppingListItem = mutation({
  args: {
    name: v.string(),
    projectId: v.id("projects"),
    sectionId: v.optional(v.id("shoppingListSections")),
    setId: v.optional(v.id("shoppingSets")),
    unitPrice: v.optional(v.number()),
    quantity: v.number(),
    totalPrice: v.optional(v.number()),
    supplier: v.optional(v.string()),
    catalogNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
    productLink: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    realizationStatus: v.union(
        v.literal("PLANNED"),
        v.literal("ORDERED"),
        v.literal("IN_TRANSIT"),
        v.literal("DELIVERED"),
        v.literal("COMPLETED"),
        v.literal("CANCELLED")
      ),
  },
  handler: async (ctx, args): Promise<Id<"shoppingListItems">> => {
    const { project, clerkUserId } = await ensureProjectAccess(ctx, args.projectId);

    if (args.setId) {
      const set = await ctx.db.get(args.setId);
      if (!set || set.projectId !== args.projectId) {
        throw new Error("Shopping set not found in this project.");
      }
    }

    if (args.sectionId) {
      const section = await ctx.db.get(args.sectionId);
      if (!section || section.projectId !== args.projectId) {
        throw new Error("Shopping section not found in this project.");
      }
    }

    // Jeśli nie podano sectionId, pozostaw jako undefined
    // Aplikacja automatycznie zgrupuje takie itemy jako "No Category"
    const finalSectionId = args.sectionId || undefined;

    const newItem: Id<"shoppingListItems"> = await ctx.db.insert("shoppingListItems", {
        ...args,
        sectionId: finalSectionId,
        teamId: project.teamId,
        createdBy: clerkUserId,
        completed: false,
    });

    return newItem;
  },
}); 
