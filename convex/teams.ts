import { v } from "convex/values";
import type { FunctionReference } from "convex/server";
import { query, mutation, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { r2 } from "./files";

const buildPublicR2FileUrl = (key: string) => {
  const publicBaseUrl = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || "")
    .trim()
    .replace(/\/+$/, "");
  if (!publicBaseUrl) {
    return "";
  }
  return `${publicBaseUrl}/${key}`;
};

const createPendingCustomerInvitationRef = {
  _name: "teams:createPendingCustomerInvitation",
} as const;

export const listUserTeams = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userMemberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("clerkUserId", identity.subject))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const teams: Doc<"teams">[] = [];
    for (const membership of userMemberships) {
      const team = await ctx.db.get(membership.teamId);
      if (team) {
        teams.push(team);
      }
    }
    return teams;
  },
});

export const getTeamByClerkOrg = query({
  args: {
    clerkOrgId: v.string(),
  },
  async handler(ctx, args) {
    return await ctx.db
      .query("teams")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();
  },
});

export const getTeamById = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    return await ctx.db.get(args.teamId);
  },
});

export const getTeamBySlug = query({
  args: { slug: v.string() },
  async handler(ctx, args) {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    return team;
  }
});

export const getTeam = query({
  args: {
    teamId: v.id("teams"),
  },
  async handler(ctx, args) {
    return await ctx.db.get(args.teamId);
  }
});

export const getCurrentUserTeamMember = query({
  args: {
    teamId: v.id("teams"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();
  }
});

export const getTeamMemberByClerkId = internalQuery({
  args: {
    teamId: v.id("teams"),
    clerkUserId: v.string(),
  },
  returns: v.union(v.object({
    _id: v.id("teamMembers"),
    _creationTime: v.number(),
    teamId: v.id("teams"),
    clerkUserId: v.string(),
    clerkOrgId: v.string(),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("customer")),
    permissions: v.array(v.string()),
    projectIds: v.optional(v.array(v.id("projects"))),
    joinedAt: v.number(),
    isActive: v.boolean(),
  }), v.null()),
  async handler(ctx, args) {
    return await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", args.teamId).eq("clerkUserId", args.clerkUserId)
      )
      .unique();
  }
});

export const getCurrentUserRoleInTeam = query({
  args: {
    teamSlug: v.string(),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const team = await ctx.db
      .query("teams")
      .withIndex("by_slug", q => q.eq("slug", args.teamSlug))
      .unique();

    if (!team) return null;

    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject)
      )
      .filter(q => q.eq(q.field("isActive"), true))
      .unique();

    return teamMember?.role || null;
  }
});

export const getCurrentUserRoleInClerkOrg = query({
  args: {
    clerkOrgId: v.string(),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const team = await ctx.db
      .query("teams")
      .withIndex("by_clerk_org", q => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();

    if (!team) return null;

    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject)
      )
      .filter(q => q.eq(q.field("isActive"), true))
      .unique();

    return teamMember?.role || null;
  }
});

export const getTeamSettings = query({
  args: {
    teamSlug: v.string(),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const team = await ctx.db
      .query("teams")
      .withIndex("by_slug", q => q.eq("slug", args.teamSlug))
      .unique();

    if (!team) return null;

    // Sprawdź czy użytkownik ma dostęp do zespołu
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject)
      )
      .filter(q => q.eq(q.field("isActive"), true))
      .unique();

    if (!teamMember) return null;

    return {
      teamId: team._id,
      name: team.name,
      description: team.description,
      currency: team.currency || "PLN",
      userRole: teamMember.role,
    };
  }
});

export const updateTeamTimezone = mutation({
  args: {
    teamId: v.id("teams"),
    timezone: v.string(),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Check permissions
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || teamMember.role !== "admin") {
      throw new Error("Only admins can update team settings");
    }

    await ctx.db.patch(args.teamId, {
      timezone: args.timezone,
    });

    return { success: true };
  },
});

export const getTeamSettingsByClerkOrg = query({
  args: {
    clerkOrgId: v.string(),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const team = await ctx.db
      .query("teams")
      .withIndex("by_clerk_org", q => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();

    if (!team) return null;

    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject)
      )
      .filter(q => q.eq(q.field("isActive"), true))
      .unique();

    if (!teamMember) return null;

    return {
      teamId: team._id,
      name: team.name,
      description: team.description,
      imageUrl: team.imageUrl,
      currency: team.currency || "PLN",
      timezone: team.timezone,
      userRole: teamMember.role,
    };
  }
});

