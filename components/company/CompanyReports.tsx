"use client";

import { useState, type ReactNode } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { toast } from "sonner";
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
import {
  type ReportExportOptions,
  ReportsExportDialog,
  type ReportSectionKey,
} from "@/components/company/ReportsExportDialog";
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
import { exportWorkbookTables, getSectionAccentColor, type XlsxTable } from "@/lib/xlsxExport";

const SHOPPING_STATUSES = [
  "PLANNED",
  "ORDERED",
  "IN_TRANSIT",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
] as const;

const TIME_RANGE_CONFIG = {
  "7d": { days: 7, label: "Last 7 days", metricLabel: "7d" },
  "30d": { days: 30, label: "Last 30 days", metricLabel: "30d" },
  "90d": { days: 90, label: "Last 3 months", metricLabel: "90d" },
  "1y": { days: 365, label: "Last year", metricLabel: "1y" },
} as const satisfies Record<string, { days: number; label: string; metricLabel: string }>;

const ALL_REPORT_SECTIONS: Record<ReportSectionKey, boolean> = {
  overview: true,
  projects: true,
  tasks: true,
  financial: true,
};

const REPORT_SECTION_LABELS: Record<ReportSectionKey, string> = {
  overview: "Overview",
  projects: "Projects",
  tasks: "Tasks",
  financial: "Financial",
};

const REPORT_SECTION_ORDER: ReportSectionKey[] = ["overview", "projects", "tasks", "financial"];

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

