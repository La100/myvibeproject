import { v } from "convex/values";
import {
  clampOrganizationTaxRate,
  normalizeOrganizationPriceDisplay,
  normalizeOrganizationTaxLabel,
  resolveOrganizationTaxSettings,
} from "../lib/organizationTax";

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

const sellerInvoiceFieldRequirementsValidator = v.object({
  sellerName: v.optional(v.boolean()),
  sellerEmail: v.optional(v.boolean()),
  sellerPhone: v.optional(v.boolean()),
  sellerTaxId: v.optional(v.boolean()),
  sellerAddressLine1: v.optional(v.boolean()),
  sellerAddressLine2: v.optional(v.boolean()),
  sellerPostalCode: v.optional(v.boolean()),
  sellerCity: v.optional(v.boolean()),
  sellerCountry: v.optional(v.boolean()),
  bankAccountHolder: v.optional(v.boolean()),
  bankName: v.optional(v.boolean()),
  bankAccountNumber: v.optional(v.boolean()),
  bankSwift: v.optional(v.boolean()),
  invoicePrefix: v.optional(v.boolean()),
  paymentInstructions: v.optional(v.boolean()),
  defaultPaymentTermDays: v.optional(v.boolean()),
});

const customerInvoiceFieldRequirementsValidator = v.object({
  nameOrCompany: v.optional(v.boolean()),
  name: v.optional(v.boolean()),
  companyName: v.optional(v.boolean()),
  email: v.optional(v.boolean()),
  phone: v.optional(v.boolean()),
  taxId: v.optional(v.boolean()),
  addressLine1: v.optional(v.boolean()),
  addressLine2: v.optional(v.boolean()),
  postalCode: v.optional(v.boolean()),
  city: v.optional(v.boolean()),
  country: v.optional(v.boolean()),
});

export const invoiceFieldRequirementsValidator = v.object({
  seller: v.optional(sellerInvoiceFieldRequirementsValidator),
  customer: v.optional(customerInvoiceFieldRequirementsValidator),
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

export const invoiceLineItemValidator = v.object({
  title: v.string(),
  description: v.optional(v.string()),
  quantity: v.number(),
  unitPrice: v.number(),
});

export const invoiceTaxSettingsSnapshotValidator = v.object({
  taxEnabled: v.optional(v.boolean()),
  taxRate: v.optional(v.number()),
  taxLabel: v.optional(v.string()),
  priceDisplay: v.optional(
    v.union(v.literal("net"), v.literal("gross"), v.literal("both")),
  ),
});

const DEFAULT_INVOICE_FIELD_REQUIREMENTS = {
  seller: {
    sellerName: true,
    sellerEmail: true,
    sellerPhone: true,
    sellerTaxId: true,
    sellerAddressLine1: true,
    sellerAddressLine2: true,
    sellerPostalCode: true,
    sellerCity: true,
    sellerCountry: false,
    bankAccountHolder: false,
    bankName: false,
    bankAccountNumber: true,
    bankSwift: false,
    invoicePrefix: false,
    paymentInstructions: false,
    defaultPaymentTermDays: false,
  },
  customer: {
    nameOrCompany: false,
    name: true,
    companyName: true,
    email: true,
    phone: true,
    taxId: true,
    addressLine1: true,
    addressLine2: true,
    postalCode: true,
    city: true,
    country: false,
  },
} as const;

const LEGACY_REQUIRED_DEFAULTS = {
  seller: {
    sellerName: true,
    sellerEmail: false,
    sellerPhone: false,
    sellerTaxId: false,
    sellerAddressLine1: true,
    sellerAddressLine2: false,
    sellerPostalCode: false,
    sellerCity: true,
    sellerCountry: true,
    bankAccountHolder: false,
    bankName: false,
    bankAccountNumber: true,
    bankSwift: false,
    invoicePrefix: false,
    paymentInstructions: false,
    defaultPaymentTermDays: false,
  },
  customer: {
    nameOrCompany: true,
    name: false,
    companyName: false,
    email: false,
    phone: false,
    taxId: false,
    addressLine1: true,
    addressLine2: false,
    postalCode: false,
    city: true,
    country: true,
  },
} as const;

export const normalizeOptionalString = (value?: string | null) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : undefined;
};

export const normalizeOptionalEmail = (value?: string | null) => {
  const normalized = normalizeOptionalString(value);
  return normalized ? normalized.toLowerCase() : undefined;
};

const roundCurrency = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

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

export const normalizeInvoiceLineItems = (
  value?:
    | Array<{
        title?: string | null;
        description?: string | null;
        quantity?: number | null;
        unitPrice?: number | null;
      }>
    | null,
) => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((item) => {
      const title = normalizeOptionalString(item?.title);
      const description = normalizeOptionalString(item?.description);
      const quantity =
        typeof item?.quantity === "number" && Number.isFinite(item.quantity)
          ? roundCurrency(item.quantity)
          : undefined;
      const unitPrice =
        typeof item?.unitPrice === "number" && Number.isFinite(item.unitPrice)
          ? roundCurrency(Math.max(item.unitPrice, 0))
          : undefined;

      if (!title || quantity === undefined || quantity <= 0 || unitPrice === undefined) {
        return null;
      }

      return {
        title,
        description,
        quantity,
        unitPrice,
      };
    })
    .filter(Boolean) as Array<{
    title: string;
    description?: string;
    quantity: number;
    unitPrice: number;
  }>;

  return normalized.length > 0 ? normalized : undefined;
};

