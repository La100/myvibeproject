/* eslint-disable @typescript-eslint/no-explicit-any */
import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { canAccessProjectWithMembership, ensureTeamAccess } from "./authz";
import {
  applyInvoiceFieldVisibilityToBillingProfile,
  applyInvoiceFieldVisibilityToCustomer,
  invoiceCustomerSnapshotValidator,
  invoiceLineItemValidator,
  invoiceSellerSnapshotValidator,
  invoiceTaxSettingsSnapshotValidator,
  normalizeBillingProfile,
  normalizeInvoiceLineItems,
  normalizeInvoiceTaxSettingsSnapshot,
  normalizeOptionalEmail,
  normalizeOptionalString,
  normalizePaymentCustomerDetails,
  paymentCustomerDetailsValidator,
  getInvoiceLineItemsSubtotal,
  resolveInvoiceFieldRequirements,
  resolveInvoiceLineItems,
  resolveInvoiceTaxSettingsSnapshot,
  resolveOrganizationBillingProfile,
} from "./projectPaymentHelpers";
import { calculateTaxBreakdown, resolveOrganizationTaxSettings } from "../lib/organizationTax";

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

const roundCurrency = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

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

  if (membership.role === "member" && Array.isArray(membership.projectIds)) {
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

const buildBillingSetup = ({
  sellerName,
  customerName,
  customerCompanyName,
  bankAccountNumber,
  stripeConnectOnboardingComplete,
}: {
  sellerName?: string;
  customerName?: string;
  customerCompanyName?: string;
  bankAccountNumber?: string;
  stripeConnectOnboardingComplete: boolean;
}) => {
  const missingSellerFields: string[] = [];
  const missingCustomerFields: string[] = [];

  if (!normalizeOptionalString(sellerName)) {
    missingSellerFields.push("seller name");
  }

  const hasCustomerIdentity =
    !!normalizeOptionalString(customerCompanyName) || !!normalizeOptionalString(customerName);
  if (!hasCustomerIdentity) {
    missingCustomerFields.push("customer name or company");
  }

  const hasBankAccountNumber = !!normalizeOptionalString(bankAccountNumber);
  if (!stripeConnectOnboardingComplete && !hasBankAccountNumber) {
    missingSellerFields.push("bank account number or Stripe payments");
  }

  return {
    sellerReady: missingSellerFields.length === 0,
    customerReady: missingCustomerFields.length === 0,
    missingSellerFields,
    missingCustomerFields,
  };
};

const toPublicInstallment = (installment: any) => ({
  ...installment,
  invoiceNumber: installment.invoiceNumber || installment.stripeInvoiceNumber,
  hasInvoicePdf: Boolean(installment.invoicePdfStorageKey),
  invoiceSellerSnapshot: normalizeBillingProfile(installment.invoiceSellerSnapshot),
  invoiceCustomerSnapshot: normalizePaymentCustomerDetails(installment.invoiceCustomerSnapshot),
  invoiceLineItems: resolveInvoiceLineItems(installment) || [],
  invoiceTaxSettingsSnapshot: normalizeInvoiceTaxSettingsSnapshot(
    installment.invoiceTaxSettingsSnapshot,
  ),
  isOverdue:
    installment.status === "open" &&
    typeof installment.dueDate === "number" &&
    installment.dueDate < Date.now(),
});

const buildInvoiceNumber = (prefix: string | undefined, sequence: number, issuedAt: number) => {
  const year = new Date(issuedAt).getFullYear();
  const normalizedPrefix = normalizeOptionalString(prefix) || "INV";
  return `${normalizedPrefix}/${year}/${String(sequence).padStart(4, "0")}`;
};

export const getTeamInvoicesReport = query({
  args: {
    teamId: v.id("teams"),
  },
  async handler(ctx, args) {
    const { membership } = await ensureTeamAccess(ctx, args.teamId);
    const team: any = await ctx.db.get(args.teamId);

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q: any) => q.eq("teamId", args.teamId))
      .collect();

    const accessibleProjects = projects.filter((project: any) =>
      canAccessProjectWithMembership(membership, project._id),
    );

    const projectMap = new Map(
      accessibleProjects.map((project: any) => [String(project._id), project]),
    );

    const issuedPayments = (
      await ctx.db
        .query("projectPayments")
        .withIndex("by_team", (q: any) => q.eq("teamId", args.teamId))
        .collect()
    )
      .filter((payment: any) => {
        const project = projectMap.get(String(payment.projectId));
        if (!project) {
          return false;
        }

        return Boolean(payment.invoiceNumber || payment.stripeInvoiceNumber);
      })
      .sort((left: any, right: any) => {
        const leftDate = left.invoiceIssuedAt || left.sentAt || left._creationTime || 0;
        const rightDate = right.invoiceIssuedAt || right.sentAt || right._creationTime || 0;
        return rightDate - leftDate;
      });

    const invoiceRows = issuedPayments.map((payment: any) => {
      const project = projectMap.get(String(payment.projectId));
      const lineItems = resolveInvoiceLineItems(payment) || [];
      const taxSettings = resolveInvoiceTaxSettingsSnapshot(
        payment.invoiceTaxSettingsSnapshot,
        team?.organizationTaxSettings,
        Boolean(normalizeInvoiceLineItems(payment.invoiceLineItems)?.length),
      );
      const subtotal = lineItems.length > 0 ? getInvoiceLineItemsSubtotal(lineItems) : payment.amount;
      const breakdown = taxSettings
        ? calculateTaxBreakdown(subtotal, taxSettings)
        : { net: subtotal, tax: 0, gross: payment.amount };
      const customer = normalizePaymentCustomerDetails(payment.invoiceCustomerSnapshot);

      return {
        _id: payment._id,
        projectId: payment.projectId,
        projectName: project?.name || "Project",
        projectSlug: project?.slug,
        title: payment.title,
        status: payment.status,
        invoiceNumber: payment.invoiceNumber || payment.stripeInvoiceNumber,
        currency: payment.currency || project?.currency || "PLN",
        total: payment.amount,
        subtotal: breakdown.net,
        taxAmount: breakdown.tax,
        invoiceIssuedAt: payment.invoiceIssuedAt,
        dueDate: payment.dueDate,
        sentAt: payment.sentAt,
        paidAt: payment.paidAt,
        hasInvoicePdf: Boolean(payment.invoicePdfStorageKey),
        customerName:
          customer?.companyName || customer?.name || project?.paymentCustomerName || project?.customer || "",
        customerEmail: customer?.email || project?.paymentCustomerEmail || "",
        isOverdue:
          payment.status === "open" &&
          typeof payment.dueDate === "number" &&
          payment.dueDate < Date.now(),
      };
    });

    const totals = invoiceRows.reduce(
      (acc, invoice) => {
        acc.invoiceCount += 1;
        if (invoice.status === "paid") {
          acc.paidCount += 1;
        } else if (invoice.status === "open") {
          acc.openCount += 1;
        }
        if (invoice.isOverdue) {
          acc.overdueCount += 1;
        }
        return acc;
      },
      {
        invoiceCount: 0,
        openCount: 0,
        overdueCount: 0,
        paidCount: 0,
      },
    );

    const currencySummary = Array.from(
      invoiceRows.reduce((map, invoice) => {
        const key = invoice.currency || "PLN";
        const current = map.get(key) || {
          currency: key,
          invoiceCount: 0,
          openTotal: 0,
          overdueTotal: 0,
          paidTotal: 0,
          total: 0,
        };

        current.invoiceCount += 1;
        current.total += invoice.total;
        if (invoice.status === "paid") {
          current.paidTotal += invoice.total;
        } else if (invoice.status === "open") {
          current.openTotal += invoice.total;
        }
        if (invoice.isOverdue) {
          current.overdueTotal += invoice.total;
        }

        map.set(key, current);
        return map;
      }, new Map<string, {
        currency: string;
        invoiceCount: number;
        openTotal: number;
        overdueTotal: number;
        paidTotal: number;
        total: number;
      }>()).values(),
    ).sort((left, right) => left.currency.localeCompare(right.currency));

    return {
      currencySummary,
      invoices: invoiceRows,
      totals,
    };
  },
});

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
    const organizationTaxSettings = resolveOrganizationTaxSettings(team?.organizationTaxSettings);
    const invoiceFieldRequirements = resolveInvoiceFieldRequirements(team?.invoiceFieldRequirements);
    const customer = resolveProjectCustomerDetails(project);
    const stripeConnectOnboardingComplete =
      team?.stripeConnectOnboardingComplete === true ||
      (team?.stripeConnectChargesEnabled === true && team?.stripeConnectPayoutsEnabled === true);
    const visibleBillingProfile = applyInvoiceFieldVisibilityToBillingProfile(
      billingProfile as ReturnType<typeof normalizeBillingProfile>,
      invoiceFieldRequirements,
    );
    const visibleCustomer = applyInvoiceFieldVisibilityToCustomer(customer, invoiceFieldRequirements);
    const sellerName = normalizeOptionalString(visibleBillingProfile?.sellerName);
    const customerName = normalizeOptionalString(visibleCustomer?.name);
    const customerCompanyName = normalizeOptionalString(visibleCustomer?.companyName);
    const bankAccountNumber = normalizeOptionalString(visibleBillingProfile?.bankAccountNumber);
    const billingSetup = {
      ...buildBillingSetup({
        sellerName,
        customerName,
        customerCompanyName,
        bankAccountNumber,
        stripeConnectOnboardingComplete,
      }),
      canEmailInvoices:
        !!normalizeOptionalEmail(visibleCustomer?.email) &&
        emailPattern.test(normalizeOptionalEmail(visibleCustomer?.email) || ""),
    };

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
      organizationTaxSettings,
      invoiceFieldRequirements,
      billingSetup,
      stripeConnect: {
        accountId: team?.stripeConnectAccountId ?? null,
        accountType: team?.stripeConnectAccountType ?? null,
        chargesEnabled: team?.stripeConnectChargesEnabled === true,
        payoutsEnabled: team?.stripeConnectPayoutsEnabled === true,
        detailsSubmitted: team?.stripeConnectDetailsSubmitted === true,
        onboardingComplete: stripeConnectOnboardingComplete,
      },
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
    invoiceLineItems: v.optional(v.array(invoiceLineItemValidator)),
    invoiceTaxSettingsSnapshot: v.optional(invoiceTaxSettingsSnapshotValidator),
    dueDate: v.optional(v.union(v.number(), v.null())),
    invoiceSellerSnapshot: v.optional(invoiceSellerSnapshotValidator),
    invoiceCustomerSnapshot: v.optional(invoiceCustomerSnapshotValidator),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { project } = await getProjectPaymentManager(ctx as any, args.projectId, identity.subject);
    const team: any = await ctx.db.get(project.teamId);
    const title = args.title.trim();
    const description = normalizeOptionalString(args.description);
    const invoiceLineItems = normalizeInvoiceLineItems(args.invoiceLineItems);
    if (args.invoiceLineItems !== undefined && !invoiceLineItems) {
      throw new Error("Add at least one invoice line item");
    }
    const hasExplicitLineItems = Boolean(invoiceLineItems?.length);
    const invoiceTaxSettingsSnapshot = resolveInvoiceTaxSettingsSnapshot(
      args.invoiceTaxSettingsSnapshot,
      team?.organizationTaxSettings,
      hasExplicitLineItems,
    );
    const baseAmount = invoiceLineItems
      ? getInvoiceLineItemsSubtotal(invoiceLineItems)
      : roundCurrency(args.amount);
    const computedAmount = invoiceTaxSettingsSnapshot
      ? calculateTaxBreakdown(baseAmount, invoiceTaxSettingsSnapshot).gross
      : baseAmount;

    if (!title) {
      throw new Error("Installment title is required");
    }
    if (!Number.isFinite(computedAmount) || computedAmount <= 0) {
      throw new Error("Installment amount must be greater than zero");
    }

    const installments = await listInstallmentsForProject(ctx, args.projectId);
    const nextOrder = installments.length > 0 ? Math.max(...installments.map((item: any) => item.order)) + 1 : 0;
    return await ctx.db.insert("projectPayments", {
      projectId: args.projectId,
      teamId: project.teamId,
      title,
      description,
      amount: computedAmount,
      invoiceLineItems,
      invoiceTaxSettingsSnapshot,
      currency: project.currency || "PLN",
      dueDate: args.dueDate ?? undefined,
      invoiceSellerSnapshot: normalizeBillingProfile(args.invoiceSellerSnapshot),
      invoiceCustomerSnapshot: normalizePaymentCustomerDetails(args.invoiceCustomerSnapshot),
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
    invoiceLineItems: v.optional(v.array(invoiceLineItemValidator)),
    invoiceTaxSettingsSnapshot: v.optional(invoiceTaxSettingsSnapshotValidator),
    dueDate: v.optional(v.union(v.number(), v.null())),
    invoiceSellerSnapshot: v.optional(invoiceSellerSnapshotValidator),
    invoiceCustomerSnapshot: v.optional(invoiceCustomerSnapshotValidator),
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

    const { project } = await getProjectPaymentManager(ctx as any, installment.projectId, identity.subject);
    const team: any = await ctx.db.get(project.teamId);

    if (installment.invoiceNumber || installment.stripeInvoiceId) {
      throw new Error("This installment already has an issued invoice and can no longer be edited");
    }

    const patch: Record<string, unknown> = {
      updatedAt: Date.now(),
    };
    let normalizedLineItems: ReturnType<typeof normalizeInvoiceLineItems> | undefined;
    let normalizedTaxSettings: ReturnType<typeof resolveInvoiceTaxSettingsSnapshot> | undefined;

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

    if (args.invoiceLineItems !== undefined) {
      normalizedLineItems = normalizeInvoiceLineItems(args.invoiceLineItems);
      if (!normalizedLineItems) {
        throw new Error("Add at least one invoice line item");
      }
      patch.invoiceLineItems = normalizedLineItems;
    }

    if (args.invoiceTaxSettingsSnapshot !== undefined) {
      normalizedTaxSettings = resolveInvoiceTaxSettingsSnapshot(
        args.invoiceTaxSettingsSnapshot,
        team?.organizationTaxSettings,
        Boolean(
          normalizedLineItems?.length || normalizeInvoiceLineItems(installment.invoiceLineItems)?.length,
        ),
      );
    }

    const existingLineItems = normalizeInvoiceLineItems(installment.invoiceLineItems);
    const nextLineItems =
      normalizedLineItems !== undefined ? normalizedLineItems : existingLineItems;
    const hasLineItems = Boolean(nextLineItems?.length);
    const nextTaxSettings =
      normalizedTaxSettings !== undefined
        ? normalizedTaxSettings
        : resolveInvoiceTaxSettingsSnapshot(
            installment.invoiceTaxSettingsSnapshot,
            team?.organizationTaxSettings,
            hasLineItems,
          );

    if (hasLineItems && nextTaxSettings) {
      patch.invoiceTaxSettingsSnapshot = nextTaxSettings;
    } else if (args.invoiceTaxSettingsSnapshot !== undefined) {
      patch.invoiceTaxSettingsSnapshot = nextTaxSettings;
    }

    if (args.amount !== undefined || normalizedLineItems !== undefined || args.invoiceTaxSettingsSnapshot !== undefined) {
      // Respect direct amount edits when the caller updates the legacy summary
      // without sending a full invoice line item payload.
      const baseAmount =
        normalizedLineItems !== undefined
          ? getInvoiceLineItemsSubtotal(nextLineItems)
          : typeof args.amount === "number"
            ? args.amount
            : hasLineItems
              ? getInvoiceLineItemsSubtotal(nextLineItems)
              : installment.amount;
      const nextAmount = nextTaxSettings
        ? calculateTaxBreakdown(baseAmount, nextTaxSettings).gross
        : roundCurrency(baseAmount);

      if (typeof nextAmount !== "number" || !Number.isFinite(nextAmount) || nextAmount <= 0) {
        throw new Error("Installment amount must be greater than zero");
      }
      patch.amount = roundCurrency(nextAmount);
    }

    if (args.dueDate !== undefined) {
      patch.dueDate = args.dueDate ?? undefined;
    }

    if (args.invoiceSellerSnapshot !== undefined) {
      patch.invoiceSellerSnapshot = normalizeBillingProfile(args.invoiceSellerSnapshot);
    }

    if (args.invoiceCustomerSnapshot !== undefined) {
      patch.invoiceCustomerSnapshot = normalizePaymentCustomerDetails(args.invoiceCustomerSnapshot);
    }

    await ctx.db.patch(args.installmentId, patch);
    return args.installmentId;
  },
});

