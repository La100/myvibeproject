"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useQueries, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";
import {
  Building2,
  CalendarRange,
  ClipboardList,
  Clock3,
  CreditCard,
  Download,
  ExternalLink,
  Files,
  Globe,
  MapPin,
  MoreHorizontal,
  Settings2,
  Users,
} from "lucide-react";
import {
  exportProjectBookPdf,
  type ProjectBookChapter,
} from "@/lib/projectBookPdfExport";
import { sanitizeFileName } from "@/lib/pdfExport";
import {
  buildShoppingSetContext,
  calculateShoppingTotal,
  isItemCountedInShoppingTotal,
} from "@/lib/shoppingSets";
import { formatShoppingExportProductLabel } from "@/lib/shoppingListExport";
import {
  ProjectBookExportDialog,
  type ProjectBookExportOptions,
} from "./ProjectBookExportDialog";
import { cn, formatCurrency, getTaskPreview } from "@/lib/utils";

function ProjectOverviewSkeleton() {
  return (
    <div className="flex min-h-[480px] items-center justify-center rounded-[28px] border border-border/60 bg-background/95 shadow-[0_22px_70px_-48px_rgba(27,27,27,0.45)]">
      <Spinner />
    </div>
  );
}

const DEFAULT_PROJECT_BOOK_OPTIONS: ProjectBookExportOptions = {
  sections: {
    shoppingList: true,
    labor: true,
    tasks: true,
    budget: true,
    payments: true,
    moodboard: true,
  },
  showNotes: true,
  showPrice: true,
  showSupplier: true,
};

const SHOPPING_STATUS_LABELS = {
  PLANNED: "Planned",
  ORDERED: "Ordered",
  IN_TRANSIT: "In Transit",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const;

const PROJECT_STATUS_LABELS = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  done: "Completed",
  cancelled: "Cancelled",
} as const;

const getShoppingStatusLabel = (
  status?: keyof typeof SHOPPING_STATUS_LABELS | string,
) =>
  status && status in SHOPPING_STATUS_LABELS
    ? SHOPPING_STATUS_LABELS[status as keyof typeof SHOPPING_STATUS_LABELS]
    : status || "-";

const formatProjectDate = (
  value?: number,
  options?: Intl.DateTimeFormatOptions,
) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        ...options,
      }).format(new Date(value))
    : null;

const formatDateRange = (startDate?: number, endDate?: number) => {
  const startLabel = formatProjectDate(startDate);
  const endLabel = formatProjectDate(endDate);
  const startCompactLabel = formatProjectDate(startDate, {
    day: "2-digit",
    month: "short",
    year: undefined,
  });
  const endCompactLabel = formatProjectDate(endDate, {
    day: "2-digit",
    month: "short",
    year: undefined,
  });
  const startYear = startDate ? new Date(startDate).getFullYear() : null;
  const endYear = endDate ? new Date(endDate).getFullYear() : null;

  if (startCompactLabel && endCompactLabel && startYear && endYear) {
    if (startYear === endYear) {
      return `${startCompactLabel} - ${endCompactLabel} ${endYear}`;
    }

    return `${startCompactLabel} ${startYear} - ${endCompactLabel} ${endYear}`;
  }

  if (startLabel && endLabel) {
    return `${startLabel} - ${endLabel}`;
  }

  return startLabel || endLabel || "Timeline not set";
};

