"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { components } from "./_generated/api";
import { anyApi } from "convex/server";
import { StripeSubscriptions } from "@convex-dev/stripe";
import Stripe from "stripe";

// Initialize Stripe client from component (for customer management)
const stripeClient = new StripeSubscriptions(components.stripe, {});

// Direct Stripe SDK for checkout (to support promotion codes).
// Keep initialization lazy so Convex module analysis does not require the secret at import time.
let stripe: Stripe | null = null;

const getStripe = () => {
  if (stripe) {
    return stripe;
  }

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  stripe = new Stripe(apiKey, {
    apiVersion: "2025-11-17.clover",
  });
  return stripe;
};

const normalizeBaseUrl = (value?: string | null) =>
  (
    value ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3001"
  ).replace(/\/+$/, "");

const getBillingSettingsUrl = (
  baseUrl?: string,
  checkoutState?: "success" | "canceled",
) => {
  const billingUrl = new URL(
    "/organisation/subscription",
    normalizeBaseUrl(baseUrl),
  );
  if (checkoutState) {
    billingUrl.searchParams.set("checkout", checkoutState);
  }
  return billingUrl.toString();
};

type StripeTeamRecord = {
  name: string;
  clerkOrgId: string;
  stripeCustomerId?: string | null;
  subscriptionStatus?: string | null;
};

type TeamMembershipRecord = {
  role?: string | null;
  isActive?: boolean | null;
};

type TeamSubscriptionInvoice = {
  stripeInvoiceId: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  status: string;
  amountDue: number;
  amountPaid: number;
  created: number;
  currency: string;
};

type StripeInvoiceWithSubscription = Stripe.Invoice & {
  subscription?: string | { id?: string | null } | null;
};

const internalApi = anyApi as unknown as {
  stripe: {
    getTeamForStripe: unknown;
    updateTeamStripeCustomer: unknown;
    syncSubscriptionDirectly: unknown;
    claimSubscriptionActivatedEmail: unknown;
    markSubscriptionActivatedEmail: unknown;
    claimSubscriptionCanceledEmail: unknown;
    markSubscriptionCanceledEmail: unknown;
  };
  teams: {
    getTeamMemberByClerkId: unknown;
  };
};

const assertSubscriptionTeamAccess = async (
  ctx: any,
  teamId: string,
  clerkUserId: string,
) => {
  const runQuery = ctx.runQuery as (
    query: unknown,
    args: unknown,
  ) => Promise<unknown>;

  const team = (await runQuery(internalApi.stripe.getTeamForStripe, {
    teamId,
  })) as StripeTeamRecord | null;

  if (!team) {
    throw new Error("Team not found");
  }

  const membership = (await runQuery(internalApi.teams.getTeamMemberByClerkId, {
    teamId,
    clerkUserId,
  })) as TeamMembershipRecord | null;

  if (
    !membership ||
    membership.isActive === false ||
    (membership.role !== "admin" && membership.role !== "member")
  ) {
    throw new Error("Only team members can manage subscriptions");
  }

  return team;
};

