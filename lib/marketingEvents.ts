"use client";

import { BILLING_PLANS, type BillingPlanKey } from "@/lib/billingPlans";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

type EventOptions = {
  eventId: string;
  dedupeKey: string;
};

type SubscriptionConversionInput = {
  teamId: string;
  planKey: string;
  subscriptionId?: string | null;
  priceId?: string | null;
};

const storagePrefix = "myvibe:marketing-event:";
const pendingEvents = new Set<string>();

const wasTracked = ({ dedupeKey }: Pick<EventOptions, "dedupeKey">) => {
  if (typeof window === "undefined") {
    return true;
  }

  return Boolean(window.localStorage.getItem(`${storagePrefix}${dedupeKey}`));
};

const markTracked = ({ dedupeKey }: Pick<EventOptions, "dedupeKey">) => {
  window.localStorage.setItem(`${storagePrefix}${dedupeKey}`, String(Date.now()));
};

const trackersReady = () => Boolean(window.fbq || window.gtag);

const trackOnceWhenReady = (
  { dedupeKey }: Pick<EventOptions, "dedupeKey">,
  track: () => void,
  attemptsLeft = 20,
) => {
  if (typeof window === "undefined" || wasTracked({ dedupeKey })) {
    return;
  }

  if (!trackersReady()) {
    if (attemptsLeft <= 0 || pendingEvents.has(dedupeKey)) {
      return;
    }

    pendingEvents.add(dedupeKey);
    window.setTimeout(() => {
      pendingEvents.delete(dedupeKey);
      trackOnceWhenReady({ dedupeKey }, track, attemptsLeft - 1);
    }, 250);
    return;
  }

  track();
  markTracked({ dedupeKey });
};

const trackMetaEvent = (
  eventName: string,
  params: Record<string, unknown>,
  eventId: string,
) => {
  window.fbq?.("track", eventName, params, { eventID: eventId });
};

const trackGaEvent = (
  eventName: string,
  params: Record<string, unknown>,
) => {
  window.gtag?.("event", eventName, params);
};

export const trackCompleteRegistration = (userId: string) => {
  const eventId = `registration:${userId}`;

  trackOnceWhenReady({ dedupeKey: eventId }, () => {
    trackMetaEvent(
      "CompleteRegistration",
      {
        content_name: "account_registration",
        status: true,
      },
      eventId,
    );

    trackGaEvent("sign_up", {
      method: "clerk",
    });
  });
};

export const trackSubscriptionConversion = ({
  teamId,
  planKey,
  subscriptionId,
  priceId,
}: SubscriptionConversionInput) => {
  const plan = BILLING_PLANS.find(
    (billingPlan) => billingPlan.key === planKey,
  );
  const normalizedPlanKey = (plan?.key ?? planKey) as BillingPlanKey | string;
  const transactionId = subscriptionId || `${teamId}:${normalizedPlanKey}`;
  const eventId = `subscription:${transactionId}`;

  const value = plan?.prices?.usd ?? 0;
  const currency = "USD";
  const planName = plan?.name ?? normalizedPlanKey;

  trackOnceWhenReady({ dedupeKey: eventId }, () => {
    trackMetaEvent(
      "Subscribe",
      {
        content_name: planName,
        content_category: "subscription",
        currency,
        value,
      },
      eventId,
    );

    trackGaEvent("purchase", {
      transaction_id: transactionId,
      value,
      currency,
      items: [
        {
          item_id: priceId || normalizedPlanKey,
          item_name: planName,
          item_category: "subscription",
          price: value,
          quantity: 1,
        },
      ],
    });

    trackGaEvent("conversion_event_subscribe_paid", {
      transaction_id: transactionId,
      value,
      currency,
      plan: normalizedPlanKey,
      price_id: priceId || undefined,
    });
  });
};
