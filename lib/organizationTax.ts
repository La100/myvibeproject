export const ORGANIZATION_PRICE_DISPLAY_OPTIONS = [
  "net",
  "gross",
  "both",
] as const;

export type OrganizationPriceDisplay =
  (typeof ORGANIZATION_PRICE_DISPLAY_OPTIONS)[number];

export type OrganizationTaxSettings = {
  taxEnabled: boolean;
  taxRate: number;
  taxLabel: string;
  priceDisplay: OrganizationPriceDisplay;
};

export type TaxBreakdown = {
  net: number;
  tax: number;
  gross: number;
};

export type TaxAmountKind = keyof TaxBreakdown;

export const DEFAULT_ORGANIZATION_TAX_SETTINGS: OrganizationTaxSettings = {
  taxEnabled: false,
  taxRate: 0,
  taxLabel: "Tax",
  priceDisplay: "net",
};

const roundCurrency = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function clampOrganizationTaxRate(value?: number | null): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 100);
}

export function normalizeOrganizationTaxLabel(value?: string | null): string {
  const normalized = value?.trim();
  return normalized || DEFAULT_ORGANIZATION_TAX_SETTINGS.taxLabel;
}

export function normalizeOrganizationPriceDisplay(
  value?: string | null,
): OrganizationPriceDisplay {
  return ORGANIZATION_PRICE_DISPLAY_OPTIONS.includes(
    value as OrganizationPriceDisplay,
  )
    ? (value as OrganizationPriceDisplay)
    : DEFAULT_ORGANIZATION_TAX_SETTINGS.priceDisplay;
}

export function resolveOrganizationTaxSettings(
  value?: Partial<OrganizationTaxSettings> | null,
): OrganizationTaxSettings {
  const taxEnabled = value?.taxEnabled === true;

  return {
    taxEnabled,
    taxRate: taxEnabled ? clampOrganizationTaxRate(value?.taxRate) : 0,
    taxLabel: normalizeOrganizationTaxLabel(value?.taxLabel),
    priceDisplay: normalizeOrganizationPriceDisplay(value?.priceDisplay),
  };
}

export function calculateTaxBreakdown(
  netAmount?: number | null,
  settings?: Partial<OrganizationTaxSettings> | null,
): TaxBreakdown {
  const resolvedSettings = resolveOrganizationTaxSettings(settings);
  const normalizedNet =
    typeof netAmount === "number" && Number.isFinite(netAmount)
      ? roundCurrency(Math.max(netAmount, 0))
      : 0;
  const tax = resolvedSettings.taxEnabled
    ? roundCurrency(normalizedNet * (resolvedSettings.taxRate / 100))
    : 0;

  return {
    net: normalizedNet,
    tax,
    gross: roundCurrency(normalizedNet + tax),
  };
}

export function getTaxAmountKindsForDisplay(
  settings?: Partial<OrganizationTaxSettings> | null,
): TaxAmountKind[] {
  const { priceDisplay } = resolveOrganizationTaxSettings(settings);

  if (priceDisplay === "both") {
    return ["net", "tax", "gross"];
  }

  if (priceDisplay === "gross") {
    return ["gross"];
  }

  return ["net"];
}

export function getTaxAmountKindLabel(
  kind: TaxAmountKind,
  settings?: Partial<OrganizationTaxSettings> | null,
): string {
  const { taxLabel } = resolveOrganizationTaxSettings(settings);

  if (kind === "tax") {
    return taxLabel;
  }

  return kind === "gross" ? "Gross" : "Net";
}

export function getPrimaryAmountKindForDisplay(
  settings?: Partial<OrganizationTaxSettings> | null,
): TaxAmountKind {
  const { priceDisplay } = resolveOrganizationTaxSettings(settings);

  return priceDisplay === "net" ? "net" : "gross";
}
