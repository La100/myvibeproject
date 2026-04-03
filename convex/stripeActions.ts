"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal, components } from "./_generated/api";
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

const getBaseUrl = () => (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const getBillingSettingsUrl = (checkoutState?: "success" | "canceled") => {
  const billingUrl = new URL("/organisation/subscription", getBaseUrl());
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
};

// Public action to create checkout session with promotion codes support
export const createCheckoutSession = action({
  args: {
    teamId: v.id("teams"),
    priceId: v.string(),
  },
  returns: v.object({
    url: v.string(),
  }),
  async handler(ctx, args): Promise<{ url: string }> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const runQuery = ctx.runQuery as (query: unknown, args: unknown) => Promise<unknown>;

    // Convex query reference types can exceed TS instantiation depth inside actions.
    // @ts-ignore
    const team = await runQuery(internal.stripe.getTeamForStripe as unknown, {
      teamId: args.teamId,
    }) as StripeTeamRecord | null;

    if (!team) {
      throw new Error("Team not found");
    }

    // Check if user is admin of this team
    const membership = await runQuery(internal.teams.getTeamMemberByClerkId as unknown, {
      teamId: args.teamId,
      clerkUserId: identity.subject,
    }) as TeamMembershipRecord | null;

    if (!membership || membership.role !== "admin") {
      throw new Error("Only admins can manage subscriptions");
    }

    // Get or create Stripe customer using component
    const customer = await stripeClient.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: identity.email || "admin@company.com",
      name: team.name,
    });

    // Update team with customer ID if new
    if (!team.stripeCustomerId) {
      await ctx.runMutation(internal.stripe.updateTeamStripeCustomer, {
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
      success_url: getBillingSettingsUrl("success"),
      cancel_url: getBillingSettingsUrl("canceled"),
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
  },
  returns: v.object({
    url: v.string(),
  }),
  async handler(ctx, args): Promise<{ url: string }> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const runQuery = ctx.runQuery as (query: unknown, args: unknown) => Promise<unknown>;

    // Get team info
    const team = await runQuery(internal.stripe.getTeamForStripe as unknown, {
      teamId: args.teamId,
    }) as StripeTeamRecord | null;

    if (!team) {
      throw new Error("Team not found");
    }

    if (!team.stripeCustomerId) {
      throw new Error("No Stripe customer found. Please subscribe first.");
    }

    // Check if user is admin of this team
    const membership = await runQuery(internal.teams.getTeamMemberByClerkId as unknown, {
      teamId: args.teamId,
      clerkUserId: identity.subject,
    }) as TeamMembershipRecord | null;

    if (!membership || membership.role !== "admin") {
      throw new Error("Only admins can manage subscriptions");
    }

    // Create portal session using component
    const session = await stripeClient.createCustomerPortalSession(ctx, {
      customerId: team.stripeCustomerId,
      returnUrl: getBillingSettingsUrl(),
    });

    return { url: session.url };
  },
});

type EnsureSubscriptionSyncedResult =
  | { synced: true; plan: string; status: string }
  | { synced: false };

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
    }),
    v.object({
      synced: v.literal(false),
    })
  ),
  async handler(ctx, args): Promise<EnsureSubscriptionSyncedResult> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { synced: false };
    }
    const runQuery = ctx.runQuery as (query: unknown, args: unknown) => Promise<unknown>;

    // Get team info
    const team = await runQuery(internal.stripe.getTeamForStripe as unknown, {
      teamId: args.teamId,
    }) as StripeTeamRecord | null;

    if (!team || !team.stripeCustomerId) {
      return { synced: false };
    }

    // If team already has active subscription in DB, no need to sync
    if (team.subscriptionStatus === "active" || team.subscriptionStatus === "trialing") {
      return { synced: false };
    }

    // Check Stripe for active subscription
    const subscriptions = await getStripe().subscriptions.list({
      customer: team.stripeCustomerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      const trialingSubscriptions = await getStripe().subscriptions.list({
        customer: team.stripeCustomerId,
        status: "trialing",
        limit: 1,
      });

      if (trialingSubscriptions.data.length === 0) {
        return { synced: false };
      }

      subscriptions.data = trialingSubscriptions.data;
    }

    const subscription = subscriptions.data[0];
    const subscriptionItem = subscription.items.data[0];
    const priceId = subscriptionItem?.price.id || "";
    const currentPeriodEnd = subscriptionItem?.current_period_end
      ? subscriptionItem.current_period_end * 1000
      : Date.now() + 30 * 24 * 60 * 60 * 1000;
    const plan = (subscriptionItem?.price.id && process.env.STRIPE_AI_SCALE_PRICE_ID === subscriptionItem.price.id)
      ? "ai_scale"
      : "ai";

    // Sync the subscription to the team
    await ctx.runMutation(internal.stripe.syncSubscriptionDirectly, {
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
    };
  },
});
