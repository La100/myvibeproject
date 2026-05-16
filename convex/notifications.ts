import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { resolveTeamMemberNotificationSettings } from "../lib/teamMemberNotificationSettings";
// Keep generated API refs runtime-loaded here to avoid deep TS instantiation.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const internalLoose = require("./_generated/api").internal as any;

const CLIENT_PORTAL_DIGEST_WINDOW_MS = 60 * 60 * 1000;
const CLIENT_PORTAL_DIGEST_EVENT_VALIDATOR = v.object({
  createdAt: v.number(),
  actionType: v.union(
    v.literal("shopping.customer.decision"),
    v.literal("shopping.customer.feedback"),
    v.literal("labor.customer.decision"),
    v.literal("labor.customer.feedback"),
    v.literal("survey.response.submit"),
  ),
  actorName: v.optional(v.string()),
  entityId: v.string(),
  entityType: v.union(
    v.literal("shopping"),
    v.literal("labor"),
    v.literal("survey"),
  ),
  itemName: v.optional(v.string()),
  surveyTitle: v.optional(v.string()),
  decision: v.optional(v.union(v.literal("accepted"), v.literal("rejected"))),
  comment: v.optional(v.string()),
});

type ClientPortalDigestEvent = {
  createdAt: number;
  actionType:
    | "shopping.customer.decision"
    | "shopping.customer.feedback"
    | "labor.customer.decision"
    | "labor.customer.feedback"
    | "survey.response.submit";
  actorName?: string;
  entityId: string;
  entityType: "shopping" | "labor" | "survey";
  itemName?: string;
  surveyTitle?: string;
  decision?: "accepted" | "rejected";
  comment?: string;
};

