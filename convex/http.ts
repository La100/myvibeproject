import { httpRouter } from "convex/server";
import { internal, components } from "./_generated/api";
import handleClerkWebhook from "./clerk";
import { registerRoutes } from "@convex-dev/stripe";
import type Stripe from "stripe";
import { telegramWebhook } from "./messaging/telegram";

const http = httpRouter();

// Telegram webhook (assistant integration)
http.route({
  path: "/telegram/webhook",
  method: "POST",
  handler: telegramWebhook,
});



http.route({
  path: "/clerk",
  method: "POST",
  handler: handleClerkWebhook,
});

// Register Stripe webhook handler using @convex-dev/stripe component
registerRoutes(http, components.stripe, {
  webhookPath: "/stripe/webhook",
  events: {
    // Update team subscription when checkout completes
    "checkout.session.completed": async (ctx, event: Stripe.CheckoutSessionCompletedEvent) => {
      const session = event.data.object;
      const subscriptionId = session.subscription as string;

      if (subscriptionId) {
        // Metadata is on the subscription object, not on the session
        // We need to fetch the subscription to get teamId
        const stripe = new (await import("stripe")).default(process.env.STRIPE_SECRET_KEY!, {
          apiVersion: "2025-11-17.clover",
        });

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const teamId = subscription.metadata?.teamId;
        const subscriptionItem = subscription.items.data[0];
        const priceId = subscriptionItem?.price.id || "";
        const currentPeriodEnd = subscriptionItem?.current_period_end
          ? subscriptionItem.current_period_end * 1000
          : Date.now() + 30 * 24 * 60 * 60 * 1000;

        if (teamId) {
          console.log(`Checkout completed for team ${teamId}, subscription: ${subscriptionId}, status: ${subscription.status}`);

          // Sync directly without relying on Stripe component database
          await ctx.runMutation(internal.stripe.syncSubscriptionDirectly, {
            teamId: teamId as any,
            subscriptionId: subscriptionId,
            status: subscription.status,
            priceId,
            currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          });
        } else {
          console.log(`Checkout completed but no teamId in subscription metadata: ${subscriptionId}`);
        }
      }
    },

    // Handle new subscription created
    "customer.subscription.created": async (ctx, event: Stripe.CustomerSubscriptionCreatedEvent) => {
      const subscription = event.data.object;
      const teamId = subscription.metadata?.teamId;
      const subscriptionItem = subscription.items.data[0];
      const priceId = subscriptionItem?.price.id || "";
      const currentPeriodEnd = subscriptionItem?.current_period_end
        ? subscriptionItem.current_period_end * 1000
        : Date.now() + 30 * 24 * 60 * 60 * 1000;

      if (teamId) {
        console.log(`Subscription CREATED for team ${teamId}: ${subscription.status}`);

        await ctx.runMutation(internal.stripe.syncSubscriptionDirectly, {
          teamId: teamId as any,
          subscriptionId: subscription.id,
          status: subscription.status,
          priceId,
          currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });
      } else {
        console.log(`Subscription created but no teamId in metadata: ${subscription.id}`);
      }
    },

    // Handle subscription updates
    "customer.subscription.updated": async (ctx, event: Stripe.CustomerSubscriptionUpdatedEvent) => {
      const subscription = event.data.object;
      const teamId = subscription.metadata?.teamId;
      const subscriptionItem = subscription.items.data[0];
      const priceId = subscriptionItem?.price.id || "";
      const currentPeriodEnd = subscriptionItem?.current_period_end
        ? subscriptionItem.current_period_end * 1000
        : Date.now() + 30 * 24 * 60 * 60 * 1000;

      if (teamId) {
        console.log(`Subscription updated for team ${teamId}: ${subscription.status}`);

        await ctx.runMutation(internal.stripe.syncSubscriptionDirectly, {
          teamId: teamId as any,
          subscriptionId: subscription.id,
          status: subscription.status,
          priceId,
          currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });
      }
    },

    // Handle subscription cancellation
    "customer.subscription.deleted": async (ctx, event: Stripe.CustomerSubscriptionDeletedEvent) => {
      const subscription = event.data.object;
      const teamId = subscription.metadata?.teamId;

      if (teamId) {
        console.log(`Subscription deleted for team ${teamId}`);

        await ctx.runMutation(internal.stripe.updateTeamToFree, {
          teamId,
        });
      }
    },
  },
  onEvent: async (_ctx, event: Stripe.Event) => {
    // Log all events for debugging
    console.log(`Stripe event received: ${event.type}`);
  },
});

export default http;
