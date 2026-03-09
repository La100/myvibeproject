"use node";

import Stripe from "stripe";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-11-17.clover",
});

type StripeInvoiceActionResult = {
  invoiceId: string;
  status: string;
  url: string;
};

const zeroDecimalCurrencies = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

const normalizeStripeInvoiceStatus = (
  status: Stripe.Invoice.Status | null | undefined,
): "draft" | "open" | "paid" | "void" | "uncollectible" => {
  switch (status) {
    case "draft":
      return "draft";
    case "paid":
      return "paid";
    case "void":
      return "void";
    case "uncollectible":
      return "uncollectible";
    case "open":
    default:
      return "open";
  }
};

const getBaseUrl = () => (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");

const toStripeAmount = (amount: number, currency: string) => {
  const normalizedCurrency = currency.trim().toLowerCase();
  if (zeroDecimalCurrencies.has(normalizedCurrency)) {
    return Math.round(amount);
  }
  return Math.round(amount * 100);
};

const getPaymentIntentId = (invoice: Stripe.Invoice) => {
  const paymentIntent = (invoice as any).payment_intent;
  if (!paymentIntent) {
    return undefined;
  }
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
};

const ensureProjectPaymentAccess = async (ctx: any, project: any, clerkUserId: string) => {
  const membership = await ctx.runQuery(internal.teams.getTeamMemberByClerkId, {
    teamId: project.teamId,
    clerkUserId,
  });

  if (!membership || !membership.isActive) {
    throw new Error("Not authorized to manage project payments");
  }
  if (membership.role !== "admin" && membership.role !== "member") {
    throw new Error("Not authorized to manage project payments");
  }
  if (membership.role === "member" && membership.projectIds && membership.projectIds.length > 0) {
    const allowedProjectIds = membership.projectIds.map(String);
    if (!allowedProjectIds.includes(String(project._id))) {
      throw new Error("Not authorized to manage project payments");
    }
  }
};

const ensureStripeCustomerForProject = async (ctx: any, project: any) => {
  const customerEmail = project.paymentCustomerEmail?.trim().toLowerCase();
  if (!customerEmail) {
    throw new Error("Add a billing email before creating a Stripe payment link");
  }

  const customerName = project.paymentCustomerName?.trim() || project.customer?.trim() || project.name;

  if (project.stripeProjectCustomerId) {
    const updated = await stripe.customers.update(project.stripeProjectCustomerId, {
      email: customerEmail,
      name: customerName,
      metadata: {
        projectId: String(project._id),
        teamId: String(project.teamId),
      },
    });

    await ctx.runMutation(internal.projectPayments.setProjectStripeCustomer, {
      projectId: project._id,
      stripeProjectCustomerId: updated.id,
      paymentCustomerName: customerName,
      paymentCustomerEmail: customerEmail,
    });

    return updated.id;
  }

  const created = await stripe.customers.create({
    email: customerEmail,
    name: customerName,
    metadata: {
      projectId: String(project._id),
      teamId: String(project.teamId),
    },
  });

  await ctx.runMutation(internal.projectPayments.setProjectStripeCustomer, {
    projectId: project._id,
    stripeProjectCustomerId: created.id,
    paymentCustomerName: customerName,
    paymentCustomerEmail: customerEmail,
  });

  return created.id;
};

const syncInstallmentFromInvoice = async (
  ctx: any,
  installmentId: any,
  invoice: Stripe.Invoice,
  sentAt?: number,
) => {
  const status = normalizeStripeInvoiceStatus(invoice.status);
  const hostedInvoiceUrl = invoice.hosted_invoice_url || undefined;
  const paidAt = invoice.status_transitions.paid_at ? invoice.status_transitions.paid_at * 1000 : undefined;
  const resolvedSentAt =
    sentAt ??
    (invoice.status_transitions.finalized_at ? invoice.status_transitions.finalized_at * 1000 : undefined);

  await ctx.runMutation(internal.projectPayments.attachStripeInvoiceToProjectPayment, {
    installmentId,
    status,
    stripeInvoiceId: invoice.id,
    stripeHostedInvoiceUrl: hostedInvoiceUrl,
    stripeInvoiceNumber: invoice.number || undefined,
    stripePaymentIntentId: getPaymentIntentId(invoice),
    sentAt: resolvedSentAt,
    paidAt,
    lastStripeSyncAt: Date.now(),
  });

  return {
    invoiceId: invoice.id,
    status,
    url: hostedInvoiceUrl || "",
  };
};

const upsertProjectPaymentInvoice = async (
  ctx: any,
  installmentId: any,
  sendEmail?: boolean,
): Promise<StripeInvoiceActionResult> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const payload: any = await ctx.runQuery(internal.projectPayments.getInstallmentForStripeAction, {
    installmentId,
  });
  if (!payload) {
    throw new Error("Installment not found");
  }

  const { installment, project }: { installment: any; project: any } = payload;
  await ensureProjectPaymentAccess(ctx, project, identity.subject);

  const customerId = await ensureStripeCustomerForProject(ctx, project);

  if (installment.stripeInvoiceId) {
    let invoice = await stripe.invoices.retrieve(installment.stripeInvoiceId);

    if (invoice.status === "draft") {
      invoice = await stripe.invoices.finalizeInvoice(invoice.id);
    }

    if (sendEmail && invoice.status === "open") {
      await stripe.invoices.sendInvoice(invoice.id);
    }

    return await syncInstallmentFromInvoice(ctx, installment._id, invoice);
  }

  const dueDateSeconds =
    typeof installment.dueDate === "number" ? Math.floor(installment.dueDate / 1000) : undefined;

  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: "send_invoice",
    due_date: dueDateSeconds,
    ...(dueDateSeconds ? {} : { days_until_due: 30 }),
    currency: installment.currency.toLowerCase(),
    metadata: {
      installmentId: String(installment._id),
      projectId: String(project._id),
      teamId: String(project.teamId),
    },
  });

  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: invoice.id,
    currency: installment.currency.toLowerCase(),
    amount: toStripeAmount(installment.amount, installment.currency),
    description: installment.description?.trim()
      ? `${installment.title} - ${installment.description.trim()}`
      : installment.title,
    metadata: {
      installmentId: String(installment._id),
      projectId: String(project._id),
      teamId: String(project.teamId),
    },
  });

  let finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
  let sentAt: number | undefined = finalizedInvoice.status_transitions.finalized_at
    ? finalizedInvoice.status_transitions.finalized_at * 1000
    : Date.now();

  if (sendEmail && finalizedInvoice.status === "open") {
    await stripe.invoices.sendInvoice(finalizedInvoice.id);
    sentAt = Date.now();
    finalizedInvoice = await stripe.invoices.retrieve(finalizedInvoice.id);
  }

  return await syncInstallmentFromInvoice(ctx, installment._id, finalizedInvoice, sentAt);
};

