"use client";

import { useState, type ReactNode } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import { apiAny } from "@/lib/convexApiAny";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import {
  Download,
  Calendar,
  DollarSign,
  BarChart3,
  TrendingUp,
  Clock,
  AlertCircle,
  FileText,
  Receipt,
  Activity,
  FolderPlus,
  Users,
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
import { AppLoadingState } from "@/components/ui/loading-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type ReportExportOptions,
  ReportsExportDialog,
  type ReportSectionKey,
} from "@/components/company/ReportsExportDialog";
import { downloadCsvFile } from "@/lib/csvExport";
import { useI18n } from "@/lib/i18n";
import {
  addBrandHeader,
  addDocumentMeta,
  addPageNumbers,
  ensurePdfUnicodeFont,
  pdfTableTheme,
  renderPdfTable,
  resolvePageBreak,
  sanitizeFileName,
} from "@/lib/pdfExport";
import { calculateShoppingTotal } from "@/lib/shoppingSets";
import { formatCurrency } from "@/lib/utils";
import {
  exportWorkbookTables,
  getSectionAccentColor,
  type XlsxTable,
} from "@/lib/xlsxExport";

const SHOPPING_STATUSES = [
  "PLANNED",
  "ORDERED",
  "IN_TRANSIT",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
] as const;

const TIME_RANGE_CONFIG = {
  "7d": { days: 7, labelKey: "last7Days" },
  "30d": { days: 30, labelKey: "last30Days" },
  "90d": { days: 90, labelKey: "last3Months" },
  "1y": { days: 365, labelKey: "lastYear" },
} as const;

const ALL_REPORT_SECTIONS: Record<ReportSectionKey, boolean> = {
  overview: true,
  projects: true,
  tasks: true,
  financial: true,
};

