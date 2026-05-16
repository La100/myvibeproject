"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { apiAny } from "@/lib/convexApiAny";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowRight, Coins, CreditCard, Loader2 } from "lucide-react";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { BillingActionErrorDialog } from "@/components/billing/BillingActionErrorDialog";
import { useI18n } from "@/lib/i18n";

type AIQuotaUpsellCardProps = {
  teamId: Id<"teams">;
  currentPlan?: string;
  subscriptionStatus?: string | null;
  message?: string;
  remainingTokens?: number;
  className?: string;
};

export function AIQuotaUpsellCard({
  teamId,
  currentPlan = "free",
  subscriptionStatus,
  message,
  remainingTokens = 0,
  className,
}: AIQuotaUpsellCardProps) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const subscription = useQuery(apiAny.stripe.getTeamSubscription, { teamId });
  const createCheckoutSession = useAction(
    apiAny.stripeActions.createCheckoutSession,
  );
  const createBillingPortalSession = useAction(
    apiAny.stripeActions.createBillingPortalSession,
  );

  const [pendingAction, setPendingAction] = useState<
    "checkout" | "portal" | null
  >(null);
  const [billingActionError, setBillingActionError] = useState<string | null>(
    null,
  );

  const isFreePlan = currentPlan === "free";
  const canOpenPortal =
    !!subscriptionStatus && subscriptionStatus !== "canceled";
  const billingCurrency = locale === "pl" ? "pln" : "usd";
  const aiPriceId = subscription?.checkoutPlans?.ai?.[billingCurrency] ?? null;
  const resolvedMessage =
    message && message.trim().length > 0
      ? message.replace(
          /contact your administrator\.?/i,
          t("aiShell", "adminUpgradeReplacement"),
        )
      : t("aiShell", "defaultCreditsMessage");

  const handleUpgrade = async () => {
    if (subscription === undefined) {
      toast.error(t("aiShell", "billingLoading"));
      return;
    }

    if (!aiPriceId) {
      toast.error(t("aiShell", "billingNotConfigured"));
      return;
    }

    setPendingAction("checkout");
    try {
      const result = await createCheckoutSession({
        teamId,
        priceId: aiPriceId,
        baseUrl: window.location.origin,
      });
      if (!result.url) {
        toast.error(t("aiShell", "checkoutOpenFailed"));
        return;
      }
      window.location.href = result.url;
    } catch (error) {
      console.error("Checkout failed:", error);
      setBillingActionError(toUserFacingErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  };

  const handleOpenPortal = async () => {
    setPendingAction("portal");
    try {
      const result = await createBillingPortalSession({
        teamId,
        baseUrl: window.location.origin,
      });
      if (!result.url) {
        toast.error(t("aiShell", "billingPortalOpenFailed"));
        return;
      }
      window.location.href = result.url;
    } catch (error) {
      console.error("Billing portal failed:", error);
      setBillingActionError(toUserFacingErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  };

  const isBusy = pendingAction !== null;

  return (
    <>
      <BillingActionErrorDialog
        message={billingActionError}
        onClose={() => setBillingActionError(null)}
      />
      <Card className={cn("border-border/60 bg-card/70", className)}>
        <CardHeader className="flex flex-col gap-3 pb-3">
          <Badge variant="secondary" className="w-fit">
            {t("aiShell", "creditsExhausted")}
          </Badge>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg tracking-tight">
              {t("aiShell", "usagePaused")}
            </CardTitle>
            <CardDescription>{resolvedMessage}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-0">
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("aiShell", "remainingCredits")}
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {remainingTokens.toLocaleString()}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {isFreePlan ? (
              <Button onClick={handleUpgrade} disabled={isBusy} className="h-9">
                {pendingAction === "checkout" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("aiShell", "openingCheckout")}
                  </>
                ) : (
                  <>
                    <Coins className="mr-2 h-4 w-4" />
                    {t("aiShell", "upgradeToAiPro")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            ) : canOpenPortal ? (
              <Button
                onClick={handleOpenPortal}
                disabled={isBusy}
                className="h-9"
              >
                {pendingAction === "portal" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("aiShell", "openingBilling")}
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    {t("aiShell", "manageBilling")}
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleUpgrade} disabled={isBusy} className="h-9">
                {pendingAction === "checkout" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("aiShell", "openingCheckout")}
                  </>
                ) : (
                  <>
                    <Coins className="mr-2 h-4 w-4" />
                    {t("aiShell", "renewUpgradePlan")}
                  </>
                )}
              </Button>
            )}

            <Button
              variant="outline"
              className="h-9"
              onClick={() => router.push("/organisation/subscription")}
              disabled={isBusy}
            >
              {t("aiShell", "openBillingSettings")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default AIQuotaUpsellCard;