const resolveClientPortalNotificationSettings = (
  value?: {
    sendToOwner?: boolean;
    sendToResponsible?: boolean;
    sendToAdmins?: boolean;
    recipientClerkUserIds?: string[];
  } | null,
) =>
  Array.from(
    new Set(
      (value?.recipientClerkUserIds ?? [])
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const formatDateLabel = (timestamp?: number | null) =>
  typeof timestamp === "number" && Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(timestamp))
    : "Brak terminu";
const TASK_NOTIFICATION_EVENT_TO_SETTING = {
  "task.assigned": "taskAssigned",
  "task.unassigned": "taskUnassigned",
  "task.status_updated": "taskStatusUpdated",
  "task.due_date_changed": "taskDueDateChanged",
  "task.comment_added": "taskComments",
} as const;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatDigestTime = (timestamp: number) =>
  new Date(timestamp).toLocaleString("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const formatTaskStatusLabel = (status?: string) => {
  if (!status) {
    return "nieznany";
  }

  const labels: Record<string, string> = {
    todo: "do zrobienia",
    in_progress: "w toku",
    review: "do sprawdzenia",
    done: "gotowe",
  };
  return labels[status] || status;
};

const renderDigestEventText = (event: ClientPortalDigestEvent) => {
  const actorName = event.actorName?.trim() || "Klient";
  const itemName = event.itemName?.trim() || "pozycję";
  const surveyTitle = event.surveyTitle?.trim() || "ankietę";

  if (
    event.actionType === "shopping.customer.decision" ||
    event.actionType === "labor.customer.decision"
  ) {
    const decisionLabel = event.decision === "accepted" ? "zaakceptował(a)" : "odrzucił(a)";
    return `${actorName} ${decisionLabel} "${itemName}"`;
  }

  if (
    event.actionType === "shopping.customer.feedback" ||
    event.actionType === "labor.customer.feedback"
  ) {
    return `${actorName} dodał(a) komentarz do "${itemName}"`;
  }

  return `${actorName} przesłał(a) ankietę "${surveyTitle}"`;
};

const renderDigestEventHtml = (event: ClientPortalDigestEvent) => {
  const actorName = escapeHtml(event.actorName?.trim() || "Klient");
  const itemName = escapeHtml(event.itemName?.trim() || "pozycję");
  const surveyTitle = escapeHtml(event.surveyTitle?.trim() || "ankietę");

  if (
    event.actionType === "shopping.customer.decision" ||
    event.actionType === "labor.customer.decision"
  ) {
    const decisionLabel = event.decision === "accepted" ? "zaakceptował(a)" : "odrzucił(a)";
    return `<strong>${actorName}</strong> ${decisionLabel} <strong>"${itemName}"</strong>`;
  }

  if (
    event.actionType === "shopping.customer.feedback" ||
    event.actionType === "labor.customer.feedback"
  ) {
    return `<strong>${actorName}</strong> dodał(a) komentarz do <strong>"${itemName}"</strong>`;
  }

  return `<strong>${actorName}</strong> przesłał(a) ankietę <strong>"${surveyTitle}"</strong>`;
};

const buildClientPortalDigestEmail = (args: {
  projectName: string;
  projectUrl: string;
  events: ClientPortalDigestEvent[];
}) => {
  const subjectCount = args.events.length;
  const textLines = [
    `Aktualizacje w panelu klienta dla projektu "${args.projectName}" (${subjectCount})`,
    "",
    ...args.events.flatMap((event) => {
      const lines = [
        `- ${formatDigestTime(event.createdAt)}: ${renderDigestEventText(event)}`,
      ];
      if (event.comment?.trim()) {
        lines.push(`  Komentarz: ${event.comment.trim()}`);
      }
      return lines;
    }),
    "",
    `Otwórz powiadomienia: ${args.projectUrl}`,
  ];

  const htmlItems = args.events
    .map((event) => {
      const commentHtml = event.comment?.trim()
        ? `<div><strong>Komentarz:</strong> ${escapeHtml(event.comment.trim())}</div>`
        : "";
      return `<li><div>${escapeHtml(formatDigestTime(event.createdAt))}: ${renderDigestEventHtml(
        event,
      )}</div>${commentHtml}</li>`;
    })
    .join("");

  return {
    subject: `[${args.projectName}] Aktualizacje w panelu klienta (${subjectCount})`,
    text: textLines.join("\n"),
    html: `<p>Aktualizacje w panelu klienta dla projektu <strong>${escapeHtml(args.projectName)}</strong>.</p><ul>${htmlItems}</ul><p><a href="${escapeHtml(args.projectUrl)}">Otwórz powiadomienia</a></p>`,
  };
};

const buildTaskEmailMessage = (args: {
  eventType:
    | "task.assigned"
    | "task.unassigned"
    | "task.status_updated"
    | "task.due_date_changed"
    | "task.comment_added";
  actorName?: string;
  projectName: string;
  taskTitle: string;
  taskUrl: string;
  fromStatus?: string;
  toStatus?: string;
  previousDueDate?: number | null;
  currentDueDate?: number | null;
  commentPreview?: string;
}) => {
  const actorName = args.actorName?.trim() || "Ktoś";
  const taskTitle = args.taskTitle.trim() || "Zadanie bez tytułu";

  if (args.eventType === "task.assigned") {
    return {
      subject: `[${args.projectName}] Przypisano zadanie: "${taskTitle}"`,
      text: `${actorName} przypisał(a) Cię do zadania "${taskTitle}" w projekcie "${args.projectName}".\n\nOtwórz zadanie: ${args.taskUrl}`,
      html: `<p><strong>${escapeHtml(actorName)}</strong> przypisał(a) Cię do zadania <strong>"${escapeHtml(taskTitle)}"</strong> w projekcie <strong>${escapeHtml(args.projectName)}</strong>.</p><p><a href="${escapeHtml(args.taskUrl)}">Otwórz zadanie</a></p>`,
    };
  }

  if (args.eventType === "task.unassigned") {
    return {
      subject: `[${args.projectName}] Usunięto przypisanie: "${taskTitle}"`,
      text: `${actorName} usunął/usunęła Cię z zadania "${taskTitle}" w projekcie "${args.projectName}".\n\nOtwórz zadanie: ${args.taskUrl}`,
      html: `<p><strong>${escapeHtml(actorName)}</strong> usunął/usunęła Cię z zadania <strong>"${escapeHtml(taskTitle)}"</strong> w projekcie <strong>${escapeHtml(args.projectName)}</strong>.</p><p><a href="${escapeHtml(args.taskUrl)}">Otwórz zadanie</a></p>`,
    };
  }

  if (args.eventType === "task.status_updated") {
    const fromStatus = formatTaskStatusLabel(args.fromStatus);
    const toStatus = formatTaskStatusLabel(args.toStatus);

    return {
      subject: `[${args.projectName}] Zmieniono status zadania: "${taskTitle}"`,
      text: `${actorName} zmienił(a) status zadania "${taskTitle}" z ${fromStatus} na ${toStatus}.\n\nOtwórz zadanie: ${args.taskUrl}`,
      html: `<p><strong>${escapeHtml(actorName)}</strong> zmienił(a) status zadania <strong>"${escapeHtml(taskTitle)}"</strong> z <strong>${escapeHtml(fromStatus)}</strong> na <strong>${escapeHtml(toStatus)}</strong>.</p><p><a href="${escapeHtml(args.taskUrl)}">Otwórz zadanie</a></p>`,
    };
  }

  if (args.eventType === "task.due_date_changed") {
    return {
      subject: `[${args.projectName}] Zmieniono termin zadania: "${taskTitle}"`,
      text: `${actorName} zaktualizował(a) termin zadania "${taskTitle}".\nPoprzedni termin: ${formatDateLabel(args.previousDueDate)}\nNowy termin: ${formatDateLabel(args.currentDueDate)}\n\nOtwórz zadanie: ${args.taskUrl}`,
      html: `<p><strong>${escapeHtml(actorName)}</strong> zaktualizował(a) termin zadania <strong>"${escapeHtml(taskTitle)}"</strong>.</p><p><strong>Poprzedni termin:</strong> ${escapeHtml(formatDateLabel(args.previousDueDate))}<br/><strong>Nowy termin:</strong> ${escapeHtml(formatDateLabel(args.currentDueDate))}</p><p><a href="${escapeHtml(args.taskUrl)}">Otwórz zadanie</a></p>`,
    };
  }

  const commentPreview =
    args.commentPreview?.trim() || "Brak podglądu komentarza.";
  return {
    subject: `[${args.projectName}] Nowy komentarz do zadania: "${taskTitle}"`,
    text: `${actorName} dodał(a) komentarz do zadania "${taskTitle}" w projekcie "${args.projectName}".\n\nKomentarz: ${commentPreview}\n\nOtwórz zadanie: ${args.taskUrl}`,
    html: `<p><strong>${escapeHtml(actorName)}</strong> dodał(a) komentarz do zadania <strong>"${escapeHtml(taskTitle)}"</strong> w projekcie <strong>${escapeHtml(args.projectName)}</strong>.</p><p><strong>Komentarz:</strong> ${escapeHtml(commentPreview)}</p><p><a href="${escapeHtml(args.taskUrl)}">Otwórz zadanie</a></p>`,
  };
};

export const getEmailNotificationContext = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }

    const teamMembers = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", project.teamId))
      .collect();

    const activeMembers = teamMembers.filter(
      (member) =>
        member.isActive &&
        (member.role === "admin" || member.role === "member"),
    );
    const activeMembersById = new Map(
      activeMembers.map((member) => [member.clerkUserId, member]),
    );
    const settings = (project as {
      clientPortalNotificationSettings?: {
        sendToOwner?: boolean;
        sendToResponsible?: boolean;
        sendToAdmins?: boolean;
        recipientClerkUserIds?: string[];
      };
    }).clientPortalNotificationSettings;
    const responsibleClerkUserId = (
      project as { responsibleClerkUserId?: string }
    ).responsibleClerkUserId;

    let candidateIds = resolveClientPortalNotificationSettings(settings);

    if (candidateIds.length === 0) {
      candidateIds = [project.createdBy];
      if (responsibleClerkUserId) {
        candidateIds.push(responsibleClerkUserId);
      }
      candidateIds.push(
        ...activeMembers
          .filter((member) => member.role === "admin")
          .map((member) => member.clerkUserId),
      );
    }

    const orderedCandidateIds = Array.from(
      new Set(
        candidateIds
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    );

    const recipients: Array<{
      email: string;
      name: string | null;
      clerkUserId: string;
    }> = [];
    const seenEmails = new Set<string>();

    for (const clerkUserId of orderedCandidateIds) {
      if (!activeMembersById.has(clerkUserId)) {
        continue;
      }

      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
        .unique();

      if (user && isValidEmail(user.email)) {
        const normalizedEmail = user.email.trim().toLowerCase();
        if (seenEmails.has(normalizedEmail)) {
          continue;
        }

        seenEmails.add(normalizedEmail);
        recipients.push({
          email: user.email,
          name: user.name || null,
          clerkUserId,
        });
      }
    }

    if (recipients.length === 0) {
      const fallbackIds = Array.from(
        new Set(
          [
            project.createdBy,
            responsibleClerkUserId,
            ...activeMembers
              .filter((member) => member.role === "admin")
              .map((member) => member.clerkUserId),
          ].filter(
            (value): value is string =>
              typeof value === "string" && value.trim().length > 0,
          ),
        ),
      );

      for (const clerkUserId of fallbackIds) {
        if (!activeMembersById.has(clerkUserId)) {
          continue;
        }

        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", (q) =>
            q.eq("clerkUserId", clerkUserId),
          )
          .unique();

        if (!user || !isValidEmail(user.email)) {
          continue;
        }

        const normalizedEmail = user.email.trim().toLowerCase();
        if (seenEmails.has(normalizedEmail)) {
          continue;
        }

        seenEmails.add(normalizedEmail);
        recipients.push({
          email: user.email,
          name: user.name || null,
          clerkUserId,
        });
      }
    }

    return {
      projectName: project.name,
      projectSlug: project.slug,
      recipients,
    };
  },
});

