"use client";

import { useCallback } from "react";
import { useConvex } from "convex/react";

import type { Id } from "@/convex/_generated/dataModel";
import {
  buildCreateSurveyPayload,
  buildUpdateSurveyPayload,
} from "@/lib/assistant/chatkitSurveyPayload";
import { extractShoppingRealizationStatus } from "@/lib/assistant/normalizeShoppingRealizationStatus";
import { apiAny } from "@/lib/convexApiAny";

type ToolCall = {
  name: string;
  params: Record<string, unknown>;
};

type CrudAction =
  | "create"
  | "update"
  | "delete"
  | "bulk_create"
  | "bulk_update"
  | "bulk_delete";

type UseChatKitClientToolsArgs = {
  projectId: Id<"projects">;
  teamId: Id<"teams">;
  teamSlug: string;
  userClerkId?: string;
  timezone?: string;
  canMakeChanges: boolean;
};
type BulkFailure = {
  index: number;
  error: string;
};

const READ_ONLY_TOOL_NAMES = new Set([
  "get_runtime_capabilities",
  "load_full_project_context",
  "search_items",
  "scrape_shopping_product",
]);
const OPEN_TASK_STATUSES = ["todo", "in_progress", "review"] as const;
const CLOSED_TASK_STATUSES = ["done"] as const;
const TASK_DOMAIN_QUERY_WORDS = new Set([
  "task",
  "tasks",
  "todo",
  "todos",
  "zadanie",
  "zadania",
  "zadan",
]);
const TASK_OPEN_QUERY_WORDS = new Set([
  "open",
  "opened",
  "active",
  "pending",
  "unfinished",
  "otwarte",
  "otwarty",
  "aktywny",
  "aktywne",
  "niezamkniete",
  "niedokonczone",
  "niedokonczony",
]);
const TASK_CLOSED_QUERY_WORDS = new Set([
  "done",
  "closed",
  "completed",
  "zamkniete",
  "zamkniety",
  "ukonczone",
  "ukonczony",
  "zakonczone",
  "zakonczony",
]);
const TASK_RECENT_QUERY_WORDS = new Set([
  "latest",
  "newest",
  "recent",
  "recently",
  "najnowsze",
  "najnowszy",
  "ostatnie",
  "ostatni",
]);
const TASK_FILLER_QUERY_WORDS = new Set([
  "czy",
  "sa",
  "jakies",
  "jakis",
  "jakie",
  "podaj",
  "pokaz",
  "show",
  "list",
  "tell",
  "there",
  "are",
  "the",
  "this",
  "project",
  "projekcie",
  "projektu",
  "tym",
  "teraz",
  "obecnie",
  "if",
  "tak",
  "tytuly",
  "titles",
  "title",
  "status",
  "statusy",
  "termin",
  "deadline",
  "deadlines",
  "due",
  "date",
  "dates",
  "all",
  "wszystkie",
]);
const NON_TASK_DOMAIN_QUERY_WORDS = new Set([
  "note",
  "notes",
  "notatka",
  "notatki",
  "payment",
  "payments",
  "invoice",
  "invoices",
  "faktura",
  "faktury",
  "shopping",
  "zakupy",
  "labor",
  "contacts",
  "contact",
  "team",
  "teammate",
  "teammates",
  "member",
  "members",
  "zespol",
  "zespolu",
  "czlonek",
  "czlonkowie",
  "survey",
  "surveys",
  "moodboard",
  "file",
  "files",
  "pdf",
  "document",
  "documents",
]);
const TEAM_MEMBER_QUERY_WORDS = new Set([
  "assignee",
  "assignees",
  "collaborator",
  "collaborators",
  "member",
  "members",
  "team",
  "teammate",
  "teammates",
  "czlonek",
  "czlonkowie",
  "osoba",
  "osoby",
  "teamie",
  "zespol",
  "zespole",
  "zespolu",
]);
const UNASSIGNED_ASSIGNEE_VALUES = new Set([
  "none",
  "no assignee",
  "unassigned",
  "remove assignee",
  "clear assignee",
  "bez przypisania",
  "nieprzypisane",
  "nieprzypisany",
  "usun przypisanie",
  "usuń przypisanie",
]);
const MOODBOARD_QUERY_WORDS = new Set([
  "moodboard",
  "moodboards",
  "inspiration",
  "reference",
  "references",
  "image",
  "images",
  "render",
  "renders",
  "wizualizacja",
  "wizualizacje",
]);
const TASK_UPDATE_MUTATION_FIELDS = new Set([
  "title",
  "description",
  "content",
  "status",
  "priority",
  "assignedTo",
  "startDate",
  "endDate",
  "tags",
]);
const BULK_TOOL_CONCURRENCY = 4;

function asCrudAction(value: unknown): CrudAction | undefined {
  if (
    value === "create" ||
    value === "update" ||
    value === "delete" ||
    value === "bulk_create" ||
    value === "bulk_update" ||
    value === "bulk_delete"
  ) {
    return value;
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function hasOwnValue(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function invalidProvidedDate(
  record: Record<string, unknown>,
  key: string,
  parser: (value: unknown) => unknown,
): string | null {
  if (!hasOwnValue(record, key)) return null;
  const raw = record[key];
  if (raw === null || raw === undefined || raw === "") return null;
  return parser(raw) === undefined ? key : null;
}

function invalidProvidedValue(
  record: Record<string, unknown>,
  key: string,
  parser: (value: unknown) => unknown,
): string | null {
  if (!hasOwnValue(record, key)) return null;
  const raw = record[key];
  if (raw === null || raw === undefined || raw === "") return null;
  return parser(raw) === undefined ? key : null;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asRecord(entry))
    .filter((entry) => Object.keys(entry).length > 0);
}

function flattenManagedToolParams(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const data = asRecord(params.data);
  const flattened = {
    ...data,
    ...params,
  };
  delete flattened.data;
  return flattened;
}

function extractBulkEntries(
  params: Record<string, unknown>,
  keys: string[],
): Record<string, unknown>[] {
  const data = asRecord(params.data);
  for (const source of [params, data]) {
    for (const key of ["items", ...keys]) {
      if (Array.isArray(source[key]) && source[key].length > 0) {
        return source[key].map((entry, index) => {
          const record = asRecord(entry);
          return Object.keys(record).length > 0
            ? flattenManagedToolParams(record)
            : {
                __invalidBulkItem: true,
                index: index + 1,
              };
        });
      }

      const entries = asRecordArray(source[key]);
      if (entries.length > 0) {
        return entries.map((entry) => flattenManagedToolParams(entry));
      }
    }
  }

  return [];
}

function hasManagedUpdateFields(
  payload: Record<string, unknown>,
  idKeys: string[],
): boolean {
  return Object.keys(payload).some((key) => !idKeys.includes(key));
}

function compactDefinedFields(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

function getDatePartInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getDateTimePartInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
}

function normalizeTimezone(value: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return "Europe/Warsaw";
  }
}

function buildRuntimeSessionContext(args: {
  userClerkId?: string;
  teamId: string;
  projectId: string;
  timezone: string;
}) {
  const now = new Date();
  const timezone = normalizeTimezone(args.timezone || "Europe/Warsaw");
  return {
    identity: {
      clerkUserId: args.userClerkId ?? null,
      teamId: args.teamId,
      projectId: args.projectId,
      selfReferenceRule:
        "Resolve 'me', 'myself', 'my tasks', and 'assign to me' to clerkUserId unless the user explicitly says otherwise.",
    },
    time: {
      timezone,
      currentLocalDate: getDatePartInTimezone(now, timezone),
      currentLocalDateTime: getDateTimePartInTimezone(now, timezone),
      currentUtcDateTime: now.toISOString(),
      relativeDateRule:
        "Resolve today, tomorrow, dzisiaj, jutro, pojutrze, next Monday, o 13, na 13:30, and at 4pm from this current time and pass concrete ISO strings to tools.",
    },
  };
}

function formatConfirmedActionResult(
  result: unknown,
  successFallback: string,
  failureFallback = "The requested operation could not be completed.",
): { ok: true; message: string } | { ok: false; error: string } {
  const success = asRecord(result).success === true;
  const message = asNonEmptyString(asRecord(result).message);
  if (success) {
    return {
      ok: true,
      message: message ?? successFallback,
    };
  }

  return {
    ok: false,
    error: message ?? failureFallback,
  };
}

function buildNameMap(
  records: Array<Record<string, unknown>>,
): Map<string, string> {
  return new Map(
    records
      .map((record) => {
        const id = typeof record._id === "string" ? record._id : undefined;
        const name = asNonEmptyString(record.name);
        return id && name ? ([id, name] as const) : null;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry)),
  );
}

function buildSectionItemCountMap(
  records: Array<Record<string, unknown>>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of records) {
    const sectionId = asNonEmptyString(record.sectionId);
    if (!sectionId) continue;
    counts.set(sectionId, (counts.get(sectionId) ?? 0) + 1);
  }
  return counts;
}

