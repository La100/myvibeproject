"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { Banknote, CheckCircle2, ClipboardList, Download, ExternalLink, Send, Users, Wallet, Wrench, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { apiAny } from "@/lib/convexApiAny";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { addDocumentMeta, addPageNumbers, ensurePdfUnicodeFont, formatMoney, sanitizeFileName } from "@/lib/pdfExport";

type ClientPanelItem = Doc<"clientPanelItems">;
type ClientPanelSection = Doc<"clientPanelSections">;
type ClientPanelFile = {
  _id: string;
  name: string;
  fileType: "image" | "video" | "document" | "drawing" | "model" | "other";
  mimeType: string;
  size: number;
  folderName?: string;
  moodboardSection?: string;
  uploadedAt: number;
  url: string;
};
type PublicTask = {
  _id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority?: "low" | "medium" | "high" | "urgent" | null;
  startDate?: number;
  endDate?: number;
};
type PublicLaborItem = {
  _id: string;
  name: string;
  notes?: string;
  quantity: number;
  unit: string;
  unitPrice?: number;
  totalPrice?: number;
  startDate?: number;
  endDate?: number;
};
type PublicContact = {
  _id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  type: "contractor" | "supplier" | "subcontractor" | "other";
  website?: string;
  projectRole?: string;
  projectNotes?: string;
};
type PublicPayment = {
  _id: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  dueDate?: number;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  invoiceNumber?: string;
  hasInvoicePdf?: boolean;
  paymentReference?: string;
  bankAccountHolder?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankSwift?: string;
  paymentInstructions?: string;
  paidAt?: number;
  isOverdue?: boolean;
};
type PublicApproval = {
  _id: Id<"projectApprovals">;
  type:
    | "material"
    | "estimate"
    | "visualization"
    | "moodboard"
    | "scope"
    | "milestone"
    | "payment"
    | "other";
  title: string;
  description?: string;
  status: "draft" | "sent" | "viewed" | "commented" | "approved" | "rejected" | "expired";
  dueDate?: number;
  currentVersion: number;
  clientDecision?: "approved" | "rejected" | null;
  clientComment?: string | null;
  clientRespondentName?: string | null;
  decidedAt?: number;
  currentVersionRecord?: {
    summary?: string;
    details?: string;
    items?: string[];
    referenceIds?: string[];
  } | null;
};
type PublicBudgetSummary = {
  currency: string;
  budget: number;
  plannedCost: number;
  committedCost: number;
  actualCost: number;
  variance: number;
  projectedVariance: number;
  utilizationPercent: number | null;
  projectedUtilizationPercent: number | null;
  breakdown: {
    shopping: {
      planned: number;
      committed: number;
      actual: number;
    };
    labor: {
      planned: number;
      committed: number;
      actual: number;
    };
  };
  revenue: {
    acceptedEstimations: number;
    pipelineEstimations: number;
    scheduledPayments: number;
    collectedPayments: number;
    outstandingPayments: number;
  };
  milestones: {
    count: number;
    budgetAllocated: number;
  };
  alerts: Array<{
    severity: "high" | "medium";
    label: string;
  }>;
};
type PublicSurveyQuestion = {
  _id: Id<"surveyQuestions">;
  questionText: string;
  questionType:
    | "text_short"
    | "text_long"
    | "multiple_choice"
    | "single_choice"
    | "rating"
    | "yes_no"
    | "number"
    | "file";
  options?: string[];
  isRequired: boolean;
  order: number;
  ratingScale?: {
    min: number;
    max: number;
    minLabel?: string;
    maxLabel?: string;
  };
};
type PublicSurvey = {
  _id: Id<"surveys">;
  title: string;
  description?: string;
  isRequired: boolean;
  allowMultipleResponses: boolean;
  startDate?: number;
  endDate?: number;
  questions: PublicSurveyQuestion[];
  hasSubmitted: boolean;
  submittedAt?: number;
};
type PublicSurveyAnswerPayload = {
  questionId: Id<"surveyQuestions">;
  answerType: "text" | "choice" | "rating" | "number" | "boolean";
  textAnswer?: string;
  choiceAnswers?: string[];
  ratingAnswer?: number;
  numberAnswer?: number;
  booleanAnswer?: boolean;
};
type MaterialDecision = "accepted" | "rejected" | null;
type MaterialFeedbackDraft = {
  decision: MaterialDecision;
  comment: string;
};

const EMPTY_SECTIONS: ClientPanelSection[] = [];
const EMPTY_ITEMS: ClientPanelItem[] = [];
const EMPTY_FILES: ClientPanelFile[] = [];
const EMPTY_SURVEYS: PublicSurvey[] = [];
const EMPTY_TASKS: PublicTask[] = [];
const EMPTY_LABOR_ITEMS: PublicLaborItem[] = [];
const EMPTY_CONTACTS: PublicContact[] = [];
const EMPTY_PAYMENTS: PublicPayment[] = [];
const EMPTY_APPROVALS: PublicApproval[] = [];
const DEFAULT_CLIENT_PANEL_SETTINGS = {
  showShoppingList: false,
  showFiles: false,
  showMoodboard: false,
  showSurveys: false,
  showTasks: false,
  showLabor: false,
  showContacts: false,
  showBudget: false,
  showPayments: false,
  showApprovals: false,
  showNotes: true,
  showSupplier: true,
  showPrice: true,
};

const CURRENCY_SYMBOL_BY_CODE: Record<string, string> = {
  USD: "$",
  EUR: "€",
  PLN: "zł",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
  JPY: "¥",
  CHF: "CHF",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  CZK: "Kč",
  HUF: "Ft",
  CNY: "¥",
  INR: "₹",
  BRL: "R$",
  MXN: "MX$",
  KRW: "₩",
  SGD: "S$",
  HKD: "HK$",
};

const getCurrencySymbol = (currency?: string) =>
  currency ? CURRENCY_SYMBOL_BY_CODE[currency] || currency : "zł";

const formatAmount = (value: number | undefined, currencySymbol: string) => {
  if (value === undefined) {
    return "-";
  }
  return `${value.toFixed(2)} ${currencySymbol}`;
};

const getInitialSelectedOption = (baseItem: ClientPanelItem, options: ClientPanelItem[]) => {
  const selectedId = baseItem.selectedAlternativeSourceItemId
    ? String(baseItem.selectedAlternativeSourceItemId)
    : String(baseItem.sourceItemId);

  return options.some((option) => String(option.sourceItemId) === selectedId)
    ? selectedId
    : String(baseItem.sourceItemId);
};

const getQtyLabel = (item: ClientPanelItem) => `Qty: ${item.quantity} ${item.unit || "pcs"}`;

const getStatusLabel = (status?: string) => {
  if (!status) return null;
  return status.replace(/_/g, " ").toUpperCase();
};