// Public action to create checkout session with promotion codes support
export const createCheckoutSession = action({
  args: {
    teamId: v.id("teams"),
    priceId: v.string(),
    baseUrl: v.optional(v.string()),
  },
  returns: v.object({
    url: v.string(),
  }),
  async handler(ctx, args): Promise<{ url: string }> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const runQuery = ctx.runQuery as (
      query: unknown,
      args: unknown,
    ) => Promise<unknown>;
    const runMutation = ctx.runMutation as (
      mutation: unknown,
      args: unknown,
    ) => Promise<unknown>;

    const team = (await runQuery(internalApi.stripe.getTeamForStripe, {
      teamId: args.teamId,
    })) as StripeTeamRecord | null;

    if (!team) {
      throw new Error("Team not found");
    }

    // Any active team member can start or change the workspace subscription.
    const membership = (await runQuery(
      internalApi.teams.getTeamMemberByClerkId,
      {
        teamId: args.teamId,
        clerkUserId: identity.subject,
      },
    )) as TeamMembershipRecord | null;

    if (
      !membership ||
      membership.isActive === false ||
      (membership.role !== "admin" && membership.role !== "member")
    ) {
      throw new Error("Only team members can manage subscriptions");
    }

    // Get or create Stripe customer using component
    const customer = await stripeClient.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: identity.email,
      name: team.name,
    });

    // Update team with customer ID if new
    if (!team.stripeCustomerId) {
      await runMutation(internalApi.stripe.updateTeamStripeCustomer, {
        teamId: args.teamId,
        stripeCustomerId: customer.customerId,
      });
    }

    // Create checkout session using direct Stripe SDK (supports allow_promotion_codes)
    const session = await getStripe().checkout.sessions.create({
      customer: customer.customerId,
      mode: "subscription",
      line_items: [
        {
          price: args.priceId,
          quantity: 1,
        },
      ],
      success_url: getBillingSettingsUrl(args.baseUrl, "success"),
      cancel_url: getBillingSettingsUrl(args.baseUrl, "canceled"),
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          teamId: args.teamId,
          orgId: team.clerkOrgId,
          userId: identity.subject,
        },
      },
    });

    return { url: session.url || "" };
  },
});

// Public action to create Stripe Billing Portal session
export const createBillingPortalSession = action({
  args: {
    teamId: v.id("teams"),
    baseUrl: v.optional(v.string()),
  },
  returns: v.object({
    url: v.string(),
  }),
  async handler(ctx, args): Promise<{ url: string }> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await assertSubscriptionTeamAccess(
      ctx,
      args.teamId,
      identity.subject,
    );

    if (!team.stripeCustomerId) {
      throw new Error("No Stripe customer found. Please subscribe first.");
    }

    // Create portal session using component
    const session = await stripeClient.createCustomerPortalSession(ctx, {
      customerId: team.stripeCustomerId,
      returnUrl: getBillingSettingsUrl(args.baseUrl),
    });

    return { url: session.url };
  },
});

export const listTeamInvoicesFromStripe = action({
  args: {
    teamId: v.id("teams"),
  },
  returns: v.array(
    v.object({
      stripeInvoiceId: v.string(),
      stripeCustomerId: v.string(),
      stripeSubscriptionId: v.optional(v.string()),
      status: v.string(),
      amountDue: v.number(),
      amountPaid: v.number(),
      created: v.number(),
      currency: v.string(),
    }),
  ),
  async handler(ctx, args): Promise<TeamSubscriptionInvoice[]> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await assertSubscriptionTeamAccess(
      ctx,
      args.teamId,
      identity.subject,
    );

    if (!team.stripeCustomerId) {
      return [];
    }

    const invoices = await getStripe().invoices.list({
      customer: team.stripeCustomerId,
      limit: 24,
    });

    return invoices.data
      .filter((invoice) => invoice.id)
      .map((invoice) => {
        const stripeInvoice = invoice as StripeInvoiceWithSubscription;
        const subscription =
          typeof stripeInvoice.subscription === "string"
            ? stripeInvoice.subscription
            : stripeInvoice.subscription?.id;

        return {
          stripeInvoiceId: invoice.id!,
          stripeCustomerId: team.stripeCustomerId!,
          stripeSubscriptionId: subscription || undefined,
          status: invoice.status || "unknown",
          amountDue: invoice.amount_due || 0,
          amountPaid: invoice.amount_paid || 0,
          created: invoice.created,
          currency: (invoice.currency || "usd").toUpperCase(),
        };
      });
  },
});

type EnsureSubscriptionSyncedResult =
  | {
      synced: true;
      plan: string;
      status: string;
      subscriptionId: string;
      priceId: string;
    }
  | { synced: false };

const getSubscriptionCustomerId = (subscription: Stripe.Subscription) => {
  const customer = subscription.customer;
  return typeof customer === "string" ? customer : customer.id;
};