export const updateIssuedProjectPaymentInvoice = mutation({
  args: {
    installmentId: v.id("projectPayments"),
    title: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    amount: v.number(),
    invoiceLineItems: v.optional(v.array(invoiceLineItemValidator)),
    invoiceTaxSettingsSnapshot: v.optional(invoiceTaxSettingsSnapshotValidator),
    dueDate: v.optional(v.union(v.number(), v.null())),
    invoiceNumber: v.string(),
    invoiceSellerSnapshot: v.optional(invoiceSellerSnapshotValidator),
    invoiceCustomerSnapshot: v.optional(invoiceCustomerSnapshotValidator),
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

    const { project } = await getProjectPaymentManager(ctx as any, installment.projectId, identity.subject);
    const team: any = await ctx.db.get(project.teamId);

    if (!installment.invoiceNumber) {
      throw new Error("Issue the invoice before editing it");
    }

    if (installment.stripeInvoiceId) {
      throw new Error("Stripe-linked invoices cannot be fully edited here");
    }

    const title = args.title.trim();
    const invoiceLineItems = args.invoiceLineItems !== undefined
      ? normalizeInvoiceLineItems(args.invoiceLineItems)
      : undefined;
    if (args.invoiceLineItems !== undefined && !invoiceLineItems) {
      throw new Error("Add at least one invoice line item");
    }
    const existingLineItems = normalizeInvoiceLineItems(installment.invoiceLineItems);
    const hasExplicitLineItems = Boolean((invoiceLineItems ?? existingLineItems)?.length);
    const invoiceTaxSettingsSource =
      args.invoiceTaxSettingsSnapshot !== undefined
        ? args.invoiceTaxSettingsSnapshot
        : installment.invoiceTaxSettingsSnapshot;
    const invoiceTaxSettingsSnapshot = resolveInvoiceTaxSettingsSnapshot(
      invoiceTaxSettingsSource,
      team?.organizationTaxSettings,
      hasExplicitLineItems,
    );
    const baseAmount = invoiceLineItems && invoiceLineItems.length > 0
      ? getInvoiceLineItemsSubtotal(invoiceLineItems)
      : Number.isFinite(args.amount)
        ? roundCurrency(args.amount)
        : existingLineItems?.length
          ? getInvoiceLineItemsSubtotal(existingLineItems)
          : roundCurrency(args.amount);
    const computedAmount = invoiceTaxSettingsSnapshot
      ? calculateTaxBreakdown(baseAmount, invoiceTaxSettingsSnapshot).gross
      : baseAmount;
    if (!title) {
      throw new Error("Invoice title is required");
    }

    if (!Number.isFinite(computedAmount) || computedAmount <= 0) {
      throw new Error("Invoice amount must be greater than zero");
    }

    const invoiceNumber = args.invoiceNumber.trim();
    if (!invoiceNumber) {
      throw new Error("Invoice number is required");
    }

    const teamPayments = await ctx.db
      .query("projectPayments")
      .withIndex("by_team", (q) => q.eq("teamId", installment.teamId))
      .collect();

    const duplicate = teamPayments.find(
      (payment: any) =>
        payment._id !== installment._id &&
        (payment.invoiceNumber === invoiceNumber || payment.stripeInvoiceNumber === invoiceNumber),
    );

    if (duplicate) {
      throw new Error("This invoice number is already in use");
    }

    await ctx.db.patch(args.installmentId, {
      title,
      description: normalizeOptionalString(args.description ?? undefined),
      amount: computedAmount,
      ...(args.invoiceLineItems !== undefined ? { invoiceLineItems } : {}),
      ...((hasExplicitLineItems || args.invoiceTaxSettingsSnapshot !== undefined)
        ? { invoiceTaxSettingsSnapshot }
        : {}),
      dueDate: args.dueDate ?? undefined,
      invoiceNumber,
      invoiceSellerSnapshot: normalizeBillingProfile(args.invoiceSellerSnapshot),
      invoiceCustomerSnapshot: normalizePaymentCustomerDetails(args.invoiceCustomerSnapshot),
      invoicePdfStorageKey: undefined,
      invoicePdfFileName: undefined,
      updatedAt: Date.now(),
    });

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
    if (project.clientPanelPublishedSettings?.showPayments !== true) {
      return null;
    }

    return {
      customer: resolveProjectCustomerDetails(project),
      installments: project.clientPanelPublishedSnapshot?.payments ?? [],
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
    invoiceTaxSettingsSnapshot: v.optional(invoiceTaxSettingsSnapshotValidator),
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
      invoiceTaxSettingsSnapshot: normalizeInvoiceTaxSettingsSnapshot(args.invoiceTaxSettingsSnapshot),
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
