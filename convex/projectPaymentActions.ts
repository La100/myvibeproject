"use node";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { r2 } from "./files";
import { generateInvoicePdf, sanitizeFileName, type InvoicePdfInput } from "../lib/invoicePdf";
import {
  normalizeBillingProfile,
  normalizeOptionalEmail,
  normalizeOptionalString,
  normalizePaymentCustomerDetails,
} from "./projectPaymentHelpers";

type InvoiceActionResult = {
  invoiceNumber: string;
  status: string;
  url: string;
};

type InvoicePayload = {
  installment: any;
  project: any;
  team: any;
};

type BillingProfile = NonNullable<ReturnType<typeof normalizeBillingProfile>>;
type CustomerDetails = NonNullable<ReturnType<typeof normalizePaymentCustomerDetails>>;
const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
// Keep generated refs runtime-loaded here to avoid deep TS instantiation.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const internalAny = require("./_generated/api").internal as any;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const formatDate = (timestamp?: number) => {
  if (!timestamp) return "-";
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(timestamp));
};

const buildAddressBlock = (value: {
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  country?: string;
}) =>
  [
    normalizeOptionalString(value.addressLine1),
    normalizeOptionalString(value.addressLine2),
    [normalizeOptionalString(value.postalCode), normalizeOptionalString(value.city)].filter(Boolean).join(" "),
    normalizeOptionalString(value.country),
  ].filter(Boolean) as string[];

const getInvoiceCustomerDetails = (project: any, installment: any): CustomerDetails => {
  const snapshot = normalizePaymentCustomerDetails(installment.invoiceCustomerSnapshot);
  if (snapshot) {
    return snapshot;
  }

  const normalized = normalizePaymentCustomerDetails(project.paymentCustomerDetails);
  return {
    name: normalized?.name ?? project.paymentCustomerName ?? project.customer ?? project.name,
    companyName: normalized?.companyName,
    email: normalized?.email ?? project.paymentCustomerEmail,
    phone: normalized?.phone,
    taxId: normalized?.taxId,
    addressLine1: normalized?.addressLine1,
    addressLine2: normalized?.addressLine2,
    postalCode: normalized?.postalCode,
    city: normalized?.city,
    country: normalized?.country,
  };
};

const getBillingProfile = (team: any, installment: any): BillingProfile => {
  const snapshot = normalizeBillingProfile(installment.invoiceSellerSnapshot);
  if (snapshot) {
    return snapshot;
  }

  const normalized = normalizeBillingProfile(team.billingProfile);
  return {
    sellerName: normalized?.sellerName ?? team.name,
    sellerEmail: normalized?.sellerEmail,
    sellerPhone: normalized?.sellerPhone,
    sellerTaxId: normalized?.sellerTaxId,
    sellerAddressLine1: normalized?.sellerAddressLine1,
    sellerAddressLine2: normalized?.sellerAddressLine2,
    sellerPostalCode: normalized?.sellerPostalCode,
    sellerCity: normalized?.sellerCity,
    sellerCountry: normalized?.sellerCountry,
    bankAccountHolder: normalized?.bankAccountHolder ?? normalized?.sellerName ?? team.name,
    bankName: normalized?.bankName,
    bankAccountNumber: normalized?.bankAccountNumber,
    bankSwift: normalized?.bankSwift,
    invoicePrefix: normalized?.invoicePrefix,
    paymentInstructions: normalized?.paymentInstructions,
    defaultPaymentTermDays: normalized?.defaultPaymentTermDays,
  };
};

const validateInvoiceReadiness = (billingProfile: BillingProfile, customer: CustomerDetails) => {
  const missing: string[] = [];

  if (!billingProfile.sellerName) missing.push("seller name");
  if (!billingProfile.sellerAddressLine1) missing.push("seller address");
  if (!billingProfile.sellerCity) missing.push("seller city");
  if (!billingProfile.sellerCountry) missing.push("seller country");
  if (!billingProfile.bankAccountNumber) missing.push("bank account number");
  if (!(customer.companyName || customer.name)) missing.push("customer name");
  if (!customer.addressLine1) missing.push("customer address");
  if (!customer.city) missing.push("customer city");
  if (!customer.country) missing.push("customer country");

  if (missing.length > 0) {
    throw new Error(`Complete the billing profile before issuing an invoice: ${missing.join(", ")}`);
  }
};