export default function CompanyReports() {
  const { organization, isLoaded } = useOrganization();
  const [timeRange, setTimeRange] = useState<string>("30d");
  const [activeTab, setActiveTab] = useState<ReportSectionKey>("overview");
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportOptions, setExportOptions] = useState<ReportExportOptions>({
    format: "pdf",
    includeDetails: true,
    sections: ALL_REPORT_SECTIONS,
  });
  const timeRangeConfig = TIME_RANGE_CONFIG[timeRange as keyof typeof TIME_RANGE_CONFIG] ?? TIME_RANGE_CONFIG["30d"];

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

  const analyticsMetrics = useQuery(
    apiAny.activityLog.getTeamProductKpis,
    team && team._id ? { teamId: team._id, days: timeRangeConfig.days } : "skip",
  );

  if (!isLoaded || !organization) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const projectList = projects || [];
  const tasksList = teamTasks || [];
  const shoppingList = shoppingItems || [];
  const shoppingSetList = shoppingSets || [];
  const shoppingListWithStatus = shoppingList as Array<{
    _id: string;
    totalPrice?: number | null;
    realizationStatus: string;
    setId?: string | null;
  }>;
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

  const totalShoppingCost = calculateShoppingTotal(shoppingListWithStatus, shoppingSetList as Array<{
    _id: string;
    setType: "variant" | "bundle" | "reference";
    selectionMode: "single" | "multiple" | "none";
    pricingMode: "selected_only" | "all_selected" | "none";
    status: "draft" | "active" | "resolved" | "archived";
    resolvedItemIds?: string[] | null;
    preferredItemIds?: string[] | null;
  }>);
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
    (item) => ["ORDERED", "IN_TRANSIT", "DELIVERED", "COMPLETED"].includes(item.realizationStatus),
  );

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
    const items = shoppingListWithStatus.filter((item) => item.realizationStatus === status);
    const scopedSetIds = new Set(items.map((item) => item.setId).filter((value): value is string => !!value));
    const scopedSets = shoppingSetList.filter((set) => scopedSetIds.has(String(set._id)));
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

  const analyticsRangeSuffix = timeRangeConfig.metricLabel;
  const generatedOn = new Date();
  const generatedOnLabel = generatedOn.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const fileDate = generatedOn.toISOString().slice(0, 10);

  const overviewExportRows = [
    ["Total Projects", totalProjects],
    ["Active Projects", activeProjects],
    ["Total Budget", formatMoney(totalBudget)],
    ["Total Tasks", totalTasks],
    ["Completed Tasks", completedTasks],
    ["Tasks In Progress", inProgressTasks],
    ["Completion Rate", `${completionRate.toFixed(1)}%`],
    ["Overdue Tasks", overdueTasks],
    [`Onboarding (${analyticsRangeSuffix})`, analyticsMetrics?.onboardingCompleted ?? 0],
    [`Projects Created (${analyticsRangeSuffix})`, analyticsMetrics?.projectsCreated ?? 0],
    [`AI Messages (${analyticsRangeSuffix})`, analyticsMetrics?.aiMessagesSent ?? 0],
    [`Active Users (${analyticsRangeSuffix})`, analyticsMetrics?.activeUsers ?? 0],
  ] as Array<[string, string | number]>;

  const projectStatusExportRows = Object.entries(projectsByStatus).map(([status, count]) => [
    status.toUpperCase(),
    String(Number(count)),
    `${totalProjects > 0 ? ((Number(count) / totalProjects) * 100).toFixed(1) : "0.0"}%`,
  ]);

  const projectDetailExportRows = projectList
    .slice()
    .sort((a, b) => b._creationTime - a._creationTime)
    .map((project) => {
      const projectTasks = tasksByProject.get(String(project._id)) || [];
      const done = projectTasks.filter((task) => task.status === "done").length;
      const progress = projectTasks.length > 0 ? (done / projectTasks.length) * 100 : 0;

      return [
        project.name,
        project.customer || "-",
        project.status || "-",
        `${Math.round(progress)}%`,
        String(projectTasks.length),
        typeof project.budget === "number"
          ? formatMoney(project.budget, project.currency || activeCurrency)
          : "-",
        project.startDate ? new Date(project.startDate).toLocaleDateString() : "-",
        new Date(project._creationTime).toLocaleDateString(),
      ];
    });

  const taskStatusExportRows = Object.entries(tasksByStatus).map(([status, count]) => [
    status.replaceAll("_", " ").toUpperCase(),
    String(Number(count)),
    `${totalTasks > 0 ? ((Number(count) / totalTasks) * 100).toFixed(1) : "0.0"}%`,
  ]);

  const taskDetailExportRows = tasksList
    .slice()
    .sort((a, b) => (a.endDate || a.startDate || 0) - (b.endDate || b.startDate || 0))
    .map((task) => {
      const dueDate = task.endDate || task.startDate;
      const isOverdue = !!dueDate && dueDate < now && task.status !== "done";
      return [
        task.title,
        projectById.get(String(task.projectId))?.name || "-",
        task.status.replaceAll("_", " "),
        task.priority || "-",
        dueDate ? new Date(dueDate).toLocaleDateString() : "-",
        isOverdue ? "Yes" : "No",
      ];
    });

  const overdueTaskExportRows = overdueTaskList.map((task) => [
    task.title,
    projectById.get(String(task.projectId))?.name || "-",
    task.priority || "medium",
    new Date(task.endDate || task.startDate || now).toLocaleDateString(),
  ]);

  const financialSummaryRows = [
    ["Total Budget", formatMoney(totalBudget)],
    ["Shopping List", formatMoney(totalShoppingCost)],
    ["Ordered Items", formatMoney(orderedShoppingCost)],
  ] as Array<[string, string]>;

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

  const buildReportTablesForSection = (section: ReportSectionKey): XlsxTable[] => {
    if (section === "overview") {
      return [
        {
          headers: ["Metric", "Value"],
          rows: overviewExportRows,
          title: "Overview Summary",
        },
      ];
    }

    if (section === "projects") {
      return [
        {
          headers: ["Status", "Projects", "Share"],
          rows: projectStatusExportRows,
          title: "Project Status Distribution",
        },
        ...(exportOptions.includeDetails
          ? [
              {
                headers: ["Project", "Customer", "Status", "Progress", "Tasks", "Budget", "Start", "Created"],
                rows: projectDetailExportRows,
                title: "Project Details",
              },
            ]
          : []),
      ];
    }

    if (section === "tasks") {
      return [
        {
          headers: ["Status", "Tasks", "Share"],
          rows: taskStatusExportRows,
          title: "Task Status Breakdown",
        },
        ...(exportOptions.includeDetails
          ? [
              {
                headers: ["Task", "Project", "Priority", "Due"],
                rows: overdueTaskExportRows,
                title: "Overdue Tasks",
              },
              {
                headers: ["Task", "Project", "Status", "Priority", "Due", "Overdue"],
                rows: taskDetailExportRows,
                title: "Task Details",
              },
            ]
          : []),
      ];
    }

    return [
      {
        headers: ["Metric", "Value"],
        rows: financialSummaryRows,
        title: "Financial Summary",
      },
      {
        headers: ["Status", "Items", "Total"],
        rows: shoppingStatusExportRows,
        title: "Shopping List by Status",
      },
      ...(exportOptions.includeDetails
        ? [
            {
              headers: ["Project", "Status", "Currency", "Budget"],
              rows: topBudgetExportRows,
              title: "Top Projects by Budget",
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
    const selectedSections = REPORT_SECTION_ORDER.filter((section) => exportOptions.sections[section]);
    if (selectedSections.length === 0) {
      toast.error("Select at least one section to export.");
      return;
    }

    const rows: string[][] = [];
    const addTable = (title: string, headers: string[], body: Array<Array<string | number>>) => {
      rows.push([title]);
      rows.push(headers);
      if (body.length === 0) {
        rows.push(["No data"]);
      } else {
        rows.push(...body.map((row) => row.map((cell) => String(cell))));
      }
      rows.push([]);
    };

    if (exportOptions.sections.overview) {
      addTable("Overview Summary", ["Metric", "Value"], overviewExportRows);
    }

    if (exportOptions.sections.projects) {
      addTable("Project Status Distribution", ["Status", "Projects", "Share"], projectStatusExportRows);
      if (exportOptions.includeDetails) {
        addTable(
          "Project Details",
          ["Project", "Customer", "Status", "Progress", "Tasks", "Budget", "Start", "Created"],
          projectDetailExportRows,
        );
      }
    }

    if (exportOptions.sections.tasks) {
      addTable("Task Status Breakdown", ["Status", "Tasks", "Share"], taskStatusExportRows);
      if (exportOptions.includeDetails) {
        addTable("Overdue Tasks", ["Task", "Project", "Priority", "Due"], overdueTaskExportRows);
        addTable(
          "Task Details",
          ["Task", "Project", "Status", "Priority", "Due", "Overdue"],
          taskDetailExportRows,
        );
      }
    }

    if (exportOptions.sections.financial) {
      addTable("Financial Summary", ["Metric", "Value"], financialSummaryRows);
      addTable("Shopping List by Status", ["Status", "Items", "Total"], shoppingStatusExportRows);
      if (exportOptions.includeDetails) {
        addTable("Top Projects by Budget", ["Project", "Status", "Currency", "Budget"], topBudgetExportRows);
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
    toast.success(`Exported ${selectedSections.map((section) => REPORT_SECTION_LABELS[section]).join(", ")} as CSV.`);
  };

  const exportXlsx = async () => {
    const selectedSections = REPORT_SECTION_ORDER.filter((section) => exportOptions.sections[section]);
    if (selectedSections.length === 0) {
      toast.error("Select at least one section to export.");
      return;
    }

    await exportWorkbookTables({
      fileName: `reports-${sanitizeFileName(organization.name || "organization")}-${fileDate}.xlsx`,
      sheets: selectedSections.map((section, index) => ({
        generatedOn: generatedOnLabel,
        name: REPORT_SECTION_LABELS[section],
        subtitle: `${timeRangeConfig.label} | ${REPORT_SECTION_LABELS[section]}`,
        tables: buildReportTablesForSection(section).map((table) => ({
          ...table,
          accentColor: getSectionAccentColor(index),
        })),
        title: `${organization.name || "Organization"} Reports`,
      })),
    });
    setIsExportModalOpen(false);
    toast.success(`Exported ${selectedSections.map((section) => REPORT_SECTION_LABELS[section]).join(", ")} as Excel.`);
  };

  const exportPdf = async () => {
    const selectedSections = REPORT_SECTION_ORDER.filter((section) => exportOptions.sections[section]);
    if (selectedSections.length === 0) {
      toast.error("Select at least one section to export.");
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
      teamName: team?.name || organization.name || "Organization",
      teamImageUrl: team?.imageUrl,
      fontFamily: pdfFontFamily,
    });

    yPosition = addDocumentMeta(doc, {
      title: "Reports & Analytics",
      subtitle: `${timeRangeConfig.label} | ${selectedSections.map((section) => REPORT_SECTION_LABELS[section]).join(", ")}`,
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
        columnStyles?: Record<number, { cellWidth?: number | "auto"; halign?: "left" | "center" | "right" }>;
      },
    ) => {
      const safeBody = body.length > 0 ? body : [Array.from({ length: head[0]?.length || 1 }, (_, index) => (index === 0 ? "No data" : ""))];
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
        ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || yPosition) + 8;
    };

    if (exportOptions.sections.overview) {
      renderSectionTitle("Overview", "Organization summary");
      await renderTable([["Metric", "Value"]], overviewExportRows, {
        columnStyles: {
          0: { cellWidth: 90 },
          1: { cellWidth: "auto" },
        },
      });
    }

    if (exportOptions.sections.projects) {
      renderSectionTitle("Projects", "Status distribution");
      await renderTable([["Status", "Projects", "Share"]], projectStatusExportRows, {
        columnStyles: {
          1: { halign: "right" },
          2: { halign: "right" },
        },
      });

      if (exportOptions.includeDetails) {
        renderSectionTitle("Project Details");
        await renderTable(
          [["Project", "Customer", "Status", "Progress", "Tasks", "Budget", "Start", "Created"]],
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
      renderSectionTitle("Tasks", "Status breakdown");
      await renderTable([["Status", "Tasks", "Share"]], taskStatusExportRows, {
        columnStyles: {
          1: { halign: "right" },
          2: { halign: "right" },
        },
      });

      if (exportOptions.includeDetails) {
        renderSectionTitle("Overdue Tasks");
        await renderTable([["Task", "Project", "Priority", "Due"]], overdueTaskExportRows, {
          columnStyles: {
            0: { cellWidth: 72 },
            1: { cellWidth: 48 },
            2: { cellWidth: 24 },
            3: { cellWidth: 24 },
          },
        });

        renderSectionTitle("Task Details");
        await renderTable([["Task", "Project", "Status", "Priority", "Due", "Overdue"]], taskDetailExportRows, {
          columnStyles: {
            0: { cellWidth: 58 },
            1: { cellWidth: 40 },
            2: { cellWidth: 28 },
            3: { cellWidth: 24 },
            4: { cellWidth: 22 },
            5: { cellWidth: 18, halign: "center" },
          },
        });
      }
    }

    if (exportOptions.sections.financial) {
      renderSectionTitle("Financial", "Budget and procurement summary");
      await renderTable([["Metric", "Value"]], financialSummaryRows, {
        columnStyles: {
          0: { cellWidth: 90 },
          1: { cellWidth: "auto", halign: "right" },
        },
      });
      await renderTable([["Status", "Items", "Total"]], shoppingStatusExportRows, {
        columnStyles: {
          1: { halign: "right" },
          2: { halign: "right" },
        },
      });

      if (exportOptions.includeDetails) {
        renderSectionTitle("Top Projects by Budget");
        await renderTable([["Project", "Status", "Currency", "Budget"]], topBudgetExportRows, {
          columnStyles: {
            0: { cellWidth: 74 },
            1: { cellWidth: 32 },
            2: { cellWidth: 24 },
            3: { cellWidth: 34, halign: "right" },
          },
        });
      }
    }

    addPageNumbers(doc, pdfFontFamily);
    doc.save(`reports-${sanitizeFileName(organization.name || "organization")}-${fileDate}.pdf`);
    setIsExportModalOpen(false);
    toast.success(`Exported ${selectedSections.map((section) => REPORT_SECTION_LABELS[section]).join(", ")} as PDF.`);
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
      toast.error("Failed to export reports.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Reports & Analytics</h1>

        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[12.5rem]">
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
          <Button onClick={openExportModal} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <Tabs className="w-full" value={activeTab} onValueChange={(value) => setActiveTab(value as ReportSectionKey)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalProjects}</div>
                  <p className="text-xs text-muted-foreground">{activeProjects} active</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatMoney(totalBudget)}</div>
                  <p className="text-xs text-muted-foreground">Across all projects</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
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
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overdueTasks}</div>
                  <p className="text-xs text-muted-foreground">
                    {overdueTasks > 0 ? (
                      <span className="text-destructive">Require attention</span>
                    ) : (
                      <span className="text-foreground">All on track</span>
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{`Onboarding (${analyticsRangeSuffix})`}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analyticsMetrics?.onboardingCompleted ?? 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{`Projects Created (${analyticsRangeSuffix})`}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analyticsMetrics?.projectsCreated ?? 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{`AI Messages (${analyticsRangeSuffix})`}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analyticsMetrics?.aiMessagesSent ?? 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{`Active Users (${analyticsRangeSuffix})`}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analyticsMetrics?.activeUsers ?? 0}</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="projects" className="mt-6">
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Status Distribution</CardTitle>
                <CardDescription>Breakdown of projects by current status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
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
                <div className="flex flex-col gap-4">
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
                            <div className="flex flex-col gap-2">
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
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Task Status Breakdown</CardTitle>
                <CardDescription>Current status of all tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
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
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    Overdue Tasks
                  </CardTitle>
                  <CardDescription>Tasks that need immediate attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3">
                    {overdueTaskList.map((task) => (
                      <div key={task._id} className="flex items-center justify-between border-l-2 border-destructive pl-3 py-2">
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
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <FinancialCard title="Total Budget" value={formatMoney(totalBudget)} subtitle={`Across ${totalProjects} projects`} icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} />
              <FinancialCard title="Shopping List" value={formatMoney(totalShoppingCost)} subtitle={`${shoppingList.length} items planned`} icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />} />
              <FinancialCard title="Ordered Items" value={formatMoney(orderedShoppingCost)} subtitle="Already ordered/delivered" icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Shopping List by Status</CardTitle>
                <CardDescription>Items and cost by realization status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
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
                <div className="flex flex-col gap-4">
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
        timeRangeLabel={timeRangeConfig.label}
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
    <Card>
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
