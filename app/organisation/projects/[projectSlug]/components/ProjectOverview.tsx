"use client";

import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Calendar, TrendingUp, MapPin, DollarSign, Building2, User, Target, History, ChevronDown } from "lucide-react";
import { Suspense, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ProjectChangelog } from "./ProjectChangelog";

function ProjectOverviewSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="mb-4 lg:mb-6">
        <Skeleton className="h-9 w-1/3 mb-2" />
        <Skeleton className="h-5 w-1/2" />
      </div>

      <div className="grid gap-4 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-6 lg:mb-8">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-4 w-1/3 mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <Skeleton className="h-7 w-48" />
        </CardHeader>
        <CardContent className="px-4 lg:px-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProjectOverviewContent() {
  const { project } = useProject();
  const [isChangelogOpen, setChangelogOpen] = useState(false);
  
  const hasAccess = useQuery(apiAny.projects.checkUserProjectAccess, {
    projectId: project._id,
  });
  
  const tasks = useQuery(apiAny.tasks.listProjectTasks, 
    hasAccess ? { projectId: project._id } : "skip"
  );

  const shoppingListItems = useQuery(apiAny.shopping.getShoppingListItemsByProject,
    hasAccess ? { projectId: project._id } : "skip"
  );

  if (hasAccess === false || !tasks || !shoppingListItems) {
    if (hasAccess === false) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to view this project.</p>
        </div>
      );
    }
    if (!project) {
       return <div>Project not found.</div>;
    }
    // This part should be handled by Suspense
    return null;
  }
  
  
  const tasksCost = tasks.reduce((sum: number, task) => sum + (task.cost || 0), 0);
  const shoppingListCost = shoppingListItems.reduce((sum: number, item) => sum + (item.totalPrice || 0), 0);
  const totalCost = tasksCost + shoppingListCost;
  const currencySymbol = project.currency === "EUR" ? "€" : project.currency === "PLN" ? "zł" : "$";

  const statusColors = {
    planning: "border-sky-200 bg-sky-50 text-sky-700",
    active: "border-emerald-200 bg-emerald-50 text-emerald-700",
    on_hold: "border-amber-200 bg-amber-50 text-amber-700",
    completed: "border-indigo-200 bg-indigo-50 text-indigo-700",
    done: "border-indigo-200 bg-indigo-50 text-indigo-700",
    cancelled: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <div className="space-y-7">
      <div className="clean-panel px-6 py-5 lg:px-7 lg:py-6">
        <h1 className="clean-title text-3xl font-medium tracking-tight lg:text-4xl">Project Overview</h1>
        <p className="clean-subtitle mt-2 text-sm lg:text-base">
          A summary of {project.name} 
        </p>
      </div>

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
              Tasks & Shopping List
            </p>
          </CardContent>
        </Card>

        {/* Tasks Cost */}
        <Card className="bg-card/90">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Tasks Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tasksCost.toFixed(2)} {currencySymbol}
            </div>
            <p className="text-xs text-muted-foreground">
              Cost from all tasks
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
              Cost from all items
            </p>
          </CardContent>
        </Card>

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
                <div className="flex justify-between text-sm">
                  <span>Budget:</span>
                  <span className="font-semibold">{project.budget.toLocaleString()} {currencySymbol}</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-secondary/75">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      (totalCost / project.budget) > 1 ? 'bg-red-500' : 
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

      <Collapsible open={isChangelogOpen} onOpenChange={setChangelogOpen}>
        <Card className="mt-6 bg-card/92 lg:mt-8">
          <CardHeader className="pb-2">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-xl px-1 text-left"
              >
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  <CardTitle className="clean-title text-lg font-medium lg:text-xl">Project Changelog</CardTitle>
                </div>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isChangelogOpen ? "rotate-180" : ""}`}
                />
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <ProjectChangelog
                enabled={isChangelogOpen}
                showHeader={false}
                className="px-0 lg:px-0"
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

export default function ProjectOverview() {
  return (
    <Suspense fallback={<ProjectOverviewSkeleton />}>
      <ProjectOverviewContent />
    </Suspense>
  );
} 
