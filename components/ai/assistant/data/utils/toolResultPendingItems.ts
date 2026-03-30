import type { PendingContentItem, PendingContentType } from "../types/index.ts";
import { ensurePendingClientIds } from "./pendingIdentity.ts";

const MUTATING_OPERATIONS = new Set([
  "create",
  "edit",
  "delete",
  "bulk_create",
  "bulk_edit",
]);

const BULK_KEYS_BY_TYPE: Record<string, string[]> = {
  task: ["tasks", "items"],
  note: ["notes", "items"],
  shopping: ["items"],
  labor: ["items", "laborItems"],
  survey: ["surveys", "items"],
  contact: ["contacts", "items"],
  shoppingSection: ["items", "sections"],
  laborSection: ["items", "sections"],
};

const parseToolResultValue = (result: unknown): Record<string, unknown> | null => {
  let normalizedResult: unknown = result;
  for (let i = 0; i < 2 && typeof normalizedResult === "string"; i += 1) {
    try {
      normalizedResult = JSON.parse(normalizedResult);
    } catch {
      return null;
    }
  }

  return normalizedResult && typeof normalizedResult === "object"
    ? (normalizedResult as Record<string, unknown>)
    : null;
};

const toPendingContentType = (type: string): PendingContentType =>
  type as PendingContentType;

const toRecordArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          !!entry && typeof entry === "object" && !Array.isArray(entry),
      )
    : [];

export function toPendingItemsFromToolResult(
  toolCallId: string,
  result: unknown,
): PendingContentItem[] {
  const parsed = parseToolResultValue(result);
  if (!parsed || typeof parsed.error === "string") {
    return [];
  }

  const type = parsed.type;
  const operation = parsed.operation;
  const data = parsed.data;
  const status = parsed.status;

  if (
    typeof type !== "string" ||
    typeof operation !== "string" ||
    !MUTATING_OPERATIONS.has(operation) ||
    !data ||
    typeof data !== "object"
  ) {
    return [];
  }

  const normalizedStatus =
    status === "confirmed" ||
    status === "rejected" ||
    status === "superseded"
      ? status
      : undefined;

  const createPendingItem = (
    itemType: PendingContentType,
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
    selection:
      parsed.selection && typeof parsed.selection === "object"
        ? (parsed.selection as Record<string, unknown>)
        : undefined,
    titleChanges: Array.isArray(parsed.titleChanges)
      ? (parsed.titleChanges as PendingContentItem["titleChanges"])
      : undefined,
    approvalState:
      parsed.approvalState === "input-streaming" ||
      parsed.approvalState === "input-available" ||
      parsed.approvalState === "approval-requested" ||
      parsed.approvalState === "approval-responded" ||
      parsed.approvalState === "output-available" ||
      parsed.approvalState === "output-denied" ||
      parsed.approvalState === "output-error"
        ? parsed.approvalState
        : undefined,
    approvalReason:
      typeof parsed.approvalReason === "string"
        ? parsed.approvalReason
        : undefined,
    functionCall: {
      callId: toolCallId,
      functionName: "",
      arguments: "",
    },
  });

  if (operation === "bulk_create") {
    const records = data as Record<string, unknown>;
    const bulkKeys = BULK_KEYS_BY_TYPE[type] ?? ["items"];

    for (const key of bulkKeys) {
      const entries = toRecordArray(records[key]);
      if (entries.length === 0) continue;

      return ensurePendingClientIds(
        entries.map((entry) =>
          createPendingItem(toPendingContentType(type), "create", entry),
        ),
      );
    }
  }

  if (operation === "bulk_edit") {
    const items = toRecordArray((data as Record<string, unknown>).items);
    if (items.length > 0) {
      return ensurePendingClientIds(
        items.map((entry) => {
          const originalItem =
            entry.originalItem && typeof entry.originalItem === "object"
              ? (entry.originalItem as Record<string, unknown>)
              : undefined;
          const updates =
            entry.updates && typeof entry.updates === "object"
              ? (entry.updates as Record<string, unknown>)
              : undefined;
          const itemId =
            typeof entry.itemId === "string" ? entry.itemId : undefined;

          return {
            ...createPendingItem(toPendingContentType(type), "edit", { itemId }),
            originalItem,
            updates,
            data: itemId ? { itemId } : {},
          };
        }),
      );
    }
  }

  return ensurePendingClientIds([
    createPendingItem(
      toPendingContentType(type),
      operation as PendingContentItem["operation"],
      data as Record<string, unknown>,
    ),
  ]);
}
