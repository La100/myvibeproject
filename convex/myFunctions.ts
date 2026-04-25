import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// Utility function to generate a slug from a string
const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
};
// Create a new user or update an existing one from Clerk webhook
export const createOrUpdateUser = internalMutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const normalizedEmail = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();

    if (user) {
      await ctx.db.patch(user._id, { 
        email: normalizedEmail,
        name: args.name, 
        imageUrl: args.imageUrl 
      });
    } else {
      await ctx.db.insert("users", {
        clerkUserId: args.clerkUserId,
        email: normalizedEmail,
        name: args.name,
        imageUrl: args.imageUrl,
      });
    }
  },
});

// Delete a user from Clerk webhook
export const deleteUser = internalMutation({
    args: { clerkUserId: v.string() },
    async handler(ctx, args) {
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
            .unique();

        if (user) {
            await ctx.db.delete(user._id);
        }
    },
});

// Create or update a team based on a Clerk organization
export const createOrUpdateTeam = internalMutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    imageUrl: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();
    
    const slug = args.slug || generateSlug(args.name);

    if (team) {
      await ctx.db.patch(team._id, { name: args.name, slug: slug, imageUrl: args.imageUrl });
    } else {
      await ctx.db.insert("teams", {
        clerkOrgId: args.clerkOrgId,
        name: args.name,
        slug: slug,
        imageUrl: args.imageUrl,
        onboardingCompletedAt: 0,
        // createdBy is optional and will not be set by the webhook
      });
    }
  },
});

// Delete a team if it exists
export const deleteTeamInternal = internalMutation({
  args: { clerkOrgId: v.string() },
  async handler(ctx, args) {
    console.log(`Attempting to delete team with clerkOrgId: ${args.clerkOrgId}`);
    const team = await ctx.db
      .query("teams")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();

    if (team) {
      console.log(`Found team to delete: ${team.name} (ID: ${team._id})`);

      // 1. Find all projects for this team
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      console.log(`Found ${projects.length} projects to delete for team ${team.name}.`);

      // 2. For each project, delete all related data using the same logic as deleteProject
      for (const project of projects) {
        // Delete all tasks associated with the project
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_project", q => q.eq("projectId", project._id))
          .collect();
        
        // Delete all comments related to the project or its tasks
        const projectComments = await ctx.db
          .query("comments")
          .withIndex("by_project", q => q.eq("projectId", project._id))
          .collect();

        const taskComments = await Promise.all(
          tasks.map(task => 
            ctx.db
              .query("comments")
              .withIndex("by_task", q => q.eq("taskId", task._id))
              .collect()
          )
        ).then(results => results.flat());

        // Delete all files related to the project or its tasks
        const projectFiles = await ctx.db
          .query("files")
          .withIndex("by_project", q => q.eq("projectId", project._id))
          .collect();

        const taskFiles = await Promise.all(
          tasks.map(task => 
            ctx.db
              .query("files")
              .withIndex("by_task", q => q.eq("taskId", task._id))
              .collect()
          )
        ).then(results => results.flat());

        // Delete all invitations related to the project
        const projectInvitations = await ctx.db
          .query("invitations")
          .filter(q => q.eq(q.field("teamId"), project.teamId)) // Filter by teamId instead
          .collect();

        // Delete all folders related to the project
        const projectFolders = await ctx.db
          .query("folders")
          .withIndex("by_project", q => q.eq("projectId", project._id))
          .collect();

        // Delete all shopping list sections and items for this project
        const shoppingListSections = await ctx.db
          .query("shoppingListSections")
          .withIndex("by_project", q => q.eq("projectId", project._id))
          .collect();

        const shoppingListItems = await ctx.db
          .query("shoppingListItems")
          .withIndex("by_project", q => q.eq("projectId", project._id))
          .collect();

        // Execute all deletions for this project
        await Promise.all([
          ...tasks.map(task => ctx.db.delete(task._id)),
          ...projectComments.map(comment => ctx.db.delete(comment._id)),
          ...taskComments.map(comment => ctx.db.delete(comment._id)),
          ...projectFiles.map(file => ctx.db.delete(file._id)),
          ...taskFiles.map(file => ctx.db.delete(file._id)),
          ...projectInvitations.map(invitation => ctx.db.delete(invitation._id)),
          ...projectFolders.map(folder => ctx.db.delete(folder._id)),
          ...shoppingListSections.map(section => ctx.db.delete(section._id)),
          ...shoppingListItems.map(item => ctx.db.delete(item._id)),
        ]);

        console.log(`Deleted all data for project ${project.name}.`);
      }

      // 3. Delete all remaining team-level data that wasn't project-specific

      // Delete all team-level folders
      const teamFolders = await ctx.db
        .query("folders")
        .withIndex("by_team", q => q.eq("teamId", team._id))
        .filter(q => q.eq(q.field("projectId"), undefined))
        .collect();

      // Delete all team-level files
      const teamFiles = await ctx.db
        .query("files")
        .withIndex("by_team", q => q.eq("teamId", team._id))
        .filter(q => q.eq(q.field("projectId"), undefined))
        .collect();

      // Delete all team-level comments
      const teamComments = await ctx.db
        .query("comments")
        .filter(q => q.and(
          q.eq(q.field("teamId"), team._id),
          q.eq(q.field("projectId"), undefined)
        ))
        .collect();

      // Delete all team-level invitations
      const teamInvitations = await ctx.db
        .query("invitations")
        .withIndex("by_team", q => q.eq("teamId", team._id))
        .collect();

      // Execute team-level deletions
      await Promise.all([
        ...teamFolders.map(folder => ctx.db.delete(folder._id)),
        ...teamFiles.map(file => ctx.db.delete(file._id)),
        ...teamComments.map(comment => ctx.db.delete(comment._id)),
        ...teamInvitations.map(invitation => ctx.db.delete(invitation._id)),
      ]);

      // 4. Delete all projects
      await Promise.all(projects.map(project => ctx.db.delete(project._id)));

      // 5. Delete all team members
      const members = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      await Promise.all(members.map(member => ctx.db.delete(member._id)));

      // 6. Finally, delete the team itself
      await ctx.db.delete(team._id);
      
      console.log(`Team ${team.name} and ALL related data deleted successfully.`);
      console.log(`Deleted: ${projects.length} projects, ${members.length} members, and all associated data.`);
    } else {
      console.warn(
        `Webhook for deleteTeamInternal was called, but no team found with clerkOrgId: ${args.clerkOrgId}`
      );
    }
  },
});