export const inviteCustomerToProject = mutation({
  args: {
    email: v.string(),
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const team = await ctx.db.get(project.teamId);
    if (!team) {
      throw new Error("Team not found for this project");
    }

    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || (teamMember.role !== "admin" && teamMember.role !== "member")) {
      throw new Error("Insufficient permissions to invite a customer");
    }

    const normalizedEmail = args.email.trim().toLowerCase();

    // Replace any older pending invitation for this email+project pair.
    const existingPendingInvitations = await ctx.db
      .query("pendingCustomerInvitations")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .filter((q) => q.eq(q.field("projectId"), args.projectId))
      .collect();

    for (const pendingInvitation of existingPendingInvitations) {
      await ctx.db.delete(pendingInvitation._id);
    }

    const invitationId = await ctx.db.insert("pendingCustomerInvitations", {
      email: normalizedEmail,
      projectId: args.projectId,
      clerkOrgId: team.clerkOrgId,
      invitedBy: identity.subject,
      status: "pending",
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    // Wyślij email przez Clerk
    const sendCustomerInvitationRef = {
      _name: "teams:sendCustomerClerkInvitation",
    } as unknown as FunctionReference<"action">;

    const scheduler = ctx.scheduler as unknown as {
      runAfter: (
        delayMs: number,
        reference: FunctionReference<"action">,
        args: {
          clerkOrgId: string;
          email: string;
          projectId: string;
          projectName: string;
          invitedBy: string;
        },
      ) => Promise<void>;
    };

    await scheduler.runAfter(0, sendCustomerInvitationRef, {
      clerkOrgId: team.clerkOrgId,
      email: normalizedEmail,
      projectId: args.projectId,
      projectName: project.name,
      invitedBy: identity.subject,
    });

    return { invitationId };
  }
});

const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
};

export const syncTeamWithClerkOrg = mutation({
  args: {
    clerkOrgId: v.string(),
    orgName: v.string(),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if the team already exists
    const existingTeam = await ctx.db
      .query("teams")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();

    if (existingTeam) {
      // Update existing team if name has changed
      if (existingTeam.name !== args.orgName) {
        await ctx.db.patch(existingTeam._id, { name: args.orgName });
      }
    } else {
      // Create new team
      await ctx.db.insert("teams", {
        clerkOrgId: args.clerkOrgId,
        name: args.orgName,
        slug: generateSlug(args.orgName),
      });
    }
  },
});

export const removeProjectFromCustomer = mutation({
  args: {
    clerkUserId: v.string(),
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    // Sprawdź uprawnienia wywołującego
    const callerMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!callerMember || (callerMember.role !== "admin" && callerMember.role !== "member")) {
      throw new Error("Insufficient permissions");
    }

    // Znajdź członka zespołu
    const targetMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", project.teamId).eq("clerkUserId", args.clerkUserId)
      )
      .unique();

    if (!targetMember || targetMember.role !== "customer") {
      throw new Error("Customer not found");
    }

    // Usuń projekt z listy
    const currentProjectIds = targetMember.projectIds || [];
    const filteredProjectIds = currentProjectIds.filter(id => id !== args.projectId);

    await ctx.db.patch(targetMember._id, {
      projectIds: filteredProjectIds,
    });

    return { success: true };
  }
});

export const addCustomerToProject = internalMutation({
  args: {
    email: v.string(),
    projectId: v.id("projects"),
    clerkOrgId: v.string(),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Sprawdź uprawnienia do projektu
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || (teamMember.role !== "admin" && teamMember.role !== "member")) {
      throw new Error("Insufficient permissions");
    }

    const normalizedEmail = args.email.trim().toLowerCase();

    // Customer records table was removed; keep only pending invitations.
    await ctx.runMutation(createPendingCustomerInvitationRef as any, {
      email: normalizedEmail,
      projectId: args.projectId,
      clerkOrgId: args.clerkOrgId,
      invitedBy: identity.subject,
    });

    return { success: true };
  }
});

