import {
  getDefaultTeamTaxRate,
  normalizeTeamTaxRates,
  type TeamTaxRate,
} from "./organizationTax";

const PRICE_TAX_MODES = ["unspecified", "net", "gross", "exempt"] as const;

export { PRICE_TAX_MODES };

export type PriceTaxMode = (typeof PRICE_TAX_MODES)[number];

export type PriceTaxRateSnapshot = {
  id?: string;
  name: string;
  rate: number;
};

export type PriceTaxMetadata = {
  priceTaxMode?: PriceTaxMode | null;
  taxRateId?: string | null;
  taxRateSnapshot?: PriceTaxRateSnapshot | null;
};

export type PriceTaxBreakdown =
  | {
      mode: "unspecified";
      amount: number;
      hasBreakdown: false;
    }
  | {
      mode: "net" | "gross" | "exempt";
      amount: number;
      net: number;
      tax: number;
      gross: number;
      taxLabel: string;
      taxRate: number;
      hasBreakdown: true;
    };

const roundCurrency = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const normalizeAmount = (value?: number | null) =>
  typeof value === "number" && Number.isFinite(value)
    ? roundCurrency(Math.max(value, 0))
    : 0;

export function normalizePriceTaxMode(value?: string | null): PriceTaxMode {
  return PRICE_TAX_MODES.includes(value as PriceTaxMode)
    ? (value as PriceTaxMode)
    : "unspecified";
}

export function getActivePriceTaxRates(
  taxRates?: unknown[] | null,
  legacySettings?: Parameters<typeof getDefaultTeamTaxRate>[1],
): TeamTaxRate[] {
  return normalizeTeamTaxRates(taxRates, legacySettings).filter(
    (entry) => !entry.isArchived,
  );
}

export function getDefaultPriceTaxRateId(
  taxRates?: unknown[] | null,
  legacySettings?: Parameters<typeof getDefaultTeamTaxRate>[1],
): string | undefined {
  return getDefaultTeamTaxRate(taxRates, legacySettings)?.id;
}

export function resolvePriceTaxSnapshot(
  mode: PriceTaxMode,
  taxRateId?: string | null,
  taxRates?: TeamTaxRate[],
): PriceTaxRateSnapshot | undefined {
  if (mode === "unspecified") {
    return undefined;
  }

  if (mode === "exempt") {
    return { id: taxRateId || undefined, name: "Tax exempt", rate: 0 };
  }

  const taxRate = taxRates?.find((entry) => entry.id === taxRateId);
  if (!taxRate) {
    return undefined;
  }

  return {
    id: taxRate.id,
    name: taxRate.name,
    rate: taxRate.rate,
  };
}

export function calculatePriceTaxBreakdown(
  amount?: number | null,
  metadata?: PriceTaxMetadata | null,
): PriceTaxBreakdown {
  const normalizedAmount = normalizeAmount(amount);
  const mode = normalizePriceTaxMode(metadata?.priceTaxMode);

  if (mode === "unspecified") {
    return {
      mode,
      amount: normalizedAmount,
      hasBreakdown: false,
    };
  }

  const snapshot = metadata?.taxRateSnapshot;
  const taxRate = mode === "exempt" ? 0 : normalizeAmount(snapshot?.rate);
  const taxLabel = snapshot?.name || (mode === "exempt" ? "Tax exempt" : "Tax");

  if (mode === "gross" && taxRate > 0) {
    const net = roundCurrency(normalizedAmount / (1 + taxRate / 100));
    const tax = roundCurrency(normalizedAmount - net);
    return {
      mode,
      amount: normalizedAmount,
      net,
      tax,
      gross: normalizedAmount,
      taxLabel,
      taxRate,
      hasBreakdown: true,
    };
  }

  const tax = roundCurrency(normalizedAmount * (taxRate / 100));
  return {
    mode,
    amount: normalizedAmount,
    net: normalizedAmount,
    tax,
    gross: roundCurrency(normalizedAmount + tax),
    taxLabel,
    taxRate,
    hasBreakdown: true,
  };
}

export function formatPriceTaxBreakdown(
  amount: number | undefined,
  metadata: PriceTaxMetadata | null | undefined,
  currencySymbol: string,
): string | null {
  if (amount === undefined) {
    return null;
  }

  const breakdown = calculatePriceTaxBreakdown(amount, metadata);
  if (!breakdown.hasBreakdown) {
    return null;
  }

  if (breakdown.mode === "exempt") {
    return `Tax exempt: ${breakdown.gross.toFixed(2)} ${currencySymbol}`;
  }

  return `Net ${breakdown.net.toFixed(2)} ${currencySymbol} | ${breakdown.taxLabel} ${breakdown.taxRate}% ${breakdown.tax.toFixed(2)} ${currencySymbol} | Gross ${breakdown.gross.toFixed(2)} ${currencySymbol}`;
}
