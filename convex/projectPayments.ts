/* eslint-disable @typescript-eslint/no-explicit-any */
import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import {
  invoiceCustomerSnapshotValidator,
  invoiceSellerSnapshotValidator,
  normalizeBillingProfile,
  normalizeOptionalEmail,
  normalizeOptionalString,
  normalizePaymentCustomerDetails,
  paymentCustomerDetailsValidator,
  resolveOrganizationBillingProfile,
} from "./projectPaymentHelpers";

const PROJECT_PAYMENT_STATUS = v.union(
  v.literal("draft"),
  v.literal("open"),
  v.literal("paid"),
  v.literal("void"),
  v.literal("uncollectible"),
);

const PROJECT_PAYMENT_MANUAL_STATUS = v.union(
  v.literal("open"),
  v.literal("paid"),
  v.literal("void"),
  v.literal("uncollectible"),
);

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

const resolveProjectCustomerDetails = (project: any) => {
  const details = normalizePaymentCustomerDetails(project.paymentCustomerDetails);
  return {
    name: details?.name ?? project.paymentCustomerName ?? "",
    companyName: details?.companyName ?? "",
    email: details?.email ?? project.paymentCustomerEmail ?? "",
    phone: details?.phone ?? "",
    taxId: details?.taxId ?? "",
    addressLine1: details?.addressLine1 ?? "",
    addressLine2: details?.addressLine2 ?? "",
    postalCode: details?.postalCode ?? "",
    city: details?.city ?? "",
    country: details?.country ?? "",
  };
};

const buildBillingSetup = (
  billingProfile: ReturnType<typeof resolveOrganizationBillingProfile>,
  customer: ReturnType<typeof resolveProjectCustomerDetails>,
) => {
  const missingSellerFields: string[] = [];
  const missingCustomerFields: string[] = [];

  if (!billingProfile?.sellerName) missingSellerFields.push("Seller name");
  if (!billingProfile?.sellerAddressLine1) missingSellerFields.push("Seller address");
  if (!billingProfile?.sellerCity) missingSellerFields.push("Seller city");
  if (!billingProfile?.sellerCountry) missingSellerFields.push("Seller country");
  if (!billingProfile?.bankAccountNumber) missingSellerFields.push("Bank account number");

  if (!customer.name && !customer.companyName) missingCustomerFields.push("Customer name");
  if (!customer.addressLine1) missingCustomerFields.push("Customer address");
  if (!customer.city) missingCustomerFields.push("Customer city");
  if (!customer.country) missingCustomerFields.push("Customer country");

  return {
    sellerReady: missingSellerFields.length === 0,
    customerReady: missingCustomerFields.length === 0,
    canEmailInvoices: !!customer.email && emailPattern.test(customer.email),
    missingSellerFields,
    missingCustomerFields,
  };
};

const toPublicInstallment = (installment: any) => ({
  ...installment,
  invoiceNumber: installment.invoiceNumber || installment.stripeInvoiceNumber,
  hasInvoicePdf: Boolean(installment.invoicePdfStorageKey),
  isOverdue:
    installment.status === "open" &&
    typeof installment.dueDate === "number" &&
    installment.dueDate < Date.now(),
});

const buildInvoiceNumber = (prefix: string | undefined, sequence: number, issuedAt: number) => {
  const year = new Date(issuedAt).getFullYear();
  const normalizedPrefix = normalizeOptionalString(prefix) || "FV";
  return `${normalizedPrefix}/${year}/${String(sequence).padStart(4, "0")}`;
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
    const team: any = await ctx.db.get(project.teamId);
    const installments = await listInstallmentsForProject(ctx, args.projectId);
    const billingProfile = resolveOrganizationBillingProfile(team?.billingProfile, team) || undefined;
    const customer = resolveProjectCustomerDetails(project);
    const billingSetup = buildBillingSetup(billingProfile, customer);

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
      customer,
      billingProfile: billingProfile || null,
      billingSetup,
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
    customer: v.optional(v.union(paymentCustomerDetailsValidator, v.null())),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    await getProjectPaymentManager(ctx as any, args.projectId, identity.subject);

    const customer = normalizePaymentCustomerDetails(args.customer);
    const customerEmail = customer?.email;

    if (customerEmail && !emailPattern.test(customerEmail)) {
      throw new Error("Enter a valid billing email address");
    }

    await ctx.db.patch(args.projectId, {
      paymentCustomerName: customer?.name,
      paymentCustomerEmail: customer?.email,
      paymentCustomerDetails: customer,
    });

    return customer || {
      name: "",
      companyName: "",
      email: "",
      phone: "",
      taxId: "",
      addressLine1: "",
      addressLine2: "",
      postalCode: "",
      city: "",
      country: "",
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

    if (installment.invoiceNumber || installment.stripeInvoiceId) {
      throw new Error("This installment already has an issued invoice and can no longer be edited");
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

    if (installment.invoiceNumber || installment.stripeInvoiceId) {
      throw new Error("This installment already has an issued invoice and cannot be deleted");
    }

    await ctx.db.delete(args.installmentId);
    return args.installmentId;
  },
});