export const createPendingCustomerInvitation = internalMutation({
  args: {
    email: v.string(),
    projectId: v.id("projects"),
    clerkOrgId: v.string(),
    invitedBy: v.string(),
  },
  async handler(ctx, args) {
    // Usuń poprzednie zaproszenia dla tego email + projekt (jeśli istnieją)
    const existingInvitations = await ctx.db
      .query("pendingCustomerInvitations")
      .filter(q => q.and(
        q.eq(q.field("email"), args.email),
        q.eq(q.field("projectId"), args.projectId)
      ))
      .collect();

    for (const invitation of existingInvitations) {
      await ctx.db.delete(invitation._id);
    }

    // Stwórz nowe zaproszenie
    return await ctx.db.insert("pendingCustomerInvitations", {
      email: args.email,
      projectId: args.projectId,
      clerkOrgId: args.clerkOrgId,
      invitedBy: args.invitedBy,
      status: "pending",
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 dni
    });
  }
});

export const cleanupExpiredInvitations = internalMutation({
  args: {},
  async handler(ctx) {
    const now = Date.now();

    // Znajdź wygasłe zaproszenia
    const expiredInvitations = await ctx.db
      .query("pendingCustomerInvitations")
      .filter(q => q.and(
        q.eq(q.field("status"), "pending"),
        q.lt(q.field("expiresAt"), now)
      ))
      .collect();

    // Oznacz jako wygasłe zamiast usuwać
    for (const invitation of expiredInvitations) {
      await ctx.db.patch(invitation._id, {
        status: "expired"
      });
    }

    return { cleanedUp: expiredInvitations.length };
  }
});

export const getTeamMembersForIndexing = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project || !project.teamId) return [];

    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", project.teamId!))
      .collect();

    // Filter members who have access to this project
    const filteredMembers = members.filter(m => m.projectIds?.includes(args.projectId) || m.role !== 'customer');

    // Get user details for each member (including name and email for AI matching)
    return await Promise.all(
      filteredMembers.map(async (member) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", q => q.eq("clerkUserId", member.clerkUserId))
          .unique();
        return {
          clerkUserId: member.clerkUserId,
          name: user?.name,
          email: user?.email,
        };
      })
    );
  },
});

export const getTeamMembersWithUserDetails = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project || !project.teamId) return [];

    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", project.teamId!))
      .collect();

    // Get user details for each member
    return await Promise.all(
      members
        .filter(m => m.projectIds?.includes(args.projectId) || m.role !== 'customer')
        .map(async (member) => {
          const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_user_id", q => q.eq("clerkUserId", member.clerkUserId))
            .unique();
          return {
            ...member,
            name: user?.name ?? "Unknown User",
            email: user?.email ?? "No Email",
            imageUrl: user?.imageUrl,
          };
        })
    );
  },
});

export const getTeamMembers = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    return Promise.all(
      members.map(async (member) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", q => q.eq("clerkUserId", member.clerkUserId))
          .unique();
        return {
          ...member,
          name: user?.name ?? "User without name",
          email: user?.email ?? "No email",
          imageUrl: user?.imageUrl,
        };
      })
    );
  },
});

export const getProjectMembers = query({
  args: {
    teamId: v.id("teams"),
    projectId: v.optional(v.id("projects"))
  },
  async handler(ctx, args) {
    // Fetch all team members
    const teamMembers = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    const result: Array<Record<string, unknown>> = [];

    // Process team members
    for (const member of teamMembers) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", q => q.eq("clerkUserId", member.clerkUserId))
        .unique();

      result.push({
        ...member,
        name: user?.name ?? "User without name",
        email: user?.email ?? "No email",
        imageUrl: user?.imageUrl,
        source: "teamMember"
      });

    }

    return result;
  },
});

export const removeTeamMember = mutation({
  args: {
    clerkUserId: v.string(),
    teamId: v.id("teams"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Sprawdź uprawnienia wywołującego (musi być admin)
    const callerMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!callerMember || callerMember.role !== "admin") {
      throw new Error("Only admins can remove team members");
    }

    // Find the member to remove
    const targetMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", args.teamId).eq("clerkUserId", args.clerkUserId)
      )
      .unique();

    if (!targetMember) {
      throw new Error("Team member not found");
    }

    // Do not allow removing yourself
    if (targetMember.clerkUserId === identity.subject) {
      throw new Error("Cannot remove yourself from the team");
    }

    // Remove member
    await ctx.db.delete(targetMember._id);

    return { success: true };
  }
});