const findActiveSubscriptionForTeam = async (
  teamId: string,
  stripeCustomerId?: string | null,
) => {
  if (stripeCustomerId) {
    const activeSubscriptions = await getStripe().subscriptions.list({
      customer: stripeCustomerId,
      status: "active",
      limit: 1,
    });

    if (activeSubscriptions.data[0]) {
      return activeSubscriptions.data[0];
    }

    const trialingSubscriptions = await getStripe().subscriptions.list({
      customer: stripeCustomerId,
      status: "trialing",
      limit: 1,
    });

    if (trialingSubscriptions.data[0]) {
      return trialingSubscriptions.data[0];
    }
  }

  const metadataQuery = `metadata['teamId']:'${teamId}'`;
  const activeSearch = await getStripe().subscriptions.search({
    query: `${metadataQuery} AND status:'active'`,
    limit: 1,
  });

  if (activeSearch.data[0]) {
    return activeSearch.data[0];
  }

  const trialingSearch = await getStripe().subscriptions.search({
    query: `${metadataQuery} AND status:'trialing'`,
    limit: 1,
  });

  return trialingSearch.data[0] ?? null;
};

// Auto-sync subscription from Stripe if out of sync (called automatically)
export const ensureSubscriptionSynced = action({
  args: {
    teamId: v.id("teams"),
  },
  returns: v.union(
    v.object({
      synced: v.literal(true),
      plan: v.string(),
      status: v.string(),
      subscriptionId: v.string(),
      priceId: v.string(),
    }),
    v.object({
      synced: v.literal(false),
    }),
  ),
  async handler(ctx, args): Promise<EnsureSubscriptionSyncedResult> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { synced: false };
    }
    const runQuery = ctx.runQuery as (
      query: unknown,
      args: unknown,
    ) => Promise<unknown>;
    const runMutation = ctx.runMutation as (
      mutation: unknown,
      args: unknown,
    ) => Promise<unknown>;

    // Get team info
    const team = (await runQuery(internalApi.stripe.getTeamForStripe, {
      teamId: args.teamId,
    })) as StripeTeamRecord | null;

    if (!team || !team.stripeCustomerId) {
      return { synced: false };
    }

    const membership = (await runQuery(
      internalApi.teams.getTeamMemberByClerkId,
      {
        teamId: args.teamId,
        clerkUserId: identity.subject,
      },
    )) as TeamMembershipRecord | null;

    if (
      !membership ||
      membership.isActive === false ||
      (membership.role !== "admin" && membership.role !== "member")
    ) {
      return { synced: false };
    }

    const subscription = await findActiveSubscriptionForTeam(
      String(args.teamId),
      team.stripeCustomerId,
    );

    if (!subscription) {
      return { synced: false };
    }

    const subscriptionItem = subscription.items.data[0];
    const priceId = subscriptionItem?.price.id || "";
    const currentPeriodEnd = subscriptionItem?.current_period_end
      ? subscriptionItem.current_period_end * 1000
      : Date.now() + 30 * 24 * 60 * 60 * 1000;
    const currentPeriodStart = subscriptionItem?.current_period_start
      ? subscriptionItem.current_period_start * 1000
      : Date.now();
    const plan =
      subscriptionItem?.price.id &&
      process.env.STRIPE_AI_SCALE_PRICE_ID === subscriptionItem.price.id
        ? "ai_scale"
        : "ai";

    if (!team.stripeCustomerId) {
      await runMutation(internalApi.stripe.updateTeamStripeCustomer, {
        teamId: args.teamId,
        stripeCustomerId: getSubscriptionCustomerId(subscription),
      });
    }

    await runMutation(internalApi.stripe.syncSubscriptionDirectly, {
      teamId: args.teamId,
      subscriptionId: subscription.id,
      status: subscription.status,
      priceId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });

    return {
      synced: true,
      plan,
      status: subscription.status,
      subscriptionId: subscription.id,
      priceId,
    };
  },
});

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getPlanNameFromPriceId = (priceId: string) =>
  process.env.STRIPE_AI_SCALE_PRICE_ID === priceId ? "AI Scale" : "AI Pro";

const normalizeEmail = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
};

const getSubscriptionCustomerEmail = async (subscriptionId: string) => {
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const customer = await getStripe().customers.retrieve(customerId);

  if (customer.deleted) {
    return null;
  }

  return normalizeEmail(customer.email);
};

