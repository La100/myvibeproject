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

export type TeamTaxRate = {
  id: string;
  name: string;
  rate: number;
  isDefault: boolean;
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
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

function isTeamTaxRate(value: unknown): value is Partial<TeamTaxRate> {
  return typeof value === "object" && value !== null;
}

export function normalizeTeamTaxRates(
  value?: unknown[] | null,
  legacySettings?: Partial<OrganizationTaxSettings> | null,
): TeamTaxRate[] {
  const normalized = (Array.isArray(value) ? value : [])
    .filter(isTeamTaxRate)
    .map((entry, index) => ({
      id:
        typeof entry.id === "string" && entry.id.trim()
          ? entry.id.trim()
          : `tax-rate-${index + 1}`,
      name: normalizeOrganizationTaxLabel(entry.name),
      rate: clampOrganizationTaxRate(entry.rate),
      isDefault: entry.isDefault === true,
      isArchived: entry.isArchived === true,
      createdAt:
        typeof entry.createdAt === "number" && Number.isFinite(entry.createdAt)
          ? entry.createdAt
          : 0,
      updatedAt:
        typeof entry.updatedAt === "number" && Number.isFinite(entry.updatedAt)
          ? entry.updatedAt
          : 0,
    }));

  if (normalized.length === 0) {
    const legacy = resolveOrganizationTaxSettings(legacySettings);
    if (legacy.taxEnabled && legacy.taxRate > 0) {
      return [
        {
          id: "legacy-default",
          name: legacy.taxLabel,
          rate: legacy.taxRate,
          isDefault: true,
          isArchived: false,
          createdAt: 0,
          updatedAt: 0,
        },
      ];
    }
    return [];
  }

  const activeRates = normalized.filter((entry) => !entry.isArchived);
  if (activeRates.length === 0) {
    return normalized.map((entry) => ({ ...entry, isDefault: false }));
  }

  let defaultAssigned = false;
  return normalized.map((entry) => {
    if (entry.isArchived) {
      return { ...entry, isDefault: false };
    }
    if (!defaultAssigned && (entry.isDefault || activeRates[0]?.id === entry.id)) {
      defaultAssigned = true;
      return { ...entry, isDefault: true };
    }
    return { ...entry, isDefault: false };
  });
}

export function getDefaultTeamTaxRate(
  taxRates?: unknown[] | null,
  legacySettings?: Partial<OrganizationTaxSettings> | null,
): TeamTaxRate | null {
  const normalized = normalizeTeamTaxRates(taxRates, legacySettings);
  return normalized.find((entry) => entry.isDefault && !entry.isArchived) ?? null;
}

export function resolveOrganizationTaxSettingsFromRates(
  taxRates?: unknown[] | null,
  existingSettings?: Partial<OrganizationTaxSettings> | null,
): OrganizationTaxSettings {
  const fallback = resolveOrganizationTaxSettings(existingSettings);
  const defaultRate = getDefaultTeamTaxRate(taxRates, existingSettings);

  if (!defaultRate) {
    return {
      ...fallback,
      taxEnabled: false,
      taxRate: 0,
      taxLabel: DEFAULT_ORGANIZATION_TAX_SETTINGS.taxLabel,
    };
  }

  return {
    taxEnabled: true,
    taxRate: defaultRate.rate,
    taxLabel: defaultRate.name,
    priceDisplay: fallback.priceDisplay,
  };
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
