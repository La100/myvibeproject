"use node";
/* eslint-disable @typescript-eslint/no-explicit-any */

import Stripe from "stripe";
import { v } from "convex/values";
import { action } from "./_generated/server";

// Keep generated refs runtime-loaded here to avoid deep TS instantiation.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const internalAny = require("./_generated/api").internal as any;

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

const getBaseUrl = (value?: string | null) =>
  (value || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");

const getDefaultConnectCountry = () =>
  (process.env.STRIPE_CONNECT_DEFAULT_COUNTRY || "PL").trim().toUpperCase();

const toSafeErrorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") return "";
  const maybeMessage = (error as { message?: unknown }).message;
  return typeof maybeMessage === "string" ? maybeMessage : "";
};

const mapStripeConnectErrorToUserMessage = (error: unknown) => {
  const message = toSafeErrorMessage(error);
  const lower = message.toLowerCase();

  if (lower.includes("signed up for connect")) {
    return (
      "Stripe Connect is not enabled on this Stripe account yet. In Stripe Dashboard, open Connect and " +
      "complete platform onboarding, then try again."
    );
  }

  if (lower.includes("invalid api key") || lower.includes("api key provided")) {
    return "Stripe API key is invalid. Check STRIPE_SECRET_KEY for this Convex deployment.";
  }

  if (lower.includes("restricted api key") || lower.includes("permission")) {
    return "Stripe API key does not have permission for Connect. Use a full secret key with Connect access.";
  }

  if (message) {
    return message;
  }

  return "Could not start Stripe Connect onboarding. Check Stripe configuration and try again.";
};

const ensureAdminForTeam = async (ctx: any, teamId: any, clerkUserId: string) => {
  const membership = await ctx.runQuery(internalAny.teams.getTeamMemberByClerkId, {
    teamId,
    clerkUserId,
  });

  if (!membership || membership.role !== "admin" || !membership.isActive) {
    throw new Error("Only admins can manage Stripe payouts");
  }
};

const syncConnectState = async (ctx: any, teamId: any, account: Stripe.Account) => {
  const onboardingComplete =
    account.details_submitted === true &&
    account.charges_enabled === true &&
    account.payouts_enabled === true;

  await ctx.runMutation(internalAny.stripe.updateTeamStripeConnect, {
    teamId,
    stripeConnectAccountId: account.id,
    stripeConnectAccountType:
      account.type === "express" || account.type === "standard" ? account.type : "express",
    stripeConnectChargesEnabled: account.charges_enabled,
    stripeConnectPayoutsEnabled: account.payouts_enabled,
    stripeConnectDetailsSubmitted: account.details_submitted,
    stripeConnectOnboardingComplete: onboardingComplete,
    stripeConnectLastSyncedAt: Date.now(),
  });

  return {
    accountId: account.id,
    accountType: account.type,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    onboardingComplete,
  };
};

export const createOrResumeStripeConnectOnboarding = action({
  args: {
    teamId: v.id("teams"),
    returnPath: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
  },
  returns: v.object({
    url: v.string(),
    accountId: v.string(),
  }),
  async handler(ctx, args) {
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Not authenticated");
      }

      const team: any = await ctx.runQuery(internalAny.stripe.getTeamForStripe, {
        teamId: args.teamId,
      });
      if (!team) {
        throw new Error("Team not found");
      }

      await ensureAdminForTeam(ctx, args.teamId, identity.subject);

      const returnPath =
        args.returnPath && args.returnPath.startsWith("/") ? args.returnPath : "/organisation/settings";

      let accountId = team.stripeConnectAccountId as string | undefined;

      if (!accountId) {
        const account = await getStripe().accounts.create({
          type: "express",
          country: getDefaultConnectCountry(),
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_profile: {
            name: team.name,
          },
          metadata: {
            teamId: String(args.teamId),
            clerkOrgId: team.clerkOrgId,
          },
        });

        accountId = account.id;
        await syncConnectState(ctx, args.teamId, account);
      } else {
        const account = await getStripe().accounts.retrieve(accountId);
        await syncConnectState(ctx, args.teamId, account);
      }

      const accountLink = await getStripe().accountLinks.create({
        account: accountId,
        type: "account_onboarding",
        refresh_url: `${getBaseUrl(args.baseUrl)}${returnPath}`,
        return_url: `${getBaseUrl(args.baseUrl)}${returnPath}`,
      });

      return {
        url: accountLink.url,
        accountId,
      };
    } catch (error) {
      throw new Error(mapStripeConnectErrorToUserMessage(error));
    }
  },
});

export const refreshStripeConnectAccount = action({
  args: {
    teamId: v.id("teams"),
  },
  returns: v.object({
    accountId: v.union(v.string(), v.null()),
    chargesEnabled: v.boolean(),
    payoutsEnabled: v.boolean(),
    detailsSubmitted: v.boolean(),
    onboardingComplete: v.boolean(),
  }),
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team: any = await ctx.runQuery(internalAny.stripe.getTeamForStripe, {
      teamId: args.teamId,
    });
    if (!team) {
      throw new Error("Team not found");
    }

    await ensureAdminForTeam(ctx, args.teamId, identity.subject);

    if (!team.stripeConnectAccountId) {
      return {
        accountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        onboardingComplete: false,
      };
    }

    const account = await getStripe().accounts.retrieve(team.stripeConnectAccountId);
    return await syncConnectState(ctx, args.teamId, account);
  },
});

export const createStripeConnectDashboardLink = action({
  args: {
    teamId: v.id("teams"),
  },
  returns: v.object({
    url: v.string(),
  }),
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team: any = await ctx.runQuery(internalAny.stripe.getTeamForStripe, {
      teamId: args.teamId,
    });
    if (!team) {
      throw new Error("Team not found");
    }

    await ensureAdminForTeam(ctx, args.teamId, identity.subject);

    if (!team.stripeConnectAccountId) {
      throw new Error("Stripe payouts are not connected yet");
    }

    const loginLink = await getStripe().accounts.createLoginLink(team.stripeConnectAccountId);
    return { url: loginLink.url };
  },
});
