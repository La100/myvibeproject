import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { summarizeProjectBudget } from "../lib/projectBudgetSummary";

const getProjectMembership = async (
  ctx: any,
  projectId: Id<"projects">,
  clerkUserId: string,
) => {
  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  const membership = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q: any) =>
      q.eq("teamId", project.teamId).eq("clerkUserId", clerkUserId),
    )
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .first();

  if (
    !membership ||
    (membership.role !== "admin" && membership.role !== "member")
  ) {
    throw new Error("Insufficient permissions to view project budget");
  }

  if (membership.role === "member" && Array.isArray(membership.projectIds)) {
    if (!membership.projectIds.includes(projectId)) {
      throw new Error("Insufficient permissions to view project budget");
    }
  }

  return project;
};

const buildProjectBudgetSummary = async (
  ctx: any,
  project: {
    _id: Id<"projects">;
    budget?: number;
    currency?: string;
  },
) => {
  const [shoppingItems, laborItems, estimations, payments] = await Promise.all([
    ctx.db
      .query("shoppingListItems")
      .withIndex("by_project", (q: any) => q.eq("projectId", project._id))
      .collect(),
    ctx.db
      .query("laborItems")
      .withIndex("by_project", (q: any) => q.eq("projectId", project._id))
      .collect(),
    ctx.db
      .query("costEstimations")
      .withIndex("by_project", (q: any) => q.eq("projectId", project._id))
      .collect(),
    ctx.db
      .query("projectPayments")
      .withIndex("by_project", (q: any) => q.eq("projectId", project._id))
      .collect(),
  ]);

  return summarizeProjectBudget(
    {
      project: {
        _id: String(project._id),
        budget: project.budget,
        currency: project.currency,
      },
      shoppingItems,
      laborItems,
      estimations,
      payments,
    },
    Date.now(),
  );
};

export const getProjectBudgetSummary = query({
  args: {
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const project = await getProjectMembership(
      ctx,
      args.projectId,
      identity.subject,
    );
    return await buildProjectBudgetSummary(ctx, project);
  },
});

export const getPublicProjectBudgetSummaryByAccessToken = query({
  args: {
    accessToken: v.string(),
  },
  async handler(ctx, args) {
    const token = args.accessToken.trim();
    if (!token) {
      return null;
    }

    const project = await ctx.db
      .query("projects")
      .withIndex("by_client_panel_access_token", (q: any) =>
        q.eq("clientPanelAccessToken", token),
      )
      .unique();

    if (!project || project.clientPanelPublishedSettings?.showBudget !== true) {
      return null;
    }

    return project.clientPanelPublishedSnapshot?.budgetSummary ?? null;
  },
});
