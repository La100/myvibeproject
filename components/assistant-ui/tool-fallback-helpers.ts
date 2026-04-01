import type { PendingContentItem } from "@/components/ai/assistant/data/types";
import { toPendingItemsFromToolResult } from "../ai/assistant/data/utils/toolResultPendingItems.ts";

export type ToolPreviewItem = {
  title: string;
  description?: string;
  meta?: string;
};

export type ToolPreviewSummary = {
  title: string;
  subtitle?: string;
  badges?: string[];
  items?: ToolPreviewItem[];
  rawArgs?: unknown;
  rawResult?: unknown;
};

type ParsedValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

const PREVIEW_ITEM_LIMIT = 3;

function parsePossiblySerializedJSON(value: unknown): ParsedValue | undefined {
  let current = value;
  for (let i = 0; i < 2 && typeof current === "string"; i += 1) {
    try {
      current = JSON.parse(current);
    } catch {
      break;
    }
  }

  if (
    current === null ||
    Array.isArray(current) ||
    typeof current === "string" ||
    typeof current === "number" ||
    typeof current === "boolean"
  ) {
    return current;
  }

  return current && typeof current === "object"
    ? (current as Record<string, unknown>)
    : undefined;
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          !!entry && typeof entry === "object" && !Array.isArray(entry),
      )
    : [];
}

function toTitleCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function singularize(value: string): string {
  if (value === "projectSettings") return "project settings";
  if (value === "shopping") return "shopping item";
  if (value === "labor") return "labor item";
  if (value === "contact") return "contact";
  if (value === "survey") return "survey";
  if (value === "note") return "note";
  if (value === "task") return "task";
  if (value.endsWith("Section")) {
    return `${toTitleCase(value.replace(/Section$/, "")).toLowerCase()} section`;
  }
  if (value === "moodboard") return "moodboard image";
  return toTitleCase(value).toLowerCase();
}

function pluralize(value: string, count: number): string {
  const singular = singularize(value);
  if (count === 1) return singular;
  if (singular.endsWith("s")) return singular;
  return `${singular}s`;
}