export const sendSubscriptionActivatedEmail = internalAction({
  args: {
    teamId: v.id("teams"),
    subscriptionId: v.string(),
    status: v.string(),
    priceId: v.string(),
  },
  async handler(ctx, args) {
    if (args.status !== "active" && args.status !== "trialing") {
      return { sent: false, skipped: true, reason: "inactive_status" };
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFromEmail = process.env.RESEND_FROM_EMAIL;
    if (!resendApiKey || !resendFromEmail) {
      console.warn(
        "Subscription email skipped: RESEND_API_KEY or RESEND_FROM_EMAIL not configured.",
      );
      return { sent: false, skipped: true, reason: "resend_not_configured" };
    }

    const runQuery = ctx.runQuery as (
      query: unknown,
      args: unknown,
    ) => Promise<unknown>;
    const runMutation = ctx.runMutation as (
      mutation: unknown,
      args: unknown,
    ) => Promise<unknown>;

    const team = (await runQuery(internalApi.stripe.getTeamForStripe, {
      teamId: args.teamId,
    })) as StripeTeamRecord | null;
    if (!team) {
      return { sent: false, skipped: true, reason: "team_not_found" };
    }

    const recipientEmail = await getSubscriptionCustomerEmail(
      args.subscriptionId,
    );
    if (!recipientEmail) {
      console.warn(
        `Subscription email skipped: no customer email for ${args.subscriptionId}`,
      );
      return { sent: false, skipped: true, reason: "missing_email" };
    }

    const claim = (await runMutation(
      internalApi.stripe.claimSubscriptionActivatedEmail,
      {
        teamId: args.teamId,
        subscriptionId: args.subscriptionId,
        recipientEmail,
      },
    )) as { claimed: boolean };

    if (!claim.claimed) {
      return { sent: false, skipped: true, reason: "already_sent" };
    }

    const planName = getPlanNameFromPriceId(args.priceId);
    const baseUrl = normalizeBaseUrl();
    const subscriptionUrl = `${baseUrl}/organisation/subscription`;
    const teamName = team.name || "your workspace";
    const subject = `${planName} is active`;
    const text = [
      `Your ${planName} subscription is active for ${teamName}.`,
      "",
      "You can manage billing and view your credit usage here:",
      subscriptionUrl,
      "",
      "Thanks for using Myvibe.",
    ].join("\n");
    const html = [
      `<p>Your <strong>${escapeHtml(planName)}</strong> subscription is active for <strong>${escapeHtml(teamName)}</strong>.</p>`,
      `<p>You can manage billing and view your credit usage here:</p>`,
      `<p><a href="${escapeHtml(subscriptionUrl)}">Open subscription settings</a></p>`,
      `<p>Thanks for using Myvibe.</p>`,
    ].join("");

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: resendFromEmail,
          to: [recipientEmail],
          subject,
          text,
          html,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const lastError = `${response.status} ${response.statusText} ${errorText}`;
        await runMutation(internalApi.stripe.markSubscriptionActivatedEmail, {
          subscriptionId: args.subscriptionId,
          status: "failed",
          recipientEmail,
          lastError,
        });
        console.error(
          `Subscription email failed for ${recipientEmail}: ${lastError}`,
        );
        return { sent: false, skipped: false, reason: "send_failed" };
      }

      await runMutation(internalApi.stripe.markSubscriptionActivatedEmail, {
        subscriptionId: args.subscriptionId,
        status: "sent",
        recipientEmail,
      });
      return { sent: true, skipped: false };
    } catch (error) {
      const lastError = error instanceof Error ? error.message : String(error);
      await runMutation(internalApi.stripe.markSubscriptionActivatedEmail, {
        subscriptionId: args.subscriptionId,
        status: "failed",
        recipientEmail,
        lastError,
      });
      console.error(`Subscription email failed for ${recipientEmail}:`, error);
      return { sent: false, skipped: false, reason: "send_failed" };
    }
  },
});

