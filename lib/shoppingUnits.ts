import type { Locale } from "@/lib/i18nConfig";

export type ShoppingMeasurementSystem = "metric" | "imperial";
export type ShoppingUnitOption = {
  value: string;
  label: string;
};

export const DEFAULT_SHOPPING_UNIT = "pcs";

const IMPERIAL_LOCATION_PATTERNS = [
  /\b(us|usa|u\.s\.a\.|united states|stany zjednoczone)\b/i,
  /\b(liberia|myanmar)\b/i,
];

const METRIC_SHOPPING_UNITS: Record<Locale, readonly ShoppingUnitOption[]> = {
  en: [
    { value: "pcs", label: "pcs" },
    { value: "m²", label: "m²" },
    { value: "m", label: "m" },
    { value: "m³", label: "m³" },
    { value: "kg", label: "kg" },
    { value: "l", label: "l" },
    { value: "set", label: "set" },
    { value: "box", label: "box" },
    { value: "pack", label: "pack" },
    { value: "roll", label: "roll" },
  ],
  pl: [
    { value: "pcs", label: "szt." },
    { value: "m²", label: "m²" },
    { value: "m", label: "m / mb" },
    { value: "m³", label: "m³" },
    { value: "kg", label: "kg" },
    { value: "l", label: "l" },
    { value: "set", label: "komplet" },
    { value: "box", label: "karton" },
    { value: "pack", label: "paczka" },
    { value: "roll", label: "rolka" },
  ],
};

const IMPERIAL_SHOPPING_UNITS: Record<Locale, readonly ShoppingUnitOption[]> = {
  en: [
    { value: "pcs", label: "pcs" },
    { value: "sq ft", label: "sq ft" },
    { value: "ft", label: "ft" },
    { value: "cu ft", label: "cu ft" },
    { value: "lb", label: "lb" },
    { value: "gal", label: "gal" },
    { value: "set", label: "set" },
    { value: "box", label: "box" },
    { value: "pack", label: "pack" },
    { value: "roll", label: "roll" },
  ],
  pl: [
    { value: "pcs", label: "szt." },
    { value: "sq ft", label: "ft²" },
    { value: "ft", label: "ft" },
    { value: "cu ft", label: "ft³" },
    { value: "lb", label: "lb" },
    { value: "gal", label: "gal" },
    { value: "set", label: "komplet" },
    { value: "box", label: "karton" },
    { value: "pack", label: "paczka" },
    { value: "roll", label: "rolka" },
  ],
};

export const SHOPPING_UNITS = METRIC_SHOPPING_UNITS.en;

export function resolveShoppingMeasurementSystem(
  measurementSystem?: string | null,
  location?: string | null,
): ShoppingMeasurementSystem {
  if (measurementSystem === "imperial") return "imperial";
  if (measurementSystem === "metric") return "metric";

  const normalizedLocation = location?.trim();
  if (normalizedLocation && IMPERIAL_LOCATION_PATTERNS.some((pattern) => pattern.test(normalizedLocation))) {
    return "imperial";
  }

  return "metric";
}

export function getShoppingUnitsForMeasurementSystem(
  measurementSystem: ShoppingMeasurementSystem,
  locale: Locale,
) {
  return measurementSystem === "imperial"
    ? IMPERIAL_SHOPPING_UNITS[locale]
    : METRIC_SHOPPING_UNITS[locale];
}

export function getDefaultShoppingUnit() {
  return DEFAULT_SHOPPING_UNIT;
}

export function ensureShoppingUnitOption(
  units: readonly ShoppingUnitOption[],
  unit?: string | null,
): ShoppingUnitOption[] {
  const normalized = normalizeShoppingUnit(unit);
  if (units.some((entry) => entry.value === normalized)) {
    return [...units];
  }

  return [{ value: normalized, label: normalized }, ...units];
}

export function normalizeShoppingUnit(unit?: string | null) {
  const normalized = unit?.trim();
  return normalized || DEFAULT_SHOPPING_UNIT;
}

export function formatShoppingQuantity(quantity: number, unit?: string | null) {
  const normalizedUnit = normalizeShoppingUnit(unit);
  return `${quantity} ${normalizedUnit}`;
}