export const setProjectPaymentManualStatus = mutation({
  args: {
    installmentId: v.id("projectPayments"),
    status: PROJECT_PAYMENT_MANUAL_STATUS,
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

    if (!installment.invoiceNumber && !installment.stripeInvoiceId) {
      throw new Error("Issue the invoice before changing the payment status");
    }

    await ctx.db.patch(args.installmentId, {
      status: args.status,
      paidAt: args.status === "paid" ? Date.now() : undefined,
      updatedAt: Date.now(),
    });

    return args.installmentId;
  },
});

export const setProjectPaymentManualStatusInternal = internalMutation({
  args: {
    installmentId: v.id("projectPayments"),
    status: PROJECT_PAYMENT_MANUAL_STATUS,
  },
  async handler(ctx, args) {
    const installment = await ctx.db.get(args.installmentId);
    if (!installment) {
      throw new Error("Installment not found");
    }

    await ctx.db.patch(args.installmentId, {
      status: args.status,
      paidAt: args.status === "paid" ? Date.now() : undefined,
      updatedAt: Date.now(),
    });

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
      customer: resolveProjectCustomerDetails(project),
      installments: installments
        .filter((installment: any) => installment.status !== "void" && installment.status !== "draft")
        .map(toPublicInstallment),
    };
  },
});

export const getInstallmentForInvoiceAction = internalQuery({
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

    const team = await ctx.db.get(project.teamId);
    if (!team) {
      return null;
    }

    return { installment, project, team };
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

export const assignInvoiceToProjectPayment = internalMutation({
  args: {
    installmentId: v.id("projectPayments"),
    invoiceIssuedAt: v.number(),
    invoicePrefix: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
    invoiceSellerSnapshot: invoiceSellerSnapshotValidator,
    invoiceCustomerSnapshot: invoiceCustomerSnapshotValidator,
  },
  returns: v.object({
    invoiceNumber: v.string(),
    invoiceSequenceNumber: v.number(),
  }),
  async handler(ctx, args) {
    const installment = await ctx.db.get(args.installmentId);
    if (!installment) {
      throw new Error("Installment not found");
    }

    if (installment.invoiceNumber) {
      return {
        invoiceNumber: installment.invoiceNumber,
        invoiceSequenceNumber: installment.invoiceSequenceNumber || 1,
      };
    }

    const teamPayments = await ctx.db
      .query("projectPayments")
      .withIndex("by_team", (q) => q.eq("teamId", installment.teamId))
      .collect();

    const nextSequence =
      teamPayments.reduce((max: number, payment: any) => Math.max(max, payment.invoiceSequenceNumber || 0), 0) + 1;
    const invoiceNumber = buildInvoiceNumber(args.invoicePrefix, nextSequence, args.invoiceIssuedAt);

    await ctx.db.patch(args.installmentId, {
      invoiceNumber,
      invoiceSequenceNumber: nextSequence,
      invoiceIssuedAt: args.invoiceIssuedAt,
      paymentReference: normalizeOptionalString(args.paymentReference) || invoiceNumber,
      invoiceSellerSnapshot: normalizeBillingProfile(args.invoiceSellerSnapshot),
      invoiceCustomerSnapshot: normalizePaymentCustomerDetails(args.invoiceCustomerSnapshot),
      status: installment.status === "paid" ? "paid" : "open",
      updatedAt: Date.now(),
    });

    return {
      invoiceNumber,
      invoiceSequenceNumber: nextSequence,
    };
  },
});

export const storeProjectPaymentInvoiceDocument = internalMutation({
  args: {
    installmentId: v.id("projectPayments"),
    invoicePdfStorageKey: v.string(),
    invoicePdfFileName: v.string(),
  },
  async handler(ctx, args) {
    await ctx.db.patch(args.installmentId, {
      invoicePdfStorageKey: args.invoicePdfStorageKey,
      invoicePdfFileName: args.invoicePdfFileName,
      updatedAt: Date.now(),
    });
  },
});

export const markProjectPaymentInvoiceSent = internalMutation({
  args: {
    installmentId: v.id("projectPayments"),
    sentAt: v.number(),
  },
  async handler(ctx, args) {
    await ctx.db.patch(args.installmentId, {
      sentAt: args.sentAt,
      updatedAt: Date.now(),
    });
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
      paymentCustomerEmail: normalizeOptionalEmail(args.paymentCustomerEmail),
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