export const getTaskEventEmailContext = internalQuery({
  args: {
    taskId: v.id("tasks"),
    eventType: v.union(
      v.literal("task.assigned"),
      v.literal("task.unassigned"),
      v.literal("task.status_updated"),
      v.literal("task.due_date_changed"),
      v.literal("task.comment_added"),
    ),
    recipientClerkUserIds: v.array(v.string()),
    actorClerkUserId: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      return null;
    }

    const project = await ctx.db.get(task.projectId);
    if (!project) {
      return null;
    }

    const teamMembers = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", task.teamId))
      .collect();

    const recipientIds = new Set(
      args.recipientClerkUserIds.map((entry) => entry.trim()).filter(Boolean),
    );
    if (recipientIds.size === 0) {
      return null;
    }

    const settingKey = TASK_NOTIFICATION_EVENT_TO_SETTING[args.eventType];
    const recipients: Array<{
      email: string;
      name: string | null;
      clerkUserId: string;
    }> = [];

    for (const member of teamMembers) {
      if (
        !member.isActive ||
        (member.role !== "admin" && member.role !== "member")
      ) {
        continue;
      }

      if (!recipientIds.has(member.clerkUserId)) {
        continue;
      }

      if (
        args.actorClerkUserId &&
        member.clerkUserId === args.actorClerkUserId
      ) {
        continue;
      }

      const settings = resolveTeamMemberNotificationSettings(
        member.notificationSettings,
      );
      if (!settings[settingKey]) {
        continue;
      }

      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q) =>
          q.eq("clerkUserId", member.clerkUserId),
        )
        .unique();

      if (!user || !isValidEmail(user.email)) {
        continue;
      }

      recipients.push({
        email: user.email,
        name: user.name || null,
        clerkUserId: member.clerkUserId,
      });
    }

    const actor = args.actorClerkUserId
      ? await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", (q) =>
            q.eq("clerkUserId", args.actorClerkUserId as string),
          )
          .unique()
      : null;

    return {
      taskTitle: task.title,
      projectName: project.name,
      projectSlug: project.slug,
      recipients,
      actorName: actor?.name || actor?.email || null,
    };
  },
});

