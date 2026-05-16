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
import type { BillingCurrency, BillingPlan } from "@/lib/billingPlans";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type BillingPlanCardProps = {
  plan: BillingPlan;
  availabilityLabel: string;
  availabilityVariant?: "default" | "secondary" | "outline" | "destructive";
  isCurrentPlan?: boolean;
  isRecommended?: boolean;
  currency: BillingCurrency;
  locale: "en" | "pl";
  seatCount?: number;
  footer?: ReactNode;
  className?: string;
};

export function BillingPlanCard({
  plan,
  availabilityLabel,
  availabilityVariant = "outline",
  isCurrentPlan = false,
  isRecommended = false,
  currency,
  locale,
  seatCount = 1,
  footer,
  className,
}: BillingPlanCardProps) {
  const { t } = useI18n();
  const badgeLabel = isCurrentPlan
    ? availabilityLabel
    : isRecommended
      ? t("billingPlanCard", "recommended")
      : plan.key === "ai_scale"
        ? availabilityLabel
        : null;
  const planCopy = {
    core: {
      name: t("billingPlanCard", "coreName"),
      description: t("billingPlanCard", "coreDescription"),
      limits: [
        t("billingPlanCard", "coreLimitProjects"),
        t("billingPlanCard", "coreLimitMembers"),
        t("billingPlanCard", "coreLimitStorage"),
      ],
    },
    ai: {
      name: t("billingPlanCard", "aiName"),
      description: t("billingPlanCard", "aiDescription"),
      limits: [
        t("billingPlanCard", "aiLimitProjects"),
        t("billingPlanCard", "aiLimitMembers"),
        t("billingPlanCard", "aiLimitStorage"),
      ],
    },
    ai_scale: {
      name: t("billingPlanCard", "aiScaleName"),
      description: t("billingPlanCard", "aiScaleDescription"),
      limits: [
        t("billingPlanCard", "aiScaleLimitProjects"),
        t("billingPlanCard", "aiScaleLimitMembers"),
        t("billingPlanCard", "aiScaleLimitStorage"),
      ],
    },
  }[plan.key];
  const formatter = new Intl.NumberFormat(locale === "pl" ? "pl-PL" : "en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  });
  const pricePerUser = plan.prices[currency];
  const monthlyTotal = pricePerUser * Math.max(1, seatCount);

  return (
    <Card
      className={cn(
        "h-full min-w-0 gap-0 overflow-hidden rounded-lg border-border/70 bg-card py-0 shadow-none",
        isRecommended && "border-primary/30 bg-primary/[0.03]",
        isCurrentPlan && "border-primary/25",
        className,
      )}
    >
      <CardHeader className="gap-3 border-b border-border/70 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 basis-48 flex-col gap-2">
            <CardTitle className="shrink-0 whitespace-nowrap text-lg font-semibold">
              {planCopy.name}
            </CardTitle>
            <CardDescription>{planCopy.description}</CardDescription>
          </div>
          {badgeLabel ? (
            <Badge className="shrink-0 whitespace-nowrap" variant={availabilityVariant}>
              {badgeLabel}
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
          <span className="text-2xl font-semibold leading-none tracking-tight">
            {formatter.format(pricePerUser)}
          </span>
          <span className="pb-1 text-sm text-muted-foreground">
            {t("billingPlanCard", "perUserMonth")}
          </span>
          {seatCount > 1 ? (
            <span className="basis-full text-xs text-muted-foreground">
              {t("billingPlanCard", "estimatedMonthlyTotal", {
                amount: formatter.format(monthlyTotal),
              })}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex h-full flex-col gap-3 px-5 py-4">
        <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-secondary/70 px-3 py-2.5">
          <p className="min-w-0 break-words text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {plan.monthlyCreditsPerUser > 0
              ? t("billingPlanCard", "monthlyAiCreditsPerUser")
              : t("billingPlanCard", "aiCredits")}
          </p>
          <p className="shrink-0 text-lg font-semibold tabular-nums">
            {plan.monthlyCreditsPerUser > 0
              ? formatTokens(plan.monthlyCreditsPerUser)
              : t("billingPlanCard", "noAiCredits")}
          </p>
        </div>

        <div className="grid gap-2 text-sm text-muted-foreground">
          {planCopy.limits.map((limit) => (
            <div
              key={limit}
              className="flex min-w-0 items-start gap-2 py-1.5"
            >
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="min-w-0 break-words">{limit}</span>
            </div>
          ))}
        </div>
      </CardContent>
      {footer ? (
        <CardFooter className="mt-auto border-t border-border/40 px-5 py-4">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}