export const normalizeInvoiceTaxSettingsSnapshot = (
  value?: {
    taxEnabled?: boolean | null;
    taxRate?: number | null;
    taxLabel?: string | null;
    priceDisplay?: string | null;
  } | null,
) => {
  if (!value) {
    return undefined;
  }

  const taxEnabled = value.taxEnabled === true;

  return {
    taxEnabled,
    taxRate: taxEnabled ? clampOrganizationTaxRate(value.taxRate) : 0,
    taxLabel: normalizeOrganizationTaxLabel(value.taxLabel),
    priceDisplay: normalizeOrganizationPriceDisplay(value.priceDisplay),
  };
};

export const getInvoiceLineItemsSubtotal = (
  lineItems?: Array<{
    quantity: number;
    unitPrice: number;
  }> | null,
) =>
  roundCurrency(
    (lineItems || []).reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
  );

export const resolveInvoiceLineItems = (
  value?:
    | {
        invoiceLineItems?: Array<{
          title?: string | null;
          description?: string | null;
          quantity?: number | null;
          unitPrice?: number | null;
        }> | null;
        title?: string | null;
        description?: string | null;
        amount?: number | null;
      }
    | null,
) => {
  const normalized = normalizeInvoiceLineItems(value?.invoiceLineItems);
  if (normalized && normalized.length > 0) {
    return normalized;
  }

  const title = normalizeOptionalString(value?.title);
  if (!title || typeof value?.amount !== "number" || !Number.isFinite(value.amount)) {
    return undefined;
  }

  return [
    {
      title,
      description: normalizeOptionalString(value?.description),
      quantity: 1,
      unitPrice: roundCurrency(Math.max(value.amount, 0)),
    },
  ];
};

