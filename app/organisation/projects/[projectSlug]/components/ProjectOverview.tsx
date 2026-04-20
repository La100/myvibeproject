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
import { resolveOrganizationTaxSettings } from "@/lib/organizationTax";
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

const formatProjectDate = (value?: number) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      }).format(new Date(value))
    : null;

const formatDateRange = (startDate?: number, endDate?: number) => {
  const startLabel = formatProjectDate(startDate);
  const endLabel = formatProjectDate(endDate);

  if (startLabel && endLabel) {
    return `${startLabel} -> ${endLabel}`;
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
  const moodboardSections = useQuery(apiAny.files.getMoodboardSections, {
    projectId: project._id,
  });
  const estimations = useQuery(apiAny.costEstimations.listCostEstimations, {
    projectId: project._id,
  });
  const projectContacts = useQuery(apiAny.contacts.getProjectContacts, {
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
    moodboardSections === undefined ||
    estimations === undefined ||
    projectContacts === undefined
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
    (project as { coverImageDisplayUrl?: string }).coverImageDisplayUrl ||
    project.coverImageUrl;
  const projectEditedLabel = formatRelativeProjectEdit(
    (project as { updatedAt?: number }).updatedAt ?? project._creationTime,
  );
  const projectStatusLabel =
    PROJECT_STATUS_LABELS[
      project.status as keyof typeof PROJECT_STATUS_LABELS
    ] || project.status.replace(/_/g, " ");
  const activeTasksCount = tasks.filter((task) => task.status !== "done").length;
  const overdueTasksCount = tasks.filter(
    (task) =>
      task.status !== "done" &&
      typeof task.endDate === "number" &&
      task.endDate < Date.now(),
  ).length;
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
  ).filter(
    (installment) =>
      installment.status !== "paid" && installment.status !== "void",
  );
  const acceptedEstimationsCount = estimations.filter(
    (estimation) => estimation.status === "accepted",
  ).length;
  const sentEstimationsCount = estimations.filter(
    (estimation) => estimation.status === "sent",
  ).length;
  const overdueInstallmentsCount = unpaidInstallments.filter(
    (installment) => installment.status === "open" && installment.isOverdue,
  ).length;
  const openInstallmentsCount = unpaidInstallments.filter(
    (installment) => installment.status === "open",
  ).length;
  const paidAmount = paymentsData?.totals.paid || 0;
  const outstandingAmount = paymentsData?.totals.outstanding || 0;
  const scheduledAmount = budgetSummary.clientFunding.scheduledPayments || 0;

  const teamTaxSettings = resolveOrganizationTaxSettings(
    team?.organizationTaxSettings,
  );
  const taxRate = project.taxEnabled
    ? (project.taxRate ?? 23)
    : teamTaxSettings.taxEnabled
      ? teamTaxSettings.taxRate
      : 0;
  const taxAmount =
    taxRate > 0 ? (shoppingListCost + laborCost) * (taxRate / 100) : 0;
  const totalCost = shoppingListCost + laborCost + taxAmount;

  const overviewMetrics = [
    {
      value: String(activeTasksCount),
      label: "Active tasks",
      meta:
        overdueTasksCount > 0
          ? `${overdueTasksCount} overdue`
          : `${Math.max(tasks.length - activeTasksCount, 0)} completed`,
    },
    {
      value: String(estimations.length),
      label: "Estimations",
      meta:
        acceptedEstimationsCount > 0
          ? `${acceptedEstimationsCount} accepted`
          : sentEstimationsCount > 0
            ? `${sentEstimationsCount} sent`
            : "No estimations yet",
    },
    {
      value: String(unpaidInstallments.length),
      label: "Open payments",
      meta:
        overdueInstallmentsCount > 0
          ? `${overdueInstallmentsCount} overdue`
          : openInstallmentsCount > 0
            ? `${openInstallmentsCount} awaiting payment`
            : "No open payments",
    },
    {
      value: formatCurrency(
        budgetSummary.plannedCost || scheduledAmount || project.budget || totalCost,
        budgetSummary.currency || paymentsData?.currency || project.currency,
        {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        },
      ),
      label: "Planned cost",
      meta:
        budgetSummary.plannedCost > 0
          ? "Shopping and labor scope"
          : projectContacts.length > 0
            ? `${projectContacts.length} project contacts assigned`
            : "No scoped costs yet",
    },
  ];

  const visibleTeamMembers = teamMembers.slice(0, 4);
  const hiddenTeamMembersCount = Math.max(teamMembers.length - 4, 0);

  const recentCards = [
    ...moodboardSections.flatMap((section) => {
      const files =
        ((moodboardImageResults[section.id] as
          | Array<{ name: string; url: string }>
          | undefined) ?? []).slice(0, 3);

      return files.map((file, index) => ({
        id: `${section.id}-${file.url}-${index}`,
        title: file.name || section.title,
        subtitle: section.title,
        href: `${projectBasePath}/moodboard`,
        imageUrl: file.url,
        status: "Pinboard",
      }));
    }),
    ...notes.slice(0, 2).map((note) => ({
      id: String(note._id),
      title: note.title || "Project note",
      subtitle: note.content?.slice(0, 48) || "Notes",
      href: `${projectBasePath}/notes`,
      imageUrl: "",
      status: "Notes",
    })),
  ].slice(0, 5);

  const projectLink =
    (project as { websiteUrl?: string; website?: string }).websiteUrl ||
    (project as { websiteUrl?: string; website?: string }).website ||
    null;

  const statusVariant =
    project.status === "cancelled"
      ? "destructive"
      : project.status === "completed"
        ? "default"
        : "secondary";

  return (
    <ProjectPageLayout>
      <section className="mx-auto w-full max-w-[1180px]">
        <div className="overflow-hidden rounded-[30px] border border-border/80 bg-card shadow-[var(--shadow-lg)]">
          <div className="min-h-[600px] bg-card">
              <div className="border-b border-border/70 px-6 py-6 sm:px-8">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-[11px] font-medium tracking-[0.01em] text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>Projects</span>
                    <span>/</span>
                    <ClipboardList className="h-3.5 w-3.5" />
                    <span>Overview</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-md border border-border/80 bg-background text-muted-foreground hover:bg-muted"
                      >
                        <MoreHorizontal className="h-4 w-4" />
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

                <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
                  <div className="max-w-[560px] space-y-4">
                    <div className="space-y-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Project Workspace
                      </p>
                      <h1 className="text-[30px] font-medium leading-none tracking-tight text-foreground sm:text-[34px]">
                        {project.name}
                      </h1>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                        {project.location ? (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {project.location}
                          </span>
                        ) : null}
                        {projectEditedLabel ? <span>{projectEditedLabel}</span> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Badge
                        variant={statusVariant}
                        className="rounded-md px-2.5 py-1 text-[11px] font-medium shadow-none"
                      >
                        {projectStatusLabel}
                      </Badge>
                      {project.customer ? (
                        <Badge
                          variant="outline"
                          className="rounded-md border-border/80 bg-muted/35 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                        >
                          {project.customer}
                        </Badge>
                      ) : null}
                      <Badge
                        variant="outline"
                        className="rounded-md border-border/80 bg-muted/35 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                      >
                        {formatDateRange(project.startDate, project.endDate)}
                      </Badge>
                    </div>
                    {project.description ? (
                      <p className="max-w-[430px] text-[13px] leading-6 text-muted-foreground">
                        {project.description}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-3 pt-1.5">
                      <div className="flex -space-x-2">
                        {visibleTeamMembers.map((member) => (
                          <Avatar
                            key={member._id}
                            className="h-8 w-8 border border-white shadow-sm"
                          >
                            <AvatarImage src={member.imageUrl} alt={member.name} />
                            <AvatarFallback className="bg-muted text-[11px] font-medium text-foreground">
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {hiddenTeamMembersCount > 0 ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-background bg-muted text-[11px] font-medium text-foreground shadow-sm">
                            +{hiddenTeamMembersCount}
                          </div>
                        ) : null}
                      </div>
                      <div className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span>
                          {teamMembers.length} collaborator
                          {teamMembers.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      {projectLink ? (
                        <Link
                          href={projectLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          <Globe className="h-3.5 w-3.5" />
                          Visit website
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-[18px] border border-border/70 bg-muted/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
                    <div className="relative aspect-[1.55/1]">
                      {projectCoverUrl ? (
                        <Image
                          src={projectCoverUrl}
                          alt={`${project.name} cover`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 1024px) 100vw, 400px"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--muted)_0%,var(--background)_58%,var(--secondary)_100%)]" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid border-b border-border/70 bg-muted/[0.14] md:grid-cols-2 xl:grid-cols-4">
                {overviewMetrics.map((metric, index) => (
                  <div
                    key={metric.label}
                    className={cn(
                      "px-6 py-5 sm:px-8",
                      index < overviewMetrics.length - 1 &&
                        "xl:border-r xl:border-border/70",
                      index < 2 && "md:border-b md:border-border/70 xl:border-b-0",
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
                  </div>
                ))}
              </div>

              <div className="border-b border-border/70 px-6 py-5 sm:px-8">
                <div className="grid items-end gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Total invoices
                    </p>
                    <p className="mt-3 text-[30px] font-semibold tracking-tight tabular-nums text-foreground">
                      {formatCurrency(
                        paidAmount + outstandingAmount,
                        paymentsData?.currency || project.currency,
                        {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        },
                      )}
                    </p>
                    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                      {formatCurrency(
                        paidAmount,
                        paymentsData?.currency || project.currency,
                      )}{" "}
                      paid,{" "}
                      {formatCurrency(
                        outstandingAmount,
                        paymentsData?.currency || project.currency,
                      )}{" "}
                      unpaid
                    </p>
                  </div>
                  <div className="flex items-end justify-start lg:justify-end">
                    <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                      <CalendarRange className="h-3.5 w-3.5" />
                      <span>{formatDateRange(project.startDate, project.endDate)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6 sm:px-8">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Recent
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                      Latest visual references and working materials linked to this project.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {recentCards.length > 0 ? (
                    recentCards.map((card) => (
                      <Link
                        key={card.id}
                        href={card.href}
                        className="group overflow-hidden rounded-[16px] border border-border/80 bg-card transition-[transform,background-color,border-color] duration-200 hover:-translate-y-0.5 hover:bg-muted/20"
                      >
                        <div className="relative aspect-[1.65/1] border-b border-border/70 bg-muted/30">
                          {card.imageUrl ? (
                            <Image
                              src={card.imageUrl}
                              alt={card.title}
                              fill
                              className="object-cover"
                              sizes="(max-width: 1280px) 50vw, 220px"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--muted)_0%,var(--card)_100%)]" />
                          )}
                        </div>
                        <div className="space-y-1.5 px-3 py-3">
                          <p className="truncate text-[12px] font-medium text-foreground">
                            {card.title}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {card.subtitle}
                          </p>
                          <Badge
                            variant="outline"
                            className="rounded-md border-border/80 bg-muted/25 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                          >
                            {card.status}
                          </Badge>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="col-span-full rounded-[12px] border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-[12px] text-muted-foreground">
                      Add moodboard items, files, or notes to populate the recent strip.
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
