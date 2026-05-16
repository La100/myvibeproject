/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";
import { useQueries, useQuery } from "convex/react";
import { toast } from "sonner";
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
import { useI18n } from "@/lib/i18n";
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
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { formatShoppingExportProductLabel } from "@/lib/shoppingListExport";
import {
  ProjectBookExportDialog,
  type ProjectBookExportOptions,
} from "./ProjectBookExportDialog";
import { cn, formatCurrency, getTaskPreview } from "@/lib/utils";

function ProjectOverviewLoading() {
  return (
    <div className="vibe-panel flex min-h-[480px] items-center justify-center">
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

const SHOPPING_STATUS_LABEL_KEYS = {
  PLANNED: "planned",
  ORDERED: "ordered",
  IN_TRANSIT: "inTransit",
  DELIVERED: "delivered",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

const PROJECT_STATUS_LABEL_KEYS = {
  planning: "planned",
  active: "active",
  on_hold: "onHold",
  completed: "completed",
  done: "completed",
  cancelled: "cancelled",
} as const;

const getShoppingStatusLabel = (
  status: keyof typeof SHOPPING_STATUS_LABEL_KEYS | string | undefined,
  t: ReturnType<typeof useI18n>["t"],
) =>
  status && status in SHOPPING_STATUS_LABEL_KEYS
    ? t(
        "shoppingList",
        SHOPPING_STATUS_LABEL_KEYS[
          status as keyof typeof SHOPPING_STATUS_LABEL_KEYS
        ],
      )
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

const formatDateRange = (
  startDate: number | undefined,
  endDate: number | undefined,
  fallback: string,
) => {
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

  return startLabel || endLabel || fallback;
};

const formatRelativeProjectEdit = (
  value: number | undefined,
  t: ReturnType<typeof useI18n>["t"],
) => {
  if (!value) {
    return null;
  }

  const diffMs = Date.now() - value;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return t("projectWorkspace", "editedToday");
  }

  if (diffDays === 1) {
    return t("projectWorkspace", "editedYesterday");
  }

  if (diffDays < 30) {
    return t("projectWorkspace", "editedDaysAgo", { count: diffDays });
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) {
    return t("projectWorkspace", "editedOneMonthAgo");
  }

  if (diffMonths < 12) {
    return t("projectWorkspace", "editedMonthsAgo", { count: diffMonths });
  }

  const diffYears = Math.floor(diffMonths / 12);
  return diffYears === 1
    ? t("projectWorkspace", "editedOneYearAgo")
    : t("projectWorkspace", "editedYearsAgo", { count: diffYears });
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
  const { t } = useI18n();
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
  const previousMoodboardImageResultsRef = useRef<Record<string, unknown>>({});

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
    return <ProjectOverviewLoading />;
  }

  for (const [sectionId, result] of Object.entries(moodboardImageResults)) {
    if (result instanceof Error) {
      throw result;
    }

    if (result !== undefined) {
      previousMoodboardImageResultsRef.current[sectionId] = result;
    }
  }
  const stableMoodboardImageResults = previousMoodboardImageResultsRef.current;

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
        ? shoppingSectionMap.get(String(item.sectionId)) || t("shoppingList", "noSection")
        : t("shoppingList", "noSection"),
      product: formatShoppingExportProductLabel(
        item.name,
        item.setId ? shoppingSetTitleById.get(String(item.setId)) : undefined,
      ),
      qty: String(item.quantity),
      unitPrice: formatCurrency(item.unitPrice || 0, project.currency),
      total: formatCurrency(item.totalPrice || 0, project.currency),
      status: getShoppingStatusLabel(item.realizationStatus, t),
      supplier: item.supplier || "-",
      notes: item.notes || "-",
    }));
  const laborSectionMap = new Map<string, string>(
    laborSections.map((section) => [String(section._id), section.name]),
  );
  const laborBookRows = laborItems.map((item) => ({
    section: item.sectionId
      ? laborSectionMap.get(String(item.sectionId)) || t("shoppingList", "noCategory")
      : t("shoppingList", "noCategory"),
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
      metric: t("projectWorkspace", "budget"),
      value: formatCurrency(budgetSummary.budget, budgetSummary.currency),
      note: t("projectWorkspace", "projectBudgetBaseline"),
    },
    {
      metric: t("projectWorkspace", "plannedCost"),
      value: formatCurrency(budgetSummary.plannedCost, budgetSummary.currency),
      note: t("projectWorkspace", "currentPlannedScope"),
    },
    {
      metric: t("projectWorkspace", "committedCost"),
      value: formatCurrency(
        budgetSummary.committedCost,
        budgetSummary.currency,
      ),
      note: t("projectWorkspace", "bookedCostNotYetRealized"),
    },
    {
      metric: t("projectWorkspace", "actualCost"),
      value: formatCurrency(budgetSummary.actualCost, budgetSummary.currency),
      note: t("projectWorkspace", "realizedProjectSpend"),
    },
    {
      metric: t("projectWorkspace", "projectedVariance"),
      value: formatCurrency(
        Math.abs(budgetSummary.projectedVariance),
        budgetSummary.currency,
      ),
      note:
        budgetSummary.projectedVariance >= 0
          ? t("projectWorkspace", "projectedBuffer")
          : t("projectWorkspace", "projectedOverrun"),
    },
    {
      metric: t("projectWorkspace", "collectedPayments"),
      value: formatCurrency(
        budgetSummary.clientFunding.collectedPayments,
        budgetSummary.currency,
      ),
      note: t("projectWorkspace", "paymentsCollectedSoFar"),
    },
  ];

  const moodboardExportSections = moodboardSections
    .map((section) => ({
      title: section.title,
      items: (
        (stableMoodboardImageResults[section.id] as
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
          title: t("projectWorkspace", "shoppingList"),
          description:
            t("projectWorkspace", "shoppingScopeDescription"),
          columns: [
            { key: "section", label: t("projectWorkspace", "section") },
            { key: "product", label: t("projectWorkspace", "product") },
            { key: "qty", label: t("projectWorkspace", "qty") },
            ...(projectBookExportOptions.showPrice
              ? [{ key: "total", label: t("projectWorkspace", "total") }]
              : []),
            { key: "status", label: t("projectWorkspace", "status") },
            ...(projectBookExportOptions.showSupplier
              ? [{ key: "supplier", label: t("projectWorkspace", "supplier") }]
              : []),
            ...(projectBookExportOptions.showNotes
              ? [{ key: "notes", label: t("projectWorkspace", "notes") }]
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
          emptyMessage: t("projectWorkspace", "noShoppingListItemsAvailable"),
        });
      }

      if (projectBookExportOptions.sections.labor) {
        chapters.push({
          title: t("projectWorkspace", "labor"),
          description:
            t("projectWorkspace", "laborScopeAndServiceEntries"),
          columns: [
            { key: "section", label: t("projectWorkspace", "section") },
            { key: "work", label: t("projectWorkspace", "work") },
            { key: "qty", label: t("projectWorkspace", "qty") },
            { key: "unit", label: t("shoppingList", "unit") },
            ...(projectBookExportOptions.showPrice
              ? [{ key: "total", label: t("projectWorkspace", "total") }]
              : []),
            ...(projectBookExportOptions.showNotes
              ? [{ key: "notes", label: t("projectWorkspace", "notes") }]
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
          emptyMessage: t("projectWorkspace", "noLaborEntriesAvailable"),
        });
      }

      if (projectBookExportOptions.sections.tasks) {
        chapters.push({
          title: t("projectWorkspace", "tasks"),
          description: t("projectWorkspace", "executionStatusOfTrackedProjectTasks"),
          columns: [
            { key: "title", label: t("projectWorkspace", "task") },
            { key: "status", label: t("projectWorkspace", "status") },
            { key: "priority", label: t("shoppingList", "priority") },
            { key: "assignee", label: t("projectWorkspace", "assigned") },
            { key: "timeline", label: t("projectWorkspace", "timeline") },
            { key: "summary", label: t("projectWorkspace", "summary") },
          ],
          rows: taskBookRows,
          emptyMessage: t("projectWorkspace", "noTasksAvailable"),
        });
      }

      if (projectBookExportOptions.sections.budget) {
        chapters.push({
          title: t("projectWorkspace", "budget"),
          description:
            t("projectWorkspace", "currentBudgetPosition"),
          columns: [
            { key: "metric", label: t("projectWorkspace", "metric") },
            { key: "value", label: t("projectWorkspace", "value") },
            { key: "note", label: t("projectWorkspace", "note") },
          ],
          rows: budgetBookRows,
        });
      }

      if (projectBookExportOptions.sections.payments) {
        chapters.push({
          title: t("projectWorkspace", "payments"),
          description: t("projectWorkspace", "scheduledAndCollectedProjectPayments"),
          columns: [
            { key: "title", label: t("projectWorkspace", "installment") },
            { key: "status", label: t("projectWorkspace", "status") },
            { key: "dueDate", label: t("projectWorkspace", "paymentDueDate") },
            { key: "amount", label: t("projectWorkspace", "amount") },
            { key: "reference", label: t("projectWorkspace", "reference") },
          ],
          rows: paymentBookRows,
          emptyMessage: t("projectWorkspace", "noPaymentsAvailable"),
        });
      }

      if (projectBookExportOptions.sections.moodboard) {
        chapters.push({
          type: "gallery",
          title: t("projectWorkspace", "moodboard"),
          description: t("projectWorkspace", "moodboardDescription"),
          sections: moodboardExportSections,
          emptyMessage: t("projectWorkspace", "noMoodboardImagesAvailable"),
        });
      }

      await exportProjectBookPdf({
        brand: {
          teamName: team.name || t("projectWorkspace", "organization"),
          teamImageUrl:
            team.customOrganizationImageSetAt && team.imageUrl?.trim()
              ? team.imageUrl
              : undefined,
        },
        chapters,
        fileName: `project-book-${sanitizeFileName(project.name)}-${new Date().toISOString().slice(0, 10)}.pdf`,
        generatedOn: new Date().toLocaleString(),
        subtitle: `${selectedSections.length} ${t("projectWorkspace", "generatedSectionsSelected")}`,
        title: `${t("projectWorkspace", "projectBook")} - ${project.name}`,
      });

      setIsProjectBookExportOpen(false);
    } catch (error) {
      console.error("Project book export failed:", error);
      toast.error(t("projectWorkspace", "failedToExportProjectBook"), {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setIsExportingProjectBook(false);
    }
  };

  const projectCoverUrl =
    (
      project as { coverImageDisplayUrl?: string }
    ).coverImageDisplayUrl?.trim() ||
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
  const projectEditedLabel = formatRelativeProjectEdit(projectLastUpdatedAt, t);
  const projectEditedDateLabel = formatProjectDate(projectLastUpdatedAt, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const projectEditedAgoLabel = projectEditedLabel
    ? projectEditedLabel.replace(
        new RegExp(`^${t("projectWorkspace", "edited")}\\s+`),
        "",
      )
    : "";
  const projectStatusLabel =
    project.status in PROJECT_STATUS_LABEL_KEYS
      ? t(
          "projectWorkspace",
          PROJECT_STATUS_LABEL_KEYS[
            project.status as keyof typeof PROJECT_STATUS_LABEL_KEYS
          ],
        )
      : project.status.replace(/_/g, " ");
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
  const budgetAmount = budgetSummary.budget || 0;
  const budgetUsedPercent =
    budgetAmount > 0 ? Math.round((totalCost / budgetAmount) * 100) : null;
  const budgetRemaining = budgetAmount - totalCost;
  const hasProjectBudget = budgetAmount > 0;
  const budgetUsageChart = hasProjectBudget
    ? {
        usedPercent: Math.min(
          Math.max((totalCost / budgetAmount) * 100, 0),
          100,
        ),
        percentLabel: `${budgetUsedPercent}%`,
        capLabel: formatCurrency(budgetAmount, budgetSummary.currency, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }),
        floorLabel: formatCurrency(0, budgetSummary.currency, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }),
        statusLabel: budgetRemaining >= 0 ? t("projectWorkspace", "remaining") : t("projectWorkspace", "overBudget"),
        statusValue: formatCurrency(
          Math.abs(budgetRemaining),
          budgetSummary.currency,
          {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          },
        ),
        isOverBudget: budgetRemaining < 0,
      }
    : null;
  const totalCostBreakdown = [
    ...(shoppingListCost > 0
      ? [
          {
            label: t("projectWorkspace", "shopping"),
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
            label: t("projectWorkspace", "labor"),
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
      label: t("projectWorkspace", "activeTasks"),
      meta:
        overdueTasksCount > 0
          ? `${overdueTasksCount} ${t("projectWorkspace", "overdue")}`
          : `${Math.max(tasks.length - activeTasksCount, 0)} ${t("projectWorkspace", "completed").toLowerCase()}`,
      spanClass: "xl:col-span-2",
    },
    {
      value: formatCurrency(totalCost, project.currency, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
      label: t("projectWorkspace", "totalCost"),
      meta:
        totalCostBreakdown.length > 0
          ? t("projectWorkspace", "shoppingAndLaborScope")
          : t("projectWorkspace", "noScopedCostsYet"),
      breakdown: totalCostBreakdown,
      spanClass: "xl:col-span-2",
    },
    {
      value: hasProjectBudget
        ? formatCurrency(budgetAmount, budgetSummary.currency, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })
        : t("projectWorkspace", "notSet"),
      label: t("projectWorkspace", "budget"),
      meta: hasProjectBudget
        ? `${formatCurrency(totalCost, budgetSummary.currency)} used${
            budgetUsedPercent !== null ? ` (${budgetUsedPercent}%)` : ""
          }`
        : t("projectWorkspace", "addProjectBudgetInSettings"),
      budgetUsageChart,
      spanClass: "xl:col-span-2",
    },
    {
      value: formatCurrency(
        paidAmount + outstandingAmount,
        paymentsData?.currency || project.currency,
      ),
      label: t("projectWorkspace", "totalInvoices"),
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
      const files =
        (stableMoodboardImageResults[section.id] as
          | Array<{
              id?: string;
              name: string;
              url: string;
              _creationTime: number;
            }>
          | undefined) ?? [];

      return files.map((file, index) => ({
        id: `${section.id}-${file.id || file.name || index}`,
        title: file.name || section.title,
        subtitle: section.title,
        href: `${projectBasePath}/moodboard`,
        imageUrl: file.url,
        status: t("projectWorkspace", "pinboard"),
        timestamp: file._creationTime || 0,
      }));
    }),
    ...notes.map((note) => ({
      id: String(note._id),
      title: note.title || t("projectWorkspace", "projectNote"),
      subtitle: note.content?.slice(0, 48) || t("projectWorkspace", "notes"),
      href: `${projectBasePath}/notes`,
      imageUrl: "",
      status: t("projectWorkspace", "notes"),
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
    "border-border/80 bg-card text-foreground shadow-none backdrop-blur-md",
    project.status === "cancelled" &&
      "border-destructive/80 bg-destructive/90 text-destructive",
    project.status === "completed" &&
      "border-primary/80 bg-primary/90 text-primary",
  );

  return (
    <ProjectPageLayout>
      <section className="w-full">
        <div className="vibe-panel overflow-hidden rounded-3xl">
          <div className="border-b border-border/70 bg-card px-5 py-5 sm:px-7 sm:py-7 lg:px-9">
            <div className="flex items-start justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-secondary/70 px-3 py-1.5 text-[11px] font-medium tracking-[0.08em] text-muted-foreground backdrop-blur-md">
                <Building2 className="h-3.5 w-3.5" />
                <span>{t("projectWorkspace", "projects")}</span>
                <span className="text-muted-foreground/60">/</span>
                <ClipboardList className="h-3.5 w-3.5" />
                <span>{t("projectWorkspace", "overview")}</span>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 rounded-2xl border border-border/70 bg-secondary/70 text-foreground/75 backdrop-blur-md transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                    <span className="sr-only">{t("projectWorkspace", "projectActions")}</span>
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
                    {t("projectWorkspace", "projectSettings")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => router.push(`${projectBasePath}/tasks`)}
                  >
                    <ClipboardList className="mr-2 h-4 w-4" />
                    {t("projectWorkspace", "openTasksBoard")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => router.push(`${projectBasePath}/payments`)}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    {t("projectWorkspace", "openPayments")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => router.push(`${projectBasePath}/files`)}
                  >
                    <Files className="mr-2 h-4 w-4" />
                    {t("projectWorkspace", "openFiles")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={openProjectBookExport}>
                    <Download className="mr-2 h-4 w-4" />
                    {t("projectWorkspace", "exportProjectBook")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div
              className={cn(
                "grid gap-6 xl:gap-8 lg:items-center",
                hasProjectCover
                  ? "mt-6 lg:grid-cols-[minmax(340px,1.08fr)_minmax(420px,1.12fr)]"
                  : "mt-7 lg:grid-cols-1",
              )}
            >
              <div
                className={cn(
                  "flex min-w-0 flex-col justify-center gap-5",
                  hasProjectCover ? "lg:py-8" : "pb-7 sm:pb-9 lg:pb-10",
                )}
              >
                <div className="flex flex-col gap-4">
                  <h1
                    className={cn(
                      "font-serif text-[2.1rem] leading-[0.92] tracking-[-0.05em] text-foreground sm:text-[2.8rem] lg:text-[3.4rem] xl:text-[3.9rem]",
                      hasProjectCover ? "max-w-[10ch]" : "max-w-[16ch]",
                    )}
                  >
                    {project.name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Badge className={projectStatusBadgeClass}>
                      {projectStatusLabel}
                    </Badge>
                    {project.customer ? (
                      <Badge className="border-border/80 bg-card text-foreground/88 shadow-none backdrop-blur-md">
                        {project.customer}
                      </Badge>
                    ) : null}
                    <Badge className="gap-2 border-border/80 bg-card px-3 text-foreground/88 shadow-none backdrop-blur-md">
                      <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>
                        {formatDateRange(project.startDate, project.endDate, t("projectWorkspace", "timelineNotSet"))}
                      </span>
                    </Badge>
                  </div>
                  {project.location ? (
                    <div className="inline-flex max-w-[680px] items-center gap-2 text-[14px] font-medium text-foreground/78 sm:text-[15px]">
                      <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>{project.location}</span>
                    </div>
                  ) : null}
                  {project.description ? (
                    <p className="max-w-[680px] text-[15px] leading-7 text-foreground/72">
                      {project.description}
                    </p>
                  ) : null}
                </div>
              </div>

              {hasProjectCover ? (
                <div className="relative lg:mr-4 lg:justify-self-end lg:w-full lg:max-w-[480px] lg:pb-3 xl:mr-6 xl:max-w-[560px] xl:pb-4 2xl:mr-8 2xl:max-w-[610px] 2xl:pb-5">
                  <div className="group relative min-h-[240px] overflow-hidden rounded-3xl border border-border/60 bg-secondary/70 shadow-md sm:min-h-[290px] lg:min-h-[320px] xl:min-h-[345px]">
                    <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[10%] bg-[linear-gradient(90deg,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0)_100%)]" />
                    <img
                      src={projectCoverUrl}
                      alt={`${project.name} cover`}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-[1.015]"
                      style={{ objectPosition: "82% center" }}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-border/70 bg-card px-5 py-5 sm:px-7 sm:py-6 lg:px-9">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-[13px] text-muted-foreground sm:text-[15px]">
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    <div className="flex">
                      {visibleTeamMembers.map((member) => (
                        <Avatar
                          key={member._id}
                          className="-ml-2.5 h-10 w-10 border-[3px] border-card shadow-sm first:ml-0"
                        >
                          <AvatarImage
                            src={member.imageUrl}
                            alt={member.name}
                          />
                          <AvatarFallback className="bg-secondary/70 text-[11px] font-semibold text-foreground">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {hiddenTeamMembersCount > 0 ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-card bg-secondary/70 text-[11px] font-semibold text-foreground shadow-sm">
                          +{hiddenTeamMembersCount}
                        </div>
                      ) : null}
                    </div>

                    <div className="inline-flex items-center gap-2 text-[13px] font-medium text-foreground/82 sm:text-[15px]">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {teamMembers.length}{" "}
                        {teamMembers.length === 1
                          ? t("projectWorkspace", "collaborator")
                          : t("projectWorkspace", "collaborators")}
                      </span>
                    </div>
                  </div>

                  {projectEditedDateLabel ? (
                    <div className="inline-flex flex-wrap items-center gap-2 text-[13px] sm:text-[15px]">
                      <Clock3 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-foreground/82">
                        {t("projectWorkspace", "edited")}
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
                      {t("projectWorkspace", "visitWebsite")}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="border-b border-border/70 px-5 py-6 sm:px-7 sm:py-7 lg:px-9">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
                {overviewMetrics.map((metric, index) => (
                  <div
                    key={metric.label}
                    className={cn(
                      "rounded-2xl border border-border/80 bg-secondary/70 px-5 py-5 shadow-sm",
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
                    {"budgetUsageChart" in metric && metric.budgetUsageChart ? (
                      <div className="mt-3 border-t border-border/70 pt-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            {t("projectWorkspace", "budgetUse")}
                          </p>
                          <p
                            className={cn(
                              "text-[12px] font-semibold tabular-nums",
                              metric.budgetUsageChart.isOverBudget
                                ? "text-destructive"
                                : "text-foreground",
                            )}
                          >
                            {metric.budgetUsageChart.percentLabel}
                          </p>
                        </div>
                        <div className="mt-2 h-3 overflow-hidden rounded-full bg-background/80 ring-1 ring-border/70">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              metric.budgetUsageChart.isOverBudget
                                ? "bg-destructive"
                                : "bg-foreground",
                            )}
                            style={{
                              width: `${metric.budgetUsageChart.usedPercent}%`,
                            }}
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-medium tabular-nums text-muted-foreground">
                          <span>{metric.budgetUsageChart.floorLabel}</span>
                          <span>{metric.budgetUsageChart.capLabel}</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            {metric.budgetUsageChart.statusLabel}
                          </p>
                          <p className="text-[12px] font-medium tabular-nums text-foreground">
                            {metric.budgetUsageChart.statusValue}
                          </p>
                        </div>
                      </div>
                    ) : "breakdown" in metric && metric.breakdown?.length ? (
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 pt-3">
                        {metric.breakdown.map((item) => (
                          <div
                            key={item.label}
                            className="flex flex-col gap-0.5"
                          >
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
                          "group overflow-hidden rounded-2xl border border-border/80 bg-secondary/70 transition-[transform,background-color,border-color] duration-200 hover:-translate-y-0.5 hover:bg-secondary",
                          !hasImage &&
                            "flex min-h-[180px] flex-col bg-[linear-gradient(180deg,rgba(247,247,244,0.88)_0%,rgba(255,255,255,0.98)_100%)]",
                        )}
                      >
                        {hasImage ? (
                          <>
                            <div className="relative aspect-[1.38/1] border-b border-border/70 bg-secondary/70">
                              <img
                                src={card.imageUrl}
                                alt={card.title}
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                            </div>
                            <div className="flex flex-col gap-1 px-3 py-2.5">
                              <p className="truncate text-[11px] font-medium text-foreground">
                                {card.title}
                              </p>
                              <p className="truncate text-[10px] text-muted-foreground">
                                {card.subtitle}
                              </p>
                              <Badge
                                variant="outline"
                                className="rounded-md border-border/80 bg-card px-2 py-0.5 text-[9px] font-medium text-muted-foreground"
                              >
                                {card.status}
                              </Badge>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-between border-b border-border/70 px-3.5 py-3.5">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-card text-foreground shadow-sm">
                                <Files className="h-3.5 w-3.5" />
                              </div>
                              <Badge
                                variant="outline"
                                className="rounded-md border-border/80 bg-card px-2 py-0.5 text-[9px] font-medium text-muted-foreground"
                              >
                                {card.status}
                              </Badge>
                            </div>
                            <div className="flex flex-1 flex-col justify-between px-3.5 py-3.5">
                              <div className="flex flex-col gap-2">
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
                  <div className="col-span-full rounded-xl border border-dashed border-border/80 bg-secondary/70 px-4 py-6 text-[12px] text-muted-foreground">
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
    <Suspense fallback={<ProjectOverviewLoading />}>
      <ProjectOverviewContent />
    </Suspense>
  );
}
