"use client";

import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
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
  Flag,
  AlertTriangle,
} from "lucide-react";
import { Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { calculateShoppingTotal } from "@/lib/shoppingAlternatives";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import { cn, formatCurrency } from "@/lib/utils";

function ProjectOverviewSkeleton() {
  return <Spinner />;
}

const percentageOf = (value: number, total: number) =>
  total > 0 ? (value / total) * 100 : null;

const formatPercent = (value: number | null) =>
  value === null || !Number.isFinite(value)
    ? "No baseline"
    : `${Math.round(value)}%`;

function ProjectOverviewContent() {
  const { project } = useProject();

  const tasks = useQuery(apiAny.tasks.listProjectTasks, {
    projectId: project._id,
  });

  const shoppingListItems = useQuery(
    apiAny.shopping.getShoppingListItemsByProject,
    {
      projectId: project._id,
    },
  );

  const laborItems = useQuery(apiAny.labor.listLaborItems, {
    projectId: project._id,
  });
  const paymentsData = useQuery(
    apiAny.projectPayments.getProjectPaymentsOverview,
    {
      projectId: project._id,
    },
  );
  const milestonesSummary = useQuery(
    apiAny.projectMilestones.getProjectMilestonesSummary,
    {
      projectId: project._id,
    },
  );
  const budgetSummary = useQuery(apiAny.projectBudget.getProjectBudgetSummary, {
    projectId: project._id,
  });

  if (
    tasks === undefined ||
    shoppingListItems === undefined ||
    laborItems === undefined ||
    paymentsData === undefined ||
    milestonesSummary === undefined ||
    budgetSummary === undefined
  ) {
    return <ProjectOverviewSkeleton />;
  }

  const shoppingListCost = calculateShoppingTotal(shoppingListItems);
  const laborCost = laborItems.reduce(
    (sum: number, item) => sum + (item.totalPrice || 0),
    0,
  );
  const netCost = shoppingListCost + laborCost;
  const taxRate = project.taxEnabled ? (project.taxRate ?? 23) : 0;
  const taxAmount = taxRate > 0 ? netCost * (taxRate / 100) : 0;
  const totalCost = netCost + taxAmount;
  const currencySymbol =
    project.currency === "EUR" ? "€" : project.currency === "PLN" ? "zł" : "$";
  const unpaidInstallments = (
    (paymentsData?.installments as
      | Array<{
          _id: string;
          title: string;
          amount: number;
          currency: string;
          dueDate?: number;
          status: "draft" | "open" | "paid" | "void" | "uncollectible";
          isOverdue?: boolean;
        }>
      | undefined) ?? []
  )
    .filter(
      (installment) =>
        installment.status !== "paid" && installment.status !== "void",
    )
    .slice(0, 3);

  const statusVariants = {
    planning: "outline",
    active: "secondary",
    on_hold: "outline",
    completed: "default",
    done: "default",
    cancelled: "destructive",
  } as const;

  const hasBudgetBaseline = budgetSummary.budget > 0;
  const hasFinancialActivity =
    budgetSummary.plannedCost > 0 ||
    budgetSummary.committedCost > 0 ||
    budgetSummary.actualCost > 0 ||
    budgetSummary.revenue.acceptedEstimations > 0 ||
    budgetSummary.revenue.scheduledPayments > 0 ||
    budgetSummary.revenue.collectedPayments > 0;
  const shouldShowBudgetEmptyState =
    !hasBudgetBaseline && !hasFinancialActivity;
  const budgetReference = hasBudgetBaseline
    ? budgetSummary.budget
    : Math.max(
        budgetSummary.plannedCost,
        budgetSummary.committedCost,
        budgetSummary.actualCost,
        1,
      );

  const actualBudgetPercent = hasBudgetBaseline
    ? percentageOf(budgetSummary.actualCost, budgetSummary.budget)
    : null;
  const committedBudgetPercent = hasBudgetBaseline
    ? percentageOf(budgetSummary.committedCost, budgetSummary.budget)
    : null;
  const plannedBudgetPercent = hasBudgetBaseline
    ? percentageOf(budgetSummary.plannedCost, budgetSummary.budget)
    : null;
  const collectedCoveragePercent = percentageOf(
    budgetSummary.revenue.collectedPayments,
    budgetSummary.actualCost,
  );
  const acceptedCoveragePercent = percentageOf(
    budgetSummary.revenue.acceptedEstimations,
    budgetSummary.plannedCost,
  );
  const scheduledCoveragePercent = percentageOf(
    budgetSummary.revenue.scheduledPayments,
    budgetSummary.committedCost,
  );
  const materialsSharePercent = percentageOf(
    budgetSummary.breakdown.shopping.actual,
    budgetSummary.actualCost,
  );
  const laborSharePercent = percentageOf(
    budgetSummary.breakdown.labor.actual,
    budgetSummary.actualCost,
  );
  const remainingBudget = hasBudgetBaseline
    ? budgetSummary.budget - budgetSummary.actualCost
    : null;

  const budgetHealth = shouldShowBudgetEmptyState
    ? null
    : (() => {
        if (!hasBudgetBaseline && hasFinancialActivity) {
          return {
            badgeVariant: "outline" as const,
            label: "No budget baseline",
            description:
              "Costs or revenue are already moving, but the project still has no budget ceiling.",
          };
        }

        if (
          hasBudgetBaseline &&
          budgetSummary.actualCost > budgetSummary.budget
        ) {
          return {
            badgeVariant: "destructive" as const,
            label: "Over budget",
            description: `${formatCurrency(
              budgetSummary.actualCost,
              budgetSummary.currency,
            )} has already been spent against a ${formatCurrency(
              budgetSummary.budget,
              budgetSummary.currency,
            )} budget.`,
          };
        }

        if (
          hasBudgetBaseline &&
          budgetSummary.plannedCost > budgetSummary.budget
        ) {
          return {
            badgeVariant: "secondary" as const,
            label: "Forecast over budget",
            description: `The current plan lands ${formatCurrency(
              Math.abs(budgetSummary.projectedVariance),
              budgetSummary.currency,
            )} above the available budget.`,
          };
        }

        if (
          hasBudgetBaseline &&
          actualBudgetPercent !== null &&
          actualBudgetPercent >= 80
        ) {
          return {
            badgeVariant: "secondary" as const,
            label: "High burn",
            description: `${formatPercent(
              actualBudgetPercent,
            )} of the budget is already consumed by actual spend.`,
          };
        }

        return {
          badgeVariant: "default" as const,
          label: "On track",
          description: hasBudgetBaseline
            ? `${formatCurrency(
                Math.max(remainingBudget ?? 0, 0),
                budgetSummary.currency,
              )} remains before the current actual spend hits the budget limit.`
            : "Financial activity is being tracked and ready for a budget baseline.",
        };
      })();

  const spendRows = [
    {
      label: "Actual spend",
      amount: budgetSummary.actualCost,
      caption:
        actualBudgetPercent !== null
          ? `${formatPercent(actualBudgetPercent)} of budget`
          : "Completed cost recorded so far",
      indicatorClassName:
        hasBudgetBaseline && budgetSummary.actualCost > budgetSummary.budget
          ? "bg-destructive"
          : "bg-foreground",
    },
    {
      label: "Committed work",
      amount: budgetSummary.committedCost,
      caption:
        committedBudgetPercent !== null
          ? `${formatPercent(committedBudgetPercent)} of budget`
          : "Booked costs not yet fully realized",
      indicatorClassName: "bg-primary/80",
    },
    {
      label: "Planned scope",
      amount: budgetSummary.plannedCost,
      caption:
        plannedBudgetPercent !== null
          ? `${formatPercent(plannedBudgetPercent)} of budget`
          : "Projected total based on current scope",
      indicatorClassName:
        hasBudgetBaseline && budgetSummary.plannedCost > budgetSummary.budget
          ? "bg-destructive/80"
          : "bg-primary/45",
    },
  ];

  const spendMixRows = [
    {
      label: "Materials actual",
      amount: budgetSummary.breakdown.shopping.actual,
      note:
        materialsSharePercent !== null
          ? `${formatPercent(materialsSharePercent)} of actual spend`
          : "No delivered material cost yet",
    },
    {
      label: "Labor actual",
      amount: budgetSummary.breakdown.labor.actual,
      note:
        laborSharePercent !== null
          ? `${formatPercent(laborSharePercent)} of actual spend`
          : "No completed labor cost yet",
    },
    hasBudgetBaseline
      ? {
          label:
            (remainingBudget ?? 0) >= 0 ? "Budget remaining" : "Budget overrun",
          amount: Math.abs(remainingBudget ?? 0),
          note:
            (remainingBudget ?? 0) >= 0
              ? "Headroom left against actual spend"
              : "Actual spend is already beyond the cap",
        }
      : {
          label: "Forecast total",
          amount: budgetSummary.plannedCost,
          note: "Budget is missing, so runway cannot be measured yet",
        },
  ];

  const revenueRows = [
    {
      label: "Accepted estimates",
      amount: budgetSummary.revenue.acceptedEstimations,
      note:
        acceptedCoveragePercent !== null
          ? `${formatPercent(acceptedCoveragePercent)} of planned cost covered`
          : "No planned cost to cover yet",
    },
    {
      label: "Scheduled payments",
      amount: budgetSummary.revenue.scheduledPayments,
      note:
        scheduledCoveragePercent !== null
          ? `${formatPercent(scheduledCoveragePercent)} of committed cost covered`
          : "No committed cost to cover yet",
    },
    {
      label: "Collected payments",
      amount: budgetSummary.revenue.collectedPayments,
      note:
        collectedCoveragePercent !== null
          ? `${formatPercent(collectedCoveragePercent)} of actual spend recovered`
          : "No actual spend recorded yet",
    },
  ];

  const financialAlerts = [
    !hasBudgetBaseline && hasFinancialActivity
      ? {
          title: "Missing budget baseline",
          description:
            "Add a project budget so burn rate, runway, and variance can be measured against a real ceiling.",
          variant: "default" as const,
          className: "border-border/60 bg-muted/30",
        }
      : null,
    hasBudgetBaseline && budgetSummary.actualCost > budgetSummary.budget
      ? {
          title: "Actual spend is above budget",
          description: `${formatCurrency(
            budgetSummary.actualCost - budgetSummary.budget,
            budgetSummary.currency,
          )} has been spent beyond the current budget cap.`,
          variant: "destructive" as const,
          className: "",
        }
      : null,
    hasBudgetBaseline &&
    budgetSummary.actualCost <= budgetSummary.budget &&
    budgetSummary.plannedCost > budgetSummary.budget
      ? {
          title: "Current scope will likely break budget",
          description: `Planned cost is ${formatCurrency(
            Math.abs(budgetSummary.projectedVariance),
            budgetSummary.currency,
          )} higher than the available budget.`,
          variant: "default" as const,
          className: "border-border/60 bg-muted/30",
        }
      : null,
    budgetSummary.actualCost > 0 &&
    budgetSummary.revenue.collectedPayments < budgetSummary.actualCost
      ? {
          title: "Collected cash is behind real spend",
          description: `${formatCurrency(
            budgetSummary.revenue.collectedPayments,
            budgetSummary.currency,
          )} has been collected against ${formatCurrency(
            budgetSummary.actualCost,
            budgetSummary.currency,
          )} of actual cost.`,
          variant: "default" as const,
          className: "border-border/60 bg-muted/30",
        }
      : null,
  ].filter(
    (
      alert,
    ): alert is {
      title: string;
      description: string;
      variant: "default" | "destructive";
      className: string;
    } => alert !== null,
  );

  return (
    <ProjectPageLayout>
      <div className="flex flex-col gap-7">
        <ProjectPageHeader
          title="Project Overview"
          icon={<Target className="h-8 w-8 text-primary" />}
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
                {taxRate > 0
                  ? `Gross total including ${taxRate}% tax`
                  : "Shopping List & Labor"}
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
              <Badge
                variant={
                  statusVariants[project.status as keyof typeof statusVariants]
                }
              >
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
                  {formatCurrency(
                    paymentsData.totals.paid || 0,
                    paymentsData.currency,
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Outstanding:{" "}
                  {formatCurrency(
                    paymentsData.totals.outstanding || 0,
                    paymentsData.currency,
                  )}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {milestonesSummary && milestonesSummary.total > 0 ? (
            <Card className="bg-card/90">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Flag className="h-4 w-4" />
                  Milestones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {milestonesSummary.progress}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {milestonesSummary.completed}/{milestonesSummary.total} stages
                  completed
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
                <div className="flex flex-col gap-1">
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
        </div>

        {/* Project Description */}
        {project.description && (
          <Card className="bg-card/92">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-medium lg:text-xl">
                Project Description
              </CardTitle>
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
              <CardTitle className="text-lg font-medium lg:text-xl">
                Upcoming Installments
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-6">
              {unpaidInstallments.map((installment) => (
                <div
                  key={installment._id}
                  className="flex items-center justify-between rounded-xl border p-4"
                >
                  <div>
                    <p className="font-medium">{installment.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {installment.dueDate
                        ? `Due ${new Date(installment.dueDate).toLocaleDateString()}`
                        : "No due date"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {formatCurrency(installment.amount, installment.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {installment.isOverdue
                        ? "Overdue"
                        : installment.status.replace("_", " ")}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {milestonesSummary?.nextMilestone ? (
          <Card className="bg-card/92">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-medium lg:text-xl">
                Next Milestone
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">
                    {milestonesSummary.nextMilestone.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Due{" "}
                    {milestonesSummary.nextMilestone.plannedEndDate
                      ? new Date(
                          milestonesSummary.nextMilestone.plannedEndDate,
                        ).toLocaleDateString()
                      : "not set"}
                  </p>
                </div>
                <Badge variant="outline">
                  {milestonesSummary.nextMilestone.taskCount} linked tasks
                </Badge>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {budgetSummary ? (
          <Card className="bg-card/92">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-lg font-medium lg:text-xl">
                Budget vs Actual
              </CardTitle>
              <CardDescription>
                {shouldShowBudgetEmptyState
                  ? "This block becomes useful once the project has a budget, tracked costs, or revenue activity."
                  : budgetHealth?.description}
              </CardDescription>
              {budgetHealth ? (
                <CardAction>
                  <Badge variant={budgetHealth.badgeVariant}>
                    {budgetHealth.label}
                  </Badge>
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent className="px-6 pt-6">
              {shouldShowBudgetEmptyState ? (
                <Empty className="border-border/60 bg-muted/20">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <TrendingUp />
                    </EmptyMedia>
                    <EmptyTitle>No financial baseline yet</EmptyTitle>
                    <EmptyDescription>
                      Set a project budget and start logging materials, labor,
                      estimates, or payments. Then this area will show burn,
                      forecast variance, and revenue coverage instead of a wall
                      of zeros.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent className="max-w-xl">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Badge variant="outline">Set budget</Badge>
                      <Badge variant="outline">Track shopping and labor</Badge>
                      <Badge variant="outline">Add estimates or payments</Badge>
                    </div>
                  </EmptyContent>
                </Empty>
              ) : (
                <div className="flex flex-col gap-6">
                  <div className="grid gap-4 xl:grid-cols-4">
                    <div
                      className={cn(
                        "rounded-2xl border p-4",
                        hasBudgetBaseline && (remainingBudget ?? 0) < 0
                          ? "border-destructive/20 bg-destructive/5"
                          : "border-border/60 bg-muted/20",
                      )}
                    >
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {hasBudgetBaseline ? "Budget runway" : "Actual burn"}
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {hasBudgetBaseline
                          ? formatCurrency(
                              Math.abs(remainingBudget ?? 0),
                              budgetSummary.currency,
                            )
                          : formatCurrency(
                              budgetSummary.actualCost,
                              budgetSummary.currency,
                            )}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {hasBudgetBaseline
                          ? (remainingBudget ?? 0) >= 0
                            ? "remaining before actual spend hits the budget"
                            : "already spent beyond the budget cap"
                          : "tracked actual cost so far"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Forecast
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {hasBudgetBaseline
                          ? formatCurrency(
                              Math.abs(budgetSummary.projectedVariance),
                              budgetSummary.currency,
                            )
                          : formatCurrency(
                              budgetSummary.plannedCost,
                              budgetSummary.currency,
                            )}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {hasBudgetBaseline
                          ? budgetSummary.projectedVariance >= 0
                            ? "projected buffer at completion"
                            : "projected overrun at completion"
                          : "current planned total without a budget ceiling"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Cash coverage
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {collectedCoveragePercent !== null
                          ? formatPercent(collectedCoveragePercent)
                          : formatCurrency(
                              budgetSummary.revenue.collectedPayments,
                              budgetSummary.currency,
                            )}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {budgetSummary.actualCost > 0
                          ? "collected payments against actual spend"
                          : "collected payments recorded so far"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Booked revenue
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {formatCurrency(
                          budgetSummary.revenue.acceptedEstimations,
                          budgetSummary.currency,
                        )}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {acceptedCoveragePercent !== null
                          ? `${formatPercent(acceptedCoveragePercent)} of planned cost covered`
                          : "accepted estimates will show coverage here"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">Spend ladder</p>
                        <p className="text-sm text-muted-foreground">
                          Compare realized spend, committed work, and full
                          planned scope against the current ceiling.
                        </p>
                      </div>
                      <Badge variant="outline">
                        {hasBudgetBaseline
                          ? `Budget ${formatCurrency(
                              budgetSummary.budget,
                              budgetSummary.currency,
                            )}`
                          : "No budget ceiling yet"}
                      </Badge>
                    </div>

                    <div className="mt-4 flex flex-col gap-4">
                      {spendRows.map((row) => (
                        <div key={row.label} className="flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex flex-col gap-1">
                              <p className="text-sm font-medium">{row.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {row.caption}
                              </p>
                            </div>
                            <p className="text-sm font-semibold">
                              {formatCurrency(
                                row.amount,
                                budgetSummary.currency,
                              )}
                            </p>
                          </div>
                          <Progress
                            value={row.amount}
                            max={budgetReference}
                            indicatorClassName={row.indicatorClassName}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                      <p className="text-sm font-medium">
                        Where the money is going
                      </p>
                      <div className="mt-4 flex flex-col gap-3">
                        {spendMixRows.map((row) => (
                          <div
                            key={row.label}
                            className="flex items-start justify-between gap-4"
                          >
                            <div className="flex flex-col gap-1">
                              <span className="text-sm text-muted-foreground">
                                {row.label}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {row.note}
                              </span>
                            </div>
                            <span className="text-sm font-semibold">
                              {formatCurrency(
                                row.amount,
                                budgetSummary.currency,
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                      <p className="text-sm font-medium">Revenue coverage</p>
                      <div className="mt-4 flex flex-col gap-3">
                        {revenueRows.map((row) => (
                          <div
                            key={row.label}
                            className="flex items-start justify-between gap-4"
                          >
                            <div className="flex flex-col gap-1">
                              <span className="text-sm text-muted-foreground">
                                {row.label}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {row.note}
                              </span>
                            </div>
                            <span className="text-sm font-semibold">
                              {formatCurrency(
                                row.amount,
                                budgetSummary.currency,
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {financialAlerts.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {financialAlerts.map((alert) => (
                        <Alert
                          key={alert.title}
                          variant={alert.variant}
                          className={alert.className}
                        >
                          <AlertTriangle />
                          <AlertTitle>{alert.title}</AlertTitle>
                          <AlertDescription>
                            {alert.description}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
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
