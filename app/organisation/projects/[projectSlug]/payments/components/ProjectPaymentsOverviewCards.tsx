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
    <Card className="border-border/70 bg-white shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-[2rem] font-semibold tracking-tight">{value}</CardContent>
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
    <div className="grid gap-4 md:grid-cols-4">
      <OverviewCard title="Scheduled" value={formatCurrency(scheduledTotal || 0, currency)} />
      <OverviewCard title="Collected" value={formatCurrency(collectedTotal || 0, currency)} />
      <OverviewCard title="Outstanding" value={formatCurrency(outstandingTotal || 0, currency)} />
      <OverviewCard title="Overdue" value={String(overdueCount || 0)} />
    </div>
  );
}
