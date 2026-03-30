import type { PendingItem } from "../types";

export const isResolvedPendingItem = (item: PendingItem) =>
  item.status === "confirmed" ||
  item.status === "rejected" ||
  item.status === "superseded";

export const normalizePendingLookupId = (value: string) =>
  value.replace(/::\d+$/, "");

export const findPendingItemIndex = (
  items: PendingItem[],
  indexOrCallId: number | string,
) => {
  if (typeof indexOrCallId === "number") {
    return indexOrCallId >= 0 && indexOrCallId < items.length ? indexOrCallId : -1;
  }

  const candidateIds = Array.from(
    new Set([indexOrCallId, normalizePendingLookupId(indexOrCallId)]),
  ).filter((value) => value.length > 0);

  for (const candidateId of candidateIds) {
    const byClientId = items.findIndex((item) => item.clientId === candidateId);
    if (byClientId !== -1) return byClientId;
  }

  for (const candidateId of candidateIds) {
    const byCallId = items.findIndex(
      (item) => item.functionCall?.callId === candidateId,
    );
    if (byCallId !== -1) return byCallId;
  }

  return -1;
};