const formatFileSize = (size: number) => {
  if (size >= 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (size >= 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${size} B`;
};

const formatPortalDate = (timestamp?: number) => {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleDateString();
};

const formatTaskStatus = (status: PublicTask["status"]) =>
  status.replace(/_/g, " ").toUpperCase();

const formatMoodboardSectionLabel = (section?: string) => {
  const normalized = section?.trim();
  if (!normalized) return "Moodboard";
  return /^\d+$/.test(normalized) ? `Section ${normalized}` : normalized;
};

const getMaterialDecisionLabel = (decision: MaterialDecision) => {
  if (decision === "accepted") return "Accepted";
  if (decision === "rejected") return "Rejected";
  return "Pending";
};

const approvalTypeLabel = (type: PublicApproval["type"]) =>
  ({
    material: "Material",
    estimate: "Estimate",
    visualization: "Visualization",
    moodboard: "Moodboard",
    scope: "Scope",
    milestone: "Milestone",
    payment: "Payment",
    other: "Other",
  })[type];

const getOrCreatePublicRespondentKey = (accessToken: string) => {
  const storageKey = `client-panel-respondent:${accessToken}`;
  const existing = window.localStorage.getItem(storageKey);
  if (existing && existing.trim().length > 0) {
    return existing;
  }

  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(storageKey, generated);
  return generated;
};

const buildPublicSurveyAnswerPayload = (
  question: PublicSurveyQuestion,
  value: unknown
): PublicSurveyAnswerPayload | null => {
  if (question.questionType === "file") return null;

  if (question.questionType === "text_short" || question.questionType === "text_long") {
    if (typeof value !== "string" || value.trim().length === 0) return null;
    return {
      questionId: question._id,
      answerType: "text",
      textAnswer: value.trim(),
    };
  }

  if (question.questionType === "single_choice") {
    if (typeof value !== "string" || value.trim().length === 0) return null;
    return {
      questionId: question._id,
      answerType: "choice",
      choiceAnswers: [value],
    };
  }

  if (question.questionType === "multiple_choice") {
    if (!Array.isArray(value)) return null;
    const selectedValues = value.filter((option): option is string => typeof option === "string");
    if (selectedValues.length === 0) return null;
    return {
      questionId: question._id,
      answerType: "choice",
      choiceAnswers: selectedValues,
    };
  }

  if (question.questionType === "rating") {
    if (typeof value !== "number" || Number.isNaN(value)) return null;
    return {
      questionId: question._id,
      answerType: "rating",
      ratingAnswer: value,
    };
  }

  if (question.questionType === "number") {
    if (typeof value !== "number" || Number.isNaN(value)) return null;
    return {
      questionId: question._id,
      answerType: "number",
      numberAnswer: value,
    };
  }

  if (question.questionType === "yes_no") {
    if (typeof value !== "boolean") return null;
    return {
      questionId: question._id,
      answerType: "boolean",
      booleanAnswer: value,
    };
  }

  return null;
};

function ItemImage({
  imageUrl,
  name,
  size = "md",
}: {
  imageUrl?: string;
  name: string;
  size?: "md" | "sm";
}) {
  const sizeClass = size === "sm" ? "h-20 w-20" : "h-24 w-24 sm:h-20 sm:w-20";

  if (imageUrl) {
    return (
      <div
        className={`${sizeClass} overflow-hidden rounded-xl border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)]`}
      >
        <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
      </div>
    );
  }

  return null;
}

function ClientPanelSkeleton() {
  return <Spinner className="mx-auto w-full max-w-6xl px-6 pb-24 pt-8 sm:px-8" />;
}

export default function PublicClientPanelPage() {
  const params = useParams<{ accessToken: string }>();
  const accessToken = params.accessToken;
  const [respondentKey, setRespondentKey] = useState<string | null>(null);

  const panelData = useQuery(apiAny.shopping.getPublicShoppingListByAccessToken, {
    accessToken,
  });
  const selectAlternative = useMutation(apiAny.shopping.selectShoppingAlternativeByAccessToken);
  const setItemFeedback = useMutation(apiAny.shopping.setShoppingItemFeedbackByAccessToken);
  const submitPublicSurvey = useMutation(apiAny.surveys.submitPublicSurveyResponseByAccessToken);
  const getInvoiceDownloadUrl = useAction(
    apiAny.projectPaymentActions.getProjectPaymentInvoiceDownloadUrlByAccessToken,
  );
  const publicApprovalsData = useQuery(
    apiAny.projectApprovals.getPublicProjectApprovalsByAccessToken,
    panelData?.settings?.showApprovals ? { accessToken } : "skip"
  );
  const publicBudgetSummaryData = useQuery(
    apiAny.projectBudget.getPublicProjectBudgetSummaryByAccessToken,
    panelData?.settings?.showBudget ? { accessToken } : "skip"
  );
  const respondToApproval = useMutation(apiAny.projectApprovals.respondToProjectApprovalByAccessToken);
  const markApprovalViewed = useMutation(apiAny.projectApprovals.markProjectApprovalViewedByAccessToken);
  const publicSurveysData = useQuery(
    apiAny.surveys.getPublicSurveysByAccessToken,
    respondentKey && (panelData?.settings?.showSurveys ?? false)
      ? { accessToken, respondentKey }
      : "skip"
  );

  const [localSelection, setLocalSelection] = useState<Record<string, string>>({});
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [savingFeedbackItemId, setSavingFeedbackItemId] = useState<string | null>(null);
  const [openSurveyId, setOpenSurveyId] = useState<string | null>(null);
  const [submittingSurveyId, setSubmittingSurveyId] = useState<string | null>(null);
  const [surveyStartTimes, setSurveyStartTimes] = useState<Record<string, number>>({});
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, Record<string, unknown>>>({});
  const [feedbackByItem, setFeedbackByItem] = useState<Record<string, MaterialFeedbackDraft>>({});
  const [isExportingMaterialsPdf, setIsExportingMaterialsPdf] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [respondentName, setRespondentName] = useState("");
  const [selectedMoodboardFile, setSelectedMoodboardFile] = useState<ClientPanelFile | null>(null);
  const [downloadingPaymentId, setDownloadingPaymentId] = useState<string | null>(null);
  const [approvalComments, setApprovalComments] = useState<Record<string, string>>({});
  const [respondingApprovalId, setRespondingApprovalId] = useState<string | null>(null);

  const project = panelData?.project;
  const sections = (panelData?.sections as ClientPanelSection[] | undefined) ?? EMPTY_SECTIONS;
  const items = (panelData?.items as ClientPanelItem[] | undefined) ?? EMPTY_ITEMS;
  const files = (panelData?.files as ClientPanelFile[] | undefined) ?? EMPTY_FILES;
  const moodboardFiles =
    (panelData?.moodboardFiles as ClientPanelFile[] | undefined) ?? EMPTY_FILES;
  const surveys = (publicSurveysData?.surveys as PublicSurvey[] | undefined) ?? EMPTY_SURVEYS;
  const tasks = (panelData?.tasks as PublicTask[] | undefined) ?? EMPTY_TASKS;
  const laborItems = (panelData?.labor as PublicLaborItem[] | undefined) ?? EMPTY_LABOR_ITEMS;
  const contacts = (panelData?.contacts as PublicContact[] | undefined) ?? EMPTY_CONTACTS;
  const payments = (panelData?.payments as PublicPayment[] | undefined) ?? EMPTY_PAYMENTS;
  const approvals =
    (publicApprovalsData?.approvals as PublicApproval[] | undefined) ?? EMPTY_APPROVALS;
  const publicBudgetSummary = publicBudgetSummaryData as PublicBudgetSummary | null | undefined;
  const settings = panelData?.settings ?? DEFAULT_CLIENT_PANEL_SETTINGS;

  const currencySymbol = getCurrencySymbol(project?.currency);
  const moodboardSections = useMemo(() => {
    const grouped = new Map<
      string,
      {
        sectionId: string;
        sectionLabel: string;
        files: ClientPanelFile[];
      }
    >();

    for (const file of moodboardFiles) {
      const sectionId = file.moodboardSection?.trim() || "__default";
      const existing = grouped.get(sectionId);
      if (existing) {
        existing.files.push(file);
        continue;
      }

      grouped.set(sectionId, {
        sectionId,
        sectionLabel: formatMoodboardSectionLabel(file.moodboardSection),
        files: [file],
      });
    }

    return Array.from(grouped.values());
  }, [moodboardFiles]);

  useEffect(() => {
    if (!accessToken || typeof window === "undefined") return;
    setRespondentKey(getOrCreatePublicRespondentKey(accessToken));
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || typeof window === "undefined") return;
    const storageKey = `client-panel-respondent-name:${accessToken}`;
    const savedName = window.localStorage.getItem(storageKey);
    if (savedName) {
      setRespondentName(savedName);
    }
  }, [accessToken]);

  useEffect(() => {
    const baseItems = items.filter((item) => !item.alternativeToSourceItemId);
    setFeedbackByItem((prev) => {
      const next: Record<string, MaterialFeedbackDraft> = {};
      for (const item of baseItems) {
        const itemId = String(item.sourceItemId);
        next[itemId] = prev[itemId] ?? {
          decision: item.customerDecision ?? null,
          comment: item.customerDecisionComment || "",
        };
      }
      return next;
    });
  }, [items]);

  useEffect(() => {
    setApprovalComments((current) => {
      const next = { ...current };
      for (const approval of approvals) {
        const approvalId = String(approval._id);
        if (typeof next[approvalId] !== "string") {
          next[approvalId] = approval.clientComment || "";
        }
      }
      return next;
    });
  }, [approvals]);

  const baseItemsBySection = useMemo(() => {
    const baseItems = items.filter((item) => !item.alternativeToSourceItemId);
    const sectionOrder = new Map(sections.map((section) => [section.name, section.order]));

    const sortedBaseItems = [...baseItems].sort((a, b) => {
      const aSectionOrder =
        a.sectionName && sectionOrder.has(a.sectionName)
          ? (sectionOrder.get(a.sectionName) as number)
          : Number.MAX_SAFE_INTEGER;
      const bSectionOrder =
        b.sectionName && sectionOrder.has(b.sectionName)
          ? (sectionOrder.get(b.sectionName) as number)
          : Number.MAX_SAFE_INTEGER;

      if (aSectionOrder !== bSectionOrder) {
        return aSectionOrder - bSectionOrder;
      }

      return a.name.localeCompare(b.name);
    });

    const grouped = new Map<string, ClientPanelItem[]>();

    for (const item of sortedBaseItems) {
      const sectionKey = item.sectionName?.trim() || "No Category";
      if (!grouped.has(sectionKey)) {
        grouped.set(sectionKey, []);
      }
      grouped.get(sectionKey)?.push(item);
    }

    return grouped;
  }, [items, sections]);

  const getOptionsForBaseItem = (baseItem: ClientPanelItem) => {
    const options = items.filter(
      (item) =>
        item.sourceItemId === baseItem.sourceItemId ||
        item.alternativeToSourceItemId === baseItem.sourceItemId
    );

    return options.sort((a, b) => {
      const aIsBase = String(a.sourceItemId) === String(baseItem.sourceItemId);
      const bIsBase = String(b.sourceItemId) === String(baseItem.sourceItemId);
      if (aIsBase && !bIsBase) return -1;
      if (!aIsBase && bIsBase) return 1;
      return a.name.localeCompare(b.name);
    });
  };

  const sectionSummaries = Array.from(baseItemsBySection.entries()).map(
    ([sectionName, sectionItems]) => {
      const total = sectionItems.reduce((sum, baseItem) => {
        const options = getOptionsForBaseItem(baseItem);
        const baseItemId = String(baseItem.sourceItemId);
        const selectedId =
          localSelection[baseItemId] || getInitialSelectedOption(baseItem, options);
        const selectedOption =
          options.find((option) => String(option.sourceItemId) === selectedId) || baseItem;
        return sum + (selectedOption.totalPrice || 0);
      }, 0);

      return {
        sectionName,
        itemCount: sectionItems.length,
        total,
      };
    }
  );

  const grandTotal = sectionSummaries.reduce((sum, section) => sum + section.total, 0);
  const materialsItemCount = sectionSummaries.reduce(
    (sum, section) => sum + section.itemCount,
    0
  );

  const sectionCards = [
    settings.showShoppingList
      ? { id: "portal-materials", label: "Shopping List", count: materialsItemCount }
      : null,
    settings.showSurveys ? { id: "portal-surveys", label: "Surveys", count: surveys.length } : null,
    settings.showFiles ? { id: "portal-files", label: "Files", count: files.length } : null,
    settings.showMoodboard
      ? { id: "portal-moodboard", label: "Moodboard", count: moodboardFiles.length }
      : null,
    settings.showTasks ? { id: "portal-tasks", label: "Tasks", count: tasks.length } : null,
    settings.showLabor ? { id: "portal-labor", label: "Labor", count: laborItems.length } : null,
    settings.showContacts ? { id: "portal-contacts", label: "Contacts", count: contacts.length } : null,
    settings.showPayments ? { id: "portal-payments", label: "Payments", count: payments.length } : null,
    settings.showApprovals ? { id: "portal-approvals", label: "Approvals", count: approvals.length } : null,
    settings.showBudget
      ? {
          id: "portal-budget",
          label: "Budget",
          count: publicBudgetSummary ? 4 : typeof project?.budget === "number" ? 1 : 0,
        }
      : null,
  ].filter((section): section is { id: string; label: string; count: number } => !!section);

  useEffect(() => {
    if (sectionCards.length === 0) {
      setActiveSectionId(null);
      return;
    }
    setActiveSectionId((current) =>
      current && sectionCards.some((section) => section.id === current)
        ? current
        : sectionCards[0].id
    );
  }, [sectionCards]);

  useEffect(() => {
    if (activeSectionId !== "portal-approvals") return;
    if (!settings.showApprovals) return;
    if (approvals.length === 0) return;

    approvals
      .filter((approval) => approval.status === "sent")
      .forEach((approval) => {
        void markApprovalViewed({
          accessToken,
          approvalId: approval._id,
          respondentName: respondentName.trim() || undefined,
        }).catch(() => undefined);
      });
  }, [accessToken, activeSectionId, approvals, markApprovalViewed, respondentName, settings.showApprovals]);

  const handleDownloadInvoice = async (paymentId: string) => {
    setDownloadingPaymentId(paymentId);
    try {
      const result = await getInvoiceDownloadUrl({
        accessToken,
        installmentId: paymentId as Id<"projectPayments">,
      });
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error("Could not download invoice PDF", {
        description: (error as Error).message,
      });
    } finally {
      setDownloadingPaymentId(null);
    }
  };

  const handleRespondToApproval = async (
    approval: PublicApproval,
    decision: "approved" | "rejected"
  ) => {
    const cleanedRespondentName = respondentName.trim();
    if (!cleanedRespondentName) {
      toast.error(`Please enter who is making the decision for "${approval.title}".`);
      return;
    }

    const approvalId = String(approval._id);
    setRespondingApprovalId(approvalId);
    try {
      if (typeof window !== "undefined") {
        const storageKey = `client-panel-respondent-name:${accessToken}`;
        window.localStorage.setItem(storageKey, cleanedRespondentName);
      }
      await respondToApproval({
        accessToken,
        approvalId: approval._id,
        decision,
        comment: approvalComments[approvalId]?.trim() || null,
        respondentName: cleanedRespondentName,
        respondentKey: respondentKey || undefined,
      });
      toast.success(`Decision recorded for "${approval.title}"`);
    } catch (error) {
      toast.error("Failed to save decision", {
        description: (error as Error).message,
      });
    } finally {
      setRespondingApprovalId(null);
    }
  };

  const handleExportMaterialsPdf = async () => {
    if (!project || sectionSummaries.length === 0) {
      toast.info("No shopping list items available for export.");
      return;
    }

    setIsExportingMaterialsPdf(true);
    try {
      const jsPdfModule = await import("jspdf");
      const jsPDF = jsPdfModule.jsPDF ?? jsPdfModule.default;
      await import("jspdf-autotable");

      const doc = new jsPDF({
        putOnlyUsedFonts: true,
        format: "a4",
        unit: "mm",
      });

      let pdfFontFamily = "helvetica";
      try {
        pdfFontFamily = await ensurePdfUnicodeFont(doc);
      } catch (fontError) {
        console.warn("Could not load Unicode PDF font, falling back to Helvetica:", fontError);
      }
      doc.setFont(pdfFontFamily, "normal");

      addDocumentMeta(doc, {
        title: `Shopping List - ${project.name}`,
        subtitle: `Items: ${Array.from(baseItemsBySection.values()).reduce((sum, itemsInSection) => sum + itemsInSection.length, 0)}`,
        generatedOn: new Date().toLocaleString(),
        fontFamily: pdfFontFamily,
      });

      const includePriceColumn = settings.showPrice;
      const includeSupplierColumn = settings.showSupplier;
      const includeNotesColumn = settings.showNotes;
      const headers = [
        "Section",
        "Material",
        "Qty",
        ...(includePriceColumn ? ["Total"] : []),
        ...(includeSupplierColumn ? ["Supplier"] : []),
        ...(includeNotesColumn ? ["Notes"] : []),
      ];

      const rows = Array.from(baseItemsBySection.entries()).flatMap(
        ([sectionName, sectionItems]) =>
          sectionItems.map((baseItem) => {
            const options = getOptionsForBaseItem(baseItem);
            const baseItemId = String(baseItem.sourceItemId);
            const selectedOptionId =
              localSelection[baseItemId] || getInitialSelectedOption(baseItem, options);
            const selectedOption =
              options.find((option) => String(option.sourceItemId) === selectedOptionId) || baseItem;

            return [
              sectionName,
              selectedOption.name || baseItem.name,
              `${selectedOption.quantity} ${selectedOption.unit || "pcs"}`,
              ...(includePriceColumn ? [formatMoney(selectedOption.totalPrice, currencySymbol)] : []),
              ...(includeSupplierColumn ? [selectedOption.supplier || "-"] : []),
              ...(includeNotesColumn ? [selectedOption.notes || "-"] : []),
            ];
          })
      );

      doc.autoTable({
        head: [headers],
        body: rows,
        startY: 36,
        styles: {
          font: pdfFontFamily,
          fontSize: 8.6,
        },
        headStyles: {
          font: pdfFontFamily,
        },
      });

      if (includePriceColumn) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const finalY = (doc.lastAutoTable?.finalY || 36) + 8;
        doc.setFont(pdfFontFamily, "bold");
        doc.setFontSize(11);
        doc.text(
          `Grand total: ${formatMoney(grandTotal, currencySymbol)}`,
          pageWidth - 18,
          finalY,
          { align: "right" }
        );
      }

      addPageNumbers(doc, pdfFontFamily);
      const dateStamp = new Date().toISOString().slice(0, 10);
      doc.save(`shopping-list-${sanitizeFileName(project.name)}-${dateStamp}.pdf`);
      toast.success("Shopping list PDF exported.");
    } catch (error) {
      console.error("Shopping list PDF export error:", error);
      toast.error("Failed to export shopping list PDF.");
    } finally {
      setIsExportingMaterialsPdf(false);
    }
  };

  const handleSelect = async (baseItem: ClientPanelItem, selectedId: string) => {
    const baseItemId = String(baseItem.sourceItemId);
    const previousValue = localSelection[baseItemId];

    setLocalSelection((prev) => ({ ...prev, [baseItemId]: selectedId }));
    setSavingItemId(baseItemId);

    try {
      await selectAlternative({
        accessToken,
        itemId: baseItem.sourceItemId,
        selectedItemId: selectedId as Id<"shoppingListItems">,
        respondentName: respondentName.trim() || undefined,
      });
      toast.success("Selection saved");
    } catch (error) {
      if (previousValue) {
        setLocalSelection((prev) => ({ ...prev, [baseItemId]: previousValue }));
      } else {
        setLocalSelection((prev) => {
          const next = { ...prev };
          delete next[baseItemId];
          return next;
        });
      }
      toast.error("Failed to save selection", {
        description: (error as Error).message,
      });
    } finally {
      setSavingItemId(null);
    }
  };

  const updateFeedbackDraft = (
    itemId: string,
    update: Partial<MaterialFeedbackDraft>,
    fallback: MaterialFeedbackDraft
  ) => {
    setFeedbackByItem((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || fallback),
        ...update,
      },
    }));
  };

  const handleSetMaterialDecision = async (
    baseItem: ClientPanelItem,
    nextDecision: Exclude<MaterialDecision, null>
  ) => {
    const itemId = String(baseItem.sourceItemId);
    const fallbackDraft: MaterialFeedbackDraft = {
      decision: baseItem.customerDecision ?? null,
      comment: baseItem.customerDecisionComment || "",
    };
    const currentDraft = feedbackByItem[itemId] || fallbackDraft;
    const resolvedDecision = currentDraft.decision === nextDecision ? null : nextDecision;
    const previousDraft = currentDraft;

    updateFeedbackDraft(itemId, { decision: resolvedDecision }, fallbackDraft);
    setSavingFeedbackItemId(itemId);
    try {
      await setItemFeedback({
        accessToken,
        itemId: baseItem.sourceItemId,
        decision: resolvedDecision,
        comment: currentDraft.comment.trim() || null,
        respondentName: respondentName.trim() || undefined,
      });
      toast.success("Customer decision saved");
    } catch (error) {
      setFeedbackByItem((prev) => ({
        ...prev,
        [itemId]: previousDraft,
      }));
      toast.error("Failed to save customer decision", {
        description: (error as Error).message,
      });
    } finally {
      setSavingFeedbackItemId(null);
    }
  };

  const handleSaveMaterialComment = async (baseItem: ClientPanelItem) => {
    const itemId = String(baseItem.sourceItemId);
    const fallbackDraft: MaterialFeedbackDraft = {
      decision: baseItem.customerDecision ?? null,
      comment: baseItem.customerDecisionComment || "",
    };
    const currentDraft = feedbackByItem[itemId] || fallbackDraft;
    const normalizedComment = currentDraft.comment.trim();

    setSavingFeedbackItemId(itemId);
    try {
      await setItemFeedback({
        accessToken,
        itemId: baseItem.sourceItemId,
        decision: currentDraft.decision,
        comment: normalizedComment || null,
        respondentName: respondentName.trim() || undefined,
      });
      setFeedbackByItem((prev) => ({
        ...prev,
        [itemId]: {
          ...currentDraft,
          comment: normalizedComment,
        },
      }));
      toast.success("Comment saved");
    } catch (error) {
      toast.error("Failed to save comment", {
        description: (error as Error).message,
      });
    } finally {
      setSavingFeedbackItemId(null);
    }
  };

  const updateSurveyAnswer = (surveyId: string, questionId: string, value: unknown) => {
    setSurveyAnswers((prev) => ({
      ...prev,
      [surveyId]: {
        ...(prev[surveyId] || {}),
        [questionId]: value,
      },
    }));
  };

  const handleOpenSurvey = (surveyId: string) => {
    setOpenSurveyId((current) => (current === surveyId ? null : surveyId));
    setSurveyStartTimes((prev) =>
      prev[surveyId] ? prev : { ...prev, [surveyId]: Date.now() }
    );
  };

  const handleSubmitPublicSurvey = async (survey: PublicSurvey) => {
    if (!respondentKey) return;
    const cleanedRespondentName = respondentName.trim();
    if (!cleanedRespondentName) {
      toast.error(`Please enter who is answering survey "${survey.title}".`);
      return;
    }

    const surveyId = String(survey._id);
    const answersByQuestionId = surveyAnswers[surveyId] || {};
    const payload: PublicSurveyAnswerPayload[] = [];
    const missingRequired: PublicSurveyQuestion[] = [];
    for (const question of survey.questions) {
      const value = answersByQuestionId[String(question._id)];
      const answer = buildPublicSurveyAnswerPayload(question, value);
      if (answer) {
        payload.push(answer);
        continue;
      }
      if (question.isRequired && question.questionType !== "file") {
        missingRequired.push(question);
      }
    }

    if (missingRequired.length > 0) {
      toast.error("Please answer all required questions", {
        description: `${missingRequired.length} required question${missingRequired.length === 1 ? "" : "s"} missing.`,
      });
      return;
    }

    const metadata: { userAgent?: string; timeSpent?: number } = {};
    if (typeof navigator !== "undefined" && navigator.userAgent) {
      metadata.userAgent = navigator.userAgent;
    }
    const startedAt = surveyStartTimes[surveyId];
    if (startedAt) {
      metadata.timeSpent = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    }

    setSubmittingSurveyId(surveyId);
    try {
      if (typeof window !== "undefined") {
        const storageKey = `client-panel-respondent-name:${accessToken}`;
        window.localStorage.setItem(storageKey, cleanedRespondentName);
      }
      await submitPublicSurvey({
        accessToken,
        surveyId: survey._id,
        respondentKey,
        respondentName: cleanedRespondentName,
        answers: payload,
        metadata,
      });
      toast.success("Survey submitted");
      setOpenSurveyId(null);
      setSurveyAnswers((prev) => {
        const next = { ...prev };
        delete next[surveyId];
        return next;
      });
      setSurveyStartTimes((prev) => {
        const next = { ...prev };
        delete next[surveyId];
        return next;
      });
    } catch (error) {
      toast.error("Could not submit survey", {
        description: (error as Error).message,
      });
    } finally {
      setSubmittingSurveyId(null);
    }
  };

  if (panelData === undefined) {
    return <ClientPanelSkeleton />;
  }

  if (panelData === null || !project) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-xl items-center justify-center px-4 text-center">
        <div>
          <h1 className="mb-2 text-2xl font-semibold">Invalid link</h1>
          <p className="text-muted-foreground">
            This client portal link is invalid or no longer active.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-24 pt-8 sm:px-8">
      <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-[var(--ui-accent-brand)]" />
            <h1 className="text-4xl font-medium tracking-tight font-[var(--font-display-serif)] text-[var(--ui-text-strong)] md:text-5xl">
              Customer Portal
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] px-4 py-2 text-sm font-medium text-[var(--ui-accent-brand)]">
              For project: {project.name}
            </span>
            {settings.showShoppingList &&
            settings.showPrice &&
            activeSectionId === "portal-materials" ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] px-4 py-2 text-sm font-medium text-[var(--ui-text-main)]">
                Total: {formatAmount(grandTotal, currencySymbol)}
              </span>
            ) : null}
          </div>
          <p className="max-w-4xl text-sm text-muted-foreground">
            Use the cards below to switch between portal sections shared by the project team.
          </p>
          {settings.showShoppingList &&
          sectionSummaries.length > 0 &&
          activeSectionId === "portal-materials" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleExportMaterialsPdf()}
              disabled={isExportingMaterialsPdf}
            >
              <Download className="mr-2 h-4 w-4" />
              {isExportingMaterialsPdf ? "Exporting PDF..." : "Export shopping list PDF"}
            </Button>
          ) : null}
          {sectionCards.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {sectionCards.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSectionId(section.id)}
                  className={`rounded-[14px] border px-4 py-3 text-left transition-colors ${
                    activeSectionId === section.id
                      ? "border-[var(--ui-accent-brand)] bg-[var(--ui-surface-soft)]"
                      : "border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] hover:bg-[var(--ui-surface-soft)]"
                  }`}
                >
                  <p className="text-sm font-medium text-[var(--ui-text-strong)]">{section.label}</p>
                  <p className="text-xs text-[var(--ui-text-muted)]">{section.count} items</p>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {panelData.version === 0 ? (
        <div className="mb-8 rounded-[20px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] px-5 py-4 text-sm text-[var(--ui-text-muted)]">
          This portal has not been updated yet. Ask the project team to click Update portal in
          project settings.
        </div>
      ) : null}

      {settings.showFiles && activeSectionId === "portal-files" ? (
        <div className="mb-10 rounded-[24px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-4 shadow-[0_24px_60px_rgba(20,20,20,0.08)] sm:rounded-[32px] sm:p-8">
          <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8 sm:gap-4">
            <h2 className="text-xl font-medium font-[var(--font-display-serif)] text-[var(--ui-text-strong)] sm:text-2xl">
              Files
            </h2>
            <span className="inline-flex items-center justify-center rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] px-3 py-1 text-xs font-medium text-[var(--ui-text-muted)]">
              {files.length} files
            </span>
          </div>
          {files.length === 0 ? (
            <p className="text-sm text-[var(--ui-text-muted)]">No files shared.</p>
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <div
                  key={file._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[var(--ui-border-soft)]/70 bg-[var(--ui-surface-base)] p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--ui-text-strong)]">{file.name}</p>
                    <p className="mt-1 text-xs text-[var(--ui-text-muted)]">
                      {file.fileType} • {formatFileSize(file.size)}
                      {file.folderName ? ` • ${file.folderName}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--ui-border-soft)] text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-soft)] hover:text-[var(--ui-text-main)]"
                      aria-label={`Open ${file.name}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <a
                      href={file.url}
                      download={file.name}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--ui-border-soft)] text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-soft)] hover:text-[var(--ui-text-main)]"
                      aria-label={`Download ${file.name}`}
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {settings.showMoodboard && activeSectionId === "portal-moodboard" ? (
        <>
          <div className="mb-10 rounded-[24px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-4 shadow-[0_24px_60px_rgba(20,20,20,0.08)] sm:rounded-[32px] sm:p-8">
            <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8 sm:gap-4">
              <h2 className="text-xl font-medium font-[var(--font-display-serif)] text-[var(--ui-text-strong)] sm:text-2xl">
                Moodboard
              </h2>
              <span className="inline-flex items-center justify-center rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] px-3 py-1 text-xs font-medium text-[var(--ui-text-muted)]">
                {moodboardFiles.length} items
              </span>
            </div>
            {moodboardFiles.length === 0 ? (
              <p className="text-sm text-[var(--ui-text-muted)]">No moodboard items shared.</p>
            ) : (
              <div className="space-y-12">
                {moodboardSections.map((section) => (
                  <div key={section.sectionId} className="space-y-6">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold tracking-[0.2em] uppercase text-[var(--ui-text-strong)]">
                        {section.sectionLabel}
                      </h3>
                      <span className="inline-flex items-center justify-center rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] px-3 py-1 text-[11px] font-medium text-[var(--ui-text-muted)]">
                        {section.files.length} items
                      </span>
                    </div>

                    <div className="columns-1 sm:columns-2 md:columns-2 lg:columns-3 xl:columns-3 gap-6 space-y-6">
                      {section.files.map((file) => {
                        const isImage = file.mimeType.startsWith("image/");
                        return (
                          <div
                            key={file._id}
                            className="group relative mb-4 break-inside-avoid overflow-hidden rounded-xl border border-[var(--ui-border-soft)]/70 bg-[var(--ui-surface-base)]"
                          >
                            {isImage ? (
                              <button
                                type="button"
                                onClick={() => setSelectedMoodboardFile(file)}
                                className="block w-full"
                                aria-label={`Preview ${file.name}`}
                              >
                                <img
                                  src={file.url}
                                  alt={file.name}
                                  className="w-full h-auto object-contain bg-[var(--ui-surface-soft)] transition-transform duration-300 group-hover:scale-[1.02]"
                                />
                              </button>
                            ) : (
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block rounded-lg border border-[var(--ui-border-soft)]/70 bg-[var(--ui-surface-soft)] p-3 text-xs text-[var(--ui-text-muted)]"
                              >
                                Preview unavailable
                              </a>
                            )}

                            <div className="absolute right-3 top-3 z-10 flex items-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)]/90 text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-soft)] hover:text-[var(--ui-text-main)]"
                                aria-label={`Open ${file.name}`}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                              <a
                                href={file.url}
                                download={file.name}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)]/90 text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-soft)] hover:text-[var(--ui-text-main)]"
                                aria-label={`Download ${file.name}`}
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedMoodboardFile ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
              onClick={() => setSelectedMoodboardFile(null)}
            >
              <div className="max-h-full max-w-6xl" onClick={(event) => event.stopPropagation()}>
                <img
                  src={selectedMoodboardFile.url}
                  alt={selectedMoodboardFile.name}
                  className="max-h-[88vh] w-auto max-w-full object-contain"
                />
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {settings.showSurveys &&
      activeSectionId === "portal-surveys" &&
      respondentKey &&
      publicSurveysData === undefined ? (
        <div className="mb-10 rounded-[24px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] px-5 py-6 text-sm text-[var(--ui-text-muted)]">
          Loading surveys...
        </div>
      ) : null}

      {settings.showSurveys &&
      activeSectionId === "portal-surveys" &&
      publicSurveysData !== undefined ? (
        <div className="mb-10 rounded-[24px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-4 shadow-[0_24px_60px_rgba(20,20,20,0.08)] sm:rounded-[32px] sm:p-8">
          <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8 sm:gap-4">
            <h2 className="text-xl font-medium font-[var(--font-display-serif)] text-[var(--ui-text-strong)] sm:text-2xl">
              Surveys
            </h2>
            <span className="inline-flex items-center justify-center rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] px-3 py-1 text-xs font-medium text-[var(--ui-text-muted)]">
              {surveys.length} available
            </span>
          </div>
          <p className="mb-6 text-sm text-[var(--ui-text-muted)]">
            Share your feedback directly in the portal. Responses are sent to the project team.
          </p>
          {surveys.length === 0 ? (
            <p className="text-sm text-[var(--ui-text-muted)]">No surveys shared.</p>
          ) : (
            <div className="space-y-4">
              {surveys.map((survey) => {
              const surveyId = String(survey._id);
              const isOpen = openSurveyId === surveyId;
              const isSubmitting = submittingSurveyId === surveyId;
              const isLocked = survey.hasSubmitted && !survey.allowMultipleResponses;
              const hasRequiredFileQuestion = survey.questions.some(
                (question) => question.questionType === "file" && question.isRequired
              );
              const answersForSurvey = surveyAnswers[surveyId] || {};

              return (
                <div
                  key={surveyId}
                  className="rounded-[20px] border border-[var(--ui-border-soft)]/70 bg-[var(--ui-surface-base)] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-[var(--ui-accent-brand)]" />
                        <h3 className="text-lg font-medium text-[var(--ui-text-strong)]">{survey.title}</h3>
                        {survey.isRequired ? (
                          <Badge variant="destructive" className="text-[10px]">Required</Badge>
                        ) : null}
                        {survey.hasSubmitted ? (
                          <Badge variant="outline" className="text-[10px]">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Submitted
                          </Badge>
                        ) : null}
                      </div>
                      {survey.description ? (
                        <p className="text-sm text-[var(--ui-text-muted)]">{survey.description}</p>
                      ) : null}
                      <p className="text-xs text-[var(--ui-text-muted)]">
                        {survey.questions.length} question{survey.questions.length === 1 ? "" : "s"}
                        {survey.submittedAt ? ` · last submitted ${new Date(survey.submittedAt).toLocaleString()}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!isLocked ? (
                        <Button
                          type="button"
                          variant={isOpen ? "outline" : "default"}
                          onClick={() => handleOpenSurvey(surveyId)}
                        >
                          {isOpen ? "Hide" : survey.hasSubmitted ? "Submit again" : "Fill survey"}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {isLocked ? (
                    <p className="mt-4 text-sm text-[var(--ui-text-muted)]">
                      You already submitted this survey.
                    </p>
                  ) : null}

                  {isOpen ? (
                    <div className="mt-6 space-y-4 border-t border-[var(--ui-border-soft)] pt-5">
                      <div className="max-w-md space-y-2">
                        <Label htmlFor={`respondent-name-${surveyId}`} className="text-sm font-medium">
                          Who is answering survey "{survey.title}"?
                        </Label>
                        <Input
                          id={`respondent-name-${surveyId}`}
                          value={respondentName}
                          onChange={(event) => setRespondentName(event.target.value)}
                          placeholder="Your name"
                          maxLength={120}
                        />
                      </div>

                      {survey.questions.map((question, index) => {
                        const questionId = String(question._id);
                        const answerValue = answersForSurvey[questionId];
                        return (
                          <div
                            key={questionId}
                            className="rounded-[14px] border border-[var(--ui-border-soft)]/60 bg-[var(--ui-surface-soft)] p-4"
                          >
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">Question {index + 1}</Badge>
                              {question.isRequired ? (
                                <Badge variant="destructive" className="text-[10px]">Required</Badge>
                              ) : null}
                            </div>
                            <p className="mb-3 text-sm font-medium text-[var(--ui-text-strong)]">
                              {question.questionText}
                            </p>

                            {(question.questionType === "text_short" || question.questionType === "text_long") ? (
                              question.questionType === "text_long" ? (
                                <Textarea
                                  value={typeof answerValue === "string" ? answerValue : ""}
                                  onChange={(event) =>
                                    updateSurveyAnswer(surveyId, questionId, event.target.value)
                                  }
                                  placeholder="Your answer"
                                  rows={4}
                                />
                              ) : (
                                <Input
                                  value={typeof answerValue === "string" ? answerValue : ""}
                                  onChange={(event) =>
                                    updateSurveyAnswer(surveyId, questionId, event.target.value)
                                  }
                                  placeholder="Your answer"
                                />
                              )
                            ) : null}

                            {question.questionType === "single_choice" ? (
                              <RadioGroup
                                value={typeof answerValue === "string" ? answerValue : ""}
                                onValueChange={(value) => updateSurveyAnswer(surveyId, questionId, value)}
                                className="space-y-2"
                              >
                                {(question.options || []).map((option) => (
                                  <div key={option} className="flex items-center space-x-2">
                                    <RadioGroupItem value={option} id={`${questionId}-${option}`} />
                                    <Label htmlFor={`${questionId}-${option}`}>{option}</Label>
                                  </div>
                                ))}
                              </RadioGroup>
                            ) : null}

                            {question.questionType === "multiple_choice" ? (
                              <div className="space-y-2">
                                {(question.options || []).map((option) => {
                                  const selectedValues = Array.isArray(answerValue)
                                    ? answerValue.filter((value): value is string => typeof value === "string")
                                    : [];
                                  const checked = selectedValues.includes(option);
                                  return (
                                    <div key={option} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`${questionId}-${option}`}
                                        checked={checked}
                                        onCheckedChange={(nextChecked) => {
                                          const nextValues = nextChecked
                                            ? [...selectedValues, option]
                                            : selectedValues.filter((value) => value !== option);
                                          updateSurveyAnswer(surveyId, questionId, nextValues);
                                        }}
                                      />
                                      <Label htmlFor={`${questionId}-${option}`}>{option}</Label>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}

                            {question.questionType === "rating" ? (
                              <RadioGroup
                                value={typeof answerValue === "number" ? String(answerValue) : ""}
                                onValueChange={(value) =>
                                  updateSurveyAnswer(surveyId, questionId, Number.parseInt(value, 10))
                                }
                                className="space-y-2"
                              >
                                <div className="flex items-center justify-between text-xs text-[var(--ui-text-muted)]">
                                  <span>{question.ratingScale?.minLabel || question.ratingScale?.min || 1}</span>
                                  <span>{question.ratingScale?.maxLabel || question.ratingScale?.max || 5}</span>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                  {Array.from(
                                    { length: (question.ratingScale?.max || 5) - (question.ratingScale?.min || 1) + 1 },
                                    (_, i) => (question.ratingScale?.min || 1) + i
                                  ).map((value) => (
                                    <div key={value} className="flex items-center gap-2">
                                      <RadioGroupItem value={String(value)} id={`${questionId}-${value}`} />
                                      <Label htmlFor={`${questionId}-${value}`}>{value}</Label>
                                    </div>
                                  ))}
                                </div>
                              </RadioGroup>
                            ) : null}

                            {question.questionType === "yes_no" ? (
                              <RadioGroup
                                value={typeof answerValue === "boolean" ? String(answerValue) : ""}
                                onValueChange={(value) => updateSurveyAnswer(surveyId, questionId, value === "true")}
                                className="space-y-2"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="true" id={`${questionId}-yes`} />
                                  <Label htmlFor={`${questionId}-yes`}>Yes</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="false" id={`${questionId}-no`} />
                                  <Label htmlFor={`${questionId}-no`}>No</Label>
                                </div>
                              </RadioGroup>
                            ) : null}

                            {question.questionType === "number" ? (
                              <Input
                                type="number"
                                value={typeof answerValue === "number" ? String(answerValue) : ""}
                                onChange={(event) => {
                                  const raw = event.target.value;
                                  if (raw.trim() === "") {
                                    updateSurveyAnswer(surveyId, questionId, undefined);
                                    return;
                                  }
                                  const parsed = Number.parseFloat(raw);
                                  updateSurveyAnswer(
                                    surveyId,
                                    questionId,
                                    Number.isNaN(parsed) ? undefined : parsed
                                  );
                                }}
                                placeholder="Enter number"
                              />
                            ) : null}

                            {question.questionType === "file" ? (
                              <p className="text-xs text-[var(--ui-text-muted)]">
                                File uploads are not available in the public portal yet.
                              </p>
                            ) : null}
                          </div>
                        );
                      })}

                      {hasRequiredFileQuestion ? (
                        <p className="text-xs text-red-600">
                          This survey has required file upload questions and cannot be submitted in the public portal.
                        </p>
                      ) : null}

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          onClick={() => void handleSubmitPublicSurvey(survey)}
                          disabled={isSubmitting || hasRequiredFileQuestion}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          {isSubmitting ? "Submitting..." : "Submit survey"}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
              })}
            </div>
          )}
        </div>
      ) : null}

      {settings.showTasks && activeSectionId === "portal-tasks" ? (
        <div className="mb-10 rounded-[24px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-4 shadow-[0_24px_60px_rgba(20,20,20,0.08)] sm:rounded-[32px] sm:p-8">
          <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8 sm:gap-4">
            <h2 className="text-xl font-medium font-[var(--font-display-serif)] text-[var(--ui-text-strong)] sm:text-2xl">
              Tasks
            </h2>
            <span className="inline-flex items-center justify-center rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] px-3 py-1 text-xs font-medium text-[var(--ui-text-muted)]">
              {tasks.length} items
            </span>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-[var(--ui-text-muted)]">No tasks shared.</p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task._id}
                  className="rounded-[16px] border border-[var(--ui-border-soft)]/70 bg-[var(--ui-surface-base)] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-[var(--ui-accent-brand)]" />
                    <p className="text-sm font-medium text-[var(--ui-text-strong)]">{task.title}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {formatTaskStatus(task.status)}
                    </Badge>
                    {task.priority ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {task.priority.toUpperCase()}
                      </Badge>
                    ) : null}
                  </div>
                  {task.description ? (
                    <p className="mt-2 text-sm text-[var(--ui-text-muted)]">{task.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-[var(--ui-text-muted)]">
                    Start: {formatPortalDate(task.startDate)} · End: {formatPortalDate(task.endDate)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {settings.showLabor && activeSectionId === "portal-labor" ? (
        <div className="mb-10 rounded-[24px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-4 shadow-[0_24px_60px_rgba(20,20,20,0.08)] sm:rounded-[32px] sm:p-8">
          <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8 sm:gap-4">
            <h2 className="text-xl font-medium font-[var(--font-display-serif)] text-[var(--ui-text-strong)] sm:text-2xl">
              Labor
            </h2>
            <span className="inline-flex items-center justify-center rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] px-3 py-1 text-xs font-medium text-[var(--ui-text-muted)]">
              {laborItems.length} items
            </span>
          </div>
          {laborItems.length === 0 ? (
            <p className="text-sm text-[var(--ui-text-muted)]">No labor entries shared.</p>
          ) : (
            <div className="space-y-3">
              {laborItems.map((item) => (
                <div
                  key={item._id}
                  className="rounded-[16px] border border-[var(--ui-border-soft)]/70 bg-[var(--ui-surface-base)] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Wrench className="h-4 w-4 text-[var(--ui-accent-brand)]" />
                    <p className="text-sm font-medium text-[var(--ui-text-strong)]">{item.name}</p>
                  </div>
                  <p className="mt-2 text-sm text-[var(--ui-text-main)]">
                    Qty: {item.quantity} {item.unit}
                    {settings.showPrice && item.totalPrice !== undefined
                      ? ` · Total: ${formatAmount(item.totalPrice, currencySymbol)}`
                      : ""}
                  </p>
                  {item.notes ? (
                    <p className="mt-2 text-sm text-[var(--ui-text-muted)]">{item.notes}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-[var(--ui-text-muted)]">
                    Start: {formatPortalDate(item.startDate)} · End: {formatPortalDate(item.endDate)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {settings.showContacts && activeSectionId === "portal-contacts" ? (
        <div className="mb-10 rounded-[24px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-4 shadow-[0_24px_60px_rgba(20,20,20,0.08)] sm:rounded-[32px] sm:p-8">
          <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8 sm:gap-4">
            <h2 className="text-xl font-medium font-[var(--font-display-serif)] text-[var(--ui-text-strong)] sm:text-2xl">
              Contacts
            </h2>
            <span className="inline-flex items-center justify-center rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] px-3 py-1 text-xs font-medium text-[var(--ui-text-muted)]">
              {contacts.length} items
            </span>
          </div>
          {contacts.length === 0 ? (
            <p className="text-sm text-[var(--ui-text-muted)]">No contacts shared.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {contacts.map((contact) => (
                <div
                  key={contact._id}
                  className="rounded-[16px] border border-[var(--ui-border-soft)]/70 bg-[var(--ui-surface-base)] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Users className="h-4 w-4 text-[var(--ui-accent-brand)]" />
                    <p className="text-sm font-medium text-[var(--ui-text-strong)]">{contact.name}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {contact.type.toUpperCase()}
                    </Badge>
                  </div>
                  {contact.companyName ? (
                    <p className="mt-2 text-sm text-[var(--ui-text-main)]">{contact.companyName}</p>
                  ) : null}
                  {(contact.email || contact.phone) ? (
                    <p className="mt-2 text-xs text-[var(--ui-text-muted)]">
                      {contact.email || "-"}
                      {contact.phone ? ` · ${contact.phone}` : ""}
                    </p>
                  ) : null}
                  {contact.projectRole ? (
                    <p className="mt-2 text-xs text-[var(--ui-text-muted)]">
                      Role: {contact.projectRole}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {settings.showApprovals && activeSectionId === "portal-approvals" ? (
        <div className="mb-10 rounded-[24px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-4 shadow-[0_24px_60px_rgba(20,20,20,0.08)] sm:rounded-[32px] sm:p-8">
          <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8 sm:gap-4">
            <h2 className="text-xl font-medium font-[var(--font-display-serif)] text-[var(--ui-text-strong)] sm:text-2xl">
              Approvals
            </h2>
            <span className="inline-flex items-center justify-center rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] px-3 py-1 text-xs font-medium text-[var(--ui-text-muted)]">
              {approvals.length} requests
            </span>
          </div>

          {approvals.length === 0 ? (
            <p className="text-sm text-[var(--ui-text-muted)]">No approval requests shared yet.</p>
          ) : (
            <div className="space-y-5">
              <div className="max-w-md space-y-2">
                <Label htmlFor="approval-respondent-name" className="text-sm font-medium">
                  Who is reviewing approvals?
                </Label>
                <Input
                  id="approval-respondent-name"
                  value={respondentName}
                  onChange={(event) => setRespondentName(event.target.value)}
                  placeholder="Your name"
                />
              </div>

              {approvals.map((approval) => {
                const approvalId = String(approval._id);
                const canDecide =
                  approval.status === "sent" ||
                  approval.status === "viewed" ||
                  approval.status === "commented";

                return (
                  <div
                    key={approvalId}
                    className="rounded-[20px] border border-[var(--ui-border-soft)]/70 bg-[var(--ui-surface-base)] p-5"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{approvalTypeLabel(approval.type)}</Badge>
                          <Badge
                            variant="outline"
                            className={
                              approval.status === "approved"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : approval.status === "rejected"
                                  ? "border-rose-200 bg-rose-50 text-rose-700"
                                  : approval.status === "commented"
                                    ? "border-amber-200 bg-amber-50 text-amber-700"
                                    : "border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] text-[var(--ui-text-main)]"
                            }
                          >
                            {approval.status.toUpperCase()}
                          </Badge>
                          <Badge variant="secondary">v{approval.currentVersion}</Badge>
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-[var(--ui-text-strong)]">{approval.title}</h3>
                          {approval.description ? (
                            <p className="mt-1 text-sm text-[var(--ui-text-muted)]">{approval.description}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="shrink-0 text-sm text-[var(--ui-text-muted)]">
                        {approval.dueDate
                          ? `Decision deadline: ${new Date(approval.dueDate).toLocaleDateString()}`
                          : "No deadline"}
                      </div>
                    </div>

                    {approval.currentVersionRecord?.summary ? (
                      <div className="mt-4 rounded-[16px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] px-4 py-3 text-sm text-[var(--ui-text-main)]">
                        {approval.currentVersionRecord.summary}
                      </div>
                    ) : null}

                    {approval.currentVersionRecord?.details ? (
                      <p className="mt-4 text-sm text-[var(--ui-text-muted)]">
                        {approval.currentVersionRecord.details}
                      </p>
                    ) : null}

                    {approval.currentVersionRecord?.items?.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {approval.currentVersionRecord.items.map((item) => (
                          <Badge key={item} variant="secondary">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    {canDecide ? (
                      <div className="mt-5 space-y-3 border-t border-[var(--ui-border-soft)] pt-4">
                        <div className="space-y-2">
                          <Label htmlFor={`approval-comment-${approvalId}`}>Comment for the project team</Label>
                          <Textarea
                            id={`approval-comment-${approvalId}`}
                            value={approvalComments[approvalId] || ""}
                            onChange={(event) =>
                              setApprovalComments((current) => ({
                                ...current,
                                [approvalId]: event.target.value,
                              }))
                            }
                            rows={3}
                            placeholder="Add context, constraints or conditions for your decision..."
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            onClick={() => void handleRespondToApproval(approval, "approved")}
                            disabled={respondingApprovalId === approvalId}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {respondingApprovalId === approvalId ? "Saving..." : "Approve"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void handleRespondToApproval(approval, "rejected")}
                            disabled={respondingApprovalId === approvalId}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {!canDecide && approval.clientDecision ? (
                      <div className="mt-5 rounded-[16px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] px-4 py-3 text-sm text-[var(--ui-text-main)]">
                        <div className="flex items-center gap-2 font-medium">
                          {approval.clientDecision === "approved" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-rose-600" />
                          )}
                          Decision: {approval.clientDecision}
                        </div>
                        <p className="mt-2 text-[var(--ui-text-muted)]">
                          By {approval.clientRespondentName || "client"}
                          {approval.decidedAt ? ` on ${new Date(approval.decidedAt).toLocaleString()}` : ""}
                        </p>
                        {approval.clientComment ? (
                          <p className="mt-3">{approval.clientComment}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {settings.showBudget && activeSectionId === "portal-budget" ? (
        <div className="mb-10 rounded-[24px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-4 shadow-[0_24px_60px_rgba(20,20,20,0.08)] sm:rounded-[32px] sm:p-8">
          <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8 sm:gap-4">
            <h2 className="text-xl font-medium font-[var(--font-display-serif)] text-[var(--ui-text-strong)] sm:text-2xl">
              Budget
            </h2>
          </div>
          {publicBudgetSummary ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[16px] border border-[var(--ui-border-soft)]/70 bg-[var(--ui-surface-base)] p-5">
                  <p className="text-sm text-[var(--ui-text-muted)]">Budget</p>
                  <div className="mt-2 flex items-center gap-3">
                    <Banknote className="h-5 w-5 text-[var(--ui-accent-brand)]" />
                    <p className="text-xl font-medium font-[var(--font-display-serif)] text-[var(--ui-text-strong)]">
                      {formatAmount(publicBudgetSummary.budget, currencySymbol)}
                    </p>
                  </div>
                </div>
                <div className="rounded-[16px] border border-[var(--ui-border-soft)]/70 bg-[var(--ui-surface-base)] p-5">
                  <p className="text-sm text-[var(--ui-text-muted)]">Planned cost</p>
                  <p className="mt-2 text-xl font-medium font-[var(--font-display-serif)] text-[var(--ui-text-strong)]">
                    {formatAmount(publicBudgetSummary.plannedCost, currencySymbol)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--ui-text-muted)]">
                    {publicBudgetSummary.projectedUtilizationPercent ?? 0}% of budget
                  </p>
                </div>
                <div className="rounded-[16px] border border-[var(--ui-border-soft)]/70 bg-[var(--ui-surface-base)] p-5">
                  <p className="text-sm text-[var(--ui-text-muted)]">Committed cost</p>
                  <p className="mt-2 text-xl font-medium font-[var(--font-display-serif)] text-[var(--ui-text-strong)]">
                    {formatAmount(publicBudgetSummary.committedCost, currencySymbol)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--ui-text-muted)]">
                    Approved and scheduled spend
                  </p>
                </div>
                <div className="rounded-[16px] border border-[var(--ui-border-soft)]/70 bg-[var(--ui-surface-base)] p-5">
                  <p className="text-sm text-[var(--ui-text-muted)]">Actual cost</p>
                  <p className="mt-2 text-xl font-medium font-[var(--font-display-serif)] text-[var(--ui-text-strong)]">
                    {formatAmount(publicBudgetSummary.actualCost, currencySymbol)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--ui-text-muted)]">
                    {publicBudgetSummary.utilizationPercent ?? 0}% of budget used
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[18px] border border-[var(--ui-border-soft)]/70 bg-[var(--ui-surface-base)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-medium text-[var(--ui-text-strong)]">
                        Budget balance
                      </p>
                      <p className="mt-1 text-sm text-[var(--ui-text-muted)]">
                        Remaining budget against actual and projected spending.
                      </p>
                    </div>
                    <div
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                        publicBudgetSummary.variance < 0
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {publicBudgetSummary.variance < 0 ? "Over budget" : "Within budget"}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[14px] bg-[var(--ui-surface-soft)] px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">
                        Remaining now
                      </p>
                      <p className="mt-2 text-lg font-medium text-[var(--ui-text-strong)]">
                        {formatAmount(publicBudgetSummary.variance, currencySymbol)}
                      </p>
                    </div>
                    <div className="rounded-[14px] bg-[var(--ui-surface-soft)] px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">
                        Projected remaining
                      </p>
                      <p className="mt-2 text-lg font-medium text-[var(--ui-text-strong)]">
                        {formatAmount(publicBudgetSummary.projectedVariance, currencySymbol)}
                      </p>
                    </div>
                  </div>
                  {publicBudgetSummary.alerts.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {publicBudgetSummary.alerts.map((alert) => (
                        <span
                          key={alert.label}
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                            alert.severity === "high"
                              ? "border-rose-200 bg-rose-50 text-rose-700"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                          }`}
                        >
                          {alert.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-[var(--ui-text-muted)]">
                      No active budget alerts.
                    </p>
                  )}
                </div>

                <div className="rounded-[18px] border border-[var(--ui-border-soft)]/70 bg-[var(--ui-surface-base)] p-5">
                  <p className="text-base font-medium text-[var(--ui-text-strong)]">
                    Revenue and collections
                  </p>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[var(--ui-text-muted)]">Accepted estimations</span>
                      <span className="font-medium text-[var(--ui-text-strong)]">
                        {formatAmount(publicBudgetSummary.revenue.acceptedEstimations, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[var(--ui-text-muted)]">Scheduled payments</span>
                      <span className="font-medium text-[var(--ui-text-strong)]">
                        {formatAmount(publicBudgetSummary.revenue.scheduledPayments, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[var(--ui-text-muted)]">Collected payments</span>
                      <span className="font-medium text-[var(--ui-text-strong)]">
                        {formatAmount(publicBudgetSummary.revenue.collectedPayments, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[var(--ui-text-muted)]">Outstanding payments</span>
                      <span className="font-medium text-[var(--ui-text-strong)]">
                        {formatAmount(publicBudgetSummary.revenue.outstandingPayments, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[var(--ui-text-muted)]">Milestone allocation</span>
                      <span className="font-medium text-[var(--ui-text-strong)]">
                        {formatAmount(publicBudgetSummary.milestones.budgetAllocated, currencySymbol)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[18px] border border-[var(--ui-border-soft)]/70 bg-[var(--ui-surface-base)] p-5">
                  <p className="text-base font-medium text-[var(--ui-text-strong)]">Materials</p>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[var(--ui-text-muted)]">Planned</span>
                      <span className="font-medium text-[var(--ui-text-strong)]">
                        {formatAmount(publicBudgetSummary.breakdown.shopping.planned, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[var(--ui-text-muted)]">Committed</span>
                      <span className="font-medium text-[var(--ui-text-strong)]">
                        {formatAmount(publicBudgetSummary.breakdown.shopping.committed, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[var(--ui-text-muted)]">Actual</span>
                      <span className="font-medium text-[var(--ui-text-strong)]">
                        {formatAmount(publicBudgetSummary.breakdown.shopping.actual, currencySymbol)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[18px] border border-[var(--ui-border-soft)]/70 bg-[var(--ui-surface-base)] p-5">
                  <p className="text-base font-medium text-[var(--ui-text-strong)]">Labor</p>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[var(--ui-text-muted)]">Planned</span>
                      <span className="font-medium text-[var(--ui-text-strong)]">
                        {formatAmount(publicBudgetSummary.breakdown.labor.planned, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[var(--ui-text-muted)]">Committed</span>
                      <span className="font-medium text-[var(--ui-text-strong)]">
                        {formatAmount(publicBudgetSummary.breakdown.labor.committed, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[var(--ui-text-muted)]">Actual</span>
                      <span className="font-medium text-[var(--ui-text-strong)]">
                        {formatAmount(publicBudgetSummary.breakdown.labor.actual, currencySymbol)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : typeof project?.budget === "number" ? (
            <div className="rounded-[16px] border border-[var(--ui-border-soft)]/70 bg-[var(--ui-surface-base)] p-6">
              <p className="mb-2 text-sm text-[var(--ui-text-muted)]">Project budget</p>
              <div className="flex items-center gap-3">
                <Banknote className="h-5 w-5 text-[var(--ui-accent-brand)]" />
                <p className="text-2xl font-medium font-[var(--font-display-serif)] text-[var(--ui-text-strong)]">
                  {formatAmount(project.budget, currencySymbol)}
                </p>
              </div>
              <p className="mt-3 text-sm text-[var(--ui-text-muted)]">
                Detailed project finance summary is not available yet.
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--ui-text-muted)]">No budget set for this project.</p>
          )}
        </div>
      ) : null}

      {settings.showPayments && activeSectionId === "portal-payments" ? (
        <div className="mb-10 rounded-[24px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-4 shadow-[0_24px_60px_rgba(20,20,20,0.08)] sm:rounded-[32px] sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8 sm:gap-4">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <h2 className="text-xl font-medium font-[var(--font-display-serif)] text-[var(--ui-text-strong)] sm:text-2xl">
                Payments
              </h2>
              <span className="inline-flex items-center justify-center rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] px-3 py-1 text-xs font-medium text-[var(--ui-text-muted)]">
                {payments.length} installments
              </span>
            </div>
          </div>

          {payments.length === 0 ? (
            <p className="text-sm text-[var(--ui-text-muted)]">No installments shared yet.</p>
          ) : (
            <div className="space-y-4">
              {payments.map((payment) => (
                <div
                  key={payment._id}
                  className="rounded-[18px] border border-[var(--ui-border-soft)]/70 bg-[var(--ui-surface-base)] p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Wallet className="h-4 w-4 text-[var(--ui-accent-brand)]" />
                        <p className="text-base font-medium text-[var(--ui-text-strong)]">
                          {payment.title}
                        </p>
                        <span
                          className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-[10px] font-medium ${
                            payment.status === "paid"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : payment.isOverdue
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : "border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] text-[var(--ui-text-main)]"
                          }`}
                        >
                          {payment.isOverdue ? "OVERDUE" : payment.status.toUpperCase()}
                        </span>
                        {payment.invoiceNumber ? (
                          <span className="text-xs text-[var(--ui-text-muted)]">
                            #{payment.invoiceNumber}
                          </span>
                        ) : null}
                      </div>
                      {payment.description ? (
                        <p className="text-sm text-[var(--ui-text-muted)]">{payment.description}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-4 text-sm text-[var(--ui-text-main)]">
                        <span>{formatAmount(payment.amount, currencySymbol)}</span>
                        <span>
                          {payment.dueDate
                            ? `Due ${new Date(payment.dueDate).toLocaleDateString()}`
                            : "No due date"}
                        </span>
                        {payment.paidAt ? (
                          <span>Paid {new Date(payment.paidAt).toLocaleDateString()}</span>
                        ) : null}
                      </div>
                      {payment.paymentReference ? (
                        <p className="text-sm text-[var(--ui-text-muted)]">
                          Transfer reference:{" "}
                          <span className="font-medium text-[var(--ui-text-main)]">
                            {payment.paymentReference}
                          </span>
                        </p>
                      ) : null}
                      {(payment.bankAccountNumber || payment.bankName) ? (
                        <div className="rounded-[16px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] px-4 py-3 text-sm text-[var(--ui-text-main)]">
                          <p className="font-medium">
                            {payment.bankAccountHolder || "Bank transfer details"}
                          </p>
                          {payment.bankName ? (
                            <p className="text-[var(--ui-text-muted)]">{payment.bankName}</p>
                          ) : null}
                          {payment.bankAccountNumber ? (
                            <p className="mt-1 font-medium tracking-[0.02em]">
                              {payment.bankAccountNumber}
                            </p>
                          ) : null}
                          {payment.bankSwift ? (
                            <p className="text-[var(--ui-text-muted)]">SWIFT: {payment.bankSwift}</p>
                          ) : null}
                          {payment.paymentInstructions ? (
                            <p className="mt-2 text-[var(--ui-text-muted)]">
                              {payment.paymentInstructions}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    {payment.hasInvoicePdf ? (
                      <Button
                        type="button"
                        size="sm"
                        variant={payment.status === "paid" ? "outline" : "default"}
                        onClick={() => void handleDownloadInvoice(payment._id)}
                        disabled={downloadingPaymentId === payment._id}
                      >
                        {payment.status === "paid" ? (
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        {downloadingPaymentId === payment._id
                          ? "Opening..."
                          : payment.status === "paid"
                            ? "Download invoice"
                            : "Download PDF"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {settings.showShoppingList && activeSectionId === "portal-materials" ? (
        <div>
          {sectionSummaries.length === 0 ? (
            <div className="rounded-[24px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-8 text-center text-sm text-[var(--ui-text-muted)]">
              No shopping items available yet.
            </div>
          ) : (
            sectionSummaries.map(({ sectionName, itemCount, total }) => {
              const sectionItems = baseItemsBySection.get(sectionName) || [];

              return (
                <div
                  key={sectionName}
                  className="mb-10 rounded-[24px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-4 shadow-[0_24px_60px_rgba(20,20,20,0.08)] sm:rounded-[32px] sm:p-8"
                >
                  <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8 sm:gap-4">
                    <h2 className="text-xl font-medium font-[var(--font-display-serif)] text-[var(--ui-text-strong)] sm:text-2xl">
                      {sectionName}
                    </h2>
                    <span className="inline-flex items-center justify-center rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] px-3 py-1 text-xs font-medium text-[var(--ui-text-muted)]">
                      {itemCount} items
                    </span>
                    {settings.showPrice ? (
                      <span className="inline-flex items-center justify-center rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] px-3 py-1 text-xs font-medium text-[var(--ui-text-main)]">
                        {formatAmount(total, currencySymbol)}
                      </span>
                    ) : null}
                  </div>

                  <div className="space-y-4">
                    {sectionItems.map((baseItem) => {
                      const options = getOptionsForBaseItem(baseItem);
                      const hasAlternatives = options.length > 1;
                      const baseItemId = String(baseItem.sourceItemId);
                      const selectedOptionId =
                        localSelection[baseItemId] || getInitialSelectedOption(baseItem, options);
                      const selectedOption =
                        options.find((option) => String(option.sourceItemId) === selectedOptionId) ||
                        baseItem;
                      const feedbackDraft = feedbackByItem[baseItemId] || {
                        decision: baseItem.customerDecision ?? null,
                        comment: baseItem.customerDecisionComment || "",
                      };
                      const statusLabel = getStatusLabel(
                        selectedOption.realizationStatus || baseItem.realizationStatus
                      );

                      return (
                        <div
                          key={baseItemId}
                          className="group relative rounded-[20px] border border-[var(--ui-border-soft)]/50 bg-[var(--ui-surface-base)] p-5 transition-all hover:border-[var(--ui-border-soft)] hover:shadow-sm"
                        >
                          {hasAlternatives ? (
                            <div className="space-y-3">
                              <div className="rounded-md border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] px-3 py-2">
                                <p className="text-sm font-medium text-[var(--ui-text-strong)]">Choose:</p>
                                <p className="text-xs text-[var(--ui-text-muted)]">
                                  Select one option for this item.
                                </p>
                              </div>
                              <RadioGroup
                                value={selectedOptionId}
                                onValueChange={(value) => void handleSelect(baseItem, value)}
                                className="space-y-3"
                              >
                                {options.map((option) => {
                                  const optionId = String(option.sourceItemId);
                                  const isSelected = optionId === selectedOptionId;
                                  const optionStatusLabel = getStatusLabel(option.realizationStatus);
                                  const optionImage = option.imageUrl || baseItem.imageUrl;

                                  return (
                                    <div
                                      key={optionId}
                                      className={`rounded-[16px] border p-4 transition-all ${
                                        isSelected
                                          ? "border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)]"
                                          : "border-[var(--ui-border-soft)]/70 bg-[var(--ui-surface-base)]"
                                      }`}
                                    >
                                      <div className="flex items-start gap-3">
                                        <RadioGroupItem id={`${baseItemId}-${optionId}`} value={optionId} className="mt-1" />
                                        <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
                                          <div className="flex min-w-0 flex-1 items-start gap-4">
                                            <ItemImage imageUrl={optionImage} name={option.name} />
                                            <div className="min-w-0 flex-1 py-1">
                                              <Label
                                                htmlFor={`${baseItemId}-${optionId}`}
                                                className="cursor-pointer break-words text-lg font-medium text-[var(--ui-text-strong)]"
                                              >
                                                {option.name}
                                              </Label>
                                              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[var(--ui-text-main)]">
                                                <span className="rounded-md border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] px-2 py-0.5 text-xs font-medium">
                                                  {getQtyLabel(option)}
                                                </span>
                                                {settings.showPrice && option.unitPrice !== undefined ? (
                                                  <span className="text-[var(--ui-text-muted)]">
                                                    {formatAmount(option.unitPrice, currencySymbol)} / unit
                                                  </span>
                                                ) : null}
                                                {settings.showPrice && option.totalPrice !== undefined ? (
                                                  <span className="font-medium">
                                                    Total: {formatAmount(option.totalPrice, currencySymbol)}
                                                  </span>
                                                ) : null}
                                                {settings.showSupplier && option.supplier ? (
                                                  <span>Supplier: {option.supplier}</span>
                                                ) : null}
                                              </div>
                                              {settings.showNotes && option.notes ? (
                                                <p className="mt-2 text-sm text-[var(--ui-text-muted)]">{option.notes}</p>
                                              ) : null}
                                            </div>
                                          </div>
                                          <div className="flex shrink-0 items-center gap-2">
                                            <span className="h-2 w-2 rounded-full bg-[var(--ui-priority-medium)]" />
                                            {optionStatusLabel ? (
                                              <span className="inline-flex items-center justify-center rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] px-3 py-1 text-xs font-medium text-[var(--ui-text-main)]">
                                                {optionStatusLabel}
                                              </span>
                                            ) : null}
                                            {option.productLink ? (
                                              <a
                                                href={option.productLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-soft)] hover:text-[var(--ui-text-main)]"
                                              >
                                                <ExternalLink className="h-4 w-4" />
                                              </a>
                                            ) : null}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </RadioGroup>
                            </div>
                          ) : (
                            <div className="flex min-w-0 items-start justify-between gap-4">
                              <div className="flex min-w-0 flex-1 items-start gap-4">
                                <ItemImage
                                  imageUrl={selectedOption.imageUrl || baseItem.imageUrl}
                                  name={selectedOption.name || baseItem.name}
                                />
                                <div className="min-w-0 flex-1 py-1">
                                  <h3 className="break-words text-lg font-medium text-[var(--ui-text-strong)]">
                                    {selectedOption.name || baseItem.name}
                                  </h3>
                                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[var(--ui-text-main)]">
                                    <span className="rounded-md border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] px-2 py-0.5 text-xs font-medium">
                                      {getQtyLabel(selectedOption)}
                                    </span>
                                    {settings.showPrice && selectedOption.unitPrice !== undefined ? (
                                      <span className="text-[var(--ui-text-muted)]">
                                        {formatAmount(selectedOption.unitPrice, currencySymbol)} / unit
                                      </span>
                                    ) : null}
                                    {settings.showPrice && selectedOption.totalPrice !== undefined ? (
                                      <span className="font-medium">
                                        Total: {formatAmount(selectedOption.totalPrice, currencySymbol)}
                                      </span>
                                    ) : null}
                                    {settings.showSupplier && selectedOption.supplier ? (
                                      <span>Supplier: {selectedOption.supplier}</span>
                                    ) : null}
                                  </div>
                                  {settings.showNotes && selectedOption.notes ? (
                                    <p className="mt-2 text-sm text-[var(--ui-text-muted)]">{selectedOption.notes}</p>
                                  ) : null}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-[var(--ui-priority-medium)]" />
                                {statusLabel ? (
                                  <span className="inline-flex items-center justify-center rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] px-3 py-1 text-xs font-medium text-[var(--ui-text-main)]">
                                    {statusLabel}
                                  </span>
                                ) : null}
                                {selectedOption.productLink ? (
                                  <a
                                    href={selectedOption.productLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-soft)] hover:text-[var(--ui-text-main)]"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          )}

                          <div className="mt-4 rounded-[14px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="text-sm font-medium text-[var(--ui-text-strong)]">
                                Customer decision
                              </p>
                              <span
                                className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-medium ${
                                  feedbackDraft.decision === "accepted"
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                    : feedbackDraft.decision === "rejected"
                                      ? "border-rose-300 bg-rose-50 text-rose-700"
                                      : "border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] text-[var(--ui-text-muted)]"
                                }`}
                              >
                                {getMaterialDecisionLabel(feedbackDraft.decision)}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={
                                  feedbackDraft.decision === "accepted" ? "default" : "outline"
                                }
                                onClick={() => void handleSetMaterialDecision(baseItem, "accepted")}
                                disabled={savingFeedbackItemId === baseItemId}
                              >
                                Accept
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={
                                  feedbackDraft.decision === "rejected" ? "destructive" : "outline"
                                }
                                onClick={() => void handleSetMaterialDecision(baseItem, "rejected")}
                                disabled={savingFeedbackItemId === baseItemId}
                              >
                                Reject
                              </Button>
                            </div>
                            <div className="mt-3 space-y-2">
                              <Label
                                htmlFor={`comment-${baseItemId}`}
                                className="text-xs text-[var(--ui-text-muted)]"
                              >
                                Comment
                              </Label>
                              <Textarea
                                id={`comment-${baseItemId}`}
                                value={feedbackDraft.comment}
                                onChange={(event) =>
                                  updateFeedbackDraft(
                                    baseItemId,
                                    { comment: event.target.value },
                                    {
                                      decision: baseItem.customerDecision ?? null,
                                      comment: baseItem.customerDecisionComment || "",
                                    }
                                  )
                                }
                                placeholder="Add a comment for the project team..."
                                rows={3}
                                maxLength={2000}
                              />
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs text-[var(--ui-text-muted)]">
                                  {baseItem.customerDecisionUpdatedAt
                                    ? `Last update: ${new Date(baseItem.customerDecisionUpdatedAt).toLocaleString()}`
                                    : "No customer feedback yet."}
                                </p>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void handleSaveMaterialComment(baseItem)}
                                  disabled={savingFeedbackItemId === baseItemId}
                                >
                                  Save comment
                                </Button>
                              </div>
                            </div>
                          </div>

                          {savingItemId === baseItemId ? (
                            <p className="pt-3 text-xs text-[var(--ui-text-muted)]">Saving selection...</p>
                          ) : null}
                          {savingFeedbackItemId === baseItemId ? (
                            <p className="pt-2 text-xs text-[var(--ui-text-muted)]">Saving feedback...</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : null}

      {sectionCards.length === 0 ? (
        <div className="rounded-[24px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-8 text-center text-sm text-[var(--ui-text-muted)]">
          No portal sections are shared right now.
        </div>
      ) : null}

      {settings.showShoppingList &&
      settings.showPrice &&
      sectionSummaries.length > 0 &&
      activeSectionId === "portal-materials" ? (
        <div className="mt-12 rounded-[32px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-8 shadow-[0_24px_60px_rgba(20,20,20,0.08)]">
          <div className="space-y-4">
            {sectionSummaries.map(({ sectionName, total }) => (
              <div key={sectionName} className="flex items-center justify-between text-base text-[var(--ui-text-main)]">
                <span className="font-medium">{sectionName}</span>
                <span>{formatAmount(total, currencySymbol)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-[var(--ui-border-soft)] pt-4">
              <span className="text-xl font-medium font-[var(--font-display-serif)] text-[var(--ui-text-strong)]">Grand Total</span>
              <span className="text-2xl font-medium font-[var(--font-display-serif)] text-[var(--ui-text-strong)]">
                {formatAmount(grandTotal, currencySymbol)}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
