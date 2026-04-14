export type ShoppingRealizationStatus =
  | "PLANNED"
  | "ORDERED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED";

const SHOPPING_REALIZATION_STATUS_MAP: Record<string, ShoppingRealizationStatus> = {
  PLANNED: "PLANNED",
  ORDERED: "ORDERED",
  IN_TRANSIT: "IN_TRANSIT",
  DELIVERED: "DELIVERED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

export function normalizeShoppingRealizationStatus(
  value: unknown,
): ShoppingRealizationStatus | undefined {
  if (typeof value !== "string") return undefined;

  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  return SHOPPING_REALIZATION_STATUS_MAP[normalized];
}

export function extractShoppingRealizationStatus(
  value: { realizationStatus?: unknown; status?: unknown } | null | undefined,
): ShoppingRealizationStatus | undefined {
  if (!value) return undefined;
  return normalizeShoppingRealizationStatus(value.realizationStatus ?? value.status);
}
