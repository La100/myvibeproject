import type { PendingContentItem } from "../../data/types";
import {
  extractBulkCreateEntries,
  getApprovalState,
  getCanonicalType,
  shouldHideSectionCard,
  shouldRenderByState,
} from "./helpers.ts";

export type InlineConfirmationDisplayItem = {
  item: PendingContentItem;
  index: number;
  key: string;
  fromBulk: boolean;
  hidden: boolean;
};

export type InlineConfirmationResolvedSummary = {
  confirmedCount: number;
  rejectedCount: number;
  typeSummaries: Array<[string, { confirmed: number; rejected: number }]>;
};

export type InlineConfirmationViewModel = {
  visibleItems: InlineConfirmationDisplayItem[];
  unresolvedItems: InlineConfirmationDisplayItem[];
  hiddenSectionLabels: string[];
  resolvedSummary: InlineConfirmationResolvedSummary | null;
};

const getSectionNameFromRecord = (value: unknown): string | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const candidates = [
    record.sectionName,
    record.name,
    record.title,
    record.section,
    (record.sectionData as Record<string, unknown> | undefined)?.sectionName,
    (record.sectionData as Record<string, unknown> | undefined)?.name,
    (record.data as Record<string, unknown> | undefined)?.sectionName,
    (record.data as Record<string, unknown> | undefined)?.name,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return undefined;
};