export const createProjectPaymentInvoice = action({
  args: {
    installmentId: v.id("projectPayments"),
    sendEmail: v.optional(v.boolean()),
  },
  returns: v.object({
    invoiceId: v.string(),
    status: v.string(),
    url: v.string(),
  }),
  async handler(ctx, args): Promise<StripeInvoiceActionResult> {
    return await upsertProjectPaymentInvoice(ctx, args.installmentId, args.sendEmail);
  },
});

export const refreshProjectPaymentInvoice = action({
  args: {
    installmentId: v.id("projectPayments"),
  },
  returns: v.object({
    invoiceId: v.string(),
    status: v.string(),
    url: v.string(),
  }),
  async handler(ctx, args): Promise<StripeInvoiceActionResult> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const payload: any = await ctx.runQuery(internal.projectPayments.getInstallmentForStripeAction, {
      installmentId: args.installmentId,
    });
    if (!payload) {
      throw new Error("Installment not found");
    }

    const { installment, project }: { installment: any; project: any } = payload;
    await ensureProjectPaymentAccess(ctx, project, identity.subject);

    if (!installment.stripeInvoiceId) {
      throw new Error("This installment has not been synced with Stripe yet");
    }

    const invoice = await stripe.invoices.retrieve(installment.stripeInvoiceId);
    return await syncInstallmentFromInvoice(ctx, installment._id, invoice);
  },
});

export const sendProjectPaymentInvoiceEmail = action({
  args: {
    installmentId: v.id("projectPayments"),
  },
  returns: v.object({
    invoiceId: v.string(),
    status: v.string(),
    url: v.string(),
  }),
  async handler(ctx, args): Promise<StripeInvoiceActionResult> {
    return await upsertProjectPaymentInvoice(ctx, args.installmentId, true);
  },
});

export const cancelProjectPaymentInvoice = action({
  args: {
    installmentId: v.id("projectPayments"),
  },
  returns: v.object({
    invoiceId: v.string(),
    status: v.string(),
    url: v.string(),
  }),
  async handler(ctx, args): Promise<StripeInvoiceActionResult> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const payload: any = await ctx.runQuery(internal.projectPayments.getInstallmentForStripeAction, {
      installmentId: args.installmentId,
    });
    if (!payload) {
      throw new Error("Installment not found");
    }

    const { installment, project }: { installment: any; project: any } = payload;
    await ensureProjectPaymentAccess(ctx, project, identity.subject);

    if (!installment.stripeInvoiceId) {
      throw new Error("This installment has no Stripe invoice to cancel");
    }

    const invoice = await stripe.invoices.retrieve(installment.stripeInvoiceId);
    if (invoice.status === "paid") {
      throw new Error("Paid installments cannot be voided");
    }

    let invoiceToVoid = invoice;
    if (invoice.status === "draft") {
      invoiceToVoid = await stripe.invoices.finalizeInvoice(invoice.id);
    }

    const cancelledInvoice = await stripe.invoices.voidInvoice(invoiceToVoid.id);

    return await syncInstallmentFromInvoice(ctx, installment._id, cancelledInvoice);
  },
});

export const createProjectCustomerPortalSession = action({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.object({
    url: v.string(),
  }),
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.runQuery(internal.projects.getProjectByIdInternal, {
      projectId: args.projectId,
    });
    if (!project) {
      throw new Error("Project not found");
    }

    await ensureProjectPaymentAccess(ctx, project, identity.subject);
    const customerId = await ensureStripeCustomerForProject(ctx, project);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getBaseUrl()}/organisation/projects/${project.slug}/payments`,
    });

    return { url: session.url };
  },
});

export const createProjectCustomerPortalSessionByAccessToken = action({
  args: {
    accessToken: v.string(),
  },
  returns: v.object({
    url: v.string(),
  }),
  async handler(ctx, args) {
    const project = await ctx.runQuery(internal.projectPayments.getProjectForPortalAccess, {
      accessToken: args.accessToken,
    });
    if (!project) {
      throw new Error("Invalid client portal link");
    }
    if (project.clientPanelPublishedSettings?.showPayments !== true) {
      throw new Error("Payments are hidden in this client portal");
    }

    const customerId = await ensureStripeCustomerForProject(ctx, project);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getBaseUrl()}/client-panel/${project.clientPanelAccessToken}`,
    });

    return { url: session.url };
  },
});
