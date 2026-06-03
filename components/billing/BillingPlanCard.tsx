import type { CSSProperties, ReactNode } from "react";
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

type BillingPlanTone = {
  accent: string;
  background: string;
  badgeBackground: string;
  badgeBorder: string;
  border: string;
  creditBackground: string;
  creditBorder: string;
  mutedText: string;
  ring: string;
};

const planTones = {
  core: {
    accent: "var(--foreground)",
    background: "var(--card)",
    badgeBackground: "color-mix(in oklab, var(--foreground) 4%, var(--card) 96%)",
    badgeBorder: "color-mix(in oklab, var(--foreground) 10%, transparent)",
    border: "color-mix(in oklab, var(--foreground) 10%, transparent)",
    creditBackground: "color-mix(in oklab, var(--secondary) 78%, var(--card) 22%)",
    creditBorder: "color-mix(in oklab, var(--foreground) 7%, transparent)",
    mutedText: "color-mix(in oklab, var(--foreground) 62%, var(--background) 38%)",
    ring: "color-mix(in oklab, var(--foreground) 14%, transparent)",
  },
  ai: {
    accent: "var(--chart-2)",
    background: "var(--card)",
    badgeBackground: "color-mix(in oklab, var(--chart-2) 10%, var(--card) 90%)",
    badgeBorder: "color-mix(in oklab, var(--chart-2) 26%, transparent)",
    border: "color-mix(in oklab, var(--chart-2) 16%, var(--foreground) 8%)",
    creditBackground: "color-mix(in oklab, var(--chart-2) 8%, var(--card) 92%)",
    creditBorder: "color-mix(in oklab, var(--chart-2) 18%, transparent)",
    mutedText: "color-mix(in oklab, var(--foreground) 62%, var(--background) 38%)",
    ring: "color-mix(in oklab, var(--chart-2) 22%, transparent)",
  },
} satisfies Record<BillingPlan["key"], BillingPlanTone>;

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
  }[plan.key];
  const formatter = new Intl.NumberFormat(locale === "pl" ? "pl-PL" : "en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  });
  const pricePerUser = plan.prices[currency];
  const monthlyTotal = pricePerUser * Math.max(1, seatCount);
  const tone = planTones[plan.key];
  const toneStyle = {
    "--billing-plan-accent": tone.accent,
    "--billing-plan-bg": tone.background,
    "--billing-plan-badge-bg": tone.badgeBackground,
    "--billing-plan-badge-border": tone.badgeBorder,
    "--billing-plan-border": tone.border,
    "--billing-plan-credit-bg": tone.creditBackground,
    "--billing-plan-credit-border": tone.creditBorder,
    "--billing-plan-muted": tone.mutedText,
    "--billing-plan-ring": tone.ring,
  } as CSSProperties;

  return (
    <Card
      style={toneStyle}
      className={cn(
        "h-full min-w-0 gap-0 overflow-hidden rounded-lg border border-[color:var(--billing-plan-border)] bg-[var(--billing-plan-bg)] py-0 shadow-none",
        (isRecommended || isCurrentPlan) &&
          "ring-1 ring-[color:var(--billing-plan-ring)]",
        className,
      )}
    >
      <CardHeader className="gap-3 border-b border-[color:var(--billing-plan-border)] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 basis-48 flex-col gap-2">
            <CardTitle className="shrink-0 whitespace-nowrap text-lg font-semibold text-foreground">
              {planCopy.name}
            </CardTitle>
            <CardDescription className="text-[color:var(--billing-plan-muted)]">
              {planCopy.description}
            </CardDescription>
          </div>
          {badgeLabel ? (
            <Badge
              className="shrink-0 whitespace-nowrap border-[color:var(--billing-plan-badge-border)] bg-[var(--billing-plan-badge-bg)] text-[color:var(--billing-plan-accent)]"
              variant={availabilityVariant}
            >
              {badgeLabel}
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
          <span className="text-2xl font-semibold leading-none tracking-tight text-foreground">
            {formatter.format(pricePerUser)}
          </span>
          <span className="pb-1 text-sm text-[color:var(--billing-plan-muted)]">
            {t("billingPlanCard", "perUserMonth")}
          </span>
          {seatCount > 1 ? (
            <span className="basis-full text-xs text-[color:var(--billing-plan-muted)]">
              {t("billingPlanCard", "estimatedMonthlyTotal", {
                amount: formatter.format(monthlyTotal),
              })}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex h-full flex-col gap-3 px-5 py-4">
        <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-[color:var(--billing-plan-credit-border)] bg-[var(--billing-plan-credit-bg)] px-3 py-2.5">
          <div className="min-w-0">
            <p className="break-words text-[10px] uppercase tracking-[0.16em] text-[color:var(--billing-plan-muted)]">
              {plan.monthlyCreditsPerUser > 0
                ? t("billingPlanCard", "includedAiCapacity")
                : t("billingPlanCard", "aiCredits")}
            </p>
          </div>
          <p className="shrink-0 text-lg font-semibold tabular-nums text-foreground">
            {plan.monthlyCreditsPerUser > 0
              ? formatTokens(plan.monthlyCreditsPerUser)
              : t("billingPlanCard", "noAiCredits")}
          </p>
        </div>

        <div className="grid gap-2 text-sm text-[color:var(--billing-plan-muted)]">
          {planCopy.limits.map((limit) => (
            <div
              key={limit}
              className="flex min-w-0 items-start gap-2 py-1.5"
            >
              <Check className="mt-0.5 size-4 shrink-0 text-[color:var(--billing-plan-accent)]" />
              <span className="min-w-0 break-words">{limit}</span>
            </div>
          ))}
        </div>
      </CardContent>
      {footer ? (
        <CardFooter className="mt-auto border-t border-[color:var(--billing-plan-border)] px-5 py-4">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}
