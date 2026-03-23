import type {
  PendingApprovalState,
  PendingContentItem,
  PendingContentType,
} from "../../data/types";

export const TYPE_COLORS: Record<string, string> = {
  task: "bg-card border-border/50 shadow-sm",
  note: "bg-card border-border/50 shadow-sm",
  moodboard: "bg-card border-border/50 shadow-sm",
  shopping: "bg-card border-border/50 shadow-sm",
  survey: "bg-card border-border/50 shadow-sm",
  contact: "bg-card border-border/50 shadow-sm",
  shoppingSection: "bg-card border-border/50 shadow-sm",
  labor: "bg-card border-border/50 shadow-sm",
  laborSection: "bg-card border-border/50 shadow-sm",
  projectSettings: "bg-card border-border/50 shadow-sm",
};

export const OPERATION_LABELS: Record<
  string,
  { label: string; color: string }
> = {
  create: {
    label: "Create",
    color: "bg-primary/10 text-primary hover:bg-primary/20",
  },
  bulk_create: {
    label: "Create",
    color: "bg-primary/10 text-primary hover:bg-primary/20",
  },
  edit: {
    label: "Edit",
    color: "bg-primary/10 text-primary hover:bg-primary/20",
  },
  bulk_edit: {
    label: "Edit",
    color: "bg-primary/10 text-primary hover:bg-primary/20",
  },
  delete: {
    label: "Delete",
    color: "bg-destructive/10 text-destructive hover:bg-destructive/20",
  },
};

export function getCanonicalType(type: PendingContentType): string {
  return type;
}

export function getTitle(item: PendingContentItem): string {
  if (item.display?.title) {
    return item.display.title;
  }
  const data = item.originalItem || item.data;
  return (
    (data?.title as string) ||
    (data?.name as string) ||
    (data?.questionText as string) ||
    "Untitled"
  );
}

export function getDescription(item: PendingContentItem): string | undefined {
  if (item.display?.description) {
    return item.display.description;
  }
  const data = item.originalItem || item.data;
  return (
    (data?.description as string) ||
    (data?.moodboardSection as string) ||
    (data?.content as string) ||
    (data?.notes as string)
  );
}

export function getOperation(item: PendingContentItem): string {
  if (item.operation) return item.operation;
  return "create";
}

export function getApprovalState(item: PendingContentItem): PendingApprovalState {
  if (item.approvalState) {
    return item.approvalState;
  }
  if (item.status === "confirmed") return "output-available";
  if (item.status === "rejected") return "output-denied";
  return "approval-requested";
}

export function shouldRenderByState(state: PendingApprovalState): boolean {
  return state !== "input-streaming" && state !== "input-available";
}

export function getApprovalLabel(state: PendingApprovalState): string | null {
  switch (state) {
    case "approval-requested":
      return "Awaiting approval";
    case "approval-responded":
      return "Responded";
    case "output-available":
      return "Approved";
    case "output-denied":
      return "Rejected";
    case "output-error":
      return "Failed";
    case "input-streaming":
    case "input-available":
    default:
      return null;
  }
}

export function extractBulkCreateEntries(
  item: PendingContentItem,
): Record<string, unknown>[] {
  if (item.operation !== "bulk_create") return [];

  const data = item.data as Record<string, unknown> | undefined;
  if (!data) return [];

  const bulkKeys = ["items", "tasks", "notes", "surveys", "contacts", "laborItems"];
  for (const key of bulkKeys) {
    const value = data[key];
    if (Array.isArray(value)) {
      return value.filter(
        (entry): entry is Record<string, unknown> =>
          !!entry && typeof entry === "object",
      );
    }
  }

  return [];
}
