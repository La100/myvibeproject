export type ApprovalType =
  | "material"
  | "estimate"
  | "visualization"
  | "moodboard"
  | "scope"
  | "milestone"
  | "payment"
  | "other";

export type ApprovalStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "commented"
  | "approved"
  | "rejected"
  | "expired";

export type ApprovalDecision = "approved" | "rejected";

export type ApprovalRecord = {
  _id?: string;
  type: ApprovalType;
  title: string;
  description?: string | null;
  dueDate?: number | null;
  currentVersion: number;
  status: ApprovalStatus;
  sentAt?: number | null;
  viewedAt?: number | null;
  decidedAt?: number | null;
  lastCommentAt?: number | null;
  clientDecision?: ApprovalDecision | null;
  clientComment?: string | null;
  clientRespondentName?: string | null;
  clientRespondentKey?: string | null;
  resolvedVersion?: number | null;
  latestVersionSummary?: string | null;
  latestVersionDetails?: string | null;
  latestVersionItems?: string[] | null;
  latestVersionReferenceIds?: string[] | null;
};

export type ApprovalVersionRecord = {
  approvalId: string;
  projectId: string;
  teamId: string;
  version: number;
  title: string;
  summary?: string;
  details?: string;
  items?: string[];
  referenceIds?: string[];
  dueDate?: number;
  createdBy: string;
  createdAt: number;
};

export type ApprovalCreateInput = {
  projectId: string;
  teamId: string;
  type: ApprovalType;
  title: string;
  description?: string | null;
  summary?: string | null;
  details?: string | null;
  items?: string[];
  referenceIds?: string[];
  dueDate?: number | null;
  sendNow?: boolean;
  requesterUserId: string;
};

export type ApprovalUpdateInput = {
  type?: ApprovalType;
  title?: string;
  description?: string | null;
  summary?: string | null;
  details?: string | null;
  items?: string[];
  referenceIds?: string[];
  dueDate?: number | null;
  sendNow?: boolean;
};

const normalizeText = (value?: string | null) => value?.trim() || undefined;

const normalizeList = (values?: string[]) => {
  if (!values) return undefined;
  const normalized = values
    .map((value) => value.trim())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
};

export function filterVisibleApprovals<T extends { status: string }>(approvals: T[]) {
  return approvals.filter((approval) => approval.status !== "draft");
}

export function buildApprovalSummary<T extends { status: string }>(items: T[]) {
  return {
    total: items.length,
    pending: items.filter((item) =>
      ["sent", "viewed", "commented"].includes(item.status),
    ).length,
    approved: items.filter((item) => item.status === "approved").length,
    rejected: items.filter((item) => item.status === "rejected").length,
    drafts: items.filter((item) => item.status === "draft").length,
  };
}

export function buildCreateApprovalRecord(
  input: ApprovalCreateInput,
  now: number = Date.now(),
) {
  return {
    projectId: input.projectId,
    teamId: input.teamId,
    type: input.type,
    title: input.title.trim(),
    description: normalizeText(input.description),
    status: input.sendNow ? "sent" : "draft",
    dueDate: input.dueDate ?? undefined,
    currentVersion: 1,
    requesterUserId: input.requesterUserId,
    sentAt: input.sendNow ? now : undefined,
    latestVersionSummary: normalizeText(input.summary),
    latestVersionDetails: normalizeText(input.details),
    latestVersionItems: normalizeList(input.items),
    latestVersionReferenceIds: normalizeList(input.referenceIds),
    updatedAt: now,
  };
}

export function buildApprovalVersionRecord(
  input: Omit<ApprovalVersionRecord, "createdAt" | "title"> & {
    title: string;
    summary?: string | null;
    details?: string | null;
    items?: string[];
    referenceIds?: string[];
  },
  now: number = Date.now(),
): ApprovalVersionRecord {
  return {
    approvalId: input.approvalId,
    projectId: input.projectId,
    teamId: input.teamId,
    version: input.version,
    title: input.title.trim(),
    summary: normalizeText(input.summary),
    details: normalizeText(input.details),
    items: normalizeList(input.items),
    referenceIds: normalizeList(input.referenceIds),
    dueDate: input.dueDate,
    createdBy: input.createdBy,
    createdAt: now,
  };
}