const ensureProjectPaymentAccess = async (ctx: any, project: any, clerkUserId: string) => {
  const membership = await ctx.runQuery(internalAny.teams.getTeamMemberByClerkId, {
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

const loadInvoicePayload = async (ctx: any, installmentId: any): Promise<InvoicePayload> => {
  const payload = await ctx.runQuery(internalAny.projectPayments.getInstallmentForInvoiceAction, {
    installmentId,
  });

  if (!payload) {
    throw new Error("Installment not found");
  }

  return payload as InvoicePayload;
};

const buildInvoicePdfInput = (payload: InvoicePayload): InvoicePdfInput => {
  const { installment, project } = payload;
  const billingProfile = getBillingProfile(payload.team, installment);
  const customer = getInvoiceCustomerDetails(project, installment);
  const invoiceNumber = installment.invoiceNumber;

  return {
    invoiceNumber,
    issuedAt: installment.invoiceIssuedAt || installment.updatedAt || Date.now(),
    dueDate: installment.dueDate,
    amount: installment.amount,
    currency: installment.currency,
    lineText: installment.description?.trim()
      ? `${installment.title} - ${installment.description.trim()}`
      : installment.title,
    paymentReference: installment.paymentReference || invoiceNumber,
    seller: {
      name: billingProfile.sellerName ?? payload.team.name ?? "Seller",
      addressLines: buildAddressBlock({
        addressLine1: billingProfile.sellerAddressLine1,
        addressLine2: billingProfile.sellerAddressLine2,
        postalCode: billingProfile.sellerPostalCode,
        city: billingProfile.sellerCity,
        country: billingProfile.sellerCountry,
      }),
      taxId: billingProfile.sellerTaxId,
      email: billingProfile.sellerEmail,
      phone: billingProfile.sellerPhone,
      bankAccountHolder: billingProfile.bankAccountHolder || billingProfile.sellerName,
      bankName: billingProfile.bankName,
      bankAccountNumber: billingProfile.bankAccountNumber,
      bankSwift: billingProfile.bankSwift,
      paymentInstructions: billingProfile.paymentInstructions,
    },
    customer: {
      name: customer.companyName || customer.name || project.paymentCustomerName || project.customer || project.name,
      extraName: customer.companyName && customer.name ? customer.name : undefined,
      addressLines: buildAddressBlock(customer),
      taxId: customer.taxId,
      email: customer.email,
      phone: customer.phone,
    },
    sentAt: installment.sentAt,
    paidAt: installment.paidAt,
  };
};

const uploadInvoicePdf = async (
  ctx: any,
  payload: InvoicePayload,
  actorUserId: string,
  fileName: string,
  pdfBuffer: Buffer,
) => {
  const upload = await ctx.runMutation(internalAny.files.generateUploadUrlWithCustomKeyInternal, {
    projectId: payload.project._id,
    actorUserId,
    fileName,
    origin: "general",
    fileSize: pdfBuffer.length,
  });

  const response = await fetch(upload.url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/pdf",
    },
    body: new Uint8Array(pdfBuffer),
  });

  if (!response.ok) {
    throw new Error(`Invoice upload failed with status ${response.status}`);
  }

  await ctx.runMutation(internalAny.projectPayments.storeProjectPaymentInvoiceDocument, {
    installmentId: payload.installment._id,
    invoicePdfStorageKey: upload.key,
    invoicePdfFileName: fileName,
  });

  return upload.key;
};

const getInvoiceDownloadUrl = async (storageKey: string) => {
  return await r2.getUrl(storageKey, { expiresIn: 60 * 30 });
};

const sendResendEmail = async (args: {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachmentName?: string;
  attachmentContent?: string;
}) => {
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFromEmail = process.env.RESEND_FROM_EMAIL;
  if (!resendApiKey || !resendFromEmail) {
    throw new Error("Resend is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: [args.to],
      subject: args.subject,
      text: args.text,
      html: args.html,
      attachments:
        args.attachmentName && args.attachmentContent
          ? [
              {
                filename: args.attachmentName,
                content: args.attachmentContent,
              },
            ]
          : undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send email: ${response.status} ${await response.text()}`);
  }
};

const ensureInvoiceDocument = async (
  ctx: any,
  installmentId: any,
  actorUserId: string,
) => {
  let payload = await loadInvoicePayload(ctx, installmentId);
  const billingProfile = getBillingProfile(payload.team, payload.installment);
  const customer = getInvoiceCustomerDetails(payload.project, payload.installment);
  validateInvoiceReadiness(billingProfile, customer);

  if (!payload.installment.invoiceNumber) {
    const invoiceIssuedAt = Date.now();
    const paymentReference = `${payload.project.name} / ${payload.installment.title}`;
    await ctx.runMutation(internalAny.projectPayments.assignInvoiceToProjectPayment, {
      installmentId,
      invoiceIssuedAt,
      invoicePrefix: billingProfile.invoicePrefix,
      paymentReference,
      invoiceSellerSnapshot: billingProfile,
      invoiceCustomerSnapshot: customer,
    });
    payload = await loadInvoicePayload(ctx, installmentId);
  }

  if (!payload.installment.invoicePdfStorageKey) {
    const safeInvoiceNumber = sanitizeFileName(payload.installment.invoiceNumber || "invoice");
    const fileName = `invoice-${safeInvoiceNumber}.pdf`;
    const pdfBuffer = generateInvoicePdf(buildInvoicePdfInput(payload));
    await uploadInvoicePdf(ctx, payload, actorUserId, fileName, pdfBuffer);
    payload = await loadInvoicePayload(ctx, installmentId);
  }

  return payload;
};

const buildInvoiceEmail = async (payload: InvoicePayload) => {
  const billingProfile = getBillingProfile(payload.team, payload.installment);
  const customer = getInvoiceCustomerDetails(payload.project, payload.installment);
  const email = normalizeOptionalEmail(customer.email);
  if (!email || !emailPattern.test(email)) {
    throw new Error("Add a valid billing email before sending the invoice");
  }

  const downloadUrl = payload.installment.invoicePdfStorageKey
    ? await getInvoiceDownloadUrl(payload.installment.invoicePdfStorageKey)
    : "";
  const amount = formatAmount(payload.installment.amount, payload.installment.currency);
  const dueDate = formatDate(payload.installment.dueDate);
  const invoiceNumber = payload.installment.invoiceNumber;
  const paymentReference = payload.installment.paymentReference || invoiceNumber;
  const accountNumber = billingProfile.bankAccountNumber || "-";

  return {
    to: email,
    subject: `Invoice ${invoiceNumber} - ${payload.project.name}`,
    text:
      `Hello,\n\n` +
      `Please find invoice ${invoiceNumber} for the project "${payload.project.name}" attached.\n` +
      `Amount: ${amount}\n` +
      `Due date: ${dueDate}\n` +
      `Account number: ${accountNumber}\n` +
      `Transfer reference: ${paymentReference}\n\n` +
      (downloadUrl ? `Download PDF: ${downloadUrl}\n\n` : "") +
      `Best regards,\n${billingProfile.sellerName}`,
    html:
      `<p>Hello,</p>` +
      `<p>Please find invoice <strong>${escapeHtml(invoiceNumber)}</strong> for the project <strong>${escapeHtml(payload.project.name)}</strong> attached.</p>` +
      `<p>` +
      `Amount: <strong>${escapeHtml(amount)}</strong><br />` +
      `Due date: <strong>${escapeHtml(dueDate)}</strong><br />` +
      `Account number: <strong>${escapeHtml(accountNumber)}</strong><br />` +
      `Transfer reference: <strong>${escapeHtml(paymentReference)}</strong>` +
      `</p>` +
      (downloadUrl
        ? `<p><a href="${escapeHtml(downloadUrl)}">Download invoice PDF</a></p>`
        : "") +
      `<p>Best regards,<br />${escapeHtml(billingProfile.sellerName || payload.team.name)}</p>`,
  };
};

const issueInvoice = async (
  ctx: any,
  installmentId: any,
  actorUserId: string,
  options?: { sendEmail?: boolean },
): Promise<InvoiceActionResult> => {
  const ready = await ensureInvoiceDocument(ctx, installmentId, actorUserId);
  const url = ready.installment.invoicePdfStorageKey
    ? await getInvoiceDownloadUrl(ready.installment.invoicePdfStorageKey)
    : "";

  if (options?.sendEmail) {
    const email = await buildInvoiceEmail(ready);
    const pdfBuffer = generateInvoicePdf(buildInvoicePdfInput(ready));
    await sendResendEmail({
      ...email,
      attachmentName: ready.installment.invoicePdfFileName || `invoice-${ready.installment.invoiceNumber}.pdf`,
      attachmentContent: pdfBuffer.toString("base64"),
    });
    await ctx.runMutation(internalAny.projectPayments.markProjectPaymentInvoiceSent, {
      installmentId,
      sentAt: Date.now(),
    });
  }

  return {
    invoiceNumber: ready.installment.invoiceNumber,
    status: ready.installment.status,
    url,
  };
};

export const createProjectPaymentInvoice = action({
  args: {
    installmentId: v.id("projectPayments"),
    sendEmail: v.optional(v.boolean()),
  },
  returns: v.object({
    invoiceNumber: v.string(),
    status: v.string(),
    url: v.string(),
  }),
  async handler(ctx, args): Promise<InvoiceActionResult> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const payload = await loadInvoicePayload(ctx, args.installmentId);
    await ensureProjectPaymentAccess(ctx, payload.project, identity.subject);
    return await issueInvoice(ctx, args.installmentId, identity.subject, {
      sendEmail: args.sendEmail,
    });
  },
});

export const refreshProjectPaymentInvoice = action({
  args: {
    installmentId: v.id("projectPayments"),
  },
  returns: v.object({
    invoiceNumber: v.string(),
    status: v.string(),
    url: v.string(),
  }),
  async handler(ctx, args): Promise<InvoiceActionResult> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const payload = await loadInvoicePayload(ctx, args.installmentId);
    await ensureProjectPaymentAccess(ctx, payload.project, identity.subject);
    const ready = await ensureInvoiceDocument(ctx, args.installmentId, identity.subject);
    const url = ready.installment.invoicePdfStorageKey
      ? await getInvoiceDownloadUrl(ready.installment.invoicePdfStorageKey)
      : "";

    return {
      invoiceNumber: ready.installment.invoiceNumber,
      status: ready.installment.status,
      url,
    };
  },
});

export const sendProjectPaymentInvoiceEmail = action({
  args: {
    installmentId: v.id("projectPayments"),
  },
  returns: v.object({
    invoiceNumber: v.string(),
    status: v.string(),
    url: v.string(),
  }),
  async handler(ctx, args): Promise<InvoiceActionResult> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const payload = await loadInvoicePayload(ctx, args.installmentId);
    await ensureProjectPaymentAccess(ctx, payload.project, identity.subject);
    return await issueInvoice(ctx, args.installmentId, identity.subject, {
      sendEmail: true,
    });
  },
});

export const cancelProjectPaymentInvoice = action({
  args: {
    installmentId: v.id("projectPayments"),
  },
  returns: v.object({
    invoiceNumber: v.string(),
    status: v.string(),
    url: v.string(),
  }),
  async handler(ctx, args): Promise<InvoiceActionResult> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const payload = await loadInvoicePayload(ctx, args.installmentId);
    await ensureProjectPaymentAccess(ctx, payload.project, identity.subject);
    await ctx.runMutation(internalAny.projectPayments.setProjectPaymentManualStatusInternal, {
      installmentId: args.installmentId,
      status: "void",
    });
    const refreshed = await loadInvoicePayload(ctx, args.installmentId);
    const url = refreshed.installment.invoicePdfStorageKey
      ? await getInvoiceDownloadUrl(refreshed.installment.invoicePdfStorageKey)
      : "";

    return {
      invoiceNumber: refreshed.installment.invoiceNumber || "",
      status: refreshed.installment.status,
      url,
    };
  },
});

export const getProjectPaymentInvoiceDownloadUrl = action({
  args: {
    installmentId: v.id("projectPayments"),
  },
  returns: v.object({
    url: v.string(),
  }),
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const payload = await loadInvoicePayload(ctx, args.installmentId);
    await ensureProjectPaymentAccess(ctx, payload.project, identity.subject);

    if (!payload.installment.invoicePdfStorageKey) {
      const ready = await ensureInvoiceDocument(ctx, args.installmentId, identity.subject);
      if (!ready.installment.invoicePdfStorageKey) {
        throw new Error("Invoice PDF is not available yet");
      }
      return {
        url: await getInvoiceDownloadUrl(ready.installment.invoicePdfStorageKey),
      };
    }

    return {
      url: await getInvoiceDownloadUrl(payload.installment.invoicePdfStorageKey),
    };
  },
});

export const getProjectPaymentInvoiceDownloadUrlByAccessToken = action({
  args: {
    accessToken: v.string(),
    installmentId: v.id("projectPayments"),
  },
  returns: v.object({
    url: v.string(),
  }),
  async handler(ctx, args) {
    const project = await ctx.runQuery(internalAny.projectPayments.getProjectForPortalAccess, {
      accessToken: args.accessToken,
    });
    if (!project) {
      throw new Error("Invalid client portal link");
    }
    if (project.clientPanelPublishedSettings?.showPayments !== true) {
      throw new Error("Payments are hidden in this client portal");
    }

    const payload = await loadInvoicePayload(ctx, args.installmentId);
    if (String(payload.project._id) !== String(project._id)) {
      throw new Error("This invoice does not belong to the shared project");
    }
    if (!payload.installment.invoicePdfStorageKey) {
      throw new Error("Invoice PDF is not available yet");
    }

    return {
      url: await getInvoiceDownloadUrl(payload.installment.invoicePdfStorageKey),
    };
  },
});

export const createProjectCustomerPortalSession = action({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.object({
    url: v.string(),
  }),
  async handler() {
    throw new Error("Stripe customer portal is disabled for bank-transfer invoices");
  },
});

export const createProjectCustomerPortalSessionByAccessToken = action({
  args: {
    accessToken: v.string(),
  },
  returns: v.object({
    url: v.string(),
  }),
  async handler(_ctx, args) {
    return { url: `${BASE_URL}/client-panel/${args.accessToken}` };
  },
});