export const enqueueClientPortalDigestEvent = internalMutation({
  args: {
    projectId: v.id("projects"),
    event: CLIENT_PORTAL_DIGEST_EVENT_VALIDATOR,
  },
  async handler(ctx, args) {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return { digestId: null, created: false };
    }

    const activeDigest = await ctx.db
      .query("clientPortalNotificationDigests")
      .withIndex("by_project_and_status", (q) =>
        q.eq("projectId", args.projectId).eq("status", "pending"),
      )
      .unique();

    if (activeDigest) {
      await ctx.db.patch(activeDigest._id, {
        events: [...activeDigest.events, args.event],
        lastEventAt: Math.max(activeDigest.lastEventAt, args.event.createdAt),
      });
      return { digestId: activeDigest._id, created: false };
    }

    const digestId = await ctx.db.insert("clientPortalNotificationDigests", {
      projectId: args.projectId,
      teamId: project.teamId,
      status: "pending",
      startedAt: args.event.createdAt,
      sendAt: args.event.createdAt + CLIENT_PORTAL_DIGEST_WINDOW_MS,
      lastEventAt: args.event.createdAt,
      events: [args.event],
    });

    await ctx.scheduler.runAfter(
      CLIENT_PORTAL_DIGEST_WINDOW_MS,
      internalLoose.notifications.processClientPortalDigest,
      { digestId },
    );

    return { digestId, created: true };
  },
});