function pickFirstNonEmptyString(
  params: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = params[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

type TeamMemberRecord = {
  clerkUserId?: string;
  name?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
};

function normalizeLookupValue(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function tokenizeSearchText(value: string): string[] {
  const normalized = normalizeSearchText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return normalized ? normalized.split(/\s+/) : [];
}

function parseRequestedLimit(tokens: string[], fallbackLimit: number): number {
  const numericToken = tokens.find((token) => /^\d{1,2}$/.test(token));
  if (!numericToken) return fallbackLimit;

  const parsed = Number(numericToken);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackLimit;
  }

  return Math.min(parsed, 25);
}

function looksLikeMoodboardQuery(rawQueryInput: string): boolean {
  const tokens = tokenizeSearchText(rawQueryInput);
  return tokens.some((token) => MOODBOARD_QUERY_WORDS.has(token));
}

type TaskSearchPlan = {
  effectiveScope: string;
  query: string;
  limit: number;
  statuses?: string[];
};

function buildTaskSearchPlan(
  rawQueryInput: string,
  scope: string,
  fallbackLimit: number,
): TaskSearchPlan {
  const tokens = tokenizeSearchText(rawQueryInput);
  const hasTeamMemberWord = tokens.some((token) =>
    TEAM_MEMBER_QUERY_WORDS.has(token),
  );
  const hasTaskWord = tokens.some((token) =>
    TASK_DOMAIN_QUERY_WORDS.has(token),
  );
  const hasNonTaskDomainWord = tokens.some((token) =>
    NON_TASK_DOMAIN_QUERY_WORDS.has(token),
  );
  const effectiveScope =
    scope === "all" && hasTeamMemberWord
      ? "team_members"
      : scope === "all" && hasTaskWord && !hasNonTaskDomainWord
        ? "tasks"
        : scope;
  const shouldInspectTasks =
    effectiveScope === "all" || effectiveScope === "tasks";

  if (!shouldInspectTasks) {
    return {
      effectiveScope,
      query: normalizeSearchText(rawQueryInput.trim()),
      limit: fallbackLimit,
    };
  }

  const hasOpenQualifier = tokens.some((token) =>
    TASK_OPEN_QUERY_WORDS.has(token),
  );
  const hasClosedQualifier = tokens.some((token) =>
    TASK_CLOSED_QUERY_WORDS.has(token),
  );
  const remainingTokens = tokens.filter(
    (token) =>
      !TASK_DOMAIN_QUERY_WORDS.has(token) &&
      !TASK_OPEN_QUERY_WORDS.has(token) &&
      !TASK_CLOSED_QUERY_WORDS.has(token) &&
      !TASK_RECENT_QUERY_WORDS.has(token) &&
      !TASK_FILLER_QUERY_WORDS.has(token) &&
      !/^\d+$/.test(token),
  );

  let statuses: string[] | undefined;
  if (hasOpenQualifier && !hasClosedQualifier) {
    statuses = [...OPEN_TASK_STATUSES];
  } else if (hasClosedQualifier && !hasOpenQualifier) {
    statuses = [...CLOSED_TASK_STATUSES];
  }

  return {
    effectiveScope,
    query: remainingTokens.join(" "),
    limit: parseRequestedLimit(tokens, fallbackLimit),
    statuses,
  };
}

function sortTasksByRecency<
  T extends { updatedAt?: number; _creationTime?: number; createdAt?: number },
>(tasks: T[]): T[] {
  return [...tasks].sort(
    (left, right) =>
      (right.updatedAt ?? right._creationTime ?? right.createdAt ?? 0) -
      (left.updatedAt ?? left._creationTime ?? left.createdAt ?? 0),
  );
}

function selectSearchResultKeys(scope: string): string[] {
  switch (scope) {
    case "tasks":
      return ["tasks"];
    case "notes":
      return ["notes"];
    case "payment":
    case "payments":
    case "invoice":
    case "invoices":
      return ["payments"];
    case "shopping":
      return ["shopping", "shoppingSections"];
    case "labor":
      return ["labor", "laborSections"];
    case "survey":
    case "surveys":
      return ["surveys"];
    case "contacts":
      return ["contacts"];
    case "team":
    case "teams":
    case "team_member":
    case "team_members":
    case "members":
      return ["teamMembers"];
    case "moodboard":
      return ["moodboardSections", "moodboardImages"];
    case "files":
      return ["files"];
    default:
      return [
        "tasks",
        "notes",
        "payments",
        "shopping",
        "shoppingSections",
        "labor",
        "laborSections",
        "surveys",
        "contacts",
        "teamMembers",
        "moodboardSections",
        "moodboardImages",
        "files",
      ];
  }
}

function resolveAssigneeFromTeamMembers(
  identifier: string,
  teamMembers: TeamMemberRecord[],
  currentUserClerkId?: string,
): string | null {
  const normalizedIdentifier = normalizeLookupValue(identifier);
  if (!normalizedIdentifier) return null;

  if (
    currentUserClerkId &&
    ["me", "myself", "self", "current user", "ja", "mnie", "mi"].includes(
      normalizedIdentifier,
    )
  ) {
    return currentUserClerkId;
  }

  const exactMatches = teamMembers.filter((member) => {
    const clerkUserId = member.clerkUserId
      ? normalizeLookupValue(member.clerkUserId)
      : undefined;
    const name = member.name ? normalizeLookupValue(member.name) : undefined;
    const email = member.email ? normalizeLookupValue(member.email) : undefined;

    return (
      clerkUserId === normalizedIdentifier ||
      name === normalizedIdentifier ||
      email === normalizedIdentifier
    );
  });

  if (exactMatches.length === 1 && exactMatches[0]?.clerkUserId) {
    return exactMatches[0].clerkUserId;
  }

  const looseMatches = teamMembers.filter((member) => {
    const name = member.name ? normalizeLookupValue(member.name) : "";
    const email = member.email ? normalizeLookupValue(member.email) : "";
    return (
      name.includes(normalizedIdentifier) ||
      email.includes(normalizedIdentifier)
    );
  });

  if (looseMatches.length === 1 && looseMatches[0]?.clerkUserId) {
    return looseMatches[0].clerkUserId;
  }

  return null;
}

function normalizeClientToolCall(call: ToolCall): ToolCall | { error: string } {
  const params = asRecord(call.params);
  const action = asCrudAction(params.action);

  switch (call.name) {
    case "manage_tasks": {
      if (!action) {
        return { error: "Missing or invalid `action` for manage_tasks." };
      }

      if (
        action === "bulk_create" ||
        action === "bulk_update" ||
        action === "bulk_delete"
      ) {
        const items = extractBulkEntries(params, ["tasks"]);
        return {
          name:
            action === "bulk_create"
              ? "bulk_create_tasks"
              : action === "bulk_update"
                ? "bulk_update_tasks"
                : "bulk_delete_tasks",
          params: { items },
        };
      }

      const flattened = flattenManagedToolParams(params);
      const taskId = pickFirstNonEmptyString(flattened, [
        "taskId",
        "itemId",
        "id",
      ]);

      return {
        name:
          action === "create"
            ? "create_task"
            : action === "update"
              ? "update_task"
              : "delete_task",
        params: {
          ...flattened,
          ...(taskId ? { taskId } : {}),
        },
      };
    }

    case "manage_notes": {
      if (!action) {
        return { error: "Missing or invalid `action` for manage_notes." };
      }

      if (
        action === "bulk_create" ||
        action === "bulk_update" ||
        action === "bulk_delete"
      ) {
        const items = extractBulkEntries(params, ["notes"]);
        return {
          name:
            action === "bulk_create"
              ? "bulk_create_notes"
              : action === "bulk_update"
                ? "bulk_update_notes"
                : "bulk_delete_notes",
          params: { items },
        };
      }

      const flattened = flattenManagedToolParams(params);
      const noteId = pickFirstNonEmptyString(flattened, [
        "noteId",
        "itemId",
        "id",
      ]);

      return {
        name:
          action === "create"
            ? "create_note"
            : action === "update"
              ? "update_note"
              : "delete_note",
        params: {
          ...flattened,
          ...(noteId ? { noteId } : {}),
        },
      };
    }

    case "manage_contacts": {
      if (!action) {
        return { error: "Missing or invalid `action` for manage_contacts." };
      }

      if (
        action === "bulk_create" ||
        action === "bulk_update" ||
        action === "bulk_delete"
      ) {
        const items = extractBulkEntries(params, ["contacts"]);
        return {
          name:
            action === "bulk_create"
              ? "bulk_create_contacts"
              : action === "bulk_update"
                ? "bulk_update_contacts"
                : "bulk_delete_contacts",
          params: { items },
        };
      }

      const flattened = flattenManagedToolParams(params);
      const contactId = pickFirstNonEmptyString(flattened, [
        "contactId",
        "itemId",
        "id",
      ]);

      return {
        name:
          action === "create"
            ? "create_contact"
            : action === "update"
              ? "update_contact"
              : "delete_contact",
        params: {
          ...flattened,
          ...(contactId ? { contactId } : {}),
        },
      };
    }

    case "manage_payments": {
      if (
        !action ||
        action === "bulk_create" ||
        action === "bulk_update" ||
        action === "bulk_delete"
      ) {
        return { error: "Missing or invalid `action` for manage_payments." };
      }

      const flattened = flattenManagedToolParams(params);
      const paymentId = pickFirstNonEmptyString(flattened, [
        "paymentId",
        "invoiceId",
        "itemId",
        "id",
      ]);

      return {
        name:
          action === "create"
            ? "create_payment"
            : action === "update"
              ? "update_payment"
              : "delete_payment",
        params: {
          ...flattened,
          ...(paymentId ? { paymentId } : {}),
        },
      };
    }

    case "manage_surveys": {
      if (!action) {
        return { error: "Missing or invalid `action` for manage_surveys." };
      }

      if (
        action === "bulk_create" ||
        action === "bulk_update" ||
        action === "bulk_delete"
      ) {
        const items = extractBulkEntries(params, ["surveys"]);
        return {
          name:
            action === "bulk_create"
              ? "bulk_create_surveys"
              : action === "bulk_update"
                ? "bulk_update_surveys"
                : "bulk_delete_surveys",
          params: { items },
        };
      }

      const flattened = flattenManagedToolParams(params);
      const surveyId = pickFirstNonEmptyString(flattened, [
        "surveyId",
        "itemId",
        "id",
      ]);

      return {
        name:
          action === "create"
            ? "create_survey"
            : action === "update"
              ? "update_survey"
              : "delete_survey",
        params: {
          ...flattened,
          ...(surveyId ? { surveyId } : {}),
        },
      };
    }

    case "manage_shopping":
    case "manage_labor": {
      if (!action) {
        return { error: `Missing or invalid \`action\` for ${call.name}.` };
      }

      const entity =
        call.name === "manage_shopping"
          ? params.entity === "item" ||
            params.entity === "section" ||
            params.entity === "set"
            ? params.entity
            : undefined
          : params.entity === "item" || params.entity === "section"
            ? params.entity
            : undefined;
      if (!entity) {
        return { error: `Missing or invalid \`entity\` for ${call.name}.` };
      }

      const bulkItems = extractBulkEntries(
        params,
        entity === "section"
          ? ["sections"]
          : entity === "set"
            ? ["sets", "items"]
            : ["items"],
      );
      const effectiveAction =
        bulkItems.length > 0 &&
        (action === "create" || action === "update" || action === "delete")
          ? (`bulk_${action}` as CrudAction)
          : action;

      if (
        effectiveAction === "bulk_create" ||
        effectiveAction === "bulk_update" ||
        effectiveAction === "bulk_delete"
      ) {
        const prefix = call.name === "manage_shopping" ? "shopping" : "labor";
        return {
          name:
            effectiveAction === "bulk_create"
              ? `bulk_create_${prefix}_${entity === "section" ? "sections" : entity === "set" ? "sets" : "items"}`
              : effectiveAction === "bulk_update"
                ? `bulk_update_${prefix}_${entity === "section" ? "sections" : entity === "set" ? "sets" : "items"}`
                : `bulk_delete_${prefix}_${entity === "section" ? "sections" : entity === "set" ? "sets" : "items"}`,
          params: { items: bulkItems },
        };
      }

      const flattened = flattenManagedToolParams(params);
      const itemId = pickFirstNonEmptyString(flattened, ["itemId", "id"]);
      const sectionId = pickFirstNonEmptyString(flattened, ["sectionId", "id"]);
      const setId = pickFirstNonEmptyString(flattened, ["setId", "id"]);
      const prefix = call.name === "manage_shopping" ? "shopping" : "labor";

      return {
        name:
          entity === "item"
            ? action === "create"
              ? `create_${prefix}_item`
              : action === "update"
                ? `update_${prefix}_item`
                : `delete_${prefix}_item`
            : entity === "section"
              ? action === "create"
                ? `create_${prefix}_section`
                : action === "update"
                  ? `update_${prefix}_section`
                  : `delete_${prefix}_section`
              : action === "create"
                ? `create_${prefix}_set`
                : action === "update"
                  ? `update_${prefix}_set`
                  : `delete_${prefix}_set`,
        params: {
          ...flattened,
          ...(itemId ? { itemId } : {}),
          ...(sectionId ? { sectionId } : {}),
          ...(setId ? { setId } : {}),
        },
      };
    }

    case "manage_moodboard": {
      if (!action) {
        return { error: "Missing or invalid `action` for manage_moodboard." };
      }
      if (
        action === "bulk_create" ||
        action === "bulk_update" ||
        action === "bulk_delete"
      ) {
        return {
          error:
            "Bulk moodboard section operations are not supported. Call manage_moodboard once per section.",
        };
      }

      const flattened = flattenManagedToolParams(params);
      const sectionId = pickFirstNonEmptyString(flattened, [
        "sectionId",
        "itemId",
        "id",
      ]);

      return {
        name:
          action === "create"
            ? "create_moodboard_section"
            : action === "update"
              ? "update_moodboard_section"
              : "delete_moodboard_section",
        params: {
          ...flattened,
          ...(sectionId ? { sectionId } : {}),
        },
      };
    }

    default:
      return call;
  }
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeNumericString(value: string): string | undefined {
  const trimmed = value.trim();
  if (!/^-?\d[\d\s.,]*$/.test(trimmed)) return undefined;

  let numeric = trimmed.replace(/\s+/g, "");
  const commaCount = (numeric.match(/,/g) ?? []).length;
  const dotCount = (numeric.match(/\./g) ?? []).length;

  if (commaCount > 0 && dotCount > 0) {
    if (numeric.lastIndexOf(",") > numeric.lastIndexOf(".")) {
      numeric = numeric.replace(/\./g, "").replace(",", ".");
    } else {
      numeric = numeric.replace(/,/g, "");
    }
  } else if (commaCount > 0) {
    if (commaCount > 1) {
      numeric = numeric.replace(/,/g, "");
    } else {
      const [left, right] = numeric.split(",");
      numeric =
        right && right.length !== 3
          ? `${left}.${right}`
          : `${left}${right ?? ""}`;
    }
  } else if (dotCount > 1) {
    numeric = numeric.replace(/\./g, "");
  } else if (dotCount === 1) {
    const [left, right] = numeric.split(".");
    if (right && right.length === 3) {
      numeric = `${left}${right}`;
    }
  }

  return numeric;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(normalizeNumericString(value) ?? value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .map((entry) => asNonEmptyString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return normalized.length > 0 ? normalized : undefined;
}

function asTaskStatus(
  value: unknown,
): "todo" | "in_progress" | "review" | "done" | undefined {
  if (
    value === "todo" ||
    value === "in_progress" ||
    value === "review" ||
    value === "done"
  ) {
    return value;
  }
  return undefined;
}

function asPaymentStatus(
  value: unknown,
): "draft" | "open" | "paid" | "void" | "uncollectible" | undefined {
  if (
    value === "draft" ||
    value === "open" ||
    value === "paid" ||
    value === "void" ||
    value === "uncollectible"
  ) {
    return value;
  }
  return undefined;
}

function asTaskPriority(
  value: unknown,
): "low" | "medium" | "high" | "urgent" | undefined {
  if (
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "urgent"
  ) {
    return value;
  }
  return undefined;
}

function asShoppingSetStatus(
  value: unknown,
): "draft" | "active" | "resolved" | "archived" | undefined {
  if (
    value === "draft" ||
    value === "active" ||
    value === "resolved" ||
    value === "archived"
  ) {
    return value;
  }
  return undefined;
}

function asShoppingSetType(
  value: unknown,
): "variant" | "bundle" | "reference" | undefined {
  if (value === "variant" || value === "bundle" || value === "reference") {
    return value;
  }
  return undefined;
}

function asShoppingSetSelectionMode(
  value: unknown,
): "single" | "multiple" | "none" | undefined {
  if (value === "single" || value === "multiple" || value === "none") {
    return value;
  }
  return undefined;
}

function asShoppingSetPricingMode(
  value: unknown,
): "selected_only" | "all_selected" | "none" | undefined {
  if (
    value === "selected_only" ||
    value === "all_selected" ||
    value === "none"
  ) {
    return value;
  }
  return undefined;
}

function asTimestamp(value: unknown): number | undefined {
  const text = asNonEmptyString(value);
  if (text) {
    const parsed = Date.parse(text);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return asNumber(value);
}

function asDateInput(value: unknown): string | undefined {
  const text = asNonEmptyString(value);
  if (text) {
    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? text : undefined;
  }

  const timestamp = asNumber(value);
  if (timestamp === undefined) return undefined;
  return new Date(timestamp).toISOString();
}

function formatTimestampAsIso(
  timestamp: number | undefined,
): string | undefined {
  if (timestamp === undefined || !Number.isFinite(timestamp)) {
    return undefined;
  }

  return new Date(timestamp).toISOString();
}

function extractTaskTitle(params: Record<string, unknown>): string | undefined {
  return (
    asNonEmptyString(params.title) ??
    asNonEmptyString(params.taskTitle) ??
    asNonEmptyString(params.name)
  );
}

function extractNoteTitle(params: Record<string, unknown>): string | undefined {
  return (
    asNonEmptyString(params.title) ??
    asNonEmptyString(params.name) ??
    asNonEmptyString(params.subject)
  );
}

function extractContactName(
  params: Record<string, unknown>,
): string | undefined {
  return (
    asNonEmptyString(params.name) ??
    asNonEmptyString(params.contactName) ??
    asNonEmptyString(params.title)
  );
}

function extractTaskAssigneeIdentifier(
  params: Record<string, unknown>,
): unknown {
  return (
    params.assignedTo ??
    params.assignee ??
    params.assigneeId ??
    params.assigneeUserId ??
    params.assigneeClerkUserId ??
    params.assignedToUserId ??
    params.assignedToClerkUserId
  );
}

function isClearAssigneeValue(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  return UNASSIGNED_ASSIGNEE_VALUES.has(normalizeLookupValue(value));
}

function hasTaskMutationFields(payload: Record<string, unknown>): boolean {
  return Object.keys(payload).some((key) =>
    TASK_UPDATE_MUTATION_FIELDS.has(key),
  );
}

function extractShoppingName(
  params: Record<string, unknown>,
): string | undefined {
  return (
    asNonEmptyString(params.name) ??
    asNonEmptyString(params.productName) ??
    asNonEmptyString(params.selectedItemName) ??
    asNonEmptyString(params.itemName) ??
    asNonEmptyString(params.title)
  );
}

function extractLaborName(params: Record<string, unknown>): string | undefined {
  return (
    asNonEmptyString(params.name) ??
    asNonEmptyString(params.itemName) ??
    asNonEmptyString(params.workName) ??
    asNonEmptyString(params.workDescription) ??
    asNonEmptyString(params.title)
  );
}

function extractSectionName(
  params: Record<string, unknown>,
): string | undefined {
  return (
    asNonEmptyString(params.name) ??
    asNonEmptyString(params.sectionName) ??
    asNonEmptyString(params.section) ??
    asNonEmptyString(params.sectionTitle) ??
    asNonEmptyString(params.title)
  );
}

function joinNotes(...parts: Array<string | undefined>): string | undefined {
  const normalized = parts
    .map((part) => asNonEmptyString(part))
    .filter((part): part is string => Boolean(part));

  if (normalized.length === 0) return undefined;
  return normalized.join("\n");
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim().length > 0) return error;
  return "Unknown client tool error.";
}

function truncate(
  value: string | undefined,
  maxLength = 160,
): string | undefined {
  if (!value) return undefined;
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 1)}...`
    : value;
}

function summarizeTask(task: Record<string, unknown>) {
  const startDate = asNumber(task.startDate);
  const endDate = asNumber(task.endDate);
  return {
    id: typeof task._id === "string" ? task._id : undefined,
    title:
      asNonEmptyString(task.title) ??
      asNonEmptyString(task.name) ??
      asNonEmptyString(task.description) ??
      "Untitled task",
    status: asNonEmptyString(task.status) ?? "todo",
    priority: asNonEmptyString(task.priority) ?? "medium",
    assignedTo: asNonEmptyString(task.assignedTo),
    startDateIso: formatTimestampAsIso(startDate),
    endDateIso: formatTimestampAsIso(endDate),
    sectionId: asNonEmptyString(task.sectionId),
    description: truncate(
      asNonEmptyString(task.description) ?? asNonEmptyString(task.content),
    ),
  };
}

function summarizeNote(note: Record<string, unknown>) {
  return {
    id: typeof note._id === "string" ? note._id : undefined,
    title: asNonEmptyString(note.title) ?? "Untitled note",
    excerpt: truncate(
      asNonEmptyString(note.content) ?? asNonEmptyString(note.description),
    ),
  };
}

function summarizePayment(payment: Record<string, unknown>) {
  return {
    id: typeof payment._id === "string" ? payment._id : undefined,
    title:
      asNonEmptyString(payment.title) ??
      asNonEmptyString(payment.invoiceNumber) ??
      "Untitled invoice",
    description: truncate(asNonEmptyString(payment.description)),
    amount: asNumber(payment.amount),
    status: asNonEmptyString(payment.status) ?? "draft",
    dueDate: asNumber(payment.dueDate),
    invoiceNumber:
      asNonEmptyString(payment.invoiceNumber) ??
      asNonEmptyString(payment.stripeInvoiceNumber),
    hostedInvoiceUrl: asNonEmptyString(payment.stripeHostedInvoiceUrl),
  };
}

function summarizeShoppingItem(
  item: Record<string, unknown>,
  options?: { sectionNameById?: Map<string, string> },
) {
  const sectionId = asNonEmptyString(item.sectionId);
  const buyBefore = asNumber(item.buyBefore);
  return {
    id: typeof item._id === "string" ? item._id : undefined,
    name: asNonEmptyString(item.name) ?? "Unnamed item",
    quantity: asNumber(item.quantity) ?? 1,
    priority: asNonEmptyString(item.priority) ?? "medium",
    status: asNonEmptyString(item.realizationStatus) ?? "PLANNED",
    supplier: asNonEmptyString(item.supplier),
    assignedTo: asNonEmptyString(item.assignedTo),
    unitPrice: asNumber(item.unitPrice),
    productLink: asNonEmptyString(item.productLink),
    buyBefore,
    buyBeforeIso: formatTimestampAsIso(buyBefore),
    sectionId,
    sectionName: sectionId
      ? options?.sectionNameById?.get(sectionId)
      : undefined,
    setId: asNonEmptyString(item.setId),
    setTitle: asNonEmptyString(item.setTitle),
    notes: truncate(asNonEmptyString(item.notes)),
  };
}

function summarizeShoppingSection(
  section: Record<string, unknown>,
  options?: { itemCountBySectionId?: Map<string, number> },
) {
  const id = typeof section._id === "string" ? section._id : undefined;
  const itemCount = id ? (options?.itemCountBySectionId?.get(id) ?? 0) : 0;
  return {
    id,
    name: asNonEmptyString(section.name) ?? "Untitled section",
    order: asNumber(section.order),
    itemCount,
    isEmpty: itemCount === 0,
  };
}

function summarizeContact(contact: Record<string, unknown>) {
  return {
    id: typeof contact._id === "string" ? contact._id : undefined,
    name: asNonEmptyString(contact.name) ?? "Unnamed contact",
    companyName: asNonEmptyString(contact.companyName),
    email: asNonEmptyString(contact.email),
    phone: asNonEmptyString(contact.phone),
    specialization: asNonEmptyString(contact.specialization),
  };
}

function summarizeLaborItem(
  item: Record<string, unknown>,
  options?: { sectionNameById?: Map<string, string> },
) {
  const sectionId = asNonEmptyString(item.sectionId);
  const startDate = asNumber(item.startDate);
  const endDate = asNumber(item.endDate);
  return {
    id: typeof item._id === "string" ? item._id : undefined,
    name: asNonEmptyString(item.name) ?? "Unnamed labor item",
    quantity: asNumber(item.quantity) ?? 1,
    unit: asNonEmptyString(item.unit) ?? "item",
    assignedTo: asNonEmptyString(item.assignedTo),
    unitPrice: asNumber(item.unitPrice),
    totalPrice: asNumber(item.totalPrice),
    sectionId,
    sectionName: sectionId
      ? options?.sectionNameById?.get(sectionId)
      : undefined,
    startDate,
    startDateIso: formatTimestampAsIso(startDate),
    endDate,
    endDateIso: formatTimestampAsIso(endDate),
    notes: truncate(asNonEmptyString(item.notes)),
  };
}

function summarizeLaborSection(
  section: Record<string, unknown>,
  options?: { itemCountBySectionId?: Map<string, number> },
) {
  const id = typeof section._id === "string" ? section._id : undefined;
  const itemCount = id ? (options?.itemCountBySectionId?.get(id) ?? 0) : 0;
  return {
    id,
    name: asNonEmptyString(section.name) ?? "Untitled section",
    color: asNonEmptyString(section.color),
    order: asNumber(section.order),
    itemCount,
    isEmpty: itemCount === 0,
  };
}

function summarizeSurvey(survey: Record<string, unknown>) {
  const questions = Array.isArray(survey.questions) ? survey.questions : [];

  return {
    id: typeof survey._id === "string" ? survey._id : undefined,
    title: asNonEmptyString(survey.title) ?? "Untitled survey",
    description: truncate(asNonEmptyString(survey.description)),
    status: asNonEmptyString(survey.status) ?? "draft",
    isRequired: asBoolean(survey.isRequired) ?? false,
    questionCount: questions.length,
  };
}

function summarizeMoodboardSection(
  section: Record<string, unknown>,
  options?: { imageCountBySectionId?: Map<string, number> },
) {
  const id =
    asNonEmptyString(section.id) ??
    asNonEmptyString(section.sectionId) ??
    asNonEmptyString(section._id);
  const imageCount = id ? (options?.imageCountBySectionId?.get(id) ?? 0) : 0;

  return {
    id,
    title:
      asNonEmptyString(section.title) ??
      asNonEmptyString(section.name) ??
      id ??
      "Untitled moodboard section",
    order: asNumber(section.order),
    imageCount,
    isEmpty: imageCount === 0,
  };
}

function summarizeMoodboardImage(
  image: Record<string, unknown>,
  options?: { sectionTitleById?: Map<string, string> },
) {
  const sectionId =
    asNonEmptyString(image.sectionId) ??
    asNonEmptyString(image.moodboardSection);
  return {
    id:
      asNonEmptyString(image.id) ??
      asNonEmptyString(image.storageId) ??
      asNonEmptyString(image._id),
    name: asNonEmptyString(image.name) ?? "Untitled moodboard image",
    sectionId,
    sectionTitle:
      asNonEmptyString(image.sectionTitle) ??
      (sectionId ? options?.sectionTitleById?.get(sectionId) : undefined),
    createdAt: asNumber(image._creationTime) ?? asNumber(image.createdAt),
    imageUrl: asNonEmptyString(image.imageUrl) ?? asNonEmptyString(image.url),
    url: asNonEmptyString(image.url),
  };
}

function summarizeProjectFile(file: Record<string, unknown>) {
  return {
    id: typeof file._id === "string" ? file._id : undefined,
    name: asNonEmptyString(file.name) ?? "Untitled file",
    description: truncate(asNonEmptyString(file.description)),
    fileType: asNonEmptyString(file.fileType) ?? "other",
    mimeType: asNonEmptyString(file.mimeType),
    size: asNumber(file.size),
    aiKnowledgeStatus: asNonEmptyString(file.aiKnowledgeStatus) ?? "ready",
    excerpt: truncate(asNonEmptyString(file.excerpt), 320),
    matchScore: asNumber(file.score),
    extractedText: truncate(asNonEmptyString(file.extractedText), 220),
    pdfAnalysis: truncate(asNonEmptyString(file.pdfAnalysis), 220),
    url: asNonEmptyString(file.url),
  };
}

function summarizeProject(project: Record<string, unknown> | null) {
  if (!project) return null;

  const startDate = asNumber(project.startDate);
  const endDate = asNumber(project.endDate);

  return {
    id: typeof project._id === "string" ? project._id : undefined,
    title:
      asNonEmptyString(project.name) ??
      asNonEmptyString(project.title) ??
      "Project",
    description: truncate(asNonEmptyString(project.description)),
    status: asNonEmptyString(project.status),
    address: asNonEmptyString(project.address),
    startDate,
    startDateIso: formatTimestampAsIso(startDate),
    endDate,
    endDateIso: formatTimestampAsIso(endDate),
    budget: asNumber(project.budget),
  };
}

function validateTaskToolFields(
  params: Record<string, unknown>,
  action: string,
): string | null {
  const invalidDate =
    invalidProvidedDate(params, "startDate", asTimestamp) ??
    invalidProvidedDate(params, "endDate", asTimestamp);
  if (invalidDate) return `Invalid ${invalidDate} for ${action}.`;
  if (invalidProvidedValue(params, "status", asTaskStatus)) {
    return `Invalid status for ${action}.`;
  }
  if (invalidProvidedValue(params, "priority", asTaskPriority)) {
    return `Invalid priority for ${action}.`;
  }
  return null;
}

function validateShoppingItemToolFields(
  params: Record<string, unknown>,
  action: string,
): string | null {
  if (invalidProvidedDate(params, "buyBefore", asTimestamp)) {
    return `Invalid buyBefore for ${action}.`;
  }
  if (invalidProvidedValue(params, "priority", asTaskPriority)) {
    return `Invalid priority for ${action}.`;
  }
  if (
    (hasOwnValue(params, "status") ||
      hasOwnValue(params, "realizationStatus")) &&
    extractShoppingRealizationStatus(params) === undefined
  ) {
    return `Invalid realizationStatus/status for ${action}.`;
  }
  return null;
}

function validateLaborItemToolFields(
  params: Record<string, unknown>,
  action: string,
): string | null {
  const invalidDate =
    invalidProvidedDate(params, "startDate", asDateInput) ??
    invalidProvidedDate(params, "endDate", asDateInput);
  return invalidDate ? `Invalid ${invalidDate} for ${action}.` : null;
}

function validateShoppingSetToolFields(
  params: Record<string, unknown>,
  action: string,
): string | null {
  const invalidField =
    invalidProvidedValue(params, "status", asShoppingSetStatus) ??
    invalidProvidedValue(params, "setType", asShoppingSetType) ??
    invalidProvidedValue(params, "selectionMode", asShoppingSetSelectionMode) ??
    invalidProvidedValue(params, "pricingMode", asShoppingSetPricingMode);
  return invalidField ? `Invalid ${invalidField} for ${action}.` : null;
}

export function useChatKitClientTools(args: UseChatKitClientToolsArgs | null) {
  const convex = useConvex();
  const projectId = args?.projectId;
  const teamId = args?.teamId;
  const teamSlug = args?.teamSlug;
  const userClerkId = args?.userClerkId;
  const timezone = args?.timezone || "Europe/Warsaw";
  const canMakeChanges = args?.canMakeChanges ?? false;

  return useCallback(
    async (call: ToolCall): Promise<Record<string, unknown>> => {
      const normalizedCall = normalizeClientToolCall(call);
      if ("error" in normalizedCall) {
        return {
          ok: false,
          tool: call.name,
          error: normalizedCall.error,
        };
      }

      const { name, params } = normalizedCall;

      if (!projectId || !teamId || !teamSlug) {
        return {
          ok: false,
          tool: name,
          error: "Project context is not ready yet.",
        };
      }

      if (!canMakeChanges && !READ_ONLY_TOOL_NAMES.has(name)) {
        return {
          ok: false,
          tool: name,
          error:
            "Changes are disabled in this chat. Switch on 'Can make changes' to run editing tools.",
        };
      }

      const getTeamMembers = async (): Promise<TeamMemberRecord[]> => {
        const result = await convex.query(apiAny.teams.getTeamMembers, {
          teamId,
        });
        return Array.isArray(result)
          ? result.map((entry) => ({
              clerkUserId: asNonEmptyString(
                (entry as Record<string, unknown>).clerkUserId,
              ),
              name: asNonEmptyString((entry as Record<string, unknown>).name),
              email: asNonEmptyString((entry as Record<string, unknown>).email),
              role: asNonEmptyString((entry as Record<string, unknown>).role),
              isActive:
                typeof (entry as Record<string, unknown>).isActive === "boolean"
                  ? ((entry as Record<string, unknown>).isActive as boolean)
                  : undefined,
            }))
          : [];
      };

      const resolveTeamAssignee = async (
        value: unknown,
      ): Promise<string | null | undefined> => {
        if (isClearAssigneeValue(value)) return null;
        const assignee = asNonEmptyString(value);
        if (assignee === undefined) return undefined;

        const teamMembers = await getTeamMembers();
        const resolved = resolveAssigneeFromTeamMembers(
          assignee,
          teamMembers,
          userClerkId,
        );
        return resolved;
      };

      let shoppingSectionsPromise: Promise<
        Array<Record<string, unknown>>
      > | null = null;
      let laborSectionsPromise: Promise<Array<Record<string, unknown>>> | null =
        null;

      const getShoppingSections = async (): Promise<
        Array<Record<string, unknown>>
      > => {
        if (!shoppingSectionsPromise) {
          shoppingSectionsPromise = convex.query(
            apiAny.shopping.listShoppingListSections,
            { projectId },
          ) as Promise<Array<Record<string, unknown>>>;
        }
        return shoppingSectionsPromise;
      };

      const getLaborSections = async (): Promise<
        Array<Record<string, unknown>>
      > => {
        if (!laborSectionsPromise) {
          laborSectionsPromise = convex.query(apiAny.labor.listLaborSections, {
            projectId,
          }) as Promise<Array<Record<string, unknown>>>;
        }
        return laborSectionsPromise;
      };

      const resolveSectionId = async (
        domain: "shopping" | "labor",
        params: Record<string, unknown>,
        options?: { createIfMissing?: boolean },
      ): Promise<string | null | undefined> => {
        if (params.sectionId === null) {
          return null;
        }

        const explicitSectionId = asNonEmptyString(params.sectionId);
        if (explicitSectionId !== undefined) {
          return explicitSectionId;
        }

        const sectionName = extractSectionName(params);
        if (sectionName === undefined) {
          return undefined;
        }

        const sections =
          domain === "shopping"
            ? await getShoppingSections()
            : await getLaborSections();
        const normalizedSectionName = normalizeLookupValue(sectionName);
        const existingSection = sections.find((section) => {
          const existingName = asNonEmptyString(section.name);
          return (
            existingName !== undefined &&
            normalizeLookupValue(existingName) === normalizedSectionName
          );
        });

        const existingSectionId =
          existingSection && typeof existingSection._id === "string"
            ? existingSection._id
            : undefined;
        if (existingSectionId) {
          return existingSectionId;
        }

        if (options?.createIfMissing === false) {
          throw new Error(
            `Could not find ${domain} section "${sectionName}". Create the section first or use an existing section name.`,
          );
        }

        const createResult =
          domain === "shopping"
            ? await convex.action(
                apiAny.ai.confirmedActions.createConfirmedShoppingSection,
                {
                  projectId,
                  sectionData: { name: sectionName },
                },
              )
            : await convex.action(
                apiAny.ai.confirmedActions.createConfirmedLaborSection,
                {
                  projectId,
                  sectionData: { name: sectionName },
                },
              );

        const createdSectionId = asNonEmptyString(
          asRecord(createResult).sectionId,
        );
        if (!createdSectionId) {
          throw new Error(
            `Could not create ${domain} section "${sectionName}".`,
          );
        }

        if (domain === "shopping") {
          shoppingSectionsPromise = null;
        } else {
          laborSectionsPromise = null;
        }

        return createdSectionId;
      };

      const resolveSurveyId = async (
        params: Record<string, unknown>,
      ): Promise<string | undefined> => {
        const explicitSurveyId =
          asNonEmptyString(params.surveyId) ??
          asNonEmptyString(params.itemId) ??
          asNonEmptyString(params.id);
        if (explicitSurveyId) {
          return explicitSurveyId;
        }

        const requestedTitle =
          asNonEmptyString(params.surveyTitle) ??
          asNonEmptyString(params.title) ??
          asNonEmptyString(params.name);
        if (!requestedTitle) {
          return undefined;
        }

        const surveys = (await convex.query(
          apiAny.surveys.getSurveysByProject,
          {
            projectId,
          },
        )) as Array<Record<string, unknown>>;
        const normalizedRequestedTitle = normalizeLookupValue(requestedTitle);
        const matches = surveys.filter((survey) => {
          const title = asNonEmptyString(survey.title);
          return (
            title && normalizeLookupValue(title) === normalizedRequestedTitle
          );
        });
        if (matches.length === 1) {
          return asNonEmptyString(matches[0]?._id);
        }

        const looseMatches = surveys.filter((survey) => {
          const title = asNonEmptyString(survey.title);
          return (
            title &&
            normalizeLookupValue(title).includes(normalizedRequestedTitle)
          );
        });
        if (looseMatches.length === 1) {
          return asNonEmptyString(looseMatches[0]?._id);
        }

        return undefined;
      };

      const runBulk = async (
        items: Record<string, unknown>[],
        label: string,
        executor: (
          item: Record<string, unknown>,
          index: number,
        ) => Promise<Record<string, unknown>>,
      ): Promise<Record<string, unknown>> => {
        if (items.length === 0) {
          return {
            ok: false,
            error: `No items were provided for ${label}.`,
          };
        }

        const results: Array<Record<string, unknown> | undefined> = new Array(
          items.length,
        );
        let nextIndex = 0;
        let firstFailure: BulkFailure | null = null;
        const getFirstFailure = () => firstFailure;
        const startedAt = performance.now();

        const runNext = async (): Promise<void> => {
          while (!firstFailure) {
            const index = nextIndex;
            nextIndex += 1;

            if (index >= items.length) {
              return;
            }

            if (items[index]?.__invalidBulkItem === true) {
              firstFailure = {
                index,
                error: `${label} failed at item ${index + 1}: item must be an object with editable fields.`,
              };
              return;
            }

            const result = await executor(items[index] ?? {}, index);
            if (!result.ok) {
              firstFailure = {
                index,
                error:
                  asNonEmptyString(result.error) ??
                  `${label} failed at item ${index + 1}.`,
              };
              return;
            }

            results[index] = result;
          }
        };

        await Promise.all(
          Array.from(
            { length: Math.min(BULK_TOOL_CONCURRENCY, items.length) },
            () => runNext(),
          ),
        );

        const failure = getFirstFailure();
        const completedResults = results.filter(
          (result): result is Record<string, unknown> => Boolean(result),
        );

        if (failure) {
          return {
            ok: false,
            partialSuccess: completedResults.length > 0,
            succeededCount: completedResults.length,
            failedIndex: failure.index + 1,
            error: failure.error,
            results: completedResults,
          };
        }

        const durationMs = Math.round(performance.now() - startedAt);

        return {
          ok: true,
          count: completedResults.length,
          durationMs,
          results: completedResults,
          message: `${label} completed for ${completedResults.length} item${completedResults.length === 1 ? "" : "s"}.`,
        };
      };

      try {
        switch (name) {
          case "get_runtime_capabilities": {
            return {
              ok: true,
              canMakeChanges,
              currentUserClerkId: userClerkId ?? null,
              session: buildRuntimeSessionContext({
                userClerkId,
                teamId,
                projectId,
                timezone,
              }),
              mode: canMakeChanges ? "read_write" : "read_only",
              allowedTools: canMakeChanges
                ? [
                    "get_runtime_capabilities",
                    "load_full_project_context",
                    "search_items",
                    "scrape_shopping_product",
                    "manage_tasks",
                    "manage_notes",
                    "manage_contacts",
                    "manage_payments",
                    "manage_shopping",
                    "manage_labor",
                    "manage_surveys",
                    "manage_moodboard",
                    "update_project_settings",
                    "generate_moodboard_image",
                  ]
                : [
                    "get_runtime_capabilities",
                    "load_full_project_context",
                    "search_items",
                    "scrape_shopping_product",
                  ],
              blockedReason: canMakeChanges
                ? null
                : "Changes are disabled in this chat until the user enables 'Can make changes'.",
            };
          }

          case "scrape_shopping_product": {
            const url =
              asNonEmptyString(params.url) ??
              asNonEmptyString(params.productLink) ??
              asNonEmptyString(params.link);

            if (!url) {
              return {
                ok: false,
                error: "Missing required `url` for scrape_shopping_product.",
              };
            }

            const response = await fetch(
              `/api/shopping/scrape?url=${encodeURIComponent(url)}&projectId=${encodeURIComponent(projectId)}&teamId=${encodeURIComponent(teamId)}`,
              {
                method: "GET",
              },
            );
            const payload = (await response.json().catch(() => ({}))) as Record<
              string,
              unknown
            >;

            if (!response.ok) {
              return {
                ok: false,
                url,
                error:
                  asNonEmptyString(payload.message) ??
                  "Failed to scrape product details from the provided URL.",
              };
            }

            return {
              ok: true,
              url,
              name: asNonEmptyString(payload.name),
              supplier: asNonEmptyString(payload.supplier),
              category: asNonEmptyString(payload.category),
              catalogNumber: asNonEmptyString(payload.catalogNumber),
              dimensions: asNonEmptyString(payload.dimensions),
              unitPrice: asNumber(payload.unitPrice),
              currency: asNonEmptyString(payload.currency),
              imageUrl: asNonEmptyString(payload.imageUrl),
              productLink: asNonEmptyString(payload.productLink) ?? url,
              notes: asNonEmptyString(payload.notes),
              message: asNonEmptyString(payload.name)
                ? `Scraped product details for ${payload.name as string}.`
                : "Scraped product details from the provided URL.",
            };
          }

          case "bulk_create_tasks": {
            const items = asRecordArray(params.items);
            return runBulk(items, "Bulk task creation", async (item) => {
              const title = extractTaskTitle(item);
              if (!title) {
                return {
                  ok: false,
                  error: "Missing required `title` for a bulk-created task.",
                };
              }
              const validationError = validateTaskToolFields(
                item,
                "bulk_create_tasks",
              );
              if (validationError) {
                return { ok: false, error: validationError };
              }

              const assigneeInput = extractTaskAssigneeIdentifier(item);
              const assignedTo = await resolveTeamAssignee(assigneeInput);
              if (assigneeInput && assignedTo === null && !isClearAssigneeValue(assigneeInput)) {
                return {
                  ok: false,
                  error:
                    "Could not match `assignedTo` to a team member. Use an exact team member name, email, Clerk ID, or say 'assign to me'.",
                };
              }

              const taskId = await convex.mutation(apiAny.tasks.createTask, {
                title,
                projectId,
                teamId,
                description: asNonEmptyString(item.description),
                content: asNonEmptyString(item.content),
                status: asTaskStatus(item.status) ?? "todo",
                priority: asTaskPriority(item.priority) ?? "medium",
                assignedTo: assignedTo ?? undefined,
                startDate: asTimestamp(item.startDate),
                endDate: asTimestamp(item.endDate),
                tags: asStringArray(item.tags) ?? [],
                sectionId: asNonEmptyString(item.sectionId) ?? null,
              });

              return { ok: true, taskId, title };
            });
          }

          case "bulk_update_tasks": {
            const items = asRecordArray(params.items);
            return runBulk(items, "Bulk task update", async (item) => {
              const taskId =
                asNonEmptyString(item.taskId) ?? asNonEmptyString(item.id);
              if (!taskId) {
                return {
                  ok: false,
                  error: "Missing required `taskId` for a bulk task update.",
                };
              }
              const validationError = validateTaskToolFields(
                item,
                "bulk_update_tasks",
              );
              if (validationError) {
                return { ok: false, error: validationError };
              }

              const updates: Record<string, unknown> = { taskId };
              const title = extractTaskTitle(item);
              if (title) updates.title = title;

              const description = asNonEmptyString(item.description);
              if (description !== undefined) updates.description = description;

              const content = asNonEmptyString(item.content);
              if (content !== undefined) updates.content = content;

              const status = asTaskStatus(item.status);
              if (status !== undefined) updates.status = status;

              const priority = asTaskPriority(item.priority);
              if (priority !== undefined) updates.priority = priority;

              const assigneeInput = extractTaskAssigneeIdentifier(item);
              const assignedTo = await resolveTeamAssignee(assigneeInput);
              if (assigneeInput && assignedTo === null && !isClearAssigneeValue(assigneeInput)) {
                return {
                  ok: false,
                  error:
                    "Could not match `assignedTo` to a team member. Use an exact team member name, email, Clerk ID, or say 'assign to me'.",
                };
              }
              if (assignedTo !== undefined) updates.assignedTo = assignedTo;

              const startDate = asTimestamp(item.startDate);
              if (startDate !== undefined) updates.startDate = startDate;

              const endDate = asTimestamp(item.endDate);
              if (endDate !== undefined) updates.endDate = endDate;

              const tags = asStringArray(item.tags);
              if (tags !== undefined) updates.tags = tags;

              if (!hasTaskMutationFields(updates)) {
                return {
                  ok: false,
                  error:
                    "No valid task update fields were provided. Use at least one of: title, description, content, status, priority, assignedTo (or assignee), startDate, endDate, tags.",
                };
              }

              await convex.mutation(apiAny.tasks.updateTask, updates);
              return { ok: true, taskId };
            });
          }

          case "bulk_delete_tasks": {
            const items = asRecordArray(params.items);
            return runBulk(items, "Bulk task delete", async (item) => {
              const taskId =
                asNonEmptyString(item.taskId) ?? asNonEmptyString(item.id);
              if (!taskId) {
                return {
                  ok: false,
                  error: "Missing required `taskId` for a bulk task delete.",
                };
              }

              await convex.mutation(apiAny.tasks.deleteTask, { taskId });
              return { ok: true, taskId };
            });
          }

          case "bulk_create_notes": {
            const items = asRecordArray(params.items);
            return runBulk(items, "Bulk note creation", async (item) => {
              const title = extractNoteTitle(item);
              const content =
                asNonEmptyString(item.content) ??
                asNonEmptyString(item.description) ??
                title;

              if (!title || !content) {
                return {
                  ok: false,
                  error:
                    "Missing required `title` or `content` for a bulk-created note.",
                };
              }

              const noteId = await convex.mutation(apiAny.notes.createNote, {
                projectId,
                title,
                content,
              });

              return { ok: true, noteId, title };
            });
          }

          case "bulk_update_notes": {
            const items = asRecordArray(params.items);
            return runBulk(items, "Bulk note update", async (item) => {
              const noteId =
                asNonEmptyString(item.noteId) ?? asNonEmptyString(item.id);
              if (!noteId) {
                return {
                  ok: false,
                  error: "Missing required `noteId` for a bulk note update.",
                };
              }

              const existingNote = await convex.query(apiAny.notes.getNote, {
                noteId,
              });
              if (!existingNote) {
                return { ok: false, error: "Note not found." };
              }

              const title =
                extractNoteTitle(item) ??
                asNonEmptyString(existingNote.title) ??
                "Untitled note";
              const content =
                asNonEmptyString(item.content) ??
                asNonEmptyString(item.description) ??
                asNonEmptyString(existingNote.content) ??
                "";

              await convex.mutation(apiAny.notes.updateNote, {
                noteId,
                title,
                content,
              });

              return { ok: true, noteId };
            });
          }

          case "bulk_delete_notes": {
            const items = asRecordArray(params.items);
            return runBulk(items, "Bulk note delete", async (item) => {
              const noteId =
                asNonEmptyString(item.noteId) ?? asNonEmptyString(item.id);
              if (!noteId) {
                return {
                  ok: false,
                  error: "Missing required `noteId` for a bulk note delete.",
                };
              }

              await convex.mutation(apiAny.notes.deleteNote, { noteId });
              return { ok: true, noteId };
            });
          }

          case "bulk_create_contacts": {
            const items = asRecordArray(params.items);
            return runBulk(items, "Bulk contact creation", async (item) => {
              const name = extractContactName(item);
              if (!name) {
                return {
                  ok: false,
                  error: "Missing required `name` for a bulk-created contact.",
                };
              }

              const contactId = await convex.mutation(
                apiAny.contacts.createContact,
                {
                  teamSlug,
                  name,
                  companyName: asNonEmptyString(item.companyName),
                  email: asNonEmptyString(item.email),
                  phone: asNonEmptyString(item.phone),
                  address: asNonEmptyString(item.address),
                  city: asNonEmptyString(item.city),
                  postalCode: asNonEmptyString(item.postalCode),
                  website: asNonEmptyString(item.website),
                  taxId: asNonEmptyString(item.taxId),
                  type: asNonEmptyString(item.type) ?? "other",
                  notes: asNonEmptyString(item.notes),
                },
              );

              return { ok: true, contactId, name };
            });
          }

          case "bulk_update_contacts": {
            const items = asRecordArray(params.items);
            return runBulk(items, "Bulk contact update", async (item) => {
              const contactId =
                asNonEmptyString(item.contactId) ?? asNonEmptyString(item.id);
              if (!contactId) {
                return {
                  ok: false,
                  error:
                    "Missing required `contactId` for a bulk contact update.",
                };
              }

              const existingContact = await convex.query(
                apiAny.contacts.getContact,
                {
                  contactId,
                },
              );
              if (!existingContact) {
                return { ok: false, error: "Contact not found." };
              }

              await convex.mutation(apiAny.contacts.updateContact, {
                contactId,
                name:
                  extractContactName(item) ??
                  asNonEmptyString(existingContact.name) ??
                  "Unnamed contact",
                companyName:
                  asNonEmptyString(item.companyName) ??
                  asNonEmptyString(existingContact.companyName),
                email:
                  asNonEmptyString(item.email) ??
                  asNonEmptyString(existingContact.email),
                phone:
                  asNonEmptyString(item.phone) ??
                  asNonEmptyString(existingContact.phone),
                address:
                  asNonEmptyString(item.address) ??
                  asNonEmptyString(existingContact.address),
                city:
                  asNonEmptyString(item.city) ??
                  asNonEmptyString(existingContact.city),
                postalCode:
                  asNonEmptyString(item.postalCode) ??
                  asNonEmptyString(existingContact.postalCode),
                website:
                  asNonEmptyString(item.website) ??
                  asNonEmptyString(existingContact.website),
                taxId:
                  asNonEmptyString(item.taxId) ??
                  asNonEmptyString(existingContact.taxId),
                type:
                  asNonEmptyString(item.type) ??
                  asNonEmptyString(existingContact.type) ??
                  "other",
                notes:
                  asNonEmptyString(item.notes) ??
                  asNonEmptyString(existingContact.notes),
              });

              return { ok: true, contactId };
            });
          }

          case "bulk_delete_contacts": {
            const items = asRecordArray(params.items);
            return runBulk(items, "Bulk contact delete", async (item) => {
              const contactId =
                asNonEmptyString(item.contactId) ?? asNonEmptyString(item.id);
              if (!contactId) {
                return {
                  ok: false,
                  error:
                    "Missing required `contactId` for a bulk contact delete.",
                };
              }

              await convex.mutation(apiAny.contacts.deleteContact, {
                contactId,
              });
              return { ok: true, contactId };
            });
          }

          case "bulk_create_shopping_items": {
            const items = asRecordArray(params.items);
            return runBulk(
              items,
              "Bulk shopping item creation",
              async (item) => {
                const name = extractShoppingName(item);
                if (!name) {
                  return {
                    ok: false,
                    error:
                      "Missing required `name` for a bulk-created shopping item.",
                  };
                }
                const validationError = validateShoppingItemToolFields(
                  item,
                  "bulk_create_shopping_items",
                );
                if (validationError) {
                  return { ok: false, error: validationError };
                }

                const sectionId = await resolveSectionId("shopping", item);
                const imageUrl =
                  asNonEmptyString(item.imageUrl) ??
                  asNonEmptyString(item.productImageUrl) ??
                  asNonEmptyString(item.moodboardImageUrl) ??
                  asNonEmptyString(item.thumbnailUrl) ??
                  asNonEmptyString(item.image) ??
                  (asNonEmptyString(item.sourceType) === "moodboard"
                    ? asNonEmptyString(item.url)
                    : undefined);
                const productLink =
                  asNonEmptyString(item.productLink) ??
                  asNonEmptyString(item.link) ??
                  (imageUrl ? undefined : asNonEmptyString(item.url));
                const assigneeInput = extractTaskAssigneeIdentifier(item);
                const assignedTo = await resolveTeamAssignee(assigneeInput);
                if (assigneeInput && assignedTo === null && !isClearAssigneeValue(assigneeInput)) {
                  return {
                    ok: false,
                    error:
                      "Could not match `assignedTo` to a team member. Use an exact team member name, email, Clerk ID, or say 'assign to me'.",
                  };
                }

                const itemId = await convex.mutation(
                  apiAny.shopping.createShoppingListItem,
                  {
                    projectId,
                    name,
                    quantity: asNumber(item.quantity) ?? 1,
                    unit: asNonEmptyString(item.unit),
                    notes: joinNotes(
                      asNonEmptyString(item.notes),
                      asNonEmptyString(item.storeAddress),
                      asNonEmptyString(item.address),
                      asNonEmptyString(item.selectionReason),
                      asNonEmptyString(item.sourceSummary),
                    ),
                    buyBefore: asTimestamp(item.buyBefore),
                    priority: asTaskPriority(item.priority) ?? "medium",
                    imageUrl,
                    productLink,
                    supplier:
                      asNonEmptyString(item.supplier) ??
                      asNonEmptyString(item.store) ??
                      asNonEmptyString(item.vendor),
                    catalogNumber: asNonEmptyString(item.catalogNumber),
                    category: asNonEmptyString(item.category),
                    dimensions: asNonEmptyString(item.dimensions),
                    unitPrice: asNumber(item.unitPrice) ?? asNumber(item.price),
                    setId: asNonEmptyString(item.setId),
                    realizationStatus:
                      extractShoppingRealizationStatus(item) ?? "PLANNED",
                    sectionId: sectionId ?? null,
                    assignedTo: assignedTo ?? undefined,
                  },
                );

                return { ok: true, itemId, name };
              },
            );
          }

          case "bulk_update_shopping_items": {
            const items = asRecordArray(params.items);
            return runBulk(items, "Bulk shopping item update", async (item) => {
              const itemId =
                asNonEmptyString(item.itemId) ?? asNonEmptyString(item.id);
              if (!itemId) {
                return {
                  ok: false,
                  error:
                    "Missing required `itemId` for a bulk shopping item update.",
                };
              }
              const validationError = validateShoppingItemToolFields(
                item,
                "bulk_update_shopping_items",
              );
              if (validationError) {
                return { ok: false, error: validationError };
              }

              const updates: Record<string, unknown> = { itemId };
              const name = extractShoppingName(item);
              if (name !== undefined) updates.name = name;

              const notes = joinNotes(
                asNonEmptyString(item.notes),
                asNonEmptyString(item.storeAddress),
                asNonEmptyString(item.address),
                asNonEmptyString(item.selectionReason),
                asNonEmptyString(item.sourceSummary),
              );
              if (notes !== undefined) updates.notes = notes;

              const buyBefore = asTimestamp(item.buyBefore);
              if (buyBefore !== undefined) updates.buyBefore = buyBefore;
              const priority = asTaskPriority(item.priority);
              if (priority !== undefined) updates.priority = priority;
              const imageUrl =
                asNonEmptyString(item.imageUrl) ??
                asNonEmptyString(item.productImageUrl) ??
                asNonEmptyString(item.moodboardImageUrl) ??
                asNonEmptyString(item.thumbnailUrl) ??
                asNonEmptyString(item.image);
              if (imageUrl !== undefined) updates.imageUrl = imageUrl;

              const productLink =
                asNonEmptyString(item.productLink) ??
                asNonEmptyString(item.url) ??
                asNonEmptyString(item.link);
              if (productLink !== undefined) updates.productLink = productLink;

              const supplier =
                asNonEmptyString(item.supplier) ??
                asNonEmptyString(item.store) ??
                asNonEmptyString(item.vendor);
              if (supplier !== undefined) updates.supplier = supplier;

              const catalogNumber = asNonEmptyString(item.catalogNumber);
              if (catalogNumber !== undefined)
                updates.catalogNumber = catalogNumber;
              const category = asNonEmptyString(item.category);
              if (category !== undefined) updates.category = category;
              const dimensions = asNonEmptyString(item.dimensions);
              if (dimensions !== undefined) updates.dimensions = dimensions;
              const quantity = asNumber(item.quantity);
              if (quantity !== undefined) updates.quantity = quantity;
              const unit = asNonEmptyString(item.unit);
              if (unit !== undefined) updates.unit = unit;
              const unitPrice =
                asNumber(item.unitPrice) ?? asNumber(item.price);
              if (unitPrice !== undefined) updates.unitPrice = unitPrice;
              if (item.setId === null) {
                updates.setId = null;
              } else {
                const setId = asNonEmptyString(item.setId);
                if (setId !== undefined) {
                  updates.setId = setId;
                }
              }
              const realizationStatus = extractShoppingRealizationStatus(item);
              if (realizationStatus !== undefined) {
                updates.realizationStatus = realizationStatus;
              }
              const sectionId = await resolveSectionId("shopping", item, {
                createIfMissing: false,
              });
              if (sectionId === null) {
                updates.sectionId = null;
              } else if (sectionId !== undefined) {
                updates.sectionId = sectionId;
              }

              const assigneeInput = extractTaskAssigneeIdentifier(item);
              const assignedTo = await resolveTeamAssignee(assigneeInput);
              if (assigneeInput && assignedTo === null && !isClearAssigneeValue(assigneeInput)) {
                return {
                  ok: false,
                  error:
                    "Could not match `assignedTo` to a team member. Use an exact team member name, email, Clerk ID, or say 'assign to me'.",
                };
              }
              if (assignedTo !== undefined) updates.assignedTo = assignedTo;

              if (!hasManagedUpdateFields(updates, ["itemId"])) {
                return {
                  ok: false,
                  error:
                    "No valid shopping item update fields were provided. Use at least one editable field such as notes, quantity, unit, unitPrice, supplier, status or realizationStatus, sectionId, or assignedTo.",
                };
              }

              await convex.mutation(
                apiAny.shopping.updateShoppingListItem,
                updates,
              );
              return { ok: true, itemId };
            });
          }

          case "bulk_delete_shopping_items": {
            const items = asRecordArray(params.items);
            return runBulk(items, "Bulk shopping item delete", async (item) => {
              const itemId =
                asNonEmptyString(item.itemId) ?? asNonEmptyString(item.id);
              if (!itemId) {
                return {
                  ok: false,
                  error:
                    "Missing required `itemId` for a bulk shopping item delete.",
                };
              }

              await convex.mutation(apiAny.shopping.deleteShoppingListItem, {
                itemId,
              });
              return { ok: true, itemId };
            });
          }

          case "bulk_create_shopping_sections": {
            const items = asRecordArray(params.items);
            return runBulk(
              items,
              "Bulk shopping section creation",
              async (item) => {
                const sectionName = extractSectionName(item);
                if (!sectionName) {
                  return {
                    ok: false,
                    error:
                      "Missing required `name` for a bulk-created shopping section.",
                  };
                }

                const result = await convex.action(
                  apiAny.ai.confirmedActions.createConfirmedShoppingSection,
                  {
                    projectId,
                    sectionData: { name: sectionName },
                  },
                );

                return {
                  ...formatConfirmedActionResult(
                    result,
                    `Created shopping section: ${sectionName}`,
                  ),
                  sectionId:
                    typeof result?.sectionId === "string"
                      ? result.sectionId
                      : undefined,
                  name: sectionName,
                };
              },
            );
          }

          case "bulk_update_shopping_sections": {
            const items = asRecordArray(params.items);
            return runBulk(
              items,
              "Bulk shopping section update",
              async (item) => {
                const sectionId =
                  asNonEmptyString(item.sectionId) ?? asNonEmptyString(item.id);
                if (!sectionId) {
                  return {
                    ok: false,
                    error:
                      "Missing required `sectionId` for a bulk shopping section update.",
                  };
                }

                const updates = compactDefinedFields({
                  name: extractSectionName(item),
                });
                if (!hasManagedUpdateFields(updates, [])) {
                  return {
                    ok: false,
                    error:
                      "No valid shopping section update fields were provided. Use at least `name`.",
                  };
                }

                const result = await convex.action(
                  apiAny.ai.confirmedActions.editConfirmedShoppingSection,
                  {
                    sectionId,
                    updates,
                  },
                );

                return {
                  ...formatConfirmedActionResult(
                    result,
                    "Shopping section updated successfully.",
                  ),
                  sectionId,
                };
              },
            );
          }

          case "bulk_delete_shopping_sections": {
            const items = asRecordArray(params.items);
            return runBulk(
              items,
              "Bulk shopping section delete",
              async (item) => {
                const sectionId =
                  asNonEmptyString(item.sectionId) ?? asNonEmptyString(item.id);
                if (!sectionId) {
                  return {
                    ok: false,
                    error:
                      "Missing required `sectionId` for a bulk shopping section delete.",
                  };
                }

                const result = await convex.action(
                  apiAny.ai.confirmedActions.deleteConfirmedShoppingSection,
                  {
                    sectionId,
                  },
                );

                return {
                  ...formatConfirmedActionResult(
                    result,
                    "Shopping section deleted successfully.",
                  ),
                  sectionId,
                };
              },
            );
          }

          case "bulk_create_shopping_sets": {
            const items = asRecordArray(params.items);
            return runBulk(
              items,
              "Bulk shopping set creation",
              async (item) => {
                const title =
                  asNonEmptyString(item.title) ?? asNonEmptyString(item.name);
                if (!title) {
                  return {
                    ok: false,
                    error:
                      "Missing required `title` for a bulk-created shopping set.",
                  };
                }
                const validationError = validateShoppingSetToolFields(
                  item,
                  "bulk_create_shopping_sets",
                );
                if (validationError) {
                  return { ok: false, error: validationError };
                }

                const sectionId = await resolveSectionId("shopping", item);

                const result = await convex.action(
                  apiAny.ai.confirmedActions.createConfirmedShoppingSet,
                  {
                    projectId,
                    setData: {
                      title,
                      notes: asNonEmptyString(item.notes),
                      sectionId: sectionId === null ? undefined : sectionId,
                      setType: asShoppingSetType(item.setType),
                      selectionMode: asShoppingSetSelectionMode(
                        item.selectionMode,
                      ),
                      pricingMode: asShoppingSetPricingMode(item.pricingMode),
                      status: asShoppingSetStatus(item.status),
                    },
                  },
                );

                return {
                  ...formatConfirmedActionResult(
                    result,
                    `Created shopping set: ${title}`,
                  ),
                  setId:
                    typeof result?.setId === "string"
                      ? result.setId
                      : undefined,
                  title,
                };
              },
            );
          }

          case "bulk_update_shopping_sets": {
            const items = asRecordArray(params.items);
            return runBulk(items, "Bulk shopping set update", async (item) => {
              const setId =
                asNonEmptyString(item.setId) ?? asNonEmptyString(item.id);
              if (!setId) {
                return {
                  ok: false,
                  error:
                    "Missing required `setId` for a bulk shopping set update.",
                };
              }
              const validationError = validateShoppingSetToolFields(
                item,
                "bulk_update_shopping_sets",
              );
              if (validationError) {
                return { ok: false, error: validationError };
              }

              const sectionId = await resolveSectionId("shopping", item, {
                createIfMissing: false,
              });

              const updates = compactDefinedFields({
                title:
                  asNonEmptyString(item.title) ?? asNonEmptyString(item.name),
                notes: asNonEmptyString(item.notes),
                sectionId,
                setType: asShoppingSetType(item.setType),
                selectionMode: asShoppingSetSelectionMode(item.selectionMode),
                pricingMode: asShoppingSetPricingMode(item.pricingMode),
                status: asShoppingSetStatus(item.status),
              });
              if (!hasManagedUpdateFields(updates, [])) {
                return {
                  ok: false,
                  error:
                    "No valid shopping set update fields were provided. Use at least one editable field such as title, notes, sectionId, setType, selectionMode, pricingMode, or status.",
                };
              }

              const result = await convex.action(
                apiAny.ai.confirmedActions.editConfirmedShoppingSet,
                {
                  setId,
                  updates,
                },
              );

              return {
                ...formatConfirmedActionResult(
                  result,
                  "Shopping set updated successfully.",
                ),
                setId,
              };
            });
          }

          case "bulk_delete_shopping_sets": {
            const items = asRecordArray(params.items);
            return runBulk(items, "Bulk shopping set delete", async (item) => {
              const setId =
                asNonEmptyString(item.setId) ?? asNonEmptyString(item.id);
              if (!setId) {
                return {
                  ok: false,
                  error:
                    "Missing required `setId` for a bulk shopping set delete.",
                };
              }

              const result = await convex.action(
                apiAny.ai.confirmedActions.deleteConfirmedShoppingSet,
                {
                  setId,
                },
              );

              return {
                ...formatConfirmedActionResult(
                  result,
                  "Shopping set deleted successfully.",
                ),
                setId,
              };
            });
          }

          case "bulk_create_labor_items": {
            const items = asRecordArray(params.items);
            return runBulk(items, "Bulk labor item creation", async (item) => {
              const laborName = extractLaborName(item);
              if (!laborName) {
                return {
                  ok: false,
                  error:
                    "Missing required `name` for a bulk-created labor item.",
                };
              }
              const validationError = validateLaborItemToolFields(
                item,
                "bulk_create_labor_items",
              );
              if (validationError) {
                return { ok: false, error: validationError };
              }

              const result = await convex.action(
                apiAny.ai.confirmedActions.createConfirmedLaborItem,
                {
                  projectId,
                  itemData: {
                    name: laborName,
                    quantity: asNumber(item.quantity) ?? 1,
                    unit: asNonEmptyString(item.unit) ?? "item",
                    notes: asNonEmptyString(item.notes),
                    unitPrice: asNumber(item.unitPrice) ?? asNumber(item.price),
                    sectionId:
                      (await resolveSectionId("labor", item)) ?? undefined,
                    assignedTo: asNonEmptyString(item.assignedTo),
                    startDate: asDateInput(item.startDate),
                    endDate: asDateInput(item.endDate),
                  },
                },
              );

              return {
                ...formatConfirmedActionResult(
                  result,
                  `Created labor item: ${laborName}`,
                ),
                itemId:
                  typeof result?.itemId === "string"
                    ? result.itemId
                    : undefined,
                name: laborName,
              };
            });
          }

          case "bulk_update_labor_items": {
            const items = asRecordArray(params.items);
            return runBulk(items, "Bulk labor item update", async (item) => {
              const itemId =
                asNonEmptyString(item.itemId) ?? asNonEmptyString(item.id);
              if (!itemId) {
                return {
                  ok: false,
                  error:
                    "Missing required `itemId` for a bulk labor item update.",
                };
              }
              const validationError = validateLaborItemToolFields(
                item,
                "bulk_update_labor_items",
              );
              if (validationError) {
                return { ok: false, error: validationError };
              }

              const sectionId = await resolveSectionId("labor", item, {
                createIfMissing: false,
              });

              const updates = compactDefinedFields({
                name: extractLaborName(item),
                notes: asNonEmptyString(item.notes),
                quantity: asNumber(item.quantity),
                unit: asNonEmptyString(item.unit),
                unitPrice: asNumber(item.unitPrice) ?? asNumber(item.price),
                sectionId,
                assignedTo: asNonEmptyString(item.assignedTo),
                startDate: asDateInput(item.startDate),
                endDate: asDateInput(item.endDate),
              });
              if (!hasManagedUpdateFields(updates, [])) {
                return {
                  ok: false,
                  error:
                    "No valid labor item update fields were provided. Use at least one editable field such as name, notes, quantity, unit, unitPrice, sectionId, assignedTo, startDate, or endDate.",
                };
              }

              const result = await convex.action(
                apiAny.ai.confirmedActions.editConfirmedLaborItem,
                {
                  projectId,
                  itemId,
                  updates,
                },
              );

              return {
                ...formatConfirmedActionResult(
                  result,
                  "Labor item updated successfully.",
                ),
                itemId,
              };
            });
          }

          case "bulk_delete_labor_items": {
            const items = asRecordArray(params.items);
            return runBulk(items, "Bulk labor item delete", async (item) => {
              const itemId =
                asNonEmptyString(item.itemId) ?? asNonEmptyString(item.id);
              if (!itemId) {
                return {
                  ok: false,
                  error:
                    "Missing required `itemId` for a bulk labor item delete.",
                };
              }

              const result = await convex.action(
                apiAny.ai.confirmedActions.deleteConfirmedLaborItem,
                {
                  itemId,
                  reason: asNonEmptyString(item.reason),
                },
              );

              return {
                ...formatConfirmedActionResult(
                  result,
                  "Labor item deleted successfully.",
                ),
                itemId,
              };
            });
          }

          case "bulk_create_labor_sections": {
            const items = asRecordArray(params.items);
            return runBulk(
              items,
              "Bulk labor section creation",
              async (item) => {
                const sectionName =
                  asNonEmptyString(item.name) ??
                  asNonEmptyString(item.sectionName);
                if (!sectionName) {
                  return {
                    ok: false,
                    error:
                      "Missing required `name` for a bulk-created labor section.",
                  };
                }

                const result = await convex.action(
                  apiAny.ai.confirmedActions.createConfirmedLaborSection,
                  {
                    projectId,
                    sectionData: { name: sectionName },
                  },
                );

                return {
                  ...formatConfirmedActionResult(
                    result,
                    `Created labor section: ${sectionName}`,
                  ),
                  sectionId:
                    typeof result?.sectionId === "string"
                      ? result.sectionId
                      : undefined,
                  name: sectionName,
                };
              },
            );
          }

          case "bulk_update_labor_sections": {
            const items = asRecordArray(params.items);
            return runBulk(items, "Bulk labor section update", async (item) => {
              const sectionId =
                asNonEmptyString(item.sectionId) ?? asNonEmptyString(item.id);
              if (!sectionId) {
                return {
                  ok: false,
                  error:
                    "Missing required `sectionId` for a bulk labor section update.",
                };
              }

              const updates = compactDefinedFields({
                name:
                  asNonEmptyString(item.name) ??
                  asNonEmptyString(item.sectionName),
              });
              if (!hasManagedUpdateFields(updates, [])) {
                return {
                  ok: false,
                  error:
                    "No valid labor section update fields were provided. Use at least `name`.",
                };
              }

              const result = await convex.action(
                apiAny.ai.confirmedActions.editConfirmedLaborSection,
                {
                  sectionId,
                  updates,
                },
              );

              return {
                ...formatConfirmedActionResult(
                  result,
                  "Labor section updated successfully.",
                ),
                sectionId,
              };
            });
          }

          case "bulk_delete_labor_sections": {
            const items = asRecordArray(params.items);
            return runBulk(items, "Bulk labor section delete", async (item) => {
              const sectionId =
                asNonEmptyString(item.sectionId) ?? asNonEmptyString(item.id);
              if (!sectionId) {
                return {
                  ok: false,
                  error:
                    "Missing required `sectionId` for a bulk labor section delete.",
                };
              }

              const result = await convex.action(
                apiAny.ai.confirmedActions.deleteConfirmedLaborSection,
                {
                  sectionId,
                },
              );

              return {
                ...formatConfirmedActionResult(
                  result,
                  "Labor section deleted successfully.",
                ),
                sectionId,
              };
            });
          }

          case "bulk_create_surveys": {
            const items = asRecordArray(params.items);
            return runBulk(items, "Bulk survey creation", async (item) => {
              const { title, surveyData } = buildCreateSurveyPayload(item);
              if (!title || !surveyData) {
                return {
                  ok: false,
                  error: "Missing required `title` for a bulk-created survey.",
                };
              }

              const result = await convex.action(
                apiAny.ai.confirmedActions.createConfirmedSurvey,
                {
                  projectId,
                  surveyData,
                },
              );
              const surveyId =
                typeof result?.surveyId === "string"
                  ? result.surveyId
                  : undefined;
              const createdSurvey = surveyId
                ? await convex.query(apiAny.surveys.getSurvey, { surveyId })
                : null;
              const expectedQuestionCount = surveyData.questions?.length ?? 0;
              const actualQuestionCount = Array.isArray(
                asRecord(createdSurvey).questions,
              )
                ? asRecordArray(asRecord(createdSurvey).questions).length
                : 0;
              if (
                asRecord(result).success === true &&
                actualQuestionCount !== expectedQuestionCount
              ) {
                return {
                  ok: false,
                  error: `Survey was created, but question verification failed: expected ${expectedQuestionCount}, found ${actualQuestionCount}.`,
                  surveyId,
                  title,
                  expectedQuestionCount,
                  actualQuestionCount,
                };
              }

              return {
                ...formatConfirmedActionResult(
                  result,
                  `Created survey: ${title}`,
                ),
                surveyId,
                title,
                questionCount: actualQuestionCount,
              };
            });
          }

          case "bulk_update_surveys": {
            const items = asRecordArray(params.items);
            return runBulk(items, "Bulk survey update", async (item) => {
              const { surveyId, updates } = buildUpdateSurveyPayload(item);
              const compactUpdates = updates
                ? compactDefinedFields(updates)
                : undefined;
              if (!surveyId) {
                return {
                  ok: false,
                  error:
                    "Missing required `surveyId` for a bulk survey update.",
                };
              }
              if (
                !compactUpdates ||
                !hasManagedUpdateFields(compactUpdates, [])
              ) {
                return {
                  ok: false,
                  error:
                    "No valid survey update fields were provided. Use at least one editable field such as title, description, dates, flags, or questions.",
                };
              }

              const result = await convex.action(
                apiAny.ai.confirmedActions.editConfirmedSurvey,
                {
                  projectId,
                  surveyId,
                  updates: compactUpdates,
                },
              );

              return {
                ...formatConfirmedActionResult(
                  result,
                  "Survey updated successfully.",
                ),
                surveyId,
              };
            });
          }

          case "bulk_delete_surveys": {
            const items = asRecordArray(params.items);
            return runBulk(items, "Bulk survey delete", async (item) => {
              const surveyId =
                asNonEmptyString(item.surveyId) ?? asNonEmptyString(item.id);
              if (!surveyId) {
                return {
                  ok: false,
                  error:
                    "Missing required `surveyId` for a bulk survey delete.",
                };
              }

              const existingSurvey = await convex.query(
                apiAny.surveys.getSurvey,
                {
                  surveyId,
                },
              );
              const title =
                asNonEmptyString(item.title) ??
                asNonEmptyString(existingSurvey?.title) ??
                "Survey";

              const result = await convex.action(
                apiAny.ai.confirmedActions.deleteConfirmedSurvey,
                {
                  surveyId,
                  title,
                  reason: asNonEmptyString(item.reason),
                },
              );

              return {
                ...formatConfirmedActionResult(
                  result,
                  "Survey deleted successfully.",
                ),
                surveyId,
              };
            });
          }

          case "create_task": {
            const title = extractTaskTitle(params);
            if (!title) {
              return {
                ok: false,
                error: "Missing required `title` for create_task.",
              };
            }
            const validationError = validateTaskToolFields(
              params,
              "create_task",
            );
            if (validationError) {
              return { ok: false, error: validationError };
            }

            const assigneeInput = extractTaskAssigneeIdentifier(params);
            const assignedTo = await resolveTeamAssignee(assigneeInput);
            if (assigneeInput && assignedTo === null && !isClearAssigneeValue(assigneeInput)) {
              return {
                ok: false,
                error:
                  "Could not match `assignedTo` to a team member. Use an exact team member name, email, Clerk ID, or say 'assign to me'.",
              };
            }

            const taskId = await convex.mutation(apiAny.tasks.createTask, {
              title,
              projectId,
              teamId,
              description: asNonEmptyString(params.description),
              content: asNonEmptyString(params.content),
              status: asTaskStatus(params.status) ?? "todo",
              priority: asTaskPriority(params.priority) ?? "medium",
              assignedTo: assignedTo ?? undefined,
              startDate: asTimestamp(params.startDate),
              endDate: asTimestamp(params.endDate),
              tags: asStringArray(params.tags) ?? [],
              sectionId: asNonEmptyString(params.sectionId) ?? null,
            });

            return {
              ok: true,
              taskId,
              title,
              message: `Created task: ${title}`,
            };
          }

          case "update_task": {
            const taskId = asNonEmptyString(params.taskId);
            if (!taskId) {
              return {
                ok: false,
                error: "Missing required `taskId` for update_task.",
              };
            }
            const validationError = validateTaskToolFields(
              params,
              "update_task",
            );
            if (validationError) {
              return { ok: false, error: validationError };
            }

            const updates: Record<string, unknown> = {
              taskId,
            };

            const title = extractTaskTitle(params);
            if (title) updates.title = title;

            const description = asNonEmptyString(params.description);
            if (description !== undefined) updates.description = description;

            const content = asNonEmptyString(params.content);
            if (content !== undefined) updates.content = content;

            const status = asTaskStatus(params.status);
            if (status !== undefined) updates.status = status;

            const priority = asTaskPriority(params.priority);
            if (priority !== undefined) updates.priority = priority;

            const assigneeInput = extractTaskAssigneeIdentifier(params);
            const assignedTo = await resolveTeamAssignee(assigneeInput);
            if (assigneeInput && assignedTo === null && !isClearAssigneeValue(assigneeInput)) {
              return {
                ok: false,
                error:
                  "Could not match `assignedTo` to a team member. Use an exact team member name, email, Clerk ID, or say 'assign to me'.",
              };
            }
            if (assignedTo !== undefined) updates.assignedTo = assignedTo;

            const startDate = asTimestamp(params.startDate);
            if (startDate !== undefined) updates.startDate = startDate;

            const endDate = asTimestamp(params.endDate);
            if (endDate !== undefined) updates.endDate = endDate;

            const tags = asStringArray(params.tags);
            if (tags !== undefined) updates.tags = tags;

            if (!hasTaskMutationFields(updates)) {
              return {
                ok: false,
                error:
                  "No valid task update fields were provided. Use at least one of: title, description, content, status, priority, assignedTo (or assignee), startDate, endDate, tags.",
              };
            }

            await convex.mutation(apiAny.tasks.updateTask, updates);

            return {
              ok: true,
              taskId,
              message: "Task updated successfully.",
            };
          }

          case "delete_task": {
            const taskId = asNonEmptyString(params.taskId);
            if (!taskId) {
              return {
                ok: false,
                error: "Missing required `taskId` for delete_task.",
              };
            }

            await convex.mutation(apiAny.tasks.deleteTask, { taskId });

            return {
              ok: true,
              taskId,
              message: "Task deleted successfully.",
            };
          }

          case "create_payment": {
            const title =
              asNonEmptyString(params.title) ??
              asNonEmptyString(params.name) ??
              asNonEmptyString(params.invoiceNumber);
            const amount = asNumber(params.amount);

            if (!title) {
              return {
                ok: false,
                error: "Missing required `title` for create_payment.",
              };
            }

            if (amount === undefined || amount <= 0) {
              return {
                ok: false,
                error: "Missing or invalid `amount` for create_payment.",
              };
            }

            const result = await convex.action(
              apiAny.ai.confirmedActions.createConfirmedPayment,
              {
                projectId,
                paymentData: {
                  title,
                  description: asNonEmptyString(params.description),
                  amount,
                  dueDate: asNonEmptyString(params.dueDate),
                },
              },
            );

            return {
              ...formatConfirmedActionResult(
                result,
                `Created invoice draft: ${title}`,
              ),
              paymentId: asNonEmptyString(result?.paymentId),
              title,
              amount,
            };
          }

          case "update_payment": {
            const paymentId = pickFirstNonEmptyString(params, [
              "paymentId",
              "invoiceId",
              "itemId",
              "id",
            ]);
            if (!paymentId) {
              return {
                ok: false,
                error: "Missing required `paymentId` for update_payment.",
              };
            }
            if (
              hasOwnValue(params, "status") &&
              asPaymentStatus(params.status) === undefined
            ) {
              return {
                ok: false,
                error: "Invalid status for update_payment.",
              };
            }

            const updates = compactDefinedFields({
              title:
                asNonEmptyString(params.title) ?? asNonEmptyString(params.name),
              description:
                params.description === null
                  ? null
                  : asNonEmptyString(params.description),
              amount: asNumber(params.amount),
              dueDate:
                params.dueDate === null
                  ? null
                  : asNonEmptyString(params.dueDate),
              invoiceNumber: asNonEmptyString(params.invoiceNumber),
              status: asPaymentStatus(params.status),
            });

            if (!hasManagedUpdateFields(updates, [])) {
              return {
                ok: false,
                error:
                  "No valid payment update fields were provided. Use at least one of: title, description, amount, dueDate, invoiceNumber, or status.",
              };
            }

            const result = await convex.action(
              apiAny.ai.confirmedActions.editConfirmedPayment,
              {
                projectId,
                paymentId,
                updates,
              },
            );

            return {
              ...formatConfirmedActionResult(
                result,
                "Invoice updated successfully.",
              ),
              paymentId,
            };
          }

          case "delete_payment": {
            const paymentId = pickFirstNonEmptyString(params, [
              "paymentId",
              "invoiceId",
              "itemId",
              "id",
            ]);
            if (!paymentId) {
              return {
                ok: false,
                error: "Missing required `paymentId` for delete_payment.",
              };
            }

            const result = await convex.action(
              apiAny.ai.confirmedActions.deleteConfirmedPayment,
              {
                projectId,
                paymentId,
                reason: asNonEmptyString(params.reason),
              },
            );

            return {
              ...formatConfirmedActionResult(
                result,
                "Invoice deleted successfully.",
              ),
              paymentId,
            };
          }

          case "create_shopping_item": {
            const name = extractShoppingName(params);
            if (!name) {
              return {
                ok: false,
                error: "Missing required `name` for create_shopping_item.",
              };
            }
            const validationError = validateShoppingItemToolFields(
              params,
              "create_shopping_item",
            );
            if (validationError) {
              return { ok: false, error: validationError };
            }

            const quantity = asNumber(params.quantity) ?? 1;
            const unit = asNonEmptyString(params.unit);
            const unitPrice =
              asNumber(params.unitPrice) ?? asNumber(params.price);
            const supplier =
              asNonEmptyString(params.supplier) ??
              asNonEmptyString(params.store) ??
              asNonEmptyString(params.vendor);
            const imageUrl =
              asNonEmptyString(params.imageUrl) ??
              asNonEmptyString(params.productImageUrl) ??
              asNonEmptyString(params.moodboardImageUrl) ??
              asNonEmptyString(params.thumbnailUrl) ??
              asNonEmptyString(params.image) ??
              (asNonEmptyString(params.sourceType) === "moodboard"
                ? asNonEmptyString(params.url)
                : undefined);
            const productLink =
              asNonEmptyString(params.productLink) ??
              asNonEmptyString(params.link) ??
              (imageUrl ? undefined : asNonEmptyString(params.url));
            const notes = joinNotes(
              asNonEmptyString(params.notes),
              asNonEmptyString(params.storeAddress),
              asNonEmptyString(params.address),
              asNonEmptyString(params.selectionReason),
              asNonEmptyString(params.sourceSummary),
            );
            const sectionId = await resolveSectionId("shopping", params);
            const assigneeInput = extractTaskAssigneeIdentifier(params);
            const assignedTo = await resolveTeamAssignee(assigneeInput);
            if (assigneeInput && assignedTo === null && !isClearAssigneeValue(assigneeInput)) {
              return {
                ok: false,
                error:
                  "Could not match `assignedTo` to a team member. Use an exact team member name, email, Clerk ID, or say 'assign to me'.",
              };
            }

            const itemId = await convex.mutation(
              apiAny.shopping.createShoppingListItem,
              {
                projectId,
                name,
                quantity,
                unit,
                notes,
                buyBefore: asTimestamp(params.buyBefore),
                priority: asTaskPriority(params.priority) ?? "medium",
                imageUrl,
                productLink,
                supplier,
                catalogNumber: asNonEmptyString(params.catalogNumber),
                category: asNonEmptyString(params.category),
                dimensions: asNonEmptyString(params.dimensions),
                unitPrice,
                setId: asNonEmptyString(params.setId),
                realizationStatus:
                  extractShoppingRealizationStatus(params) ?? "PLANNED",
                sectionId: sectionId ?? null,
                assignedTo: assignedTo ?? undefined,
              },
            );

            return {
              ok: true,
              itemId,
              name,
              quantity,
              message: `Created shopping item: ${name}`,
            };
          }

          case "update_shopping_item": {
            const itemId = pickFirstNonEmptyString(params, ["itemId", "id"]);
            if (!itemId) {
              return {
                ok: false,
                error: "Missing required `itemId` for update_shopping_item.",
              };
            }
            const validationError = validateShoppingItemToolFields(
              params,
              "update_shopping_item",
            );
            if (validationError) {
              return { ok: false, error: validationError };
            }

            const updates: Record<string, unknown> = {
              itemId,
            };

            const name = extractShoppingName(params);
            if (name !== undefined) updates.name = name;

            const notes = joinNotes(
              asNonEmptyString(params.notes),
              asNonEmptyString(params.storeAddress),
              asNonEmptyString(params.address),
              asNonEmptyString(params.selectionReason),
              asNonEmptyString(params.sourceSummary),
            );
            if (notes !== undefined) updates.notes = notes;

            const buyBefore = asTimestamp(params.buyBefore);
            if (buyBefore !== undefined) updates.buyBefore = buyBefore;

            const priority = asTaskPriority(params.priority);
            if (priority !== undefined) updates.priority = priority;

            const imageUrl =
              asNonEmptyString(params.imageUrl) ??
              asNonEmptyString(params.productImageUrl) ??
              asNonEmptyString(params.moodboardImageUrl) ??
              asNonEmptyString(params.thumbnailUrl) ??
              asNonEmptyString(params.image);
            if (imageUrl !== undefined) updates.imageUrl = imageUrl;

            const productLink =
              asNonEmptyString(params.productLink) ??
              asNonEmptyString(params.url) ??
              asNonEmptyString(params.link);
            if (productLink !== undefined) updates.productLink = productLink;

            const supplier =
              asNonEmptyString(params.supplier) ??
              asNonEmptyString(params.store) ??
              asNonEmptyString(params.vendor);
            if (supplier !== undefined) updates.supplier = supplier;

            const catalogNumber = asNonEmptyString(params.catalogNumber);
            if (catalogNumber !== undefined)
              updates.catalogNumber = catalogNumber;

            const category = asNonEmptyString(params.category);
            if (category !== undefined) updates.category = category;

            const dimensions = asNonEmptyString(params.dimensions);
            if (dimensions !== undefined) updates.dimensions = dimensions;

            const quantity = asNumber(params.quantity);
            if (quantity !== undefined) updates.quantity = quantity;

            const unit = asNonEmptyString(params.unit);
            if (unit !== undefined) updates.unit = unit;

            const unitPrice =
              asNumber(params.unitPrice) ?? asNumber(params.price);
            if (unitPrice !== undefined) updates.unitPrice = unitPrice;

            if (params.setId === null) {
              updates.setId = null;
            } else {
              const setId = asNonEmptyString(params.setId);
              if (setId !== undefined) updates.setId = setId;
            }

            const realizationStatus = extractShoppingRealizationStatus(params);
            if (realizationStatus !== undefined)
              updates.realizationStatus = realizationStatus;

            const sectionId = await resolveSectionId("shopping", params);
            if (sectionId === null) {
              updates.sectionId = null;
            } else if (sectionId !== undefined) {
              updates.sectionId = sectionId;
            }

            const assigneeInput = extractTaskAssigneeIdentifier(params);
            const assignedTo = await resolveTeamAssignee(assigneeInput);
            if (assigneeInput && assignedTo === null && !isClearAssigneeValue(assigneeInput)) {
              return {
                ok: false,
                error:
                  "Could not match `assignedTo` to a team member. Use an exact team member name, email, Clerk ID, or say 'assign to me'.",
              };
            }
            if (assignedTo !== undefined) updates.assignedTo = assignedTo;

            if (!hasManagedUpdateFields(updates, ["itemId"])) {
              return {
                ok: false,
                error:
                  "No valid shopping item update fields were provided. Use at least one editable field such as notes, quantity, unit, unitPrice, supplier, status or realizationStatus, sectionId, or assignedTo.",
              };
            }

            await convex.mutation(
              apiAny.shopping.updateShoppingListItem,
              updates,
            );

            return {
              ok: true,
              itemId,
              message: "Shopping item updated successfully.",
            };
          }

          case "delete_shopping_item": {
            const itemId = pickFirstNonEmptyString(params, ["itemId", "id"]);
            if (!itemId) {
              return {
                ok: false,
                error: "Missing required `itemId` for delete_shopping_item.",
              };
            }

            await convex.mutation(apiAny.shopping.deleteShoppingListItem, {
              itemId,
            });

            return {
              ok: true,
              itemId,
              message: "Shopping item deleted successfully.",
            };
          }

          case "create_note": {
            const title = extractNoteTitle(params);

            const content =
              asNonEmptyString(params.content) ??
              asNonEmptyString(params.description) ??
              title;

            if (!title || !content) {
              return {
                ok: false,
                error: "Missing required `title` or `content` for create_note.",
              };
            }

            const noteId = await convex.mutation(apiAny.notes.createNote, {
              projectId,
              title,
              content,
            });

            return {
              ok: true,
              noteId,
              title,
              message: `Created note: ${title}`,
            };
          }

          case "update_note": {
            const noteId = asNonEmptyString(params.noteId);
            if (!noteId) {
              return {
                ok: false,
                error: "Missing required `noteId` for update_note.",
              };
            }

            const existingNote = await convex.query(apiAny.notes.getNote, {
              noteId,
            });
            if (!existingNote) {
              return {
                ok: false,
                error: "Note not found.",
              };
            }

            const title =
              extractNoteTitle(params) ??
              asNonEmptyString(existingNote.title) ??
              "Untitled note";
            const content =
              asNonEmptyString(params.content) ??
              asNonEmptyString(params.description) ??
              asNonEmptyString(existingNote.content) ??
              "";

            await convex.mutation(apiAny.notes.updateNote, {
              noteId,
              title,
              content,
            });

            return {
              ok: true,
              noteId,
              message: "Note updated successfully.",
            };
          }

          case "delete_note": {
            const noteId = asNonEmptyString(params.noteId);
            if (!noteId) {
              return {
                ok: false,
                error: "Missing required `noteId` for delete_note.",
              };
            }

            await convex.mutation(apiAny.notes.deleteNote, { noteId });

            return {
              ok: true,
              noteId,
              message: "Note deleted successfully.",
            };
          }

          case "create_contact": {
            const name = extractContactName(params);
            if (!name) {
              return {
                ok: false,
                error: "Missing required `name` for create_contact.",
              };
            }

            const type = asNonEmptyString(params.type) ?? "other";

            const contactId = await convex.mutation(
              apiAny.contacts.createContact,
              {
                teamSlug,
                name,
                companyName: asNonEmptyString(params.companyName),
                email: asNonEmptyString(params.email),
                phone: asNonEmptyString(params.phone),
                address: asNonEmptyString(params.address),
                city: asNonEmptyString(params.city),
                postalCode: asNonEmptyString(params.postalCode),
                website: asNonEmptyString(params.website),
                taxId: asNonEmptyString(params.taxId),
                type,
                notes: asNonEmptyString(params.notes),
              },
            );

            return {
              ok: true,
              contactId,
              name,
              message: `Created contact: ${name}`,
            };
          }

          case "update_contact": {
            const contactId = asNonEmptyString(params.contactId);
            if (!contactId) {
              return {
                ok: false,
                error: "Missing required `contactId` for update_contact.",
              };
            }

            const existingContact = await convex.query(
              apiAny.contacts.getContact,
              { contactId },
            );
            if (!existingContact) {
              return {
                ok: false,
                error: "Contact not found.",
              };
            }

            await convex.mutation(apiAny.contacts.updateContact, {
              contactId,
              name:
                extractContactName(params) ??
                asNonEmptyString(existingContact.name) ??
                "Unnamed contact",
              companyName:
                asNonEmptyString(params.companyName) ??
                asNonEmptyString(existingContact.companyName),
              email:
                asNonEmptyString(params.email) ??
                asNonEmptyString(existingContact.email),
              phone:
                asNonEmptyString(params.phone) ??
                asNonEmptyString(existingContact.phone),
              address:
                asNonEmptyString(params.address) ??
                asNonEmptyString(existingContact.address),
              city:
                asNonEmptyString(params.city) ??
                asNonEmptyString(existingContact.city),
              postalCode:
                asNonEmptyString(params.postalCode) ??
                asNonEmptyString(existingContact.postalCode),
              website:
                asNonEmptyString(params.website) ??
                asNonEmptyString(existingContact.website),
              taxId:
                asNonEmptyString(params.taxId) ??
                asNonEmptyString(existingContact.taxId),
              type:
                asNonEmptyString(params.type) ??
                asNonEmptyString(existingContact.type) ??
                "other",
              notes:
                asNonEmptyString(params.notes) ??
                asNonEmptyString(existingContact.notes),
            });

            return {
              ok: true,
              contactId,
              message: "Contact updated successfully.",
            };
          }

          case "delete_contact": {
            const contactId = asNonEmptyString(params.contactId);
            if (!contactId) {
              return {
                ok: false,
                error: "Missing required `contactId` for delete_contact.",
              };
            }

            await convex.mutation(apiAny.contacts.deleteContact, { contactId });

            return {
              ok: true,
              contactId,
              message: "Contact deleted successfully.",
            };
          }

          case "update_project_settings": {
            const flattened = flattenManagedToolParams(params);
            const hasOwn = (key: string) =>
              Object.prototype.hasOwnProperty.call(flattened, key);
            const payload: Record<string, unknown> = {
              projectId,
            };

            if (hasOwn("name")) {
              payload.name = asNonEmptyString(flattened.name);
            }

            if (hasOwn("description")) {
              payload.description = asNonEmptyString(flattened.description);
            }

            if (hasOwn("coverImageUrl")) {
              payload.coverImageUrl = asNonEmptyString(flattened.coverImageUrl);
            }

            if (hasOwn("status")) {
              payload.status = asNonEmptyString(flattened.status);
            }

            if (hasOwn("startDate")) {
              const rawStartDate = flattened.startDate;
              const startDate = asTimestamp(rawStartDate);
              const startDateText = asNonEmptyString(rawStartDate);
              if (startDate === undefined && startDateText !== undefined) {
                return {
                  ok: false,
                  error: "Project start date must be a valid date.",
                };
              }
              payload.startDate = startDate;
            }

            if (hasOwn("endDate")) {
              const rawEndDate = flattened.endDate;
              const endDate = asTimestamp(rawEndDate);
              const endDateText = asNonEmptyString(rawEndDate);
              if (endDate === undefined && endDateText !== undefined) {
                return {
                  ok: false,
                  error: "Project end date must be a valid date.",
                };
              }
              payload.endDate = endDate;
            }

            if (hasOwn("customer")) {
              payload.customer = asNonEmptyString(flattened.customer);
            }

            if (hasOwn("customerEmail")) {
              const customerEmail = asNonEmptyString(flattened.customerEmail);
              payload.customerEmail =
                typeof customerEmail === "string"
                  ? customerEmail.toLowerCase()
                  : undefined;
            }

            if (hasOwn("location")) {
              payload.location = asNonEmptyString(flattened.location);
            }

            if (hasOwn("budget")) {
              payload.budget = asNumber(flattened.budget);
            }

            if (hasOwn("currency")) {
              payload.currency = asNonEmptyString(flattened.currency);
            }

            if (
              typeof payload.startDate === "number" &&
              typeof payload.endDate === "number" &&
              payload.endDate < payload.startDate
            ) {
              return {
                ok: false,
                error:
                  "Project end date cannot be earlier than the start date.",
              };
            }

            if (Object.keys(payload).length === 1) {
              return {
                ok: false,
                error: "No valid project setting fields were provided.",
              };
            }

            const result = await convex.mutation(
              apiAny.projects.updateProject,
              payload,
            );

            return {
              ok: true,
              slug: typeof result?.slug === "string" ? result.slug : undefined,
              message: "Project settings updated successfully.",
            };
          }

          case "create_shopping_section": {
            const name = extractSectionName(params);
            if (!name) {
              return {
                ok: false,
                error: "Missing required `name` for create_shopping_section.",
              };
            }

            const result = await convex.action(
              apiAny.ai.confirmedActions.createConfirmedShoppingSection,
              {
                projectId,
                sectionData: { name },
              },
            );

            return {
              ...formatConfirmedActionResult(
                result,
                `Created shopping section: ${name}`,
              ),
              sectionId:
                typeof result?.sectionId === "string"
                  ? result.sectionId
                  : undefined,
            };
          }

          case "update_shopping_section": {
            const sectionId = pickFirstNonEmptyString(params, [
              "sectionId",
              "id",
            ]);
            if (!sectionId) {
              return {
                ok: false,
                error:
                  "Missing required `sectionId` for update_shopping_section.",
              };
            }

            const updates = compactDefinedFields({
              name: extractSectionName(params),
            });
            if (!hasManagedUpdateFields(updates, [])) {
              return {
                ok: false,
                error:
                  "No valid shopping section update fields were provided. Use at least `name`.",
              };
            }

            const result = await convex.action(
              apiAny.ai.confirmedActions.editConfirmedShoppingSection,
              {
                sectionId,
                updates,
              },
            );

            return {
              ...formatConfirmedActionResult(
                result,
                "Shopping section updated successfully.",
              ),
              sectionId,
            };
          }

          case "delete_shopping_section": {
            const sectionId = pickFirstNonEmptyString(params, [
              "sectionId",
              "id",
            ]);
            if (!sectionId) {
              return {
                ok: false,
                error:
                  "Missing required `sectionId` for delete_shopping_section.",
              };
            }

            const result = await convex.action(
              apiAny.ai.confirmedActions.deleteConfirmedShoppingSection,
              {
                sectionId,
              },
            );

            return {
              ...formatConfirmedActionResult(
                result,
                "Shopping section deleted successfully.",
              ),
              sectionId,
            };
          }

          case "create_shopping_set": {
            const title =
              asNonEmptyString(params.title) ?? asNonEmptyString(params.name);
            if (!title) {
              return {
                ok: false,
                error: "Missing required `title` for create_shopping_set.",
              };
            }
            const validationError = validateShoppingSetToolFields(
              params,
              "create_shopping_set",
            );
            if (validationError) {
              return { ok: false, error: validationError };
            }

            const sectionId = await resolveSectionId("shopping", params, {
              createIfMissing: false,
            });

            const result = await convex.action(
              apiAny.ai.confirmedActions.createConfirmedShoppingSet,
              {
                projectId,
                setData: {
                  title,
                  notes: asNonEmptyString(params.notes),
                  sectionId: sectionId === null ? undefined : sectionId,
                  setType: asShoppingSetType(params.setType),
                  selectionMode: asShoppingSetSelectionMode(
                    params.selectionMode,
                  ),
                  pricingMode: asShoppingSetPricingMode(params.pricingMode),
                  status: asShoppingSetStatus(params.status),
                },
              },
            );

            return {
              ...formatConfirmedActionResult(
                result,
                `Created shopping set: ${title}`,
              ),
              setId:
                typeof result?.setId === "string" ? result.setId : undefined,
            };
          }

          case "update_shopping_set": {
            const setId = pickFirstNonEmptyString(params, ["setId", "id"]);
            if (!setId) {
              return {
                ok: false,
                error: "Missing required `setId` for update_shopping_set.",
              };
            }
            const validationError = validateShoppingSetToolFields(
              params,
              "update_shopping_set",
            );
            if (validationError) {
              return { ok: false, error: validationError };
            }

            const sectionId = await resolveSectionId("shopping", params, {
              createIfMissing: false,
            });

            const updates = compactDefinedFields({
              title:
                asNonEmptyString(params.title) ?? asNonEmptyString(params.name),
              notes: asNonEmptyString(params.notes),
              sectionId,
              setType: asShoppingSetType(params.setType),
              selectionMode: asShoppingSetSelectionMode(params.selectionMode),
              pricingMode: asShoppingSetPricingMode(params.pricingMode),
              status: asShoppingSetStatus(params.status),
            });
            if (!hasManagedUpdateFields(updates, [])) {
              return {
                ok: false,
                error:
                  "No valid shopping set update fields were provided. Use at least one editable field such as title, notes, sectionId, setType, selectionMode, pricingMode, or status.",
              };
            }

            const result = await convex.action(
              apiAny.ai.confirmedActions.editConfirmedShoppingSet,
              {
                setId,
                updates,
              },
            );

            return {
              ...formatConfirmedActionResult(
                result,
                "Shopping set updated successfully.",
              ),
              setId,
            };
          }

          case "delete_shopping_set": {
            const setId = pickFirstNonEmptyString(params, ["setId", "id"]);
            if (!setId) {
              return {
                ok: false,
                error: "Missing required `setId` for delete_shopping_set.",
              };
            }

            const result = await convex.action(
              apiAny.ai.confirmedActions.deleteConfirmedShoppingSet,
              {
                setId,
              },
            );

            return {
              ...formatConfirmedActionResult(
                result,
                "Shopping set deleted successfully.",
              ),
              setId,
            };
          }

          case "create_labor_item": {
            const name = extractLaborName(params);
            if (!name) {
              return {
                ok: false,
                error: "Missing required `name` for create_labor_item.",
              };
            }
            const validationError = validateLaborItemToolFields(
              params,
              "create_labor_item",
            );
            if (validationError) {
              return { ok: false, error: validationError };
            }

            const sectionId = await resolveSectionId("labor", params);

            const result = await convex.action(
              apiAny.ai.confirmedActions.createConfirmedLaborItem,
              {
                projectId,
                itemData: {
                  name,
                  quantity: asNumber(params.quantity) ?? 1,
                  unit: asNonEmptyString(params.unit) ?? "item",
                  notes: asNonEmptyString(params.notes),
                  unitPrice:
                    asNumber(params.unitPrice) ?? asNumber(params.price),
                  sectionId: sectionId ?? undefined,
                  assignedTo: asNonEmptyString(params.assignedTo),
                  startDate: asDateInput(params.startDate),
                  endDate: asDateInput(params.endDate),
                },
              },
            );

            return {
              ...formatConfirmedActionResult(
                result,
                `Created labor item: ${name}`,
              ),
              itemId:
                typeof result?.itemId === "string" ? result.itemId : undefined,
              name,
            };
          }

          case "update_labor_item": {
            const itemId = pickFirstNonEmptyString(params, ["itemId", "id"]);
            if (!itemId) {
              return {
                ok: false,
                error: "Missing required `itemId` for update_labor_item.",
              };
            }
            const validationError = validateLaborItemToolFields(
              params,
              "update_labor_item",
            );
            if (validationError) {
              return { ok: false, error: validationError };
            }

            const sectionId = await resolveSectionId("labor", params, {
              createIfMissing: false,
            });

            const updates = compactDefinedFields({
              name: extractLaborName(params),
              notes: asNonEmptyString(params.notes),
              quantity: asNumber(params.quantity),
              unit: asNonEmptyString(params.unit),
              unitPrice: asNumber(params.unitPrice) ?? asNumber(params.price),
              sectionId,
              assignedTo: asNonEmptyString(params.assignedTo),
              startDate: asDateInput(params.startDate),
              endDate: asDateInput(params.endDate),
            });
            if (!hasManagedUpdateFields(updates, [])) {
              return {
                ok: false,
                error:
                  "No valid labor item update fields were provided. Use at least one editable field such as name, notes, quantity, unit, unitPrice, sectionId, assignedTo, startDate, or endDate.",
              };
            }

            const result = await convex.action(
              apiAny.ai.confirmedActions.editConfirmedLaborItem,
              {
                projectId,
                itemId,
                updates,
              },
            );

            return {
              ...formatConfirmedActionResult(
                result,
                "Labor item updated successfully.",
              ),
              itemId,
            };
          }

          case "delete_labor_item": {
            const itemId = pickFirstNonEmptyString(params, ["itemId", "id"]);
            if (!itemId) {
              return {
                ok: false,
                error: "Missing required `itemId` for delete_labor_item.",
              };
            }

            const result = await convex.action(
              apiAny.ai.confirmedActions.deleteConfirmedLaborItem,
              {
                itemId,
                reason: asNonEmptyString(params.reason),
              },
            );

            return {
              ...formatConfirmedActionResult(
                result,
                "Labor item deleted successfully.",
              ),
              itemId,
            };
          }

          case "create_labor_section": {
            const name = extractSectionName(params);
            if (!name) {
              return {
                ok: false,
                error: "Missing required `name` for create_labor_section.",
              };
            }

            const result = await convex.action(
              apiAny.ai.confirmedActions.createConfirmedLaborSection,
              {
                projectId,
                sectionData: { name },
              },
            );

            return {
              ...formatConfirmedActionResult(
                result,
                `Created labor section: ${name}`,
              ),
              sectionId:
                typeof result?.sectionId === "string"
                  ? result.sectionId
                  : undefined,
            };
          }

          case "update_labor_section": {
            const sectionId = pickFirstNonEmptyString(params, [
              "sectionId",
              "id",
            ]);
            if (!sectionId) {
              return {
                ok: false,
                error: "Missing required `sectionId` for update_labor_section.",
              };
            }

            const updates = compactDefinedFields({
              name: extractSectionName(params),
            });
            if (!hasManagedUpdateFields(updates, [])) {
              return {
                ok: false,
                error:
                  "No valid labor section update fields were provided. Use at least `name`.",
              };
            }

            const result = await convex.action(
              apiAny.ai.confirmedActions.editConfirmedLaborSection,
              {
                sectionId,
                updates,
              },
            );

            return {
              ...formatConfirmedActionResult(
                result,
                "Labor section updated successfully.",
              ),
              sectionId,
            };
          }

          case "delete_labor_section": {
            const sectionId = pickFirstNonEmptyString(params, [
              "sectionId",
              "id",
            ]);
            if (!sectionId) {
              return {
                ok: false,
                error: "Missing required `sectionId` for delete_labor_section.",
              };
            }

            const result = await convex.action(
              apiAny.ai.confirmedActions.deleteConfirmedLaborSection,
              {
                sectionId,
              },
            );

            return {
              ...formatConfirmedActionResult(
                result,
                "Labor section deleted successfully.",
              ),
              sectionId,
            };
          }

          case "create_survey": {
            const { title, surveyData } = buildCreateSurveyPayload(params);
            if (!title) {
              return {
                ok: false,
                error: "Missing required `title` for create_survey.",
              };
            }

            const result = await convex.action(
              apiAny.ai.confirmedActions.createConfirmedSurvey,
              {
                projectId,
                surveyData: surveyData!,
              },
            );
            const surveyId =
              typeof result?.surveyId === "string"
                ? result.surveyId
                : undefined;
            const createdSurvey = surveyId
              ? await convex.query(apiAny.surveys.getSurvey, { surveyId })
              : null;
            const expectedQuestionCount = surveyData?.questions?.length ?? 0;
            const actualQuestionCount = Array.isArray(
              asRecord(createdSurvey).questions,
            )
              ? asRecordArray(asRecord(createdSurvey).questions).length
              : 0;
            if (
              asRecord(result).success === true &&
              actualQuestionCount !== expectedQuestionCount
            ) {
              return {
                ok: false,
                error: `Survey was created, but question verification failed: expected ${expectedQuestionCount}, found ${actualQuestionCount}.`,
                surveyId,
                title,
                expectedQuestionCount,
                actualQuestionCount,
              };
            }

            return {
              ...formatConfirmedActionResult(
                result,
                `Created survey: ${title}`,
              ),
              surveyId,
              title,
              questionCount: actualQuestionCount,
            };
          }

          case "update_survey": {
            const resolvedSurveyId = await resolveSurveyId(params);
            const { updates, surveyTitle } = buildUpdateSurveyPayload({
              ...params,
              ...(resolvedSurveyId ? { surveyId: resolvedSurveyId } : {}),
            });
            const surveyId = resolvedSurveyId;
            if (!surveyId) {
              return {
                ok: false,
                error: surveyTitle
                  ? `Could not find a unique survey titled "${surveyTitle}".`
                  : "Missing required `surveyId` or `surveyTitle` for update_survey.",
              };
            }

            const compactUpdates = updates
              ? compactDefinedFields(updates)
              : undefined;
            if (
              !compactUpdates ||
              !hasManagedUpdateFields(compactUpdates, [])
            ) {
              return {
                ok: false,
                error:
                  "No valid survey update fields were provided. Use at least one editable field such as title, description, dates, flags, or questions.",
              };
            }

            const result = await convex.action(
              apiAny.ai.confirmedActions.editConfirmedSurvey,
              {
                projectId,
                surveyId,
                updates: compactUpdates,
              },
            );

            return {
              ...formatConfirmedActionResult(
                result,
                "Survey updated successfully.",
              ),
              surveyId,
            };
          }

          case "delete_survey": {
            const surveyId = await resolveSurveyId(params);
            if (!surveyId) {
              return {
                ok: false,
                error:
                  "Missing required `surveyId` or a unique survey title for delete_survey.",
              };
            }

            const existingSurvey = await convex.query(
              apiAny.surveys.getSurvey,
              { surveyId },
            );
            const title =
              asNonEmptyString(params.title) ??
              asNonEmptyString(existingSurvey?.title) ??
              "Survey";

            const result = await convex.action(
              apiAny.ai.confirmedActions.deleteConfirmedSurvey,
              {
                surveyId,
                title,
                reason: asNonEmptyString(params.reason),
              },
            );

            return {
              ...formatConfirmedActionResult(
                result,
                `Deleted survey: ${title}`,
              ),
              surveyId,
            };
          }

          case "generate_moodboard_image": {
            const payload = flattenManagedToolParams(params);
            const prompt = asNonEmptyString(payload.prompt);
            if (!prompt) {
              return {
                ok: false,
                error:
                  "Missing required `prompt` for generate_moodboard_image.",
              };
            }

            const result = await convex.action(
              apiAny.ai.imageGen.generation.generateMoodboardImageForAssistant,
              {
                prompt,
                projectId,
                section: asNonEmptyString(payload.section),
              },
            );

            return {
              ...formatConfirmedActionResult(
                result,
                "Moodboard image generated successfully.",
              ),
              imageUrl: asNonEmptyString(result?.imageUrl),
              fileId:
                typeof result?.fileId === "string" ? result.fileId : undefined,
              fileName: asNonEmptyString(result?.fileName),
              sectionKey: asNonEmptyString(result?.sectionKey),
              sectionLabel: asNonEmptyString(result?.sectionLabel),
              markdown: asNonEmptyString(result?.markdown),
              error: asNonEmptyString(result?.error),
            };
          }

          case "create_moodboard_section": {
            const name =
              asNonEmptyString(params.name) ??
              asNonEmptyString(params.sectionName);
            if (!name) {
              return {
                ok: false,
                error: "Missing required `name` for create_moodboard_section.",
              };
            }

            const result = await convex.action(
              apiAny.ai.confirmedActions.createConfirmedMoodboardSection,
              {
                projectId,
                sectionData: { name },
              },
            );

            return {
              ...formatConfirmedActionResult(
                result,
                `Created moodboard section: ${name}`,
              ),
              sectionId: asNonEmptyString(result?.sectionId),
            };
          }

          case "update_moodboard_section": {
            const sectionId = asNonEmptyString(params.sectionId);
            if (!sectionId) {
              return {
                ok: false,
                error:
                  "Missing required `sectionId` for update_moodboard_section.",
              };
            }

            const name =
              asNonEmptyString(params.name) ??
              asNonEmptyString(params.sectionName);
            if (!name) {
              return {
                ok: false,
                error: "Missing required `name` for update_moodboard_section.",
              };
            }

            const result = await convex.action(
              apiAny.ai.confirmedActions.editConfirmedMoodboardSection,
              {
                projectId,
                sectionId,
                updates: { name },
              },
            );

            return {
              ...formatConfirmedActionResult(
                result,
                "Moodboard section updated successfully.",
              ),
              sectionId: asNonEmptyString(result?.sectionId) ?? sectionId,
            };
          }

          case "delete_moodboard_section": {
            const sectionId = asNonEmptyString(params.sectionId);
            if (!sectionId) {
              return {
                ok: false,
                error:
                  "Missing required `sectionId` for delete_moodboard_section.",
              };
            }

            const result = await convex.action(
              apiAny.ai.confirmedActions.deleteConfirmedMoodboardSection,
              {
                projectId,
                sectionId,
                reason: asNonEmptyString(params.reason),
              },
            );

            return {
              ...formatConfirmedActionResult(
                result,
                "Moodboard section deleted successfully.",
              ),
              sectionId,
              deletedFilesCount: asNumber(result?.deletedFilesCount),
            };
          }

          case "search_items": {
            const rawQueryInput = asNonEmptyString(params.query) ?? "";
            const normalizedScopeCandidate =
              asNonEmptyString(params.scope) ??
              asNonEmptyString(params.type) ??
              "all";
            const rawQuery =
              rawQueryInput.trim() === "*" ||
              rawQueryInput.trim().toLowerCase() === "all" ||
              rawQueryInput.trim().toLowerCase() == "wszystko"
                ? ""
                : rawQueryInput;
            const requestedScope = normalizedScopeCandidate.toLowerCase();
            const defaultLimit = asNumber(params.limit) ?? 8;
            const taskSearchPlan = buildTaskSearchPlan(
              rawQuery,
              requestedScope,
              defaultLimit,
            );
            const query = normalizeSearchText(rawQuery);
            const scope = taskSearchPlan.effectiveScope;
            const limit = defaultLimit;
            const shouldFetchMoodboard =
              scope === "moodboard" ||
              (scope === "all" && looksLikeMoodboardQuery(rawQuery));
            const [
              tasks,
              notes,
              paymentsOverview,
              shoppingItems,
              shoppingSections,
              laborItems,
              laborSections,
              surveys,
              contacts,
              teamMembers,
              moodboardSections,
              aiKnowledgeFiles,
              aiKnowledgeSearch,
            ] = await Promise.all([
              scope === "all" || scope === "tasks"
                ? convex.query(apiAny.tasks.listProjectTasks, {
                    projectId,
                    filters: taskSearchPlan.statuses
                      ? { status: taskSearchPlan.statuses }
                      : undefined,
                  })
                : Promise.resolve([]),
              scope === "all" || scope === "notes"
                ? convex.query(apiAny.notes.getProjectNotes, { projectId })
                : Promise.resolve([]),
              scope === "all" ||
              scope === "payment" ||
              scope === "payments" ||
              scope === "invoice" ||
              scope === "invoices"
                ? convex.query(
                    apiAny.projectPayments.getProjectPaymentsOverview,
                    { projectId },
                  )
                : Promise.resolve({ installments: [] }),
              scope === "all" || scope === "shopping"
                ? convex.query(apiAny.shopping.getShoppingListItemsByProject, {
                    projectId,
                  })
                : Promise.resolve([]),
              scope === "all" || scope === "shopping"
                ? convex.query(apiAny.shopping.listShoppingListSections, {
                    projectId,
                  })
                : Promise.resolve([]),
              scope === "all" || scope === "labor"
                ? convex.query(apiAny.labor.getLaborItemsByProject, {
                    projectId,
                  })
                : Promise.resolve([]),
              scope === "all" || scope === "labor"
                ? convex.query(apiAny.labor.listLaborSections, { projectId })
                : Promise.resolve([]),
              scope === "all" || scope === "survey" || scope === "surveys"
                ? convex.query(apiAny.surveys.getSurveysByProject, {
                    projectId,
                  })
                : Promise.resolve([]),
              scope === "all" || scope === "contacts"
                ? convex.query(apiAny.contacts.getProjectContacts, {
                    projectId,
                  })
                : Promise.resolve([]),
              scope === "all" ||
              scope === "team" ||
              scope === "teams" ||
              scope === "team_member" ||
              scope === "team_members" ||
              scope === "members"
                ? getTeamMembers()
                : Promise.resolve([]),
              shouldFetchMoodboard
                ? convex.query(apiAny.files.getMoodboardSections, { projectId })
                : Promise.resolve([]),
              scope === "all" || scope === "files"
                ? convex.query(apiAny.files.getProjectAiKnowledgeFiles, {
                    projectId,
                  })
                : Promise.resolve([]),
              (scope === "all" || scope === "files") && rawQuery
                ? convex.action(
                    apiAny.fileKnowledgeActions.searchProjectAiKnowledge,
                    {
                      projectId,
                      query: rawQuery,
                      limit,
                    },
                  )
                : Promise.resolve({ ok: true, text: "", matches: [] }),
            ]);

            const moodboardSectionRecords = moodboardSections as Array<
              Record<string, unknown>
            >;
            const moodboardImageLists = shouldFetchMoodboard
              ? await Promise.all(
                  moodboardSectionRecords.map((section) => {
                    const sectionId = asNonEmptyString(section.id);
                    return sectionId
                      ? convex.query(apiAny.files.getMoodboardImagesBySection, {
                          projectId,
                          section: sectionId,
                        })
                      : Promise.resolve([]);
                  }),
                )
              : [];
            const moodboardImageRecords = moodboardImageLists.flatMap(
              (images, sectionIndex) => {
                const section = moodboardSectionRecords[sectionIndex];
                return (images as Array<Record<string, unknown>>).map(
                  (image) => ({
                    ...image,
                    sectionId: asNonEmptyString(section?.id),
                    sectionTitle:
                      asNonEmptyString(section?.title) ??
                      asNonEmptyString(section?.name),
                  }),
                );
              },
            );

            const shoppingSectionRecords = shoppingSections as Array<
              Record<string, unknown>
            >;
            const shoppingItemRecords = shoppingItems as Array<
              Record<string, unknown>
            >;
            const laborSectionRecords = laborSections as Array<
              Record<string, unknown>
            >;
            const laborItemRecords = laborItems as Array<
              Record<string, unknown>
            >;

            const shoppingSectionNameById = buildNameMap(
              shoppingSectionRecords,
            );
            const shoppingItemCountBySectionId =
              buildSectionItemCountMap(shoppingItemRecords);
            const laborSectionNameById = buildNameMap(laborSectionRecords);
            const laborItemCountBySectionId =
              buildSectionItemCountMap(laborItemRecords);
            const moodboardSectionTitleById = new Map(
              moodboardSectionRecords
                .map((section) => {
                  const id = asNonEmptyString(section.id);
                  const title =
                    asNonEmptyString(section.title) ??
                    asNonEmptyString(section.name);
                  return id && title ? ([id, title] as const) : null;
                })
                .filter((entry): entry is readonly [string, string] =>
                  Boolean(entry),
                ),
            );
            const moodboardImageCountBySectionId = new Map<string, number>();
            for (const image of moodboardImageRecords) {
              const sectionId = asNonEmptyString(image.sectionId);
              if (!sectionId) continue;
              moodboardImageCountBySectionId.set(
                sectionId,
                (moodboardImageCountBySectionId.get(sectionId) ?? 0) + 1,
              );
            }

            const includes = (value: string | undefined | null) =>
              !query || normalizeSearchText(value ?? "").includes(query);

            const taskIncludes = (value: string | undefined | null) =>
              !taskSearchPlan.query ||
              normalizeSearchText(value ?? "").includes(taskSearchPlan.query);

            const filteredTasks = sortTasksByRecency(
              tasks as Array<Record<string, unknown>>,
            )
                .map(summarizeTask)
                .filter(
                  (task) =>
                    taskIncludes(task.title) ||
                    taskIncludes(task.description) ||
                    taskIncludes(task.assignedTo) ||
                    taskIncludes(task.priority) ||
                    taskIncludes(task.status) ||
                    taskIncludes(task.startDateIso) ||
                    taskIncludes(task.endDateIso),
                )
                .slice(0, taskSearchPlan.limit);

            const filteredNotes = (notes as Array<Record<string, unknown>>)
              .map(summarizeNote)
              .filter((note) => includes(note.title) || includes(note.excerpt))
              .slice(0, limit);

            const filteredPayments = asRecordArray(
              asRecord(paymentsOverview).installments,
            )
              .map(summarizePayment)
              .filter(
                (payment) =>
                  includes(payment.title) ||
                  includes(payment.description) ||
                  includes(payment.status) ||
                  includes(payment.invoiceNumber),
              )
              .slice(0, limit);

            const filteredShopping = shoppingItemRecords
              .map((item) =>
                summarizeShoppingItem(item, {
                  sectionNameById: shoppingSectionNameById,
                }),
              )
              .filter(
                (item) =>
                  includes(item.name) ||
                  includes(item.notes) ||
                  includes(item.supplier) ||
                  includes(item.status) ||
                  includes(item.sectionName) ||
                  includes(item.setTitle) ||
                  includes(item.assignedTo) ||
                  includes(item.buyBeforeIso),
              )
              .slice(0, limit);

            const filteredShoppingSections = shoppingSectionRecords
              .map((section) =>
                summarizeShoppingSection(section, {
                  itemCountBySectionId: shoppingItemCountBySectionId,
                }),
              )
              .filter((section) => includes(section.name))
              .slice(0, limit);

            const filteredLabor = laborItemRecords
              .map((item) =>
                summarizeLaborItem(item, {
                  sectionNameById: laborSectionNameById,
                }),
              )
              .filter(
                (item) =>
                  includes(item.name) ||
                  includes(item.notes) ||
                  includes(item.assignedTo) ||
                  includes(item.unit) ||
                  includes(item.sectionName) ||
                  includes(item.startDateIso) ||
                  includes(item.endDateIso),
              )
              .slice(0, limit);

            const filteredLaborSections = laborSectionRecords
              .map((section) =>
                summarizeLaborSection(section, {
                  itemCountBySectionId: laborItemCountBySectionId,
                }),
              )
              .filter(
                (section) => includes(section.name) || includes(section.color),
              )
              .slice(0, limit);

            const filteredSurveys = (surveys as Array<Record<string, unknown>>)
              .map(summarizeSurvey)
              .filter(
                (survey) =>
                  includes(survey.title) ||
                  includes(survey.description) ||
                  includes(survey.status),
              )
              .slice(0, limit);

            const filteredContacts = (
              contacts as Array<Record<string, unknown>>
            )
              .map(summarizeContact)
              .filter(
                (contact) =>
                  includes(contact.name) ||
                  includes(contact.companyName) ||
                  includes(contact.email) ||
                  includes(contact.specialization),
              )
              .slice(0, limit);

            const filteredTeamMembers = (teamMembers as TeamMemberRecord[])
              .filter(
                (member) =>
                  includes(member.name) ||
                  includes(member.email) ||
                  includes(member.role) ||
                  includes(member.clerkUserId) ||
                  includes(member.isActive === false ? "inactive" : "active"),
              )
              .slice(0, limit);

            const filteredMoodboardSections = moodboardSectionRecords
              .map((section) =>
                summarizeMoodboardSection(section, {
                  imageCountBySectionId: moodboardImageCountBySectionId,
                }),
              )
              .filter(
                (section) => includes(section.title) || includes(section.id),
              )
              .slice(0, limit);

            const filteredMoodboardImages = moodboardImageRecords
              .map((image) =>
                summarizeMoodboardImage(image, {
                  sectionTitleById: moodboardSectionTitleById,
                }),
              )
              .filter(
                (image) =>
                  includes(image.name) ||
                  includes(image.sectionTitle) ||
                  includes(image.sectionId),
              )
              .slice(0, limit);

            const semanticFileMatches = asRecordArray(
              asRecord(aiKnowledgeSearch).matches,
            ).map(summarizeProjectFile);

            const filteredFiles =
              semanticFileMatches.length > 0
                ? semanticFileMatches.slice(0, limit)
                : (aiKnowledgeFiles as Array<Record<string, unknown>>)
                    .map(summarizeProjectFile)
                    .filter(
                      (file) =>
                        includes(file.name) ||
                        includes(file.description) ||
                        includes(file.fileType) ||
                        includes(file.mimeType) ||
                        includes(file.excerpt) ||
                        includes(file.extractedText) ||
                        includes(file.pdfAnalysis),
                    )
                    .slice(0, limit);

            const allResults = {
              tasks: filteredTasks,
              notes: filteredNotes,
              payments: filteredPayments,
              shopping: filteredShopping,
              shoppingSections: filteredShoppingSections,
              labor: filteredLabor,
              laborSections: filteredLaborSections,
              surveys: filteredSurveys,
              contacts: filteredContacts,
              teamMembers: filteredTeamMembers,
              moodboardSections: filteredMoodboardSections,
              moodboardImages: filteredMoodboardImages,
              files: filteredFiles,
            };
            const resultKeys = selectSearchResultKeys(scope);
            const scopedResults = Object.fromEntries(
              resultKeys.map((key) => [
                key,
                allResults[key as keyof typeof allResults],
              ]),
            );
            const scopedCounts = Object.fromEntries(
              resultKeys.map((key) => [
                key,
                allResults[key as keyof typeof allResults].length,
              ]),
            );

            return {
              ok: true,
              query,
              scope,
              requestedScope,
              limit: scope === "tasks" ? taskSearchPlan.limit : limit,
              results: scopedResults,
              counts: scopedCounts,
            };
          }

          case "load_full_project_context": {
            const [
              project,
              tasks,
              notes,
              paymentsOverview,
              shoppingItems,
              shoppingSections,
              laborItems,
              laborSections,
              surveys,
              contacts,
              teamMembers,
              aiKnowledgeFiles,
            ] = await Promise.all([
              convex.query(apiAny.projects.getProject, { projectId }),
              convex.query(apiAny.tasks.listProjectTasks, { projectId }),
              convex.query(apiAny.notes.getProjectNotes, { projectId }),
              convex.query(apiAny.projectPayments.getProjectPaymentsOverview, {
                projectId,
              }),
              convex.query(apiAny.shopping.getShoppingListItemsByProject, {
                projectId,
              }),
              convex.query(apiAny.shopping.listShoppingListSections, {
                projectId,
              }),
              convex.query(apiAny.labor.getLaborItemsByProject, { projectId }),
              convex.query(apiAny.labor.listLaborSections, { projectId }),
              convex.query(apiAny.surveys.getSurveysByProject, { projectId }),
              convex.query(apiAny.contacts.getProjectContacts, { projectId }),
              convex.query(apiAny.teams.getTeamMembers, { teamId }),
              convex.query(apiAny.files.getProjectAiKnowledgeFiles, {
                projectId,
              }),
            ]);

            const sortedTaskSummaries = sortTasksByRecency(
              tasks as Array<Record<string, unknown>>,
            ).map(summarizeTask);
            const noteSummaries = (notes as Array<Record<string, unknown>>).map(
              summarizeNote,
            );
            const paymentSummaries = asRecordArray(
              asRecord(paymentsOverview).installments,
            ).map(summarizePayment);
            const shoppingItemRecords = shoppingItems as Array<
              Record<string, unknown>
            >;
            const shoppingSectionRecords = shoppingSections as Array<
              Record<string, unknown>
            >;
            const laborItemRecords = laborItems as Array<
              Record<string, unknown>
            >;
            const laborSectionRecords = laborSections as Array<
              Record<string, unknown>
            >;
            const shoppingSectionNameById = buildNameMap(
              shoppingSectionRecords,
            );
            const shoppingItemCountBySectionId =
              buildSectionItemCountMap(shoppingItemRecords);
            const laborSectionNameById = buildNameMap(laborSectionRecords);
            const laborItemCountBySectionId =
              buildSectionItemCountMap(laborItemRecords);

            const shoppingSummaries = shoppingItemRecords.map((item) =>
              summarizeShoppingItem(item, {
                sectionNameById: shoppingSectionNameById,
              }),
            );
            const shoppingSectionSummaries = shoppingSectionRecords.map(
              (section) =>
                summarizeShoppingSection(section, {
                  itemCountBySectionId: shoppingItemCountBySectionId,
                }),
            );
            const laborSummaries = laborItemRecords.map((item) =>
              summarizeLaborItem(item, {
                sectionNameById: laborSectionNameById,
              }),
            );
            const laborSectionSummaries = laborSectionRecords.map((section) =>
              summarizeLaborSection(section, {
                itemCountBySectionId: laborItemCountBySectionId,
              }),
            );
            const surveySummaries = (
              surveys as Array<Record<string, unknown>>
            ).map(summarizeSurvey);
            const contactSummaries = (
              contacts as Array<Record<string, unknown>>
            ).map(summarizeContact);
            const aiKnowledgeFileSummaries = (
              aiKnowledgeFiles as Array<Record<string, unknown>>
            ).map(summarizeProjectFile);

            const openTasks = sortedTaskSummaries.filter(
              (task) => task.status !== "done",
            );

            return {
              ok: true,
              project: summarizeProject(
                (project as Record<string, unknown> | null) ?? null,
              ),
              counts: {
                tasks: sortedTaskSummaries.length,
                openTasks: openTasks.length,
                notes: noteSummaries.length,
                payments: paymentSummaries.length,
                shoppingItems: shoppingSummaries.length,
                shoppingSections: shoppingSectionSummaries.length,
                laborItems: laborSummaries.length,
                laborSections: laborSectionSummaries.length,
                surveys: surveySummaries.length,
                contacts: contactSummaries.length,
                aiKnowledgeFiles: aiKnowledgeFileSummaries.length,
                teamMembers: Array.isArray(teamMembers)
                  ? teamMembers.length
                  : 0,
              },
              currentUserClerkId: userClerkId,
              teamMembers: Array.isArray(teamMembers)
                ? teamMembers.map((member) => ({
                    clerkUserId: asNonEmptyString(
                      (member as Record<string, unknown>).clerkUserId,
                    ),
                    name: asNonEmptyString(
                      (member as Record<string, unknown>).name,
                    ),
                    email: asNonEmptyString(
                      (member as Record<string, unknown>).email,
                    ),
                  }))
                : [],
              tasks: {
                open: openTasks.slice(0, 8),
                recent: sortedTaskSummaries.slice(0, 8),
              },
              notes: noteSummaries.slice(0, 6),
              payments: paymentSummaries.slice(0, 8),
              shoppingItems: shoppingSummaries.slice(0, 15),
              shoppingSections: shoppingSectionSummaries.slice(0, 8),
              laborItems: laborSummaries.slice(0, 15),
              laborSections: laborSectionSummaries.slice(0, 8),
              surveys: surveySummaries.slice(0, 6),
              contacts: contactSummaries.slice(0, 6),
              files: aiKnowledgeFileSummaries.slice(0, 8),
            };
          }

          default:
            return {
              ok: false,
              error: `Unsupported client tool: ${name}`,
            };
        }
      } catch (error) {
        const message = extractErrorMessage(error);
        console.error("[chatkit-client-tool] tool failed", {
          requestedName: call.name,
          name,
          paramKeys: Object.keys(params),
          projectId,
          teamId,
          errorMessage: message,
        });

        return {
          ok: false,
          tool: name,
          error: message,
        };
      }
    },
    [canMakeChanges, convex, projectId, teamId, teamSlug, timezone, userClerkId],
  );
}
