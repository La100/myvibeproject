import { v } from "convex/values";
import { internalAction, internalQuery } from "./_generated/server";
import { resolveTeamMemberNotificationSettings } from "../lib/teamMemberNotificationSettings";
// Keep generated API refs runtime-loaded here to avoid deep TS instantiation.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const internalLoose = require("./_generated/api").internal as any;

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const formatDateLabel = (timestamp?: number | null) =>
  typeof timestamp === "number" && Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString().slice(0, 10)
    : "No due date";
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

const buildEmailMessage = (args: {
  actionType:
    | "shopping.customer.decision"
    | "shopping.customer.feedback"
    | "labor.customer.decision"
    | "labor.customer.feedback"
    | "survey.response.submit";
  actorName?: string;
  projectName: string;
  projectUrl: string;
  itemName?: string;
  surveyTitle?: string;
  decision?: "accepted" | "rejected";
  comment?: string;
}) => {
  const actorName = args.actorName?.trim() || "Client";
  const itemName = args.itemName?.trim() || "item";
  const surveyTitle = args.surveyTitle?.trim() || "survey";

  if (
    args.actionType === "shopping.customer.decision" ||
    args.actionType === "labor.customer.decision"
  ) {
    const decisionLabel =
      args.decision === "accepted" ? "accepted" : "rejected";
    return {
      subject: `[${args.projectName}] Client ${decisionLabel} "${itemName}"`,
      text: `${actorName} ${decisionLabel} "${itemName}" in client portal for project "${args.projectName}".\n\nOpen notifications: ${args.projectUrl}`,
      html: `<p><strong>${escapeHtml(actorName)}</strong> ${decisionLabel} <strong>"${escapeHtml(itemName)}"</strong> in client portal for project <strong>${escapeHtml(args.projectName)}</strong>.</p><p><a href="${escapeHtml(args.projectUrl)}">Open notifications</a></p>`,
    };
  }

  if (
    args.actionType === "shopping.customer.feedback" ||
    args.actionType === "labor.customer.feedback"
  ) {
    const commentPreview =
      args.comment?.trim() || "No comment preview available.";
    return {
      subject: `[${args.projectName}] Client left a comment on "${itemName}"`,
      text: `${actorName} left a comment on "${itemName}" in client portal for project "${args.projectName}".\n\nComment: ${commentPreview}\n\nOpen notifications: ${args.projectUrl}`,
      html: `<p><strong>${escapeHtml(actorName)}</strong> left a comment on <strong>"${escapeHtml(itemName)}"</strong> in client portal for project <strong>${escapeHtml(args.projectName)}</strong>.</p><p><strong>Comment:</strong> ${escapeHtml(commentPreview)}</p><p><a href="${escapeHtml(args.projectUrl)}">Open notifications</a></p>`,
    };
  }

  return {
    subject: `[${args.projectName}] Client submitted survey "${surveyTitle}"`,
    text: `${actorName} submitted survey "${surveyTitle}" in client portal for project "${args.projectName}".\n\nOpen notifications: ${args.projectUrl}`,
    html: `<p><strong>${escapeHtml(actorName)}</strong> submitted survey <strong>"${escapeHtml(surveyTitle)}"</strong> in client portal for project <strong>${escapeHtml(args.projectName)}</strong>.</p><p><a href="${escapeHtml(args.projectUrl)}">Open notifications</a></p>`,
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
  const actorName = args.actorName?.trim() || "Someone";
  const taskTitle = args.taskTitle.trim() || "Untitled task";

  if (args.eventType === "task.assigned") {
    return {
      subject: `[${args.projectName}] Task assigned: "${taskTitle}"`,
      text: `${actorName} assigned you to "${taskTitle}" in project "${args.projectName}".\n\nOpen task: ${args.taskUrl}`,
      html: `<p><strong>${escapeHtml(actorName)}</strong> assigned you to <strong>"${escapeHtml(taskTitle)}"</strong> in project <strong>${escapeHtml(args.projectName)}</strong>.</p><p><a href="${escapeHtml(args.taskUrl)}">Open task</a></p>`,
    };
  }

  if (args.eventType === "task.unassigned") {
    return {
      subject: `[${args.projectName}] Task unassigned: "${taskTitle}"`,
      text: `${actorName} removed you from "${taskTitle}" in project "${args.projectName}".\n\nOpen task: ${args.taskUrl}`,
      html: `<p><strong>${escapeHtml(actorName)}</strong> removed you from <strong>"${escapeHtml(taskTitle)}"</strong> in project <strong>${escapeHtml(args.projectName)}</strong>.</p><p><a href="${escapeHtml(args.taskUrl)}">Open task</a></p>`,
    };
  }

  if (args.eventType === "task.status_updated") {
    return {
      subject: `[${args.projectName}] Task status updated: "${taskTitle}"`,
      text: `${actorName} changed the status of "${taskTitle}" from ${args.fromStatus || "unknown"} to ${args.toStatus || "unknown"}.\n\nOpen task: ${args.taskUrl}`,
      html: `<p><strong>${escapeHtml(actorName)}</strong> changed the status of <strong>"${escapeHtml(taskTitle)}"</strong> from <strong>${escapeHtml(args.fromStatus || "unknown")}</strong> to <strong>${escapeHtml(args.toStatus || "unknown")}</strong>.</p><p><a href="${escapeHtml(args.taskUrl)}">Open task</a></p>`,
    };
  }

  if (args.eventType === "task.due_date_changed") {
    return {
      subject: `[${args.projectName}] Due date changed: "${taskTitle}"`,
      text: `${actorName} updated the due date of "${taskTitle}".\nPrevious due date: ${formatDateLabel(args.previousDueDate)}\nNew due date: ${formatDateLabel(args.currentDueDate)}\n\nOpen task: ${args.taskUrl}`,
      html: `<p><strong>${escapeHtml(actorName)}</strong> updated the due date of <strong>"${escapeHtml(taskTitle)}"</strong>.</p><p><strong>Previous due date:</strong> ${escapeHtml(formatDateLabel(args.previousDueDate))}<br/><strong>New due date:</strong> ${escapeHtml(formatDateLabel(args.currentDueDate))}</p><p><a href="${escapeHtml(args.taskUrl)}">Open task</a></p>`,
    };
  }

  const commentPreview =
    args.commentPreview?.trim() || "No comment preview available.";
  return {
    subject: `[${args.projectName}] New task comment: "${taskTitle}"`,
    text: `${actorName} commented on "${taskTitle}" in project "${args.projectName}".\n\nComment: ${commentPreview}\n\nOpen task: ${args.taskUrl}`,
    html: `<p><strong>${escapeHtml(actorName)}</strong> commented on <strong>"${escapeHtml(taskTitle)}"</strong> in project <strong>${escapeHtml(args.projectName)}</strong>.</p><p><strong>Comment:</strong> ${escapeHtml(commentPreview)}</p><p><a href="${escapeHtml(args.taskUrl)}">Open task</a></p>`,
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
    const activeMemberIds = new Set(
      activeMembers.map((member) => member.clerkUserId),
    );

    const responsibleClerkUserId = (
      project as { responsibleClerkUserId?: string }
    ).responsibleClerkUserId;
    const candidateIds = Array.from(
      new Set(
        [
          responsibleClerkUserId,
          project.createdBy,
          ...activeMembers.map((member) => member.clerkUserId),
        ].filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        ),
      ),
    );

    let selectedRecipient: {
      email: string;
      name: string | null;
      clerkUserId: string;
    } | null = null;

    for (const clerkUserId of candidateIds) {
      if (!activeMemberIds.has(clerkUserId)) {
        continue;
      }

      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
        .unique();

      if (user && isValidEmail(user.email)) {
        selectedRecipient = {
          email: user.email,
          name: user.name || null,
          clerkUserId,
        };
        break;
      }
    }

    const recipients = selectedRecipient ? [selectedRecipient] : [];

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

export const sendClientPortalEventEmail = internalAction({
  args: {
    projectId: v.id("projects"),
    actionType: v.union(
      v.literal("shopping.customer.decision"),
      v.literal("shopping.customer.feedback"),
      v.literal("labor.customer.decision"),
      v.literal("labor.customer.feedback"),
      v.literal("survey.response.submit"),
    ),
    actorName: v.optional(v.string()),
    itemName: v.optional(v.string()),
    surveyTitle: v.optional(v.string()),
    decision: v.optional(v.union(v.literal("accepted"), v.literal("rejected"))),
    comment: v.optional(v.string()),
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
      internalLoose.notifications.getEmailNotificationContext,
      { projectId: args.projectId },
    );

    if (!notificationContext || notificationContext.recipients.length === 0) {
      return { sent: 0, skipped: true };
    }

    const baseUrl = trimTrailingSlash(
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001",
    );
    const projectUrl = `${baseUrl}/organisation/projects/${notificationContext.projectSlug}/changelog`;
    const message = buildEmailMessage({
      actionType: args.actionType,
      actorName: args.actorName,
      projectName: notificationContext.projectName,
      projectUrl,
      itemName: args.itemName,
      surveyTitle: args.surveyTitle,
      decision: args.decision,
      comment: args.comment,
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
