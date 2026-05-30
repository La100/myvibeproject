export type ShoppingMoodboardSourceItem = {
  _id: string;
  name: string;
  notes?: string;
  category?: string;
  supplier?: string;
  dimensions?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  imageUrl?: string;
  productLink?: string;
  sectionName?: string;
  setId?: string | null;
  setTitle?: string;
  setType?: "variant" | "bundle" | "reference";
  isPreferredInSet?: boolean;
  isResolvedInSet?: boolean;
};

export type ShoppingMoodboardSelectionOptions = {
  itemIds?: string[];
  query?: string;
  sectionName?: string;
  setName?: string;
  onlySetPreferredItems?: boolean;
  maxItems?: number;
};

export type ShoppingMoodboardReferenceImage = {
  name: string;
  imageUrl: string;
};

const normalize = (value: string | undefined | null) =>
  typeof value === "string" ? value.trim().toLocaleLowerCase() : "";

const includesNormalized = (haystack: string | undefined, needle: string | undefined) => {
  const normalizedNeedle = normalize(needle);
  if (!normalizedNeedle) return true;
  return normalize(haystack).includes(normalizedNeedle);
};

function matchesQuery(item: ShoppingMoodboardSourceItem, query?: string) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;

  const searchableFields = [
    item.name,
    item.notes,
    item.category,
    item.supplier,
    item.dimensions,
    item.sectionName,
    item.setTitle,
  ];

  return searchableFields.some((field) => normalize(field).includes(normalizedQuery));
}

function scoreItem(item: ShoppingMoodboardSourceItem, query?: string) {
  let score = 0;

  if (item.isPreferredInSet) score += 5;
  if (item.isResolvedInSet) score += 3;
  if (item.setTitle) score += 1;
  if (item.category) score += 1;
  if (item.supplier) score += 1;

  const normalizedQuery = normalize(query);
  if (normalizedQuery) {
    if (normalize(item.name).includes(normalizedQuery)) score += 4;
    if (normalize(item.category).includes(normalizedQuery)) score += 2;
    if (normalize(item.notes).includes(normalizedQuery)) score += 1;
    if (normalize(item.sectionName).includes(normalizedQuery)) score += 1;
    if (normalize(item.setTitle).includes(normalizedQuery)) score += 1;
  }

  return score;
}

export function selectShoppingItemsForMoodboard(
  items: ShoppingMoodboardSourceItem[],
  options: ShoppingMoodboardSelectionOptions = {},
) {
  const itemIds = new Set(
    (options.itemIds ?? [])
      .map((itemId) => itemId.trim())
      .filter((itemId) => itemId.length > 0),
  );

  const maxItems = Math.max(1, Math.min(options.maxItems ?? 6, 12));

  const filtered = items
    .filter((item) => typeof item.imageUrl === "string" && item.imageUrl.trim().length > 0)
    .filter((item) => (itemIds.size > 0 ? itemIds.has(item._id) : true))
    .filter((item) => matchesQuery(item, options.query))
    .filter((item) => includesNormalized(item.sectionName, options.sectionName))
    .filter((item) => includesNormalized(item.setTitle, options.setName))
    .filter((item) => (options.onlySetPreferredItems ? item.isPreferredInSet === true : true))
    .sort((left, right) => {
      const scoreDelta = scoreItem(right, options.query) - scoreItem(left, options.query);
      if (scoreDelta !== 0) return scoreDelta;
      return left.name.localeCompare(right.name);
    });

  return filtered.slice(0, maxItems);
}

function buildItemDescriptor(item: ShoppingMoodboardSourceItem) {
  const details = [
    item.category ? `category: ${item.category}` : null,
    item.sectionName ? `section: ${item.sectionName}` : null,
    item.setTitle ? `set: ${item.setTitle}` : null,
    item.supplier ? `supplier: ${item.supplier}` : null,
    item.dimensions ? `dimensions: ${item.dimensions}` : null,
    typeof item.quantity === "number"
      ? `qty: ${item.quantity}${item.unit ? ` ${item.unit}` : ""}`
      : null,
  ].filter((entry): entry is string => Boolean(entry));

  return details.length > 0
    ? `- ${item.name} (${details.join(", ")})`
    : `- ${item.name}`;
}

export function buildMoodboardPromptFromShoppingItems(
  basePrompt: string,
  items: ShoppingMoodboardSourceItem[],
  context?: {
    sectionName?: string;
    setName?: string;
    query?: string;
  },
) {
  const prompt = basePrompt.trim();
  const contextLines = [
    context?.sectionName ? `Focus shopping section: ${context.sectionName}.` : null,
    context?.setName ? `Focus shopping set: ${context.setName}.` : null,
    context?.query ? `Focus query/theme: ${context.query}.` : null,
  ].filter((entry): entry is string => Boolean(entry));

  const itemLines = items.map(buildItemDescriptor);

  return [
    prompt,
    "Use the attached shopping item images as the primary visual references.",
    "Create a cohesive moodboard inspired by these real project items, preserving their materials, tones, finishes, and silhouettes without turning the result into a plain product collage.",
    ...contextLines,
    "Reference shopping items:",
    ...itemLines,
  ]
    .filter((entry) => entry.trim().length > 0)
    .join("\n\n");
}

export function toShoppingReferenceImages(
  items: ShoppingMoodboardSourceItem[],
  maxImages: number = 6,
): ShoppingMoodboardReferenceImage[] {
  const limitedItems = items.slice(0, Math.max(1, Math.min(maxImages, 12)));

  return limitedItems
    .map((item) => ({
      name: item.name,
      imageUrl: item.imageUrl?.trim() || "",
    }))
    .filter((item) => item.imageUrl.length > 0);
}