const formatRelativeProjectEdit = (value?: number) => {
  if (!value) {
    return null;
  }

  const diffMs = Date.now() - value;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return "Edited today";
  }

  if (diffDays === 1) {
    return "Edited yesterday";
  }

  if (diffDays < 30) {
    return `Edited ${diffDays} days ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) {
    return "Edited 1 month ago";
  }

  if (diffMonths < 12) {
    return `Edited ${diffMonths} months ago`;
  }

  const diffYears = Math.floor(diffMonths / 12);
  return `Edited ${diffYears} year${diffYears === 1 ? "" : "s"} ago`;
};

const getInitials = (value?: string | null) =>
  (value || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

function ProjectOverviewContent() {
  const { project } = useProject();
  const router = useRouter();
  const [isProjectBookExportOpen, setIsProjectBookExportOpen] = useState(false);
  const [isExportingProjectBook, setIsExportingProjectBook] = useState(false);
  const [projectBookExportOptions, setProjectBookExportOptions] =
    useState<ProjectBookExportOptions>(DEFAULT_PROJECT_BOOK_OPTIONS);

  const tasks = useQuery(apiAny.tasks.listProjectTasks, {
    projectId: project._id,
  });
  const shoppingListItems = useQuery(
    apiAny.shopping.getShoppingListItemsByProject,
    {
      projectId: project._id,
    },
  );
  const shoppingSets = useQuery(apiAny.shopping.listShoppingSets, {
    projectId: project._id,
  });
  const shoppingSections = useQuery(apiAny.shopping.listShoppingListSections, {
    projectId: project._id,
  });
  const laborItems = useQuery(apiAny.labor.listLaborItems, {
    projectId: project._id,
  });
  const laborSections = useQuery(apiAny.labor.listLaborSections, {
    projectId: project._id,
  });
  const paymentsData = useQuery(
    apiAny.projectPayments.getProjectPaymentsOverview,
    {
      projectId: project._id,
    },
  );
  const budgetSummary = useQuery(apiAny.projectBudget.getProjectBudgetSummary, {
    projectId: project._id,
  });
  const notes = useQuery(apiAny.notes.getProjectNotes, {
    projectId: project._id,
  });
  const team = useQuery(apiAny.teams.getTeamById, {
    teamId: project.teamId,
  });
  const teamMembers = useQuery(apiAny.teams.getTeamMembers, {
    teamId: project.teamId,
  });
  const projectActivities = useQuery(apiAny.activityLog.getForProject, {
    projectId: project._id,
  });
  const moodboardSections = useQuery(apiAny.files.getMoodboardSections, {
    projectId: project._id,
  });

  const moodboardImageQueries = useMemo(
    () =>
      Object.fromEntries(
        (moodboardSections ?? []).map((section) => [
          section.id,
          {
            query: apiAny.files.getMoodboardImagesBySection,
            args: {
              projectId: project._id,
              section: section.id,
            },
          },
        ]),
      ),
    [moodboardSections, project._id],
  );
  const moodboardImageResults = useQueries(moodboardImageQueries);

  if (
    tasks === undefined ||
    shoppingListItems === undefined ||
    shoppingSets === undefined ||
    shoppingSections === undefined ||
    laborItems === undefined ||
    laborSections === undefined ||
    paymentsData === undefined ||
    budgetSummary === undefined ||
    notes === undefined ||
    team === undefined ||
    teamMembers === undefined ||
    projectActivities === undefined ||
    moodboardSections === undefined
  ) {
    return <ProjectOverviewSkeleton />;
  }

  const isMoodboardLoading = moodboardSections.some(
    (section) => moodboardImageResults[section.id] === undefined,
  );
  if (isMoodboardLoading) {
    return <ProjectOverviewSkeleton />;
  }

  for (const result of Object.values(moodboardImageResults)) {
    if (result instanceof Error) {
      throw result;
    }
  }

  const projectBasePath = `/organisation/projects/${project.slug}`;
  const shoppingListCost = calculateShoppingTotal(
    shoppingListItems,
    shoppingSets,
  );
  const laborCost = laborItems.reduce(
    (sum: number, item) => sum + (item.totalPrice || 0),
    0,
  );
  const shoppingSectionMap = new Map<string, string>(
    shoppingSections.map((section) => [String(section._id), section.name]),
  );
  const shoppingSetTitleById = new Map<string, string>(
    shoppingSets.map((set) => [String(set._id), set.title]),
  );
  const shoppingExportContext = buildShoppingSetContext(
    shoppingListItems,
    shoppingSets,
  );
  const shoppingBookRows = shoppingListItems
    .filter((item) => isItemCountedInShoppingTotal(item, shoppingExportContext))
    .map((item) => ({
      section: item.sectionId
        ? shoppingSectionMap.get(String(item.sectionId)) || "No Section"
        : "No Section",
      product: formatShoppingExportProductLabel(
        item.name,
        item.setId ? shoppingSetTitleById.get(String(item.setId)) : undefined,
      ),
      qty: String(item.quantity),
      unitPrice: formatCurrency(item.unitPrice || 0, project.currency),
      total: formatCurrency(item.totalPrice || 0, project.currency),
      status: getShoppingStatusLabel(item.realizationStatus),
      supplier: item.supplier || "-",
      notes: item.notes || "-",
    }));
  const laborSectionMap = new Map<string, string>(
    laborSections.map((section) => [String(section._id), section.name]),
  );
  const laborBookRows = laborItems.map((item) => ({
    section: item.sectionId
      ? laborSectionMap.get(String(item.sectionId)) || "No Category"
      : "No Category",
    work: item.name,
    qty: String(item.quantity),
    unit: item.unit || "-",
    unitPrice: formatCurrency(item.unitPrice || 0, project.currency),
    total: formatCurrency(item.totalPrice || 0, project.currency),
    notes: item.notes || "-",
  }));
  const getAssignedMemberName = (assignedTo?: string | null) => {
    if (!assignedTo) return "-";
    return (
      teamMembers.find((member) => member.clerkUserId === assignedTo)?.name ||
      assignedTo
    );
  };
  const taskBookRows = tasks.map((task) => ({
    title: task.title,
    status: task.status.replace(/_/g, " "),
    priority: task.priority || "-",
    assignee: getAssignedMemberName(task.assignedTo),
    timeline:
      task.endDate || task.startDate
        ? `${task.startDate ? new Date(task.startDate).toLocaleDateString() : "-"} -> ${task.endDate ? new Date(task.endDate).toLocaleDateString() : "-"}`
        : "-",
    summary: getTaskPreview(task, 12) || "-",
  }));
  const paymentBookRows = (paymentsData.installments || [])
    .filter((installment) => installment.status !== "void")
    .map((installment) => ({
      title: installment.title,
      status: installment.status.replace(/_/g, " "),
      dueDate: installment.dueDate
        ? new Date(installment.dueDate).toLocaleDateString()
        : "-",
      amount: formatCurrency(installment.amount, installment.currency),
      reference:
        installment.paymentReference || installment.invoiceNumber || "-",
    }));
  const budgetBookRows = [
    {
      metric: "Budget",
      value: formatCurrency(budgetSummary.budget, budgetSummary.currency),
      note: "Project budget baseline",
    },
    {
      metric: "Planned cost",
      value: formatCurrency(budgetSummary.plannedCost, budgetSummary.currency),
      note: "Current planned scope",
    },
    {
      metric: "Committed cost",
      value: formatCurrency(
        budgetSummary.committedCost,
        budgetSummary.currency,
      ),
      note: "Booked cost not yet fully realized",
    },
    {
      metric: "Actual cost",
      value: formatCurrency(budgetSummary.actualCost, budgetSummary.currency),
      note: "Realized project spend",
    },
    {
      metric: "Projected variance",
      value: formatCurrency(
        Math.abs(budgetSummary.projectedVariance),
        budgetSummary.currency,
      ),
      note:
        budgetSummary.projectedVariance >= 0
          ? "Projected buffer"
          : "Projected overrun",
    },
    {
      metric: "Collected payments",
      value: formatCurrency(
        budgetSummary.clientFunding.collectedPayments,
        budgetSummary.currency,
      ),
      note: "Payments collected so far",
    },
  ];

  const moodboardExportSections = moodboardSections
    .map((section) => ({
      title: section.title,
      items: (
        (moodboardImageResults[section.id] as
          | Array<{
              name: string;
              url: string;
            }>
          | undefined) ?? []
      ).map((file) => ({
        title: file.name,
        imageUrl: file.url || undefined,
      })),
    }))
    .filter((section) => section.items.length > 0);

  const openProjectBookExport = () => {
    setProjectBookExportOptions({
      sections: { ...DEFAULT_PROJECT_BOOK_OPTIONS.sections },
      showNotes: DEFAULT_PROJECT_BOOK_OPTIONS.showNotes,
      showPrice: DEFAULT_PROJECT_BOOK_OPTIONS.showPrice,
      showSupplier: DEFAULT_PROJECT_BOOK_OPTIONS.showSupplier,
    });
    setIsProjectBookExportOpen(true);
  };

  const handleExportProjectBook = async () => {
    const selectedSections = Object.entries(projectBookExportOptions.sections)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key as keyof ProjectBookExportOptions["sections"]);

    if (selectedSections.length === 0) {
      return;
    }

    setIsExportingProjectBook(true);
    try {
      const chapters: ProjectBookChapter[] = [];

      if (projectBookExportOptions.sections.shoppingList) {
        chapters.push({
          title: "Shopping List",
          description:
            "Materials and products currently counted in the project shopping scope.",
          columns: [
            { key: "section", label: "Section" },
            { key: "product", label: "Product" },
            { key: "qty", label: "Qty" },
            ...(projectBookExportOptions.showPrice
              ? [{ key: "total", label: "Total" }]
              : []),
            { key: "status", label: "Status" },
            ...(projectBookExportOptions.showSupplier
              ? [{ key: "supplier", label: "Supplier" }]
              : []),
            ...(projectBookExportOptions.showNotes
              ? [{ key: "notes", label: "Notes" }]
              : []),
          ],
          rows: shoppingBookRows.map((row) => ({
            section: row.section,
            product: row.product,
            qty: row.qty,
            ...(projectBookExportOptions.showPrice ? { total: row.total } : {}),
            status: row.status,
            ...(projectBookExportOptions.showSupplier
              ? { supplier: row.supplier }
              : {}),
            ...(projectBookExportOptions.showNotes ? { notes: row.notes } : {}),
          })),
          emptyMessage: "No shopping list items available.",
        });
      }

      if (projectBookExportOptions.sections.labor) {
        chapters.push({
          title: "Labor",
          description:
            "Labor scope and service entries tracked for the project.",
          columns: [
            { key: "section", label: "Section" },
            { key: "work", label: "Work" },
            { key: "qty", label: "Qty" },
            { key: "unit", label: "Unit" },
            ...(projectBookExportOptions.showPrice
              ? [{ key: "total", label: "Total" }]
              : []),
            ...(projectBookExportOptions.showNotes
              ? [{ key: "notes", label: "Notes" }]
              : []),
          ],
          rows: laborBookRows.map((row) => ({
            section: row.section,
            work: row.work,
            qty: row.qty,
            unit: row.unit,
            ...(projectBookExportOptions.showPrice ? { total: row.total } : {}),
            ...(projectBookExportOptions.showNotes ? { notes: row.notes } : {}),
          })),
          emptyMessage: "No labor entries available.",
        });
      }

      if (projectBookExportOptions.sections.tasks) {
        chapters.push({
          title: "Tasks",
          description: "Execution status of tracked project tasks.",
          columns: [
            { key: "title", label: "Task" },
            { key: "status", label: "Status" },
            { key: "priority", label: "Priority" },
            { key: "assignee", label: "Assigned" },
            { key: "timeline", label: "Timeline" },
            { key: "summary", label: "Summary" },
          ],
          rows: taskBookRows,
          emptyMessage: "No tasks available.",
        });
      }

      if (projectBookExportOptions.sections.budget) {
        chapters.push({
          title: "Budget",
          description:
            "Current budget position including planned, committed, and actual spend.",
          columns: [
            { key: "metric", label: "Metric" },
            { key: "value", label: "Value" },
            { key: "note", label: "Note" },
          ],
          rows: budgetBookRows,
        });
      }

      if (projectBookExportOptions.sections.payments) {
        chapters.push({
          title: "Payments",
          description: "Scheduled and collected project payments.",
          columns: [
            { key: "title", label: "Installment" },
            { key: "status", label: "Status" },
            { key: "dueDate", label: "Due date" },
            { key: "amount", label: "Amount" },
            { key: "reference", label: "Reference" },
          ],
          rows: paymentBookRows,
          emptyMessage: "No payments available.",
        });
      }

      if (projectBookExportOptions.sections.moodboard) {
        chapters.push({
          type: "gallery",
          title: "Moodboard",
          description: "Visual references collected in the project moodboard.",
          sections: moodboardExportSections,
          emptyMessage: "No moodboard images available.",
        });
      }

      await exportProjectBookPdf({
        brand: {
          teamName: team.name || "Organization",
          teamImageUrl:
            team.customOrganizationImageSetAt && team.imageUrl?.trim()
              ? team.imageUrl
              : undefined,
        },
        chapters,
        fileName: `project-book-${sanitizeFileName(project.name)}-${new Date().toISOString().slice(0, 10)}.pdf`,
        generatedOn: new Date().toLocaleString(),
        subtitle: `${selectedSections.length} sections selected`,
        title: `Project Book - ${project.name}`,
      });

      setIsProjectBookExportOpen(false);
    } catch (error) {
      console.error("Project book export failed:", error);
    } finally {
      setIsExportingProjectBook(false);
    }
  };

  const projectCoverUrl =
    (project as { coverImageDisplayUrl?: string }).coverImageDisplayUrl?.trim() ||
    project.coverImageUrl?.trim() ||
    null;
  const hasProjectCover = projectCoverUrl !== null;
  const projectRecentActivityAt = projectActivities.reduce(
    (latest, activity) => Math.max(latest, activity._creationTime),
    0,
  );
  const projectLastUpdatedAt =
    projectRecentActivityAt ||
    (project as { updatedAt?: number }).updatedAt ||
    project._creationTime;
  const projectEditedLabel = formatRelativeProjectEdit(projectLastUpdatedAt);
  const projectEditedDateLabel = formatProjectDate(projectLastUpdatedAt, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const projectEditedAgoLabel = projectEditedLabel?.replace(/^Edited\s+/, "");
  const projectStatusLabel =
    PROJECT_STATUS_LABELS[
      project.status as keyof typeof PROJECT_STATUS_LABELS
    ] || project.status.replace(/_/g, " ");
  const activeTasksCount = tasks.filter(
    (task) => task.status !== "done",
  ).length;
  const overdueTasksCount = tasks.filter(
    (task) =>
      task.status !== "done" &&
      typeof task.endDate === "number" &&
      task.endDate < Date.now(),
  ).length;
  const paidAmount = paymentsData?.totals.paid || 0;
  const outstandingAmount = paymentsData?.totals.outstanding || 0;
  const totalCost = shoppingListCost + laborCost;
  const totalCostBreakdown = [
    ...(shoppingListCost > 0
      ? [
          {
            label: "Shopping",
            value: formatCurrency(shoppingListCost, project.currency, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }),
          },
        ]
      : []),
    ...(laborCost > 0
      ? [
          {
            label: "Labor",
            value: formatCurrency(laborCost, project.currency, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }),
          },
        ]
      : []),
  ];

  const overviewMetrics = [
    {
      value: String(activeTasksCount),
      label: "Active tasks",
      meta:
        overdueTasksCount > 0
          ? `${overdueTasksCount} overdue`
          : `${Math.max(tasks.length - activeTasksCount, 0)} completed`,
      spanClass: "xl:col-span-2",
    },
    {
      value: formatCurrency(totalCost, project.currency, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
      label: "Total cost",
      meta:
        totalCostBreakdown.length > 0
          ? "Shopping and labor scope"
          : "No scoped costs yet",
      breakdown: totalCostBreakdown,
      spanClass: "xl:col-span-2",
    },
    {
      value: formatCurrency(
        paidAmount + outstandingAmount,
        paymentsData?.currency || project.currency,
        {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        },
      ),
      label: "Total invoices",
      meta: `${formatCurrency(
        paidAmount,
        paymentsData?.currency || project.currency,
      )} paid, ${formatCurrency(
        outstandingAmount,
        paymentsData?.currency || project.currency,
      )} unpaid`,
      spanClass: "xl:col-span-2",
    },
  ];

  const visibleTeamMembers = teamMembers.slice(0, 4);
  const hiddenTeamMembersCount = Math.max(teamMembers.length - 4, 0);

  const recentCards = [
    ...moodboardSections.flatMap((section) => {
      const files = (
        (moodboardImageResults[section.id] as
          | Array<{ name: string; url: string; _creationTime: number }>
          | undefined) ?? []
      );

      return files.map((file, index) => ({
        id: `${section.id}-${file.url}-${index}`,
        title: file.name || section.title,
        subtitle: section.title,
        href: `${projectBasePath}/moodboard`,
        imageUrl: file.url,
        status: "Pinboard",
        timestamp: file._creationTime || 0,
      }));
    }),
    ...notes.map((note) => ({
      id: String(note._id),
      title: note.title || "Project note",
      subtitle: note.content?.slice(0, 48) || "Notes",
      href: `${projectBasePath}/notes`,
      imageUrl: "",
      status: "Notes",
      timestamp: note.updatedAt || note.createdAt || note._creationTime || 0,
    })),
  ]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 5);

  const projectLink =
    (project as { websiteUrl?: string; website?: string }).websiteUrl ||
    (project as { websiteUrl?: string; website?: string }).website ||
    null;

  const projectStatusBadgeClass = cn(
    "border-border/80 bg-background/86 text-foreground shadow-none backdrop-blur-md",
    project.status === "cancelled" &&
      "border-red-200/80 bg-red-50/90 text-red-900",
    project.status === "completed" &&
      "border-emerald-200/80 bg-emerald-50/90 text-emerald-900",
  );

  return (
    <ProjectPageLayout>
      <section className="w-full">
        <div className="overflow-hidden rounded-[34px] border border-border/70 bg-card shadow-[0_24px_80px_-52px_rgba(25,25,25,0.42)]">
          <div className="border-b border-border/70 bg-card px-5 py-5 sm:px-7 sm:py-7 lg:px-9">
            <div className="flex items-start justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/78 px-3 py-1.5 text-[11px] font-medium tracking-[0.08em] text-muted-foreground backdrop-blur-md">
                <Building2 className="h-3.5 w-3.5" />
                <span>Projects</span>
                <span className="text-muted-foreground/60">/</span>
                <ClipboardList className="h-3.5 w-3.5" />
                <span>Overview</span>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 rounded-2xl border border-border/70 bg-background/78 text-foreground/75 backdrop-blur-md transition-colors hover:bg-background hover:text-foreground"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                    <span className="sr-only">Project actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 rounded-xl border-border/80 bg-popover"
                >
                  <DropdownMenuItem
                    onSelect={() => router.push(`${projectBasePath}/settings`)}
                  >
                    <Settings2 className="mr-2 h-4 w-4" />
                    Project settings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => router.push(`${projectBasePath}/tasks`)}
                  >
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Open tasks board
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => router.push(`${projectBasePath}/payments`)}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Open payments
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => router.push(`${projectBasePath}/files`)}
                  >
                    <Files className="mr-2 h-4 w-4" />
                    Open files
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={openProjectBookExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Export project book
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div
              className={cn(
                "mt-6 grid gap-6 xl:gap-8 lg:items-end",
                hasProjectCover
                  ? "lg:grid-cols-[minmax(340px,1.08fr)_minmax(420px,1.12fr)]"
                  : "lg:grid-cols-1",
              )}
            >
              <div className="flex min-w-0 flex-col justify-end gap-5 lg:pb-5">
                <div className="space-y-4">
                  <h1 className="max-w-[10ch] font-serif text-[2.1rem] leading-[0.92] tracking-[-0.05em] text-foreground sm:text-[2.8rem] lg:text-[3.4rem] xl:text-[3.9rem]">
                    {project.name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Badge className={projectStatusBadgeClass}>
                      {projectStatusLabel}
                    </Badge>
                    {project.customer ? (
                      <Badge className="border-border/80 bg-background/86 text-foreground/88 shadow-none backdrop-blur-md">
                        {project.customer}
                      </Badge>
                    ) : null}
                    <Badge className="gap-2 border-border/80 bg-background/86 px-3 text-foreground/88 shadow-none backdrop-blur-md">
                      <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>
                        {formatDateRange(project.startDate, project.endDate)}
                      </span>
                    </Badge>
                  </div>
                </div>
              </div>

              {hasProjectCover ? (
                <div className="relative lg:justify-self-end lg:w-full lg:max-w-[480px] xl:max-w-[560px] 2xl:max-w-[610px]">
                  <div className="group relative min-h-[240px] overflow-hidden rounded-[30px] border border-border/60 bg-muted/20 shadow-[0_28px_80px_-46px_rgba(22,22,22,0.24)] sm:min-h-[290px] lg:min-h-[320px] xl:min-h-[345px]">
                    <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[10%] bg-[linear-gradient(90deg,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0)_100%)]" />
                    <Image
                      src={projectCoverUrl}
                      alt={`${project.name} cover`}
                      fill
                      priority
                      quality={90}
                      className="object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-[1.015]"
                      style={{ objectPosition: "82% center" }}
                      sizes="(min-width: 1536px) 610px, (min-width: 1280px) 560px, (min-width: 1024px) 480px, 100vw"
                    />
                  </div>
                </div>
              ) : (
                <div className="relative min-h-[240px] overflow-hidden rounded-[30px] border border-border/60 bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.78),transparent_22%),radial-gradient(circle_at_82%_20%,rgba(49,45,38,0.03),transparent_26%),linear-gradient(180deg,rgba(250,250,250,1)_0%,rgba(245,245,245,1)_100%)] sm:min-h-[290px] lg:min-h-[320px] lg:max-w-[480px] lg:justify-self-end xl:max-w-[560px] 2xl:max-w-[610px]" />
              )}
            </div>

            <div className="border-t border-border/70 bg-card px-5 py-5 sm:px-7 sm:py-6 lg:px-9">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-[13px] text-muted-foreground sm:text-[15px]">
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    <div className="flex -space-x-2.5">
                      {visibleTeamMembers.map((member) => (
                        <Avatar
                          key={member._id}
                          className="h-10 w-10 border-[3px] border-card shadow-sm"
                        >
                          <AvatarImage src={member.imageUrl} alt={member.name} />
                          <AvatarFallback className="bg-muted text-[11px] font-semibold text-foreground">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {hiddenTeamMembersCount > 0 ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-card bg-muted text-[11px] font-semibold text-foreground shadow-sm">
                          +{hiddenTeamMembersCount}
                        </div>
                      ) : null}
                    </div>

                    <div className="inline-flex items-center gap-2 text-[13px] font-medium text-foreground/82 sm:text-[15px]">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {teamMembers.length} collaborator
                        {teamMembers.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  {project.location ? (
                    <span className="inline-flex items-center gap-2 font-medium text-foreground/82">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {project.location}
                    </span>
                  ) : null}

                  {projectEditedDateLabel ? (
                    <div className="inline-flex flex-wrap items-center gap-2 text-[13px] sm:text-[15px]">
                      <Clock3 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-foreground/82">
                        Edited
                      </span>
                      <time
                        dateTime={new Date(projectLastUpdatedAt).toISOString()}
                        className="text-foreground/72"
                      >
                        {projectEditedDateLabel}
                      </time>
                      {projectEditedAgoLabel ? (
                        <span className="text-muted-foreground">
                          ({projectEditedAgoLabel})
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:gap-4 xl:justify-end">
                  {projectLink ? (
                    <Link
                      href={projectLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-[13px] font-medium text-foreground/82 underline-offset-4 transition-colors hover:text-foreground hover:underline sm:text-[15px]"
                    >
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      Visit website
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>

            {project.description ? (
              <div className="border-b border-border/70 px-5 py-5 sm:px-7 lg:px-9">
                <p className="max-w-[860px] text-[15px] leading-7 text-foreground/78">
                  {project.description}
                </p>
              </div>
            ) : null}

            <div className="border-b border-border/70 px-5 py-6 sm:px-7 sm:py-7 lg:px-9">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                {overviewMetrics.map((metric, index) => (
                  <div
                    key={metric.label}
                    className={cn(
                      "rounded-[18px] border border-border/80 bg-card px-5 py-5",
                      metric.spanClass,
                      index === overviewMetrics.length - 1 && "md:col-span-2",
                    )}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {metric.label}
                    </p>
                    <p className="mt-3 text-[30px] font-semibold tracking-tight tabular-nums text-foreground">
                      {metric.value}
                    </p>
                    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                      {metric.meta}
                    </p>
                    {"breakdown" in metric && metric.breakdown?.length ? (
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 pt-3">
                        {metric.breakdown.map((item) => (
                          <div key={item.label} className="space-y-0.5">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                              {item.label}
                            </p>
                            <p className="text-[12px] font-medium text-foreground">
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 py-6 sm:px-7 sm:py-7 lg:px-9">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Recent
                  </p>
                </div>
              </div>
              <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {recentCards.length > 0 ? (
                  recentCards.map((card) => {
                    const hasImage = Boolean(card.imageUrl);

                    return (
                      <Link
                        key={card.id}
                        href={card.href}
                        className={cn(
                          "group overflow-hidden rounded-[16px] border border-border/80 bg-card transition-[transform,background-color,border-color] duration-200 hover:-translate-y-0.5 hover:bg-muted/20",
                          !hasImage &&
                            "flex min-h-[180px] flex-col bg-[linear-gradient(180deg,rgba(247,247,244,0.88)_0%,rgba(255,255,255,0.98)_100%)]",
                        )}
                      >
                        {hasImage ? (
                          <>
                            <div className="relative aspect-[1.38/1] border-b border-border/70 bg-muted/30">
                              <Image
                                src={card.imageUrl}
                                alt={card.title}
                                fill
                                className="object-cover"
                                sizes="(max-width: 1280px) 50vw, 220px"
                              />
                            </div>
                            <div className="space-y-1 px-3 py-2.5">
                              <p className="truncate text-[11px] font-medium text-foreground">
                                {card.title}
                              </p>
                              <p className="truncate text-[10px] text-muted-foreground">
                                {card.subtitle}
                              </p>
                              <Badge
                                variant="outline"
                                className="rounded-md border-border/80 bg-muted/25 px-2 py-0.5 text-[9px] font-medium text-muted-foreground"
                              >
                                {card.status}
                              </Badge>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-between border-b border-border/70 px-3.5 py-3.5">
                              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-border/70 bg-background/85 text-foreground shadow-sm">
                                <Files className="h-3.5 w-3.5" />
                              </div>
                              <Badge
                                variant="outline"
                                className="rounded-md border-border/80 bg-background/80 px-2 py-0.5 text-[9px] font-medium text-muted-foreground"
                              >
                                {card.status}
                              </Badge>
                            </div>
                            <div className="flex flex-1 flex-col justify-between px-3.5 py-3.5">
                              <div className="space-y-2">
                                <p className="line-clamp-2 text-[15px] font-medium leading-[1.15] tracking-tight text-foreground">
                                  {card.title}
                                </p>
                                <p className="line-clamp-4 text-[12px] leading-5 text-muted-foreground">
                                  {card.subtitle}
                                </p>
                              </div>
                            </div>
                          </>
                        )}
                      </Link>
                    );
                  })
                ) : (
                  <div className="col-span-full rounded-[12px] border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-[12px] text-muted-foreground">
                    Add moodboard items, files, or notes to populate the recent
                    strip.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <ProjectBookExportDialog
        exportOptions={projectBookExportOptions}
        isOpen={isProjectBookExportOpen}
        isPending={isExportingProjectBook}
        onClose={() => setIsProjectBookExportOpen(false)}
        onExport={() => void handleExportProjectBook()}
        onExportOptionsChange={setProjectBookExportOptions}
      />
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
