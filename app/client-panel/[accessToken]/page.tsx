"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Banknote,
  ChevronDown,
  CheckCircle2,
  CheckSquare2,
  ClipboardList,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FolderOpen,
  Hammer,
  ImageIcon,
  MoreHorizontal,
  Send,
  ShoppingCart,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { apiAny } from "@/lib/convexApiAny";
import { downloadCsvFile } from "@/lib/csvExport";
import {
  getLaborExportCsvRow,
  getLaborExportHeaders,
  type LaborExportRow,
} from "@/lib/laborExport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, sanitizeFileName } from "@/lib/pdfExport";
import { exportSectionedTablePdf } from "@/lib/sectionedTablePdfExport";
import { formatShoppingExportProductLabel } from "@/lib/shoppingListExport";
import {
  getShoppingExportCsvRow,
  getShoppingExportHeaders,
  type ShoppingExportRow,
} from "@/lib/shoppingListExport";
import {
  calculateTaxBreakdown,
  getPrimaryAmountKindForDisplay,
  getTaxAmountKindLabel,
  getTaxAmountKindsForDisplay,
  resolveOrganizationTaxSettings,
} from "@/lib/organizationTax";
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
  _id: Id<"laborItems">;
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
  customerDecision?: "accepted" | "rejected" | null;
  customerDecisionComment?: string | null;
  customerDecisionUpdatedAt?: number;
  customerDecisionByName?: string | null;
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
  allowShoppingItemDecisions: true,
  allowShoppingItemComments: true,
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
    (item.setResolvedSourceItemIds || item.setPreferredSourceItemIds || []).map(
      (entry) => String(entry),
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

const getInitialSelectedOptionIds = (
  _item: ClientPanelItem,
  options: ClientPanelItem[],
) => {
  const optionIds = new Set(
    options.map((option) => String(option.sourceItemId)),
  );
  const selectedIds = (
    _item.setResolvedSourceItemIds ||
    _item.setPreferredSourceItemIds ||
    []
  )
    .map((entry) => String(entry))
    .filter((entry) => optionIds.has(entry));

  if (selectedIds.length > 0) {
    return selectedIds;
  }

  return [];
};

const getQtyLabel = (item: ClientPanelItem) =>
  `Qty: ${item.quantity} ${item.unit || "pcs"}`;

const getSelectedIdsForGroup = (
  group: ShoppingGroup,
  localSelection: Record<string, string[]>,
) =>
  localSelection[group.key] ||
  getInitialSelectedOptionIds(group.leadItem, group.items);

const getCountedItemsForGroup = (
  group: ShoppingGroup,
  selectedIds: string[],
) => {
  if (!group.setId) {
    return group.items;
  }

  if (group.pricingMode === "none") {
    return [];
  }

  const selectedIdSet = new Set(selectedIds);
  if (group.selectionMode === "single") {
    const selectedItem = group.items.find((item) =>
      selectedIdSet.has(String(item.sourceItemId)),
    );
    return selectedItem ? [selectedItem] : [];
  }

  if (group.selectionMode === "multiple") {
    return group.items.filter((item) =>
      selectedIdSet.has(String(item.sourceItemId)),
    );
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
  value: unknown,
): PublicSurveyAnswerPayload | null => {
  if (question.questionType === "file") return null;

  if (
    question.questionType === "text_short" ||
    question.questionType === "text_long"
  ) {
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
    const selectedValues = value.filter(
      (option): option is string => typeof option === "string",
    );
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
  const sizeClass =
    size === "sm"
      ? "aspect-[4/3] w-full sm:aspect-auto sm:h-20 sm:w-20"
      : "h-24 w-24 sm:h-20 sm:w-20";

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

function PortalItemCard({
  imageUrl,
  name,
  badges,
  metadata,
  description,
  sideContent,
  footer,
  className,
}: {
  imageUrl?: string;
  name: string;
  badges?: ReactNode;
  metadata?: ReactNode;
  description?: string | null;
  sideContent?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border p-4", className)}>
      <div className="flex flex-col">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div
            className={cn(
              "min-w-0 flex-1",
              imageUrl
                ? "flex flex-col items-start gap-3 sm:flex-row sm:gap-4"
                : "flex flex-col",
            )}
          >
            {imageUrl ? (
              <ItemImage imageUrl={imageUrl} name={name} size="sm" />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h4 className="text-base font-medium text-foreground sm:text-lg">
                  {name}
                </h4>
                {badges}
              </div>
              {metadata ? (
                <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                  {metadata}
                </div>
              ) : null}
              {description ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          {sideContent ? (
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {sideContent}
            </div>
          ) : null}
        </div>

        {footer}
      </div>
    </div>
  );
}

function ClientPanelSkeleton() {
  return (
    <Spinner className="mx-auto w-full max-w-6xl px-6 pb-24 pt-8 sm:px-8" />
  );
}

export default function PublicClientPanelPage() {
  const params = useParams<{ accessToken: string }>();
  const accessToken = params.accessToken;
  const [respondentKey, setRespondentKey] = useState<string | null>(null);

  const panelData = useQuery(
    apiAny.shopping.getPublicShoppingListByAccessToken,
    {
      accessToken,
    },
  );
  const selectShoppingSetItems = useMutation(
    apiAny.shopping.selectShoppingSetItemsByAccessToken,
  );
  const respondToShoppingItem = useMutation(
    apiAny.shopping.respondToShoppingItemByAccessToken,
  );
  const saveShoppingItemComment = useMutation(
    apiAny.shopping.saveShoppingItemCommentByAccessToken,
  );
  const respondToLaborItem = useMutation(
    apiAny.labor.respondToLaborItemByAccessToken,
  );
  const saveLaborItemComment = useMutation(
    apiAny.labor.saveLaborItemCommentByAccessToken,
  );
  const submitPublicSurvey = useMutation(
    apiAny.surveys.submitPublicSurveyResponseByAccessToken,
  );
  const getInvoiceDownloadUrl = useAction(
    apiAny.projectPaymentActions
      .getProjectPaymentInvoiceDownloadUrlByAccessToken,
  );
  const getStripePaymentLinkUrl = useAction(
    apiAny.projectPaymentActions.getProjectPaymentStripeLinkByAccessToken,
  );
  const publicBudgetSummaryData = useQuery(
    apiAny.projectBudget.getPublicProjectBudgetSummaryByAccessToken,
    panelData?.settings?.showBudget ? { accessToken } : "skip",
  );
  const publicSurveysData = useQuery(
    apiAny.surveys.getPublicSurveysByAccessToken,
    respondentKey && (panelData?.settings?.showSurveys ?? false)
      ? { accessToken, respondentKey }
      : "skip",
  );

  const [localSelection, setLocalSelection] = useState<
    Record<string, string[]>
  >({});
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [openSurveyId, setOpenSurveyId] = useState<string | null>(null);
  const [submittingSurveyId, setSubmittingSurveyId] = useState<string | null>(
    null,
  );
  const [surveyStartTimes, setSurveyStartTimes] = useState<
    Record<string, number>
  >({});
  const [surveyAnswers, setSurveyAnswers] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [isExportingMaterialsPdf, setIsExportingMaterialsPdf] = useState(false);
  const [isExportingLaborPdf, setIsExportingLaborPdf] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [respondentName, setRespondentName] = useState("");
  const [selectedMoodboardFile, setSelectedMoodboardFile] =
    useState<ClientPanelFile | null>(null);
  const [downloadingPaymentId, setDownloadingPaymentId] = useState<
    string | null
  >(null);
  const [openingPaymentId, setOpeningPaymentId] = useState<string | null>(null);
  const [shoppingItemComments, setShoppingItemComments] = useState<
    Record<string, string>
  >({});
  const [respondingShoppingItemId, setRespondingShoppingItemId] = useState<
    string | null
  >(null);
  const [expandedShoppingItemComments, setExpandedShoppingItemComments] =
    useState<Record<string, boolean>>({});
  const [savingShoppingCommentIds, setSavingShoppingCommentIds] = useState<
    Record<string, boolean>
  >({});
  const [savedShoppingCommentIds, setSavedShoppingCommentIds] = useState<
    Record<string, boolean>
  >({});
  const [laborItemComments, setLaborItemComments] = useState<
    Record<string, string>
  >({});
  const [respondingLaborItemId, setRespondingLaborItemId] = useState<
    string | null
  >(null);
  const [expandedLaborItemComments, setExpandedLaborItemComments] = useState<
    Record<string, boolean>
  >({});
  const [savingLaborCommentIds, setSavingLaborCommentIds] = useState<
    Record<string, boolean>
  >({});
  const [savedLaborCommentIds, setSavedLaborCommentIds] = useState<
    Record<string, boolean>
  >({});
  const commentAutosaveTimeoutsRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const commentSavedStateTimeoutsRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const laborCommentAutosaveTimeoutsRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const laborCommentSavedStateTimeoutsRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});

  const project = panelData?.project;
  const sections =
    (panelData?.sections as ClientPanelSection[] | undefined) ?? EMPTY_SECTIONS;
  const items =
    (panelData?.items as ClientPanelItem[] | undefined) ?? EMPTY_ITEMS;
  const files =
    (panelData?.files as ClientPanelFile[] | undefined) ?? EMPTY_FILES;
  const moodboardFiles =
    (panelData?.moodboardFiles as ClientPanelFile[] | undefined) ?? EMPTY_FILES;
  const surveys =
    (publicSurveysData?.surveys as PublicSurvey[] | undefined) ?? EMPTY_SURVEYS;
  const tasks = (panelData?.tasks as PublicTask[] | undefined) ?? EMPTY_TASKS;
  const laborItems =
    (panelData?.labor as PublicLaborItem[] | undefined) ?? EMPTY_LABOR_ITEMS;
  const laborSections =
    (panelData?.laborSections as PublicLaborSection[] | undefined) ??
    EMPTY_LABOR_SECTIONS;
  const contacts =
    (panelData?.contacts as PublicContact[] | undefined) ?? EMPTY_CONTACTS;
  const payments =
    (panelData?.payments as PublicPayment[] | undefined) ?? EMPTY_PAYMENTS;
  const publicBudgetSummary = publicBudgetSummaryData as
    | PublicBudgetSummary
    | null
    | undefined;
  const settings = panelData?.settings ?? DEFAULT_CLIENT_PANEL_SETTINGS;
  const organizationTaxSettings = resolveOrganizationTaxSettings(
    panelData?.organizationTaxSettings,
  );
  const currencySymbol = getCurrencySymbol(project?.currency);
  const primaryAmountKind = getPrimaryAmountKindForDisplay(
    organizationTaxSettings,
  );
  const formatPrimaryDisplayAmount = (netAmount?: number) => {
    if (netAmount === undefined) {
      return "-";
    }

    const breakdown = calculateTaxBreakdown(netAmount, organizationTaxSettings);
    return formatAmount(breakdown[primaryAmountKind], currencySymbol);
  };
  const formatTaxBreakdownSummary = (netAmount: number) => {
    const breakdown = calculateTaxBreakdown(netAmount, organizationTaxSettings);
    return getTaxAmountKindsForDisplay(organizationTaxSettings)
      .map(
        (kind) =>
          `${getTaxAmountKindLabel(kind, organizationTaxSettings)}: ${formatAmount(
            breakdown[kind],
            currencySymbol,
          )}`,
      )
      .join(" | ");
  };
  const getPriceMetadataLabels = (
    netAmount: number | undefined,
    scope: "unit" | "total",
  ) => {
    if (netAmount === undefined) {
      return [];
    }

    const breakdown = calculateTaxBreakdown(netAmount, organizationTaxSettings);
    return getTaxAmountKindsForDisplay(organizationTaxSettings).map(
      (kind) =>
        `${getTaxAmountKindLabel(kind, organizationTaxSettings)}${
          scope === "unit" ? "/unit" : ""
        }: ${formatAmount(breakdown[kind], currencySymbol)}`,
    );
  };
  const shoppingPdfPriceColumns = [{ key: "totalNet", label: "Net" }];
  const laborPdfPriceColumns = [
    { key: "unitNet", label: "Unit Net" },
    { key: "totalNet", label: "Net" },
  ];
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

  useEffect(() => {
    setLaborItemComments((current) => {
      const next = { ...current };
      for (const item of laborItems) {
        const itemId = String(item._id);
        if (typeof next[itemId] !== "string") {
          next[itemId] = item.customerDecisionComment || "";
        }
      }
      return next;
    });
  }, [laborItems]);

  useEffect(
    () => () => {
      Object.values(commentAutosaveTimeoutsRef.current).forEach((timeoutId) =>
        clearTimeout(timeoutId),
      );
      Object.values(commentSavedStateTimeoutsRef.current).forEach((timeoutId) =>
        clearTimeout(timeoutId),
      );
      Object.values(laborCommentAutosaveTimeoutsRef.current).forEach(
        (timeoutId) => clearTimeout(timeoutId),
      );
      Object.values(laborCommentSavedStateTimeoutsRef.current).forEach(
        (timeoutId) => clearTimeout(timeoutId),
      );
    },
    [],
  );

  const shoppingGroupsBySection = useMemo(() => {
    const sectionOrder = new Map(
      sections.map((section) => [section.name, section.order]),
    );
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
        const setItems = sortedItems.filter(
          (entry) => String(entry.setId ?? "") === setKey,
        );
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
        return (
          sum +
          countedItems.reduce(
            (sectionSum, item) => sectionSum + (item.totalPrice || 0),
            0,
          )
        );
      }, 0);

      return {
        sectionName,
        itemCount: groups.length,
        total,
      };
    },
  );

  const grandTotal = sectionSummaries.reduce(
    (sum, section) => sum + section.total,
    0,
  );
  const materialsItemCount = sectionSummaries.reduce(
    (sum, section) => sum + section.itemCount,
    0,
  );
  const shoppingExportSections = useMemo(
    () =>
      Array.from(shoppingGroupsBySection.entries()).map(
        ([sectionName, groups]) => ({
          sectionName,
          rows: groups.flatMap((group) => {
            const selectedIds = getSelectedIdsForGroup(group, localSelection);
            const countedItems = getCountedItemsForGroup(group, selectedIds);
            const printableItems =
              countedItems.length > 0 ? countedItems : group.items;

            return printableItems.map((item): ShoppingExportRow => {
              const unitBreakdown = calculateTaxBreakdown(
                item.unitPrice,
                organizationTaxSettings,
              );
              const totalBreakdown = calculateTaxBreakdown(
                item.totalPrice,
                organizationTaxSettings,
              );

              return {
                sectionName,
                product: formatShoppingExportProductLabel(
                  item.name,
                  item.setTitle || group.leadItem.setTitle || group.title,
                ),
                qty: String(item.quantity),
                unitNet: formatMoney(unitBreakdown.net, currencySymbol),
                unitTax: formatMoney(unitBreakdown.tax, currencySymbol),
                unitGross: formatMoney(unitBreakdown.gross, currencySymbol),
                totalNet: formatMoney(totalBreakdown.net, currencySymbol),
                totalTax: formatMoney(totalBreakdown.tax, currencySymbol),
                totalGross: formatMoney(totalBreakdown.gross, currencySymbol),
                status: getStatusLabel(item.realizationStatus) || "-",
                supplier: item.supplier || "-",
                notes: item.notes || "-",
              };
            });
          }),
        }),
      ),
    [
      currencySymbol,
      localSelection,
      organizationTaxSettings,
      shoppingGroupsBySection,
    ],
  );
  const shoppingExportRows = shoppingExportSections.flatMap(
    (section) => section.rows,
  );
  const laborSectionEntries = useMemo(() => {
    const sectionOrder = new Map(
      laborSections.map((section) => [String(section._id), section.order]),
    );
    const sectionNameById = new Map(
      laborSections.map((section) => [String(section._id), section.name]),
    );
    const buckets = new Map<
      string,
      { name: string; items: PublicLaborItem[] }
    >();

    const ensureBucket = (key: string, name: string) => {
      if (!buckets.has(key)) {
        buckets.set(key, { name, items: [] });
      }
      return buckets.get(key)!;
    };

    for (const item of laborItems) {
      const key = item.sectionId ? String(item.sectionId) : "__none__";
      const name = item.sectionId
        ? sectionNameById.get(String(item.sectionId)) || "No Category"
        : "No Category";
      ensureBucket(key, name).items.push(item);
    }

    for (const section of laborSections) {
      ensureBucket(String(section._id), section.name);
    }

    return Array.from(buckets.entries())
      .map(([key, value]) => ({
        key,
        name: value.name,
        items: value.items
          .slice()
          .sort((left, right) => left.name.localeCompare(right.name)),
      }))
      .sort((left, right) => {
        if (left.name === "No Category") return 1;
        if (right.name === "No Category") return -1;
        const leftOrder = sectionOrder.get(left.key) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder =
          sectionOrder.get(right.key) ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return left.name.localeCompare(right.name);
      });
  }, [laborItems, laborSections]);
  const laborExportSections = useMemo(
    () =>
      laborSectionEntries.map((section) => ({
        sectionName: section.name,
        rows: section.items.map((item): LaborExportRow => {
          const unitBreakdown = calculateTaxBreakdown(
            item.unitPrice,
            organizationTaxSettings,
          );
          const totalBreakdown = calculateTaxBreakdown(
            item.totalPrice,
            organizationTaxSettings,
          );

          return {
            sectionName: section.name,
            work: item.name,
            qty: String(item.quantity),
            unit: item.unit || "-",
            unitNet: formatMoney(unitBreakdown.net, currencySymbol),
            unitTax: formatMoney(unitBreakdown.tax, currencySymbol),
            unitGross: formatMoney(unitBreakdown.gross, currencySymbol),
            totalNet: formatMoney(totalBreakdown.net, currencySymbol),
            totalTax: formatMoney(totalBreakdown.tax, currencySymbol),
            totalGross: formatMoney(totalBreakdown.gross, currencySymbol),
            notes: item.notes || "-",
            referenceLink: item.referenceLink || "-",
          };
        }),
      })),
    [currencySymbol, laborSectionEntries, organizationTaxSettings],
  );
  const laborExportRows = laborExportSections.flatMap(
    (section) => section.rows,
  );

  const sectionCards = [
    settings.showShoppingList
      ? {
          id: "portal-materials",
          label: "Shopping List",
          count: materialsItemCount,
          icon: ShoppingCart,
          eyebrow: "Materials",
        }
      : null,
    settings.showSurveys
      ? {
          id: "portal-surveys",
          label: "Surveys",
          count: surveys.length,
          icon: ClipboardList,
          eyebrow: "Forms",
        }
      : null,
    settings.showFiles
      ? {
          id: "portal-files",
          label: "Files",
          count: files.length,
          icon: FolderOpen,
          eyebrow: "Assets",
        }
      : null,
    settings.showMoodboard
      ? {
          id: "portal-moodboard",
          label: "Moodboard",
          count: moodboardFiles.length,
          icon: ImageIcon,
          eyebrow: "Inspiration",
        }
      : null,
    settings.showTasks
      ? {
          id: "portal-tasks",
          label: "Tasks",
          count: tasks.length,
          icon: CheckSquare2,
          eyebrow: "Plan",
        }
      : null,
    settings.showLabor
      ? {
          id: "portal-labor",
          label: "Labor",
          count: laborItems.length,
          icon: Hammer,
          eyebrow: "Work",
        }
      : null,
    settings.showContacts
      ? {
          id: "portal-contacts",
          label: "Contacts",
          count: contacts.length,
          icon: Users,
          eyebrow: "People",
        }
      : null,
    settings.showPayments
      ? {
          id: "portal-payments",
          label: "Payments",
          count: payments.length,
          icon: Wallet,
          eyebrow: "Finance",
        }
      : null,
    settings.showBudget
      ? {
          id: "portal-budget",
          label: "Budget",
          count: publicBudgetSummary
            ? 4
            : typeof project?.budget === "number"
              ? 1
              : 0,
          icon: Banknote,
          eyebrow: "Overview",
        }
      : null,
  ].filter(
    (
      section,
    ): section is {
      id: string;
      label: string;
      count: number;
      icon: typeof ShoppingCart;
      eyebrow: string;
    } => !!section,
  );

  useEffect(() => {
    if (sectionCards.length === 0) {
      setActiveSectionId(null);
      return;
    }
    setActiveSectionId((current) =>
      current && sectionCards.some((section) => section.id === current)
        ? current
        : sectionCards[0].id,
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
    const pendingCommentSave = commentAutosaveTimeoutsRef.current[itemId];
    if (pendingCommentSave) {
      clearTimeout(pendingCommentSave);
      delete commentAutosaveTimeoutsRef.current[itemId];
    }
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
        comment: settings.allowShoppingItemComments
          ? shoppingItemComments[itemId]?.trim() || null
          : null,
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

  const persistShoppingItemComment = async (
    item: ClientPanelItem,
    rawComment: string,
  ) => {
    const itemId = String(item.sourceItemId);
    const cleanedRespondentName = respondentName.trim();

    setSavingShoppingCommentIds((current) => ({ ...current, [itemId]: true }));
    setSavedShoppingCommentIds((current) => ({ ...current, [itemId]: false }));

    try {
      if (typeof window !== "undefined" && cleanedRespondentName) {
        const storageKey = `client-panel-respondent-name:${accessToken}`;
        window.localStorage.setItem(storageKey, cleanedRespondentName);
      }

      await saveShoppingItemComment({
        accessToken,
        itemId: item.sourceItemId,
        comment: rawComment.trim() || null,
        respondentName: cleanedRespondentName,
      });

      setSavingShoppingCommentIds((current) => ({
        ...current,
        [itemId]: false,
      }));
      setSavedShoppingCommentIds((current) => ({ ...current, [itemId]: true }));

      const existingSavedTimeout = commentSavedStateTimeoutsRef.current[itemId];
      if (existingSavedTimeout) {
        clearTimeout(existingSavedTimeout);
      }
      commentSavedStateTimeoutsRef.current[itemId] = setTimeout(() => {
        setSavedShoppingCommentIds((current) => ({
          ...current,
          [itemId]: false,
        }));
        delete commentSavedStateTimeoutsRef.current[itemId];
      }, 1800);
    } catch (error) {
      setSavingShoppingCommentIds((current) => ({
        ...current,
        [itemId]: false,
      }));
      toast.error("Failed to save comment", {
        description: (error as Error).message,
      });
    }
  };

  const handleShoppingItemCommentChange = (
    item: ClientPanelItem,
    nextValue: string,
  ) => {
    const itemId = String(item.sourceItemId);

    setShoppingItemComments((current) => ({
      ...current,
      [itemId]: nextValue,
    }));
    setSavedShoppingCommentIds((current) => ({ ...current, [itemId]: false }));

    const existingTimeout = commentAutosaveTimeoutsRef.current[itemId];
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    commentAutosaveTimeoutsRef.current[itemId] = setTimeout(() => {
      void persistShoppingItemComment(item, nextValue);
      delete commentAutosaveTimeoutsRef.current[itemId];
    }, 700);
  };

  const handleRespondToLaborItem = async (
    item: PublicLaborItem,
    decision: "accepted" | "rejected",
  ) => {
    const cleanedRespondentName = respondentName.trim();
    const itemId = String(item._id);
    const pendingCommentSave = laborCommentAutosaveTimeoutsRef.current[itemId];
    if (pendingCommentSave) {
      clearTimeout(pendingCommentSave);
      delete laborCommentAutosaveTimeoutsRef.current[itemId];
    }
    setRespondingLaborItemId(itemId);

    try {
      if (typeof window !== "undefined" && cleanedRespondentName) {
        const storageKey = `client-panel-respondent-name:${accessToken}`;
        window.localStorage.setItem(storageKey, cleanedRespondentName);
      }

      await respondToLaborItem({
        accessToken,
        itemId: item._id,
        decision,
        comment: laborItemComments[itemId]?.trim() || null,
        respondentName: cleanedRespondentName,
      });

      toast.success(`Feedback saved for "${item.name}"`);
    } catch (error) {
      toast.error("Failed to save labor feedback", {
        description: (error as Error).message,
      });
    } finally {
      setRespondingLaborItemId(null);
    }
  };

  const persistLaborItemComment = async (
    item: PublicLaborItem,
    rawComment: string,
  ) => {
    const itemId = String(item._id);
    const cleanedRespondentName = respondentName.trim();

    setSavingLaborCommentIds((current) => ({ ...current, [itemId]: true }));
    setSavedLaborCommentIds((current) => ({ ...current, [itemId]: false }));

    try {
      if (typeof window !== "undefined" && cleanedRespondentName) {
        const storageKey = `client-panel-respondent-name:${accessToken}`;
        window.localStorage.setItem(storageKey, cleanedRespondentName);
      }

      await saveLaborItemComment({
        accessToken,
        itemId: item._id,
        comment: rawComment.trim() || null,
        respondentName: cleanedRespondentName,
      });

      setSavingLaborCommentIds((current) => ({ ...current, [itemId]: false }));
      setSavedLaborCommentIds((current) => ({ ...current, [itemId]: true }));

      const existingSavedTimeout =
        laborCommentSavedStateTimeoutsRef.current[itemId];
      if (existingSavedTimeout) {
        clearTimeout(existingSavedTimeout);
      }
      laborCommentSavedStateTimeoutsRef.current[itemId] = setTimeout(() => {
        setSavedLaborCommentIds((current) => ({ ...current, [itemId]: false }));
        delete laborCommentSavedStateTimeoutsRef.current[itemId];
      }, 1800);
    } catch (error) {
      setSavingLaborCommentIds((current) => ({ ...current, [itemId]: false }));
      toast.error("Failed to save labor comment", {
        description: (error as Error).message,
      });
    }
  };

  const handleLaborItemCommentChange = (
    item: PublicLaborItem,
    nextValue: string,
  ) => {
    const itemId = String(item._id);

    setLaborItemComments((current) => ({
      ...current,
      [itemId]: nextValue,
    }));
    setSavedLaborCommentIds((current) => ({ ...current, [itemId]: false }));

    const existingTimeout = laborCommentAutosaveTimeoutsRef.current[itemId];
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    laborCommentAutosaveTimeoutsRef.current[itemId] = setTimeout(() => {
      void persistLaborItemComment(item, nextValue);
      delete laborCommentAutosaveTimeoutsRef.current[itemId];
    }, 700);
  };

  const renderShoppingItemFeedback = (item: ClientPanelItem) => {
    if (
      !settings.allowShoppingItemDecisions &&
      !settings.allowShoppingItemComments
    ) {
      return null;
    }

    const itemId = String(item.sourceItemId);
    const isSaving = respondingShoppingItemId === itemId;
    const isCommentSaving = savingShoppingCommentIds[itemId] === true;
    const isCommentSaved = savedShoppingCommentIds[itemId] === true;
    const hasDecision =
      item.customerDecision === "accepted" ||
      item.customerDecision === "rejected";
    const decisionTone =
      item.customerDecision === "accepted"
        ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
        : item.customerDecision === "rejected"
          ? "border-destructive/20 bg-destructive/10 text-destructive"
          : "";
    const hasDraftComment =
      (shoppingItemComments[itemId] || "").trim().length > 0;
    const hasSavedComment = Boolean(item.customerDecisionComment);
    const isCommentExpanded =
      expandedShoppingItemComments[itemId] ?? hasDraftComment;

    return (
      <div className="mt-4 rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Client feedback
            </Badge>
            {item.customerDecision ? (
              <Badge variant="outline" className={cn("text-xs", decisionTone)}>
                {item.customerDecision === "accepted" ? "Accepted" : "Rejected"}
              </Badge>
            ) : settings.allowShoppingItemDecisions ? (
              <span className="text-xs text-muted-foreground">
                Awaiting decision
              </span>
            ) : settings.allowShoppingItemComments ? (
              <span className="text-xs text-muted-foreground">
                Comments enabled
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                Feedback disabled
              </span>
            )}
            {item.customerDecisionUpdatedAt ? (
              <span className="text-xs text-muted-foreground">
                Updated{" "}
                {new Date(item.customerDecisionUpdatedAt).toLocaleString()}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {settings.allowShoppingItemDecisions ? (
              hasDecision ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isSaving}
                    >
                      <MoreHorizontal data-icon="inline-start" />
                      {isSaving ? "Saving..." : "Change"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-48 rounded-xl border-border/70"
                  >
                    {item.customerDecision !== "accepted" ? (
                      <DropdownMenuItem
                        onClick={() =>
                          void handleRespondToShoppingItem(item, "accepted")
                        }
                      >
                        <CheckCircle2 data-icon="inline-start" />
                        Mark as accepted
                      </DropdownMenuItem>
                    ) : null}
                    {item.customerDecision !== "rejected" ? (
                      <DropdownMenuItem
                        onClick={() =>
                          void handleRespondToShoppingItem(item, "rejected")
                        }
                      >
                        <XCircle data-icon="inline-start" />
                        Mark as rejected
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:border-emerald-700 focus-visible:ring-emerald-200"
                    onClick={() =>
                      void handleRespondToShoppingItem(item, "accepted")
                    }
                    disabled={isSaving}
                  >
                    <CheckCircle2 data-icon="inline-start" />
                    {isSaving ? "Saving..." : "Approve"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-red-600 text-white hover:bg-red-700 focus-visible:border-red-700 focus-visible:ring-red-200"
                    onClick={() =>
                      void handleRespondToShoppingItem(item, "rejected")
                    }
                    disabled={isSaving}
                  >
                    <XCircle data-icon="inline-start" />
                    Reject
                  </Button>
                </>
              )
            ) : null}
            {settings.allowShoppingItemComments ? (
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
                {isCommentExpanded
                  ? "Hide editor"
                  : hasSavedComment
                    ? "Edit comment"
                    : "Add comment"}
              </Button>
            ) : null}
          </div>
        </div>

        {hasDecision && item.customerDecisionComment ? (
          <p className="mt-3 text-sm leading-6 text-foreground">
            {item.customerDecisionComment}
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-3">
          {settings.allowShoppingItemComments && isCommentExpanded ? (
            <div className="flex flex-col gap-2">
              <Label
                htmlFor={`shopping-item-comment-${itemId}`}
                className="text-sm font-medium"
              >
                Optional comment
              </Label>
              <Textarea
                id={`shopping-item-comment-${itemId}`}
                value={shoppingItemComments[itemId] || ""}
                onChange={(event) =>
                  handleShoppingItemCommentChange(item, event.target.value)
                }
                rows={3}
                placeholder="Add context, preferences or constraints for this item..."
              />
              <div className="text-xs text-muted-foreground">
                {isCommentSaving
                  ? "Saving comment..."
                  : isCommentSaved
                    ? "Comment saved"
                    : "Comment autosaves"}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderLaborItemFeedback = (item: PublicLaborItem) => {
    const itemId = String(item._id);
    const isSaving = respondingLaborItemId === itemId;
    const isCommentSaving = savingLaborCommentIds[itemId] === true;
    const isCommentSaved = savedLaborCommentIds[itemId] === true;
    const hasDecision =
      item.customerDecision === "accepted" ||
      item.customerDecision === "rejected";
    const decisionTone =
      item.customerDecision === "accepted"
        ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
        : item.customerDecision === "rejected"
          ? "border-destructive/20 bg-destructive/10 text-destructive"
          : "";
    const hasDraftComment =
      (laborItemComments[itemId] || "").trim().length > 0;
    const hasSavedComment = Boolean(item.customerDecisionComment);
    const isCommentExpanded =
      expandedLaborItemComments[itemId] ?? hasDraftComment;

    return (
      <div className="mt-4 rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Client feedback
            </Badge>
            {item.customerDecision ? (
              <Badge variant="outline" className={cn("text-xs", decisionTone)}>
                {item.customerDecision === "accepted" ? "Accepted" : "Rejected"}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">
                Awaiting decision
              </span>
            )}
            {item.customerDecisionUpdatedAt ? (
              <span className="text-xs text-muted-foreground">
                Updated{" "}
                {new Date(item.customerDecisionUpdatedAt).toLocaleString()}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {hasDecision ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={isSaving}
                  >
                    <MoreHorizontal data-icon="inline-start" />
                    {isSaving ? "Saving..." : "Change"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-48 rounded-xl border-border/70"
                >
                  {item.customerDecision !== "accepted" ? (
                    <DropdownMenuItem
                      onClick={() =>
                        void handleRespondToLaborItem(item, "accepted")
                      }
                    >
                      <CheckCircle2 data-icon="inline-start" />
                      Mark as accepted
                    </DropdownMenuItem>
                  ) : null}
                  {item.customerDecision !== "rejected" ? (
                    <DropdownMenuItem
                      onClick={() =>
                        void handleRespondToLaborItem(item, "rejected")
                      }
                    >
                      <XCircle data-icon="inline-start" />
                      Mark as rejected
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:border-emerald-700 focus-visible:ring-emerald-200"
                  onClick={() =>
                    void handleRespondToLaborItem(item, "accepted")
                  }
                  disabled={isSaving}
                >
                  <CheckCircle2 data-icon="inline-start" />
                  {isSaving ? "Saving..." : "Approve"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-red-600 text-white hover:bg-red-700 focus-visible:border-red-700 focus-visible:ring-red-200"
                  onClick={() =>
                    void handleRespondToLaborItem(item, "rejected")
                  }
                  disabled={isSaving}
                >
                  <XCircle data-icon="inline-start" />
                  Reject
                </Button>
              </>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                setExpandedLaborItemComments((current) => ({
                  ...current,
                  [itemId]: !isCommentExpanded,
                }))
              }
            >
              <ClipboardList data-icon="inline-start" />
              {isCommentExpanded
                ? "Hide editor"
                : hasSavedComment
                  ? "Edit comment"
                  : "Add comment"}
            </Button>
          </div>
        </div>

        {hasDecision && item.customerDecisionComment ? (
          <p className="mt-3 text-sm leading-6 text-foreground">
            {item.customerDecisionComment}
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-3">
          {isCommentExpanded ? (
            <div className="flex flex-col gap-2">
              <Label
                htmlFor={`labor-item-comment-${itemId}`}
                className="text-sm font-medium"
              >
                Optional comment
              </Label>
              <Textarea
                id={`labor-item-comment-${itemId}`}
                value={laborItemComments[itemId] || ""}
                onChange={(event) =>
                  handleLaborItemCommentChange(item, event.target.value)
                }
                placeholder="Add context for the project team"
                rows={3}
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {isCommentSaving ? <span>Saving comment...</span> : null}
                {isCommentSaved ? <span>Comment saved</span> : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const handleExportMaterialsPdf = async () => {
    if (!project || shoppingExportRows.length === 0) {
      toast.info("No shopping list items available for export.");
      return;
    }

    setIsExportingMaterialsPdf(true);
    try {
      const dateStamp = new Date().toISOString().slice(0, 10);
      await exportSectionedTablePdf({
        columns: [
          { key: "product", label: "Product" },
          { key: "qty", label: "Qty" },
          ...(settings.showPrice ? shoppingPdfPriceColumns : []),
          { key: "status", label: "Status" },
          ...(settings.showSupplier
            ? [{ key: "supplier", label: "Supplier" }]
            : []),
          ...(settings.showNotes ? [{ key: "notes", label: "Notes" }] : []),
        ],
        fileName: `shopping-list-${sanitizeFileName(project.name)}-${dateStamp}.pdf`,
        generatedOn: new Date().toLocaleString(),
        groupBySections: true,
        sections: shoppingExportSections.map((section) => ({
          sectionName: section.sectionName,
          rows: section.rows.map((row) => ({
            product: row.product,
            qty: row.qty,
            ...(settings.showPrice
              ? {
                  totalNet: row.totalNet,
                  totalTax: row.totalTax,
                  totalGross: row.totalGross,
                }
              : {}),
            status: row.status,
            ...(settings.showSupplier ? { supplier: row.supplier } : {}),
            ...(settings.showNotes ? { notes: row.notes } : {}),
          })),
        })),
        subtitle: settings.showPrice
          ? `Items: ${shoppingExportRows.length} | ${formatTaxBreakdownSummary(grandTotal)}`
          : `Items: ${shoppingExportRows.length}`,
        title: `Shopping List - ${project.name}`,
      });
      toast.success("Shopping list PDF exported.");
    } catch (error) {
      console.error("Shopping list PDF export error:", error);
      toast.error("Failed to export shopping list PDF.");
    } finally {
      setIsExportingMaterialsPdf(false);
    }
  };

  const handleExportMaterialsCsv = () => {
    if (!project || shoppingExportRows.length === 0) {
      toast.info("No shopping list items available for export.");
      return;
    }

    const dateStamp = new Date().toISOString().slice(0, 10);
    downloadCsvFile({
      fileName: `shopping-list-${sanitizeFileName(project.name)}-${dateStamp}.csv`,
      headers: getShoppingExportHeaders(
        {
          includeNotes: settings.showNotes,
          includeSection: true,
          includeStatus: true,
          includeSupplier: settings.showSupplier,
        },
        organizationTaxSettings,
      ),
      rows: shoppingExportRows.map((row) =>
        getShoppingExportCsvRow(
          row,
          {
            includeNotes: settings.showNotes,
            includeSection: true,
            includeStatus: true,
            includeSupplier: settings.showSupplier,
          },
          organizationTaxSettings,
        ),
      ),
    });
    toast.success("Shopping list CSV exported.");
  };

  const handleExportLaborPdf = async () => {
    if (!project || laborExportRows.length === 0) {
      toast.info("No labor entries available for export.");
      return;
    }

    setIsExportingLaborPdf(true);
    try {
      const dateStamp = new Date().toISOString().slice(0, 10);
      await exportSectionedTablePdf({
        columns: [
          { key: "work", label: "Work" },
          { key: "qty", label: "Qty" },
          { key: "unit", label: "Unit" },
          ...laborPdfPriceColumns,
          { key: "notes", label: "Notes" },
        ],
        fileName: `labor-${sanitizeFileName(project.name)}-${dateStamp}.pdf`,
        generatedOn: new Date().toLocaleString(),
        groupBySections: true,
        sections: laborExportSections.map((section) => ({
          sectionName: section.sectionName,
          rows: section.rows.map((row) => ({
            work: row.work,
            qty: row.qty,
            unit: row.unit,
            unitNet: row.unitNet,
            unitTax: row.unitTax,
            unitGross: row.unitGross,
            totalNet: row.totalNet,
            totalTax: row.totalTax,
            totalGross: row.totalGross,
            notes: row.notes,
          })),
        })),
        subtitle: `Items: ${laborExportRows.length} | ${formatTaxBreakdownSummary(
          laborItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0),
        )}`,
        title: `Labor - ${project.name}`,
      });
      toast.success("Labor PDF exported.");
    } catch (error) {
      console.error("Labor PDF export error:", error);
      toast.error("Failed to export labor PDF.");
    } finally {
      setIsExportingLaborPdf(false);
    }
  };

  const handleExportLaborCsv = () => {
    if (!project || laborExportRows.length === 0) {
      toast.info("No labor entries available for export.");
      return;
    }

    const dateStamp = new Date().toISOString().slice(0, 10);
    downloadCsvFile({
      fileName: `labor-${sanitizeFileName(project.name)}-${dateStamp}.csv`,
      headers: getLaborExportHeaders(
        {
          includeNotes: true,
          includeReferenceLink: true,
          includeSection: true,
        },
        organizationTaxSettings,
      ),
      rows: laborExportRows.map((row) =>
        getLaborExportCsvRow(
          row,
          {
            includeNotes: true,
            includeReferenceLink: true,
            includeSection: true,
          },
          organizationTaxSettings,
        ),
      ),
    });
    toast.success("Labor CSV exported.");
  };

  const handleSelectSetItems = async (
    group: ShoppingGroup,
    nextSelectedIds: string[],
  ) => {
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

  const updateSurveyAnswer = (
    surveyId: string,
    questionId: string,
    value: unknown,
  ) => {
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
      prev[surveyId] ? prev : { ...prev, [surveyId]: Date.now() },
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
      metadata.timeSpent = Math.max(
        0,
        Math.round((Date.now() - startedAt) / 1000),
      );
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

  const activeExportMenu = (() => {
    if (
      activeSectionId === "portal-materials" &&
      settings.showShoppingList &&
      sectionSummaries.length > 0
    ) {
      return {
        label: "Export shopping list",
        busyLabel: isExportingMaterialsPdf ? "Exporting PDF..." : null,
        items: [
          {
            key: "shopping-csv",
            label: "Download CSV",
            icon: FileSpreadsheet,
            action: handleExportMaterialsCsv,
            disabled: false,
          },
          {
            key: "shopping-pdf",
            label: isExportingMaterialsPdf ? "Exporting PDF..." : "Download PDF",
            icon: Download,
            action: () => void handleExportMaterialsPdf(),
            disabled: isExportingMaterialsPdf,
          },
        ],
      };
    }

    if (
      activeSectionId === "portal-labor" &&
      settings.showLabor &&
      laborItems.length > 0
    ) {
      return {
        label: "Export labor",
        busyLabel: isExportingLaborPdf ? "Exporting PDF..." : null,
        items: [
          {
            key: "labor-csv",
            label: "Download CSV",
            icon: FileSpreadsheet,
            action: handleExportLaborCsv,
            disabled: false,
          },
          {
            key: "labor-pdf",
            label: isExportingLaborPdf ? "Exporting PDF..." : "Download PDF",
            icon: Download,
            action: () => void handleExportLaborPdf(),
            disabled: isExportingLaborPdf,
          },
        ],
      };
    }

    return null;
  })();

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
                {getTaxAmountKindLabel(
                  primaryAmountKind,
                  organizationTaxSettings,
                )}{" "}
                total: {formatPrimaryDisplayAmount(grandTotal)}
              </span>
            ) : null}
          </div>
          <p className="max-w-4xl text-sm text-muted-foreground">
            Choose a section shared by the project team.
          </p>
          {sectionCards.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-3">
                {sectionCards.map((section) => {
                  const isActive = activeSectionId === section.id;
                  const Icon = section.icon;

                  return (
                    <Button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveSectionId(section.id)}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-auto min-h-0 items-center gap-3 rounded-full border px-3 py-3 text-left transition-all duration-150 sm:px-4",
                        isActive
                          ? "border-foreground/15 bg-background text-foreground shadow-[0_10px_30px_-22px_rgba(0,0,0,0.18)] hover:border-foreground/25 hover:bg-background"
                          : "border-border bg-white text-foreground hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-background hover:shadow-[0_10px_24px_-20px_rgba(0,0,0,0.14)]",
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-9 items-center justify-center rounded-full border",
                          isActive
                            ? "border-foreground/10 bg-white text-foreground"
                            : "border-border bg-muted/30 text-muted-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="flex flex-col items-start leading-none">
                        <span className="text-sm font-medium sm:text-[15px]">
                          {section.label}
                        </span>
                        <span
                          className={cn(
                            "mt-1 text-xs",
                            isActive
                              ? "text-foreground/65"
                              : "text-muted-foreground",
                          )}
                        >
                          {section.count} items
                        </span>
                      </div>
                      {isActive ? (
                        <span className="rounded-full border border-foreground/10 bg-white px-2.5 py-1 text-[11px] font-medium text-foreground/70">
                          Current
                        </span>
                      ) : null}
                    </Button>
                  );
                })}
              </div>
              {activeExportMenu ? (
                <div className="pt-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-fit rounded-full border-border bg-white pr-3 text-foreground shadow-none hover:bg-white"
                      >
                        <Download data-icon="inline-start" />
                        {activeExportMenu.busyLabel ?? activeExportMenu.label}
                        <ChevronDown className="ml-1 size-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-56 rounded-2xl border-border/70 p-1"
                    >
                      {activeExportMenu.items.map((item) => (
                        <DropdownMenuItem
                          key={item.key}
                          onClick={item.action}
                          disabled={item.disabled}
                          className="rounded-xl"
                        >
                          <item.icon data-icon="inline-start" />
                          {item.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {panelData.version === 0 ? (
        <div className="mb-8 rounded-2xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
          This portal has not been updated yet. Ask the project team to click
          Update portal in project settings.
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
                    <p className="truncate text-sm font-medium text-foreground">
                      {file.name}
                    </p>
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
              <p className="text-sm text-muted-foreground">
                No moodboard items shared.
              </p>
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
              <div
                className="max-h-full max-w-6xl"
                onClick={(event) => event.stopPropagation()}
              >
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
            Share your feedback directly in the portal. Responses are sent to
            the project team.
          </p>
          {surveys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No surveys shared.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {surveys.map((survey) => {
                const surveyId = String(survey._id);
                const isOpen = openSurveyId === surveyId;
                const isSubmitting = submittingSurveyId === surveyId;
                const isLocked =
                  survey.hasSubmitted && !survey.allowMultipleResponses;
                const hasRequiredFileQuestion = survey.questions.some(
                  (question) =>
                    question.questionType === "file" && question.isRequired,
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
                          <h3 className="text-lg font-medium text-foreground">
                            {survey.title}
                          </h3>
                          {survey.isRequired ? (
                            <Badge
                              variant="destructive"
                              className="text-[10px]"
                            >
                              Required
                            </Badge>
                          ) : null}
                          {survey.hasSubmitted ? (
                            <Badge variant="outline" className="text-[10px]">
                              <CheckCircle2 data-icon="inline-start" />
                              Submitted
                            </Badge>
                          ) : null}
                        </div>
                        {survey.description ? (
                          <p className="text-sm text-muted-foreground">
                            {survey.description}
                          </p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          {survey.questions.length} question
                          {survey.questions.length === 1 ? "" : "s"}
                          {survey.submittedAt
                            ? ` · last submitted ${new Date(survey.submittedAt).toLocaleString()}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {!isLocked ? (
                          <Button
                            type="button"
                            variant={isOpen ? "outline" : "default"}
                            onClick={() => handleOpenSurvey(surveyId)}
                          >
                            {isOpen
                              ? "Hide"
                              : survey.hasSubmitted
                                ? "Submit again"
                                : "Fill survey"}
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
                          <Label
                            htmlFor={`respondent-name-${surveyId}`}
                            className="text-sm font-medium"
                          >
                            Who is answering survey "{survey.title}"?
                          </Label>
                          <Input
                            id={`respondent-name-${surveyId}`}
                            value={respondentName}
                            onChange={(event) =>
                              setRespondentName(event.target.value)
                            }
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
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  Question {index + 1}
                                </Badge>
                                {question.isRequired ? (
                                  <Badge
                                    variant="destructive"
                                    className="text-[10px]"
                                  >
                                    Required
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="mb-3 text-sm font-medium text-foreground">
                                {question.questionText}
                              </p>

                              {question.questionType === "text_short" ||
                              question.questionType === "text_long" ? (
                                question.questionType === "text_long" ? (
                                  <Textarea
                                    value={
                                      typeof answerValue === "string"
                                        ? answerValue
                                        : ""
                                    }
                                    onChange={(event) =>
                                      updateSurveyAnswer(
                                        surveyId,
                                        questionId,
                                        event.target.value,
                                      )
                                    }
                                    placeholder="Your answer"
                                    rows={4}
                                  />
                                ) : (
                                  <Input
                                    value={
                                      typeof answerValue === "string"
                                        ? answerValue
                                        : ""
                                    }
                                    onChange={(event) =>
                                      updateSurveyAnswer(
                                        surveyId,
                                        questionId,
                                        event.target.value,
                                      )
                                    }
                                    placeholder="Your answer"
                                  />
                                )
                              ) : null}

                              {question.questionType === "single_choice" ? (
                                <RadioGroup
                                  value={
                                    typeof answerValue === "string"
                                      ? answerValue
                                      : ""
                                  }
                                  onValueChange={(value) =>
                                    updateSurveyAnswer(
                                      surveyId,
                                      questionId,
                                      value,
                                    )
                                  }
                                  className="flex flex-col gap-2"
                                >
                                  {(question.options || []).map((option) => (
                                    <div
                                      key={option}
                                      className="flex items-center gap-2"
                                    >
                                      <RadioGroupItem
                                        value={option}
                                        id={`${questionId}-${option}`}
                                      />
                                      <Label
                                        htmlFor={`${questionId}-${option}`}
                                      >
                                        {option}
                                      </Label>
                                    </div>
                                  ))}
                                </RadioGroup>
                              ) : null}

                              {question.questionType === "multiple_choice" ? (
                                <div className="flex flex-col gap-2">
                                  {(question.options || []).map((option) => {
                                    const selectedValues = Array.isArray(
                                      answerValue,
                                    )
                                      ? answerValue.filter(
                                          (value): value is string =>
                                            typeof value === "string",
                                        )
                                      : [];
                                    const checked =
                                      selectedValues.includes(option);
                                    return (
                                      <div
                                        key={option}
                                        className="flex items-center gap-2"
                                      >
                                        <Checkbox
                                          id={`${questionId}-${option}`}
                                          checked={checked}
                                          onCheckedChange={(nextChecked) => {
                                            const nextValues = nextChecked
                                              ? [...selectedValues, option]
                                              : selectedValues.filter(
                                                  (value) => value !== option,
                                                );
                                            updateSurveyAnswer(
                                              surveyId,
                                              questionId,
                                              nextValues,
                                            );
                                          }}
                                        />
                                        <Label
                                          htmlFor={`${questionId}-${option}`}
                                        >
                                          {option}
                                        </Label>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}

                              {question.questionType === "rating" ? (
                                <RadioGroup
                                  value={
                                    typeof answerValue === "number"
                                      ? String(answerValue)
                                      : ""
                                  }
                                  onValueChange={(value) =>
                                    updateSurveyAnswer(
                                      surveyId,
                                      questionId,
                                      Number.parseInt(value, 10),
                                    )
                                  }
                                  className="flex flex-col gap-2"
                                >
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>
                                      {question.ratingScale?.minLabel ||
                                        question.ratingScale?.min ||
                                        1}
                                    </span>
                                    <span>
                                      {question.ratingScale?.maxLabel ||
                                        question.ratingScale?.max ||
                                        5}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-3">
                                    {Array.from(
                                      {
                                        length:
                                          (question.ratingScale?.max || 5) -
                                          (question.ratingScale?.min || 1) +
                                          1,
                                      },
                                      (_, i) =>
                                        (question.ratingScale?.min || 1) + i,
                                    ).map((value) => (
                                      <div
                                        key={value}
                                        className="flex items-center gap-2"
                                      >
                                        <RadioGroupItem
                                          value={String(value)}
                                          id={`${questionId}-${value}`}
                                        />
                                        <Label
                                          htmlFor={`${questionId}-${value}`}
                                        >
                                          {value}
                                        </Label>
                                      </div>
                                    ))}
                                  </div>
                                </RadioGroup>
                              ) : null}

                              {question.questionType === "yes_no" ? (
                                <RadioGroup
                                  value={
                                    typeof answerValue === "boolean"
                                      ? String(answerValue)
                                      : ""
                                  }
                                  onValueChange={(value) =>
                                    updateSurveyAnswer(
                                      surveyId,
                                      questionId,
                                      value === "true",
                                    )
                                  }
                                  className="flex flex-col gap-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <RadioGroupItem
                                      value="true"
                                      id={`${questionId}-yes`}
                                    />
                                    <Label htmlFor={`${questionId}-yes`}>
                                      Yes
                                    </Label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <RadioGroupItem
                                      value="false"
                                      id={`${questionId}-no`}
                                    />
                                    <Label htmlFor={`${questionId}-no`}>
                                      No
                                    </Label>
                                  </div>
                                </RadioGroup>
                              ) : null}

                              {question.questionType === "number" ? (
                                <Input
                                  type="number"
                                  value={
                                    typeof answerValue === "number"
                                      ? String(answerValue)
                                      : ""
                                  }
                                  onChange={(event) => {
                                    const raw = event.target.value;
                                    if (raw.trim() === "") {
                                      updateSurveyAnswer(
                                        surveyId,
                                        questionId,
                                        undefined,
                                      );
                                      return;
                                    }
                                    const parsed = Number.parseFloat(raw);
                                    updateSurveyAnswer(
                                      surveyId,
                                      questionId,
                                      Number.isNaN(parsed) ? undefined : parsed,
                                    );
                                  }}
                                  placeholder="Enter number"
                                />
                              ) : null}

                              {question.questionType === "file" ? (
                                <p className="text-xs text-muted-foreground">
                                  File uploads are not available in the public
                                  portal yet.
                                </p>
                              ) : null}
                            </div>
                          );
                        })}

                        {hasRequiredFileQuestion ? (
                          <p className="text-xs text-destructive">
                            This survey has required file upload questions and
                            cannot be submitted in the public portal.
                          </p>
                        ) : null}

                        <div className="flex justify-end">
                          <Button
                            type="button"
                            onClick={() =>
                              void handleSubmitPublicSurvey(survey)
                            }
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
                    <p className="text-sm font-medium text-foreground">
                      {task.title}
                    </p>
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
                    <p className="mt-2 text-sm text-muted-foreground">
                      {task.description}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Start: {formatPortalDate(task.startDate)} · End:{" "}
                    {formatPortalDate(task.endDate)}
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
              const sectionTotal = section.items.reduce(
                (sum, item) => sum + (item.totalPrice || 0),
                0,
              );

              return (
                <div
                  key={section.key}
                  className="mb-10 rounded-3xl border border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-8"
                >
                  <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8 sm:gap-4">
                    <h2 className="text-lg font-medium text-foreground sm:text-xl">
                      {section.name}
                    </h2>
                    <Badge
                      variant="outline"
                      className="rounded-full px-3 py-1 text-xs font-medium"
                    >
                      {section.items.length} items
                    </Badge>
                    {sectionTotal > 0 ? (
                      <Badge
                        variant="secondary"
                        className="rounded-full px-3 py-1 text-xs font-medium"
                      >
                        {formatPrimaryDisplayAmount(sectionTotal)}
                      </Badge>
                    ) : null}
                  </div>

                  {section.items.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {section.items.map((item) => (
                        <PortalItemCard
                          key={item._id}
                          name={item.name}
                          className={cn(
                            "border-border/70",
                            item.customerDecision === "accepted" &&
                              "border-emerald-500/25 bg-emerald-500/6",
                            item.customerDecision === "rejected" &&
                              "border-destructive/20 bg-destructive/5",
                          )}
                          badges={
                            item.customerDecision ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  item.customerDecision === "accepted"
                                    ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                                    : "border-destructive/20 bg-destructive/10 text-destructive",
                                )}
                              >
                                {item.customerDecision === "accepted"
                                  ? "Accepted"
                                  : "Rejected"}
                              </Badge>
                            ) : null
                          }
                          metadata={
                            <>
                              <span>Qty: {item.quantity}</span>
                              <span>Unit: {item.unit}</span>
                              {getPriceMetadataLabels(
                                item.unitPrice,
                                "unit",
                              ).map((label) => (
                                <span key={`${item._id}-unit-${label}`}>
                                  {label}
                                </span>
                              ))}
                              {getPriceMetadataLabels(
                                item.totalPrice,
                                "total",
                              ).map((label) => (
                                <span
                                  key={`${item._id}-total-${label}`}
                                  className="font-medium text-foreground"
                                >
                                  {label}
                                </span>
                              ))}
                            </>
                          }
                          description={item.notes}
                          sideContent={
                            <>
                              {item.referenceLink ? (
                                <a
                                  href={item.referenceLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs text-foreground hover:bg-muted/80"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Link
                                </a>
                              ) : null}
                              {item.attachmentFileId ? (
                                <Badge variant="outline" className="text-xs">
                                  Attachment in Files/labor
                                </Badge>
                              ) : null}
                            </>
                          }
                          footer={renderLaborItemFeedback(item)}
                        />
                      ))}

                      {sectionTotal > 0 ? (
                        <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
                          <span className="text-sm font-medium text-foreground">
                            Section Total
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {formatTaxBreakdownSummary(sectionTotal)}
                          </span>
                        </div>
                      ) : null}
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
                    <p className="text-sm font-medium text-foreground">
                      {contact.name}
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {contact.type.toUpperCase()}
                    </Badge>
                  </div>
                  {contact.companyName ? (
                    <p className="mt-2 text-sm text-foreground">
                      {contact.companyName}
                    </p>
                  ) : null}
                  {contact.email || contact.phone ? (
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
                    {formatAmount(
                      publicBudgetSummary.plannedCost,
                      currencySymbol,
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {publicBudgetSummary.projectedUtilizationPercent ?? 0}% of
                    budget
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card p-5">
                  <p className="text-sm text-muted-foreground">
                    Committed cost
                  </p>
                  <p className="mt-2 text-xl font-medium font-serif text-foreground">
                    {formatAmount(
                      publicBudgetSummary.committedCost,
                      currencySymbol,
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Approved and scheduled spend
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card p-5">
                  <p className="text-sm text-muted-foreground">Actual cost</p>
                  <p className="mt-2 text-xl font-medium font-serif text-foreground">
                    {formatAmount(
                      publicBudgetSummary.actualCost,
                      currencySymbol,
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {publicBudgetSummary.utilizationPercent ?? 0}% of budget
                    used
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
                      {publicBudgetSummary.variance < 0
                        ? "Over budget"
                        : "Within budget"}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-muted px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Remaining now
                      </p>
                      <p className="mt-2 text-lg font-medium text-foreground">
                        {formatAmount(
                          publicBudgetSummary.variance,
                          currencySymbol,
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Projected remaining
                      </p>
                      <p className="mt-2 text-lg font-medium text-foreground">
                        {formatAmount(
                          publicBudgetSummary.projectedVariance,
                          currencySymbol,
                        )}
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
                      <span className="text-muted-foreground">
                        Accepted estimates
                      </span>
                      <span className="font-medium text-foreground">
                        {formatAmount(
                          publicBudgetSummary.clientFunding.acceptedEstimations,
                          currencySymbol,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        Scheduled payments
                      </span>
                      <span className="font-medium text-foreground">
                        {formatAmount(
                          publicBudgetSummary.clientFunding.scheduledPayments,
                          currencySymbol,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        Collected payments
                      </span>
                      <span className="font-medium text-foreground">
                        {formatAmount(
                          publicBudgetSummary.clientFunding.collectedPayments,
                          currencySymbol,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        Outstanding payments
                      </span>
                      <span className="font-medium text-foreground">
                        {formatAmount(
                          publicBudgetSummary.clientFunding.outstandingPayments,
                          currencySymbol,
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-card p-5">
                  <p className="text-base font-medium text-foreground">
                    Materials
                  </p>
                  <div className="mt-4 flex flex-col gap-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Planned</span>
                      <span className="font-medium text-foreground">
                        {formatAmount(
                          publicBudgetSummary.breakdown.shopping.planned,
                          currencySymbol,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Committed</span>
                      <span className="font-medium text-foreground">
                        {formatAmount(
                          publicBudgetSummary.breakdown.shopping.committed,
                          currencySymbol,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Actual</span>
                      <span className="font-medium text-foreground">
                        {formatAmount(
                          publicBudgetSummary.breakdown.shopping.actual,
                          currencySymbol,
                        )}
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
                        {formatAmount(
                          publicBudgetSummary.breakdown.labor.planned,
                          currencySymbol,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Committed</span>
                      <span className="font-medium text-foreground">
                        {formatAmount(
                          publicBudgetSummary.breakdown.labor.committed,
                          currencySymbol,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Actual</span>
                      <span className="font-medium text-foreground">
                        {formatAmount(
                          publicBudgetSummary.breakdown.labor.actual,
                          currencySymbol,
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : typeof project?.budget === "number" ? (
            <div className="rounded-xl border border-border/70 bg-card p-6">
              <p className="mb-2 text-sm text-muted-foreground">
                Project budget
              </p>
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
            <p className="text-sm text-muted-foreground">
              No budget set for this project.
            </p>
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
            <p className="text-sm text-muted-foreground">
              No installments shared yet.
            </p>
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
                          {payment.isOverdue
                            ? "OVERDUE"
                            : payment.status.toUpperCase()}
                        </span>
                        {payment.invoiceNumber ? (
                          <span className="text-xs text-muted-foreground">
                            #{payment.invoiceNumber}
                          </span>
                        ) : null}
                      </div>
                      {payment.description ? (
                        <p className="text-sm text-muted-foreground">
                          {payment.description}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-4 text-sm text-foreground">
                        <span>
                          {formatAmount(payment.amount, currencySymbol)}
                        </span>
                        <span>
                          {payment.dueDate
                            ? `Due ${new Date(payment.dueDate).toLocaleDateString()}`
                            : "No due date"}
                        </span>
                        {payment.paidAt ? (
                          <span>
                            Paid {new Date(payment.paidAt).toLocaleDateString()}
                          </span>
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
                      {payment.bankAccountNumber || payment.bankName ? (
                        <div className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground">
                          <p className="font-medium">
                            {payment.bankAccountHolder ||
                              "Bank transfer details"}
                          </p>
                          {payment.bankName ? (
                            <p className="text-muted-foreground">
                              {payment.bankName}
                            </p>
                          ) : null}
                          {payment.bankAccountNumber ? (
                            <p className="mt-1 font-medium tracking-[0.02em]">
                              {payment.bankAccountNumber}
                            </p>
                          ) : null}
                          {payment.bankSwift ? (
                            <p className="text-muted-foreground">
                              SWIFT: {payment.bankSwift}
                            </p>
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
                          onClick={() =>
                            void handleOpenPaymentLink(payment._id)
                          }
                          disabled={openingPaymentId === payment._id}
                        >
                          <ExternalLink data-icon="inline-start" />
                          {openingPaymentId === payment._id
                            ? "Opening..."
                            : "Pay online"}
                        </Button>
                      ) : null}
                      {payment.hasInvoicePdf ? (
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            payment.status === "paid" ? "outline" : "default"
                          }
                          onClick={() =>
                            void handleDownloadInvoice(payment._id)
                          }
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
              const sectionGroups =
                shoppingGroupsBySection.get(sectionName) || [];

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
                        {formatPrimaryDisplayAmount(total)}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-4">
                    {sectionGroups.map((group) => {
                      const selectedIds = getSelectedIdsForGroup(
                        group,
                        localSelection,
                      );
                      const countedItems = getCountedItemsForGroup(
                        group,
                        selectedIds,
                      );

                      if (!group.setId) {
                        const option = group.items[0];
                        const optionStatusLabel = getStatusLabel(
                          option.realizationStatus,
                        );

                        return (
                          <PortalItemCard
                            key={group.key}
                            imageUrl={option.imageUrl}
                            name={option.name}
                            className={cn(
                              !countedItems.some(
                                (entry) =>
                                  entry.sourceItemId === option.sourceItemId,
                              ) && "border-border/70 bg-muted/10",
                            )}
                            badges={
                              !countedItems.some(
                                (entry) =>
                                  entry.sourceItemId === option.sourceItemId,
                              ) ? (
                                <Badge variant="secondary" className="text-xs">
                                  Not counted in total
                                </Badge>
                              ) : null
                            }
                            metadata={
                              <>
                                <span>{getQtyLabel(option)}</span>
                                {settings.showPrice
                                  ? getPriceMetadataLabels(
                                      option.unitPrice,
                                      "unit",
                                    ).map((label) => (
                                      <span key={`${option._id}-unit-${label}`}>
                                        {label}
                                      </span>
                                    ))
                                  : null}
                                {settings.showPrice
                                  ? getPriceMetadataLabels(
                                      option.totalPrice,
                                      "total",
                                    ).map((label) => (
                                      <span
                                        key={`${option._id}-total-${label}`}
                                        className="font-medium text-foreground"
                                      >
                                        {label}
                                      </span>
                                    ))
                                  : null}
                                {settings.showSupplier && option.supplier ? (
                                  <span>{option.supplier}</span>
                                ) : null}
                              </>
                            }
                            description={
                              settings.showNotes ? option.notes : undefined
                            }
                            sideContent={
                              <>
                                {optionStatusLabel ? (
                                  <Badge variant="secondary">
                                    {optionStatusLabel}
                                  </Badge>
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
                              </>
                            }
                            footer={renderShoppingItemFeedback(option)}
                          />
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
                                <h3 className="text-base font-medium text-foreground">
                                  {group.title}
                                </h3>
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
                              const showFeedback =
                                group.selectionMode === "none" || isSelected;
                              const optionStatusLabel = getStatusLabel(
                                option.realizationStatus,
                              );

                              return (
                                <div
                                  key={optionId}
                                  className={cn(
                                    "flex flex-col gap-3 rounded-2xl transition-colors",
                                    isSelected &&
                                      "bg-emerald-500/5 ring-1 ring-emerald-500/20",
                                  )}
                                >
                                  {group.selectionMode !== "none" ? (
                                    <div className="flex justify-end">
                                      {group.selectionMode === "multiple" ? (
                                        <Button
                                          size="sm"
                                          variant={
                                            isSelected ? "default" : "outline"
                                          }
                                          onClick={() => {
                                            const next = isSelected
                                              ? selectedIds.filter(
                                                  (entry) => entry !== optionId,
                                                )
                                              : Array.from(
                                                  new Set([
                                                    ...selectedIds,
                                                    optionId,
                                                  ]),
                                                );
                                            void handleSelectSetItems(
                                              group,
                                              next,
                                            );
                                          }}
                                        >
                                          {isSelected ? "Included" : "Include"}
                                        </Button>
                                      ) : (
                                        <Button
                                          size="sm"
                                          variant="default"
                                          onClick={() =>
                                            void handleSelectSetItems(group, [
                                              optionId,
                                            ])
                                          }
                                        >
                                          {isSelected
                                            ? "Selected"
                                            : "Choose this option"}
                                        </Button>
                                      )}
                                    </div>
                                  ) : null}

                                  <PortalItemCard
                                    imageUrl={option.imageUrl}
                                    name={option.name}
                                    className={cn(
                                      isSelected &&
                                        "border-emerald-500/40 bg-emerald-500/5 shadow-sm",
                                      !countedItems.some(
                                        (entry) =>
                                          entry.sourceItemId ===
                                          option.sourceItemId,
                                      ) && "border-border/70 bg-muted/10",
                                    )}
                                    badges={
                                      <>
                                        {isSelected ? (
                                          <Badge
                                            variant="secondary"
                                            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                                          >
                                            {group.selectionMode === "multiple"
                                              ? "Included"
                                              : "Selected option"}
                                          </Badge>
                                        ) : null}
                                        <Badge
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          Alternative
                                        </Badge>
                                        {!countedItems.some(
                                          (entry) =>
                                            entry.sourceItemId ===
                                            option.sourceItemId,
                                        ) ? (
                                          <Badge
                                            variant="secondary"
                                            className="text-xs"
                                          >
                                            Not counted in total
                                          </Badge>
                                        ) : null}
                                      </>
                                    }
                                    metadata={
                                      <>
                                        <span>{getQtyLabel(option)}</span>
                                        {settings.showPrice
                                          ? getPriceMetadataLabels(
                                              option.unitPrice,
                                              "unit",
                                            ).map((label) => (
                                              <span
                                                key={`${option._id}-unit-${label}`}
                                              >
                                                {label}
                                              </span>
                                            ))
                                          : null}
                                        {settings.showPrice
                                          ? getPriceMetadataLabels(
                                              option.totalPrice,
                                              "total",
                                            ).map((label) => (
                                              <span
                                                key={`${option._id}-total-${label}`}
                                                className="font-medium text-foreground"
                                              >
                                                {label}
                                              </span>
                                            ))
                                          : null}
                                        {settings.showSupplier &&
                                        option.supplier ? (
                                          <span>{option.supplier}</span>
                                        ) : null}
                                      </>
                                    }
                                    description={
                                      settings.showNotes
                                        ? option.notes
                                        : undefined
                                    }
                                    sideContent={
                                      <>
                                        {isSelected ? (
                                          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                                            {group.selectionMode === "multiple"
                                              ? "Included"
                                              : "Selected"}
                                          </Badge>
                                        ) : null}
                                        {optionStatusLabel ? (
                                          <Badge variant="secondary">
                                            {optionStatusLabel}
                                          </Badge>
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
                                      </>
                                    }
                                    footer={
                                      showFeedback
                                        ? renderShoppingItemFeedback(option)
                                        : null
                                    }
                                  />
                                </div>
                              );
                            })}
                          </div>

                          {savingItemId === group.key ? (
                            <p className="pt-3 text-xs text-muted-foreground">
                              Saving selection...
                            </p>
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
              <div
                key={sectionName}
                className="flex items-center justify-between text-base text-foreground"
              >
                <span className="font-medium">{sectionName}</span>
                <span>{formatTaxBreakdownSummary(total)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="text-xl font-medium text-foreground">
                Grand Total
              </span>
              <span className="text-2xl font-medium text-foreground">
                {formatTaxBreakdownSummary(grandTotal)}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
