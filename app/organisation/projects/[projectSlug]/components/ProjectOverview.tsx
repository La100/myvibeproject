"use client";

import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  TrendingUp,
  MapPin,
  DollarSign,
  Building2,
  User,
  Target,
  Hammer,
  Wallet,
} from "lucide-react";
import { Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { calculateShoppingTotal } from "@/lib/shoppingAlternatives";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import { formatCurrency } from "@/lib/utils";

function ProjectOverviewSkeleton() {
  return <Spinner />;
}

function ProjectOverviewContent() {
  const { project } = useProject();

  const tasks = useQuery(apiAny.tasks.listProjectTasks, {
    projectId: project._id,
  });

  const shoppingListItems = useQuery(apiAny.shopping.getShoppingListItemsByProject, {
    projectId: project._id,
  });

  const laborItems = useQuery(
    apiAny.labor.listLaborItems,
    { projectId: project._id }
  );
  const paymentsData = useQuery(apiAny.projectPayments.getProjectPaymentsOverview, {
    projectId: project._id,
  });

  if (
    tasks === undefined ||
    shoppingListItems === undefined ||
    laborItems === undefined ||
    paymentsData === undefined
  ) {
    return <ProjectOverviewSkeleton />;
  }

  const shoppingListCost = calculateShoppingTotal(shoppingListItems);
  const laborCost = laborItems.reduce((sum: number, item) => sum + (item.totalPrice || 0), 0);
  const netCost = shoppingListCost + laborCost;
  const taxRate = project.taxEnabled ? project.taxRate ?? 23 : 0;
  const taxAmount = taxRate > 0 ? netCost * (taxRate / 100) : 0;
  const totalCost = netCost + taxAmount;
  const currencySymbol = project.currency === "EUR" ? "€" : project.currency === "PLN" ? "zł" : "$";
  const unpaidInstallments =
    ((paymentsData?.installments as Array<{
      _id: string;
      title: string;
      amount: number;
      currency: string;
      dueDate?: number;
      status: "draft" | "open" | "paid" | "void" | "uncollectible";
      isOverdue?: boolean;
    }> | undefined) ?? [])
      .filter((installment) => installment.status !== "paid" && installment.status !== "void")
      .slice(0, 3);

  const statusColors = {
    planning: "border-sky-200 bg-sky-50 text-sky-700",
    active: "border-emerald-200 bg-emerald-50 text-emerald-700",
    on_hold: "border-amber-200 bg-amber-50 text-amber-700",
    completed: "border-indigo-200 bg-indigo-50 text-indigo-700",
    done: "border-indigo-200 bg-indigo-50 text-indigo-700",
    cancelled: "border-rose-200 bg-rose-50 text-rose-700",
  };
  return (
    <ProjectPageLayout>
      <div className="space-y-7">
        <ProjectPageHeader
          title="Project Overview"
          icon={<Target className="h-8 w-8 text-[var(--ui-accent-brand)]" />}
          subtitle={`A summary of ${project.name}`}
        />

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mb-8 lg:grid-cols-3 lg:gap-5">
          {/* Total Project Cost */}
          <Card className="bg-card/90">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Project Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalCost.toFixed(2)} {currencySymbol}
              </div>
              <p className="text-xs text-muted-foreground">
                {taxRate > 0 ? `Gross total including ${taxRate}% tax` : "Shopping List & Labor"}
              </p>
            </CardContent>
          </Card>

          {/* Shopping List Cost */}
          <Card className="bg-card/90">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Shopping List Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {shoppingListCost.toFixed(2)} {currencySymbol}
              </div>
              <p className="text-xs text-muted-foreground">
                Net cost from all items
              </p>
            </CardContent>
          </Card>

          {/* Labor Cost */}
          <Card className="bg-card/90">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Hammer className="h-4 w-4" />
                Labor Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {laborCost.toFixed(2)} {currencySymbol}
              </div>
              <p className="text-xs text-muted-foreground">
                Net cost from all labor items
              </p>
            </CardContent>
          </Card>

          {taxRate > 0 && (
            <Card className="bg-card/90">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Tax
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {taxAmount.toFixed(2)} {currencySymbol}
                </div>
                <p className="text-xs text-muted-foreground">
                  Calculated at {taxRate}% on current net costs
                </p>
              </CardContent>
            </Card>
          )}

          {/* Project Status */}
          <Card className="bg-card/90">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Project Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className={statusColors[project.status as keyof typeof statusColors]}>
                {project.status.replace("_", " ").toUpperCase()}
              </Badge>
            </CardContent>
          </Card>

          {/* Client */}
          {project.customer && (
            <Card className="bg-card/90">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Client
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">{project.customer}</div>
              </CardContent>
            </Card>
          )}

          {/* Location */}
          {project.location && (
            <Card className="bg-card/90">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">{project.location}</div>
              </CardContent>
            </Card>
          )}

          {/* Budget */}
          {project.budget && (
            <Card className="bg-card/90">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Budget
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">
                  {project.budget.toLocaleString()} {currencySymbol}
                </div>
                <p className="text-xs text-muted-foreground">
                  Allocated budget
                </p>
              </CardContent>
            </Card>
          )}

          {paymentsData && paymentsData.totals.installmentCount > 0 ? (
            <Card className="bg-card/90">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Payments Collected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">
                  {formatCurrency(paymentsData.totals.paid || 0, paymentsData.currency)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Outstanding: {formatCurrency(paymentsData.totals.outstanding || 0, paymentsData.currency)}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {/* Project Dates */}
          {(project.startDate || project.endDate) && (
            <Card className="bg-card/90">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {project.startDate && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Start: </span>
                      <span className="font-medium">
                        {new Date(project.startDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {project.endDate && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">End: </span>
                      <span className="font-medium">
                        {new Date(project.endDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Project Cost vs Budget */}
          {project.budget && (
            <Card className="bg-card/90">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Cost vs Budget
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Spent:</span>
                    <span className="font-semibold">{totalCost.toFixed(2)} {currencySymbol}</span>
                  </div>
                  {taxRate > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Net:</span>
                        <span className="font-semibold">{netCost.toFixed(2)} {currencySymbol}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tax ({taxRate}%):</span>
                        <span className="font-semibold">{taxAmount.toFixed(2)} {currencySymbol}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-sm">
                    <span>Budget:</span>
                    <span className="font-semibold">{project.budget.toLocaleString()} {currencySymbol}</span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-secondary/75">
                    <div
                      className={`h-2 rounded-full transition-all ${(totalCost / project.budget) > 1 ? 'bg-red-500' :
                          (totalCost / project.budget) > 0.8 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                      style={{ width: `${Math.min((totalCost / project.budget) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {((totalCost / project.budget) * 100).toFixed(1)}% of budget used
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        {/* Project Description */}
        {project.description && (
          <Card className="bg-card/92">
            <CardHeader className="pb-4">
              <CardTitle className="clean-title text-lg font-medium lg:text-xl">Project Description</CardTitle>
            </CardHeader>
            <CardContent className="px-6">
              <p className="text-muted-foreground leading-relaxed">
                {project.description}
              </p>
            </CardContent>
          </Card>
        )}

        {unpaidInstallments.length > 0 ? (
          <Card className="bg-card/92">
            <CardHeader className="pb-4">
              <CardTitle className="clean-title text-lg font-medium lg:text-xl">Upcoming Installments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-6">
              {unpaidInstallments.map((installment) => (
                <div key={installment._id} className="flex items-center justify-between rounded-xl border p-4">
                  <div>
                    <p className="font-medium">{installment.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {installment.dueDate
                        ? `Due ${new Date(installment.dueDate).toLocaleDateString()}`
                        : "No due date"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(installment.amount, installment.currency)}</p>
                    <p className="text-xs text-muted-foreground">
                      {installment.isOverdue ? "Overdue" : installment.status.replace("_", " ")}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </ProjectPageLayout>
  );
}

export default function ProjectOverview() {
  return (
    <Suspense fallback={<ProjectOverviewSkeleton />}>
      <ProjectOverviewContent />
    </Suspense>
  );
} 
