"use node";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { v } from "convex/values";
import { action } from "./_generated/server";

// Keep generated refs runtime-loaded here to avoid deep TS instantiation.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const internalAny = require("./_generated/api").internal as any;

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getBaseUrl = (baseUrl?: string) =>
  trimTrailingSlash(baseUrl || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001");

type EmailLocale = "en" | "pl";

const normalizeEmailLocale = (locale?: string | null): EmailLocale =>
  locale === "en" ? "en" : "pl";

const buildClientPortalLinkEmail = (args: {
  locale: EmailLocale;
  projectName: string;
  portalUrl: string;
  senderName: string;
}) => {
  if (args.locale === "en") {
    return {
      subject: `[${args.projectName}] Client portal link`,
      text:
        `${args.senderName} shared the client portal for project "${args.projectName}".\n\n` +
        `Open portal: ${args.portalUrl}\n\n` +
        `If the link stops working, ask the project team for a new one.`,
      html:
        `<p>${escapeHtml(args.senderName)} shared the client portal for project <strong>${escapeHtml(args.projectName)}</strong>.</p>` +
        `<p><a href="${escapeHtml(args.portalUrl)}">Open client portal</a></p>` +
        `<p>If the link stops working, ask the project team for a new one.</p>`,
    };
  }

  return {
    subject: `[${args.projectName}] Link do panelu klienta`,
    text:
      `${args.senderName} udostępnił(a) panel klienta dla projektu "${args.projectName}".\n\n` +
      `Otwórz panel: ${args.portalUrl}\n\n` +
      `Jeśli link przestanie działać, poproś zespół projektu o nowy.`,
    html:
      `<p>${escapeHtml(args.senderName)} udostępnił(a) panel klienta dla projektu <strong>${escapeHtml(args.projectName)}</strong>.</p>` +
      `<p><a href="${escapeHtml(args.portalUrl)}">Otwórz panel klienta</a></p>` +
      `<p>Jeśli link przestanie działać, poproś zespół projektu o nowy.</p>`,
  };
};

export const sendClientPortalLinkEmail = action({
  args: {
    projectId: v.id("projects"),
    recipientEmail: v.string(),
    baseUrl: v.optional(v.string()),
  },
  returns: v.object({
    sent: v.boolean(),
  }),
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const recipientEmail = args.recipientEmail.trim().toLowerCase();
    if (!isValidEmail(recipientEmail)) {
      throw new Error("Wpisz poprawny adres e-mail.");
    }

    const project = await ctx.runQuery(internalAny.projects.getProjectByIdInternal, {
      projectId: args.projectId,
    });
    if (!project) {
      throw new Error("Project not found");
    }

    const teamMember = await ctx.runQuery(internalAny.teams.getTeamMemberByClerkId, {
      teamId: project.teamId,
      clerkUserId: identity.subject,
    });
    if (!teamMember || !teamMember.isActive) {
      throw new Error("User is not a team member");
    }
    if (
      teamMember.role !== "admin" &&
      Array.isArray(teamMember.projectIds) &&
      !teamMember.projectIds.includes(args.projectId)
    ) {
      throw new Error("Insufficient permissions to manage this project");
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFromEmail = process.env.RESEND_FROM_EMAIL;
    if (!resendApiKey || !resendFromEmail) {
      throw new Error("Resend is not configured.");
    }

    const accessToken =
      project.clientPanelAccessToken ||
      (await ctx.runMutation(internalAny.clientPortalInternal.ensureClientPanelAccessTokenInternal, {
        projectId: args.projectId,
    })).token;

    const portalUrl = `${getBaseUrl(args.baseUrl)}/client-panel/${accessToken}`;
    const locale = normalizeEmailLocale(
      await ctx.runQuery(internalAny.teams.getTeamEmailLocale, {
        teamId: project.teamId,
      }),
    );
    const projectName = project.name?.trim() || (locale === "en" ? "Project" : "Projekt");
    const senderName =
      identity.name?.trim() ||
      identity.email?.trim() ||
      (locale === "en" ? "Project team" : "Zespół projektu");
    const message = buildClientPortalLinkEmail({
      locale,
      projectName,
      portalUrl,
      senderName,
    });

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: [recipientEmail],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to send email via Resend: ${response.status} ${response.statusText} ${errorText}`,
      );
    }

    return { sent: true };
  },
});
