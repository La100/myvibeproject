import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// Get all contacts for a team
export const getContacts = query({
  args: {
    teamSlug: v.string(),
    search: v.optional(v.string()),
    type: v.optional(v.union(
      v.literal("contractor"),
      v.literal("supplier"),
      v.literal("subcontractor"),
      v.literal("other")
    )),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get team by slug - teamSlug is required
    if (!args.teamSlug) {
      throw new Error("Team slug is required");
    }

    const team = await ctx.db
      .query("teams")
      .withIndex("by_slug", (q) => q.eq("slug", args.teamSlug))
      .unique();

    if (!team) {
      throw new Error("Team not found");
    }

    // Verify user is member of this team
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject)
      )
      .filter(q => q.eq(q.field("isActive"), true))
      .unique();

    if (!teamMember) {
      throw new Error("Access denied");
    }

    let contactsQuery = ctx.db
      .query("contacts")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .filter((q) => q.eq(q.field("isActive"), true));

    // Apply type filter
    if (args.type) {
      contactsQuery = contactsQuery.filter((q) =>
        q.eq(q.field("type"), args.type)
      );
    }

    const contacts = await contactsQuery.collect();

    // Apply search filter
    if (args.search) {
      const searchTerm = args.search.toLowerCase();
      return contacts.filter(contact =>
        contact.name.toLowerCase().includes(searchTerm) ||
        contact.companyName?.toLowerCase().includes(searchTerm) ||
        contact.email?.toLowerCase().includes(searchTerm) ||
        contact.phone?.toLowerCase().includes(searchTerm) ||
        contact.city?.toLowerCase().includes(searchTerm) ||
        false
      );
    }

    return contacts;
  },
});

// Get single contact
export const getContact = query({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Verify user has access to this contact's team
    const team = await ctx.db.get(contact.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Verify user is member of this team
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject)
      )
      .filter(q => q.eq(q.field("isActive"), true))
      .unique();

    if (!teamMember) {
      throw new Error("Access denied");
    }

    return contact;
  },
});

// Create new contact
export const createContact = mutation({
  args: {
    teamSlug: v.string(),
    name: v.string(),
    companyName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    website: v.optional(v.string()),
    taxId: v.optional(v.string()),
    type: v.union(
      v.literal("contractor"),
      v.literal("supplier"),
      v.literal("subcontractor"),
      v.literal("other")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get team by slug
    const team = await ctx.db
      .query("teams")
      .withIndex("by_slug", (q) => q.eq("slug", args.teamSlug))
      .unique();

    if (!team) {
      throw new Error("Team not found");
    }

    // Verify user is member of this team
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject)
      )
      .filter(q => q.eq(q.field("isActive"), true))
      .unique();

    if (!teamMember) {
      throw new Error("Access denied");
    }


    const contactId = await ctx.db.insert("contacts", {
      name: args.name,
      companyName: args.companyName,
      email: args.email,
      phone: args.phone,
      address: args.address,
      city: args.city,
      postalCode: args.postalCode,
      website: args.website,
      taxId: args.taxId,
      type: args.type,
      notes: args.notes,
      teamId: team._id,
      createdBy: identity.subject,
      isActive: true,
    });

    await ctx.runMutation(internal.activityLog.logActivity, {
      teamId: team._id,
      projectId: undefined,
      actionType: "contact.create",
      entityId: contactId,
      entityType: "contact",
      details: { name: args.name },
    });

    return contactId;
  },
});

// Update contact
export const updateContact = mutation({
  args: {
    contactId: v.id("contacts"),
    name: v.string(),
    companyName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    website: v.optional(v.string()),
    taxId: v.optional(v.string()),
    type: v.union(
      v.literal("contractor"),
      v.literal("supplier"),
      v.literal("subcontractor"),
      v.literal("other")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Verify user has access to this contact's team
    const team = await ctx.db.get(contact.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Verify user is member of this team
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject)
      )
      .filter(q => q.eq(q.field("isActive"), true))
      .unique();

    if (!teamMember) {
      throw new Error("Access denied");
    }


    await ctx.db.patch(args.contactId, {
      name: args.name,
      companyName: args.companyName,
      email: args.email,
      phone: args.phone,
      address: args.address,
      city: args.city,
      postalCode: args.postalCode,
      website: args.website,
      taxId: args.taxId,
      type: args.type,
      notes: args.notes,
    });

    await ctx.runMutation(internal.activityLog.logActivity, {
      teamId: contact.teamId,
      projectId: undefined,
      actionType: "contact.update",
      entityId: args.contactId,
      entityType: "contact",
      details: { name: contact.name },
    });

    return args.contactId;
  },
});

