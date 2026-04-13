"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { Banknote, CheckCircle2, ClipboardList, Download, ExternalLink, Send, Users, Wallet, XCircle } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { addDocumentMeta, addPageNumbers, ensurePdfUnicodeFont, formatMoney, renderPdfTable, sanitizeFileName } from "@/lib/pdfExport";
import { cn } from "@/lib/utils";

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
  sectionId?: Id<"laborSections">;
  quantity: number;
  unit: string;
  unitPrice?: number;
  totalPrice?: number;
  assignedTo?: string;
  referenceLink?: string | null;
  attachmentFileId?: Id<"files"> | null;
  startDate?: number;
  endDate?: number;
};
type PublicLaborSection = Doc<"laborSections">;
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
  hasOnlinePaymentLink?: boolean;
  canPayOnline?: boolean;
  paidAt?: number;
  isOverdue?: boolean;
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
  clientFunding: {
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
type ShoppingGroup = {
  key: string;
  sectionName: string;
  leadItem: ClientPanelItem;
  items: ClientPanelItem[];
  title: string;
  setId?: Id<"shoppingSets">;
  selectionMode: "single" | "multiple" | "none";
  pricingMode: "selected_only" | "all_selected" | "none";
};

const EMPTY_SECTIONS: ClientPanelSection[] = [];
const EMPTY_ITEMS: ClientPanelItem[] = [];
const EMPTY_FILES: ClientPanelFile[] = [];
const EMPTY_SURVEYS: PublicSurvey[] = [];
const EMPTY_TASKS: PublicTask[] = [];
const EMPTY_LABOR_ITEMS: PublicLaborItem[] = [];
const EMPTY_LABOR_SECTIONS: PublicLaborSection[] = [];
const EMPTY_CONTACTS: PublicContact[] = [];
const EMPTY_PAYMENTS: PublicPayment[] = [];
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

const getLeadOption = (item: ClientPanelItem, options: ClientPanelItem[]) => {
  const preferredIds = new Set(
    (item.setResolvedSourceItemIds || item.setPreferredSourceItemIds || []).map((entry) =>
      String(entry),
    ),
  );

  return (
    options.find((option) => preferredIds.has(String(option.sourceItemId))) ||
    options[0] ||
    item
  );
};

const getChoiceLabel = (selectionMode: ShoppingGroup["selectionMode"]) => {
  if (selectionMode === "single") {
    return "Choose 1 option";
  }
  if (selectionMode === "multiple") {
    return "Choose any options";
  }
  return "Included";
};

const getInitialSelectedOptionIds = (item: ClientPanelItem, options: ClientPanelItem[]) => {
  const optionIds = new Set(options.map((option) => String(option.sourceItemId)));
  const selectedIds = (item.setResolvedSourceItemIds || item.setPreferredSourceItemIds || [])
    .map((entry) => String(entry))
    .filter((entry) => optionIds.has(entry));

  if (selectedIds.length > 0) {
    return selectedIds;
  }

  if (item.setSelectionMode === "single" && options[0]) {
    return [String(options[0].sourceItemId)];
  }

  return [];
};

const getQtyLabel = (item: ClientPanelItem) => `Qty: ${item.quantity} ${item.unit || "pcs"}`;

const getSelectedIdsForGroup = (
  group: ShoppingGroup,
  localSelection: Record<string, string[]>,
) => localSelection[group.key] || getInitialSelectedOptionIds(group.leadItem, group.items);

const getCountedItemsForGroup = (group: ShoppingGroup, selectedIds: string[]) => {
  if (!group.setId) {
    return group.items;
  }

  if (group.pricingMode === "none") {
    return [];
  }

  const selectedIdSet = new Set(selectedIds);
  if (group.selectionMode === "single") {
    const selectedItem = group.items.find((item) => selectedIdSet.has(String(item.sourceItemId)));
    return selectedItem ? [selectedItem] : [];
  }

  if (group.selectionMode === "multiple") {
    return group.items.filter((item) => selectedIdSet.has(String(item.sourceItemId)));
  }

  return group.pricingMode === "all_selected" ? group.items : [];
};

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
        className={`${sizeClass} overflow-hidden rounded-xl border border-border bg-muted`}
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
  const selectShoppingSetItems = useMutation(apiAny.shopping.selectShoppingSetItemsByAccessToken);
  const respondToShoppingItem = useMutation(apiAny.shopping.respondToShoppingItemByAccessToken);
  const submitPublicSurvey = useMutation(apiAny.surveys.submitPublicSurveyResponseByAccessToken);
  const getInvoiceDownloadUrl = useAction(
    apiAny.projectPaymentActions.getProjectPaymentInvoiceDownloadUrlByAccessToken,
  );
  const getStripePaymentLinkUrl = useAction(
    apiAny.projectPaymentActions.getProjectPaymentStripeLinkByAccessToken,
  );
  const publicBudgetSummaryData = useQuery(
    apiAny.projectBudget.getPublicProjectBudgetSummaryByAccessToken,
    panelData?.settings?.showBudget ? { accessToken } : "skip"
  );
  const publicSurveysData = useQuery(
    apiAny.surveys.getPublicSurveysByAccessToken,
    respondentKey && (panelData?.settings?.showSurveys ?? false)
      ? { accessToken, respondentKey }
      : "skip"
  );

  const [localSelection, setLocalSelection] = useState<Record<string, string[]>>({});
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [openSurveyId, setOpenSurveyId] = useState<string | null>(null);
  const [submittingSurveyId, setSubmittingSurveyId] = useState<string | null>(null);
  const [surveyStartTimes, setSurveyStartTimes] = useState<Record<string, number>>({});
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, Record<string, unknown>>>({});
  const [isExportingMaterialsPdf, setIsExportingMaterialsPdf] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [respondentName, setRespondentName] = useState("");
  const [selectedMoodboardFile, setSelectedMoodboardFile] = useState<ClientPanelFile | null>(null);
  const [downloadingPaymentId, setDownloadingPaymentId] = useState<string | null>(null);
  const [openingPaymentId, setOpeningPaymentId] = useState<string | null>(null);
  const [shoppingItemComments, setShoppingItemComments] = useState<Record<string, string>>({});
  const [respondingShoppingItemId, setRespondingShoppingItemId] = useState<string | null>(null);
  const [expandedShoppingItemComments, setExpandedShoppingItemComments] = useState<Record<string, boolean>>({});

  const project = panelData?.project;
  const sections = (panelData?.sections as ClientPanelSection[] | undefined) ?? EMPTY_SECTIONS;
  const items = (panelData?.items as ClientPanelItem[] | undefined) ?? EMPTY_ITEMS;
  const files = (panelData?.files as ClientPanelFile[] | undefined) ?? EMPTY_FILES;
  const moodboardFiles =
    (panelData?.moodboardFiles as ClientPanelFile[] | undefined) ?? EMPTY_FILES;
  const surveys = (publicSurveysData?.surveys as PublicSurvey[] | undefined) ?? EMPTY_SURVEYS;
  const tasks = (panelData?.tasks as PublicTask[] | undefined) ?? EMPTY_TASKS;
  const laborItems = (panelData?.labor as PublicLaborItem[] | undefined) ?? EMPTY_LABOR_ITEMS;
  const laborSections =
    (panelData?.laborSections as PublicLaborSection[] | undefined) ?? EMPTY_LABOR_SECTIONS;
  const contacts = (panelData?.contacts as PublicContact[] | undefined) ?? EMPTY_CONTACTS;
  const payments = (panelData?.payments as PublicPayment[] | undefined) ?? EMPTY_PAYMENTS;
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
    setShoppingItemComments((current) => {
      const next = { ...current };
      for (const item of items) {
        const itemId = String(item.sourceItemId);
        if (typeof next[itemId] !== "string") {
          next[itemId] = item.customerDecisionComment || "";
        }
      }
      return next;
    });
  }, [items]);

  const shoppingGroupsBySection = useMemo(() => {
    const sectionOrder = new Map(sections.map((section) => [section.name, section.order]));
    const sortedItems = [...items].sort((a, b) => {
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

    const grouped = new Map<string, ShoppingGroup[]>();
    const seenSetIds = new Set<string>();

    for (const item of sortedItems) {
      const sectionKey = item.sectionName?.trim() || "No Section";
      const existing = grouped.get(sectionKey) ?? [];

      if (item.setId) {
        const setKey = String(item.setId);
        if (seenSetIds.has(setKey)) {
          continue;
        }
        seenSetIds.add(setKey);
        const setItems = sortedItems.filter((entry) => String(entry.setId ?? "") === setKey);
        const leadItem = getLeadOption(item, setItems);
        existing.push({
          key: setKey,
          sectionName: sectionKey,
          leadItem,
          items: setItems,
          title: leadItem.name,
          setId: item.setId,
          selectionMode: item.setSelectionMode || "none",
          pricingMode: item.setPricingMode || "none",
        });
      } else {
        existing.push({
          key: String(item.sourceItemId),
          sectionName: sectionKey,
          leadItem: item,
          items: [item],
          title: item.name,
          selectionMode: "none",
          pricingMode: "all_selected",
        });
      }

      grouped.set(sectionKey, existing);
    }

    return grouped;
  }, [items, sections]);

  const sectionSummaries = Array.from(shoppingGroupsBySection.entries()).map(
    ([sectionName, groups]) => {
      const total = groups.reduce((sum, group) => {
        const selectedIds = getSelectedIdsForGroup(group, localSelection);
        const countedItems = getCountedItemsForGroup(group, selectedIds);
        return sum + countedItems.reduce((sectionSum, item) => sectionSum + (item.totalPrice || 0), 0);
      }, 0);

      return {
        sectionName,
        itemCount: groups.length,
        total,
      };
    },
  );

  const grandTotal = sectionSummaries.reduce((sum, section) => sum + section.total, 0);
  const materialsItemCount = sectionSummaries.reduce(
    (sum, section) => sum + section.itemCount,
    0
  );
  const laborSectionEntries = useMemo(() => {
    const sectionOrder = new Map(laborSections.map((section) => [String(section._id), section.order]));
    const sectionNameById = new Map(laborSections.map((section) => [String(section._id), section.name]));
    const buckets = new Map<string, { name: string; items: PublicLaborItem[] }>();

    const ensureBucket = (key: string, name: string) => {
      if (!buckets.has(key)) {
        buckets.set(key, { name, items: [] });
      }
      return buckets.get(key)!;
    };

    for (const item of laborItems) {
      const key = item.sectionId ? String(item.sectionId) : "__none__";
      const name = item.sectionId ? sectionNameById.get(String(item.sectionId)) || "No Category" : "No Category";
      ensureBucket(key, name).items.push(item);
    }

    for (const section of laborSections) {
      ensureBucket(String(section._id), section.name);
    }

    return Array.from(buckets.entries())
      .map(([key, value]) => ({
        key,
        name: value.name,
        items: value.items.slice().sort((left, right) => left.name.localeCompare(right.name)),
      }))
      .sort((left, right) => {
        if (left.name === "No Category") return 1;
        if (right.name === "No Category") return -1;
        const leftOrder = sectionOrder.get(left.key) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = sectionOrder.get(right.key) ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return left.name.localeCompare(right.name);
      });
  }, [laborItems, laborSections]);

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

  const handleOpenPaymentLink = async (paymentId: string) => {
    setOpeningPaymentId(paymentId);
    try {
      const result = await getStripePaymentLinkUrl({
        accessToken,
        installmentId: paymentId as Id<"projectPayments">,
      });
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error("Could not open payment link", {
        description: (error as Error).message,
      });
    } finally {
      setOpeningPaymentId(null);
    }
  };

  const handleRespondToShoppingItem = async (
    item: ClientPanelItem,
    decision: "accepted" | "rejected",
  ) => {
    const cleanedRespondentName = respondentName.trim();
    const itemId = String(item.sourceItemId);
    setRespondingShoppingItemId(itemId);

    try {
      if (typeof window !== "undefined" && cleanedRespondentName) {
        const storageKey = `client-panel-respondent-name:${accessToken}`;
        window.localStorage.setItem(storageKey, cleanedRespondentName);
      }

      await respondToShoppingItem({
        accessToken,
        itemId: item.sourceItemId,
        decision,
        comment: shoppingItemComments[itemId]?.trim() || null,
        respondentName: cleanedRespondentName,
      });

      toast.success(`Feedback saved for "${item.name}"`);
    } catch (error) {
      toast.error("Failed to save shopping item feedback", {
        description: (error as Error).message,
      });
    } finally {
      setRespondingShoppingItemId(null);
    }
  };

  const renderShoppingItemFeedback = (item: ClientPanelItem) => {
    const itemId = String(item.sourceItemId);
    const isSaving = respondingShoppingItemId === itemId;
    const hasDecision = item.customerDecision === "accepted" || item.customerDecision === "rejected";
    const hasDraftComment = (shoppingItemComments[itemId] || "").trim().length > 0;
    const isCommentExpanded = expandedShoppingItemComments[itemId] || hasDraftComment || Boolean(item.customerDecisionComment);

    return (
      <div className="mt-4 rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Client feedback
          </Badge>
          {item.customerDecision ? (
            <Badge variant="secondary" className="text-xs">
              {item.customerDecision === "accepted" ? "Accepted" : "Rejected"}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">Awaiting decision</span>
          )}
          {item.customerDecisionUpdatedAt ? (
            <span className="text-xs text-muted-foreground">
              Updated {new Date(item.customerDecisionUpdatedAt).toLocaleString()}
            </span>
          ) : null}
        </div>

        {hasDecision && item.customerDecisionComment ? (
          <p className="mt-3 text-sm leading-6 text-foreground">{item.customerDecisionComment}</p>
        ) : null}

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void handleRespondToShoppingItem(item, "accepted")}
              disabled={isSaving}
            >
              <CheckCircle2 data-icon="inline-start" />
              {isSaving ? "Saving..." : "Approve"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handleRespondToShoppingItem(item, "rejected")}
              disabled={isSaving}
            >
              <XCircle data-icon="inline-start" />
              Reject
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                setExpandedShoppingItemComments((current) => ({
                  ...current,
                  [itemId]: !isCommentExpanded,
                }))
              }
            >
              {isCommentExpanded ? "Hide comment" : "Add comment"}
            </Button>
          </div>
          {isCommentExpanded ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`shopping-item-comment-${itemId}`} className="text-sm font-medium">
                Optional comment
              </Label>
              <Textarea
                id={`shopping-item-comment-${itemId}`}
                value={shoppingItemComments[itemId] || ""}
                onChange={(event) =>
                  setShoppingItemComments((current) => ({
                    ...current,
                    [itemId]: event.target.value,
                  }))
                }
                rows={3}
                placeholder="Add context, preferences or constraints for this item..."
              />
            </div>
          ) : null}
        </div>
      </div>
    );
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
        subtitle: `Items: ${Array.from(shoppingGroupsBySection.values()).reduce((sum, groups) => sum + groups.length, 0)}`,
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

      const rows = Array.from(shoppingGroupsBySection.entries()).flatMap(([sectionName, groups]) =>
        groups.flatMap((group) => {
          const selectedIds = getSelectedIdsForGroup(group, localSelection);
          const countedItems = getCountedItemsForGroup(group, selectedIds);
          const printableItems = countedItems.length > 0 ? countedItems : group.items;
          return printableItems.map((item) => [
            sectionName,
            item.name,
            `${item.quantity} ${item.unit || "pcs"}`,
            ...(includePriceColumn ? [formatMoney(item.totalPrice, currencySymbol)] : []),
            ...(includeSupplierColumn ? [item.supplier || "-"] : []),
            ...(includeNotesColumn ? [item.notes || "-"] : []),
          ]);
        }),
      );

      await renderPdfTable(doc, {
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

  const handleSelectSetItems = async (group: ShoppingGroup, nextSelectedIds: string[]) => {
    if (!group.setId) {
      return;
    }

    const previousValue = localSelection[group.key];
    setLocalSelection((prev) => ({ ...prev, [group.key]: nextSelectedIds }));
    setSavingItemId(group.key);

    try {
      await selectShoppingSetItems({
        accessToken,
        setId: group.setId,
        selectedItemIds: nextSelectedIds as Id<"shoppingListItems">[],
        respondentName: respondentName.trim() || undefined,
      });
      toast.success("Choice saved");
    } catch (error) {
      if (previousValue) {
        setLocalSelection((prev) => ({ ...prev, [group.key]: previousValue }));
      } else {
        setLocalSelection((prev) => {
          const next = { ...prev };
          delete next[group.key];
          return next;
        });
      }
      toast.error("Failed to save choice", {
        description: (error as Error).message,
      });
    } finally {
      setSavingItemId(null);
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
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-medium tracking-tight font-serif text-foreground md:text-5xl">
              Customer Portal
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-primary">
              For project: {project.name}
            </span>
            {settings.showShoppingList &&
            settings.showPrice &&
            activeSectionId === "portal-materials" ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground">
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
              <Download data-icon="inline-start" />
              {isExportingMaterialsPdf ? "Exporting PDF..." : "Export shopping list PDF"}
            </Button>
          ) : null}
          {sectionCards.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {sectionCards.map((section) => {
                const isActive = activeSectionId === section.id;

                return (
                  <Button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSectionId(section.id)}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-auto min-h-24 flex-col items-start gap-2 rounded-[28px] border px-5 py-4 text-left transition-all duration-200",
                      isActive
                        ? "border-primary/15 bg-primary/[0.05] text-foreground shadow-[0_14px_40px_-28px_rgba(43,31,23,0.55)]"
                        : "bg-card/80 text-foreground hover:border-primary/15 hover:bg-background"
                    )}
                  >
                    <span className="text-sm font-medium">{section.label}</span>
                    <span
                      className={cn(
                        "text-xs",
                        isActive ? "text-foreground/70" : "text-muted-foreground"
                      )}
                    >
                      {section.count} items
                    </span>
                  </Button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {panelData.version === 0 ? (
        <div className="mb-8 rounded-2xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
          This portal has not been updated yet. Ask the project team to click Update portal in
          project settings.
        </div>
      ) : null}

      {settings.showFiles && activeSectionId === "portal-files" ? (
        <div className="mb-10 rounded-3xl border border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-8">
          <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8 sm:gap-4">
            <h2 className="text-xl font-medium font-serif text-foreground sm:text-2xl">
              Files
            </h2>
            <span className="inline-flex items-center justify-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {files.length} files
            </span>
          </div>
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files shared.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {files.map((file) => (
                <div
                  key={file._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {file.fileType} • {formatFileSize(file.size)}
                      {file.folderName ? ` • ${file.folderName}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Open ${file.name}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <a
                      href={file.url}
                      download={file.name}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
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
          <div className="mb-10 rounded-3xl border border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-8">
            <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8 sm:gap-4">
              <h2 className="text-xl font-medium font-serif text-foreground sm:text-2xl">
                Moodboard
              </h2>
              <span className="inline-flex items-center justify-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {moodboardFiles.length} items
              </span>
            </div>
            {moodboardFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No moodboard items shared.</p>
            ) : (
              <div className="flex flex-col gap-12">
                {moodboardSections.map((section) => (
                  <div key={section.sectionId} className="flex flex-col gap-6">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold tracking-[0.2em] uppercase text-foreground">
                        {section.sectionLabel}
                      </h3>
                      <span className="inline-flex items-center justify-center rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                        {section.files.length} items
                      </span>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                      {section.files.map((file) => {
                        const isImage = file.mimeType.startsWith("image/");
                        return (
                          <div
                            key={file._id}
                            className="group relative mb-4 break-inside-avoid overflow-hidden rounded-xl border border-border/70 bg-card"
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
                                  className="w-full h-auto object-contain bg-muted transition-transform duration-300 group-hover:scale-[1.02]"
                                />
                              </button>
                            ) : (
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block rounded-lg border border-border/70 bg-muted p-3 text-xs text-muted-foreground"
                              >
                                Preview unavailable
                              </a>
                            )}

                            <div className="absolute right-3 top-3 z-10 flex items-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card/90 text-muted-foreground hover:bg-muted hover:text-foreground"
                                aria-label={`Open ${file.name}`}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                              <a
                                href={file.url}
                                download={file.name}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card/90 text-muted-foreground hover:bg-muted hover:text-foreground"
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
              className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4"
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
        <div className="mb-10 rounded-3xl border border-border bg-card px-5 py-6 text-sm text-muted-foreground">
          Loading surveys...
        </div>
      ) : null}

      {settings.showSurveys &&
      activeSectionId === "portal-surveys" &&
      publicSurveysData !== undefined ? (
        <div className="mb-10 rounded-3xl border border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-8">
          <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8 sm:gap-4">
            <h2 className="text-xl font-medium font-serif text-foreground sm:text-2xl">
              Surveys
            </h2>
            <span className="inline-flex items-center justify-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {surveys.length} available
            </span>
          </div>
          <p className="mb-6 text-sm text-muted-foreground">
            Share your feedback directly in the portal. Responses are sent to the project team.
          </p>
          {surveys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No surveys shared.</p>
          ) : (
            <div className="flex flex-col gap-4">
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
                  className="rounded-2xl border border-border/70 bg-card p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-primary" />
                        <h3 className="text-lg font-medium text-foreground">{survey.title}</h3>
                        {survey.isRequired ? (
                          <Badge variant="destructive" className="text-[10px]">Required</Badge>
                        ) : null}
                        {survey.hasSubmitted ? (
                          <Badge variant="outline" className="text-[10px]">
                            <CheckCircle2 data-icon="inline-start" />
                            Submitted
                          </Badge>
                        ) : null}
                      </div>
                      {survey.description ? (
                        <p className="text-sm text-muted-foreground">{survey.description}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
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
                    <p className="mt-4 text-sm text-muted-foreground">
                      You already submitted this survey.
                    </p>
                  ) : null}

                  {isOpen ? (
                    <div className="mt-6 flex flex-col gap-4 border-t border-border pt-5">
                      <div className="max-w-md flex flex-col gap-2">
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
                            className="rounded-lg border border-border/60 bg-muted p-4"
                          >
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">Question {index + 1}</Badge>
                              {question.isRequired ? (
                                <Badge variant="destructive" className="text-[10px]">Required</Badge>
                              ) : null}
                            </div>
                            <p className="mb-3 text-sm font-medium text-foreground">
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
                                className="flex flex-col gap-2"
                              >
                                {(question.options || []).map((option) => (
                                  <div key={option} className="flex items-center gap-2">
                                    <RadioGroupItem value={option} id={`${questionId}-${option}`} />
                                    <Label htmlFor={`${questionId}-${option}`}>{option}</Label>
                                  </div>
                                ))}
                              </RadioGroup>
                            ) : null}

                            {question.questionType === "multiple_choice" ? (
                              <div className="flex flex-col gap-2">
                                {(question.options || []).map((option) => {
                                  const selectedValues = Array.isArray(answerValue)
                                    ? answerValue.filter((value): value is string => typeof value === "string")
                                    : [];
                                  const checked = selectedValues.includes(option);
                                  return (
                                    <div key={option} className="flex items-center gap-2">
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
                                className="flex flex-col gap-2"
                              >
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
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
                                className="flex flex-col gap-2"
                              >
                                <div className="flex items-center gap-2">
                                  <RadioGroupItem value="true" id={`${questionId}-yes`} />
                                  <Label htmlFor={`${questionId}-yes`}>Yes</Label>
                                </div>
                                <div className="flex items-center gap-2">
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
                              <p className="text-xs text-muted-foreground">
                                File uploads are not available in the public portal yet.
                              </p>
                            ) : null}
                          </div>
                        );
                      })}

                      {hasRequiredFileQuestion ? (
                        <p className="text-xs text-destructive">
                          This survey has required file upload questions and cannot be submitted in the public portal.
                        </p>
                      ) : null}

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          onClick={() => void handleSubmitPublicSurvey(survey)}
                          disabled={isSubmitting || hasRequiredFileQuestion}
                        >
                          <Send data-icon="inline-start" />
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
        <div className="mb-10 rounded-3xl border border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-8">
          <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8 sm:gap-4">
            <h2 className="text-xl font-medium font-serif text-foreground sm:text-2xl">
              Tasks
            </h2>
            <span className="inline-flex items-center justify-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {tasks.length} items
            </span>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks shared.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {tasks.map((task) => (
                <div
                  key={task._id}
                  className="rounded-xl border border-border/70 bg-card p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-foreground">{task.title}</p>
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
                    <p className="mt-2 text-sm text-muted-foreground">{task.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Start: {formatPortalDate(task.startDate)} · End: {formatPortalDate(task.endDate)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {settings.showLabor && activeSectionId === "portal-labor" ? (
        <div>
          {laborItems.length === 0 ? (
            <div className="mb-10 rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No labor entries shared.
            </div>
          ) : (
            laborSectionEntries.map((section) => {
              const sectionTotal = section.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

              return (
                <div
                  key={section.key}
                  className="mb-10 rounded-3xl border border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-8"
                >
                  <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8 sm:gap-4">
                    <h2 className="text-lg font-medium text-foreground sm:text-xl">{section.name}</h2>
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-medium">
                      {section.items.length} items
                    </Badge>
                    {sectionTotal > 0 ? (
                      <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
                        {formatAmount(sectionTotal, currencySymbol)}
                      </Badge>
                    ) : null}
                  </div>

                  {section.items.length > 0 ? (
                    <div className="overflow-hidden rounded-2xl border border-border/70">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Work Description</TableHead>
                            <TableHead className="w-24 text-right">Qty</TableHead>
                            <TableHead className="w-20 text-center">Unit</TableHead>
                            <TableHead className="w-32 text-right">Price/Unit</TableHead>
                            <TableHead className="w-32 text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {section.items.map((item) => (
                            <TableRow key={item._id}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <span className="font-medium text-foreground">{item.name}</span>
                                </div>
                                {item.notes ? (
                                  <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>
                                ) : null}
                                <div className="mt-1 flex flex-wrap items-center gap-3">
                                  {item.referenceLink ? (
                                    <a
                                      href={item.referenceLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      Link
                                    </a>
                                  ) : null}
                                  {item.attachmentFileId ? (
                                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                      Attachment in Files/labor
                                    </span>
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-sm text-foreground">{item.quantity}</TableCell>
                              <TableCell className="text-center text-sm text-muted-foreground">{item.unit}</TableCell>
                              <TableCell className="text-right text-sm text-foreground">
                                {item.unitPrice ? `${item.unitPrice.toFixed(2)} ${currencySymbol}` : "-"}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium text-foreground">
                                {item.totalPrice ? `${item.totalPrice.toFixed(2)} ${currencySymbol}` : "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow>
                            <TableCell colSpan={4} className="text-right text-sm font-medium text-foreground">
                              Section Total:
                            </TableCell>
                            <TableCell className="text-right text-sm font-semibold text-foreground">
                              {formatAmount(sectionTotal, currencySymbol)}
                            </TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 py-8 text-center text-muted-foreground">
                      <p className="text-sm">No labor items in this section</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : null}

      {settings.showContacts && activeSectionId === "portal-contacts" ? (
        <div className="mb-10 rounded-3xl border border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-8">
          <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8 sm:gap-4">
            <h2 className="text-xl font-medium font-serif text-foreground sm:text-2xl">
              Contacts
            </h2>
            <span className="inline-flex items-center justify-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {contacts.length} items
            </span>
          </div>
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts shared.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {contacts.map((contact) => (
                <div
                  key={contact._id}
                  className="rounded-xl border border-border/70 bg-card p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-foreground">{contact.name}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {contact.type.toUpperCase()}
                    </Badge>
                  </div>
                  {contact.companyName ? (
                    <p className="mt-2 text-sm text-foreground">{contact.companyName}</p>
                  ) : null}
                  {(contact.email || contact.phone) ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {contact.email || "-"}
                      {contact.phone ? ` · ${contact.phone}` : ""}
                    </p>
                  ) : null}
                  {contact.projectRole ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Role: {contact.projectRole}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {settings.showBudget && activeSectionId === "portal-budget" ? (
        <div className="mb-10 rounded-3xl border border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-8">
          <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8 sm:gap-4">
            <h2 className="text-xl font-medium font-serif text-foreground sm:text-2xl">
              Budget
            </h2>
          </div>
          {publicBudgetSummary ? (
            <div className="flex flex-col gap-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-border/70 bg-card p-5">
                  <p className="text-sm text-muted-foreground">Budget</p>
                  <div className="mt-2 flex items-center gap-3">
                    <Banknote className="h-5 w-5 text-primary" />
                    <p className="text-xl font-medium font-serif text-foreground">
                      {formatAmount(publicBudgetSummary.budget, currencySymbol)}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-card p-5">
                  <p className="text-sm text-muted-foreground">Planned cost</p>
                  <p className="mt-2 text-xl font-medium font-serif text-foreground">
                    {formatAmount(publicBudgetSummary.plannedCost, currencySymbol)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {publicBudgetSummary.projectedUtilizationPercent ?? 0}% of budget
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card p-5">
                  <p className="text-sm text-muted-foreground">Committed cost</p>
                  <p className="mt-2 text-xl font-medium font-serif text-foreground">
                    {formatAmount(publicBudgetSummary.committedCost, currencySymbol)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Approved and scheduled spend
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card p-5">
                  <p className="text-sm text-muted-foreground">Actual cost</p>
                  <p className="mt-2 text-xl font-medium font-serif text-foreground">
                    {formatAmount(publicBudgetSummary.actualCost, currencySymbol)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {publicBudgetSummary.utilizationPercent ?? 0}% of budget used
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-xl border border-border/70 bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-medium text-foreground">
                        Budget balance
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Remaining budget against actual and projected spending.
                      </p>
                    </div>
                    <div
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                        publicBudgetSummary.variance < 0
                          ? "border-border bg-muted text-foreground"
                          : "border-border bg-muted text-foreground"
                      }`}
                    >
                      {publicBudgetSummary.variance < 0 ? "Over budget" : "Within budget"}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-muted px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Remaining now
                      </p>
                      <p className="mt-2 text-lg font-medium text-foreground">
                        {formatAmount(publicBudgetSummary.variance, currencySymbol)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Projected remaining
                      </p>
                      <p className="mt-2 text-lg font-medium text-foreground">
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
                              ? "border-border bg-muted text-foreground"
                              : "border-border bg-muted text-foreground"
                          }`}
                        >
                          {alert.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      No active budget alerts.
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-5">
                  <p className="text-base font-medium text-foreground">
                    Estimates and payments
                  </p>
                  <div className="mt-4 flex flex-col gap-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Accepted estimates</span>
                      <span className="font-medium text-foreground">
                        {formatAmount(publicBudgetSummary.clientFunding.acceptedEstimations, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Scheduled payments</span>
                      <span className="font-medium text-foreground">
                        {formatAmount(publicBudgetSummary.clientFunding.scheduledPayments, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Collected payments</span>
                      <span className="font-medium text-foreground">
                        {formatAmount(publicBudgetSummary.clientFunding.collectedPayments, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Outstanding payments</span>
                      <span className="font-medium text-foreground">
                        {formatAmount(publicBudgetSummary.clientFunding.outstandingPayments, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Milestone allocation</span>
                      <span className="font-medium text-foreground">
                        {formatAmount(publicBudgetSummary.milestones.budgetAllocated, currencySymbol)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-card p-5">
                  <p className="text-base font-medium text-foreground">Materials</p>
                  <div className="mt-4 flex flex-col gap-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Planned</span>
                      <span className="font-medium text-foreground">
                        {formatAmount(publicBudgetSummary.breakdown.shopping.planned, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Committed</span>
                      <span className="font-medium text-foreground">
                        {formatAmount(publicBudgetSummary.breakdown.shopping.committed, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Actual</span>
                      <span className="font-medium text-foreground">
                        {formatAmount(publicBudgetSummary.breakdown.shopping.actual, currencySymbol)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-5">
                  <p className="text-base font-medium text-foreground">Labor</p>
                  <div className="mt-4 flex flex-col gap-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Planned</span>
                      <span className="font-medium text-foreground">
                        {formatAmount(publicBudgetSummary.breakdown.labor.planned, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Committed</span>
                      <span className="font-medium text-foreground">
                        {formatAmount(publicBudgetSummary.breakdown.labor.committed, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Actual</span>
                      <span className="font-medium text-foreground">
                        {formatAmount(publicBudgetSummary.breakdown.labor.actual, currencySymbol)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : typeof project?.budget === "number" ? (
            <div className="rounded-xl border border-border/70 bg-card p-6">
              <p className="mb-2 text-sm text-muted-foreground">Project budget</p>
              <div className="flex items-center gap-3">
                <Banknote className="h-5 w-5 text-primary" />
                <p className="text-2xl font-medium font-serif text-foreground">
                  {formatAmount(project.budget, currencySymbol)}
                </p>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Detailed project finance summary is not available yet.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No budget set for this project.</p>
          )}
        </div>
      ) : null}

      {settings.showPayments && activeSectionId === "portal-payments" ? (
        <div className="mb-10 rounded-3xl border border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8 sm:gap-4">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <h2 className="text-xl font-medium font-serif text-foreground sm:text-2xl">
                Payments
              </h2>
              <span className="inline-flex items-center justify-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {payments.length} installments
              </span>
            </div>
          </div>

          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No installments shared yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {payments.map((payment) => (
                <div
                  key={payment._id}
                  className="rounded-xl border border-border/70 bg-card p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Wallet className="h-4 w-4 text-primary" />
                        <p className="text-base font-medium text-foreground">
                          {payment.title}
                        </p>
                        <span
                          className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-[10px] font-medium ${
                            payment.status === "paid"
                              ? "border-border bg-muted text-foreground"
                              : payment.isOverdue
                                ? "border-border bg-muted text-foreground"
                                : "border-border bg-muted text-foreground"
                          }`}
                        >
                          {payment.isOverdue ? "OVERDUE" : payment.status.toUpperCase()}
                        </span>
                        {payment.invoiceNumber ? (
                          <span className="text-xs text-muted-foreground">
                            #{payment.invoiceNumber}
                          </span>
                        ) : null}
                      </div>
                      {payment.description ? (
                        <p className="text-sm text-muted-foreground">{payment.description}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-4 text-sm text-foreground">
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
                        <p className="text-sm text-muted-foreground">
                          Transfer reference:{" "}
                          <span className="font-medium text-foreground">
                            {payment.paymentReference}
                          </span>
                        </p>
                      ) : null}
                      {(payment.bankAccountNumber || payment.bankName) ? (
                        <div className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground">
                          <p className="font-medium">
                            {payment.bankAccountHolder || "Bank transfer details"}
                          </p>
                          {payment.bankName ? (
                            <p className="text-muted-foreground">{payment.bankName}</p>
                          ) : null}
                          {payment.bankAccountNumber ? (
                            <p className="mt-1 font-medium tracking-[0.02em]">
                              {payment.bankAccountNumber}
                            </p>
                          ) : null}
                          {payment.bankSwift ? (
                            <p className="text-muted-foreground">SWIFT: {payment.bankSwift}</p>
                          ) : null}
                          {payment.paymentInstructions ? (
                            <p className="mt-2 text-muted-foreground">
                              {payment.paymentInstructions}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {payment.canPayOnline ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          onClick={() => void handleOpenPaymentLink(payment._id)}
                          disabled={openingPaymentId === payment._id}
                        >
                          <ExternalLink data-icon="inline-start" />
                          {openingPaymentId === payment._id ? "Opening..." : "Pay online"}
                        </Button>
                      ) : null}
                      {payment.hasInvoicePdf ? (
                        <Button
                          type="button"
                          size="sm"
                          variant={payment.status === "paid" ? "outline" : "default"}
                          onClick={() => void handleDownloadInvoice(payment._id)}
                          disabled={downloadingPaymentId === payment._id}
                        >
                          {payment.status === "paid" ? (
                            <CheckCircle2 data-icon="inline-start" />
                          ) : (
                            <Download data-icon="inline-start" />
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
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {settings.showShoppingList && activeSectionId === "portal-materials" ? (
        <div>
          {sectionSummaries.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No shopping items available yet.
            </div>
          ) : (
            sectionSummaries.map(({ sectionName, itemCount, total }) => {
              const sectionGroups = shoppingGroupsBySection.get(sectionName) || [];

              return (
                <div
                  key={sectionName}
                  className="mb-10 rounded-3xl border border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-8"
                >
                  <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8 sm:gap-4">
                    <h2 className="text-lg font-medium text-foreground sm:text-xl">
                      {sectionName}
                    </h2>
                    <span className="inline-flex items-center justify-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                      {itemCount} items
                    </span>
                    {settings.showPrice ? (
                      <span className="inline-flex items-center justify-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground">
                        {formatAmount(total, currencySymbol)}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-4">
                    {sectionGroups.map((group) => {
                      const selectedIds = getSelectedIdsForGroup(group, localSelection);
                      const countedItems = getCountedItemsForGroup(group, selectedIds);

                      if (!group.setId) {
                        const option = group.items[0];
                        const optionStatusLabel = getStatusLabel(option.realizationStatus);

                        return (
                          <div
                            key={group.key}
                            className={cn(
                              "rounded-2xl border p-4",
                              !countedItems.some((entry) => entry.sourceItemId === option.sourceItemId) &&
                                "border-border/70 bg-muted/10",
                            )}
                          >
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div className="flex min-w-0 flex-1 items-start gap-4">
                                <ItemImage imageUrl={option.imageUrl} name={option.name} size="sm" />
                                <div className="min-w-0 flex-1">
                                  <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <h4 className="text-sm font-medium text-foreground">{option.name}</h4>
                                    {!countedItems.some((entry) => entry.sourceItemId === option.sourceItemId) ? (
                                      <Badge variant="secondary" className="text-xs">
                                        Not counted in total
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                    <span>{getQtyLabel(option)}</span>
                                    {settings.showPrice && option.unitPrice !== undefined ? (
                                      <span>{formatAmount(option.unitPrice, currencySymbol)} / unit</span>
                                    ) : null}
                                    {settings.showPrice && option.totalPrice !== undefined ? (
                                      <span className="font-medium text-foreground">
                                        {formatAmount(option.totalPrice, currencySymbol)}
                                      </span>
                                    ) : null}
                                    {settings.showSupplier && option.supplier ? <span>{option.supplier}</span> : null}
                                  </div>
                                  {settings.showNotes && option.notes ? (
                                    <p className="mt-2 text-sm text-muted-foreground">{option.notes}</p>
                                  ) : null}
                                  {renderShoppingItemFeedback(option)}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                {optionStatusLabel ? (
                                  <Badge variant="secondary">{optionStatusLabel}</Badge>
                                ) : null}
                                {option.productLink ? (
                                  <a
                                    href={option.productLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={group.key}
                          className="rounded-2xl border border-border/60 bg-muted/20 p-5"
                        >
                          <div className="mb-4 flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-medium text-foreground">{group.title}</h3>
                                <Badge variant="outline" className="text-xs">
                                  Alternative group
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {group.items.length} options
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {getChoiceLabel(group.selectionMode)}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3">
                            {group.items.map((option) => {
                              const optionId = String(option.sourceItemId);
                              const isSelected = selectedIds.includes(optionId);
                              const optionStatusLabel = getStatusLabel(option.realizationStatus);

                              return (
                                <div key={optionId} className="flex flex-col gap-3">
                                  {group.selectionMode !== "none" ? (
                                    <div className="flex justify-end">
                                      {group.selectionMode === "multiple" ? (
                                        <Button
                                          size="sm"
                                          variant={isSelected ? "default" : "outline"}
                                          onClick={() => {
                                            const next = isSelected
                                              ? selectedIds.filter((entry) => entry !== optionId)
                                              : Array.from(new Set([...selectedIds, optionId]));
                                            void handleSelectSetItems(group, next);
                                          }}
                                        >
                                          {isSelected ? "Included" : "Include"}
                                        </Button>
                                      ) : (
                                        <Button
                                          size="sm"
                                          variant="default"
                                          onClick={() => void handleSelectSetItems(group, [optionId])}
                                        >
                                          {isSelected ? "Default option" : "Set default"}
                                        </Button>
                                      )}
                                    </div>
                                  ) : null}

                                  <div
                                    className={cn(
                                      "rounded-2xl border p-4",
                                      !countedItems.some((entry) => entry.sourceItemId === option.sourceItemId) &&
                                        "border-border/70 bg-muted/10",
                                    )}
                                  >
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                      <div className="flex min-w-0 flex-1 items-start gap-4">
                                        <ItemImage imageUrl={option.imageUrl} name={option.name} size="sm" />
                                        <div className="min-w-0 flex-1">
                                          <div className="mb-2 flex flex-wrap items-center gap-2">
                                            <h4 className="text-sm font-medium text-foreground">{option.name}</h4>
                                            <Badge variant="outline" className="text-xs">
                                              Alternative
                                            </Badge>
                                            {!countedItems.some((entry) => entry.sourceItemId === option.sourceItemId) ? (
                                              <Badge variant="secondary" className="text-xs">
                                                Not counted in total
                                              </Badge>
                                            ) : null}
                                          </div>
                                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                            <span>{getQtyLabel(option)}</span>
                                            {settings.showPrice && option.unitPrice !== undefined ? (
                                              <span>{formatAmount(option.unitPrice, currencySymbol)} / unit</span>
                                            ) : null}
                                            {settings.showPrice && option.totalPrice !== undefined ? (
                                              <span className="font-medium text-foreground">
                                                {formatAmount(option.totalPrice, currencySymbol)}
                                              </span>
                                            ) : null}
                                            {settings.showSupplier && option.supplier ? <span>{option.supplier}</span> : null}
                                          </div>
                                          {settings.showNotes && option.notes ? (
                                            <p className="mt-2 text-sm text-muted-foreground">{option.notes}</p>
                                          ) : null}
                                          {renderShoppingItemFeedback(option)}
                                        </div>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                        {optionStatusLabel ? (
                                          <Badge variant="secondary">{optionStatusLabel}</Badge>
                                        ) : null}
                                        {option.productLink ? (
                                          <a
                                            href={option.productLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
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
                          </div>

                          {savingItemId === group.key ? (
                            <p className="pt-3 text-xs text-muted-foreground">Saving selection...</p>
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
        <div className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No portal sections are shared right now.
        </div>
      ) : null}

      {settings.showShoppingList &&
      settings.showPrice &&
      sectionSummaries.length > 0 &&
      activeSectionId === "portal-materials" ? (
        <div className="mt-12 rounded-3xl border border-border bg-card p-8 shadow-sm">
          <div className="flex flex-col gap-4">
            {sectionSummaries.map(({ sectionName, total }) => (
              <div key={sectionName} className="flex items-center justify-between text-base text-foreground">
                <span className="font-medium">{sectionName}</span>
                <span>{formatAmount(total, currencySymbol)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="text-xl font-medium text-foreground">Grand Total</span>
              <span className="text-2xl font-medium text-foreground">
                {formatAmount(grandTotal, currencySymbol)}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
