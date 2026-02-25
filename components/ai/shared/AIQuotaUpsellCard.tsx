"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { apiAny } from "@/lib/convexApiAny";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowRight, Coins, CreditCard, Loader2 } from "lucide-react";

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
  const router = useRouter();
  const createCheckoutSession = useAction(apiAny.stripeActions.createCheckoutSession);
  const createBillingPortalSession = useAction(apiAny.stripeActions.createBillingPortalSession);

  const [pendingAction, setPendingAction] = useState<"checkout" | "portal" | null>(null);

  const isFreePlan = currentPlan === "free";
  const canOpenPortal = !!subscriptionStatus && subscriptionStatus !== "canceled";
  const resolvedMessage =
    message && message.trim().length > 0
      ? message.replace(/contact your administrator\.?/i, "Open Billing to upgrade and continue.")
      : "AI credits are exhausted.";

  const handleUpgrade = async () => {
    const priceId = process.env.NEXT_PUBLIC_STRIPE_AI_PRICE_ID;
    if (!priceId) {
      toast.error("Billing is not configured yet. Please open Settings > Billing.");
      return;
    }

    setPendingAction("checkout");
    try {
      const result = await createCheckoutSession({ teamId, priceId });
      if (!result.url) {
        toast.error("Could not open checkout.");
        return;
      }
      window.location.href = result.url;
    } catch (error) {
      console.error("Checkout failed:", error);
      toast.error("Could not open checkout.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleOpenPortal = async () => {
    setPendingAction("portal");
    try {
      const result = await createBillingPortalSession({ teamId });
      if (!result.url) {
        toast.error("Could not open billing portal.");
        return;
      }
      window.location.href = result.url;
    } catch (error) {
      console.error("Billing portal failed:", error);
      toast.error("Could not open billing portal.");
    } finally {
      setPendingAction(null);
    }
  };

  const isBusy = pendingAction !== null;

  return (
    <Card className={cn("border-border/60 bg-card/70", className)}>
      <CardHeader className="space-y-3 pb-3">
        <Badge
          variant="secondary"
          className="w-fit border-0 bg-orange-100 px-2.5 py-1 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300"
        >
          AI credits exhausted
        </Badge>
        <div className="space-y-1">
          <CardTitle className="text-lg tracking-tight">AI usage paused</CardTitle>
          <CardDescription>{resolvedMessage}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Remaining credits</span>
          <span className="text-sm font-semibold tabular-nums">{remainingTokens.toLocaleString()}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {isFreePlan ? (
            <Button onClick={handleUpgrade} disabled={isBusy} className="h-9">
              {pendingAction === "checkout" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opening checkout...
                </>
              ) : (
                <>
                  <Coins className="mr-2 h-4 w-4" />
                  Upgrade to AI Pro
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          ) : canOpenPortal ? (
            <Button onClick={handleOpenPortal} disabled={isBusy} className="h-9">
              {pendingAction === "portal" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opening billing...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Manage billing
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleUpgrade} disabled={isBusy} className="h-9">
              {pendingAction === "checkout" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opening checkout...
                </>
              ) : (
                <>
                  <Coins className="mr-2 h-4 w-4" />
                  Renew / Upgrade plan
                </>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            className="h-9"
            onClick={() => router.push("/organisation/settings")}
            disabled={isBusy}
          >
            Open billing settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default AIQuotaUpsellCard;
