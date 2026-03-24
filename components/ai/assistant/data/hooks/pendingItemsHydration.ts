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

const inferOperation = (
  parsed: Record<string, unknown>,
  functionName: string,
): PendingItem["operation"] => {
  const parsedOperation = parsed.operation;
  if (
    parsedOperation === "create" ||
    parsedOperation === "bulk_create" ||
    parsedOperation === "edit" ||
    parsedOperation === "bulk_edit" ||
    parsedOperation === "delete"
  ) {
    return parsedOperation;
  }

  if (parsed.updates && typeof parsed.updates === "object") {
    return "edit";
  }

  if (functionName === "update_item") return "edit";
  if (functionName === "update_multiple_items") return "bulk_edit";
  if (functionName === "update_project_settings") return "edit";
  if (functionName === "create_item") return "create";
  if (functionName === "create_multiple_items") return "bulk_create";
  if (functionName === "delete_item") return "delete";

  // Fail closed: prefer edit over accidental create when metadata is incomplete.
  return "edit";
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
  const functionNameType =
    call.functionName === "update_project_settings"
      ? "projectSettings"
      : undefined;

  return {
    type: parsedType ?? functionNameType ?? "task",
    operation: inferOperation(parsed, call.functionName),
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

const stableSerialize = (value: unknown): string => {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  return `{${sortedKeys.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
};

const ensureClientIds = (items: PendingItem[]) => {
  const perSignatureCounters = new Map<string, number>();
  let fallbackCounter = 0;

  return items.map((item) => {
    if (item.clientId) {
      return item;
    }

    const callId = item.functionCall?.callId;
    if (callId) {
      const stableSignature = stableSerialize({
        type: item.type,
        operation: item.operation,
        data: item.data,
        updates: item.updates,
        originalItem: item.originalItem,
        selection: item.selection,
        titleChanges: item.titleChanges,
      });
      const signatureKey = `${callId}:${stableSignature}`;
      const signatureIndex = perSignatureCounters.get(signatureKey) ?? 0;
      perSignatureCounters.set(signatureKey, signatureIndex + 1);
      return {
        ...item,
        clientId: `${signatureKey}:${signatureIndex}`,
      };
    }

    fallbackCounter += 1;
    return {
      ...item,
      clientId: `pending:${item.type}:${item.operation}:${fallbackCounter}`,
    };
  });
};

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

  const merged = [...nextIncoming, ...preservedResolved];

  const isUnchanged =
    merged.length === previousItems.length &&
    merged.every((item, index) => {
      const previous = previousItems[index];
      if (!previous) return false;

      return (
        previous.clientId === item.clientId &&
        previous.status === item.status &&
        previous.type === item.type &&
        previous.operation === item.operation &&
        previous.responseId === item.responseId &&
        previous.functionCall?.callId === item.functionCall?.callId &&
        previous.functionCall?.arguments === item.functionCall?.arguments
      );
    });

  return isUnchanged ? previousItems : merged;
};

export const keepOnlyResolvedPendingItems = (items: PendingItem[]) => {
  const resolved = items.filter((item) => isResolved(item));
  return resolved.length === items.length ? items : resolved;
};
