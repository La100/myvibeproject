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
      throw new Error("Please enter a valid email address.");
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
    const projectName = project.name?.trim() || "Project";
    const senderName = identity.name?.trim() || identity.email?.trim() || "Project team";

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: [recipientEmail],
        subject: `[${projectName}] Your client portal link`,
        text:
          `${senderName} shared the client portal for project "${projectName}".\n\n` +
          `Open portal: ${portalUrl}\n\n` +
          `If the link stops working, ask the project team for a new one.`,
        html:
          `<p>${escapeHtml(senderName)} shared the client portal for project <strong>${escapeHtml(projectName)}</strong>.</p>` +
          `<p><a href="${escapeHtml(portalUrl)}">Open client portal</a></p>` +
          `<p>If the link stops working, ask the project team for a new one.</p>`,
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