const inferSharedSectionName = (
  items: PendingContentItem[],
  type: "shopping" | "labor",
) => {
  const sectionType = type === "shopping" ? "shoppingSection" : "laborSection";
  const matchingSections = items.filter((entry) => entry.type === sectionType);
  if (matchingSections.length !== 1) return undefined;

  const sectionData = (matchingSections[0]?.data ?? {}) as Record<string, unknown>;
  const candidates = [
    sectionData.name,
    sectionData.sectionName,
    sectionData.title,
    (sectionData.sectionData as Record<string, unknown> | undefined)?.name,
    (sectionData.sectionData as Record<string, unknown> | undefined)?.sectionName,
    (sectionData.data as Record<string, unknown> | undefined)?.name,
    (sectionData.data as Record<string, unknown> | undefined)?.sectionName,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return undefined;
};

const getResolvedSummary = (
  visibleItems: InlineConfirmationDisplayItem[],
): InlineConfirmationResolvedSummary => {
  const confirmedCount = visibleItems.filter(({ item }) => {
    const approvalState = getApprovalState(item);
    return item.status === "confirmed" || approvalState === "output-available";
  }).length;
  const rejectedCount = visibleItems.length - confirmedCount;
  const groupedByType = visibleItems.reduce((acc, { item }) => {
    const key = getCanonicalType(item.type);
    if (!acc[key]) {
      acc[key] = { confirmed: 0, rejected: 0 };
    }
    const approvalState = getApprovalState(item);
    const isConfirmed =
      item.status === "confirmed" || approvalState === "output-available";
    if (isConfirmed) {
      acc[key].confirmed += 1;
    } else {
      acc[key].rejected += 1;
    }
    return acc;
  }, {} as Record<string, { confirmed: number; rejected: number }>);

  return {
    confirmedCount,
    rejectedCount,
    typeSummaries: Object.entries(groupedByType),
  };
};

export const prepareInlineConfirmationViewModel = (
  items: PendingContentItem[],
): InlineConfirmationViewModel => {
  const activeItems = items.filter((item) => item.status !== "superseded");
  const referencedSectionNames = {
    shopping: new Set<string>(),
    labor: new Set<string>(),
  };

  for (const item of activeItems) {
    const canonicalType = getCanonicalType(item.type);
    if (canonicalType !== "shopping" && canonicalType !== "labor") {
      continue;
    }

    const bulkEntries = extractBulkCreateEntries(item);
    const candidates =
      bulkEntries.length > 0 ? bulkEntries : [((item.data ?? {}) as Record<string, unknown>)];

    for (const candidate of candidates) {
      const sectionName = getSectionNameFromRecord(candidate);
      if (!sectionName) continue;

      if (canonicalType === "shopping") {
        referencedSectionNames.shopping.add(sectionName);
      } else {
        referencedSectionNames.labor.add(sectionName);
      }
    }
  }

  const shoppingItemsExist = activeItems.some(
    (entry) => getCanonicalType(entry.type) === "shopping",
  );
  const laborItemsExist = activeItems.some(
    (entry) => getCanonicalType(entry.type) === "labor",
  );
  const hiddenSectionMeta = {
    shopping: shoppingItemsExist ? inferSharedSectionName(items, "shopping") : undefined,
    labor: laborItemsExist ? inferSharedSectionName(items, "labor") : undefined,
  };

  const displayItems = activeItems.flatMap<InlineConfirmationDisplayItem>((item, index) => {
    const bulkEntries = extractBulkCreateEntries(item);
    if (bulkEntries.length <= 1) {
      const canonicalType = getCanonicalType(item.type);
      const inferredSectionName =
        canonicalType === "shopping" || canonicalType === "labor"
          ? inferSharedSectionName(activeItems, canonicalType)
          : undefined;
      const currentData = (item.data ?? {}) as Record<string, unknown>;
      const normalizedItem =
        inferredSectionName &&
        typeof currentData.sectionName !== "string"
          ? {
              ...item,
              data: {
                ...currentData,
                sectionName: inferredSectionName,
              },
            }
          : item;

      const normalizedData = (normalizedItem.data ?? {}) as Record<string, unknown>;
      const sectionCardName = getSectionNameFromRecord(normalizedData);
      const hidden = shouldHideSectionCard({
        canonicalType,
        sectionCardName,
        referencedSectionNames,
        hiddenSectionMeta,
      });

      return [{
        item: normalizedItem,
        index,
        key: `${index}`,
        fromBulk: false,
        hidden,
      }];
    }

    return bulkEntries.map((entry, entryIndex) => {
      const canonicalType = getCanonicalType(item.type);
      const inferredSectionName =
        canonicalType === "shopping" || canonicalType === "labor"
          ? inferSharedSectionName(activeItems, canonicalType)
          : undefined;
      const normalizedEntry =
        inferredSectionName && typeof entry.sectionName !== "string"
          ? { ...entry, sectionName: inferredSectionName }
          : entry;
      const sectionCardName = getSectionNameFromRecord(normalizedEntry);

      return {
        item: {
          ...item,
          operation: "create" as const,
          data: normalizedEntry,
          clientId: item.clientId ? `${item.clientId}::${entryIndex}` : undefined,
        },
        index,
        key: `${index}-${entryIndex}`,
        fromBulk: true,
        hidden: shouldHideSectionCard({
          canonicalType,
          sectionCardName,
          referencedSectionNames,
          hiddenSectionMeta,
        }),
      };
    });
  });

  const visibleItems = displayItems.filter(
    ({ item, hidden }) => !hidden && shouldRenderByState(getApprovalState(item)),
  );

  const unresolvedItems = visibleItems.filter(({ item }) => {
    const approvalState = getApprovalState(item);
    return !(
      item.status === "confirmed" ||
      item.status === "rejected" ||
      approvalState === "output-available" ||
      approvalState === "output-denied" ||
      approvalState === "output-error" ||
      approvalState === "approval-responded"
    );
  });

  return {
    visibleItems,
    unresolvedItems,
    hiddenSectionLabels: [
      hiddenSectionMeta.shopping ? `shopping section "${hiddenSectionMeta.shopping}"` : null,
      hiddenSectionMeta.labor ? `labor section "${hiddenSectionMeta.labor}"` : null,
    ].filter(Boolean) as string[],
    resolvedSummary: unresolvedItems.length === 0 ? getResolvedSummary(visibleItems) : null,
  };
};
