"use server";

import type { WebhookEvent } from "@clerk/clerk-sdk-node";
import { httpAction } from "./_generated/server";
import { Webhook } from "svix";
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const internalAny = require("./_generated/api").internal as any;

const internalRefs = {
  createOrUpdateTeam: internalAny.myFunctions.createOrUpdateTeam,
  deleteTeamInternal: internalAny.myFunctions.deleteTeamInternal,
  createOrUpdateMembership: internalAny.myFunctions.createOrUpdateMembership,
  deleteMembership: internalAny.myFunctions.deleteMembership,
  createOrUpdateUser: internalAny.myFunctions.createOrUpdateUser,
  deleteUser: internalAny.myFunctions.deleteUser,
  createInvitation: internalAny.myFunctions.createInvitation,
  updateInvitationStatus: internalAny.myFunctions.updateInvitationStatus,
};

const normalizeClerkName = (
  firstName?: string | null,
  lastName?: string | null,
  username?: string | null,
) => {
  const parts = [firstName, lastName]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value && value.toLowerCase() !== "null"));

  if (parts.length > 0) {
    return parts.join(" ");
  }

  const normalizedUsername = username?.trim();
  return normalizedUsername && normalizedUsername.toLowerCase() !== "null"
    ? normalizedUsername
    : undefined;
};

const getPrimaryEmail = (data: {
  id: string;
  primary_email_address_id?: string | null;
  email_addresses?: Array<{
    id?: string;
    email_address?: string | null;
  }>;
}) => {
  const primaryEmail = data.email_addresses?.find(
    (email) => email.id === data.primary_email_address_id,
  )?.email_address;
  const firstEmail = data.email_addresses?.[0]?.email_address;
  return (primaryEmail || firstEmail || `${data.id}@placeholder.local`)
    .trim()
    .toLowerCase();
};

const handleClerkWebhook = httpAction(async (ctx, request) => {
  const event = await validateRequest(request);
  if (!event) {
    return new Response("Could not validate request", {
      status: 400,
    });
  }
  switch (event.type) {
    case "organization.created":
      await ctx.runMutation(internalRefs.createOrUpdateTeam, {
        clerkOrgId: event.data.id,
        name: event.data.name,
        slug: event.data.slug!,
        imageUrl: event.data.image_url,
      });
      break;
    case "organization.updated":
      await ctx.runMutation(internalRefs.createOrUpdateTeam, {
        clerkOrgId: event.data.id,
        name: event.data.name,
        slug: event.data.slug!,
        imageUrl: event.data.image_url,
      });
      break;
    case "organization.deleted":
      if (event.data.id) {
        await ctx.runMutation(internalRefs.deleteTeamInternal, {
          clerkOrgId: event.data.id,
        });
      }
      break;
    case "organizationMembership.created":
        await ctx.runMutation(internalRefs.createOrUpdateMembership, {
            clerkOrgId: event.data.organization.id,
            clerkUserId: event.data.public_user_data.user_id,
            role: event.data.role,
            orgName: event.data.organization.name,
            orgSlug: event.data.organization.slug!,
            orgImageUrl: event.data.organization.image_url,
            userEmail: (event.data.public_user_data as any).email_addresses?.[0]?.email_address || 
                      (event.data.public_user_data as any).email_address,
        });
        break;
    case "organizationMembership.updated":
        await ctx.runMutation(internalRefs.createOrUpdateMembership, {
            clerkOrgId: event.data.organization.id,
            clerkUserId: event.data.public_user_data.user_id,
            role: event.data.role,
            orgName: event.data.organization.name,
            orgSlug: event.data.organization.slug!,
            orgImageUrl: event.data.organization.image_url,
            userEmail: (event.data.public_user_data as any).email_addresses?.[0]?.email_address || 
                      (event.data.public_user_data as any).email_address,
        });
        break;
    case "organizationMembership.deleted":
        await ctx.runMutation(internalRefs.deleteMembership, {
            clerkOrgId: event.data.organization.id,
            clerkUserId: event.data.public_user_data.user_id,
        });
        break;
    case "user.created":
        await ctx.runMutation(internalRefs.createOrUpdateUser, {
            clerkUserId: event.data.id,
            email: getPrimaryEmail(event.data),
            name: normalizeClerkName(
              event.data.first_name,
              event.data.last_name,
              event.data.username,
            ),
            imageUrl: event.data.image_url,
        });
        break;
    case "user.updated":
        await ctx.runMutation(internalRefs.createOrUpdateUser, {
            clerkUserId: event.data.id,
            email: getPrimaryEmail(event.data),
            name: normalizeClerkName(
              event.data.first_name,
              event.data.last_name,
              event.data.username,
            ),
            imageUrl: event.data.image_url,
        });
        break;
    case "user.deleted":
      if (event.data.id) {
        await ctx.runMutation(internalRefs.deleteUser, {
          clerkUserId: event.data.id,
        });
      }
      break;
    case "organizationInvitation.created":
      await ctx.runMutation(internalRefs.createInvitation, {
        clerkInvitationId: event.data.id,
        email: event.data.email_address,
        role: event.data.role.replace('org:', ''),
        clerkOrgId: event.data.organization_id,
      });
      break;
    case "organizationInvitation.accepted":
      await ctx.runMutation(internalRefs.updateInvitationStatus, {
        clerkInvitationId: event.data.id,
        status: "accepted",
      });
      break;
    case "organizationInvitation.revoked":
      await ctx.runMutation(internalRefs.updateInvitationStatus, {
        clerkInvitationId: event.data.id,
        status: "revoked",
      });
      break;
    default: {
      console.log("Ignored Clerk webhook event:", event.type);
    }
  }
  return new Response(null, {
    status: 200,
  });
});

async function validateRequest(
  req: Request
): Promise<WebhookEvent | undefined> {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("CLERK_WEBHOOK_SECRET is not set");
  }
  const payloadString = await req.text();
  const svixHeaders = {
    "svix-id": req.headers.get("svix-id")!,
    "svix-timestamp": req.headers.get("svix-timestamp")!,
    "svix-signature": req.headers.get("svix-signature")!,
  };
  const wh = new Webhook(webhookSecret);
  try {
    return wh.verify(payloadString, svixHeaders) as WebhookEvent;
  } catch (error) {
    console.error("Error verifying webhook:", error);
    return;
  }
}

export default handleClerkWebhook; 
