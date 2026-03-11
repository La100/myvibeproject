import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const getProjectMembership = async (ctx: any, projectId: Id<"projects">, clerkUserId: string) => {
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

  if (!membership || (membership.role !== "admin" && membership.role !== "member")) {
    throw new Error("Insufficient permissions to view project budget");
  }

  if (membership.role === "member" && membership.projectIds?.length > 0) {
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
  const [shoppingItems, laborItems, estimations, payments, milestones] = await Promise.all([
    ctx.db.query("shoppingListItems").withIndex("by_project", (q: any) => q.eq("projectId", project._id)).collect(),
    ctx.db.query("laborItems").withIndex("by_project", (q: any) => q.eq("projectId", project._id)).collect(),
    ctx.db.query("costEstimations").withIndex("by_project", (q: any) => q.eq("projectId", project._id)).collect(),
    ctx.db.query("projectPayments").withIndex("by_project", (q: any) => q.eq("projectId", project._id)).collect(),
    ctx.db.query("projectMilestones").withIndex("by_project", (q: any) => q.eq("projectId", project._id)).collect(),
  ]);

  const shoppingPlanned = shoppingItems.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
  const shoppingCommitted = shoppingItems
    .filter((item: any) => item.realizationStatus !== "PLANNED" && item.realizationStatus !== "CANCELLED")
    .reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
  const shoppingActual = shoppingItems
    .filter((item: any) => item.realizationStatus === "DELIVERED" || item.realizationStatus === "COMPLETED")
    .reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);

  const now = Date.now();
  const laborPlanned = laborItems.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
  const laborCommitted = laborItems
    .filter((item: any) => typeof item.startDate === "number" || typeof item.endDate === "number")
    .reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
  const laborActual = laborItems
    .filter((item: any) => typeof item.endDate === "number" && item.endDate <= now)
    .reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);

  const plannedCost = shoppingPlanned + laborPlanned;
  const committedCost = shoppingCommitted + laborCommitted;
  const actualCost = shoppingActual + laborActual;
  const budget = project.budget || 0;
  const variance = budget - actualCost;
  const projectedVariance = budget - plannedCost;

  const acceptedEstimations = estimations.filter((estimation: any) => estimation.status === "accepted");
  const sentEstimations = estimations.filter((estimation: any) => estimation.status === "sent");
  const acceptedRevenue = acceptedEstimations.reduce(
    (sum: number, estimation: any) => sum + (estimation.grossTotal || estimation.netTotal || 0),
    0,
  );
  const pipelineRevenue = sentEstimations.reduce(
    (sum: number, estimation: any) => sum + (estimation.grossTotal || estimation.netTotal || 0),
    0,
  );

  const visiblePayments = payments.filter((payment: any) => payment.status !== "void");
  const scheduledRevenue = visiblePayments.reduce((sum: number, payment: any) => sum + payment.amount, 0);
  const collectedRevenue = visiblePayments
    .filter((payment: any) => payment.status === "paid")
    .reduce((sum: number, payment: any) => sum + payment.amount, 0);
  const outstandingRevenue = visiblePayments
    .filter((payment: any) => payment.status === "draft" || payment.status === "open")
    .reduce((sum: number, payment: any) => sum + payment.amount, 0);

  const milestoneBudget = milestones.reduce((sum: number, milestone: any) => sum + (milestone.budgetAmount || 0), 0);

  return {
    currency: project.currency || "PLN",
    budget,
    plannedCost,
    committedCost,
    actualCost,
    variance,
    projectedVariance,
    utilizationPercent: budget > 0 ? Math.round((actualCost / budget) * 100) : null,
    projectedUtilizationPercent: budget > 0 ? Math.round((plannedCost / budget) * 100) : null,
    breakdown: {
      shopping: {
        planned: shoppingPlanned,
        committed: shoppingCommitted,
        actual: shoppingActual,
      },
      labor: {
        planned: laborPlanned,
        committed: laborCommitted,
        actual: laborActual,
      },
    },
    revenue: {
      acceptedEstimations: acceptedRevenue,
      pipelineEstimations: pipelineRevenue,
      scheduledPayments: scheduledRevenue,
      collectedPayments: collectedRevenue,
      outstandingPayments: outstandingRevenue,
    },
    milestones: {
      count: milestones.length,
      budgetAllocated: milestoneBudget,
    },
    alerts: [
      budget > 0 && actualCost > budget
        ? { severity: "high", label: "Actual cost exceeds budget" }
        : null,
      budget > 0 && plannedCost > budget
        ? { severity: "medium", label: "Projected cost exceeds budget" }
        : null,
      outstandingRevenue > 0 && collectedRevenue < actualCost
        ? { severity: "medium", label: "Collected payments are below current actual cost" }
        : null,
    ].filter(Boolean),
  };
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

    const project = await getProjectMembership(ctx, args.projectId, identity.subject);
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
      .withIndex("by_client_panel_access_token", (q: any) => q.eq("clientPanelAccessToken", token))
      .unique();

    if (!project || project.clientPanelPublishedSettings?.showBudget !== true) {
      return null;
    }

    return await buildProjectBudgetSummary(ctx, project);
  },
});
