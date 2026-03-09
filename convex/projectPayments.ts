import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const PROJECT_PAYMENT_STATUS = v.union(
  v.literal("draft"),
  v.literal("open"),
  v.literal("paid"),
  v.literal("void"),
  v.literal("uncollectible"),
);

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeOptionalString = (value?: string | null) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : undefined;
};

const toPublicInstallment = (installment: {
  _id: Id<"projectPayments">;
  _creationTime: number;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  dueDate?: number;
  order: number;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  stripeInvoiceId?: string;
  stripeHostedInvoiceUrl?: string;
  stripeInvoiceNumber?: string;
  stripePaymentIntentId?: string;
  sentAt?: number;
  paidAt?: number;
  lastStripeSyncAt?: number;
  updatedAt: number;
}) => ({
  ...installment,
  isOverdue:
    installment.status === "open" &&
    typeof installment.dueDate === "number" &&
    installment.dueDate < Date.now(),
});

const getProjectPaymentManager = async (
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

  if (!membership || (membership.role !== "admin" && membership.role !== "member")) {
    throw new Error("Insufficient permissions to manage project payments");
  }

  if (membership.role === "member" && membership.projectIds && membership.projectIds.length > 0) {
    if (!membership.projectIds.includes(projectId)) {
      throw new Error("Insufficient permissions to manage project payments");
    }
  }

  return { project, membership };
};

const listInstallmentsForProject = async (ctx: any, projectId: Id<"projects">) => {
  const installments = await ctx.db
    .query("projectPayments")
    .withIndex("by_project_and_order", (q: any) => q.eq("projectId", projectId))
    .order("asc")
    .collect();

  return installments.sort((left: any, right: any) => {
    if (left.order !== right.order) return left.order - right.order;
    const leftDue = left.dueDate || Number.MAX_SAFE_INTEGER;
    const rightDue = right.dueDate || Number.MAX_SAFE_INTEGER;
    if (leftDue !== rightDue) return leftDue - rightDue;
    return left._creationTime - right._creationTime;
  });
};

export const getProjectPaymentsOverview = query({
  args: {
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const { project } = await getProjectPaymentManager(ctx as any, args.projectId, identity.subject);
    const installments = await listInstallmentsForProject(ctx, args.projectId);

    const visibleInstallments = installments.filter((installment: any) => installment.status !== "void");
    const paidTotal = visibleInstallments
      .filter((installment: any) => installment.status === "paid")
      .reduce((sum: number, installment: any) => sum + installment.amount, 0);
    const outstandingTotal = visibleInstallments
      .filter((installment: any) => installment.status === "open" || installment.status === "draft")
      .reduce((sum: number, installment: any) => sum + installment.amount, 0);
    const overdueCount = visibleInstallments.filter(
      (installment: any) =>
        installment.status === "open" &&
        typeof installment.dueDate === "number" &&
        installment.dueDate < Date.now(),
    ).length;

    return {
      customerName: project.paymentCustomerName || "",
      customerEmail: project.paymentCustomerEmail || "",
      stripeCustomerId: project.stripeProjectCustomerId || null,
      currency: project.currency || "PLN",
      totals: {
        scheduled: visibleInstallments.reduce((sum: number, installment: any) => sum + installment.amount, 0),
        paid: paidTotal,
        outstanding: outstandingTotal,
        overdueCount,
        installmentCount: visibleInstallments.length,
      },
      installments: installments.map(toPublicInstallment),
    };
  },
});

export const updateProjectPaymentCustomer = mutation({
  args: {
    projectId: v.id("projects"),
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    await getProjectPaymentManager(ctx as any, args.projectId, identity.subject);

    const customerName = normalizeOptionalString(args.customerName);
    const customerEmail = normalizeOptionalString(args.customerEmail)?.toLowerCase();

    if (customerEmail && !emailPattern.test(customerEmail)) {
      throw new Error("Enter a valid billing email address");
    }

    await ctx.db.patch(args.projectId, {
      paymentCustomerName: customerName,
      paymentCustomerEmail: customerEmail,
    });

    return {
      customerName: customerName || "",
      customerEmail: customerEmail || "",
    };
  },
});

export const createProjectPayment = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.optional(v.string()),
    amount: v.number(),
    dueDate: v.optional(v.union(v.number(), v.null())),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { project } = await getProjectPaymentManager(ctx as any, args.projectId, identity.subject);
    const title = args.title.trim();
    const description = normalizeOptionalString(args.description);

    if (!title) {
      throw new Error("Installment title is required");
    }
    if (!Number.isFinite(args.amount) || args.amount <= 0) {
      throw new Error("Installment amount must be greater than zero");
    }

    const installments = await listInstallmentsForProject(ctx, args.projectId);
    const nextOrder = installments.length > 0 ? Math.max(...installments.map((item: any) => item.order)) + 1 : 0;
    const normalizedAmount = Math.round(args.amount * 100) / 100;

    return await ctx.db.insert("projectPayments", {
      projectId: args.projectId,
      teamId: project.teamId,
      title,
      description,
      amount: normalizedAmount,
      currency: project.currency || "PLN",
      dueDate: args.dueDate ?? undefined,
      order: nextOrder,
      status: "draft",
      createdBy: identity.subject,
      updatedAt: Date.now(),
    });
  },
});

