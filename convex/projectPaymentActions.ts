"use node";
/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { r2 } from "./files";
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

let regularFontBase64: string | null = null;
let boldFontBase64: string | null = null;

const PDF_FONT_FAMILY = "ArialUnicode";
const PDF_FONT_REGULAR = "Arial.ttf";
const PDF_FONT_BOLD = "Arial-Bold.ttf";
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

const sanitizeFileName = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();

const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const formatDate = (timestamp?: number) => {
  if (!timestamp) return "-";
  return new Intl.DateTimeFormat("pl-PL", {
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

const loadFontBase64 = (fileName: string) => {
  const absolutePath = path.join(process.cwd(), "public", "fonts", fileName);
  return fs.readFileSync(absolutePath).toString("base64");
};

const ensurePdfFonts = (doc: jsPDF) => {
  if (!regularFontBase64) {
    regularFontBase64 = loadFontBase64(PDF_FONT_REGULAR);
  }
  if (!boldFontBase64) {
    boldFontBase64 = loadFontBase64(PDF_FONT_BOLD);
  }

  doc.addFileToVFS(PDF_FONT_REGULAR, regularFontBase64);
  doc.addFont(PDF_FONT_REGULAR, PDF_FONT_FAMILY, "normal");
  doc.addFileToVFS(PDF_FONT_BOLD, boldFontBase64);
  doc.addFont(PDF_FONT_BOLD, PDF_FONT_FAMILY, "bold");
  doc.setFont(PDF_FONT_FAMILY, "normal");
};

const writeMultiline = (doc: jsPDF, value: string, x: number, y: number, maxWidth: number) => {
  const lines = doc.splitTextToSize(value, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * 5;
};

const generateInvoicePdf = (payload: InvoicePayload) => {
  const { installment, project } = payload;
  const billingProfile = getBillingProfile(payload.team, installment);
  const customer = getInvoiceCustomerDetails(project, installment);
  const invoiceNumber = installment.invoiceNumber;
  const paymentReference = installment.paymentReference || invoiceNumber;
  const issuedAt = installment.invoiceIssuedAt || installment.updatedAt || Date.now();

  if (!invoiceNumber) {
    throw new Error("Invoice number not assigned");
  }

  const doc = new jsPDF({
    format: "a4",
    unit: "mm",
  });
  ensurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const rightColumnX = 118;
  let y = 20;

  doc.setFont(PDF_FONT_FAMILY, "bold");
  doc.setFontSize(22);
  doc.text("Faktura VAT", margin, y);
  doc.setFontSize(11);
  doc.setFont(PDF_FONT_FAMILY, "normal");
  doc.text(`Nr ${invoiceNumber}`, margin, y + 8);

  doc.setFont(PDF_FONT_FAMILY, "bold");
  doc.text("Data wystawienia", rightColumnX, y);
  doc.setFont(PDF_FONT_FAMILY, "normal");
  doc.text(formatDate(issuedAt), rightColumnX, y + 6);
  doc.setFont(PDF_FONT_FAMILY, "bold");
  doc.text("Termin płatności", rightColumnX, y + 16);
  doc.setFont(PDF_FONT_FAMILY, "normal");
  doc.text(formatDate(installment.dueDate), rightColumnX, y + 22);

  y = 52;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setFont(PDF_FONT_FAMILY, "bold");
  doc.setFontSize(12);
  doc.text("Sprzedawca", margin, y);
  doc.text("Nabywca", rightColumnX, y);
  y += 7;

  doc.setFont(PDF_FONT_FAMILY, "normal");
  doc.setFontSize(10);
  const sellerBlock = [
    billingProfile.sellerName,
    ...buildAddressBlock({
      addressLine1: billingProfile.sellerAddressLine1,
      addressLine2: billingProfile.sellerAddressLine2,
      postalCode: billingProfile.sellerPostalCode,
      city: billingProfile.sellerCity,
      country: billingProfile.sellerCountry,
    }),
    billingProfile.sellerTaxId ? `NIP: ${billingProfile.sellerTaxId}` : undefined,
    billingProfile.sellerEmail ? `Email: ${billingProfile.sellerEmail}` : undefined,
    billingProfile.sellerPhone ? `Tel: ${billingProfile.sellerPhone}` : undefined,
  ].filter(Boolean) as string[];
  const customerBlock = [
    customer.companyName || customer.name,
    customer.companyName && customer.name ? customer.name : undefined,
    ...buildAddressBlock(customer),
    customer.taxId ? `NIP: ${customer.taxId}` : undefined,
    customer.email ? `Email: ${customer.email}` : undefined,
    customer.phone ? `Tel: ${customer.phone}` : undefined,
  ].filter(Boolean) as string[];

  doc.text(sellerBlock, margin, y);
  doc.text(customerBlock, rightColumnX, y);
  y += Math.max(sellerBlock.length, customerBlock.length) * 5 + 8;

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFillColor(42, 42, 42);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, y, pageWidth - margin * 2, 8, "F");
  doc.setFont(PDF_FONT_FAMILY, "bold");
  doc.text("Opis", margin + 3, y + 5.4);
  doc.text("Kwota", pageWidth - margin - 3, y + 5.4, { align: "right" });
  doc.setTextColor(25, 25, 25);
  doc.setFont(PDF_FONT_FAMILY, "normal");
  y += 13;

  const lineDescription = installment.description?.trim()
    ? `${installment.title} - ${installment.description.trim()}`
    : installment.title;
  y = writeMultiline(doc, lineDescription, margin + 2, y, 120);
  doc.text(formatAmount(installment.amount, installment.currency), pageWidth - margin - 2, y - 5, { align: "right" });
  doc.line(margin, y + 2, pageWidth - margin, y + 2);
  y += 12;

  doc.setFont(PDF_FONT_FAMILY, "bold");
  doc.text("Do zapłaty", pageWidth - margin - 45, y);
  doc.text(formatAmount(installment.amount, installment.currency), pageWidth - margin - 2, y, { align: "right" });
  y += 12;

  doc.setFont(PDF_FONT_FAMILY, "bold");
  doc.text("Dane do przelewu", margin, y);
  y += 6;
  doc.setFont(PDF_FONT_FAMILY, "normal");
  const bankLines = [
    billingProfile.bankAccountHolder || billingProfile.sellerName,
    billingProfile.bankName,
    billingProfile.bankAccountNumber ? `Nr konta: ${billingProfile.bankAccountNumber}` : undefined,
    billingProfile.bankSwift ? `SWIFT: ${billingProfile.bankSwift}` : undefined,
    `Tytuł przelewu: ${paymentReference}`,
  ].filter(Boolean) as string[];
  doc.text(bankLines, margin, y);

  const notes = [
    billingProfile.paymentInstructions,
    installment.sentAt ? `Wysłano klientowi: ${formatDate(installment.sentAt)}` : undefined,
    installment.paidAt ? `Opłacono: ${formatDate(installment.paidAt)}` : undefined,
  ].filter(Boolean).join("\n");
  if (notes) {
    y += bankLines.length * 5 + 6;
    doc.setFont(PDF_FONT_FAMILY, "bold");
    doc.text("Uwagi", margin, y);
    doc.setFont(PDF_FONT_FAMILY, "normal");
    writeMultiline(doc, notes, margin, y + 6, pageWidth - margin * 2);
  }

  return Buffer.from(doc.output("arraybuffer"));
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
    const pdfBuffer = generateInvoicePdf(payload);
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
    subject: `Faktura ${invoiceNumber} - ${payload.project.name}`,
    text:
      `Dzien dobry,\n\n` +
      `w zalaczeniu przesylamy fakture ${invoiceNumber} dla projektu "${payload.project.name}".\n` +
      `Kwota: ${amount}\n` +
      `Termin platnosci: ${dueDate}\n` +
      `Numer konta: ${accountNumber}\n` +
      `Tytul przelewu: ${paymentReference}\n\n` +
      (downloadUrl ? `Pobierz PDF: ${downloadUrl}\n\n` : "") +
      `Pozdrawiamy,\n${billingProfile.sellerName}`,
    html:
      `<p>Dzień dobry,</p>` +
      `<p>W załączeniu przesyłamy fakturę <strong>${escapeHtml(invoiceNumber)}</strong> dla projektu <strong>${escapeHtml(payload.project.name)}</strong>.</p>` +
      `<p>` +
      `Kwota: <strong>${escapeHtml(amount)}</strong><br />` +
      `Termin płatności: <strong>${escapeHtml(dueDate)}</strong><br />` +
      `Numer konta: <strong>${escapeHtml(accountNumber)}</strong><br />` +
      `Tytuł przelewu: <strong>${escapeHtml(paymentReference)}</strong>` +
      `</p>` +
      (downloadUrl
        ? `<p><a href="${escapeHtml(downloadUrl)}">Pobierz fakturę PDF</a></p>`
        : "") +
      `<p>Pozdrawiamy,<br />${escapeHtml(billingProfile.sellerName || payload.team.name)}</p>`,
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
    const pdfBuffer = generateInvoicePdf(ready);
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
