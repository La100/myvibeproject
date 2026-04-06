export type ShoppingSetLike = {
  _id: string;
  setType: "variant" | "bundle" | "reference";
  selectionMode: "single" | "multiple" | "none";
  pricingMode: "selected_only" | "all_selected" | "none";
  status: "draft" | "active" | "resolved" | "archived";
  resolvedItemIds?: string[] | null;
  preferredItemIds?: string[] | null;
};

export type ShoppingSetItemLike = {
  _id: string;
  totalPrice?: number | null;
  setId?: string | null;
};

export type ShoppingSetContext<TItem extends ShoppingSetItemLike> = {
  countedItemIds: Set<string>;
  itemsBySetId: Map<string, TItem[]>;
};

const toKey = (value: string | null | undefined) => (value ? String(value) : null);

const uniqueIds = (ids: readonly string[]) => Array.from(new Set(ids));

export function buildShoppingSetContext<
  TItem extends ShoppingSetItemLike,
  TSet extends ShoppingSetLike,
>(items: TItem[], sets: TSet[]): ShoppingSetContext<TItem> {
  const itemsBySetId = new Map<string, TItem[]>();

  for (const item of items) {
    const setId = toKey(item.setId);
    if (!setId) {
      continue;
    }

    const current = itemsBySetId.get(setId) ?? [];
    current.push(item);
    itemsBySetId.set(setId, current);
  }

  const countedItemIds = new Set<string>();
  const setsById = new Map(sets.map((set) => [String(set._id), set]));

  for (const item of items) {
    const itemId = String(item._id);
    const setId = toKey(item.setId);
    if (!setId) {
      countedItemIds.add(itemId);
      continue;
    }

    const set = setsById.get(setId);
    if (!set) {
      countedItemIds.add(itemId);
    }
  }

  for (const [setId, setItems] of itemsBySetId.entries()) {
    const set = setsById.get(setId);
    if (!set || setItems.length === 0) {
      for (const item of setItems) {
        countedItemIds.add(String(item._id));
      }
      continue;
    }

    const memberIds = setItems.map((item) => String(item._id));
    const resolvedIds = uniqueIds(
      (set.resolvedItemIds ?? []).map((id) => String(id)).filter((id) => memberIds.includes(id)),
    );
    const preferredIds = uniqueIds(
      (set.preferredItemIds ?? []).map((id) => String(id)).filter((id) => memberIds.includes(id)),
    );

    if (set.pricingMode === "none") {
      continue;
    }

    if (set.selectionMode === "single" || set.setType === "variant") {
      const selectedId = resolvedIds[0] ?? preferredIds[0] ?? memberIds[0];
      if (selectedId) {
        countedItemIds.add(selectedId);
      }
      continue;
    }

    if (set.selectionMode === "multiple" || set.setType === "bundle") {
      const selectedIds =
        resolvedIds.length > 0
          ? resolvedIds
          : preferredIds.length > 0
            ? preferredIds
            : set.pricingMode === "all_selected"
              ? memberIds
              : [];

      for (const selectedId of selectedIds) {
        countedItemIds.add(selectedId);
      }
      continue;
    }

    if (set.pricingMode === "all_selected") {
      for (const memberId of memberIds) {
        countedItemIds.add(memberId);
      }
    }
  }

  return { countedItemIds, itemsBySetId };
}

export function isItemCountedInShoppingTotal<TItem extends ShoppingSetItemLike>(
  item: TItem,
  context: ShoppingSetContext<TItem>,
): boolean {
  return context.countedItemIds.has(String(item._id));
}

export function calculateShoppingTotal<
  TItem extends ShoppingSetItemLike,
  TSet extends ShoppingSetLike,
>(
  items: TItem[],
  sets: TSet[],
  includeItem: (item: TItem) => boolean = () => true,
): number {
  const filteredItems = items.filter(includeItem);
  const filteredSetIds = new Set(
    filteredItems.map((item) => toKey(item.setId)).filter((value): value is string => !!value),
  );
  const relevantSets = sets.filter((set) => filteredSetIds.has(String(set._id)));
  const context = buildShoppingSetContext(filteredItems, relevantSets);

  return filteredItems.reduce((sum, item) => {
    if (!isItemCountedInShoppingTotal(item, context)) {
      return sum;
    }
    return sum + (item.totalPrice || 0);
  }, 0);
}
