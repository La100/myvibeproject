import { v } from "convex/values";
import { internalMutation, query, mutation, action } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Utility function to generate a slug from a string
const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
};



// Utility function to generate next project ID
const generateNextProjectId = async (ctx: any) => {
  const projects = await ctx.db.query("projects").collect();
  const maxProjectId = projects.reduce((max: number, project: any) => {
    return (project.projectId || 0) > max ? (project.projectId || 0) : max;
  }, 0);
  return maxProjectId + 1;
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
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();

    if (user) {
      await ctx.db.patch(user._id, { 
        email: args.email, 
        name: args.name, 
        imageUrl: args.imageUrl 
      });
    } else {
      await ctx.db.insert("users", {
        clerkUserId: args.clerkUserId,
        email: args.email,
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

        // Delete all pending customer invitations for this project
        const pendingInvitations = await ctx.db
          .query("pendingCustomerInvitations")
          .filter(q => q.eq(q.field("projectId"), project._id))
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
          ...pendingInvitations.map(invitation => ctx.db.delete(invitation._id)),
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
        userEmail: v.optional(v.string()), // Email użytkownika do sprawdzenia zaproszeń
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
            });
            team = {
                _id: teamId,
                _creationTime: Date.now(),
                clerkOrgId: args.clerkOrgId,
                name: args.orgName,
                slug: args.orgSlug,
                imageUrl: args.orgImageUrl,
            };
        };

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
            .unique();
        
        if(!user && args.userEmail && args.userEmail !== "unknown@example.com") {
            console.warn(`User not found for webhook processing: clerkUserId=${args.clerkUserId}. Creating user from membership webhook.`);
            
            // Stwórz użytkownika tylko jeśli mamy poprawny email
            await ctx.db.insert("users", {
                clerkUserId: args.clerkUserId,
                email: args.userEmail,
                name: undefined, // Będzie zaktualizowane przy webhook user.created/updated
                imageUrl: undefined,
            });
        } else if (!user) {
            console.warn(`User not found and no valid email for clerkUserId=${args.clerkUserId}. Skipping user creation - will be created by user.created webhook.`);
        }

        console.log(`[createOrUpdateMembership] Processing membership for email: ${args.userEmail}, clerkUserId: ${args.clerkUserId}, clerkOrgId: ${args.clerkOrgId}, role: ${args.role}`);

        let invitedProjectIds: Id<"projects">[] = [];
        if (args.userEmail) {
            const normalizedEmail = args.userEmail.trim().toLowerCase();
            const now = Date.now();
            const pendingInvitations = await ctx.db
                .query("pendingCustomerInvitations")
                .withIndex("by_email", q => q.eq("email", normalizedEmail))
                .filter(q => q.and(
                    q.eq(q.field("clerkOrgId"), args.clerkOrgId),
                    q.eq(q.field("status"), "pending"),
                    q.gt(q.field("expiresAt"), now)
                ))
                .collect();

            if (pendingInvitations.length > 0) {
                invitedProjectIds = Array.from(new Set(pendingInvitations.map((invitation) => invitation.projectId)));
                for (const invitation of pendingInvitations) {
                    await ctx.db.patch(invitation._id, { status: "accepted" });
                }
            }
        }

        const membership = await ctx.db
            .query("teamMembers")
            .withIndex("by_team_and_user", (q) => q.eq("teamId", team._id).eq("clerkUserId", args.clerkUserId))
            .unique();
        
        // Określ rolę użytkownika w zespole
        let role: "admin" | "member" | "customer" = "member"; // domyślna rola
        let projectIds: Id<"projects">[] | undefined;

        // 1. Sprawdź rolę z Clerk
        if (args.role === "admin" || args.role === "org:admin") {
            role = "admin";
        } else if (args.role === "org:customer") {
            role = "customer";
        } else {
            role = "member"; // org:member, basic_member, itp.
        }

        // 1.5. Sprawdź czy to pierwszy członek organizacji (powinien być adminem)
        if (!membership && invitedProjectIds.length === 0) {
            const existingMembers = await ctx.db
                .query("teamMembers")
                .withIndex("by_team", q => q.eq("teamId", team._id))
                .collect();
            
            // Jeśli to pierwszy członek organizacji, zrób go adminem
            if (existingMembers.length === 0) {
                role = "admin";
            }
        }

        if (invitedProjectIds.length > 0) {
            role = "customer";
            projectIds = invitedProjectIds;
        }

        if(membership){
            const patch: Record<string, unknown> = { role };
            if (projectIds && projectIds.length > 0) {
                const currentProjectIds = membership.projectIds || [];
                patch.projectIds = Array.from(new Set([...currentProjectIds, ...projectIds]));
            }
            await ctx.db.patch(membership._id, patch);
        } else {
            // Stwórz nowego członka
            await ctx.db.insert("teamMembers", {
                teamId: team._id,
                clerkUserId: args.clerkUserId,
                clerkOrgId: args.clerkOrgId,
                role: role,
                projectIds: projectIds,
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

        // Also clean up any pending invitations for this user's email
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_user_id", q => q.eq("clerkUserId", args.clerkUserId))
            .unique();

        if (user?.email) {
            const pendingInvitations = await ctx.db
                .query("pendingCustomerInvitations")
                .filter(q => q.and(
                    q.eq(q.field("email"), user.email!),
                    q.eq(q.field("clerkOrgId"), args.clerkOrgId)
                ))
                .collect();

            for (const invitation of pendingInvitations) {
                await ctx.db.patch(invitation._id, {
                    status: "expired"
                });
            }
        }

        console.log(`Cleaned up membership and pending invitations for user ${args.clerkUserId} from org ${args.clerkOrgId}`);
    }
});

// AI-powered task parsing from a chat message
export const parseTaskFromChat = action({
  args: {
    message: v.string(),
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    // THIS FUNCTION HAS BEEN MOVED TO convex/tasks.ts
    // THIS IS A PLACEHOLDER TO AVOID CACHING ISSUES
    console.log("This function is deprecated. Please use api.tasks.parseTaskFromChat");
    return { isTask: false };
    /*
    // Get OpenAI API key from environment variables
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key not configured");
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5',
          messages: [
            {
              role: 'system',
              content: `You are a task parser. Parse the user's message to extract task information. 
              Return ONLY a valid JSON object with the following structure:
              {
                "isTask": boolean,
                "title": string,
                "description": string,
                "priority": "low" | "medium" | "high" | "urgent" | null,
                "status": "todo" | "in_progress" | "review" | "done" | null,
                "dueDate": ISO date string or null,
                "tags": string[]
              }
              
              IMPORTANT RULES:
              - If the message is not about creating a task, set "isTask" to false
              - For priority, default to "medium" unless specified
              - For status, default to "todo" unless specified
              - KEEP THE SAME LANGUAGE as the input message (don't translate Polish to English!)
              - For dates, use current time context and return proper ISO date strings (YYYY-MM-DD)
              - Polish date parsing:
                * "jutro" = tomorrow's date
                * "dziś" = today's date  
                * "za tydzień" = date 7 days from now
                * "za 2 dni" = date 2 days from now
                * "w poniedziałek" = next Monday
                * "o 10" = just note in description, not separate time field
              - Current date context: ${new Date().toISOString().split('T')[0]}
              - Current day of week: ${new Date().toLocaleDateString('pl-PL', { weekday: 'long' })}`
            },
            {
              role: 'user',
              content: args.message
            }
          ],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      try {
        const parsedTask = JSON.parse(content);
        
        // Validate the structure
        if (!parsedTask.hasOwnProperty('isTask')) {
          throw new Error("Invalid response structure");
        }

        return parsedTask;
      } catch (parseError) {
        console.error("Failed to parse OpenAI response:", content);
        throw new Error("Failed to parse task information");
      }
    } catch (error) {
      console.error("OpenAI API error:", error);
      throw new Error("Failed to process message with AI");
    }
    */
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
      invitedBy: args.invitedBy ?? "system", // Domyślna wartość
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