export const getClientPortalDigestContext = internalQuery({
  args: {
    digestId: v.id("clientPortalNotificationDigests"),
  },
  async handler(ctx, args) {
    const digest = await ctx.db.get(args.digestId);
    if (!digest) {
      return null;
    }

    const project = await ctx.db.get(digest.projectId);
    if (!project) {
      return null;
    }

    const notificationContext = await ctx.runQuery(
      internalLoose.notifications.getEmailNotificationContext,
      { projectId: digest.projectId },
    );

    if (!notificationContext) {
      return null;
    }

    return {
      digest,
      projectName: notificationContext.projectName,
      projectSlug: notificationContext.projectSlug,
      recipients: notificationContext.recipients,
    };
  },
});

export const markClientPortalDigestStatus = internalMutation({
  args: {
    digestId: v.id("clientPortalNotificationDigests"),
    status: v.union(
      v.literal("sending"),
      v.literal("sent"),
      v.literal("failed"),
    ),
    lastError: v.optional(v.string()),
    sentAt: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const digest = await ctx.db.get(args.digestId);
    if (!digest) {
      return null;
    }

    const patch: {
      status: "sending" | "sent" | "failed";
      lastError?: string;
      sentAt?: number;
    } = {
      status: args.status,
    };
    if (typeof args.lastError === "string") {
      patch.lastError = args.lastError;
    }
    if (typeof args.sentAt === "number") {
      patch.sentAt = args.sentAt;
    }

    await ctx.db.patch(args.digestId, patch);

    return null;
  },
});

