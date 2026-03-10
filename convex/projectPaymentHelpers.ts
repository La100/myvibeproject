import { v } from "convex/values";

export const billingProfileValidator = v.object({
  sellerName: v.optional(v.string()),
  sellerEmail: v.optional(v.string()),
  sellerPhone: v.optional(v.string()),
  sellerTaxId: v.optional(v.string()),
  sellerAddressLine1: v.optional(v.string()),
  sellerAddressLine2: v.optional(v.string()),
  sellerPostalCode: v.optional(v.string()),
  sellerCity: v.optional(v.string()),
  sellerCountry: v.optional(v.string()),
  bankAccountHolder: v.optional(v.string()),
  bankName: v.optional(v.string()),
  bankAccountNumber: v.optional(v.string()),
  bankSwift: v.optional(v.string()),
  invoicePrefix: v.optional(v.string()),
  paymentInstructions: v.optional(v.string()),
  defaultPaymentTermDays: v.optional(v.number()),
});

export const paymentCustomerDetailsValidator = v.object({
  name: v.optional(v.string()),
  companyName: v.optional(v.string()),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  taxId: v.optional(v.string()),
  addressLine1: v.optional(v.string()),
  addressLine2: v.optional(v.string()),
  postalCode: v.optional(v.string()),
  city: v.optional(v.string()),
  country: v.optional(v.string()),
});

export const invoiceSellerSnapshotValidator = billingProfileValidator;
export const invoiceCustomerSnapshotValidator = paymentCustomerDetailsValidator;

export const normalizeOptionalString = (value?: string | null) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : undefined;
};

export const normalizeOptionalEmail = (value?: string | null) => {
  const normalized = normalizeOptionalString(value);
  return normalized ? normalized.toLowerCase() : undefined;
};

export const normalizeBillingProfile = (
  value?: {
    sellerName?: string | null;
    sellerEmail?: string | null;
    sellerPhone?: string | null;
    sellerTaxId?: string | null;
    sellerAddressLine1?: string | null;
    sellerAddressLine2?: string | null;
    sellerPostalCode?: string | null;
    sellerCity?: string | null;
    sellerCountry?: string | null;
    bankAccountHolder?: string | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankSwift?: string | null;
    invoicePrefix?: string | null;
    paymentInstructions?: string | null;
    defaultPaymentTermDays?: number | null;
  } | null,
) => {
  if (!value) {
    return undefined;
  }

  const normalized = {
    sellerName: normalizeOptionalString(value.sellerName),
    sellerEmail: normalizeOptionalEmail(value.sellerEmail),
    sellerPhone: normalizeOptionalString(value.sellerPhone),
    sellerTaxId: normalizeOptionalString(value.sellerTaxId),
    sellerAddressLine1: normalizeOptionalString(value.sellerAddressLine1),
    sellerAddressLine2: normalizeOptionalString(value.sellerAddressLine2),
    sellerPostalCode: normalizeOptionalString(value.sellerPostalCode),
    sellerCity: normalizeOptionalString(value.sellerCity),
    sellerCountry: normalizeOptionalString(value.sellerCountry),
    bankAccountHolder: normalizeOptionalString(value.bankAccountHolder),
    bankName: normalizeOptionalString(value.bankName),
    bankAccountNumber: normalizeOptionalString(value.bankAccountNumber),
    bankSwift: normalizeOptionalString(value.bankSwift),
    invoicePrefix: normalizeOptionalString(value.invoicePrefix),
    paymentInstructions: normalizeOptionalString(value.paymentInstructions),
    defaultPaymentTermDays:
      typeof value.defaultPaymentTermDays === "number" && Number.isFinite(value.defaultPaymentTermDays)
        ? Math.max(1, Math.round(value.defaultPaymentTermDays))
        : undefined,
  };

  return Object.values(normalized).some((field) => field !== undefined) ? normalized : undefined;
};

export const resolveOrganizationBillingProfile = (
  value?: {
    sellerName?: string | null;
    sellerEmail?: string | null;
    sellerPhone?: string | null;
    sellerTaxId?: string | null;
    sellerAddressLine1?: string | null;
    sellerAddressLine2?: string | null;
    sellerPostalCode?: string | null;
    sellerCity?: string | null;
    sellerCountry?: string | null;
    bankAccountHolder?: string | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankSwift?: string | null;
    invoicePrefix?: string | null;
    paymentInstructions?: string | null;
    defaultPaymentTermDays?: number | null;
  } | null,
  organization?: {
    name?: string | null;
  } | null,
) => {
  const normalized = normalizeBillingProfile(value);
  const fallbackSellerName = normalizeOptionalString(organization?.name);

  if (!normalized && !fallbackSellerName) {
    return undefined;
  }

  return {
    ...normalized,
    sellerName: normalized?.sellerName ?? fallbackSellerName,
  };
};

export const normalizePaymentCustomerDetails = (
  value?: {
    name?: string | null;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    taxId?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
  } | null,
) => {
  if (!value) {
    return undefined;
  }

  const normalized = {
    name: normalizeOptionalString(value.name),
    companyName: normalizeOptionalString(value.companyName),
    email: normalizeOptionalEmail(value.email),
    phone: normalizeOptionalString(value.phone),
    taxId: normalizeOptionalString(value.taxId),
    addressLine1: normalizeOptionalString(value.addressLine1),
    addressLine2: normalizeOptionalString(value.addressLine2),
    postalCode: normalizeOptionalString(value.postalCode),
    city: normalizeOptionalString(value.city),
    country: normalizeOptionalString(value.country),
  };

  return Object.values(normalized).some((field) => field !== undefined) ? normalized : undefined;
};