export const sendSubscriptionCanceledEmail = internalAction({
  args: {
    teamId: v.id("teams"),
    subscriptionId: v.string(),
    cancelAtPeriodEnd: v.boolean(),
    currentPeriodEnd: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFromEmail = process.env.RESEND_FROM_EMAIL;
    if (!resendApiKey || !resendFromEmail) {
      console.warn(
        "Subscription cancellation email skipped: RESEND_API_KEY or RESEND_FROM_EMAIL not configured.",
      );
      return { sent: false, skipped: true, reason: "resend_not_configured" };
    }

    const runQuery = ctx.runQuery as (
      query: unknown,
      args: unknown,
    ) => Promise<unknown>;
    const runMutation = ctx.runMutation as (
      mutation: unknown,
      args: unknown,
    ) => Promise<unknown>;

    const team = (await runQuery(internalApi.stripe.getTeamForStripe, {
      teamId: args.teamId,
    })) as StripeTeamRecord | null;
    if (!team) {
      return { sent: false, skipped: true, reason: "team_not_found" };
    }

    const recipientEmail = await getSubscriptionCustomerEmail(
      args.subscriptionId,
    );
    if (!recipientEmail) {
      console.warn(
        `Subscription cancellation email skipped: no customer email for ${args.subscriptionId}`,
      );
      return { sent: false, skipped: true, reason: "missing_email" };
    }

    const claim = (await runMutation(
      internalApi.stripe.claimSubscriptionCanceledEmail,
      {
        teamId: args.teamId,
        subscriptionId: args.subscriptionId,
        recipientEmail,
      },
    )) as { claimed: boolean };

    if (!claim.claimed) {
      return { sent: false, skipped: true, reason: "already_sent" };
    }

    const baseUrl = normalizeBaseUrl();
    const subscriptionUrl = `${baseUrl}/organisation/subscription`;
    const teamName = team.name || "your workspace";
    const accessUntil =
      args.cancelAtPeriodEnd && args.currentPeriodEnd
        ? new Intl.DateTimeFormat("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          }).format(new Date(args.currentPeriodEnd))
        : null;

    const subject = args.cancelAtPeriodEnd
      ? "Your Myvibe subscription cancellation is scheduled"
      : "Your Myvibe subscription has been canceled";
    const accessLine = accessUntil
      ? `Your paid access for ${teamName} will remain active until ${accessUntil}.`
      : `Your paid subscription for ${teamName} has been canceled.`;
    const text = [
      accessLine,
      "",
      "Thank you for using Myvibe. You can review your billing and subscription settings here:",
      subscriptionUrl,
      "",
      "We would be happy to have you back whenever it fits your workflow.",
    ].join("\n");
    const html = [
      `<p>${escapeHtml(accessLine)}</p>`,
      `<p>Thank you for using Myvibe. You can review your billing and subscription settings here:</p>`,
      `<p><a href="${escapeHtml(subscriptionUrl)}">Open subscription settings</a></p>`,
      `<p>We would be happy to have you back whenever it fits your workflow.</p>`,
    ].join("");

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: resendFromEmail,
          to: [recipientEmail],
          subject,
          text,
          html,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const lastError = `${response.status} ${response.statusText} ${errorText}`;
        await runMutation(internalApi.stripe.markSubscriptionCanceledEmail, {
          subscriptionId: args.subscriptionId,
          status: "failed",
          recipientEmail,
          lastError,
        });
        console.error(
          `Subscription cancellation email failed for ${recipientEmail}: ${lastError}`,
        );
        return { sent: false, skipped: false, reason: "send_failed" };
      }

      await runMutation(internalApi.stripe.markSubscriptionCanceledEmail, {
        subscriptionId: args.subscriptionId,
        status: "sent",
        recipientEmail,
      });
      return { sent: true, skipped: false };
    } catch (error) {
      const lastError = error instanceof Error ? error.message : String(error);
      await runMutation(internalApi.stripe.markSubscriptionCanceledEmail, {
        subscriptionId: args.subscriptionId,
        status: "failed",
        recipientEmail,
        lastError,
      });
      console.error(
        `Subscription cancellation email failed for ${recipientEmail}:`,
        error,
      );
      return { sent: false, skipped: false, reason: "send_failed" };
    }
  },
});