// Create or update a team membership
export const createOrUpdateMembership = internalMutation({
    args: {
        clerkOrgId: v.string(),
        clerkUserId: v.string(),
        role: v.string(),
        orgName: v.string(),
        orgSlug: v.string(),
        orgImageUrl: v.optional(v.string()),
        userEmail: v.optional(v.string()), // User email used to check invitations
    },
    async handler(ctx, args) {
        let team = await ctx.db
            .query("teams")
            .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .unique();
        
        if(!team) {
            console.warn(`Team not found for clerkOrgId: ${args.clerkOrgId}. Creating it from membership webhook.`);
            const teamId = await ctx.db.insert("teams", {
                clerkOrgId: args.clerkOrgId,
                name: args.orgName,
                slug: args.orgSlug,
                imageUrl: args.orgImageUrl,
                onboardingCompletedAt: 0,
            });
            team = {
                _id: teamId,
                _creationTime: Date.now(),
                clerkOrgId: args.clerkOrgId,
                name: args.orgName,
                slug: args.orgSlug,
                imageUrl: args.orgImageUrl,
                onboardingCompletedAt: 0,
            };
        };

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
            .unique();
        
        if(!user && args.userEmail && args.userEmail !== "unknown@example.com") {
            console.warn(`User not found for webhook processing: clerkUserId=${args.clerkUserId}. Creating user from membership webhook.`);
            const normalizedEmail = args.userEmail.trim().toLowerCase();
            
            // Create the user only if we have a valid email
            await ctx.db.insert("users", {
                clerkUserId: args.clerkUserId,
                email: normalizedEmail,
                name: undefined, // Will be updated by the user.created/updated webhook
                imageUrl: undefined,
            });
        } else if (!user) {
            console.warn(`User not found and no valid email for clerkUserId=${args.clerkUserId}. Skipping user creation - will be created by user.created webhook.`);
        }

        console.log(`[createOrUpdateMembership] Processing membership for email: ${args.userEmail}, clerkUserId: ${args.clerkUserId}, clerkOrgId: ${args.clerkOrgId}, role: ${args.role}`);

        const membership = await ctx.db
            .query("teamMembers")
            .withIndex("by_team_and_user", (q) => q.eq("teamId", team._id).eq("clerkUserId", args.clerkUserId))
            .unique();

        const activeMemberships = await ctx.db
            .query("teamMembers")
            .withIndex("by_user", (q) => q.eq("clerkUserId", args.clerkUserId))
            .filter((q) => q.eq(q.field("isActive"), true))
            .collect();

        const conflictingMembership = activeMemberships.find((entry) => entry.teamId !== team._id);
        if (!membership && conflictingMembership) {
            console.warn(
                `[createOrUpdateMembership] Skipping additional workspace membership for clerkUserId=${args.clerkUserId}. Existing teamId=${conflictingMembership.teamId}, incoming teamId=${team._id}`,
            );
            return;
        }
        
        // Determine the user's role in the team
        let role: "admin" | "member" = "member"; // default role

        // 1. Check the Clerk role
        if (args.role === "admin" || args.role === "org:admin") {
            role = "admin";
        } else {
            role = "member"; // org:member, basic_member, itp.
        }

        // 1.5. Check whether this is the first organization member (should be an admin)
        if (!membership) {
            const existingMembers = await ctx.db
                .query("teamMembers")
                .withIndex("by_team", q => q.eq("teamId", team._id))
                .collect();
            
            // If this is the first organization member, make them an admin
            if (existingMembers.length === 0) {
                role = "admin";
            }
        }

        if(membership){
            await ctx.db.patch(membership._id, { role });
        } else {
            // Create a new member
            await ctx.db.insert("teamMembers", {
                teamId: team._id,
                clerkUserId: args.clerkUserId,
                clerkOrgId: args.clerkOrgId,
                role: role,
                isActive: true,
                joinedAt: Date.now(),
                permissions: [],
            });
        }
    }
});

