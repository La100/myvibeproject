export const DEFAULT_SHOPPING_UNIT = "pcs";

export const SHOPPING_UNITS = [
  { value: "pcs", label: "pcs / szt." },
  { value: "m²", label: "m²" },
  { value: "m", label: "m / mb" },
  { value: "m³", label: "m³" },
  { value: "kg", label: "kg" },
  { value: "l", label: "l" },
  { value: "set", label: "set / komplet" },
  { value: "box", label: "box / karton" },
  { value: "pack", label: "pack / paczka" },
  { value: "roll", label: "roll / rolka" },
] as const;

export function normalizeShoppingUnit(unit?: string | null) {
  const normalized = unit?.trim();
  return normalized || DEFAULT_SHOPPING_UNIT;
}

export function formatShoppingQuantity(quantity: number, unit?: string | null) {
  const normalizedUnit = normalizeShoppingUnit(unit);
  return `${quantity} ${normalizedUnit}`;
}