export const processClientPortalDigest = internalAction({
  args: {
    digestId: v.id("clientPortalNotificationDigests"),
  },
  async handler(ctx, args) {
    const digestContext = await ctx.runQuery(
      internalLoose.notifications.getClientPortalDigestContext,
      { digestId: args.digestId },
    );

    if (!digestContext) {
      return { sent: 0, skipped: true };
    }

    const { digest, projectName, projectSlug, recipients } = digestContext;
    if (digest.status !== "pending") {
      return { sent: 0, skipped: true };
    }

    if (digest.sendAt > Date.now()) {
      return { sent: 0, skipped: true };
    }

    if (digest.events.length === 0 || recipients.length === 0) {
      await ctx.runMutation(internalLoose.notifications.markClientPortalDigestStatus, {
        digestId: args.digestId,
        status: "sent",
        sentAt: Date.now(),
      });
      return { sent: 0, skipped: true };
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFromEmail = process.env.RESEND_FROM_EMAIL;
    if (!resendApiKey || !resendFromEmail) {
      console.warn(
        "Resend email skipped: RESEND_API_KEY or RESEND_FROM_EMAIL not configured.",
      );
      await ctx.runMutation(internalLoose.notifications.markClientPortalDigestStatus, {
        digestId: args.digestId,
        status: "failed",
        lastError: "RESEND_API_KEY or RESEND_FROM_EMAIL not configured",
      });
      return { sent: 0, skipped: true };
    }

    await ctx.runMutation(internalLoose.notifications.markClientPortalDigestStatus, {
      digestId: args.digestId,
      status: "sending",
    });

    const baseUrl = trimTrailingSlash(
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001",
    );
    const projectUrl = `${baseUrl}/organisation/projects/${projectSlug}/changelog`;
    const orderedEvents = [...digest.events].sort(
      (left, right) => left.createdAt - right.createdAt,
    );
    const message = buildClientPortalDigestEmail({
      projectName,
      projectUrl,
      events: orderedEvents,
    });

    let sent = 0;
    let lastError: string | undefined;
    for (const recipient of recipients) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: resendFromEmail,
            to: [recipient.email],
            subject: message.subject,
            text: message.text,
            html: message.html,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          lastError = `${response.status} ${response.statusText} ${errorText}`;
          console.error(
            `Resend send failed for ${recipient.email}: ${lastError}`,
          );
          continue;
        }

        sent += 1;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.error(`Resend send failed for ${recipient.email}:`, error);
      }
    }

    await ctx.runMutation(internalLoose.notifications.markClientPortalDigestStatus, {
      digestId: args.digestId,
      status: sent > 0 ? "sent" : "failed",
      sentAt: sent > 0 ? Date.now() : undefined,
      lastError,
    });

    return { sent, skipped: false };
  },
});

export const sendTaskEventEmail = internalAction({
  args: {
    taskId: v.id("tasks"),
    eventType: v.union(
      v.literal("task.assigned"),
      v.literal("task.unassigned"),
      v.literal("task.status_updated"),
      v.literal("task.due_date_changed"),
      v.literal("task.comment_added"),
    ),
    recipientClerkUserIds: v.array(v.string()),
    actorClerkUserId: v.optional(v.string()),
    fromStatus: v.optional(v.string()),
    toStatus: v.optional(v.string()),
    previousDueDate: v.optional(v.union(v.number(), v.null())),
    currentDueDate: v.optional(v.union(v.number(), v.null())),
    commentPreview: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFromEmail = process.env.RESEND_FROM_EMAIL;
    if (!resendApiKey || !resendFromEmail) {
      console.warn(
        "Resend email skipped: RESEND_API_KEY or RESEND_FROM_EMAIL not configured.",
      );
      return { sent: 0, skipped: true };
    }

    const notificationContext = await ctx.runQuery(
      internalLoose.notifications.getTaskEventEmailContext,
      {
        taskId: args.taskId,
        eventType: args.eventType,
        recipientClerkUserIds: args.recipientClerkUserIds,
        actorClerkUserId: args.actorClerkUserId,
      },
    );

    if (!notificationContext || notificationContext.recipients.length === 0) {
      return { sent: 0, skipped: true };
    }

    const baseUrl = trimTrailingSlash(
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001",
    );
    const taskUrl = `${baseUrl}/organisation/projects/${notificationContext.projectSlug}/tasks/${args.taskId}`;
    const message = buildTaskEmailMessage({
      eventType: args.eventType,
      actorName: notificationContext.actorName ?? undefined,
      projectName: notificationContext.projectName,
      taskTitle: notificationContext.taskTitle,
      taskUrl,
      fromStatus: args.fromStatus,
      toStatus: args.toStatus,
      previousDueDate: args.previousDueDate ?? undefined,
      currentDueDate: args.currentDueDate ?? undefined,
      commentPreview: args.commentPreview,
    });

    let sent = 0;
    for (const recipient of notificationContext.recipients) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: resendFromEmail,
            to: [recipient.email],
            subject: message.subject,
            text: message.text,
            html: message.html,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `Resend send failed for ${recipient.email}: ${response.status} ${response.statusText} ${errorText}`,
          );
          continue;
        }

        sent += 1;
      } catch (error) {
        console.error(`Resend send failed for ${recipient.email}:`, error);
      }
    }

    return { sent, skipped: false };
  },
});
