import type { PendingContentItem } from "@/components/ai/assistant/data/types";
import type { InlineConfirmationScope } from "@/components/assistant-ui/tool-fallback-confirmation-scope";

export function toPendingItemsFromResult(
  toolCallId: string,
  result: unknown,
): PendingContentItem[] {
  let normalizedResult: unknown = result;
  for (let i = 0; i < 2 && typeof normalizedResult === "string"; i += 1) {
    try {
      normalizedResult = JSON.parse(normalizedResult);
    } catch {
      return [];
    }
  }

  if (!normalizedResult || typeof normalizedResult !== "object") return [];

  const parsed = normalizedResult as Record<string, unknown>;
  const type = parsed.type;
  const operation = parsed.operation;
  const data = parsed.data;
  const status = parsed.status;

  if (
    typeof type !== "string" ||
    !["create", "edit", "delete", "bulk_create", "bulk_edit"].includes(String(operation)) ||
    !data ||
    typeof data !== "object"
  ) {
    return [];
  }

  const normalizedStatus =
    status === "confirmed" || status === "rejected" ? status : undefined;

  const createPendingItem = (
    itemType: PendingContentItem["type"],
    itemOperation: PendingContentItem["operation"],
    itemData: Record<string, unknown>,
  ): PendingContentItem => ({
    type: itemType,
    operation: itemOperation,
    data: itemData,
    status: normalizedStatus,
    updates:
      parsed.updates && typeof parsed.updates === "object"
        ? (parsed.updates as Record<string, unknown>)
        : undefined,
    originalItem:
      parsed.originalItem && typeof parsed.originalItem === "object"
        ? (parsed.originalItem as Record<string, unknown>)
        : undefined,
    functionCall: {
      callId: toolCallId,
      functionName: "",
      arguments: "",
    },
  });

  if (operation === "bulk_create") {
    const records = data as Record<string, unknown>;

    if (type === "task" && Array.isArray(records.tasks)) {
      return records.tasks
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
        .map((item) => createPendingItem("task", "create", item));
    }

    if (type === "note" && Array.isArray(records.notes)) {
      return records.notes
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
        .map((item) => createPendingItem("note", "create", item));
    }

    if (Array.isArray(records.items)) {
      return records.items
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
        .map((item) =>
          createPendingItem(type as PendingContentItem["type"], "create", item),
        );
    }

    if (type === "survey" && Array.isArray(records.surveys)) {
      return records.surveys
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
        .map((item) => createPendingItem("survey", "create", item));
    }

    if (type === "contact" && Array.isArray(records.contacts)) {
      return records.contacts
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
        .map((item) => createPendingItem("contact", "create", item));
    }
  }

  return [createPendingItem(
    type as PendingContentItem["type"],
    operation as PendingContentItem["operation"],
    data as Record<string, unknown>,
  )];
}

export function resolveInlineConfirmationItems({
  inlineConfirmationScope,
  matchedPendingItemsByCallId,
  fallbackPendingItems,
}: {
  inlineConfirmationScope: InlineConfirmationScope;
  matchedPendingItemsByCallId: PendingContentItem[];
  fallbackPendingItems: PendingContentItem[];
}): PendingContentItem[] {
  if (inlineConfirmationScope.items.length > 0) {
    return inlineConfirmationScope.items;
  }
  if (inlineConfirmationScope.suppressToolFallback) {
    return [];
  }
  if (matchedPendingItemsByCallId.length > 0) {
    return matchedPendingItemsByCallId;
  }
  return fallbackPendingItems;
}