export const inviteTeamMember = mutation({
  args: {
    teamId: v.id("teams"),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("member")
    ),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const currentUserMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (currentUserMember?.role !== "admin") {
      throw new Error("Only admins can invite members");
    }

    const sendClerkInvitationRef = {
      _name: "teams:sendClerkInvitation",
    } as unknown as FunctionReference<"action">;

    const scheduler = ctx.scheduler as unknown as {
      runAfter: (
        delayMs: number,
        reference: FunctionReference<"action">,
        args: {
          clerkOrgId: string;
          email: string;
          role: "admin" | "member";
          invitedBy: string;
        },
      ) => Promise<void>;
    };

    await scheduler.runAfter(0, sendClerkInvitationRef, {
      clerkOrgId: team.clerkOrgId,
      email: args.email,
      role: args.role,
      invitedBy: identity.subject,
    });

    return { success: true };
  },
});

export const sendClerkInvitation = internalAction({
  args: {
    clerkOrgId: v.string(),
    email: v.string(),
    role: v.string(), // "admin" or "member"
    invitedBy: v.string(),
  },
  async handler(ctx, args) {
    const clerkApiKey = process.env.CLERK_SECRET_KEY;
    if (!clerkApiKey) {
      throw new Error("CLERK_SECRET_KEY environment variable not set");
    }

    // Map our internal role to a Clerk role.
    const clerkRole = args.role === 'admin' ? 'org:admin' : 'org:member';

    const redirectUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    try {
      const response = await fetch(
        `https://api.clerk.com/v1/organizations/${args.clerkOrgId}/invitations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${clerkApiKey}`,
          },
          body: JSON.stringify({
            email_address: args.email,
            role: clerkRole,
            inviter_user_id: args.invitedBy,
            redirect_url: redirectUrl,
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.json();
        console.error("Clerk API Error:", JSON.stringify(errorBody, null, 2));
        const clerkError = errorBody.errors[0]?.long_message || "Failed to send invitation.";
        throw new Error(`Clerk API Error: ${clerkError}`);
      }

    } catch (error) {
      console.error("Failed to send Clerk invitation:", error);
      throw new Error((error as Error).message);
    }
  },
});

export const sendCustomerClerkInvitation = internalAction({
  args: {
    clerkOrgId: v.string(),
    email: v.string(),
    projectId: v.id("projects"),
    projectName: v.string(),
    invitedBy: v.string(),
  },
  async handler(ctx, args) {
    const clerkApiKey = process.env.CLERK_SECRET_KEY;
    if (!clerkApiKey) {
      throw new Error("CLERK_SECRET_KEY environment variable not set");
    }

    const redirectUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    try {
      const response = await fetch(
        `https://api.clerk.com/v1/organizations/${args.clerkOrgId}/invitations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${clerkApiKey}`,
          },
          body: JSON.stringify({
            email_address: args.email,
            role: 'org:member', // Customers get member role in Clerk
            inviter_user_id: args.invitedBy,
            redirect_url: redirectUrl,
            public_metadata: {
              isCustomer: true,
              projectId: args.projectId,
              projectName: args.projectName,
            }
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.json();
        console.error("Clerk API Error (Customer Invitation):", JSON.stringify(errorBody, null, 2));
        const clerkError = errorBody.errors[0]?.long_message || "Failed to send customer invitation.";
        throw new Error(`Clerk API Error: ${clerkError}`);
      }

      console.log(`Customer invitation email sent successfully to ${args.email} for project ${args.projectName}`);

    } catch (error) {
      console.error("Failed to send customer Clerk invitation:", error);
      throw new Error((error as Error).message);
    }
  },
});

export const changeTeamMemberRole = mutation({
  args: {
    clerkUserId: v.string(),
    teamId: v.id("teams"),
    role: v.union(
      v.literal("admin"),
      v.literal("member")
    ),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Sprawdź uprawnienia wywołującego (musi być admin)
    const callerMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!callerMember || callerMember.role !== "admin") {
      throw new Error("Only admins can change member roles");
    }

    // Znajdź członka do zmiany
    const targetMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", args.teamId).eq("clerkUserId", args.clerkUserId)
      )
      .unique();

    if (!targetMember) {
      throw new Error("Team member not found");
    }

    // Aktualizuj rolę członka (tylko admin/member)
    await ctx.db.patch(targetMember._id, { role: args.role });

    return { success: true };
  }
});

