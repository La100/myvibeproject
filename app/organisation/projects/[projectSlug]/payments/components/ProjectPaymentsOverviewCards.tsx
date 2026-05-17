"use client";

import { useI18n } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils";

type ProjectPaymentsOverviewCardsProps = {
  currency: string;
  draftTotal: number;
  draftCount: number;
  outstandingTotal: number;
  openCount: number;
  collectedTotal: number;
  paidCount: number;
  overdueTotal: number;
  overdueCount: number;
};

function OverviewMetric({
  title,
  value,
  count,
  className = "",
}: {
  title: string;
  value: string;
  count: number;
  className?: string;
}) {
  return (
    <div className={`min-w-0 px-4 py-4 sm:px-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </p>
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">
          {count}
        </span>
      </div>
      <p className="mt-2 truncate text-xl font-semibold leading-none tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

export function ProjectPaymentsOverviewCards({
  currency,
  draftTotal,
  draftCount,
  outstandingTotal,
  openCount,
  collectedTotal,
  paidCount,
  overdueTotal,
  overdueCount,
}: ProjectPaymentsOverviewCardsProps) {
  const { t } = useI18n();

  return (
    <section className="grid overflow-hidden rounded-xl border border-border/70 bg-card sm:grid-cols-2 xl:grid-cols-4">
      <OverviewMetric
        title={t("projectPayments", "draftsMetric")}
        value={formatCurrency(draftTotal || 0, currency)}
        count={draftCount || 0}
        className="border-b border-border/60 sm:border-r xl:border-b-0"
      />
      <OverviewMetric
        title={t("projectPayments", "outstanding")}
        value={formatCurrency(outstandingTotal || 0, currency)}
        count={openCount || 0}
        className="border-b border-border/60 xl:border-r xl:border-b-0"
      />
      <OverviewMetric
        title={t("projectPayments", "collected")}
        value={formatCurrency(collectedTotal || 0, currency)}
        count={paidCount || 0}
        className="border-b border-border/60 sm:border-r sm:border-b-0 xl:border-r"
      />
      <OverviewMetric
        title={t("projectPayments", "overdue")}
        value={formatCurrency(overdueTotal || 0, currency)}
        count={overdueCount || 0}
      />
    </section>
  );
}
