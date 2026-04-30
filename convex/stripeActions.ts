"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
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
  stripeCustomerId?: string | null;
  subscriptionStatus?: string | null;
};

type TeamMembershipRecord = {
  role?: string | null;
  isActive?: boolean | null;
};

const internalApi = anyApi as unknown as {
  stripe: {
    getTeamForStripe: unknown;
    updateTeamStripeCustomer: unknown;
    syncSubscriptionDirectly: unknown;
  };
  teams: {
    getTeamMemberByClerkId: unknown;
  };
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
    const runQuery = ctx.runQuery as (
      query: unknown,
      args: unknown,
    ) => Promise<unknown>;

    // Get team info
    const team = (await runQuery(internalApi.stripe.getTeamForStripe, {
      teamId: args.teamId,
    })) as StripeTeamRecord | null;

    if (!team) {
      throw new Error("Team not found");
    }

    if (!team.stripeCustomerId) {
      throw new Error("No Stripe customer found. Please subscribe first.");
    }

    // Any active team member can open the workspace billing portal.
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

    // Create portal session using component
    const session = await stripeClient.createCustomerPortalSession(ctx, {
      customerId: team.stripeCustomerId,
      returnUrl: getBillingSettingsUrl(args.baseUrl),
    });

    return { url: session.url };
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
