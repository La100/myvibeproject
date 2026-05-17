"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  Upload,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { apiAny } from "@/lib/convexApiAny";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
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
  MoodboardImageGrid,
  MoodboardImageGridItem,
} from "@/components/moodboard/MoodboardImageGrid";
import {
  getShoppingExportCsvRow,
  getShoppingExportHeaders,
  type ShoppingExportRow,
} from "@/lib/shoppingListExport";
import { calculatePriceTaxBreakdown, type PriceTaxMetadata } from "@/lib/priceTax";
import { cn, getCurrencySymbol } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

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
  moodboardOrder?: number;
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
  priceTaxMode?: PriceTaxMetadata["priceTaxMode"];
  taxRateId?: string | null;
  taxRateSnapshot?: PriceTaxMetadata["taxRateSnapshot"];
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
type PublicMoodboardSection = {
  id: string;
  title: string;
  order: number;
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
  answerType: "text" | "choice" | "rating" | "number" | "boolean" | "file";
  textAnswer?: string;
  choiceAnswers?: string[];
  ratingAnswer?: number;
  numberAnswer?: number;
  booleanAnswer?: boolean;
  fileAnswer?: {
    fileId: Id<"files">;
    fileName: string;
    fileSize: number;
    fileType: string;
    fileUrl?: string;
  };
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
const EMPTY_MOODBOARD_SECTIONS: PublicMoodboardSection[] = [];
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

const getChoiceLabel = (
  selectionMode: ShoppingGroup["selectionMode"],
  t: ReturnType<typeof useI18n>["t"],
) => {
  if (selectionMode === "single") {
    return t("clientPanel", "chooseOneOption");
  }
  if (selectionMode === "multiple") {
    return t("clientPanel", "chooseAnyOptions");
  }
  return t("clientPanel", "included");
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

const getQtyLabel = (item: ClientPanelItem, t: ReturnType<typeof useI18n>["t"]) =>
  t("clientPanel", "qty", { quantity: `${item.quantity} ${item.unit || "pcs"}` });

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

const formatMoodboardSectionLabel = (
  section: string | undefined,
  t: ReturnType<typeof useI18n>["t"],
) => {
  const normalized = section?.trim();
  if (!normalized) return t("clientPanel", "moodboard");
  return /^\d+$/.test(normalized)
    ? t("clientPanel", "section", { section: normalized })
    : normalized;
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
  if (question.questionType === "file") {
    if (
      !value ||
      typeof value !== "object" ||
      !("fileId" in value) ||
      !("fileName" in value) ||
      !("fileSize" in value) ||
      !("fileType" in value)
    ) {
      return null;
    }
    const fileAnswer = value as {
      fileId: Id<"files">;
      fileName: string;
      fileSize: number;
      fileType: string;
      fileUrl?: string;
    };
    return {
      questionId: question._id,
      answerType: "file",
      fileAnswer: {
        fileId: fileAnswer.fileId,
        fileName: fileAnswer.fileName,
        fileSize: fileAnswer.fileSize,
        fileType: fileAnswer.fileType,
      },
    };
  }

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
    const allowedOptions = new Set(question.options || []);
    if (!allowedOptions.has(value)) return null;
    return {
      questionId: question._id,
      answerType: "choice",
      choiceAnswers: [value],
    };
  }

  if (question.questionType === "multiple_choice") {
    if (!Array.isArray(value)) return null;
    const allowedOptions = new Set(question.options || []);
    const selectedValues = value.filter(
      (option): option is string =>
        typeof option === "string" && allowedOptions.has(option),
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
    const min = question.ratingScale?.min ?? 1;
    const max = question.ratingScale?.max ?? 5;
    if (value < min || value > max) return null;
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
      ? "aspect-[4/3] w-full sm:aspect-auto sm:h-24 sm:w-24"
      : "h-24 w-24";

  if (imageUrl) {
    return (
      <div
        className={`${sizeClass} overflow-hidden rounded-2xl border border-black/6 bg-[#eee9df]`}
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
    <div
      className={cn(
        "rounded-2xl border border-black/7 bg-white/74 p-4 shadow-sm",
        className,
      )}
    >
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
                <h4 className="text-base font-medium tracking-[-0.02em] text-foreground sm:text-lg">
                  {name}
                </h4>
                {badges}
              </div>
              {metadata ? (
                <div className="flex flex-col gap-1 text-sm text-foreground/54 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                  {metadata}
                </div>
              ) : null}
              {description ? (
                <p className="mt-3 text-sm leading-6 text-foreground/56">
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

function ClientPanelLoading() {
  return (
    <Spinner className="mx-auto w-full max-w-[1600px] px-6 pb-24 pt-8 sm:px-8 2xl:px-10" />
  );
}

export default function PublicClientPanelPage() {
  const { t } = useI18n();
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
  const generatePublicSurveyUploadUrl = useMutation(
    apiAny.files.generatePublicSurveyUploadUrl,
  );
  const addPublicSurveyFile = useMutation(apiAny.files.addPublicSurveyFile);
  const getInvoiceDownloadUrl = useAction(
    apiAny.projectPaymentActions
      .getProjectPaymentInvoiceDownloadUrlByAccessToken,
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
  const [uploadingSurveyFileQuestionId, setUploadingSurveyFileQuestionId] =
    useState<string | null>(null);
  const [isExportingMaterialsPdf, setIsExportingMaterialsPdf] = useState(false);
  const [isExportingLaborPdf, setIsExportingLaborPdf] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [respondentName, setRespondentName] = useState("");
  const [selectedMoodboardFile, setSelectedMoodboardFile] =
    useState<ClientPanelFile | null>(null);
  const [downloadingPaymentId, setDownloadingPaymentId] = useState<
    string | null
  >(null);
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
  const publishedMoodboardSections =
    (panelData?.moodboardSections as PublicMoodboardSection[] | undefined) ??
    EMPTY_MOODBOARD_SECTIONS;
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
  const currencySymbol = getCurrencySymbol(project?.currency);
  const getItemPriceTaxMetadata = useCallback((
    item: Pick<
      PriceTaxMetadata,
      "priceTaxMode" | "taxRateId" | "taxRateSnapshot"
    >,
  ): PriceTaxMetadata => ({
    priceTaxMode: item.priceTaxMode ?? "unspecified",
    taxRateId: item.taxRateId ?? null,
    taxRateSnapshot: item.taxRateSnapshot ?? null,
  }), []);
  const getItemPriceMetadataLabels = useCallback((
    amount: number | undefined,
    item: Pick<
      PriceTaxMetadata,
      "priceTaxMode" | "taxRateId" | "taxRateSnapshot"
    >,
    scope: "unit" | "total",
  ) => {
    if (amount === undefined) {
      return [];
    }

    const scopeSuffix = scope === "unit" ? "/unit" : "";
    const breakdown = calculatePriceTaxBreakdown(
      amount,
      getItemPriceTaxMetadata(item),
    );

    if (!breakdown.hasBreakdown) {
      return [`Price${scopeSuffix}: ${formatAmount(breakdown.amount, currencySymbol)}`];
    }

    if (breakdown.mode === "exempt") {
      return [
        `Tax exempt${scopeSuffix}: ${formatAmount(
          breakdown.gross,
          currencySymbol,
        )}`,
      ];
    }

    const primaryLabel = breakdown.mode === "gross" ? "Gross" : "Net";
    const primaryAmount =
      breakdown.mode === "gross" ? breakdown.gross : breakdown.net;
    const secondaryLabel = breakdown.mode === "gross" ? "Net" : "Gross";
    const secondaryAmount =
      breakdown.mode === "gross" ? breakdown.net : breakdown.gross;

    return [
      `${primaryLabel}${scopeSuffix}: ${formatAmount(primaryAmount, currencySymbol)}`,
      `${breakdown.taxLabel} ${breakdown.taxRate}%${scopeSuffix}: ${formatAmount(
        breakdown.tax,
        currencySymbol,
      )}`,
      `${secondaryLabel}${scopeSuffix}: ${formatAmount(
        secondaryAmount,
        currencySymbol,
      )}`,
    ];
  }, [currencySymbol, getItemPriceTaxMetadata]);
  const shoppingPdfPriceColumns = [{ key: "totalNet", label: t("clientPanel", "total") }];
  const laborPdfPriceColumns = [
    { key: "unitNet", label: t("clientPanel", "unitPrice") },
    { key: "totalNet", label: t("clientPanel", "total") },
  ];
  const moodboardSections = useMemo(() => {
    const grouped = new Map<
      string,
      {
        sectionId: string;
        sectionLabel: string;
        sectionOrder: number;
        files: ClientPanelFile[];
      }
    >(
      publishedMoodboardSections.map((section, index) => [
        section.id,
        {
          sectionId: section.id,
          sectionLabel: section.title,
          sectionOrder: section.order ?? index,
          files: [],
        },
      ]),
    );

    for (const file of moodboardFiles) {
      const sectionId = file.moodboardSection?.trim() || "__default";
      const existing = grouped.get(sectionId);
      if (existing) {
        existing.files.push(file);
        continue;
      }

      grouped.set(sectionId, {
        sectionId,
        sectionLabel: formatMoodboardSectionLabel(file.moodboardSection, t),
        sectionOrder: Number.MAX_SAFE_INTEGER,
        files: [file],
      });
    }

    return Array.from(grouped.values())
      .map((section) => ({
        ...section,
        files: [...section.files].sort(
          (a, b) =>
            (a.moodboardOrder ?? Number.MAX_SAFE_INTEGER) -
              (b.moodboardOrder ?? Number.MAX_SAFE_INTEGER) ||
            a.uploadedAt - b.uploadedAt ||
            a.name.localeCompare(b.name),
        ),
      }))
      .filter((section) => section.files.length > 0)
      .sort(
        (a, b) =>
          a.sectionOrder - b.sectionOrder ||
          a.sectionLabel.localeCompare(b.sectionLabel),
      );
  }, [moodboardFiles, publishedMoodboardSections, t]);

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
      const sectionKey = item.sectionName?.trim() || t("clientPanel", "noSection");
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
  }, [items, sections, t]);

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
              const unitBreakdown = calculatePriceTaxBreakdown(
                item.unitPrice,
                getItemPriceTaxMetadata(item),
              );
              const totalBreakdown = calculatePriceTaxBreakdown(
                item.totalPrice,
                getItemPriceTaxMetadata(item),
              );

              return {
                sectionName,
                product: formatShoppingExportProductLabel(
                  item.name,
                  item.setTitle || group.leadItem.setTitle || group.title,
                ),
                qty: String(item.quantity),
                unitNet: formatMoney(unitBreakdown.amount, currencySymbol),
                unitTax: unitBreakdown.hasBreakdown
                  ? formatMoney(unitBreakdown.tax, currencySymbol)
                  : "-",
                unitGross: unitBreakdown.hasBreakdown
                  ? formatMoney(unitBreakdown.gross, currencySymbol)
                  : "-",
                totalNet: formatMoney(totalBreakdown.amount, currencySymbol),
                totalTax: totalBreakdown.hasBreakdown
                  ? formatMoney(totalBreakdown.tax, currencySymbol)
                  : "-",
                totalGross: totalBreakdown.hasBreakdown
                  ? formatMoney(totalBreakdown.gross, currencySymbol)
                  : "-",
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
      getItemPriceTaxMetadata,
      localSelection,
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
        ? sectionNameById.get(String(item.sectionId)) ||
          t("clientPanel", "noCategory")
        : t("clientPanel", "noCategory");
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
        if (left.name === t("clientPanel", "noCategory")) return 1;
        if (right.name === t("clientPanel", "noCategory")) return -1;
        const leftOrder = sectionOrder.get(left.key) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder =
          sectionOrder.get(right.key) ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return left.name.localeCompare(right.name);
      });
  }, [laborItems, laborSections, t]);
  const laborExportSections = useMemo(
    () =>
      laborSectionEntries.map((section) => ({
        sectionName: section.name,
        rows: section.items.map((item): LaborExportRow => {
          const unitBreakdown = calculatePriceTaxBreakdown(
            item.unitPrice,
            getItemPriceTaxMetadata(item),
          );
          const totalBreakdown = calculatePriceTaxBreakdown(
            item.totalPrice,
            getItemPriceTaxMetadata(item),
          );

          return {
            sectionName: section.name,
            work: item.name,
            qty: String(item.quantity),
            unit: item.unit || "-",
            unitNet: formatMoney(unitBreakdown.amount, currencySymbol),
            unitTax: unitBreakdown.hasBreakdown
              ? formatMoney(unitBreakdown.tax, currencySymbol)
              : "-",
            unitGross: unitBreakdown.hasBreakdown
              ? formatMoney(unitBreakdown.gross, currencySymbol)
              : "-",
            totalNet: formatMoney(totalBreakdown.amount, currencySymbol),
            totalTax: totalBreakdown.hasBreakdown
              ? formatMoney(totalBreakdown.tax, currencySymbol)
              : "-",
            totalGross: totalBreakdown.hasBreakdown
              ? formatMoney(totalBreakdown.gross, currencySymbol)
              : "-",
            notes: item.notes || "-",
            referenceLink: item.referenceLink || "-",
          };
        }),
      })),
    [currencySymbol, getItemPriceTaxMetadata, laborSectionEntries],
  );
  const laborExportRows = laborExportSections.flatMap(
    (section) => section.rows,
  );

  const sectionCards = [
    settings.showShoppingList
      ? {
          id: "portal-materials",
          label: t("clientPanel", "shoppingList"),
          count: materialsItemCount,
          icon: ShoppingCart,
        }
      : null,
    settings.showSurveys
      ? {
          id: "portal-surveys",
          label: t("clientPanel", "surveys"),
          count: surveys.length,
          icon: ClipboardList,
        }
      : null,
    settings.showFiles
      ? {
          id: "portal-files",
          label: t("clientPanel", "files"),
          count: files.length,
          icon: FolderOpen,
        }
      : null,
    settings.showMoodboard
      ? {
          id: "portal-moodboard",
          label: t("clientPanel", "moodboard"),
          count: moodboardFiles.length,
          icon: ImageIcon,
        }
      : null,
    settings.showTasks
      ? {
          id: "portal-tasks",
          label: t("clientPanel", "tasks"),
          count: tasks.length,
          icon: CheckSquare2,
        }
      : null,
    settings.showLabor
      ? {
          id: "portal-labor",
          label: t("clientPanel", "labor"),
          count: laborItems.length,
          icon: Hammer,
        }
      : null,
    settings.showContacts
      ? {
          id: "portal-contacts",
          label: t("clientPanel", "contacts"),
          count: contacts.length,
          icon: Users,
        }
      : null,
    settings.showPayments
      ? {
          id: "portal-payments",
          label: t("clientPanel", "payments"),
          count: payments.length,
          icon: Wallet,
        }
      : null,
    settings.showBudget
      ? {
          id: "portal-budget",
          label: t("clientPanel", "budget"),
          count: publicBudgetSummary
            ? 4
            : typeof project?.budget === "number"
              ? 1
              : 0,
          icon: Banknote,
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
      toast.error(t("clientPanel", "invoiceDownloadFailed"), {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setDownloadingPaymentId(null);
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

      toast.success(t("clientPanel", "feedbackSaved", { item: item.name }));
    } catch (error) {
      toast.error(t("clientPanel", "shoppingFeedbackSaveFailed"), {
        description: toUserFacingErrorMessage(error),
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
      toast.error(t("clientPanel", "commentSaveFailed"), {
        description: toUserFacingErrorMessage(error),
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

      toast.success(t("clientPanel", "feedbackSaved", { item: item.name }));
    } catch (error) {
      toast.error(t("clientPanel", "laborFeedbackSaveFailed"), {
        description: toUserFacingErrorMessage(error),
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
      toast.error(t("clientPanel", "laborCommentSaveFailed"), {
        description: toUserFacingErrorMessage(error),
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
        ? "border-[#78a65a]/45 bg-[#edf6e8] text-[#2f6f3a]"
        : item.customerDecision === "rejected"
          ? "border-destructive/20 bg-destructive/10 text-destructive"
          : "";
    const feedbackTone =
      item.customerDecision === "accepted"
        ? "border-[#78a65a]/30 bg-[#edf6e8]/55"
        : item.customerDecision === "rejected"
          ? "border-destructive/20 bg-destructive/5"
          : "border-black/7 bg-[#f8f6f1]/76";
    const hasSavedComment = Boolean(item.customerDecisionComment);
    const isCommentExpanded = expandedShoppingItemComments[itemId] ?? false;

    return (
      <div className={cn("mt-5 rounded-2xl border px-4 py-4", feedbackTone)}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {t("clientPanel", "clientFeedback")}
            </Badge>
            {item.customerDecision ? (
              <Badge variant="outline" className={cn("text-xs", decisionTone)}>
                {item.customerDecision === "accepted"
                  ? t("clientPanel", "accepted")
                  : t("clientPanel", "rejected")}
              </Badge>
            ) : settings.allowShoppingItemDecisions ? (
              <span className="text-xs text-muted-foreground">
                {t("clientPanel", "awaitingDecision")}
              </span>
            ) : settings.allowShoppingItemComments ? (
              <span className="text-xs text-muted-foreground">
                {t("clientPanel", "commentsEnabled")}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                {t("clientPanel", "feedbackDisabled")}
              </span>
            )}
            {item.customerDecisionUpdatedAt ? (
              <span className="text-xs text-muted-foreground">
                {t("clientPanel", "updatedAt", {
                  date: new Date(item.customerDecisionUpdatedAt).toLocaleString(),
                })}
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
                      {isSaving ? t("clientPanel", "saving") : t("clientPanel", "change")}
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
                        {t("clientPanel", "markAccepted")}
                      </DropdownMenuItem>
                    ) : null}
                    {item.customerDecision !== "rejected" ? (
                      <DropdownMenuItem
                        onClick={() =>
                          void handleRespondToShoppingItem(item, "rejected")
                        }
                      >
                        <XCircle data-icon="inline-start" />
                        {t("clientPanel", "markRejected")}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#1f4f3b] text-white hover:bg-[#1a4332] focus-visible:border-[#1f4f3b] focus-visible:ring-[#1f4f3b]/20"
                    onClick={() =>
                      void handleRespondToShoppingItem(item, "accepted")
                    }
                    disabled={isSaving}
                  >
                    <CheckCircle2 data-icon="inline-start" />
                    {isSaving ? t("clientPanel", "saving") : t("clientPanel", "approve")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-destructive text-white hover:bg-destructive focus-visible:border-destructive focus-visible:ring-red-200"
                    onClick={() =>
                      void handleRespondToShoppingItem(item, "rejected")
                    }
                    disabled={isSaving}
                  >
                    <XCircle data-icon="inline-start" />
                    {t("clientPanel", "reject")}
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
                  ? t("clientPanel", "hideEditor")
                  : hasSavedComment
                    ? t("clientPanel", "editComment")
                    : t("clientPanel", "addComment")}
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
                {t("clientPanel", "optionalComment")}
              </Label>
              <Textarea
                id={`shopping-item-comment-${itemId}`}
                value={shoppingItemComments[itemId] || ""}
                onChange={(event) =>
                  handleShoppingItemCommentChange(item, event.target.value)
                }
                rows={3}
                placeholder={t("clientPanel", "shoppingCommentPlaceholder")}
              />
              <div className="text-xs text-muted-foreground">
                {isCommentSaving
                  ? t("clientPanel", "savingComment")
                  : isCommentSaved
                    ? t("clientPanel", "commentSaved")
                    : t("clientPanel", "commentAutosaves")}
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
        ? "border-[#78a65a]/45 bg-[#edf6e8] text-[#2f6f3a]"
        : item.customerDecision === "rejected"
          ? "border-destructive/20 bg-destructive/10 text-destructive"
          : "";
    const feedbackTone =
      item.customerDecision === "accepted"
        ? "border-[#78a65a]/30 bg-[#edf6e8]/55"
        : item.customerDecision === "rejected"
          ? "border-destructive/20 bg-destructive/5"
          : "border-black/7 bg-[#f8f6f1]/76";
    const hasSavedComment = Boolean(item.customerDecisionComment);
    const isCommentExpanded = expandedLaborItemComments[itemId] ?? false;

    return (
      <div className={cn("mt-5 rounded-2xl border px-4 py-4", feedbackTone)}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {t("clientPanel", "clientFeedback")}
            </Badge>
            {item.customerDecision ? (
              <Badge variant="outline" className={cn("text-xs", decisionTone)}>
                {item.customerDecision === "accepted"
                  ? t("clientPanel", "accepted")
                  : t("clientPanel", "rejected")}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">
                {t("clientPanel", "awaitingDecision")}
              </span>
            )}
            {item.customerDecisionUpdatedAt ? (
              <span className="text-xs text-muted-foreground">
                {t("clientPanel", "updatedAt", {
                  date: new Date(item.customerDecisionUpdatedAt).toLocaleString(),
                })}
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
                    {isSaving ? t("clientPanel", "saving") : t("clientPanel", "change")}
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
                      {t("clientPanel", "markAccepted")}
                    </DropdownMenuItem>
                  ) : null}
                  {item.customerDecision !== "rejected" ? (
                    <DropdownMenuItem
                      onClick={() =>
                        void handleRespondToLaborItem(item, "rejected")
                      }
                    >
                      <XCircle data-icon="inline-start" />
                      {t("clientPanel", "markRejected")}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#1f4f3b] text-white hover:bg-[#1a4332] focus-visible:border-[#1f4f3b] focus-visible:ring-[#1f4f3b]/20"
                  onClick={() =>
                    void handleRespondToLaborItem(item, "accepted")
                  }
                  disabled={isSaving}
                >
                  <CheckCircle2 data-icon="inline-start" />
                  {isSaving ? t("clientPanel", "saving") : t("clientPanel", "approve")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-destructive text-white hover:bg-destructive focus-visible:border-destructive focus-visible:ring-red-200"
                  onClick={() =>
                    void handleRespondToLaborItem(item, "rejected")
                  }
                  disabled={isSaving}
                >
                  <XCircle data-icon="inline-start" />
                  {t("clientPanel", "reject")}
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
                ? t("clientPanel", "hideEditor")
                : hasSavedComment
                  ? t("clientPanel", "editComment")
                  : t("clientPanel", "addComment")}
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
                {t("clientPanel", "optionalComment")}
              </Label>
              <Textarea
                id={`labor-item-comment-${itemId}`}
                value={laborItemComments[itemId] || ""}
                onChange={(event) =>
                  handleLaborItemCommentChange(item, event.target.value)
                }
                placeholder={t("clientPanel", "laborCommentPlaceholder")}
                rows={3}
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {isCommentSaving ? (
                  <span>{t("clientPanel", "savingComment")}</span>
                ) : null}
                {isCommentSaved ? (
                  <span>{t("clientPanel", "commentSaved")}</span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const handleExportMaterialsPdf = async () => {
    if (!project || shoppingExportRows.length === 0) {
      toast.info(t("clientPanel", "noShoppingExport"));
      return;
    }

    setIsExportingMaterialsPdf(true);
    try {
      const dateStamp = new Date().toISOString().slice(0, 10);
      await exportSectionedTablePdf({
        columns: [
          { key: "product", label: t("clientPanel", "product") },
          { key: "qty", label: t("clientPanel", "qtyLabel") },
          ...(settings.showPrice ? shoppingPdfPriceColumns : []),
          { key: "status", label: t("clientPanel", "status") },
          ...(settings.showSupplier
            ? [{ key: "supplier", label: t("clientPanel", "supplier") }]
            : []),
          ...(settings.showNotes
            ? [{ key: "notes", label: t("clientPanel", "notes") }]
            : []),
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
        subtitle: t("clientPanel", "generatedItemsSubtitle", {
          count: shoppingExportRows.length,
        }),
        title: t("clientPanel", "shoppingListTitle", { project: project.name }),
      });
      toast.success(t("clientPanel", "shoppingPdfExported"));
    } catch (error) {
      console.error("Shopping list PDF export error:", error);
      toast.error(t("clientPanel", "shoppingPdfExportFailed"), {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setIsExportingMaterialsPdf(false);
    }
  };

  const handleExportMaterialsCsv = () => {
    if (!project || shoppingExportRows.length === 0) {
      toast.info(t("clientPanel", "noShoppingExport"));
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
        ),
      ),
    });
    toast.success(t("clientPanel", "shoppingCsvExported"));
  };

  const handleExportLaborPdf = async () => {
    if (!project || laborExportRows.length === 0) {
      toast.info(t("clientPanel", "noLaborExport"));
      return;
    }

    setIsExportingLaborPdf(true);
    try {
      const dateStamp = new Date().toISOString().slice(0, 10);
      await exportSectionedTablePdf({
        columns: [
          { key: "work", label: t("clientPanel", "work") },
          { key: "qty", label: t("clientPanel", "qtyLabel") },
          { key: "unit", label: t("clientPanel", "unitLabel") },
          ...laborPdfPriceColumns,
          { key: "notes", label: t("clientPanel", "notes") },
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
        subtitle: t("clientPanel", "generatedItemsSubtitle", {
          count: laborExportRows.length,
        }),
        title: t("clientPanel", "laborTitle", { project: project.name }),
      });
      toast.success(t("clientPanel", "laborPdfExported"));
    } catch (error) {
      console.error("Labor PDF export error:", error);
      toast.error(t("clientPanel", "laborPdfExportFailed"), {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setIsExportingLaborPdf(false);
    }
  };

  const handleExportLaborCsv = () => {
    if (!project || laborExportRows.length === 0) {
      toast.info(t("clientPanel", "noLaborExport"));
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
      ),
      rows: laborExportRows.map((row) =>
        getLaborExportCsvRow(
          row,
          {
            includeNotes: true,
            includeReferenceLink: true,
            includeSection: true,
          },
        ),
      ),
    });
    toast.success(t("clientPanel", "laborCsvExported"));
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
      toast.success(t("clientPanel", "choiceSaved"));
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
      toast.error(t("clientPanel", "choiceSaveFailed"), {
        description: toUserFacingErrorMessage(error),
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

  const handlePublicSurveyFileUpload = async (
    survey: PublicSurvey,
    question: PublicSurveyQuestion,
    file: File,
  ) => {
    if (!respondentKey) return;
    const maxPublicUploadBytes = 25 * 1024 * 1024;
    if (file.size > maxPublicUploadBytes) {
      toast.error(t("clientPanel", "fileTooLarge"), {
        description: t("clientPanel", "maxUploadSize"),
      });
      return;
    }

    const uploadKey = `${survey._id}:${question._id}`;
    setUploadingSurveyFileQuestionId(uploadKey);
    try {
      const mimeType = file.type || "application/octet-stream";
      const uploadData = await generatePublicSurveyUploadUrl({
        accessToken,
        surveyId: survey._id,
        questionId: question._id,
        respondentKey,
        fileName: file.name,
        fileSize: file.size,
      });

      const uploadResponse = await fetch(uploadData.url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": mimeType,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(t("clientPanel", "uploadFailed"));
      }

      const fileAnswer = await addPublicSurveyFile({
        accessToken,
        surveyId: survey._id,
        questionId: question._id,
        respondentKey,
        fileKey: uploadData.key,
        fileName: file.name,
        fileType: mimeType,
        fileSize: file.size,
      });

      updateSurveyAnswer(String(survey._id), String(question._id), fileAnswer);
      toast.success(t("clientPanel", "fileUploaded"));
    } catch (error) {
      toast.error(t("clientPanel", "fileUploadFailed"), {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setUploadingSurveyFileQuestionId(null);
    }
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
      toast.error(
        t("clientPanel", "enterSurveyRespondent", { title: survey.title }),
      );
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
      if (question.isRequired) {
        missingRequired.push(question);
      }
    }

    if (missingRequired.length > 0) {
      toast.error(t("clientPanel", "answerRequiredQuestions"), {
        description: t("clientPanel", "missingRequiredQuestions", {
          count: missingRequired.length,
          plural: missingRequired.length === 1 ? "" : "s",
        }),
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
      toast.success(t("clientPanel", "surveySubmitted"));
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
      toast.error(t("clientPanel", "surveySubmitFailed"), {
        description: toUserFacingErrorMessage(error),
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
        label: t("clientPanel", "exportShoppingList"),
        busyLabel: isExportingMaterialsPdf ? t("clientPanel", "exportingPdf") : null,
        items: [
          {
            key: "shopping-csv",
            label: t("clientPanel", "downloadCsv"),
            icon: FileSpreadsheet,
            action: handleExportMaterialsCsv,
            disabled: false,
          },
          {
            key: "shopping-pdf",
            label: isExportingMaterialsPdf
              ? t("clientPanel", "exportingPdf")
              : t("clientPanel", "downloadPdf"),
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
        label: t("clientPanel", "exportLabor"),
        busyLabel: isExportingLaborPdf ? t("clientPanel", "exportingPdf") : null,
        items: [
          {
            key: "labor-csv",
            label: t("clientPanel", "downloadCsv"),
            icon: FileSpreadsheet,
            action: handleExportLaborCsv,
            disabled: false,
          },
          {
            key: "labor-pdf",
            label: isExportingLaborPdf
              ? t("clientPanel", "exportingPdf")
              : t("clientPanel", "downloadPdf"),
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
    return <ClientPanelLoading />;
  }

  if (panelData === null || !project) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-xl items-center justify-center px-4 text-center">
        <div>
          <h1 className="mb-2 text-2xl font-semibold">
            {t("clientPanel", "invalidLinkTitle")}
          </h1>
          <p className="text-muted-foreground">
            {t("clientPanel", "invalidLinkDescription")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 pb-24 pt-8 sm:px-8 2xl:px-10">
      <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-medium tracking-tight font-serif text-foreground md:text-5xl">
              {t("clientPanel", "customerPortal")}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-primary">
              {t("clientPanel", "forProject", { project: project.name })}
            </span>
            {settings.showShoppingList &&
            settings.showPrice &&
            activeSectionId === "portal-materials" ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground">
                {t("clientPanel", "total")} {formatAmount(grandTotal, currencySymbol)}
              </span>
            ) : null}
          </div>
          {sectionCards.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
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
                        "group h-11 shrink-0 justify-start gap-2.5 rounded-full border px-3.5 text-left backdrop-blur transition-[background-color,border-color,box-shadow,transform] hover:-translate-y-0.5",
                        isActive
                          ? "border-black/7 bg-white/88 text-foreground shadow-md hover:bg-white"
                          : "border-black/6 bg-white/58 text-foreground hover:border-black/10 hover:bg-white/76 hover:shadow-sm",
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors",
                          isActive
                            ? "border-black/10 bg-[#f8f6f1]/86 text-foreground"
                            : "border-black/6 bg-[#f8f6f1]/86 text-foreground/42 group-hover:text-foreground/58",
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="whitespace-nowrap text-[14px] font-medium tracking-normal text-foreground/84">
                          {section.label}
                        </span>
                        <span
                          className={cn(
                            "ml-auto shrink-0 text-[12px]",
                            isActive
                              ? "text-foreground/58"
                              : "text-foreground/42",
                          )}
                        >
                          {t("clientPanel", "items", {
                            count: section.count,
                          })}
                        </span>
                      </div>
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
          {t("clientPanel", "portalNotUpdated")}
        </div>
      ) : null}

      {settings.showFiles && activeSectionId === "portal-files" ? (
        <div className="mb-10 rounded-3xl border border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-8">
          <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8 sm:gap-4">
            <h2 className="text-xl font-medium font-serif text-foreground sm:text-2xl">
              {t("clientPanel", "files")}
            </h2>
            <span className="inline-flex items-center justify-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {t("clientPanel", "filesCount", { count: files.length })}
            </span>
          </div>
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("clientPanel", "noFiles")}
            </p>
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
                      aria-label={t("clientPanel", "openFile", {
                        name: file.name,
                      })}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <a
                      href={file.url}
                      download={file.name}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={t("clientPanel", "downloadFile", {
                        name: file.name,
                      })}
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
                {t("clientPanel", "moodboard")}
              </h2>
              <span className="inline-flex items-center justify-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {t("clientPanel", "items", {
                  count: moodboardFiles.length,
                })}
              </span>
            </div>
            {moodboardFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("clientPanel", "noMoodboardItems")}
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
                        {t("clientPanel", "items", {
                          count: section.files.length,
                        })}
                      </span>
                    </div>

                    <MoodboardImageGrid>
                      {section.files.map((file) => {
                        const isImage = file.mimeType.startsWith("image/");
                        return (
                          <MoodboardImageGridItem
                            key={file._id}
                            className="group relative overflow-hidden rounded-xl border border-border/70 bg-card"
                          >
                            {isImage ? (
                              <button
                                type="button"
                                onClick={() => setSelectedMoodboardFile(file)}
                                className="block w-full"
                                aria-label={t("clientPanel", "previewFile", {
                                  name: file.name,
                                })}
                              >
                                <img
                                  src={file.url}
                                  alt={file.name}
                                  className="block h-auto w-full object-cover bg-muted transition-transform duration-300 group-hover:scale-[1.02]"
                                  loading="lazy"
                                />
                              </button>
                            ) : (
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block rounded-lg border border-border/70 bg-muted p-3 text-xs text-muted-foreground"
                              >
                                {t("clientPanel", "previewUnavailable")}
                              </a>
                            )}

                            <div className="absolute right-3 top-3 z-10 flex items-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card/90 text-muted-foreground hover:bg-muted hover:text-foreground"
                                aria-label={t("clientPanel", "openFile", {
                                  name: file.name,
                                })}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                              <a
                                href={file.url}
                                download={file.name}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card/90 text-muted-foreground hover:bg-muted hover:text-foreground"
                                aria-label={t("clientPanel", "downloadFile", {
                                  name: file.name,
                                })}
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            </div>
                          </MoodboardImageGridItem>
                        );
                      })}
                    </MoodboardImageGrid>
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
          {t("clientPanel", "loadingSurveys")}
        </div>
      ) : null}

      {settings.showSurveys &&
      activeSectionId === "portal-surveys" &&
      publicSurveysData !== undefined ? (
        <div className="mb-10 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-8">
          <div className="mb-7 flex flex-col gap-3 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-serif text-2xl font-medium text-foreground">
                {t("clientPanel", "surveys")}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {t("clientPanel", "surveysDescription")}
              </p>
            </div>
            <span className="inline-flex w-fit items-center justify-center rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
              {t("clientPanel", "availableCount", { count: surveys.length })}
            </span>
          </div>
          {surveys.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("clientPanel", "noSurveys")}
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {surveys.map((survey) => {
                const surveyId = String(survey._id);
                const isOpen = openSurveyId === surveyId;
                const isSubmitting = submittingSurveyId === surveyId;
                const answersForSurvey = surveyAnswers[surveyId] || {};

                return (
                  <div
                    key={surveyId}
                    className={cn(
                      "overflow-hidden rounded-2xl border bg-card shadow-sm transition-[border-color,box-shadow]",
                      isOpen
                        ? "border-primary/20 shadow-sm"
                        : "border-border/70",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
                      <div className="min-w-0 flex flex-1 flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground">
                            <ClipboardList className="h-4 w-4" />
                          </span>
                          <h3 className="text-lg font-semibold text-foreground">
                            {survey.title}
                          </h3>
                          {survey.isRequired ? (
                            <Badge
                              variant="outline"
                              className="border-destructive/20 bg-destructive/10 text-[10px] text-destructive"
                            >
                              {t("clientPanel", "required")}
                            </Badge>
                          ) : null}
                          {survey.hasSubmitted ? (
                            <Badge variant="outline" className="text-[10px]">
                              <CheckCircle2 data-icon="inline-start" />
                              {t("clientPanel", "submitted")}
                            </Badge>
                          ) : null}
                        </div>
                        {survey.description ? (
                          <p className="text-sm text-muted-foreground">
                            {survey.description}
                          </p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          {t("clientPanel", "questionsCount", {
                            count: survey.questions.length,
                            plural: survey.questions.length === 1 ? "" : "s",
                          })}
                          {survey.submittedAt
                            ? ` · ${t("clientPanel", "lastSubmitted", {
                                date: new Date(survey.submittedAt).toLocaleString(),
                              })}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          type="button"
                          variant={isOpen ? "outline" : "default"}
                          size="sm"
                          onClick={() => handleOpenSurvey(surveyId)}
                        >
                          {isOpen
                            ? t("clientPanel", "hide")
                            : survey.hasSubmitted
                              ? t("clientPanel", "submitAnother")
                              : t("clientPanel", "fillSurvey")}
                        </Button>
                      </div>
                    </div>

                    {isOpen ? (
                      <div className="flex flex-col gap-5 border-t border-border/70 bg-secondary/35 p-4 sm:p-6">
                        <div className="max-w-xl rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                          <Label
                            htmlFor={`respondent-name-${surveyId}`}
                            className="text-sm font-medium text-foreground"
                          >
                            {t("clientPanel", "respondentQuestion", {
                              title: survey.title,
                            })}
                          </Label>
                          <Input
                            id={`respondent-name-${surveyId}`}
                            value={respondentName}
                            onChange={(event) =>
                              setRespondentName(event.target.value)
                            }
                            placeholder={t("clientPanel", "yourName")}
                            maxLength={120}
                            className="mt-2 bg-background"
                          />
                        </div>

                        {survey.questions.map((question, index) => {
                          const questionId = String(question._id);
                          const answerValue = answersForSurvey[questionId];
                          return (
                            <div
                              key={questionId}
                              className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6"
                            >
                              <div className="mb-4 flex flex-wrap items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="rounded-full bg-secondary text-[11px]"
                                >
                                  {t("clientPanel", "questionLabel", {
                                    number: index + 1,
                                  })}
                                </Badge>
                                {question.isRequired ? (
                                  <Badge
                                    variant="outline"
                                    className="rounded-full border-destructive/20 bg-destructive/10 text-[11px] text-destructive"
                                  >
                                    {t("clientPanel", "required")}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="mb-4 text-base font-medium leading-6 text-foreground">
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
                                    placeholder={t("clientPanel", "yourAnswer")}
                                    rows={4}
                                    className="bg-background"
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
                                    placeholder={t("clientPanel", "yourAnswer")}
                                    className="bg-background"
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
                                  className="grid gap-2 sm:grid-cols-2"
                                >
                                  {(question.options || []).map(
                                    (option, optionIndex) => (
                                      <Label
                                        key={`${questionId}-${optionIndex}`}
                                        htmlFor={`${questionId}-option-${optionIndex}`}
                                        className={cn(
                                          "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm font-medium transition-[background-color,border-color]",
                                          answerValue === option
                                            ? "border-primary/35 bg-primary/5"
                                            : "border-border bg-background hover:border-primary/20 hover:bg-secondary/60",
                                        )}
                                      >
                                        <RadioGroupItem
                                          value={option}
                                          id={`${questionId}-option-${optionIndex}`}
                                          className="h-5 w-5"
                                        />
                                        <span>{option}</span>
                                      </Label>
                                    ),
                                  )}
                                </RadioGroup>
                              ) : null}

                              {question.questionType === "multiple_choice" ? (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {(question.options || []).map(
                                    (option, optionIndex) => {
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
                                        <Label
                                          key={`${questionId}-${optionIndex}`}
                                          htmlFor={`${questionId}-option-${optionIndex}`}
                                          className={cn(
                                            "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm font-medium transition-[background-color,border-color]",
                                            checked
                                              ? "border-primary/35 bg-primary/5"
                                              : "border-border bg-background hover:border-primary/20 hover:bg-secondary/60",
                                          )}
                                        >
                                          <Checkbox
                                            id={`${questionId}-option-${optionIndex}`}
                                            checked={checked}
                                            className="h-5 w-5 rounded-md"
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
                                          <span>{option}</span>
                                        </Label>
                                      );
                                    },
                                  )}
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
                                  className="flex flex-col gap-3"
                                >
                                  {(question.ratingScale?.minLabel ||
                                    question.ratingScale?.maxLabel) ? (
                                    <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
                                      <span className="min-w-0 truncate">
                                        {question.ratingScale?.minLabel ||
                                          question.ratingScale?.min ||
                                          1}
                                      </span>
                                      <span className="min-w-0 truncate text-right">
                                        {question.ratingScale?.maxLabel ||
                                          question.ratingScale?.max ||
                                          5}
                                      </span>
                                    </div>
                                  ) : null}
                                  <div className="grid grid-cols-5 gap-2 sm:max-w-sm">
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
                                      <Label
                                        key={value}
                                        htmlFor={`${questionId}-${value}`}
                                        className={cn(
                                          "relative flex h-12 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold transition-[background-color,border-color,color]",
                                          answerValue === value
                                            ? "border-primary bg-primary text-primary-foreground"
                                            : "border-border bg-background hover:border-primary/25",
                                        )}
                                      >
                                        <RadioGroupItem
                                          value={String(value)}
                                          id={`${questionId}-${value}`}
                                          className="absolute inset-0 h-full w-full opacity-0"
                                        />
                                        <span className="pointer-events-none">
                                          {value}
                                        </span>
                                      </Label>
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
                                  className="grid gap-2 sm:grid-cols-2"
                                >
                                  <Label
                                    htmlFor={`${questionId}-yes`}
                                    className={cn(
                                      "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm font-medium transition-[background-color,border-color]",
                                      answerValue === true
                                        ? "border-primary/35 bg-primary/5"
                                        : "border-border bg-background hover:border-primary/20 hover:bg-secondary/60",
                                    )}
                                  >
                                    <RadioGroupItem
                                      value="true"
                                      id={`${questionId}-yes`}
                                      className="h-5 w-5"
                                    />
                                    <span>{t("clientPanel", "yes")}</span>
                                  </Label>
                                  <Label
                                    htmlFor={`${questionId}-no`}
                                    className={cn(
                                      "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm font-medium transition-[background-color,border-color]",
                                      answerValue === false
                                        ? "border-primary/35 bg-primary/5"
                                        : "border-border bg-background hover:border-primary/20 hover:bg-secondary/60",
                                    )}
                                  >
                                    <RadioGroupItem
                                      value="false"
                                      id={`${questionId}-no`}
                                      className="h-5 w-5"
                                    />
                                    <span>{t("clientPanel", "no")}</span>
                                  </Label>
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
                                  placeholder={t("clientPanel", "enterNumber")}
                                  className="max-w-xs bg-background"
                                />
                              ) : null}

                              {question.questionType === "file" ? (
                                <div className="flex flex-col gap-3">
                                  {(() => {
                                    const fileAnswer =
                                      answerValue &&
                                      typeof answerValue === "object" &&
                                      "fileName" in answerValue
                                        ? (answerValue as {
                                            fileName?: string;
                                            fileSize?: number;
                                            fileType?: string;
                                            fileUrl?: string;
                                          })
                                        : null;
                                    const uploadKey = `${survey._id}:${question._id}`;
                                    const isUploading =
                                      uploadingSurveyFileQuestionId ===
                                      uploadKey;

                                    return (
                                      <>
                                        <input
                                          id={`${questionId}-file`}
                                          type="file"
                                          className="sr-only"
                                          disabled={isUploading}
                                          accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                                          onChange={(event) => {
                                            const file =
                                              event.target.files?.[0];
                                            if (!file) return;
                                            void handlePublicSurveyFileUpload(
                                              survey,
                                              question,
                                              file,
                                            );
                                            event.target.value = "";
                                          }}
                                        />
                                        <Label
                                          htmlFor={`${questionId}-file`}
                                          className={cn(
                                            "flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-[background-color,border-color]",
                                            isUploading
                                              ? "cursor-wait opacity-70"
                                              : "hover:border-primary/25 hover:bg-secondary/60",
                                          )}
                                        >
                                          <span className="flex min-w-0 items-center gap-2">
                                            <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            <span className="truncate">
                                              {fileAnswer?.fileName ||
                                                t("clientPanel", "chooseFile")}
                                            </span>
                                          </span>
                                          <span className="shrink-0 text-xs text-muted-foreground">
                                            {isUploading
                                              ? t("clientPanel", "uploading")
                                              : t("clientPanel", "browse")}
                                          </span>
                                        </Label>
                                        {fileAnswer?.fileName ? (
                                          fileAnswer.fileType?.startsWith(
                                            "image/",
                                          ) && fileAnswer.fileUrl ? (
                                            <div className="overflow-hidden rounded-xl border border-border bg-card">
                                              <img
                                                src={fileAnswer.fileUrl}
                                                alt={fileAnswer.fileName}
                                                className="max-h-64 w-full object-contain bg-secondary"
                                              />
                                              <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-muted-foreground">
                                                <span className="min-w-0 truncate">
                                                  {fileAnswer.fileName}
                                                </span>
                                                {typeof fileAnswer.fileSize ===
                                                "number" ? (
                                                  <span className="shrink-0">
                                                    {formatFileSize(
                                                      fileAnswer.fileSize,
                                                    )}
                                                  </span>
                                                ) : null}
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                                              <span className="flex min-w-0 items-center gap-2">
                                                <Upload data-icon="inline-start" />
                                                <span className="truncate">
                                                  {fileAnswer.fileName}
                                                </span>
                                              </span>
                                              {typeof fileAnswer.fileSize ===
                                              "number" ? (
                                                <span className="shrink-0">
                                                  {formatFileSize(
                                                    fileAnswer.fileSize,
                                                  )}
                                                </span>
                                              ) : null}
                                            </div>
                                          )
                                        ) : null}
                                        {isUploading ? (
                                          <p className="text-xs text-muted-foreground">
                                            {t("clientPanel", "uploadingFile")}
                                          </p>
                                        ) : null}
                                      </>
                                    );
                                  })()}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}

                        <div className="flex justify-end border-t border-border/70 pt-1">
                          <Button
                            type="button"
                            onClick={() =>
                              void handleSubmitPublicSurvey(survey)
                            }
                            disabled={
                              isSubmitting ||
                              uploadingSurveyFileQuestionId !== null
                            }
                          >
                            <Send data-icon="inline-start" />
                            {isSubmitting
                              ? t("clientPanel", "submitting")
                              : t("clientPanel", "submitSurvey")}
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
              {t("clientPanel", "tasks")}
            </h2>
            <span className="inline-flex items-center justify-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {t("clientPanel", "items", { count: tasks.length })}
            </span>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("clientPanel", "noTasks")}
            </p>
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
                    {t("clientPanel", "startEnd", {
                      start: formatPortalDate(task.startDate),
                      end: formatPortalDate(task.endDate),
                    })}
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
              {t("clientPanel", "noLabor")}
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
                        {formatAmount(sectionTotal, currencySymbol)}
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
                              "border-[#78a65a]/30 bg-[#edf6e8]/55",
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
                                    ? "border-[#78a65a]/45 bg-[#edf6e8] text-[#2f6f3a]"
                                    : "border-destructive/20 bg-destructive/10 text-destructive",
                                )}
                              >
                                {item.customerDecision === "accepted"
                                  ? t("clientPanel", "accepted")
                                  : t("clientPanel", "rejected")}
                              </Badge>
                            ) : null
                          }
                          metadata={
                            <>
                              <span>
                                {t("clientPanel", "qty", {
                                  quantity: item.quantity,
                                })}
                              </span>
                              <span>
                                {t("clientPanel", "unit", { unit: item.unit })}
                              </span>
                              {getItemPriceMetadataLabels(
                                item.unitPrice,
                                item,
                                "unit",
                              ).map((label) => (
                                <span key={`${item._id}-unit-${label}`}>
                                  {label}
                                </span>
                              ))}
                              {getItemPriceMetadataLabels(
                                item.totalPrice,
                                item,
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
                                  {t("clientPanel", "link")}
                                </a>
                              ) : null}
                              {item.attachmentFileId ? (
                                <Badge variant="outline" className="text-xs">
                                  {t("clientPanel", "attachmentInFiles")}
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
                            {t("clientPanel", "sectionTotal")}
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {formatAmount(sectionTotal, currencySymbol)}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 py-8 text-center text-muted-foreground">
                      <p className="text-sm">
                        {t("clientPanel", "noLaborInSection")}
                      </p>
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
              {t("clientPanel", "contacts")}
            </h2>
            <span className="inline-flex items-center justify-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {t("clientPanel", "items", { count: contacts.length })}
            </span>
          </div>
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("clientPanel", "noContacts")}
            </p>
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
                      {t("clientPanel", "role", { role: contact.projectRole })}
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
              {t("clientPanel", "budget")}
            </h2>
          </div>
          {publicBudgetSummary ? (
            <div className="flex flex-col gap-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-border/70 bg-card p-5">
                  <p className="text-sm text-muted-foreground">
                    {t("clientPanel", "budget")}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <Banknote className="h-5 w-5 text-primary" />
                    <p className="text-xl font-medium font-serif text-foreground">
                      {formatAmount(publicBudgetSummary.budget, currencySymbol)}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-card p-5">
                  <p className="text-sm text-muted-foreground">
                    {t("clientPanel", "plannedCost")}
                  </p>
                  <p className="mt-2 text-xl font-medium font-serif text-foreground">
                    {formatAmount(
                      publicBudgetSummary.plannedCost,
                      currencySymbol,
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("clientPanel", "ofBudget", {
                      percent:
                        publicBudgetSummary.projectedUtilizationPercent ?? 0,
                    })}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card p-5">
                  <p className="text-sm text-muted-foreground">
                    {t("clientPanel", "committedCost")}
                  </p>
                  <p className="mt-2 text-xl font-medium font-serif text-foreground">
                    {formatAmount(
                      publicBudgetSummary.committedCost,
                      currencySymbol,
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("clientPanel", "approvedScheduledSpend")}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card p-5">
                  <p className="text-sm text-muted-foreground">
                    {t("clientPanel", "actualCost")}
                  </p>
                  <p className="mt-2 text-xl font-medium font-serif text-foreground">
                    {formatAmount(
                      publicBudgetSummary.actualCost,
                      currencySymbol,
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("clientPanel", "ofBudgetUsed", {
                      percent: publicBudgetSummary.utilizationPercent ?? 0,
                    })}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-xl border border-border/70 bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-medium text-foreground">
                        {t("clientPanel", "budgetBalance")}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("clientPanel", "budgetBalanceDescription")}
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
                        ? t("clientPanel", "overBudget")
                        : t("clientPanel", "withinBudget")}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-muted px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {t("clientPanel", "remainingNow")}
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
                        {t("clientPanel", "projectedRemaining")}
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
                      {t("clientPanel", "noBudgetAlerts")}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-5">
                  <p className="text-base font-medium text-foreground">
                    {t("clientPanel", "estimatesPayments")}
                  </p>
                  <div className="mt-4 flex flex-col gap-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        {t("clientPanel", "acceptedEstimates")}
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
                        {t("clientPanel", "scheduledPayments")}
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
                        {t("clientPanel", "collectedPayments")}
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
                        {t("clientPanel", "outstandingPayments")}
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
                    {t("clientPanel", "materials")}
                  </p>
                  <div className="mt-4 flex flex-col gap-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        {t("clientPanel", "planned")}
                      </span>
                      <span className="font-medium text-foreground">
                        {formatAmount(
                          publicBudgetSummary.breakdown.shopping.planned,
                          currencySymbol,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        {t("clientPanel", "committed")}
                      </span>
                      <span className="font-medium text-foreground">
                        {formatAmount(
                          publicBudgetSummary.breakdown.shopping.committed,
                          currencySymbol,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        {t("clientPanel", "actual")}
                      </span>
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
                  <p className="text-base font-medium text-foreground">
                    {t("clientPanel", "labor")}
                  </p>
                  <div className="mt-4 flex flex-col gap-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        {t("clientPanel", "planned")}
                      </span>
                      <span className="font-medium text-foreground">
                        {formatAmount(
                          publicBudgetSummary.breakdown.labor.planned,
                          currencySymbol,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        {t("clientPanel", "committed")}
                      </span>
                      <span className="font-medium text-foreground">
                        {formatAmount(
                          publicBudgetSummary.breakdown.labor.committed,
                          currencySymbol,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        {t("clientPanel", "actual")}
                      </span>
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
                            ? t("clientPanel", "dueDate", {
                                date: new Date(payment.dueDate).toLocaleDateString(),
                              })
                            : t("clientPanel", "noDueDate")}
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
                              t("clientPanel", "bankTransferDetails")}
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
                            ? t("clientPanel", "opening")
                            : payment.status === "paid"
                              ? t("clientPanel", "downloadInvoice")
                              : t("clientPanel", "downloadPdf")}
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
              {t("clientPanel", "noShoppingItems")}
            </div>
          ) : (
            sectionSummaries.map(({ sectionName, itemCount, total }) => {
              const sectionGroups =
                shoppingGroupsBySection.get(sectionName) || [];

              return (
                <div
                  key={sectionName}
                  className="mb-10 overflow-hidden rounded-3xl border border-border/70 bg-white shadow-sm"
                >
                  <div className="rounded-t-2xl border border-border/70 border-b-border/60 bg-white px-5 py-5 sm:px-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h2 className="font-serif text-xl font-medium leading-tight tracking-[-0.02em] text-foreground sm:text-2xl">
                          {sectionName}
                        </h2>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center justify-center rounded-full border border-black/7 bg-white/72 px-3 py-1 text-xs font-medium text-foreground/52">
                          {t("clientPanel", "items", { count: itemCount })}
                        </span>
                        {settings.showPrice ? (
                          <span className="inline-flex items-center justify-center rounded-full border border-black/7 bg-white/72 px-3 py-1 text-xs font-medium text-foreground/76">
                            {formatAmount(total, currencySymbol)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-b-[22px] border border-t-0 border-border/70 bg-white p-3 sm:p-4">
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
                                  {t("clientPanel", "notCounted")}
                                </Badge>
                              ) : null
                            }
                            metadata={
                              <>
                                <span>{getQtyLabel(option, t)}</span>
                                {settings.showPrice
                                  ? getItemPriceMetadataLabels(
                                      option.unitPrice,
                                      option,
                                      "unit",
                                    ).map((label) => (
                                      <span key={`${option._id}-unit-${label}`}>
                                        {label}
                                      </span>
                                    ))
                                  : null}
                                {settings.showPrice
                                  ? getItemPriceMetadataLabels(
                                      option.totalPrice,
                                      option,
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
                          className="rounded-2xl border border-border/70 bg-white p-4"
                        >
                          <div className="mb-4 flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-medium text-foreground">
                                  {group.title}
                                </h3>
                                <Badge variant="outline" className="text-xs">
                                  {t("clientPanel", "alternativeGroup")}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {t("clientPanel", "options", {
                                    count: group.items.length,
                                  })}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {getChoiceLabel(group.selectionMode, t)}
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
                                      "bg-primary/5 ring-1 ring-emerald-500/20",
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
                                          {isSelected
                                            ? t("clientPanel", "included")
                                            : t("clientPanel", "include")}
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
                                            ? t("clientPanel", "selected")
                                            : t("clientPanel", "chooseThisOption")}
                                        </Button>
                                      )}
                                    </div>
                                  ) : null}

                                  <PortalItemCard
                                    imageUrl={option.imageUrl}
                                    name={option.name}
                                    className={cn(
                                      isSelected &&
                                        "border-primary/40 bg-primary/5 shadow-sm",
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
                                            className="border-primary/30 bg-primary/10 text-primary"
                                          >
                                            {group.selectionMode === "multiple"
                                              ? t("clientPanel", "included")
                                              : t("clientPanel", "selectedOption")}
                                          </Badge>
                                        ) : null}
                                        <Badge
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          {t("clientPanel", "alternative")}
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
                                            {t("clientPanel", "notCounted")}
                                          </Badge>
                                        ) : null}
                                      </>
                                    }
                                    metadata={
                                      <>
                                        <span>{getQtyLabel(option, t)}</span>
                                        {settings.showPrice
                                          ? getItemPriceMetadataLabels(
                                              option.unitPrice,
                                              option,
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
                                          ? getItemPriceMetadataLabels(
                                              option.totalPrice,
                                              option,
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
                                          <Badge className="bg-primary text-white hover:bg-primary">
                                            {group.selectionMode === "multiple"
                                              ? t("clientPanel", "included")
                                              : t("clientPanel", "selected")}
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
                              {t("clientPanel", "savingSelection")}
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
          {t("clientPanel", "noPortalSections")}
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
                <span>{formatAmount(total, currencySymbol)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="text-xl font-medium text-foreground">
                {t("clientPanel", "grandTotal")}
              </span>
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