export const updateProjectPayment = mutation({
  args: {
    installmentId: v.id("projectPayments"),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    amount: v.optional(v.number()),
    dueDate: v.optional(v.union(v.number(), v.null())),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const installment = await ctx.db.get(args.installmentId);
    if (!installment) {
      throw new Error("Installment not found");
    }

    await getProjectPaymentManager(ctx as any, installment.projectId, identity.subject);

    if (installment.stripeInvoiceId) {
      throw new Error("This installment is already synced with Stripe and can no longer be edited");
    }

    const patch: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) {
        throw new Error("Installment title is required");
      }
      patch.title = title;
    }

    if (args.description !== undefined) {
      patch.description = normalizeOptionalString(args.description ?? undefined);
    }

    if (args.amount !== undefined) {
      if (!Number.isFinite(args.amount) || args.amount <= 0) {
        throw new Error("Installment amount must be greater than zero");
      }
      patch.amount = Math.round(args.amount * 100) / 100;
    }

    if (args.dueDate !== undefined) {
      patch.dueDate = args.dueDate ?? undefined;
    }

    await ctx.db.patch(args.installmentId, patch);
    return args.installmentId;
  },
});

export const deleteProjectPayment = mutation({
  args: {
    installmentId: v.id("projectPayments"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const installment = await ctx.db.get(args.installmentId);
    if (!installment) {
      throw new Error("Installment not found");
    }

    await getProjectPaymentManager(ctx as any, installment.projectId, identity.subject);

    if (installment.stripeInvoiceId) {
      throw new Error("This installment is already synced with Stripe and cannot be deleted");
    }

    await ctx.db.delete(args.installmentId);
    return args.installmentId;
  },
});

export const getProjectPaymentsByAccessToken = query({
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
      .withIndex("by_client_panel_access_token", (q) => q.eq("clientPanelAccessToken", token))
      .unique();

    if (!project) {
      return null;
    }

    const installments = await listInstallmentsForProject(ctx, project._id);
    return {
      customerName: project.paymentCustomerName || "",
      customerEmail: project.paymentCustomerEmail || "",
      stripeCustomerId: project.stripeProjectCustomerId || null,
      installments: installments
        .filter((installment: any) => installment.status !== "void")
        .map(toPublicInstallment),
    };
  },
});

export const getInstallmentForStripeAction = internalQuery({
  args: {
    installmentId: v.id("projectPayments"),
  },
  async handler(ctx, args) {
    const installment = await ctx.db.get(args.installmentId);
    if (!installment) {
      return null;
    }

    const project = await ctx.db.get(installment.projectId);
    if (!project) {
      return null;
    }

    return { installment, project };
  },
});

export const getProjectForPortalAccess = internalQuery({
  args: {
    accessToken: v.string(),
  },
  async handler(ctx, args) {
    const token = args.accessToken.trim();
    if (!token) {
      return null;
    }

    return await ctx.db
      .query("projects")
      .withIndex("by_client_panel_access_token", (q) => q.eq("clientPanelAccessToken", token))
      .unique();
  },
});

export const setProjectStripeCustomer = internalMutation({
  args: {
    projectId: v.id("projects"),
    stripeProjectCustomerId: v.string(),
    paymentCustomerName: v.optional(v.string()),
    paymentCustomerEmail: v.optional(v.string()),
  },
  async handler(ctx, args) {
    await ctx.db.patch(args.projectId, {
      stripeProjectCustomerId: args.stripeProjectCustomerId,
      paymentCustomerName: normalizeOptionalString(args.paymentCustomerName),
      paymentCustomerEmail: normalizeOptionalString(args.paymentCustomerEmail)?.toLowerCase(),
    });
  },
});

export const attachStripeInvoiceToProjectPayment = internalMutation({
  args: {
    installmentId: v.id("projectPayments"),
    status: PROJECT_PAYMENT_STATUS,
    stripeInvoiceId: v.string(),
    stripeHostedInvoiceUrl: v.optional(v.string()),
    stripeInvoiceNumber: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    lastStripeSyncAt: v.number(),
  },
  async handler(ctx, args) {
    await ctx.db.patch(args.installmentId, {
      status: args.status,
      stripeInvoiceId: args.stripeInvoiceId,
      stripeHostedInvoiceUrl: normalizeOptionalString(args.stripeHostedInvoiceUrl),
      stripeInvoiceNumber: normalizeOptionalString(args.stripeInvoiceNumber),
      stripePaymentIntentId: normalizeOptionalString(args.stripePaymentIntentId),
      sentAt: args.sentAt,
      paidAt: args.paidAt,
      lastStripeSyncAt: args.lastStripeSyncAt,
      updatedAt: Date.now(),
    });
  },
});

export const syncProjectPaymentByStripeInvoiceId = internalMutation({
  args: {
    stripeInvoiceId: v.string(),
    status: PROJECT_PAYMENT_STATUS,
    stripeHostedInvoiceUrl: v.optional(v.string()),
    stripeInvoiceNumber: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    lastStripeSyncAt: v.number(),
  },
  async handler(ctx, args) {
    const installment = await ctx.db
      .query("projectPayments")
      .withIndex("by_stripe_invoice_id", (q) => q.eq("stripeInvoiceId", args.stripeInvoiceId))
      .unique();

    if (!installment) {
      return null;
    }

    await ctx.db.patch(installment._id, {
      status: args.status,
      stripeHostedInvoiceUrl:
        normalizeOptionalString(args.stripeHostedInvoiceUrl) ?? installment.stripeHostedInvoiceUrl,
      stripeInvoiceNumber:
        normalizeOptionalString(args.stripeInvoiceNumber) ?? installment.stripeInvoiceNumber,
      stripePaymentIntentId:
        normalizeOptionalString(args.stripePaymentIntentId) ?? installment.stripePaymentIntentId,
      sentAt: args.sentAt ?? installment.sentAt,
      paidAt: args.paidAt ?? installment.paidAt,
      lastStripeSyncAt: args.lastStripeSyncAt,
      updatedAt: Date.now(),
    });

    return installment._id;
  },
});
