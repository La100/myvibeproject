export type ShoppingAlternativeItem = {
  _id: string;
  totalPrice?: number | null;
  alternativeToItemId?: string | null;
  selectedAlternativeItemId?: string | null;
};

export type ShoppingAlternativeGroup<T extends ShoppingAlternativeItem> = {
  baseItem: T;
  options: T[];
  selectedItemId: string;
};

type AlternativeSelection = {
  groupedIds: Set<string>;
  selectedIds: Set<string>;
};

const toKey = (value: string | null | undefined) => (value ? String(value) : null);

export function buildAlternativeGroups<T extends ShoppingAlternativeItem>(
  items: T[],
): ShoppingAlternativeGroup<T>[] {
  const byId = new Map(items.map((item) => [String(item._id), item]));
  const childrenByParentId = new Map<string, T[]>();

  for (const item of items) {
    const parentId = toKey(item.alternativeToItemId);
    if (!parentId || !byId.has(parentId)) {
      continue;
    }
    const current = childrenByParentId.get(parentId) ?? [];
    current.push(item);
    childrenByParentId.set(parentId, current);
  }

  const groups: ShoppingAlternativeGroup<T>[] = [];
  const groupedIds = new Set<string>();

  for (const item of items) {
    const itemId = String(item._id);
    const parentId = toKey(item.alternativeToItemId);
    const hasExistingParent = !!(parentId && byId.has(parentId));

    if (hasExistingParent) {
      continue;
    }

    const options = [item, ...(childrenByParentId.get(itemId) ?? [])];
    const memberIds = options.map((option) => String(option._id));
    const selectedOptionId = toKey(item.selectedAlternativeItemId);
    const selectedId =
      selectedOptionId && memberIds.includes(selectedOptionId) ? selectedOptionId : itemId;

    for (const memberId of memberIds) {
      groupedIds.add(memberId);
    }

    groups.push({
      baseItem: item,
      options,
      selectedItemId: selectedId,
    });
  }

  for (const item of items) {
    const itemId = String(item._id);
    if (!groupedIds.has(itemId)) {
      groups.push({
        baseItem: item,
        options: [item],
        selectedItemId: itemId,
      });
    }
  }

  return groups;
}

export function buildAlternativeSelection<T extends ShoppingAlternativeItem>(
  items: T[],
): AlternativeSelection {
  const groupedIds = new Set<string>();
  const selectedIds = new Set<string>();

  for (const group of buildAlternativeGroups(items)) {
    for (const option of group.options) {
      groupedIds.add(String(option._id));
    }
    selectedIds.add(group.selectedItemId);
  }

  return { groupedIds, selectedIds };
}

export function isItemCountedInShoppingTotal<T extends ShoppingAlternativeItem>(
  item: T,
  selection: AlternativeSelection,
): boolean {
  const itemId = String(item._id);
  if (!selection.groupedIds.has(itemId)) {
    return true;
  }
  return selection.selectedIds.has(itemId);
}

export function calculateShoppingTotal<T extends ShoppingAlternativeItem>(
  items: T[],
  includeItem: (item: T) => boolean = () => true,
): number {
  const filteredItems = items.filter(includeItem);
  const selection = buildAlternativeSelection(filteredItems);

  return filteredItems.reduce((sum, item) => {
    if (!isItemCountedInShoppingTotal(item, selection)) {
      return sum;
    }
    return sum + (item.totalPrice || 0);
  }, 0);
}