// Delete a team membership
export const deleteMembership = internalMutation({
    args: {
        clerkOrgId: v.string(),
        clerkUserId: v.string(),
    },
    async handler(ctx, args) {
        const team = await ctx.db
            .query("teams")
            .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .unique();
        
        if(!team) return;

        const membership = await ctx.db
            .query("teamMembers")
            .withIndex("by_team_and_user", (q) => q.eq("teamId", team._id).eq("clerkUserId", args.clerkUserId))
            .unique();
        
        if(membership){
            await ctx.db.delete(membership._id);
        }

        console.log(`Cleaned up membership for user ${args.clerkUserId} from org ${args.clerkOrgId}`);
    }
});

// Create an invitation from a Clerk webhook
export const createInvitation = internalMutation({
  args: {
    clerkInvitationId: v.string(),
    email: v.string(),
    role: v.string(),
    clerkOrgId: v.string(),
    invitedBy: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();

    if (!team) {
      console.warn(`Team not found for clerkOrgId: ${args.clerkOrgId} during invitation creation.`);
      return;
    }

    await ctx.db.insert("invitations", {
      clerkInvitationId: args.clerkInvitationId,
      teamId: team._id,
      email: args.email,
      role: args.role,
      status: "pending",
      invitedBy: args.invitedBy ?? "system", // Default value
    });
  },
});

// Update invitation status from a Clerk webhook
export const updateInvitationStatus = internalMutation({
  args: {
    clerkInvitationId: v.string(),
    status: v.string(),
  },
  async handler(ctx, args) {
    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_clerk_invitation_id", (q) => q.eq("clerkInvitationId", args.clerkInvitationId))
      .unique();

    if (!invitation) {
      console.warn(`Invitation not found for clerkInvitationId: ${args.clerkInvitationId} during status update.`);
      return;
    }

    await ctx.db.patch(invitation._id, { status: args.status });
  },
});


// =================================================================
// ============== UI-FACING QUERIES & MUTATIONS ====================
// =================================================================
