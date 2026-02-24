function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function areValuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => areValuesEqual(item, b[index]));
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);

    if (aKeys.length !== bKeys.length) return false;

    for (const key of aKeys) {
      if (!(key in b)) return false;
      if (!areValuesEqual(a[key], b[key])) return false;
    }

    return true;
  }

  return false;
}

function hasShoppingCoreFields(value: Record<string, unknown>): boolean {
  if (typeof value.name === "string" && value.name.trim().length > 0) return true;
  return (
    value.quantity !== undefined ||
    value.sectionId !== undefined ||
    value.sectionName !== undefined ||
    value.category !== undefined
  );
}

function hasLaborCoreFields(value: Record<string, unknown>): boolean {
  if (typeof value.name === "string" && value.name.trim().length > 0) return true;
  return (
    value.quantity !== undefined ||
    value.sectionId !== undefined ||
    value.sectionName !== undefined ||
    value.unit !== undefined
  );
}

export function getFirstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return undefined;
}

export function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

export function extractShoppingInput(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) return {};

  const nestedCandidates = [
    value.itemData,
    value.data,
    value.shoppingData,
    value.item,
  ].filter(isPlainObject);

  const bestNested =
    nestedCandidates.find((candidate) => typeof candidate.name === "string" && candidate.name.trim().length > 0) ??
    nestedCandidates.find(hasShoppingCoreFields);

  const base = hasShoppingCoreFields(value) ? value : (bestNested ?? value);
  const extracted: Record<string, unknown> = { ...base };

  for (const passthroughKey of ["sectionName", "sectionId", "category"] as const) {
    if (value[passthroughKey] !== undefined && extracted[passthroughKey] === undefined) {
      extracted[passthroughKey] = value[passthroughKey];
    }
  }

  if (typeof extracted.name !== "string" || extracted.name.trim().length === 0) {
    const fallbackName = getFirstNonEmptyString(
      extracted.title,
      extracted.itemName,
      extracted.productName,
      extracted.product,
      extracted.label,
      extracted.item,
    );
    if (fallbackName) {
      extracted.name = fallbackName;
    }
  }

  if (typeof extracted.notes !== "string" || extracted.notes.trim().length === 0) {
    const fallbackNotes = getFirstNonEmptyString(
      extracted.description,
      extracted.content,
      extracted.details,
    );
    if (fallbackNotes) {
      extracted.notes = fallbackNotes;
    }
  }

  if (extracted.quantity === undefined) {
    const fallbackQuantity = toFiniteNumber(
      extracted.qty ?? extracted.amount ?? extracted.count ?? extracted.units,
    );
    if (fallbackQuantity !== undefined) {
      extracted.quantity = fallbackQuantity;
    }
  }

  return extracted;
}

export function extractLaborInput(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) return {};

  const nestedCandidates = [
    value.itemData,
    value.data,
    value.laborData,
    value.item,
  ].filter(isPlainObject);

  const bestNested =
    nestedCandidates.find((candidate) => typeof candidate.name === "string" && candidate.name.trim().length > 0) ??
    nestedCandidates.find(hasLaborCoreFields);

  const base = hasLaborCoreFields(value) ? value : (bestNested ?? value);
  const extracted: Record<string, unknown> = { ...base };

  for (const passthroughKey of ["sectionName", "sectionId", "assignedTo"] as const) {
    if (value[passthroughKey] !== undefined && extracted[passthroughKey] === undefined) {
      extracted[passthroughKey] = value[passthroughKey];
    }
  }

  if (typeof extracted.name !== "string" || extracted.name.trim().length === 0) {
    const fallbackName = getFirstNonEmptyString(
      extracted.title,
      extracted.itemName,
      extracted.workName,
      extracted.work,
      extracted.label,
      extracted.item,
    );
    if (fallbackName) {
      extracted.name = fallbackName;
    }
  }

  if (typeof extracted.notes !== "string" || extracted.notes.trim().length === 0) {
    const fallbackNotes = getFirstNonEmptyString(
      extracted.description,
      extracted.content,
      extracted.details,
    );
    if (fallbackNotes) {
      extracted.notes = fallbackNotes;
    }
  }

  if (extracted.quantity === undefined) {
    const fallbackQuantity = toFiniteNumber(
      extracted.qty ?? extracted.amount ?? extracted.count ?? extracted.hours ?? extracted.units,
    );
    if (fallbackQuantity !== undefined) {
      extracted.quantity = fallbackQuantity;
    }
  }

  const fallbackUnit = getFirstNonEmptyString(extracted.uom, extracted.measurementUnit);
  if (fallbackUnit && extracted.unit === undefined) {
    extracted.unit = fallbackUnit;
  }

  if (extracted.unitPrice === undefined) {
    const fallbackUnitPrice = toFiniteNumber(extracted.rate ?? extracted.price);
    if (fallbackUnitPrice !== undefined) {
      extracted.unitPrice = fallbackUnitPrice;
    }
  }

  const fallbackSectionName = getFirstNonEmptyString(extracted.section, extracted.category);
  if (fallbackSectionName && extracted.sectionName === undefined) {
    extracted.sectionName = fallbackSectionName;
  }

  if (extracted.assignedTo === undefined) {
    const fallbackAssignedTo = getFirstNonEmptyString(extracted.assignee, extracted.worker);
    if (fallbackAssignedTo) {
      extracted.assignedTo = fallbackAssignedTo;
    }
  }

  return extracted;
}

const PROJECT_STATUSES = new Set([
  "planning",
  "active",
  "on_hold",
  "completed",
  "cancelled",
]);

const PROJECT_CURRENCIES = new Set([
  "USD", "EUR", "PLN", "GBP", "CAD", "AUD", "JPY", "CHF", "SEK", "NOK",
  "DKK", "CZK", "HUF", "CNY", "INR", "BRL", "MXN", "KRW", "SGD", "HKD",
]);

export function sanitizeProjectSettingsUpdates(source: Record<string, unknown>): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(source, "name")) {
    const name = getFirstNonEmptyString(source.name);
    if (name) updates.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(source, "description")) {
    if (typeof source.description === "string") {
      const description = source.description.trim();
      updates.description = description.length > 0 ? description : undefined;
    }
  }

  if (Object.prototype.hasOwnProperty.call(source, "coverImageUrl")) {
    if (typeof source.coverImageUrl === "string") {
      updates.coverImageUrl = source.coverImageUrl.trim();
    }
  }

  if (Object.prototype.hasOwnProperty.call(source, "status")) {
    const status = typeof source.status === "string" ? source.status : undefined;
    if (status && PROJECT_STATUSES.has(status)) {
      updates.status = status;
    }
  }

  if (Object.prototype.hasOwnProperty.call(source, "customer")) {
    if (typeof source.customer === "string") {
      const customer = source.customer.trim();
      updates.customer = customer.length > 0 ? customer : undefined;
    }
  }

  if (Object.prototype.hasOwnProperty.call(source, "location")) {
    if (typeof source.location === "string") {
      const location = source.location.trim();
      updates.location = location.length > 0 ? location : undefined;
    }
  }

  if (Object.prototype.hasOwnProperty.call(source, "budget")) {
    const budget = toFiniteNumber(source.budget);
    if (budget !== undefined && budget > 0) {
      updates.budget = budget;
    }
  }

  if (Object.prototype.hasOwnProperty.call(source, "currency")) {
    const currency = typeof source.currency === "string" ? source.currency : undefined;
    if (currency && PROJECT_CURRENCIES.has(currency)) {
      updates.currency = currency;
    }
  }

  return updates;
}