// Delete contact (soft delete)
export const deleteContact = mutation({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Verify user has access to this contact's team
    const team = await ctx.db.get(contact.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Verify user is member of this team
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject)
      )
      .filter(q => q.eq(q.field("isActive"), true))
      .unique();

    if (!teamMember) {
      throw new Error("Access denied");
    }

    await ctx.runMutation(internal.activityLog.logActivity, {
      teamId: contact.teamId,
      projectId: undefined,
      actionType: "contact.archive",
      entityId: args.contactId,
      entityType: "contact",
      details: { name: contact.name },
    });

    await ctx.db.patch(args.contactId, {
      isActive: false,
    });

    return args.contactId;
  },
});

// Get contacts assigned to a project
export const getProjectContacts = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify user has access to this project
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const team = await ctx.db.get(project.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Verify user is member of this team
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject)
      )
      .filter(q => q.eq(q.field("isActive"), true))
      .unique();

    if (!teamMember) {
      throw new Error("Access denied");
    }

    // Get project contacts
    const projectContacts = await ctx.db
      .query("projectContacts")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Get full contact details
    const contacts = await Promise.all(
      projectContacts.map(async (pc) => {
        const contact = await ctx.db.get(pc.contactId);
        return {
          ...contact,
          projectRole: pc.role,
          assignedAt: pc.assignedAt,
          projectNotes: pc.notes,
        };
      })
    );

    return contacts.filter(Boolean);
  },
});

export const getContactById = internalQuery({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.contactId);
  },
});

// Assign contact to project
export const assignContactToProject = mutation({
  args: {
    projectId: v.id("projects"),
    contactId: v.id("contacts"),
    role: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify user has access to both project and contact
    const [project, contact] = await Promise.all([
      ctx.db.get(args.projectId),
      ctx.db.get(args.contactId),
    ]);

    if (!project || !contact) {
      throw new Error("Project or contact not found");
    }

    const team = await ctx.db.get(project.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Verify user is member of this team
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject)
      )
      .filter(q => q.eq(q.field("isActive"), true))
      .unique();

    if (!teamMember) {
      throw new Error("Access denied");
    }

    if (contact.teamId !== team._id) {
      throw new Error("Contact not in same team");
    }

    // Check if already assigned
    const existing = await ctx.db
      .query("projectContacts")
      .withIndex("by_project_and_contact", (q) =>
        q.eq("projectId", args.projectId).eq("contactId", args.contactId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (existing) {
      throw new Error("Contact already assigned to this project");
    }

    const assignmentId = await ctx.db.insert("projectContacts", {
      projectId: args.projectId,
      contactId: args.contactId,
      teamId: team._id,
      role: args.role,
      notes: args.notes,
      assignedBy: identity.subject,
      assignedAt: Date.now(),
      isActive: true,
    });

    return assignmentId;
  },
});

// Remove contact from project
export const removeContactFromProject = mutation({
  args: {
    projectId: v.id("projects"),
    contactId: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify user has access to project
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const team = await ctx.db.get(project.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Verify user is member of this team
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject)
      )
      .filter(q => q.eq(q.field("isActive"), true))
      .unique();

    if (!teamMember) {
      throw new Error("Access denied");
    }

    // Find and deactivate assignment
    const assignment = await ctx.db
      .query("projectContacts")
      .withIndex("by_project_and_contact", (q) =>
        q.eq("projectId", args.projectId).eq("contactId", args.contactId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!assignment) {
      throw new Error("Contact not assigned to this project");
    }

    await ctx.db.patch(assignment._id, {
      isActive: false,
    });

    return assignment._id;
  },
});

export const getContactsForIndexing = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    // Get project to get team ID
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return [];
    }

    // Get all active project contacts
    const projectContacts = await ctx.db
      .query("projectContacts")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Get contact details for each project contact
    const contacts = await Promise.all(
      projectContacts.map(async (projectContact) => {
        const contact = await ctx.db.get(projectContact.contactId);
        return contact ? {
          ...contact,
          projectRole: projectContact.role,
          projectNotes: projectContact.notes,
        } : null;
      })
    );

    return contacts.filter(Boolean);
  },
});
