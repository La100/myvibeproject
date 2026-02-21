import type { PendingItem } from "../types";
import { expandBulkEditItems, isPendingItemType, normalizePendingItems } from "../utils";

export type PendingFunctionCall = {
  callId: string;
  functionName: string;
  arguments: string;
  responseId: string;
  status?: string;
};

const parseFunctionCallArguments = (raw: string): Record<string, unknown> | null => {
  let parsed: unknown = raw;
  for (let i = 0; i < 2 && typeof parsed === "string"; i += 1) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  return parsed && typeof parsed === "object"
    ? (parsed as Record<string, unknown>)
    : null;
};

const toPendingItem = (call: PendingFunctionCall): PendingItem | null => {
  const parsed = parseFunctionCallArguments(call.arguments);
  if (!parsed) {
    return null;
  }

  const parsedTypeValue =
    typeof parsed.type === "string" ? parsed.type : undefined;
  const parsedType = isPendingItemType(parsedTypeValue)
    ? parsedTypeValue
    : undefined;
  const functionCallType = isPendingItemType(call.functionName)
    ? call.functionName
    : undefined;

  return {
    type: parsedType ?? functionCallType ?? "task",
    operation: parsed.operation as PendingItem["operation"],
    data: (parsed.data as Record<string, unknown>) || parsed,
    updates: parsed.updates as Record<string, unknown> | undefined,
    originalItem: parsed.originalItem as Record<string, unknown> | undefined,
    selection: parsed.selection as Record<string, unknown> | undefined,
    titleChanges: parsed.titleChanges as PendingItem["titleChanges"],
    functionCall: {
      callId: call.callId,
      functionName: call.functionName,
      arguments: call.arguments,
    },
    responseId: call.responseId,
    status:
      call.status === "confirmed" || call.status === "rejected"
        ? call.status
        : undefined,
  };
};

const ensureClientIds = (items: PendingItem[]) =>
  items.map((item, index) => ({
    ...item,
    clientId: item.clientId ?? `${item.functionCall?.callId ?? "pending"}-${index}`,
  }));

const isResolved = (item: PendingItem) =>
  item.status === "confirmed" || item.status === "rejected";

export const hydratePendingItems = (
  calls: PendingFunctionCall[],
): PendingItem[] => {
  const parsedItems = calls
    .map((call) => {
      try {
        return toPendingItem(call);
      } catch (error) {
        console.error("Failed to parse pending item:", error);
        return null;
      }
    })
    .filter((item): item is PendingItem => item !== null);

  if (parsedItems.length === 0) {
    return [];
  }

  return ensureClientIds(
    expandBulkEditItems(normalizePendingItems(parsedItems)),
  );
};

export const mergePendingItems = (
  previousItems: PendingItem[],
  incomingItems: PendingItem[],
): PendingItem[] => {
  const previousByClientId = new Map(previousItems.map((item) => [item.clientId, item]));

  const nextIncoming = incomingItems.map((item) => {
    const previousItem = previousByClientId.get(item.clientId);
    if (previousItem && isResolved(previousItem)) {
      return { ...item, status: previousItem.status };
    }
    return item;
  });

  const incomingIds = new Set(nextIncoming.map((item) => item.clientId));
  const preservedResolved = previousItems.filter((item) => {
    if (!isResolved(item)) return false;
    if (!item.clientId) return true;
    return !incomingIds.has(item.clientId);
  });

  return [...nextIncoming, ...preservedResolved];
};

export const keepOnlyResolvedPendingItems = (items: PendingItem[]) =>
  items.filter((item) => isResolved(item));
