import type { ReactNode } from "react";
import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatTokens } from "@/lib/aiPricing";
import type { BillingPlan } from "@/lib/billingPlans";
import { cn } from "@/lib/utils";

type BillingPlanCardProps = {
  plan: BillingPlan;
  availabilityLabel: string;
  availabilityVariant?: "default" | "secondary" | "outline" | "destructive";
  isCurrentPlan?: boolean;
  isRecommended?: boolean;
  footer?: ReactNode;
  className?: string;
};

export function BillingPlanCard({
  plan,
  availabilityLabel,
  availabilityVariant = "outline",
  isCurrentPlan = false,
  isRecommended = false,
  footer,
  className,
}: BillingPlanCardProps) {
  return (
    <Card
      className={cn(
        "h-full border-border/70 bg-card shadow-none",
        isRecommended && "border-primary/30 bg-primary/[0.03]",
        isCurrentPlan && "border-primary/25",
        className,
      )}
    >
      <CardHeader className="gap-4 border-b border-border/70">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              {isRecommended ? <Badge>Recommended</Badge> : null}
            </div>
            <CardDescription>{plan.description}</CardDescription>
          </div>
          <Badge variant={availabilityVariant}>{availabilityLabel}</Badge>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-semibold tracking-tight">
            ${plan.price}
          </span>
          <span className="pb-1 text-sm text-muted-foreground">per month</span>
        </div>
      </CardHeader>
      <CardContent className="flex h-full flex-col gap-6 pt-6">
        <div className="rounded-xl bg-secondary/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Monthly AI credits
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {formatTokens(plan.monthlyCredits)}
          </p>
        </div>

        <div className="grid gap-3 text-sm text-muted-foreground">
          {plan.limits.map((limit) => (
            <div
              key={limit}
              className="flex items-center gap-2 rounded-lg border border-transparent bg-secondary/70 px-3 py-2"
            >
              <Check className="size-4 text-primary" />
              <span>{limit}</span>
            </div>
          ))}
        </div>
      </CardContent>
      {footer ? (
        <CardFooter className="mt-auto border-t border-border/40 pt-6">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}