export const addExistingMemberToProject = mutation({
  args: {
    clerkUserId: v.string(),
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Sprawdź uprawnienia wywołującego
    const callerMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!callerMember || (callerMember.role !== "admin" && callerMember.role !== "member")) {
      throw new Error("Insufficient permissions");
    }

    // Znajdź członka organizacji do dodania
    const targetMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", project.teamId).eq("clerkUserId", args.clerkUserId)
      )
      .unique();

    if (!targetMember) {
      throw new Error("User is not a member of this organization");
    }

    // Only customer members can have project-scoped access.
    if (targetMember.role !== "customer") {
      return { success: true, message: "Internal members already have project access." };
    }

    const currentProjectIds = targetMember.projectIds || [];
    if (currentProjectIds.includes(args.projectId)) {
      return { success: true, message: "User already has access to this project" };
    }

    await ctx.db.patch(targetMember._id, {
      projectIds: [...currentProjectIds, args.projectId],
    });

    return { success: true, message: "User added to project successfully" };
  }
});

export const getAvailableOrgMembersForProject = query({
  args: {
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const project = await ctx.db.get(args.projectId);
    if (!project) return [];

    // Sprawdź uprawnienia
    const callerMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!callerMember || (callerMember.role !== "admin" && callerMember.role !== "member")) {
      return [];
    }

    // Pobierz wszystkich członków organizacji
    const allMembers = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", q => q.eq("teamId", project.teamId))
      .filter(q => q.eq(q.field("isActive"), true))
      .collect();

    // Fetch all team users
    const allMembersWithUsers = await Promise.all(
      allMembers.map(async (member) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", q => q.eq("clerkUserId", member.clerkUserId))
          .unique();

        return {
          ...member,
          user: user,
        };
      })
    );

    // Improved logic: show only those who can be added as project customers
    const availableMembers = allMembersWithUsers.filter(memberWithUser => {
      const { user, ...member } = memberWithUser;

      // Admin and Member already have full access to all projects - no need to add them as project customers
      if (member.role === "admin" || member.role === "member") {
        return false;
      }

      // For organizational customers: check if they already have this project in projectIds
      if (member.role === "customer" && member.projectIds && member.projectIds.includes(args.projectId)) {
        return false;
      }

      // Show: Customers who don't yet have access to this project
      return true;
    });

    // Format result with user data
    const membersWithUserData = availableMembers.map(memberWithUser => {
      const { user, ...member } = memberWithUser;

      return {
        ...member,
        name: user?.name ?? "Unknown User",
        email: user?.email ?? "No email",
        imageUrl: user?.imageUrl,
      };
    });

    return membersWithUserData;
  }
});

export const debugTeamMembers = query({
  args: {
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { error: "Not authenticated" };

    const project = await ctx.db.get(args.projectId);
    if (!project) return { error: "Project not found" };

    // Pobierz wszystkich członków tej organizacji
    const allMembers = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", q => q.eq("teamId", project.teamId))
      .collect();

    // Pobierz zespół
    const team = await ctx.db.get(project.teamId);

    // Dodaj dane użytkowników
    const membersWithUserData = await Promise.all(
      allMembers.map(async (member) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", q => q.eq("clerkUserId", member.clerkUserId))
          .unique();

        return {
          clerkUserId: member.clerkUserId,
          role: member.role,
          isActive: member.isActive,
          projectIds: member.projectIds,
          name: user?.name ?? "No user data",
          email: user?.email ?? "No email",
        };
      })
    );

    return {
      teamId: project.teamId,
      teamName: team?.name,
      clerkOrgId: team?.clerkOrgId,
      totalMembers: allMembers.length,
      members: membersWithUserData
    };
  }
});

export const getPendingInvitations = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    return await ctx.db
      .query("invitations")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
  },
});

export const revokeInvitation = mutation({
  args: { invitationId: v.id("invitations") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    const currentUserMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", invitation.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (currentUserMember?.role !== "admin") {
      throw new Error("Only admins can revoke invitations");
    }

    const clerkApiKey = process.env.CLERK_SECRET_KEY;
    if (!clerkApiKey) {
      throw new Error("CLERK_SECRET_KEY environment variable not set");
    }

    const response = await fetch(
      `https://api.clerk.com/v1/organizations/${currentUserMember.clerkOrgId}/invitations/${invitation.clerkInvitationId}/revoke`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clerkApiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to revoke invitation in Clerk");
    }

    // The webhook will handle the DB update
    return { success: true };
  },
});

