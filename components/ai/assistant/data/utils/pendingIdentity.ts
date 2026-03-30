import type { PendingItem } from "../types";

export const stableSerialize = (value: unknown): string => {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  return `{${sortedKeys.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
};

export const ensurePendingClientIds = <T extends PendingItem>(items: T[]): T[] => {
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
