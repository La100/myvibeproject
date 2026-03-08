import { v } from "convex/values";
import { internalAction, internalQuery } from "./_generated/server";
// Keep generated API refs runtime-loaded here to avoid deep TS instantiation.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const internalLoose = require("./_generated/api").internal as any;

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildEmailMessage = (args: {
  actionType: "shopping.customer.decision" | "survey.response.submit";
  actorName?: string;
  projectName: string;
  projectUrl: string;
  itemName?: string;
  surveyTitle?: string;
  decision?: "accepted" | "rejected";
}) => {
  const actorName = args.actorName?.trim() || "Client";
  const itemName = args.itemName?.trim() || "shopping item";
  const surveyTitle = args.surveyTitle?.trim() || "survey";

  if (args.actionType === "shopping.customer.decision") {
    const decisionLabel = args.decision === "accepted" ? "accepted" : "rejected";
    return {
      subject: `[${args.projectName}] Client ${decisionLabel} "${itemName}"`,
      text: `${actorName} ${decisionLabel} "${itemName}" in client portal for project "${args.projectName}".\n\nOpen notifications: ${args.projectUrl}`,
      html: `<p><strong>${escapeHtml(actorName)}</strong> ${decisionLabel} <strong>"${escapeHtml(itemName)}"</strong> in client portal for project <strong>${escapeHtml(args.projectName)}</strong>.</p><p><a href="${escapeHtml(args.projectUrl)}">Open notifications</a></p>`,
    };
  }

  return {
    subject: `[${args.projectName}] Client submitted survey "${surveyTitle}"`,
    text: `${actorName} submitted survey "${surveyTitle}" in client portal for project "${args.projectName}".\n\nOpen notifications: ${args.projectUrl}`,
    html: `<p><strong>${escapeHtml(actorName)}</strong> submitted survey <strong>"${escapeHtml(surveyTitle)}"</strong> in client portal for project <strong>${escapeHtml(args.projectName)}</strong>.</p><p><a href="${escapeHtml(args.projectUrl)}">Open notifications</a></p>`,
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
    const activeMemberIds = new Set(activeMembers.map((member) => member.clerkUserId));

    const responsibleClerkUserId = (project as { responsibleClerkUserId?: string })
      .responsibleClerkUserId;
    const candidateIds = Array.from(
      new Set([
        responsibleClerkUserId,
        project.createdBy,
        ...activeMembers.map((member) => member.clerkUserId),
      ].filter((value): value is string => typeof value === "string" && value.trim().length > 0)),
    );

    let selectedRecipient:
      | { email: string; name: string | null; clerkUserId: string }
      | null = null;

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

export const sendClientPortalEventEmail = internalAction({
  args: {
    projectId: v.id("projects"),
    actionType: v.union(
      v.literal("shopping.customer.decision"),
      v.literal("survey.response.submit"),
    ),
    actorName: v.optional(v.string()),
    itemName: v.optional(v.string()),
    surveyTitle: v.optional(v.string()),
    decision: v.optional(v.union(v.literal("accepted"), v.literal("rejected"))),
  },
  async handler(ctx, args) {
    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFromEmail = process.env.RESEND_FROM_EMAIL;
    if (!resendApiKey || !resendFromEmail) {
      console.warn("Resend email skipped: RESEND_API_KEY or RESEND_FROM_EMAIL not configured.");
      return { sent: 0, skipped: true };
    }

    const notificationContext = await ctx.runQuery(
      internalLoose.notifications.getEmailNotificationContext,
      { projectId: args.projectId },
    );

    if (!notificationContext || notificationContext.recipients.length === 0) {
      return { sent: 0, skipped: true };
    }

    const baseUrl = trimTrailingSlash(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001");
    const projectUrl = `${baseUrl}/organisation/projects/${notificationContext.projectSlug}/changelog`;
    const message = buildEmailMessage({
      actionType: args.actionType,
      actorName: args.actorName,
      projectName: notificationContext.projectName,
      projectUrl,
      itemName: args.itemName,
      surveyTitle: args.surveyTitle,
      decision: args.decision,
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
