"use client";

import { useState, type ReactNode } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import {
  Download,
  Calendar,
  DollarSign,
  BarChart3,
  TrendingUp,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SHOPPING_STATUSES = [
  "PLANNED",
  "ORDERED",
  "IN_TRANSIT",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
] as const;

export default function CompanyReports() {
  const { organization, isLoaded } = useOrganization();
  const [timeRange, setTimeRange] = useState<string>("30d");

  const team = useQuery(
    apiAny.teams.getTeamByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip",
  );

  const projects = useQuery(
    apiAny.projects.listProjectsByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip",
  );

  const teamTasks = useQuery(
    apiAny.tasks.listTeamTasks,
    team && team._id ? { teamId: team._id } : "skip",
  );

  const shoppingItems = useQuery(
    apiAny.shopping.getShoppingListItemsByTeam,
    team && team._id ? { teamId: team._id } : "skip",
  );

  const analyticsMetrics = useQuery(
    apiAny.activityLog.getTeamProductKpis,
    team && team._id ? { teamId: team._id, days: 30 } : "skip",
  );

  if (!isLoaded || !organization) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const projectList = projects || [];
  const tasksList = teamTasks || [];
  const shoppingList = shoppingItems || [];
  const activeCurrency = team?.currency || projectList[0]?.currency || "USD";

  const formatMoney = (amount: number, currency?: string) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || activeCurrency,
      maximumFractionDigits: 0,
    }).format(amount);

  const projectById = new Map<string, { name?: string }>(
    projectList.map((project) => [String(project._id), project]),
  );

  const tasksByProject = tasksList.reduce((map, task) => {
    const key = String(task.projectId);
    const current = map.get(key) || [];
    current.push(task);
    map.set(key, current);
    return map;
  }, new Map<string, typeof tasksList>());

  const totalProjects = projectList.length;
  const activeProjects = projectList.filter((project) => project.status === "active").length;
  const totalBudget = projectList.reduce((sum, project) => sum + (project.budget || 0), 0);

  const totalTasks = tasksList.length;
  const completedTasks = tasksList.filter((task) => task.status === "done").length;
  const inProgressTasks = tasksList.filter((task) => task.status === "in_progress").length;
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const totalTaskCost = tasksList.reduce((sum, task) => sum + (task.cost || 0), 0);
  const totalShoppingCost = shoppingList.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  const orderedShoppingCost = shoppingList
    .filter((item) =>
      ["ORDERED", "IN_TRANSIT", "DELIVERED", "COMPLETED"].includes(item.realizationStatus),
    )
    .reduce((sum, item) => sum + (item.totalPrice || 0), 0);

  const now = Date.now();
  const overdueTaskList = tasksList
    .filter((task) => {
      const taskEndDate = task.endDate || task.startDate;
      return taskEndDate && taskEndDate < now && task.status !== "done";
    })
    .sort((a, b) => (a.endDate || a.startDate || 0) - (b.endDate || b.startDate || 0))
    .slice(0, 10);
  const overdueTasks = overdueTaskList.length;

  const projectsByStatus = projectList.reduce((acc, project) => {
    const status = project.status || "unknown";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const tasksByStatus = tasksList.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const shoppingByStatus = SHOPPING_STATUSES.map((status) => {
    const items = shoppingList.filter((item) => item.realizationStatus === status);
    return {
      status,
      count: items.length,
      total: items.reduce((sum, item) => sum + (item.totalPrice || 0), 0),
    };
  }).filter((entry) => entry.count > 0);

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reports & Analytics</h1>

        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 3 months</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalProjects}</div>
                  <p className="text-xs text-muted-foreground">{activeProjects} active</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatMoney(totalBudget)}</div>
                  <p className="text-xs text-muted-foreground">Across all projects</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tasks Progress</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{completionRate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">
                    {completedTasks} done, {inProgressTasks} in progress
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overdueTasks}</div>
                  <p className="text-xs text-muted-foreground">
                    {overdueTasks > 0 ? (
                      <span className="text-red-600">Require attention</span>
                    ) : (
                      <span className="text-green-600">All on track</span>
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Onboarding (30d)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analyticsMetrics?.onboardingCompleted ?? 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Projects Created (30d)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analyticsMetrics?.projectsCreated ?? 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">AI Messages (30d)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analyticsMetrics?.aiMessagesSent ?? 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Active Users (30d)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analyticsMetrics?.activeUsers ?? 0}</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="projects" className="mt-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Status Distribution</CardTitle>
                <CardDescription>Breakdown of projects by current status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(projectsByStatus as Record<string, number>).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={status === "completed" ? "default" : status === "active" ? "secondary" : "outline"}>
                          {status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${totalProjects > 0 ? (Number(count) / totalProjects) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8">{Number(count)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All Projects</CardTitle>
                <CardDescription>Progress, budget, and schedule overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {projectList.length > 0 ? (
                    projectList
                      .slice()
                      .sort((a, b) => b._creationTime - a._creationTime)
                      .map((project) => {
                        const projectTasks = tasksByProject.get(String(project._id)) || [];
                        const done = projectTasks.filter((task) => task.status === "done").length;
                        const progress = projectTasks.length > 0 ? (done / projectTasks.length) * 100 : 0;

                        return (
                          <div key={project._id} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-semibold">{project.name}</h4>
                                {project.customer ? (
                                  <p className="text-sm text-muted-foreground">{project.customer}</p>
                                ) : null}
                              </div>
                              <Badge variant="outline">{project.status}</Badge>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Progress</span>
                                <span className="font-medium">{Math.round(progress)}%</span>
                              </div>
                              <div className="w-full bg-secondary rounded-full h-2">
                                <div className="bg-primary h-2 rounded-full" style={{ width: `${progress}%` }} />
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>{projectTasks.length} tasks</span>
                                {typeof project.budget === "number" ? (
                                  <span>Budget: {formatMoney(project.budget, project.currency || activeCurrency)}</span>
                                ) : null}
                                {project.startDate ? (
                                  <span>Start: {new Date(project.startDate).toLocaleDateString()}</span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">No projects yet</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Task Status Breakdown</CardTitle>
                <CardDescription>Current status of all tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(tasksByStatus as Record<string, number>).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <Badge variant={status === "done" ? "default" : "outline"}>{status.replace("_", " ").toUpperCase()}</Badge>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${totalTasks > 0 ? (Number(count) / totalTasks) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8">{Number(count)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {overdueTasks > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    Overdue Tasks
                  </CardTitle>
                  <CardDescription>Tasks that need immediate attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {overdueTaskList.map((task) => (
                      <div key={task._id} className="flex items-center justify-between border-l-2 border-red-500 pl-3 py-2">
                        <div className="flex-1">
                          <p className="font-medium">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {projectById.get(String(task.projectId))?.name} • Due{" "}
                            {new Date((task.endDate || task.startDate)!).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant={task.priority === "urgent" ? "destructive" : "secondary"}>
                          {task.priority || "medium"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="financial" className="mt-6">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <FinancialCard title="Total Budget" value={formatMoney(totalBudget)} subtitle={`Across ${totalProjects} projects`} icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} />
              <FinancialCard title="Shopping List" value={formatMoney(totalShoppingCost)} subtitle={`${shoppingList.length} items planned`} icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />} />
              <FinancialCard title="Ordered Items" value={formatMoney(orderedShoppingCost)} subtitle="Already ordered/delivered" icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />} />
              <FinancialCard title="Task Costs" value={formatMoney(totalTaskCost)} subtitle="Total task costs tracked" icon={<Clock className="h-4 w-4 text-muted-foreground" />} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Shopping List by Status</CardTitle>
                <CardDescription>Items and cost by realization status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {shoppingByStatus.length > 0 ? (
                    shoppingByStatus.map((entry) => (
                      <div key={entry.status} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={entry.status === "COMPLETED" ? "default" : "secondary"}>
                            {entry.status}
                          </Badge>
                          <span className="text-sm">{entry.count} items</span>
                        </div>
                        <p className="font-bold">{formatMoney(entry.total)}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">No shopping list items yet</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Budget Overview</CardTitle>
                <CardDescription>Top projects by budget</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {projectList
                    .filter((project) => (project.budget || 0) > 0)
                    .sort((a, b) => (b.budget || 0) - (a.budget || 0))
                    .slice(0, 5)
                    .map((project) => (
                      <div key={project._id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{project.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {project.currency || activeCurrency} • {project.status}
                          </p>
                        </div>
                        <p className="font-bold">{formatMoney(project.budget || 0, project.currency || activeCurrency)}</p>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FinancialCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