const REPORT_SECTION_ORDER: ReportSectionKey[] = [
  "overview",
  "projects",
  "tasks",
  "financial",
];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function downloadUrl(url: string, fileName?: string) {
  const link = document.createElement("a");
  link.href = url;
  if (fileName) {
    link.download = fileName;
  }
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function CompanyReports() {
  const { organization, isLoaded } = useOrganization();
  const { t } = useI18n();
  const [timeRange, setTimeRange] = useState<string>("30d");
  const [activeTab, setActiveTab] = useState<ReportSectionKey>("overview");
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingInvoicesCsv, setIsExportingInvoicesCsv] = useState(false);
  const [isDownloadingInvoicePdfs, setIsDownloadingInvoicePdfs] =
    useState(false);
  const [exportOptions, setExportOptions] = useState<ReportExportOptions>({
    format: "pdf",
    includeDetails: true,
    sections: ALL_REPORT_SECTIONS,
  });
  const timeRangeConfig =
    TIME_RANGE_CONFIG[timeRange as keyof typeof TIME_RANGE_CONFIG] ??
    TIME_RANGE_CONFIG["30d"];
  const timeRangeLabel = t("companyReports", timeRangeConfig.labelKey);
  const reportSectionLabels: Record<ReportSectionKey, string> = {
    overview: t("companyReports", "overview"),
    projects: t("companyReports", "projects"),
    tasks: t("companyReports", "tasks"),
    financial: t("companyReports", "financial"),
  };

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
  const shoppingSets = useQuery(
    apiAny.shopping.getShoppingSetsByTeam,
    team && team._id ? { teamId: team._id } : "skip",
  );
  const teamMembers = useQuery(
    apiAny.teams.getTeamMembers,
    team && team._id ? { teamId: team._id } : "skip",
  );

  const activityMetrics = useQuery(
    apiAny.activityLog.getTeamProductKpis,
    team && team._id
      ? { teamId: team._id, days: timeRangeConfig.days }
      : "skip",
  );
  const invoicesReport = useQuery(
    apiAny.projectPayments.getTeamInvoicesReport,
    team && team._id ? { teamId: team._id } : "skip",
  );
  const getInvoiceDownloadUrl = useAction(
    apiAny.projectPaymentActions.getProjectPaymentInvoiceDownloadUrl,
  );

  if (!isLoaded || !organization) {
    return (
      <AppLoadingState
        variant="section"
        title={t("companyReports", "loadingTitle")}
        description={t("companyReports", "loadingDescription")}
      />
    );
  }

  const projectList = projects || [];
  const tasksList = teamTasks || [];
  const shoppingList = shoppingItems || [];
  const shoppingSetList = shoppingSets || [];
  const teamMembersList = teamMembers || [];
  const shoppingListWithStatus = shoppingList as Array<{
    _id: string;
    totalPrice?: number | null;
    realizationStatus: string;
    setId?: string | null;
  }>;
  const activeCurrency = team?.currency || projectList[0]?.currency || "PLN";

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
  const activeProjects = projectList.filter(
    (project) => project.status === "active",
  ).length;
  const totalBudget = projectList.reduce(
    (sum, project) => sum + (project.budget || 0),
    0,
  );

  const totalTasks = tasksList.length;
  const completedTasks = tasksList.filter(
    (task) => task.status === "done",
  ).length;
  const inProgressTasks = tasksList.filter(
    (task) => task.status === "in_progress",
  ).length;
  const completionRate =
    totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const timeRangeStart =
    Date.now() - timeRangeConfig.days * 24 * 60 * 60 * 1000;
  const recentProjectsCount = projectList.filter(
    (project) => project._creationTime >= timeRangeStart,
  ).length;
  const teamMembersCount = teamMembersList.length;

  const totalShoppingCost = calculateShoppingTotal(
    shoppingListWithStatus,
    shoppingSetList as Array<{
      _id: string;
      setType: "variant" | "bundle" | "reference";
      selectionMode: "single" | "multiple" | "none";
      pricingMode: "selected_only" | "all_selected" | "none";
      status: "draft" | "active" | "resolved" | "archived";
      resolvedItemIds?: string[] | null;
      preferredItemIds?: string[] | null;
    }>,
  );
  const orderedShoppingCost = calculateShoppingTotal(
    shoppingListWithStatus,
    shoppingSetList as Array<{
      _id: string;
      setType: "variant" | "bundle" | "reference";
      selectionMode: "single" | "multiple" | "none";
      pricingMode: "selected_only" | "all_selected" | "none";
      status: "draft" | "active" | "resolved" | "archived";
      resolvedItemIds?: string[] | null;
      preferredItemIds?: string[] | null;
    }>,
    (item) =>
      ["ORDERED", "IN_TRANSIT", "DELIVERED", "COMPLETED"].includes(
        item.realizationStatus,
      ),
  );

  const now = Date.now();
  const overdueTaskList = tasksList
    .filter((task) => {
      const taskEndDate = task.endDate || task.startDate;
      return taskEndDate && taskEndDate < now && task.status !== "done";
    })
    .sort(
      (a, b) =>
        (a.endDate || a.startDate || 0) - (b.endDate || b.startDate || 0),
    )
    .slice(0, 10);
  const overdueTasks = overdueTaskList.length;

  const projectsByStatus = projectList.reduce(
    (acc, project) => {
      const status = project.status || "unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const tasksByStatus = tasksList.reduce(
    (acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const shoppingByStatus = SHOPPING_STATUSES.map((status) => {
    const items = shoppingListWithStatus.filter(
      (item) => item.realizationStatus === status,
    );
    const scopedSetIds = new Set(
      items
        .map((item) => item.setId)
        .filter((value): value is string => !!value),
    );
    const scopedSets = shoppingSetList.filter((set) =>
      scopedSetIds.has(String(set._id)),
    );
    return {
      status,
      count: items.length,
      total: calculateShoppingTotal(
        items,
        scopedSets as Array<{
          _id: string;
          setType: "variant" | "bundle" | "reference";
          selectionMode: "single" | "multiple" | "none";
          pricingMode: "selected_only" | "all_selected" | "none";
          status: "draft" | "active" | "resolved" | "archived";
          resolvedItemIds?: string[] | null;
          preferredItemIds?: string[] | null;
        }>,
      ),
    };
  }).filter((entry) => entry.count > 0);

  const generatedOn = new Date();
  const generatedOnLabel = generatedOn.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const fileDate = generatedOn.toISOString().slice(0, 10);
  const issuedInvoices = invoicesReport?.invoices || [];
  const invoiceTotals = invoicesReport?.totals || {
    invoiceCount: 0,
    openCount: 0,
    overdueCount: 0,
    paidCount: 0,
  };
  const invoiceCurrencySummary = invoicesReport?.currencySummary || [];
  const hasMultipleInvoiceCurrencies = invoiceCurrencySummary.length > 1;
  const primaryInvoiceCurrencySummary =
    invoiceCurrencySummary.find((entry) => entry.currency === activeCurrency) ||
    invoiceCurrencySummary[0] ||
    null;

  const formatInvoiceMoney = (amount: number, currency: string) =>
    formatCurrency(amount, currency || activeCurrency, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });

  const summarizeCurrencyValues = (
    rows: Array<{
      currency: string;
      invoiceCount: number;
      openTotal: number;
      overdueTotal: number;
      paidTotal: number;
      total: number;
    }>,
    key: "total" | "paidTotal" | "openTotal" | "overdueTotal",
  ) => {
    if (rows.length === 0) {
      return "-";
    }

    if (rows.length === 1) {
      return formatInvoiceMoney(rows[0][key], rows[0].currency);
    }

    return rows
      .map(
        (row) =>
          `${row.currency} ${formatInvoiceMoney(row[key], row.currency)}`,
      )
      .join(" • ");
  };

  const overviewExportRows = [
    [t("companyReports", "totalProjects"), totalProjects],
    [t("companyReports", "activeProjects"), activeProjects],
    [t("companyReports", "activeTeamMembers"), teamMembersCount],
    [t("companyReports", "totalBudget"), formatMoney(totalBudget)],
    [t("companyReports", "totalTasks"), totalTasks],
    [t("companyReports", "completedTasks"), completedTasks],
    [t("companyReports", "tasksInProgress"), inProgressTasks],
    [t("companyReports", "completionRate"), `${completionRate.toFixed(1)}%`],
    [t("companyReports", "overdueTasks"), overdueTasks],
    [`${t("companyReports", "newProjects")} (${timeRangeLabel})`, recentProjectsCount],
    [
      `${t("companyReports", "recordedActivity")} (${timeRangeLabel})`,
      activityMetrics?.activityEvents ?? 0,
    ],
    [
      `${t("companyReports", "activeCollaborators")} (${timeRangeLabel})`,
      activityMetrics?.activeCollaborators ?? 0,
    ],
  ] as Array<[string, string | number]>;

  const projectStatusExportRows = Object.entries(projectsByStatus).map(
    ([status, count]) => [
      status.toUpperCase(),
      String(Number(count)),
      `${totalProjects > 0 ? ((Number(count) / totalProjects) * 100).toFixed(1) : "0.0"}%`,
    ],
  );

  const projectDetailExportRows = projectList
    .slice()
    .sort((a, b) => b._creationTime - a._creationTime)
    .map((project) => {
      const projectTasks = tasksByProject.get(String(project._id)) || [];
      const done = projectTasks.filter((task) => task.status === "done").length;
      const progress =
        projectTasks.length > 0 ? (done / projectTasks.length) * 100 : 0;

      return [
        project.name,
        project.customer || "-",
        project.status || "-",
        `${Math.round(progress)}%`,
        String(projectTasks.length),
        typeof project.budget === "number"
          ? formatMoney(project.budget, project.currency || activeCurrency)
          : "-",
        project.startDate
          ? new Date(project.startDate).toLocaleDateString()
          : "-",
        new Date(project._creationTime).toLocaleDateString(),
      ];
    });

  const taskStatusExportRows = Object.entries(tasksByStatus).map(
    ([status, count]) => [
      status.replaceAll("_", " ").toUpperCase(),
      String(Number(count)),
      `${totalTasks > 0 ? ((Number(count) / totalTasks) * 100).toFixed(1) : "0.0"}%`,
    ],
  );

  const taskDetailExportRows = tasksList
    .slice()
    .sort(
      (a, b) =>
        (a.endDate || a.startDate || 0) - (b.endDate || b.startDate || 0),
    )
    .map((task) => {
      const dueDate = task.endDate || task.startDate;
      const isOverdue = !!dueDate && dueDate < now && task.status !== "done";
      return [
        task.title,
        projectById.get(String(task.projectId))?.name || "-",
        task.status.replaceAll("_", " "),
        task.priority || "-",
        dueDate ? new Date(dueDate).toLocaleDateString() : "-",
        isOverdue ? t("companyReports", "yes") : t("companyReports", "no"),
      ];
    });

  const overdueTaskExportRows = overdueTaskList.map((task) => [
    task.title,
    projectById.get(String(task.projectId))?.name || "-",
    task.priority || "medium",
    new Date(task.endDate || task.startDate || now).toLocaleDateString(),
  ]);

  const financialSummaryRows = [
    [t("companyReports", "totalBudget"), formatMoney(totalBudget)],
    [t("companyReports", "shoppingList"), formatMoney(totalShoppingCost)],
    [t("companyReports", "orderedItems"), formatMoney(orderedShoppingCost)],
    [t("companyReports", "issuedInvoices"), String(invoiceTotals.invoiceCount)],
    [t("companyReports", "paidInvoices"), String(invoiceTotals.paidCount)],
    [t("companyReports", "openInvoices"), String(invoiceTotals.openCount)],
    [t("companyReports", "overdueInvoices"), String(invoiceTotals.overdueCount)],
    [t("companyReports", "issuedVolume"), summarizeCurrencyValues(invoiceCurrencySummary, "total")],
    [
      t("companyReports", "paidVolume"),
      summarizeCurrencyValues(invoiceCurrencySummary, "paidTotal"),
    ],
    [
      t("companyReports", "outstandingVolume"),
      summarizeCurrencyValues(invoiceCurrencySummary, "openTotal"),
    ],
  ] as Array<[string, string]>;

  const invoiceCurrencyExportRows = invoiceCurrencySummary.map((entry) => [
    entry.currency,
    String(entry.invoiceCount),
    formatInvoiceMoney(entry.total, entry.currency),
    formatInvoiceMoney(entry.paidTotal, entry.currency),
    formatInvoiceMoney(entry.openTotal, entry.currency),
    formatInvoiceMoney(entry.overdueTotal, entry.currency),
  ]);

  const invoiceDetailExportRows = issuedInvoices.map((invoice) => [
    invoice.invoiceNumber,
    invoice.projectName,
    invoice.customerName || "-",
    invoice.status.toUpperCase(),
    invoice.currency,
    formatInvoiceMoney(invoice.total, invoice.currency),
    invoice.invoiceIssuedAt
      ? new Date(invoice.invoiceIssuedAt).toLocaleDateString()
      : "-",
    invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "-",
    invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : "-",
    invoice.hasInvoicePdf ? t("companyReports", "yes") : t("companyReports", "no"),
  ]);

  const shoppingStatusExportRows = shoppingByStatus.map((entry) => [
    entry.status,
    String(entry.count),
    formatMoney(entry.total),
  ]);

  const topBudgetExportRows = projectList
    .filter((project) => (project.budget || 0) > 0)
    .sort((a, b) => (b.budget || 0) - (a.budget || 0))
    .slice(0, 5)
    .map((project) => [
      project.name,
      project.status || "-",
      project.currency || activeCurrency,
      formatMoney(project.budget || 0, project.currency || activeCurrency),
    ]);

  const buildReportTablesForSection = (
    section: ReportSectionKey,
  ): XlsxTable[] => {
    if (section === "overview") {
      return [
        {
          headers: [t("companyReports", "metric"), t("companyReports", "value")],
          rows: overviewExportRows,
          title: t("companyReports", "overviewSummary"),
        },
      ];
    }

    if (section === "projects") {
      return [
        {
          headers: [t("companyReports", "status"), t("companyReports", "projects"), t("companyReports", "share")],
          rows: projectStatusExportRows,
          title: t("companyReports", "projectStatusDistribution"),
        },
        ...(exportOptions.includeDetails
          ? [
              {
                headers: [
                  t("companyReports", "projects"),
                  t("companyReports", "customer"),
                  t("companyReports", "status"),
                  t("companyReports", "progress"),
                  t("companyReports", "tasks"),
                  t("companyReports", "totalBudget"),
                  t("companyReports", "start"),
                  t("companyReports", "created"),
                ],
                rows: projectDetailExportRows,
                title: t("companyReports", "projectDetails"),
              },
            ]
          : []),
      ];
    }

    if (section === "tasks") {
      return [
        {
          headers: [t("companyReports", "status"), t("companyReports", "tasks"), t("companyReports", "share")],
          rows: taskStatusExportRows,
          title: t("companyReports", "taskStatusBreakdown"),
        },
        ...(exportOptions.includeDetails
          ? [
              {
                headers: [t("companyReports", "task"), t("companyReports", "projects"), t("companyReports", "priority"), t("companyReports", "due")],
                rows: overdueTaskExportRows,
                title: t("companyReports", "overdueTasks"),
              },
              {
                headers: [
                  t("companyReports", "task"),
                  t("companyReports", "projects"),
                  t("companyReports", "status"),
                  t("companyReports", "priority"),
                  t("companyReports", "due"),
                  t("companyReports", "overdueLabel"),
                ],
                rows: taskDetailExportRows,
                title: t("companyReports", "taskDetails"),
              },
            ]
          : []),
      ];
    }

    return [
      {
        headers: [t("companyReports", "metric"), t("companyReports", "value")],
        rows: financialSummaryRows,
        title: t("companyReports", "financialSummary"),
      },
      {
        headers: [
          t("companyReports", "currency"),
          t("companyReports", "issuedInvoices"),
          t("companyReports", "issued"),
          t("companyReports", "paid"),
          t("companyReports", "outstanding"),
          t("companyReports", "overdue"),
        ],
        rows: invoiceCurrencyExportRows,
        title: t("companyReports", "invoicesByCurrency"),
      },
      {
        headers: [t("companyReports", "status"), t("companyReports", "items"), t("companyReports", "total")],
        rows: shoppingStatusExportRows,
        title: t("companyReports", "shoppingListByStatus"),
      },
      ...(exportOptions.includeDetails
        ? [
            {
              headers: [
                t("companyReports", "invoice"),
                t("companyReports", "projects"),
                t("companyReports", "customer"),
                t("companyReports", "status"),
                t("companyReports", "currency"),
                t("companyReports", "total"),
                t("companyReports", "issued"),
                t("companyReports", "due"),
                t("companyReports", "paid"),
                t("companyReports", "pdf"),
              ],
              rows: invoiceDetailExportRows,
              title: t("companyReports", "issuedInvoices"),
            },
            {
              headers: [t("companyReports", "projects"), t("companyReports", "status"), t("companyReports", "currency"), t("companyReports", "totalBudget")],
              rows: topBudgetExportRows,
              title: t("companyReports", "topProjectsByBudget"),
            },
          ]
        : []),
    ];
  };

  const applyCurrentTabSelection = () => {
    setExportOptions((current) => ({
      ...current,
      sections: {
        overview: activeTab === "overview",
        projects: activeTab === "projects",
        tasks: activeTab === "tasks",
        financial: activeTab === "financial",
      },
    }));
  };

  const openExportModal = () => {
    applyCurrentTabSelection();
    setIsExportModalOpen(true);
  };

  const exportCsv = () => {
    const selectedSections = REPORT_SECTION_ORDER.filter(
      (section) => exportOptions.sections[section],
    );
    if (selectedSections.length === 0) {
      toast.error(t("companyReports", "selectSectionToast"));
      return;
    }

    const rows: string[][] = [];
    const addTable = (
      title: string,
      headers: string[],
      body: Array<Array<string | number>>,
    ) => {
      rows.push([title]);
      rows.push(headers);
      if (body.length === 0) {
        rows.push([t("companyReports", "noData")]);
      } else {
        rows.push(...body.map((row) => row.map((cell) => String(cell))));
      }
      rows.push([]);
    };

    if (exportOptions.sections.overview) {
      addTable(
        t("companyReports", "overviewSummary"),
        [t("companyReports", "metric"), t("companyReports", "value")],
        overviewExportRows,
      );
    }

    if (exportOptions.sections.projects) {
      addTable(
        t("companyReports", "projectStatusDistribution"),
        [t("companyReports", "status"), t("companyReports", "projects"), t("companyReports", "share")],
        projectStatusExportRows,
      );
      if (exportOptions.includeDetails) {
        addTable(
          t("companyReports", "projectDetails"),
          [
            t("companyReports", "projects"),
            t("companyReports", "customer"),
            t("companyReports", "status"),
            t("companyReports", "progress"),
            t("companyReports", "tasks"),
            t("companyReports", "totalBudget"),
            t("companyReports", "start"),
            t("companyReports", "created"),
          ],
          projectDetailExportRows,
        );
      }
    }

    if (exportOptions.sections.tasks) {
      addTable(
        t("companyReports", "taskStatusBreakdown"),
        [t("companyReports", "status"), t("companyReports", "tasks"), t("companyReports", "share")],
        taskStatusExportRows,
      );
      if (exportOptions.includeDetails) {
        addTable(
          t("companyReports", "overdueTasks"),
          [t("companyReports", "task"), t("companyReports", "projects"), t("companyReports", "priority"), t("companyReports", "due")],
          overdueTaskExportRows,
        );
        addTable(
          t("companyReports", "taskDetails"),
          [t("companyReports", "task"), t("companyReports", "projects"), t("companyReports", "status"), t("companyReports", "priority"), t("companyReports", "due"), t("companyReports", "overdueLabel")],
          taskDetailExportRows,
        );
      }
    }

    if (exportOptions.sections.financial) {
      addTable(
        t("companyReports", "financialSummary"),
        [t("companyReports", "metric"), t("companyReports", "value")],
        financialSummaryRows,
      );
      addTable(
        t("companyReports", "invoicesByCurrency"),
        [t("companyReports", "currency"), t("companyReports", "issuedInvoices"), t("companyReports", "issued"), t("companyReports", "paid"), t("companyReports", "outstanding"), t("companyReports", "overdue")],
        invoiceCurrencyExportRows,
      );
      addTable(
        t("companyReports", "shoppingListByStatus"),
        [t("companyReports", "status"), t("companyReports", "items"), t("companyReports", "total")],
        shoppingStatusExportRows,
      );
      if (exportOptions.includeDetails) {
        addTable(
          t("companyReports", "issuedInvoices"),
          [
            t("companyReports", "invoice"),
            t("companyReports", "projects"),
            t("companyReports", "customer"),
            t("companyReports", "status"),
            t("companyReports", "currency"),
            t("companyReports", "total"),
            t("companyReports", "issued"),
            t("companyReports", "due"),
            t("companyReports", "paid"),
            t("companyReports", "pdf"),
          ],
          invoiceDetailExportRows,
        );
        addTable(
          t("companyReports", "topProjectsByBudget"),
          [t("companyReports", "projects"), t("companyReports", "status"), t("companyReports", "currency"), t("companyReports", "totalBudget")],
          topBudgetExportRows,
        );
      }
    }

    const csvContent = rows
      .map((row) => row.map((cell) => csvCell(cell)).join(","))
      .join("\n");

    downloadBlob(
      new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }),
      `reports-${sanitizeFileName(organization.name || "organization")}-${fileDate}.csv`,
    );
    setIsExportModalOpen(false);
    toast.success(
      t("companyReports", "exportedSections", {
        sections: selectedSections.map((section) => reportSectionLabels[section]).join(", "),
        format: "CSV",
      }),
    );
  };

  const exportXlsx = async () => {
    const selectedSections = REPORT_SECTION_ORDER.filter(
      (section) => exportOptions.sections[section],
    );
    if (selectedSections.length === 0) {
      toast.error(t("companyReports", "selectSectionToast"));
      return;
    }

    await exportWorkbookTables({
      fileName: `reports-${sanitizeFileName(organization.name || "organization")}-${fileDate}.xlsx`,
      sheets: selectedSections.map((section, index) => ({
        generatedOn: generatedOnLabel,
        name: reportSectionLabels[section],
        subtitle: `${timeRangeLabel} | ${reportSectionLabels[section]}`,
        tables: buildReportTablesForSection(section).map((table) => ({
          ...table,
          accentColor: getSectionAccentColor(index),
        })),
        title: `${organization.name || t("companyReports", "organization")} ${t("companyReports", "reportsDocumentTitle")}`,
      })),
    });
    setIsExportModalOpen(false);
    toast.success(
      t("companyReports", "exportedSections", {
        sections: selectedSections.map((section) => reportSectionLabels[section]).join(", "),
        format: "Excel",
      }),
    );
  };

  const exportPdf = async () => {
    const selectedSections = REPORT_SECTION_ORDER.filter(
      (section) => exportOptions.sections[section],
    );
    if (selectedSections.length === 0) {
      toast.error(t("companyReports", "selectSectionToast"));
      return;
    }

    const jsPdfModule = await import("jspdf");
    const jsPDF = jsPdfModule.jsPDF ?? jsPdfModule.default;
    const doc = new jsPDF({
      format: "a4",
      putOnlyUsedFonts: true,
      unit: "mm",
    });

    let pdfFontFamily = "helvetica";
    try {
      pdfFontFamily = await ensurePdfUnicodeFont(doc);
    } catch (error) {
      console.warn("Unicode PDF font unavailable, using helvetica", error);
    }
    doc.setFont(pdfFontFamily, "normal");

    let yPosition = await addBrandHeader(doc, {
      teamName: team?.name || organization.name || t("companyReports", "organization"),
      teamImageUrl: team?.imageUrl,
      fontFamily: pdfFontFamily,
    });

    yPosition = addDocumentMeta(doc, {
      title: t("companyReports", "reportsDocumentTitle"),
      subtitle: `${timeRangeLabel} | ${selectedSections.map((section) => reportSectionLabels[section]).join(", ")}`,
      generatedOn: generatedOnLabel,
      startY: yPosition,
      fontFamily: pdfFontFamily,
    });

    const renderSectionTitle = (title: string, description?: string) => {
      yPosition = resolvePageBreak(doc, yPosition, description ? 16 : 12);
      doc.setFont(pdfFontFamily, "bold");
      doc.setFontSize(13);
      doc.setTextColor(24, 24, 24);
      doc.text(title, 18, yPosition);
      yPosition += 5;
      if (description) {
        doc.setFont(pdfFontFamily, "normal");
        doc.setFontSize(9);
        doc.setTextColor(110, 110, 110);
        doc.text(description, 18, yPosition);
        yPosition += 5;
      }
    };

    const renderTable = async (
      head: string[][],
      body: Array<Array<string | number>>,
      options?: {
        columnStyles?: Record<
          number,
          { cellWidth?: number | "auto"; halign?: "left" | "center" | "right" }
        >;
      },
    ) => {
      const safeBody =
        body.length > 0
          ? body
          : [
              Array.from({ length: head[0]?.length || 1 }, (_, index) =>
                index === 0 ? t("companyReports", "noData") : "",
              ),
            ];
      await renderPdfTable(doc, {
        ...pdfTableTheme,
        startY: yPosition,
        head,
        body: safeBody,
        styles: {
          ...pdfTableTheme.styles,
          font: pdfFontFamily,
        },
        headStyles: {
          ...pdfTableTheme.headStyles,
          font: pdfFontFamily,
        },
        columnStyles: options?.columnStyles,
      });
      yPosition =
        ((doc as typeof doc & { lastAutoTable?: { finalY: number } })
          .lastAutoTable?.finalY || yPosition) + 8;
    };

    if (exportOptions.sections.overview) {
      renderSectionTitle(
        t("companyReports", "overview"),
        t("companyReports", "organizationSummary"),
      );
      await renderTable([[t("companyReports", "metric"), t("companyReports", "value")]], overviewExportRows, {
        columnStyles: {
          0: { cellWidth: 90 },
          1: { cellWidth: "auto" },
        },
      });
    }

    if (exportOptions.sections.projects) {
      renderSectionTitle(
        t("companyReports", "projects"),
        t("companyReports", "statusDistribution"),
      );
      await renderTable(
        [[t("companyReports", "status"), t("companyReports", "projects"), t("companyReports", "share")]],
        projectStatusExportRows,
        {
          columnStyles: {
            1: { halign: "right" },
            2: { halign: "right" },
          },
        },
      );

      if (exportOptions.includeDetails) {
        renderSectionTitle(t("companyReports", "projectDetails"));
        await renderTable(
          [
            [
              t("companyReports", "projects"),
              t("companyReports", "customer"),
              t("companyReports", "status"),
              t("companyReports", "progress"),
              t("companyReports", "tasks"),
              t("companyReports", "totalBudget"),
              t("companyReports", "start"),
              t("companyReports", "created"),
            ],
          ],
          projectDetailExportRows,
          {
            columnStyles: {
              0: { cellWidth: 34 },
              1: { cellWidth: 28 },
              2: { cellWidth: 20 },
              3: { cellWidth: 18, halign: "right" },
              4: { cellWidth: 16, halign: "right" },
              5: { cellWidth: 28, halign: "right" },
              6: { cellWidth: 20 },
              7: { cellWidth: 20 },
            },
          },
        );
      }
    }

    if (exportOptions.sections.tasks) {
      renderSectionTitle(
        t("companyReports", "tasks"),
        t("companyReports", "statusBreakdown"),
      );
      await renderTable([[t("companyReports", "status"), t("companyReports", "tasks"), t("companyReports", "share")]], taskStatusExportRows, {
        columnStyles: {
          1: { halign: "right" },
          2: { halign: "right" },
        },
      });

      if (exportOptions.includeDetails) {
        renderSectionTitle(t("companyReports", "overdueTasks"));
        await renderTable(
          [[t("companyReports", "task"), t("companyReports", "projects"), t("companyReports", "priority"), t("companyReports", "due")]],
          overdueTaskExportRows,
          {
            columnStyles: {
              0: { cellWidth: 72 },
              1: { cellWidth: 48 },
              2: { cellWidth: 24 },
              3: { cellWidth: 24 },
            },
          },
        );

        renderSectionTitle(t("companyReports", "taskDetails"));
        await renderTable(
          [[t("companyReports", "task"), t("companyReports", "projects"), t("companyReports", "status"), t("companyReports", "priority"), t("companyReports", "due"), t("companyReports", "overdueLabel")]],
          taskDetailExportRows,
          {
            columnStyles: {
              0: { cellWidth: 58 },
              1: { cellWidth: 40 },
              2: { cellWidth: 28 },
              3: { cellWidth: 24 },
              4: { cellWidth: 22 },
              5: { cellWidth: 18, halign: "center" },
            },
          },
        );
      }
    }

    if (exportOptions.sections.financial) {
      renderSectionTitle(
        t("companyReports", "financial"),
        t("companyReports", "budgetProcurementSummary"),
      );
      await renderTable([[t("companyReports", "metric"), t("companyReports", "value")]], financialSummaryRows, {
        columnStyles: {
          0: { cellWidth: 90 },
          1: { cellWidth: "auto", halign: "right" },
        },
      });
      await renderTable(
        [[t("companyReports", "currency"), t("companyReports", "issuedInvoices"), t("companyReports", "issued"), t("companyReports", "paid"), t("companyReports", "outstanding"), t("companyReports", "overdue")]],
        invoiceCurrencyExportRows,
        {
          columnStyles: {
            1: { halign: "right" },
            2: { halign: "right" },
            3: { halign: "right" },
            4: { halign: "right" },
            5: { halign: "right" },
          },
        },
      );
      await renderTable(
        [[t("companyReports", "status"), t("companyReports", "items"), t("companyReports", "total")]],
        shoppingStatusExportRows,
        {
          columnStyles: {
            1: { halign: "right" },
            2: { halign: "right" },
          },
        },
      );

      if (exportOptions.includeDetails) {
        renderSectionTitle(t("companyReports", "issuedInvoices"));
        await renderTable(
          [
            [
              t("companyReports", "invoice"),
              t("companyReports", "projects"),
              t("companyReports", "customer"),
              t("companyReports", "status"),
              t("companyReports", "currency"),
              t("companyReports", "total"),
              t("companyReports", "issued"),
              t("companyReports", "due"),
              t("companyReports", "paid"),
              t("companyReports", "pdf"),
            ],
          ],
          invoiceDetailExportRows,
          {
            columnStyles: {
              0: { cellWidth: 24 },
              1: { cellWidth: 27 },
              2: { cellWidth: 27 },
              3: { cellWidth: 16 },
              4: { cellWidth: 14 },
              5: { cellWidth: 21, halign: "right" },
              6: { cellWidth: 17 },
              7: { cellWidth: 17 },
              8: { cellWidth: 17 },
              9: { cellWidth: 10, halign: "center" },
            },
          },
        );

        renderSectionTitle(t("companyReports", "topProjectsByBudget"));
        await renderTable(
          [[t("companyReports", "projects"), t("companyReports", "status"), t("companyReports", "currency"), t("companyReports", "totalBudget")]],
          topBudgetExportRows,
          {
            columnStyles: {
              0: { cellWidth: 74 },
              1: { cellWidth: 32 },
              2: { cellWidth: 24 },
              3: { cellWidth: 34, halign: "right" },
            },
          },
        );
      }
    }

    addPageNumbers(doc, pdfFontFamily);
    doc.save(
      `reports-${sanitizeFileName(organization.name || "organization")}-${fileDate}.pdf`,
    );
    setIsExportModalOpen(false);
    toast.success(
      t("companyReports", "exportedSections", {
        sections: selectedSections.map((section) => reportSectionLabels[section]).join(", "),
        format: "PDF",
      }),
    );
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (exportOptions.format === "csv") {
        exportCsv();
      } else if (exportOptions.format === "xlsx") {
        await exportXlsx();
      } else {
        await exportPdf();
      }
    } catch (error) {
      console.error("Reports export failed:", error);
      toast.error(t("companyReports", "failedExportReports"), {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleInvoiceCsvExport = async () => {
    if (issuedInvoices.length === 0) {
      toast.error(t("companyReports", "noInvoicesExport"));
      return;
    }

    setIsExportingInvoicesCsv(true);
    try {
      downloadCsvFile({
        fileName: `invoice-register-${sanitizeFileName(organization.name || "organization")}-${fileDate}.csv`,
        headers: [
          t("companyReports", "invoice"),
          t("companyReports", "projects"),
          t("companyReports", "customer"),
          t("companyReports", "status"),
          t("companyReports", "currency"),
          t("companyReports", "total"),
          t("companyReports", "issued"),
          t("companyReports", "due"),
          t("companyReports", "paid"),
          t("companyReports", "pdf"),
        ],
        rows: invoiceDetailExportRows,
      });
      toast.success(
        t("companyReports", "exportedInvoicesCsv", {
          count: issuedInvoices.length,
        }),
      );
    } catch (error) {
      console.error("Invoice CSV export failed:", error);
      toast.error(t("companyReports", "failedInvoicesCsv"), {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setIsExportingInvoicesCsv(false);
    }
  };

  const handleInvoicePdfBatchDownload = async () => {
    if (issuedInvoices.length === 0) {
      toast.error(t("companyReports", "noInvoicesDownload"));
      return;
    }

    setIsDownloadingInvoicePdfs(true);
    let successCount = 0;

    try {
      for (const invoice of issuedInvoices) {
        const result = await getInvoiceDownloadUrl({
          installmentId: invoice._id,
        });
        downloadUrl(
          result.url,
          `invoice-${sanitizeFileName(invoice.invoiceNumber || invoice.title || String(invoice._id))}.pdf`,
        );
        successCount += 1;
        await new Promise((resolve) => window.setTimeout(resolve, 180));
      }

      toast.success(
        t("companyReports", "startedDownloadingPdfs", {
          count: successCount,
        }),
      );
    } catch (error) {
      console.error("Invoice PDF batch download failed:", error);
      toast.error(t("companyReports", "failedInvoicePdfDownload"), {
        description:
          successCount > 0
            ? t("companyReports", "filesStartedBeforeError", {
                count: successCount,
              })
            : toUserFacingErrorMessage(error),
      });
    } finally {
      setIsDownloadingInvoicePdfs(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("companyReports", "title")}</h1>

        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[12.5rem]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">{t("companyReports", "last7Days")}</SelectItem>
              <SelectItem value="30d">{t("companyReports", "last30Days")}</SelectItem>
              <SelectItem value="90d">{t("companyReports", "last3Months")}</SelectItem>
              <SelectItem value="1y">{t("companyReports", "lastYear")}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openExportModal} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            {t("companyReports", "export")}
          </Button>
        </div>
      </div>

      <Tabs
        className="w-full"
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as ReportSectionKey)}
      >
        <TabsList>
          <TabsTrigger value="overview">{t("companyReports", "overview")}</TabsTrigger>
          <TabsTrigger value="projects">{t("companyReports", "projects")}</TabsTrigger>
          <TabsTrigger value="tasks">{t("companyReports", "tasks")}</TabsTrigger>
          <TabsTrigger value="financial">{t("companyReports", "financial")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="h-full min-h-[8.75rem] bg-card">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t("companyReports", "totalProjects")}
                  </CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalProjects}</div>
                  <p className="text-xs text-muted-foreground">
                    {t("companyReports", "currentlyActive", {
                      count: activeProjects,
                    })}
                  </p>
                </CardContent>
              </Card>

              <Card className="h-full min-h-[8.75rem] bg-card">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t("companyReports", "totalBudget")}
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatMoney(totalBudget)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("companyReports", "fullPortfolio")}
                  </p>
                </CardContent>
              </Card>

              <Card className="h-full min-h-[8.75rem] bg-card">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t("companyReports", "completionRate")}
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {completionRate.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("companyReports", "taskCompletionSummary", {
                      completed: completedTasks,
                      inProgress: inProgressTasks,
                    })}
                  </p>
                </CardContent>
              </Card>

              <Card className="h-full min-h-[8.75rem] bg-card">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t("companyReports", "overdueTasks")}
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overdueTasks}</div>
                  <p className="text-xs text-muted-foreground">
                    {overdueTasks > 0 ? (
                      <span className="text-destructive">{t("companyReports", "actionRequired")}</span>
                    ) : (
                      <span className="text-foreground">
                        {t("companyReports", "noDelaysDetected")}
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <FinancialCard
                title={t("companyReports", "activeTeamMembers")}
                value={String(teamMembersCount)}
                subtitle={t("companyReports", "currentMembers")}
                icon={<Users className="h-4 w-4 text-muted-foreground" />}
              />
              <FinancialCard
                title={t("companyReports", "newProjects")}
                value={String(recentProjectsCount)}
                subtitle={timeRangeLabel}
                icon={<FolderPlus className="h-4 w-4 text-muted-foreground" />}
              />
              <FinancialCard
                title={t("companyReports", "recordedActivity")}
                value={String(activityMetrics?.activityEvents ?? 0)}
                subtitle={timeRangeLabel}
                icon={<Activity className="h-4 w-4 text-muted-foreground" />}
              />
              <FinancialCard
                title={t("companyReports", "activeCollaborators")}
                value={String(activityMetrics?.activeCollaborators ?? 0)}
                subtitle={timeRangeLabel}
                icon={<Users className="h-4 w-4 text-muted-foreground" />}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="projects" className="mt-6">
          <div className="flex flex-col gap-6">
            <Card className="bg-card">
              <CardHeader>
                <CardTitle>{t("companyReports", "projectStatusDistribution")}</CardTitle>
                <CardDescription>
                  {t("companyReports", "projectStatusDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  {Object.entries(
                    projectsByStatus as Record<string, number>,
                  ).map(([status, count]) => (
                    <div
                      key={status}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            status === "completed"
                              ? "default"
                              : status === "active"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{
                              width: `${totalProjects > 0 ? (Number(count) / totalProjects) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8">
                          {Number(count)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardHeader>
                <CardTitle>{t("companyReports", "allProjects")}</CardTitle>
                <CardDescription>
                  {t("companyReports", "allProjectsDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  {projectList.length > 0 ? (
                    projectList
                      .slice()
                      .sort((a, b) => b._creationTime - a._creationTime)
                      .map((project) => {
                        const projectTasks =
                          tasksByProject.get(String(project._id)) || [];
                        const done = projectTasks.filter(
                          (task) => task.status === "done",
                        ).length;
                        const progress =
                          projectTasks.length > 0
                            ? (done / projectTasks.length) * 100
                            : 0;

                        return (
                          <div
                            key={project._id}
                            className="rounded-lg border bg-secondary/70 p-4"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-semibold">
                                  {project.name}
                                </h4>
                                {project.customer ? (
                                  <p className="text-sm text-muted-foreground">
                                    {project.customer}
                                  </p>
                                ) : null}
                              </div>
                              <Badge variant="outline">{project.status}</Badge>
                            </div>
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {t("companyReports", "progress")}
                                </span>
                                <span className="font-medium">
                                  {Math.round(progress)}%
                                </span>
                              </div>
                              <div className="w-full bg-secondary rounded-full h-2">
                                <div
                                  className="bg-primary h-2 rounded-full"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>
                                  {t("companyReports", "tasksCount", {
                                    count: projectTasks.length,
                                  })}
                                </span>
                                {typeof project.budget === "number" ? (
                                  <span>
                                    {t("companyReports", "budgetWithValue", {
                                      value: formatMoney(
                                        project.budget,
                                        project.currency || activeCurrency,
                                      ),
                                    })}
                                  </span>
                                ) : null}
                                {project.startDate ? (
                                  <span>
                                    {t("companyReports", "startWithDate", {
                                      date: new Date(
                                        project.startDate,
                                      ).toLocaleDateString(),
                                    })}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      {t("companyReports", "noProjectsYet")}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <div className="flex flex-col gap-6">
            <Card className="bg-card">
              <CardHeader>
                <CardTitle>{t("companyReports", "taskStatusBreakdown")}</CardTitle>
                <CardDescription>{t("companyReports", "taskStatusDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  {Object.entries(tasksByStatus as Record<string, number>).map(
                    ([status, count]) => (
                      <div
                        key={status}
                        className="flex items-center justify-between"
                      >
                        <Badge
                          variant={status === "done" ? "default" : "outline"}
                        >
                          {status.replace("_", " ").toUpperCase()}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-secondary rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{
                                width: `${totalTasks > 0 ? (Number(count) / totalTasks) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium w-8">
                            {Number(count)}
                          </span>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>

            {overdueTasks > 0 ? (
              <Card className="bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    {t("companyReports", "overdueTasks")}
                  </CardTitle>
                  <CardDescription>
                    {t("companyReports", "overdueTasksDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3">
                    {overdueTaskList.map((task) => (
                      <div
                        key={task._id}
                        className="flex items-center justify-between rounded-lg border border-border/70 border-l-2 border-l-destructive bg-secondary/70 px-3 py-2"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {projectById.get(String(task.projectId))?.name} •
                            {t("companyReports", "dueWithDate", {
                              date: new Date(
                                (task.endDate || task.startDate)!,
                              ).toLocaleDateString(),
                            })}
                          </p>
                        </div>
                        <Badge
                          variant={
                            task.priority === "urgent"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {task.priority || t("companyReports", "medium")}
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
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <FinancialCard
                title={t("companyReports", "totalBudget")}
                value={formatMoney(totalBudget)}
                subtitle={t("companyReports", "acrossProjects", {
                  count: totalProjects,
                })}
                icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
              />
              <FinancialCard
                title={t("companyReports", "shoppingList")}
                value={formatMoney(totalShoppingCost)}
                subtitle={t("companyReports", "plannedItems", {
                  count: shoppingList.length,
                })}
                icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
              />
              <FinancialCard
                title={t("companyReports", "orderedItems")}
                value={formatMoney(orderedShoppingCost)}
                subtitle={t("companyReports", "alreadyOrderedDelivered")}
                icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
              />
              <FinancialCard
                title={t("companyReports", "issuedInvoices")}
                value={String(invoiceTotals.invoiceCount)}
                subtitle={t("companyReports", "paidOpenSummary", {
                  paid: invoiceTotals.paidCount,
                  open: invoiceTotals.openCount,
                })}
                icon={<Receipt className="h-4 w-4 text-muted-foreground" />}
              />
            </div>

            <Card className="bg-card">
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>{t("companyReports", "invoicesAcrossProjects")}</CardTitle>
                  <CardDescription>
                    {t("companyReports", "invoicesAcrossProjectsDescription")}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => void handleInvoiceCsvExport()}
                    variant="outline"
                    disabled={
                      isExportingInvoicesCsv || issuedInvoices.length === 0
                    }
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {isExportingInvoicesCsv
                      ? t("companyReports", "exportingCsv")
                      : t("companyReports", "exportInvoicesCsv")}
                  </Button>
                  <Button
                    onClick={() => void handleInvoicePdfBatchDownload()}
                    variant="outline"
                    disabled={
                      isDownloadingInvoicePdfs || issuedInvoices.length === 0
                    }
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {isDownloadingInvoicePdfs
                      ? t("companyReports", "preparingPdfs")
                      : t("companyReports", "downloadAllPdfs")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <FinancialCard
                    title={t("companyReports", "paid")}
                    value={String(invoiceTotals.paidCount)}
                    subtitle={summarizeCurrencyValues(
                      invoiceCurrencySummary,
                      "paidTotal",
                    )}
                    icon={<Receipt className="h-4 w-4 text-muted-foreground" />}
                  />
                  <FinancialCard
                    title={t("companyReports", "open")}
                    value={String(invoiceTotals.openCount)}
                    subtitle={summarizeCurrencyValues(
                      invoiceCurrencySummary,
                      "openTotal",
                    )}
                    icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                  />
                  <FinancialCard
                    title={t("companyReports", "overdue")}
                    value={String(invoiceTotals.overdueCount)}
                    subtitle={summarizeCurrencyValues(
                      invoiceCurrencySummary,
                      "overdueTotal",
                    )}
                    icon={
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    }
                  />
                  <FinancialCard
                    title={
                      hasMultipleInvoiceCurrencies
                        ? t("companyReports", "currencies")
                        : t("companyReports", "issued")
                    }
                    value={
                      hasMultipleInvoiceCurrencies
                        ? String(invoiceCurrencySummary.length)
                        : String(invoiceTotals.invoiceCount)
                    }
                    subtitle={
                      hasMultipleInvoiceCurrencies
                        ? invoiceCurrencySummary
                            .map((entry) => entry.currency)
                            .join(" • ")
                        : primaryInvoiceCurrencySummary
                          ? formatInvoiceMoney(
                              primaryInvoiceCurrencySummary.total,
                              primaryInvoiceCurrencySummary.currency,
                            )
                          : t("companyReports", "noData")
                    }
                    icon={
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    }
                  />
                </div>

                {hasMultipleInvoiceCurrencies ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {invoiceCurrencySummary.map((entry) => (
                      <div
                        key={entry.currency}
                        className="rounded-lg border border-border/70 bg-secondary/70 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{entry.currency}</p>
                          <Badge variant="outline">
                            {t("companyReports", "invoicesCount", {
                              count: entry.invoiceCount,
                            })}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-col gap-1 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                              {t("companyReports", "issued")}
                            </span>
                            <span className="font-medium">
                              {formatInvoiceMoney(entry.total, entry.currency)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">{t("companyReports", "paid")}</span>
                            <span className="font-medium">
                              {formatInvoiceMoney(
                                entry.paidTotal,
                                entry.currency,
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                              {t("companyReports", "outstanding")}
                            </span>
                            <span className="font-medium">
                              {formatInvoiceMoney(
                                entry.openTotal,
                                entry.currency,
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                              {t("companyReports", "overdue")}
                            </span>
                            <span className="font-medium">
                              {formatInvoiceMoney(
                                entry.overdueTotal,
                                entry.currency,
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="rounded-lg border border-border/70 bg-secondary/70">
                  <div className="grid grid-cols-[1.3fr_1.1fr_1fr_0.8fr_0.9fr_0.9fr] gap-3 border-b border-border/70 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <span>{t("companyReports", "invoice")}</span>
                    <span>{t("companyReports", "projectCustomer")}</span>
                    <span>{t("companyReports", "status")}</span>
                    <span>{t("companyReports", "total")}</span>
                    <span>{t("companyReports", "issued")}</span>
                    <span>{t("companyReports", "due")}</span>
                  </div>
                  <div className="divide-y divide-border/70">
                    {issuedInvoices.length > 0 ? (
                      issuedInvoices.map((invoice) => (
                        <div
                          key={String(invoice._id)}
                          className="grid grid-cols-[1.3fr_1.1fr_1fr_0.8fr_0.9fr_0.9fr] gap-3 px-4 py-3 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {invoice.invoiceNumber}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {invoice.title}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate">{invoice.projectName}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {invoice.customerName || t("companyReports", "noCustomer")}
                            </p>
                          </div>
                          <div className="flex min-w-0 items-center gap-2">
                            <Badge
                              variant={
                                invoice.status === "paid"
                                  ? "default"
                                  : invoice.isOverdue
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {invoice.status.toUpperCase()}
                            </Badge>
                            {invoice.hasInvoicePdf ? (
                              <Badge variant="outline">{t("companyReports", "pdf")}</Badge>
                            ) : null}
                          </div>
                          <p className="font-medium">
                            {formatInvoiceMoney(
                              invoice.total,
                              invoice.currency,
                            )}
                          </p>
                          <p>
                            {invoice.invoiceIssuedAt
                              ? new Date(
                                  invoice.invoiceIssuedAt,
                                ).toLocaleDateString()
                              : "-"}
                          </p>
                          <p>
                            {invoice.dueDate
                              ? new Date(invoice.dueDate).toLocaleDateString()
                              : "-"}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-8 text-sm text-muted-foreground">
                        {t("companyReports", "noIssuedInvoicesYet")}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardHeader>
                <CardTitle>{t("companyReports", "shoppingByStatus")}</CardTitle>
                <CardDescription>
                  {t("companyReports", "shoppingByStatusDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  {shoppingByStatus.length > 0 ? (
                    shoppingByStatus.map((entry) => (
                      <div
                        key={entry.status}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              entry.status === "COMPLETED"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {entry.status}
                          </Badge>
                          <span className="text-sm">
                            {t("companyReports", "itemsCount", {
                              count: entry.count,
                            })}
                          </span>
                        </div>
                        <p className="font-bold">{formatMoney(entry.total)}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      {t("companyReports", "noShoppingItemsYet")}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardHeader>
                <CardTitle>{t("companyReports", "budgetOverview")}</CardTitle>
                <CardDescription>{t("companyReports", "topProjectsByBudget")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  {projectList
                    .filter((project) => (project.budget || 0) > 0)
                    .sort((a, b) => (b.budget || 0) - (a.budget || 0))
                    .slice(0, 5)
                    .map((project) => (
                      <div
                        key={project._id}
                        className="flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium">{project.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {project.currency || activeCurrency} •{" "}
                            {project.status}
                          </p>
                        </div>
                        <p className="font-bold">
                          {formatMoney(
                            project.budget || 0,
                            project.currency || activeCurrency,
                          )}
                        </p>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <ReportsExportDialog
        activeSection={activeTab}
        exportOptions={exportOptions}
        isOpen={isExportModalOpen}
        isPending={isExporting}
        onClose={() => setIsExportModalOpen(false)}
        onExport={() => void handleExport()}
        onExportOptionsChange={setExportOptions}
        onSelectAllSections={() =>
          setExportOptions((current) => ({
            ...current,
            sections: ALL_REPORT_SECTIONS,
          }))
        }
        onSelectCurrentSection={applyCurrentTabSelection}
        timeRangeLabel={timeRangeLabel}
      />
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
    <Card className="h-full min-h-[8.75rem] bg-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
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