export const resolveInvoiceTaxSettingsSnapshot = (
  value?: {
    taxEnabled?: boolean | null;
    taxRate?: number | null;
    taxLabel?: string | null;
    priceDisplay?: string | null;
  } | null,
  organizationTaxSettings?: Partial<ReturnType<typeof resolveOrganizationTaxSettings>> | null,
  hasLineItems = false,
) => {
  const normalized = normalizeInvoiceTaxSettingsSnapshot(value);
  if (normalized) {
    return normalized;
  }

  return hasLineItems ? resolveOrganizationTaxSettings(organizationTaxSettings) : undefined;
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

export const normalizeInvoiceFieldRequirements = (
  value?: {
    seller?: {
      sellerName?: boolean | null;
      sellerEmail?: boolean | null;
      sellerPhone?: boolean | null;
      sellerTaxId?: boolean | null;
      sellerAddressLine1?: boolean | null;
      sellerAddressLine2?: boolean | null;
      sellerPostalCode?: boolean | null;
      sellerCity?: boolean | null;
      sellerCountry?: boolean | null;
      bankAccountHolder?: boolean | null;
      bankName?: boolean | null;
      bankAccountNumber?: boolean | null;
      bankSwift?: boolean | null;
      invoicePrefix?: boolean | null;
      paymentInstructions?: boolean | null;
      defaultPaymentTermDays?: boolean | null;
    } | null;
    customer?: {
      nameOrCompany?: boolean | null;
      name?: boolean | null;
      companyName?: boolean | null;
      email?: boolean | null;
      phone?: boolean | null;
      taxId?: boolean | null;
      addressLine1?: boolean | null;
      addressLine2?: boolean | null;
      postalCode?: boolean | null;
      city?: boolean | null;
      country?: boolean | null;
    } | null;
  } | null,
) => {
  if (!value) {
    return undefined;
  }

  const normalizeBoolean = (input: boolean | null | undefined, fallback: boolean) =>
    typeof input === "boolean" ? input : fallback;

  return {
    seller: {
      sellerName: normalizeBoolean(value.seller?.sellerName, DEFAULT_INVOICE_FIELD_REQUIREMENTS.seller.sellerName),
      sellerEmail: normalizeBoolean(value.seller?.sellerEmail, DEFAULT_INVOICE_FIELD_REQUIREMENTS.seller.sellerEmail),
      sellerPhone: normalizeBoolean(value.seller?.sellerPhone, DEFAULT_INVOICE_FIELD_REQUIREMENTS.seller.sellerPhone),
      sellerTaxId: normalizeBoolean(value.seller?.sellerTaxId, DEFAULT_INVOICE_FIELD_REQUIREMENTS.seller.sellerTaxId),
      sellerAddressLine1: normalizeBoolean(
        value.seller?.sellerAddressLine1,
        DEFAULT_INVOICE_FIELD_REQUIREMENTS.seller.sellerAddressLine1,
      ),
      sellerAddressLine2: normalizeBoolean(
        value.seller?.sellerAddressLine2,
        DEFAULT_INVOICE_FIELD_REQUIREMENTS.seller.sellerAddressLine2,
      ),
      sellerPostalCode: normalizeBoolean(
        value.seller?.sellerPostalCode,
        DEFAULT_INVOICE_FIELD_REQUIREMENTS.seller.sellerPostalCode,
      ),
      sellerCity: normalizeBoolean(value.seller?.sellerCity, DEFAULT_INVOICE_FIELD_REQUIREMENTS.seller.sellerCity),
      sellerCountry: normalizeBoolean(
        value.seller?.sellerCountry,
        DEFAULT_INVOICE_FIELD_REQUIREMENTS.seller.sellerCountry,
      ),
      bankAccountHolder: normalizeBoolean(
        value.seller?.bankAccountHolder,
        DEFAULT_INVOICE_FIELD_REQUIREMENTS.seller.bankAccountHolder,
      ),
      bankName: normalizeBoolean(value.seller?.bankName, DEFAULT_INVOICE_FIELD_REQUIREMENTS.seller.bankName),
      bankAccountNumber: normalizeBoolean(
        value.seller?.bankAccountNumber,
        DEFAULT_INVOICE_FIELD_REQUIREMENTS.seller.bankAccountNumber,
      ),
      bankSwift: normalizeBoolean(value.seller?.bankSwift, DEFAULT_INVOICE_FIELD_REQUIREMENTS.seller.bankSwift),
      invoicePrefix: normalizeBoolean(value.seller?.invoicePrefix, DEFAULT_INVOICE_FIELD_REQUIREMENTS.seller.invoicePrefix),
      paymentInstructions: normalizeBoolean(
        value.seller?.paymentInstructions,
        DEFAULT_INVOICE_FIELD_REQUIREMENTS.seller.paymentInstructions,
      ),
      defaultPaymentTermDays: normalizeBoolean(
        value.seller?.defaultPaymentTermDays,
        DEFAULT_INVOICE_FIELD_REQUIREMENTS.seller.defaultPaymentTermDays,
      ),
    },
    customer: {
      nameOrCompany: normalizeBoolean(
        value.customer?.nameOrCompany,
        DEFAULT_INVOICE_FIELD_REQUIREMENTS.customer.nameOrCompany,
      ),
      name: normalizeBoolean(value.customer?.name, DEFAULT_INVOICE_FIELD_REQUIREMENTS.customer.name),
      companyName: normalizeBoolean(value.customer?.companyName, DEFAULT_INVOICE_FIELD_REQUIREMENTS.customer.companyName),
      email: normalizeBoolean(value.customer?.email, DEFAULT_INVOICE_FIELD_REQUIREMENTS.customer.email),
      phone: normalizeBoolean(value.customer?.phone, DEFAULT_INVOICE_FIELD_REQUIREMENTS.customer.phone),
      taxId: normalizeBoolean(value.customer?.taxId, DEFAULT_INVOICE_FIELD_REQUIREMENTS.customer.taxId),
      addressLine1: normalizeBoolean(value.customer?.addressLine1, DEFAULT_INVOICE_FIELD_REQUIREMENTS.customer.addressLine1),
      addressLine2: normalizeBoolean(value.customer?.addressLine2, DEFAULT_INVOICE_FIELD_REQUIREMENTS.customer.addressLine2),
      postalCode: normalizeBoolean(value.customer?.postalCode, DEFAULT_INVOICE_FIELD_REQUIREMENTS.customer.postalCode),
      city: normalizeBoolean(value.customer?.city, DEFAULT_INVOICE_FIELD_REQUIREMENTS.customer.city),
      country: normalizeBoolean(value.customer?.country, DEFAULT_INVOICE_FIELD_REQUIREMENTS.customer.country),
    },
  };
};

export const resolveInvoiceFieldRequirements = (
  value?: {
    seller?: {
      sellerName?: boolean | null;
      sellerEmail?: boolean | null;
      sellerPhone?: boolean | null;
      sellerTaxId?: boolean | null;
      sellerAddressLine1?: boolean | null;
      sellerAddressLine2?: boolean | null;
      sellerPostalCode?: boolean | null;
      sellerCity?: boolean | null;
      sellerCountry?: boolean | null;
      bankAccountHolder?: boolean | null;
      bankName?: boolean | null;
      bankAccountNumber?: boolean | null;
      bankSwift?: boolean | null;
      invoicePrefix?: boolean | null;
      paymentInstructions?: boolean | null;
      defaultPaymentTermDays?: boolean | null;
    } | null;
    customer?: {
      nameOrCompany?: boolean | null;
      name?: boolean | null;
      companyName?: boolean | null;
      email?: boolean | null;
      phone?: boolean | null;
      taxId?: boolean | null;
      addressLine1?: boolean | null;
      addressLine2?: boolean | null;
      postalCode?: boolean | null;
      city?: boolean | null;
      country?: boolean | null;
    } | null;
  } | null,
) => {
  const normalized = normalizeInvoiceFieldRequirements(value) ?? DEFAULT_INVOICE_FIELD_REQUIREMENTS;

  const looksLikeLegacyDefaults =
    JSON.stringify(normalized.seller) === JSON.stringify(LEGACY_REQUIRED_DEFAULTS.seller) &&
    JSON.stringify(normalized.customer) === JSON.stringify(LEGACY_REQUIRED_DEFAULTS.customer);

  return looksLikeLegacyDefaults ? DEFAULT_INVOICE_FIELD_REQUIREMENTS : normalized;
};

export const applyInvoiceFieldVisibilityToBillingProfile = (
  profile: ReturnType<typeof normalizeBillingProfile>,
  visibility: ReturnType<typeof resolveInvoiceFieldRequirements>,
) => {
  if (!profile) {
    return profile;
  }

  return {
    sellerName: visibility.seller.sellerName ? profile.sellerName : undefined,
    sellerEmail: visibility.seller.sellerEmail ? profile.sellerEmail : undefined,
    sellerPhone: visibility.seller.sellerPhone ? profile.sellerPhone : undefined,
    sellerTaxId: visibility.seller.sellerTaxId ? profile.sellerTaxId : undefined,
    sellerAddressLine1: visibility.seller.sellerAddressLine1 ? profile.sellerAddressLine1 : undefined,
    sellerAddressLine2: visibility.seller.sellerAddressLine2 ? profile.sellerAddressLine2 : undefined,
    sellerPostalCode: visibility.seller.sellerPostalCode ? profile.sellerPostalCode : undefined,
    sellerCity: visibility.seller.sellerCity ? profile.sellerCity : undefined,
    sellerCountry: visibility.seller.sellerCountry ? profile.sellerCountry : undefined,
    bankAccountHolder: visibility.seller.bankAccountHolder ? profile.bankAccountHolder : undefined,
    bankName: visibility.seller.bankName ? profile.bankName : undefined,
    bankAccountNumber: visibility.seller.bankAccountNumber ? profile.bankAccountNumber : undefined,
    bankSwift: visibility.seller.bankSwift ? profile.bankSwift : undefined,
    invoicePrefix: visibility.seller.invoicePrefix ? profile.invoicePrefix : undefined,
    paymentInstructions: visibility.seller.paymentInstructions ? profile.paymentInstructions : undefined,
    defaultPaymentTermDays: visibility.seller.defaultPaymentTermDays ? profile.defaultPaymentTermDays : undefined,
  };
};

export const applyInvoiceFieldVisibilityToCustomer = (
  customer: ReturnType<typeof normalizePaymentCustomerDetails>,
  visibility: ReturnType<typeof resolveInvoiceFieldRequirements>,
) => {
  if (!customer) {
    return customer;
  }

  return {
    name: visibility.customer.name ? customer.name : undefined,
    companyName: visibility.customer.companyName ? customer.companyName : undefined,
    email: visibility.customer.email ? customer.email : undefined,
    phone: visibility.customer.phone ? customer.phone : undefined,
    taxId: visibility.customer.taxId ? customer.taxId : undefined,
    addressLine1: visibility.customer.addressLine1 ? customer.addressLine1 : undefined,
    addressLine2: visibility.customer.addressLine2 ? customer.addressLine2 : undefined,
    postalCode: visibility.customer.postalCode ? customer.postalCode : undefined,
    city: visibility.customer.city ? customer.city : undefined,
    country: visibility.customer.country ? customer.country : undefined,
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