export function buildApprovalUpdateArtifacts(
  approval: ApprovalRecord,
  input: ApprovalUpdateInput,
  now: number = Date.now(),
) {
  const nextStatus: ApprovalStatus = input.sendNow ? "sent" : "draft";
  const nextVersion = approval.currentVersion + 1;
  const nextTitle = input.title?.trim() || approval.title;
  const nextSummary =
    input.summary !== undefined
      ? normalizeText(input.summary)
      : approval.latestVersionSummary ?? undefined;
  const nextDetails =
    input.details !== undefined
      ? normalizeText(input.details)
      : approval.latestVersionDetails ?? undefined;
  const nextItems =
    input.items !== undefined
      ? normalizeList(input.items)
      : approval.latestVersionItems ?? undefined;
  const nextReferenceIds =
    input.referenceIds !== undefined
      ? normalizeList(input.referenceIds)
      : approval.latestVersionReferenceIds ?? undefined;
  const nextDueDate =
    input.dueDate !== undefined
      ? input.dueDate ?? undefined
      : approval.dueDate ?? undefined;

  return {
    nextVersion,
    versionRecord: {
      version: nextVersion,
      title: nextTitle,
      summary: nextSummary,
      details: nextDetails,
      items: nextItems,
      referenceIds: nextReferenceIds,
      dueDate: nextDueDate,
    },
    patch: {
      type: input.type ?? approval.type,
      title: nextTitle,
      description:
        input.description !== undefined
          ? normalizeText(input.description)
          : approval.description ?? undefined,
      dueDate: nextDueDate,
      currentVersion: nextVersion,
      status: nextStatus,
      sentAt: input.sendNow ? now : approval.sentAt ?? undefined,
      viewedAt: undefined,
      decidedAt: undefined,
      lastCommentAt: undefined,
      clientDecision: undefined,
      clientComment: undefined,
      clientRespondentName: undefined,
      clientRespondentKey: undefined,
      resolvedVersion: undefined,
      latestVersionSummary: nextSummary,
      latestVersionDetails: nextDetails,
      latestVersionItems: nextItems,
      latestVersionReferenceIds: nextReferenceIds,
      updatedAt: now,
    },
  };
}

export function buildApprovalViewedPatch(
  approval: ApprovalRecord,
  respondentName?: string,
  now: number = Date.now(),
) {
  if (approval.status !== "sent") {
    return null;
  }

  return {
    status: "viewed" as const,
    viewedAt: approval.viewedAt || now,
    updatedAt: now,
    clientRespondentName:
      normalizeText(respondentName) || approval.clientRespondentName || undefined,
  };
}

export function buildApprovalDecisionArtifacts(
  approval: ApprovalRecord,
  input: {
    decision: ApprovalDecision;
    comment?: string | null;
    respondentName?: string;
    respondentKey?: string;
  },
  now: number = Date.now(),
) {
  const normalizedComment = normalizeText(input.comment);
  const nextStatus: ApprovalStatus =
    input.decision === "approved" ? "approved" : "rejected";
  const normalizedRespondentName =
    normalizeText(input.respondentName) ||
    approval.clientRespondentName ||
    undefined;
  const normalizedRespondentKey =
    normalizeText(input.respondentKey) ||
    approval.clientRespondentKey ||
    undefined;

  return {
    patch: {
      status: nextStatus,
      viewedAt: approval.viewedAt || now,
      decidedAt: now,
      lastCommentAt: normalizedComment
        ? now
        : approval.lastCommentAt ?? undefined,
      clientDecision: input.decision,
      clientComment: normalizedComment,
      clientRespondentName: normalizedRespondentName,
      clientRespondentKey: normalizedRespondentKey,
      resolvedVersion: approval.currentVersion,
      updatedAt: now,
    },
    activity: {
      userId: normalizedRespondentKey || "client_portal",
      actionType: "approval.client_decision",
      details: {
        title: approval.title,
        decision: input.decision,
        comment: normalizedComment || null,
        respondentName: normalizedRespondentName || null,
      },
    },
    response: {
      success: true,
      status: nextStatus,
      decidedAt: now,
    },
  };
}
