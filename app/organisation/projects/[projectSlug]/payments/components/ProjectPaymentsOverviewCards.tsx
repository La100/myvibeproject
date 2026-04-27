"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

type ProjectPaymentsOverviewCardsProps = {
  currency: string;
  scheduledTotal: number;
  collectedTotal: number;
  outstandingTotal: number;
  overdueCount: number;
};

function OverviewCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <Card className="gap-3 rounded-2xl border-border/70 bg-card py-4 shadow-sm">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="text-[13px] font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pt-0 text-[1.35rem] font-semibold leading-none tracking-tight sm:text-[1.45rem]">
        {value}
      </CardContent>
    </Card>
  );
}

export function ProjectPaymentsOverviewCards({
  currency,
  scheduledTotal,
  collectedTotal,
  outstandingTotal,
  overdueCount,
}: ProjectPaymentsOverviewCardsProps) {
  return (
    <div className="grid gap-2.5 md:grid-cols-4">
      <OverviewCard title="Scheduled" value={formatCurrency(scheduledTotal || 0, currency)} />
      <OverviewCard title="Collected" value={formatCurrency(collectedTotal || 0, currency)} />
      <OverviewCard title="Outstanding" value={formatCurrency(outstandingTotal || 0, currency)} />
      <OverviewCard title="Overdue" value={String(overdueCount || 0)} />
    </div>
  );
}