function firstString(record: Record<string, unknown> | undefined, keys: string[]) {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function summarizeFields(record: Record<string, unknown> | undefined): string | undefined {
  if (!record) return undefined;
  const keys = Object.keys(record).filter((key) => record[key] !== undefined);
  if (keys.length === 0) return undefined;
  return keys.map((key) => toTitleCase(key)).join(", ");
}

function summarizePrimitiveList(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries = value.filter(
    (entry): entry is string | number =>
      typeof entry === "string" || typeof entry === "number",
  );
  if (entries.length === 0) return undefined;
  return entries.slice(0, 3).join(", ");
}

function buildItemsFromPendingItems(items: PendingContentItem[]): ToolPreviewItem[] {
  return items.slice(0, PREVIEW_ITEM_LIMIT).map((item) => {
    const original = toRecord(item.originalItem);
    const updates = toRecord(item.updates);
    const title =
      firstString(item.data, ["title", "name", "questionText"]) ??
      firstString(original, ["title", "name", "questionText"]) ??
      `${toTitleCase(item.operation)} ${singularize(item.type)}`;

    const fieldSummary =
      item.operation === "edit"
        ? summarizeFields(updates)
        : item.operation === "delete"
          ? firstString(item.data, ["reason"])
          : firstString(item.data, ["description", "notes", "sectionName"]);

    return {
      title,
      description:
        item.operation === "edit"
          ? fieldSummary ? `Changes: ${fieldSummary}` : "Prepared update"
          : item.operation === "delete"
            ? fieldSummary ? `Reason: ${fieldSummary}` : "Prepared deletion"
            : fieldSummary,
      meta: `${toTitleCase(item.operation)} ${singularize(item.type)}`,
    };
  });
}

function inferOperationFromToolName(toolName: string): string | undefined {
  if (toolName.startsWith("manage_")) return "manage";
  if (toolName.startsWith("create")) return "create";
  if (toolName.startsWith("update")) return "edit";
  if (toolName.startsWith("delete")) return "delete";
  if (toolName === "search_items") return "search";
  if (toolName === "load_full_project_context") return "context";
  return undefined;
}

function inferManagedItemType(
  toolName: string,
  argsRecord: Record<string, unknown> | undefined,
): string {
  const entity =
    typeof argsRecord?.entity === "string" ? argsRecord.entity : undefined;

  switch (toolName) {
    case "manage_tasks":
      return "task";
    case "manage_notes":
      return "note";
    case "manage_contacts":
      return "contact";
    case "manage_surveys":
      return "survey";
    case "manage_shopping":
      return entity === "section" ? "shoppingSection" : "shopping";
    case "manage_labor":
      return entity === "section" ? "laborSection" : "labor";
    default:
      return "item";
  }
}

function buildItemsFromArgs(
  itemType: string,
  operation: string,
  argsRecord: Record<string, unknown>,
): ToolPreviewItem[] {
  const singleData = toRecord(argsRecord.data);
  const bulkItems = Array.isArray(argsRecord.items)
    ? toRecordArray(argsRecord.items)
    : singleData
      ? toRecordArray(singleData.items)
      : [];

  if (bulkItems.length > 0) {
    return bulkItems.slice(0, PREVIEW_ITEM_LIMIT).map((entry) => ({
      title:
        firstString(entry, ["title", "name", "questionText"]) ??
        `${toTitleCase(operation)} ${singularize(itemType)}`,
      description:
        firstString(entry, ["description", "notes", "content"]) ??
        summarizePrimitiveList(entry.tags),
      meta:
        typeof entry.quantity === "number"
          ? `Qty ${entry.quantity}`
          : firstString(entry, ["priority", "status", "sectionName"]),
    }));
  }

  const primaryRecord = singleData ?? argsRecord;
  const title =
    firstString(primaryRecord, ["title", "name", "questionText"]) ??
    `${toTitleCase(operation)} ${singularize(itemType)}`;
  const description =
    firstString(primaryRecord, ["description", "notes", "content"]) ??
    summarizePrimitiveList(primaryRecord.tags);
  const metaParts = [
    typeof primaryRecord.quantity === "number" ? `Qty ${primaryRecord.quantity}` : undefined,
    firstString(primaryRecord, ["priority", "status", "sectionName"]),
  ].filter(Boolean) as string[];

  return [
    {
      title,
      description,
      meta: metaParts.length > 0 ? metaParts.join(" • ") : undefined,
    },
  ];
}

function extractSearchItems(resultRecord: Record<string, unknown>): Record<string, unknown>[] {
  const directItems = toRecordArray(resultRecord.items);
  if (directItems.length > 0) return directItems;
  const directResults = toRecordArray(resultRecord.results);
  if (directResults.length > 0) return directResults;
  return [];
}

export function buildToolPreviewSummary({
  toolName,
  argsText,
  result,
  pendingItems,
}: {
  toolName: string;
  argsText?: string;
  result?: unknown;
  pendingItems?: PendingContentItem[];
}): ToolPreviewSummary | null {
  const parsedArgs = parsePossiblySerializedJSON(argsText);
  const parsedResult = parsePossiblySerializedJSON(result);
  const argsRecord = toRecord(parsedArgs);
  const resultRecord = toRecord(parsedResult);

  if (pendingItems && pendingItems.length > 0) {
    const firstItem = pendingItems[0];
    const count = pendingItems.length;
    const subject = pluralize(firstItem.type, count);
    const verb =
      firstItem.operation === "create"
        ? "Create"
        : firstItem.operation === "edit"
          ? "Update"
          : firstItem.operation === "delete"
            ? "Delete"
            : toTitleCase(firstItem.operation);

    return {
      title: `${verb} ${count} ${subject}`,
      subtitle:
        count === 1
          ? `Prepared ${firstItem.operation} for ${singularize(firstItem.type)}`
          : `Prepared batch ${firstItem.operation}`,
      badges: [toTitleCase(firstItem.operation), toTitleCase(firstItem.type)],
      items: buildItemsFromPendingItems(pendingItems),
      rawArgs: parsedArgs,
      rawResult: parsedResult,
    };
  }

  if (toolName === "search_items" && resultRecord) {
    const items = extractSearchItems(resultRecord);
    const count =
      typeof resultRecord.total === "number"
        ? resultRecord.total
        : typeof resultRecord.count === "number"
          ? resultRecord.count
          : items.length;
    const type =
      typeof argsRecord?.type === "string" ? argsRecord.type : "item";
    return {
      title: `Found ${count} ${pluralize(type, count)}`,
      subtitle:
        typeof argsRecord?.query === "string" && argsRecord.query.trim().length > 0
          ? `Search query: ${argsRecord.query.trim()}`
          : "Read-only search result",
      badges: ["Search", toTitleCase(type)],
      items: items.slice(0, PREVIEW_ITEM_LIMIT).map((item) => ({
        title:
          firstString(item, ["title", "name", "questionText"]) ??
          firstString(item, ["_id", "id"]) ??
          "Result",
        description:
          firstString(item, ["description", "notes", "content"]) ??
          summarizePrimitiveList(item.tags),
      })),
      rawArgs: parsedArgs,
      rawResult: parsedResult,
    };
  }

  if (toolName === "load_full_project_context" && resultRecord) {
    const counts = toRecord(resultRecord.counts);
    return {
      title: "Loaded full project context",
      subtitle:
        typeof resultRecord.message === "string" ? resultRecord.message : "Project snapshot ready",
      badges: ["Context"],
      items: counts
        ? Object.entries(counts).map(([key, value]) => ({
            title: `${toTitleCase(key)}: ${String(value)}`,
          }))
        : undefined,
      rawArgs: parsedArgs,
      rawResult: parsedResult,
    };
  }

  if (toolName === "generate_moodboard_image" && resultRecord) {
    return {
      title: resultRecord.success === true ? "Generated moodboard image" : "Moodboard generation",
      subtitle:
        firstString(resultRecord, ["message", "sectionLabel", "model"]) ??
        firstString(argsRecord, ["section", "prompt"]),
      badges: ["Moodboard"],
      items: [
        {
          title: firstString(argsRecord, ["section"]) ?? "Requested section",
          description: firstString(argsRecord, ["prompt"]),
          meta: firstString(resultRecord, ["model"]),
        },
      ],
      rawArgs: parsedArgs,
      rawResult: parsedResult,
    };
  }

  if (argsRecord) {
    const inferredOperation = inferOperationFromToolName(toolName);
    const type =
      inferredOperation === "manage"
        ? inferManagedItemType(toolName, argsRecord)
        : firstString(argsRecord, ["type"]) ?? "item";
    const normalizedOperation =
      inferredOperation === "manage"
        ? typeof argsRecord.action === "string"
          ? argsRecord.action === "update"
            ? "edit"
            : argsRecord.action
          : undefined
        : inferredOperation;
    if (
      normalizedOperation === "create" ||
      normalizedOperation === "edit" ||
      normalizedOperation === "delete"
    ) {
      const bulkItems = Array.isArray(argsRecord.items)
        ? argsRecord.items
        : toRecord(argsRecord.data)?.items;
      const count = Array.isArray(bulkItems) ? bulkItems.length : 1;
      const subject = pluralize(type, count);

      return {
        title: `${toTitleCase(normalizedOperation)} ${count} ${subject}`,
        subtitle:
          normalizedOperation === "edit"
            ? `Prepared changes for ${subject}`
            : normalizedOperation === "delete"
              ? `Review before removing ${subject}`
              : `Prepared ${subject} for confirmation`,
        badges: [toTitleCase(normalizedOperation), toTitleCase(type)],
        items: buildItemsFromArgs(type, normalizedOperation, argsRecord),
        rawArgs: parsedArgs,
        rawResult: parsedResult,
      };
    }
  }

  if (resultRecord) {
    if (typeof resultRecord.error === "string") {
      return {
        title: `${toTitleCase(toolName)} failed`,
        subtitle: resultRecord.error,
        badges: ["Error"],
        rawArgs: parsedArgs,
        rawResult: parsedResult,
      };
    }

    if (resultRecord.success === true) {
      return {
        title: firstString(resultRecord, ["message"]) ?? `${toTitleCase(toolName)} completed`,
        subtitle: firstString(argsRecord, ["type", "query", "section"]),
        badges: ["Complete"],
        rawArgs: parsedArgs,
        rawResult: parsedResult,
      };
    }
  }

  if (argsRecord) {
    const type = firstString(argsRecord, ["type"]);
    return {
      title: toTitleCase(toolName),
      subtitle: type ? `Working with ${singularize(type)}` : undefined,
      badges: type ? [toTitleCase(type)] : undefined,
      rawArgs: parsedArgs,
      rawResult: parsedResult,
    };
  }

  return null;
}

export function toPendingItemsFromResult(
  toolCallId: string,
  result: unknown,
): PendingContentItem[] {
  return toPendingItemsFromToolResult(toolCallId, result);
}