export const updateTeamSettings = mutation({
  args: {
    teamId: v.id("teams"),
    imageUrl: v.optional(v.string()),
    currency: v.optional(v.union(
      v.literal("USD"), v.literal("EUR"), v.literal("PLN"), v.literal("GBP"),
      v.literal("CAD"), v.literal("AUD"), v.literal("JPY"), v.literal("CHF"),
      v.literal("SEK"), v.literal("NOK"), v.literal("DKK"), v.literal("CZK"),
      v.literal("HUF"), v.literal("CNY"), v.literal("INR"), v.literal("BRL"),
      v.literal("MXN"), v.literal("KRW"), v.literal("SGD"), v.literal("HKD")
    )),
    timezone: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Sprawdź uprawnienia - tylko admin może zmieniać ustawienia zespołu
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || teamMember.role !== "admin") {
      throw new Error("Only admins can update team settings");
    }

    const patch: {
      currency?: typeof args.currency;
      timezone?: string;
      imageUrl?: string | undefined;
    } = {};

    if (args.currency !== undefined) {
      patch.currency = args.currency;
    }

    if (args.timezone !== undefined) {
      patch.timezone = args.timezone.trim();
    }

    if (Object.prototype.hasOwnProperty.call(args, "imageUrl")) {
      const normalizedImageUrl = args.imageUrl?.trim();
      patch.imageUrl = normalizedImageUrl || undefined;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.teamId, patch);
    }

    return { success: true };
  },
});

export const generateTeamImageUploadUrl = mutation({
  args: {
    teamId: v.id("teams"),
    fileName: v.string(),
  },
  returns: v.object({
    url: v.string(),
    key: v.string(),
    publicUrl: v.string(),
  }),
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || teamMember.role !== "admin") {
      throw new Error("Only admins can update team settings");
    }

    const fileExtension = args.fileName.includes(".")
      ? args.fileName.split(".").pop()
      : "";
    const baseName = args.fileName.replace(/\.[^/.]+$/, "");
    const safeBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-").slice(0, 80) || "logo";
    const key = `${team.slug}/organization/logo/${crypto.randomUUID()}-${safeBaseName}${fileExtension ? `.${fileExtension}` : ""}`;
    const uploadData = await r2.generateUploadUrl(key);
    const publicUrl = buildPublicR2FileUrl(key);

    if (!publicUrl) {
      throw new Error("Public R2 URL is not configured");
    }

    return {
      url: uploadData.url,
      key,
      publicUrl,
    };
  },
});

// Get team resource usage (projects, members)
export const getTeamResourceUsage = query({
  args: { teamId: v.id("teams") },
  returns: v.object({
    projectsUsed: v.number(),
    projectsLimit: v.number(),
    projectsPercentUsed: v.number(),
    membersUsed: v.number(),
    membersLimit: v.number(),
    membersPercentUsed: v.number(),
  }),
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Check if user is member of this team
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!membership || !membership.isActive) {
      throw new Error("Not authorized to view this team");
    }

    // Count projects
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();
    const projectsUsed = projects.length;

    // Count active team members
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    const membersUsed = members.length;

    // Get limits from subscription
    const plan = (team.subscriptionPlan || "free") as "free" | "basic" | "ai" | "ai_scale" | "pro" | "enterprise";
    const limits = team.subscriptionLimits || {
      maxProjects: plan === "free" ? 3 : plan === "basic" ? 10 : plan === "ai" || plan === "ai_scale" ? 20 : plan === "pro" ? 50 : 999,
      maxTeamMembers: plan === "free" ? 1 : plan === "basic" ? 15 : plan === "ai" || plan === "ai_scale" ? 25 : plan === "pro" ? 50 : 999,
    };

    const projectsLimit = limits.maxProjects;
    const membersLimit = limits.maxTeamMembers;

    const projectsPercentUsed = projectsLimit > 0 ? Math.round((projectsUsed / projectsLimit) * 100) : 0;
    const membersPercentUsed = membersLimit > 0 ? Math.round((membersUsed / membersLimit) * 100) : 0;

    return {
      projectsUsed,
      projectsLimit,
      projectsPercentUsed,
      membersUsed,
      membersLimit,
      membersPercentUsed,
    };
  },
});
