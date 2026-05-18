import { type KeyboardEvent, type ReactNode, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { Doc, Id } from "@/convex/_generated/dataModel";
import type { TeamMember } from "@/lib/teamMember";
import { buildShoppingSetContext, calculateShoppingTotal, isItemCountedInShoppingTotal } from "@/lib/shoppingSets";
import { apiAny } from "@/lib/convexApiAny";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { AddItemForm } from "./AddItemForm";
import { ShoppingListItemDetails } from "./ShoppingListItemDetails";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EditIcon,
  ExternalLinkIcon,
  Layers3Icon,
  Loader2,
  LibraryBig,
  PlusIcon,
  SaveIcon,
  TrashIcon,
  WandSparkles,
  XIcon,
} from "lucide-react";
import { format } from "date-fns";
import { formatDateInput, parseDateInput } from "@/lib/dateInput";
import { cn } from "@/lib/utils";
import {
  type TeamTaxRate,
} from "@/lib/organizationTax";
import {
  formatPriceTaxBreakdown,
  normalizePriceTaxMode,
  resolvePriceTaxSnapshot,
  type PriceTaxMode,
  type PriceTaxRateSnapshot,
} from "@/lib/priceTax";
import { useI18n } from "@/lib/i18n";

type ShoppingListItem = Doc<"shoppingListItems">;
type ShoppingSet = Doc<"shoppingSets"> & {
  resolvedBySource?: "team" | "client" | null;
  resolvedByName?: string | null;
  resolvedAt?: number | null;
};
type Priority = ShoppingListItem["priority"];
type PrioritySelectValue = NonNullable<Priority> | "none";
type InlineEditField =
  | "name"
  | "supplier"
  | "category"
  | "catalogNumber"
  | "dimensions"
  | "quantity"
  | "unitPrice"
  | "priority"
  | "buyBefore"
  | "productLink";

interface InlineEditState {
  itemId: string;
  field: InlineEditField;
  value: string;
}

const SHOPPING_STATUS_OPTIONS: Array<{
  value: ShoppingListItem["realizationStatus"];
  labelKey:
    | "planned"
    | "ordered"
    | "inTransit"
    | "delivered"
    | "completed"
    | "cancelled";
}> = [
  { value: "PLANNED", labelKey: "planned" },
  { value: "ORDERED", labelKey: "ordered" },
  { value: "IN_TRANSIT", labelKey: "inTransit" },
  { value: "DELIVERED", labelKey: "delivered" },
  { value: "COMPLETED", labelKey: "completed" },
  { value: "CANCELLED", labelKey: "cancelled" },
];

const SHOPPING_STATUS_TRIGGER_CLASSNAMES: Record<
  ShoppingListItem["realizationStatus"],
  string
> = {
  PLANNED:
    "border-border/70 bg-secondary/70 text-foreground/75 hover:border-foreground/15 hover:bg-secondary",
  ORDERED:
    "border-[#d9a36b]/35 bg-[#f8ead8] text-[#7b4825] hover:border-[#d9a36b]/55 hover:bg-[#f5dfc4]",
  IN_TRANSIT:
    "border-[#b7aa92]/45 bg-[#eee6d7] text-[#5f5548] hover:border-[#b7aa92]/65 hover:bg-[#e8dcc9]",
  DELIVERED:
    "border-[#c7a98f]/45 bg-[#f1e4d8] text-[#694b36] hover:border-[#c7a98f]/65 hover:bg-[#ead7c6]",
  COMPLETED:
    "border-[#9ca67a]/40 bg-[#eef0e5] text-[#4f5a38] hover:border-[#9ca67a]/60 hover:bg-[#e3e8d7]",
  CANCELLED:
    "border-destructive/20 bg-destructive/10 text-destructive hover:border-destructive/30 hover:bg-destructive/15",
};

const SHOPPING_PRIORITY_LABELS: Record<NonNullable<Priority>, NonNullable<Priority>> = {
  low: "low",
  medium: "medium",
  high: "high",
  urgent: "urgent",
};

const SHOPPING_PRIORITY_OPTIONS: Array<{
  value: PrioritySelectValue;
  label: string;
}> = [
  { value: "none", label: "No priority" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

interface EditFormData {
  name?: string;
  notes?: string;
  supplier?: string;
  category?: string;
  sectionId?: string | Id<"shoppingListSections">;
  catalogNumber?: string;
  dimensions?: string;
  quantity?: number;
  unitPrice?: string;
  priceTaxMode?: PriceTaxMode;
  taxRateId?: string | null;
  productLink?: string;
  imageUrl?: string;
  priority?: Priority;
  realizationStatus?: string;
  buyBefore?: string;
  assigneeId?: string;
  hasAlternatives?: boolean;
}

interface ShoppingListSectionProps {
  projectId: Id<"projects">;
  teamId: Id<"teams">;
  sectionName: string;
  sectionId?: Id<"shoppingListSections">;
  items: ShoppingListItem[];
  sets: ShoppingSet[];
  allSets: ShoppingSet[];
  currencySymbol: string;
  teamMembers?: TeamMember[];
  sections: Doc<"shoppingListSections">[];
  taxRates?: TeamTaxRate[];
  onUpdateItem: (id: Id<"shoppingListItems">, updates: Partial<ShoppingListItem>) => Promise<void>;
  onDeleteItem: (id: Id<"shoppingListItems">) => Promise<void>;
  onAddItem: (itemData: {
    name: string;
    notes?: string;
    supplier?: string;
    category?: string;
    sectionId?: Id<"shoppingListSections">;
    setId?: Id<"shoppingSets">;
    catalogNumber?: string;
    dimensions?: string;
    quantity: number;
    unitPrice?: number;
    priceTaxMode?: PriceTaxMode;
    taxRateId?: string | null;
    taxRateSnapshot?: PriceTaxRateSnapshot | null;
    productLink?: string;
    imageUrl?: string;
    priority?: Priority;
    realizationStatus?: string;
    buyBefore?: number;
    assignedTo?: string;
  }) => Promise<Id<"shoppingListItems"> | void>;
  onCreateAlternativesForItem: (
    itemId: Id<"shoppingListItems">,
    itemName: string,
    sectionId?: Id<"shoppingListSections">,
  ) => Promise<Id<"shoppingSets">>;
  onUpdateSet: (
    id: Id<"shoppingSets">,
    updates: Partial<ShoppingSet>,
  ) => Promise<void>;
  onDeleteSet: (id: Id<"shoppingSets">) => Promise<void>;
  isPending: boolean;
}

export function ShoppingListSection({
  projectId,
  teamId,
  sectionName,
  sectionId,
  items,
  sets,
  allSets,
  currencySymbol,
  teamMembers,
  sections,
  taxRates = [],
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onCreateAlternativesForItem,
  onUpdateSet,
  onDeleteSet,
  isPending,
}: ShoppingListSectionProps) {
  const { t, locale } = useI18n();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({});
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingAlternativeSetId, setAddingAlternativeSetId] = useState<string | null>(null);
  const [isEditScraping, setIsEditScraping] = useState(false);
  const [savingToLibraryItemId, setSavingToLibraryItemId] = useState<string | null>(null);
  const [updatingStatusItemId, setUpdatingStatusItemId] = useState<string | null>(null);
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null);
  const [savingInlineEditKey, setSavingInlineEditKey] = useState<string | null>(null);
  const activeTaxRates = taxRates.filter((entry) => !entry.isArchived);
  const createProductFromShoppingListItem = useMutation(
    apiAny.productLibrary.createProductFromShoppingListItem,
  );

  const setsById = useMemo(
    () => new Map(allSets.map((set) => [String(set._id), set])),
    [allSets],
  );
  const sectionSets = useMemo(
    () => sets.slice().sort((left, right) => left.order - right.order || left.title.localeCompare(right.title)),
    [sets],
  );
  const standaloneItems = useMemo(
    () =>
      items.filter((item) => {
        if (!item.setId) return true;
        const set = setsById.get(String(item.setId));
        return !set || String(set.sectionId ?? "") !== String(sectionId ?? "");
      }),
    [items, sectionId, setsById],
  );

  const setContext = buildShoppingSetContext(items, sets);
  const sectionTotal = calculateShoppingTotal(items, sets);
  const getPriorityLabel = (priority: PrioritySelectValue) => {
    if (priority === "none") return t("shoppingList", "noPriority");
    return t("shoppingList", priority);
  };
  const formatItemCountLabel = (count: number) =>
    `${count} ${count === 1 ? t("shoppingList", "item") : t("shoppingList", "items")}`;
  const renderPriceSpans = (
    amount: number | undefined,
    scope: "unit" | "total",
    item: ShoppingListItem,
  ) => {
    if (amount === undefined) {
      return null;
    }

    const taxSummary = formatPriceTaxBreakdown(
      amount,
      {
        priceTaxMode: item.priceTaxMode,
        taxRateId: item.taxRateId,
        taxRateSnapshot: item.taxRateSnapshot,
      },
      currencySymbol,
    );

    return (
      <span className="inline-flex flex-wrap items-baseline gap-x-1.5 whitespace-nowrap font-semibold text-foreground">
        {scope === "unit"
          ? `${t("shoppingList", "unitLabel")} ${amount.toFixed(2)} ${currencySymbol}`
          : `${t("shoppingList", "totalLabel")} ${amount.toFixed(2)} ${currencySymbol}`}
        {taxSummary ? (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({taxSummary})
          </span>
        ) : null}
      </span>
    );
  };

  const getAssignedMemberName = (assignedTo?: string) => {
    if (!assignedTo) return null;
    const member = teamMembers?.find((entry) => entry.clerkUserId === assignedTo);
    return member?.name || assignedTo;
  };

  const getPriorityBadgeVariant = () => "outline" as const;

  const getPriorityBadgeClassName = (priority: Priority) => {
    if (priority === "urgent") {
      return "border-destructive/25 bg-destructive/10 text-destructive";
    }
    if (priority === "high") {
      return "border-[#d8a06b]/35 bg-[#f8ead8] text-[#7b4825]";
    }
    if (priority === "medium") {
      return "border-[#d7bf70]/35 bg-[#fbf4d5] text-[#76601f]";
    }
    return "border-[#9ca67a]/35 bg-[#eef0e5] text-[#4f5a38]";
  };

  const toggleDetails = (itemId: string) => {
    setExpandedDetails((current) => ({
      ...current,
      [itemId]: !current[itemId],
    }));
  };

  const normalizeProductUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";

    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Invalid URL protocol");
    }
    return parsed.toString();
  };

  const getProductLinkLabel = (value: string) => {
    try {
      const parsed = new URL(value);
      return parsed.hostname.replace(/^www\./, "");
    } catch {
      return value;
    }
  };

  const handleStartEdit = (item: ShoppingListItem) => {
    setInlineEdit(null);
    setEditingItemId(String(item._id));
    setEditFormData({
      name: item.name,
      notes: item.notes || "",
      supplier: item.supplier || "",
      category: item.category || "",
      sectionId: item.sectionId || "none",
      catalogNumber: item.catalogNumber || "",
      dimensions: item.dimensions || "",
      quantity: item.quantity,
      unitPrice:
        item.unitPrice !== undefined ? item.unitPrice.toString() : "",
      priceTaxMode: normalizePriceTaxMode(item.priceTaxMode),
      taxRateId: item.taxRateId ?? item.taxRateSnapshot?.id ?? null,
      productLink: item.productLink || "",
      imageUrl: item.imageUrl || "",
      priority: item.priority,
      realizationStatus: item.realizationStatus,
      buyBefore: item.buyBefore ? format(new Date(item.buyBefore), "yyyy-MM-dd") : "",
      assigneeId: item.assignedTo || "none",
      hasAlternatives: Boolean(item.setId),
    });
  };

  const getInlineEditKey = (itemId: string, field: InlineEditField) => `${itemId}:${field}`;

  const getInlineFieldValue = (item: ShoppingListItem, field: InlineEditField) => {
    switch (field) {
      case "name":
        return item.name;
      case "supplier":
        return item.supplier || "";
      case "category":
        return item.category || "";
      case "catalogNumber":
        return item.catalogNumber || "";
      case "dimensions":
        return item.dimensions || "";
      case "quantity":
        return String(item.quantity);
      case "unitPrice":
        return item.unitPrice !== undefined ? String(item.unitPrice) : "";
      case "priority":
        return item.priority || "none";
      case "buyBefore":
        return item.buyBefore ? format(new Date(item.buyBefore), "yyyy-MM-dd") : "";
      case "productLink":
        return item.productLink || "";
    }
  };

  const startInlineEdit = (item: ShoppingListItem, field: InlineEditField) => {
    if (isPending) return;
    setEditingItemId(null);
    setInlineEdit({
      itemId: String(item._id),
      field,
      value: getInlineFieldValue(item, field),
    });
  };

  const cancelInlineEdit = () => {
    setInlineEdit(null);
  };

  const saveInlineEdit = async (
    item: ShoppingListItem,
    field: InlineEditField,
    rawValue: string,
  ) => {
    const itemId = String(item._id);
    const key = getInlineEditKey(itemId, field);
    const trimmed = rawValue.trim();
    let updates: Partial<ShoppingListItem> = {};

    try {
      switch (field) {
        case "name":
          if (!trimmed) {
            toast.error(t("shoppingList", "productNameRequired"));
            return;
          }
          updates = { name: trimmed };
          break;
        case "supplier":
          updates = { supplier: trimmed || undefined };
          break;
        case "category":
          updates = { category: trimmed || undefined };
          break;
        case "catalogNumber":
          updates = { catalogNumber: trimmed || undefined };
          break;
        case "dimensions":
          updates = { dimensions: trimmed || undefined };
          break;
        case "quantity": {
          const quantity = Number.parseInt(trimmed, 10);
          if (!Number.isFinite(quantity) || quantity < 1) {
            toast.error(t("shoppingList", "quantityAtLeastOne"));
            return;
          }
          updates = { quantity };
          break;
        }
        case "unitPrice": {
          const unitPrice = trimmed === "" ? undefined : Number.parseFloat(trimmed);
          if (unitPrice !== undefined && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
            toast.error(t("shoppingList", "unitPriceZeroOrHigher"));
            return;
          }
          updates = { unitPrice };
          break;
        }
        case "priority":
          updates = {
            priority: trimmed === "none" ? undefined : (trimmed as NonNullable<Priority>),
          };
          break;
        case "buyBefore":
          updates = { buyBefore: trimmed ? new Date(trimmed).getTime() : undefined };
          break;
        case "productLink":
          updates = { productLink: trimmed ? normalizeProductUrl(trimmed) : undefined };
          break;
      }
    } catch {
      toast.error(t("shoppingList", "invalidProductUrl"));
      return;
    }

    if (rawValue === getInlineFieldValue(item, field)) {
      setInlineEdit(null);
      return;
    }

    setSavingInlineEditKey(key);
    try {
      await onUpdateItem(item._id, updates);
      setInlineEdit(null);
    } catch (error) {
      toast.error(t("shoppingList", "couldNotUpdateProduct"), {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setSavingInlineEditKey((current) => (current === key ? null : current));
    }
  };

  const handleInlineInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelInlineEdit();
    }
  };

  const handleSaveEdit = async (itemId: Id<"shoppingListItems">) => {
    const item = items.find((entry) => entry._id === itemId);
    if (!item) {
      return;
    }

    const nextName = editFormData.name?.trim() || "";
    if (!nextName) {
      toast.error(t("shoppingList", "productNameRequired"));
      return;
    }

    const normalizedUnitPrice = editFormData.unitPrice?.trim() || "";
    const unitPrice =
      normalizedUnitPrice === ""
        ? undefined
        : Number.parseFloat(normalizedUnitPrice);
    const normalizedPriceTaxMode = normalizePriceTaxMode(editFormData.priceTaxMode);
    const taxRateId = editFormData.taxRateId || undefined;
    const taxRateSnapshot = resolvePriceTaxSnapshot(
      normalizedPriceTaxMode,
      taxRateId,
      activeTaxRates,
    );
    if (
      (normalizedPriceTaxMode === "net" || normalizedPriceTaxMode === "gross") &&
      !taxRateSnapshot
    ) {
      toast.error(t("shoppingList", "selectTaxRateOrLeaveUnspecified"));
      return;
    }
    const buyBefore = editFormData.buyBefore ? new Date(editFormData.buyBefore).getTime() : undefined;
    const nextSectionId =
      editFormData.sectionId === "none"
        ? undefined
        : (editFormData.sectionId as Id<"shoppingListSections"> | undefined);
    const wantsAlternatives = editFormData.hasAlternatives ?? Boolean(item.setId);
    const relatedSetItems = item.setId
      ? items.filter((entry) => String(entry.setId ?? "") === String(item.setId))
      : [];
    let nextSetId = item.setId ?? null;

    if (wantsAlternatives && !item.setId) {
      nextSetId = await onCreateAlternativesForItem(item._id, nextName, nextSectionId);
    }

    if (!wantsAlternatives && item.setId) {
      if (relatedSetItems.length > 1) {
        toast.error(t("shoppingList", "removeOtherAlternativesFirst"));
        return;
      }
      await onDeleteSet(item.setId);
      nextSetId = null;
    }

    await onUpdateItem(itemId, {
      name: nextName,
      notes: editFormData.notes?.trim() || undefined,
      supplier: editFormData.supplier?.trim() || undefined,
      category: editFormData.category?.trim() || undefined,
      sectionId: nextSectionId,
      setId: nextSetId,
      catalogNumber: editFormData.catalogNumber?.trim() || undefined,
      dimensions: editFormData.dimensions?.trim() || undefined,
      quantity: editFormData.quantity || 1,
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : undefined,
      priceTaxMode: normalizedPriceTaxMode,
      taxRateId:
        normalizedPriceTaxMode === "net" || normalizedPriceTaxMode === "gross"
          ? taxRateSnapshot?.id ?? taxRateId ?? null
          : null,
      taxRateSnapshot: taxRateSnapshot ?? null,
      productLink: editFormData.productLink?.trim() || undefined,
      imageUrl: editFormData.imageUrl?.trim() || undefined,
      priority: editFormData.priority,
      realizationStatus: editFormData.realizationStatus as ShoppingListItem["realizationStatus"],
      buyBefore,
      assignedTo: editFormData.assigneeId === "none" ? undefined : editFormData.assigneeId,
    });
    setEditingItemId(null);
    setEditFormData({});
  };

  const handleEditScrapeByUrl = async () => {
    const rawUrl = editFormData.productLink?.trim() || "";
    if (!rawUrl || isEditScraping) {
      return;
    }

    let normalizedUrl = "";
    try {
      normalizedUrl = normalizeProductUrl(rawUrl);
    } catch {
      toast.error(t("shoppingList", "invalidProductUrl"));
      return;
    }

    setIsEditScraping(true);
    setEditFormData((current) => ({ ...current, productLink: normalizedUrl }));

    try {
      const response = await fetch(
        `/api/shopping/scrape?projectId=${encodeURIComponent(String(projectId))}&teamId=${encodeURIComponent(String(teamId))}&url=${encodeURIComponent(normalizedUrl)}`,
      );
      const payload = (await response.json()) as {
        message?: string;
        name?: string;
        supplier?: string;
        category?: string;
        catalogNumber?: string;
        dimensions?: string;
        unitPrice?: number;
        productLink?: string;
        imageUrl?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message || t("shoppingList", "failedToScrapeProductDetails"));
      }

      setEditFormData((current) => ({
        ...current,
        name: payload.name ?? current.name,
        supplier: payload.supplier ?? current.supplier,
        category: payload.category ?? current.category,
        catalogNumber: payload.catalogNumber ?? current.catalogNumber,
        dimensions: payload.dimensions ?? current.dimensions,
        unitPrice:
          typeof payload.unitPrice === "number" && Number.isFinite(payload.unitPrice)
            ? String(payload.unitPrice)
            : current.unitPrice,
        imageUrl: payload.imageUrl ?? current.imageUrl,
        productLink: payload.productLink ?? current.productLink,
      }));

      toast.success(t("shoppingList", "productDetailsImported"));
    } catch (error) {
      toast.error(t("shoppingList", "couldNotImportProductDetails"), {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setIsEditScraping(false);
    }
  };

  const handleAddToProductLibrary = async (item: ShoppingListItem) => {
    const itemId = String(item._id);
    if (savingToLibraryItemId === itemId) {
      return;
    }

    setSavingToLibraryItemId(itemId);
    try {
      await createProductFromShoppingListItem({ itemId: item._id });
      toast.success(t("shoppingList", "addedToProductLibrary"));
    } catch (error) {
      toast.error(t("shoppingList", "couldNotAddProductToLibrary"), {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setSavingToLibraryItemId((current) => (current === itemId ? null : current));
    }
  };

  const getStatusLabel = (status: ShoppingListItem["realizationStatus"]) =>
    t(
      "shoppingList",
      SHOPPING_STATUS_OPTIONS.find((option) => option.value === status)
        ?.labelKey ?? "status",
    );

  const getInlineStatusClassName = (status: ShoppingListItem["realizationStatus"]) => {
    return (
      SHOPPING_STATUS_TRIGGER_CLASSNAMES[status] ??
      "border-border/80 bg-card text-foreground hover:bg-accent"
    );
  };

  const getCustomerDecisionTone = (
    decision: ShoppingListItem["customerDecision"] | undefined,
  ) => {
    if (decision === "accepted") {
      return "border-[#78a65a]/45 bg-[#edf6e8] text-[#2f6f3a]";
    }
    if (decision === "rejected") {
      return "border-destructive/20 bg-destructive/10 text-destructive";
    }
    return null;
  };

  const getCustomerDecisionLabel = (
    decision: ShoppingListItem["customerDecision"] | undefined,
  ) => {
    if (decision === "accepted") return t("shoppingList", "accepted");
    if (decision === "rejected") return t("shoppingList", "rejected");
    return null;
  };

  const getSelectionSourceTone = (
    source: ShoppingSet["resolvedBySource"],
  ) => {
    if (source === "client") {
      return "border-primary/30 bg-primary/12 text-primary";
    }
    if (source === "team") {
      return "border-[#b7aa92]/45 bg-[#eee6d7] text-[#5f5548]";
    }
    return "border-border/60 bg-secondary/30 text-muted-foreground";
  };

  const getSelectionSourceLabel = (
    source: ShoppingSet["resolvedBySource"],
    selectionMode: ShoppingSet["selectionMode"],
  ) => {
    if (selectionMode === "multiple") {
      return source ? t("shoppingList", "chosenOptions") : t("shoppingList", "suggestedOptions");
    }
    return source ? t("shoppingList", "chosenOption") : t("shoppingList", "suggestedOption");
  };

  const renderEditForm = (item: ShoppingListItem) => (
    <div className="flex flex-col gap-5 rounded-[22px] border border-border/70 bg-card p-5 shadow-none">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field>
          <FieldLabel>{t("shoppingList", "productName")}</FieldLabel>
          <Input
            value={editFormData.name || ""}
            onChange={(event) => setEditFormData({ ...editFormData, name: event.target.value })}
            placeholder={t("shoppingList", "productNamePlaceholder")}
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>{t("shoppingList", "section")}</FieldLabel>
          <Select
            value={editFormData.sectionId || "none"}
            onValueChange={(value) => setEditFormData({ ...editFormData, sectionId: value })}
          >
            <SelectTrigger className="h-12 text-sm">
              <SelectValue placeholder={t("shoppingList", "selectSection")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("shoppingList", "noCategory")}</SelectItem>
              {sections.map((section) => (
                <SelectItem key={section._id} value={section._id}>
                  {section.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>{t("shoppingList", "supplier")}</FieldLabel>
          <Input
            value={editFormData.supplier || ""}
            onChange={(event) => setEditFormData({ ...editFormData, supplier: event.target.value })}
            placeholder={t("shoppingList", "supplierPlaceholder")}
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>{t("shoppingList", "catalogNumber")}</FieldLabel>
          <Input
            value={editFormData.catalogNumber || ""}
            onChange={(event) => setEditFormData({ ...editFormData, catalogNumber: event.target.value })}
            placeholder={t("shoppingList", "catalogNumberPlaceholder")}
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>{t("shoppingList", "category")}</FieldLabel>
          <Input
            value={editFormData.category || ""}
            onChange={(event) => setEditFormData({ ...editFormData, category: event.target.value })}
            placeholder={t("shoppingList", "categoryPlaceholder")}
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>{t("shoppingList", "dimensions")}</FieldLabel>
          <Input
            value={editFormData.dimensions || ""}
            onChange={(event) => setEditFormData({ ...editFormData, dimensions: event.target.value })}
            placeholder={t("shoppingList", "dimensionsPlaceholder")}
            className="h-12 text-sm"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field>
          <FieldLabel>{t("shoppingList", "quantity")}</FieldLabel>
          <Input
            type="number"
            min="1"
            value={editFormData.quantity || 1}
            onChange={(event) => setEditFormData({ ...editFormData, quantity: parseInt(event.target.value, 10) || 1 })}
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>{t("shoppingList", "unitPrice")} ({currencySymbol})</FieldLabel>
          <Input
            type="number"
            step="0.01"
            value={editFormData.unitPrice || ""}
            onChange={(event) => setEditFormData({ ...editFormData, unitPrice: event.target.value })}
            placeholder="0.00"
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>{t("shoppingList", "status")}</FieldLabel>
          <Select
            value={editFormData.realizationStatus || "PLANNED"}
            onValueChange={(value) =>
              setEditFormData({
                ...editFormData,
                realizationStatus: value as ShoppingListItem["realizationStatus"],
              })
            }
          >
            <SelectTrigger className="h-12 text-sm">
              <SelectValue placeholder={t("shoppingList", "selectStatus")} />
            </SelectTrigger>
            <SelectContent>
              {SHOPPING_STATUS_OPTIONS.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {t("shoppingList", status.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>{t("shoppingList", "priority")}</FieldLabel>
          <Select
            value={editFormData.priority ?? "none"}
            onValueChange={(value) =>
              setEditFormData({
                ...editFormData,
                priority: value === "none" ? undefined : (value as NonNullable<Priority>),
              })
            }
          >
            <SelectTrigger className="h-12 text-sm">
              <SelectValue placeholder={t("shoppingList", "selectPriority")} />
            </SelectTrigger>
            <SelectContent>
              {SHOPPING_PRIORITY_OPTIONS.map((priority) => (
                <SelectItem key={priority.value} value={priority.value}>
                  {getPriorityLabel(priority.value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>{t("shoppingList", "taxTreatment")}</FieldLabel>
          <Select
            value={editFormData.priceTaxMode || "unspecified"}
            onValueChange={(value) => {
              const mode = normalizePriceTaxMode(value);
              setEditFormData({
                ...editFormData,
                priceTaxMode: mode,
                taxRateId:
                  mode === "net" || mode === "gross"
                    ? editFormData.taxRateId || activeTaxRates.find((rate) => rate.isDefault)?.id || activeTaxRates[0]?.id || null
                    : null,
              });
            }}
          >
            <SelectTrigger className="h-12 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unspecified">{t("shoppingList", "notSpecified")}</SelectItem>
              <SelectItem value="net" disabled={activeTaxRates.length === 0}>
                {t("shoppingList", "netPlusTax")}
              </SelectItem>
              <SelectItem value="gross" disabled={activeTaxRates.length === 0}>
                {t("shoppingList", "grossInclTax")}
              </SelectItem>
              <SelectItem value="exempt">{t("shoppingList", "taxExempt")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {editFormData.priceTaxMode === "net" || editFormData.priceTaxMode === "gross" ? (
          <Field>
            <FieldLabel>{t("shoppingList", "taxRate")}</FieldLabel>
            <Select
              value={editFormData.taxRateId || ""}
              onValueChange={(value) => setEditFormData({ ...editFormData, taxRateId: value })}
            >
              <SelectTrigger className="h-12 text-sm">
                <SelectValue placeholder={t("shoppingList", "selectTaxRate")} />
              </SelectTrigger>
              <SelectContent>
                {activeTaxRates.map((rate) => (
                  <SelectItem key={rate.id} value={rate.id}>
                    {rate.name} ({rate.rate}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Field>
          <FieldLabel>{t("shoppingList", "productLink")}</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              value={editFormData.productLink || ""}
              onChange={(event) => setEditFormData({ ...editFormData, productLink: event.target.value })}
              placeholder="https://..."
              className="h-12 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              disabled={isPending || isEditScraping || !(editFormData.productLink || "").trim()}
              onClick={handleEditScrapeByUrl}
              className="h-12 shrink-0 px-4"
            >
              {isEditScraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
              <span className="ml-2 hidden xl:inline">
                {isEditScraping ? t("shoppingList", "scrapeProductDetails") : t("shoppingList", "autoFill")}
              </span>
            </Button>
          </div>
        </Field>
        <Field className="lg:col-span-2">
          <FieldLabel>{t("shoppingList", "imageUrl")}</FieldLabel>
          <Input
            value={editFormData.imageUrl || ""}
            onChange={(event) => setEditFormData({ ...editFormData, imageUrl: event.target.value })}
            placeholder="https://..."
            className="h-12 text-sm"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel>{t("shoppingList", "assignTo")}</FieldLabel>
          <Select
            value={editFormData.assigneeId || "none"}
            onValueChange={(value) => setEditFormData({ ...editFormData, assigneeId: value })}
          >
            <SelectTrigger className="h-12 text-sm">
              <SelectValue placeholder={t("shoppingList", "selectUser")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("shoppingList", "unassigned")}</SelectItem>
              {teamMembers?.map((member) => (
                <SelectItem key={member.clerkUserId} value={member.clerkUserId}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={member.imageUrl} />
                      <AvatarFallback>{member.name?.[0]}</AvatarFallback>
                    </Avatar>
                    {member.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>{t("shoppingList", "buyBefore")}</FieldLabel>
          <DatePicker
            date={parseDateInput(editFormData.buyBefore)}
            onDateChange={(date) =>
              setEditFormData({
                ...editFormData,
                buyBefore: formatDateInput(date),
              })
            }
            placeholder={t("shoppingList", "pickDate")}
            className="h-12 w-full text-sm"
          />
        </Field>
      </div>

      <div className="vibe-row px-4 py-3">
        <div className="flex items-start gap-3">
          <Checkbox
            id={`item-${item._id}-has-alternatives`}
            checked={editFormData.hasAlternatives === true}
            onCheckedChange={(checked) =>
              setEditFormData({ ...editFormData, hasAlternatives: checked === true })
            }
            className="mt-0.5"
          />
          <label htmlFor={`item-${item._id}-has-alternatives`} className="cursor-pointer text-sm leading-6">
            <span className="font-medium text-foreground">{t("shoppingList", "offerAlternatives")}</span>
            <span className="block text-muted-foreground">
              {t("shoppingList", "addToAlternativeGroupDescription")}
            </span>
          </label>
        </div>
        {item.setId &&
        items.filter((entry) => String(entry.setId ?? "") === String(item.setId)).length > 1 ? (
          <p className="mt-3 text-xs text-foreground/70">
            {t("shoppingList", "removeAlternativeGroupHint")}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleAddToProductLibrary(item)}
          disabled={isPending || savingToLibraryItemId === String(item._id)}
        >
          {savingToLibraryItemId === String(item._id) ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <LibraryBig className="mr-1 h-4 w-4" />
          )}
          {t("shoppingList", "addToProductLibrary")}
        </Button>
        <Button
          size="sm"
          onClick={() => handleSaveEdit(item._id)}
          disabled={isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <SaveIcon className="mr-1 h-4 w-4" />
          {t("shoppingList", "save")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEditingItemId(null)}>
          <XIcon className="mr-1 h-4 w-4" />
          {t("shoppingList", "cancel")}
        </Button>
      </div>
    </div>
  );

  const renderInlineEditInput = (
    item: ShoppingListItem,
    field: InlineEditField,
    options: {
      type?: "text" | "number";
      className?: string;
      placeholder?: string;
    } = {},
  ) => {
    const itemId = String(item._id);
    const isActive = inlineEdit?.itemId === itemId && inlineEdit.field === field;
    if (!isActive) return null;

    return (
      <Input
        autoFocus
        type={options.type ?? "text"}
        value={inlineEdit.value}
        min={options.type === "number" ? "0" : undefined}
        step={field === "unitPrice" ? "0.01" : undefined}
        placeholder={options.placeholder}
        disabled={savingInlineEditKey === getInlineEditKey(itemId, field)}
        onChange={(event) =>
          setInlineEdit((current) =>
            current?.itemId === itemId && current.field === field
              ? { ...current, value: event.target.value }
              : current,
          )
        }
        onBlur={(event) => void saveInlineEdit(item, field, event.target.value)}
        onKeyDown={handleInlineInputKeyDown}
        className={cn("h-8 rounded-lg px-2.5 text-sm", options.className)}
      />
    );
  };

  const renderEditableValue = (
    item: ShoppingListItem,
    field: InlineEditField,
    children: ReactNode,
    options: {
      className?: string;
      inputClassName?: string;
      inputType?: "text" | "number";
      placeholder?: string;
    } = {},
  ) => {
    const itemId = String(item._id);
    const isActive = inlineEdit?.itemId === itemId && inlineEdit.field === field;

    if (isActive) {
      return renderInlineEditInput(item, field, {
        type: options.inputType,
        className: options.inputClassName,
        placeholder: options.placeholder,
      });
    }

    return (
      <button
        type="button"
        className={cn(
          "min-w-0 cursor-text text-left underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:underline",
          options.className,
        )}
        onClick={() => startInlineEdit(item, field)}
      >
        {children}
      </button>
    );
  };

  const renderEditablePriority = (item: ShoppingListItem) => {
    const itemId = String(item._id);
    const isActive = inlineEdit?.itemId === itemId && inlineEdit.field === "priority";
    const priority = item.priority;

    if (isActive) {
      return (
        <Select
          value={inlineEdit.value || "none"}
          onValueChange={(value) => void saveInlineEdit(item, "priority", value)}
          disabled={savingInlineEditKey === getInlineEditKey(itemId, "priority")}
        >
          <SelectTrigger size="sm" className="h-8 rounded-full px-2.5 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SHOPPING_PRIORITY_OPTIONS.map((priority) => (
              <SelectItem key={priority.value} value={priority.value}>
                {getPriorityLabel(priority.value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (!priority) {
      return null;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
            onClick={() => startInlineEdit(item, "priority")}
          >
            <Badge
              variant={getPriorityBadgeVariant()}
              className={getPriorityBadgeClassName(priority)}
            >
              {getPriorityLabel(SHOPPING_PRIORITY_LABELS[priority])}
            </Badge>
          </button>
        </TooltipTrigger>
        <TooltipContent>{t("shoppingList", "clickToEdit")}</TooltipContent>
      </Tooltip>
    );
  };

  const renderEditableBuyBefore = (item: ShoppingListItem) => {
    const itemId = String(item._id);
    const isActive = inlineEdit?.itemId === itemId && inlineEdit.field === "buyBefore";

    if (isActive) {
      return (
        <DatePicker
          date={parseDateInput(inlineEdit.value)}
          onDateChange={(date) =>
            void saveInlineEdit(item, "buyBefore", formatDateInput(date))
          }
          placeholder={t("shoppingList", "pickDate")}
          className="h-8 w-40 rounded-lg px-2.5 text-sm"
        />
      );
    }

    return renderEditableValue(
      item,
      "buyBefore",
      <span className="text-muted-foreground">
        {item.buyBefore
          ? new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-US", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(new Date(item.buyBefore))
          : t("shoppingList", "setDate")}
      </span>,
      { className: "text-muted-foreground" },
    );
  };

  const renderItemRow = (item: ShoppingListItem, set?: ShoppingSet) => {
    const itemId = String(item._id);
    const isCounted = isItemCountedInShoppingTotal(item, setContext);
    const assignedName = getAssignedMemberName(item.assignedTo);
    const isEditing = editingItemId === itemId;
    const customerDecisionTone = getCustomerDecisionTone(item.customerDecision);
    const customerDecisionLabel = getCustomerDecisionLabel(item.customerDecision);
    const headerDetails = [
      item.category ? { label: t("shoppingList", "category"), value: item.category, field: "category" as const } : null,
      item.dimensions ? { label: t("shoppingList", "dimensions"), value: item.dimensions, field: "dimensions" as const } : null,
      item.catalogNumber ? { label: t("shoppingList", "catalogShort"), value: item.catalogNumber, field: "catalogNumber" as const } : null,
    ].filter(Boolean) as Array<{ label: string; value: string; field: InlineEditField }>;
    const hasHeaderDetails = headerDetails.length > 0 || Boolean(item.productLink);
    const hasExpandedDetails = Boolean(item.notes || item.customerDecisionComment);

    const handleInlineStatusChange = async (value: string) => {
      const nextStatus = value as ShoppingListItem["realizationStatus"];
      if (nextStatus === item.realizationStatus) {
        return;
      }

      setUpdatingStatusItemId(itemId);
      try {
        await onUpdateItem(item._id, { realizationStatus: nextStatus });
        toast.success(`${t("shoppingList", "statusChangedTo")} ${getStatusLabel(nextStatus)}`);
      } catch (error) {
        toast.error(t("shoppingList", "couldNotUpdateStatus"), {
          description: toUserFacingErrorMessage(error),
        });
      } finally {
        setUpdatingStatusItemId((current) => (current === itemId ? null : current));
      }
    };

    return (
      <div
        key={item._id}
        className={cn(
          "rounded-2xl border border-border/80 bg-card px-4 py-4 sm:px-5",
          customerDecisionTone &&
            (item.customerDecision === "accepted"
              ? "border-[#78a65a]/30 bg-[#edf6e8]/25"
              : "border-destructive/20 bg-destructive/5"),
          !isCounted && "border-border/80 bg-secondary/35",
        )}
      >
        {isEditing ? (
          renderEditForm(item)
        ) : (
          <div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
                {item.imageUrl ? (
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border/70 bg-secondary/45">
                    <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h4 className="min-w-0 max-w-full text-[15px] font-semibold text-foreground">
                      {renderEditableValue(item, "name", item.name, {
                        className: "block max-w-full truncate font-semibold text-foreground",
                        inputClassName: "w-64 max-w-full font-semibold",
                        placeholder: t("shoppingList", "productName"),
                      })}
                    </h4>
                    {customerDecisionLabel ? (
                      <Badge variant="outline" className={cn("text-xs", customerDecisionTone)}>
                        {customerDecisionLabel}
                      </Badge>
                    ) : null}
                    {set ? (
                      <Badge variant="outline" className="text-xs">
                        {t("shoppingList", "alternative")}
                      </Badge>
                    ) : null}
                    {!isCounted ? (
                      <Badge variant="secondary" className="text-xs">
                        {t("shoppingList", "notCountedInTotal")}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-secondary/55 px-2.5 py-1 font-medium text-foreground/75">
                      <span className="text-xs text-muted-foreground">{t("shoppingList", "qty")}</span>
                      {renderEditableValue(item, "quantity", item.quantity, {
                        className: "font-medium text-foreground/75",
                        inputClassName: "w-16",
                        inputType: "number",
                      })}
                    </span>
                    {item.unitPrice !== undefined ? (
                      <span className="inline-flex flex-wrap items-baseline gap-x-1.5 whitespace-nowrap rounded-full bg-secondary/45 px-2.5 py-1">
                        <span className="text-xs text-muted-foreground">{t("shoppingList", "unit")}</span>
                        {renderEditableValue(
                          item,
                          "unitPrice",
                          `${item.unitPrice.toFixed(2)} ${currencySymbol}`,
                          {
                            inputClassName: "inline-flex w-28",
                            inputType: "number",
                            placeholder: "0.00",
                          },
                        )}
                        {formatPriceTaxBreakdown(
                          item.unitPrice,
                          {
                            priceTaxMode: item.priceTaxMode,
                            taxRateId: item.taxRateId,
                            taxRateSnapshot: item.taxRateSnapshot,
                          },
                          currencySymbol,
                        ) ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({formatPriceTaxBreakdown(
                              item.unitPrice,
                              {
                                priceTaxMode: item.priceTaxMode,
                                taxRateId: item.taxRateId,
                                taxRateSnapshot: item.taxRateSnapshot,
                              },
                              currencySymbol,
                            )})
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                    <span className="inline-flex rounded-full bg-secondary/55 px-2.5 py-1">
                      {renderPriceSpans(item.totalPrice, "total", item)}
                    </span>
                    {item.supplier ? (
                      renderEditableValue(item, "supplier", item.supplier, {
                        className: "block max-w-full truncate rounded-full bg-secondary/35 px-2.5 py-1 text-muted-foreground sm:max-w-40",
                        inputClassName: "w-44",
                        placeholder: t("shoppingList", "supplier"),
                      })
                    ) : null}
                  </div>
                  {item.priority || item.buyBefore || assignedName ? (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-foreground">
                      {item.priority ? (
                        <div className="flex items-center gap-2 rounded-full bg-secondary/35 px-2.5 py-1">
                          <span className="text-xs font-medium text-muted-foreground">{t("shoppingList", "priority")}</span>
                          {renderEditablePriority(item)}
                        </div>
                      ) : null}
                      {item.buyBefore ? (
                        <div className="flex items-center gap-2 rounded-full bg-secondary/35 px-2.5 py-1">
                          <span className="text-xs font-medium text-muted-foreground">{t("shoppingList", "buyBefore")}</span>
                          {renderEditableBuyBefore(item)}
                        </div>
                      ) : null}
                      {assignedName ? (
                        <div className="flex items-center gap-2 rounded-full bg-secondary/35 py-1 pl-1 pr-2.5">
                          <Avatar className="h-6 w-6 border border-border/70">
                            <AvatarImage src={teamMembers?.find((member) => member.clerkUserId === item.assignedTo)?.imageUrl} />
                            <AvatarFallback>{assignedName[0]}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium text-muted-foreground">{assignedName}</span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 lg:justify-end">
                <div className="flex flex-wrap items-center gap-1 rounded-full border border-border/60 bg-secondary/35 p-1 lg:justify-end">
                  <Select
                    value={item.realizationStatus}
                    onValueChange={(value) => void handleInlineStatusChange(value)}
                    disabled={isPending || updatingStatusItemId === itemId}
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label={`Change status for ${item.name}`}
                      className={cn(
                        "h-9 w-fit min-w-0 rounded-full px-3.5 pr-2.5 text-xs font-semibold tracking-[0.01em] shadow-none transition-colors",
                        "focus-visible:border-ring/40 focus-visible:ring-ring/15 disabled:opacity-70",
                        getInlineStatusClassName(item.realizationStatus),
                      )}
                    >
                      <span>{getStatusLabel(item.realizationStatus)}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {SHOPPING_STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {t("shoppingList", status.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {item.productLink ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-full text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                          onClick={() => window.open(item.productLink, "_blank")}
                        >
                          <ExternalLinkIcon className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("shoppingList", "openLink")}</TooltipContent>
                    </Tooltip>
                  ) : null}
                  {hasExpandedDetails ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-full text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                      onClick={() => toggleDetails(itemId)}
                    >
                      {expandedDetails[itemId] ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                    onClick={() => handleStartEdit(item)}
                  >
                    <EditIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onDeleteItem(item._id)}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {hasHeaderDetails ? (
                <div className="mt-1 grid min-w-0 grid-cols-1 gap-x-4 gap-y-2 border-t border-border/60 pt-3 text-sm text-muted-foreground sm:grid-cols-2 lg:col-span-2 xl:grid-cols-4">
                  {headerDetails.map((detail) => (
                    <div key={detail.label} className="flex min-w-0 items-center gap-2 rounded-xl bg-secondary/35 px-3 py-2">
                      <span className="shrink-0 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{detail.label}</span>
                      {renderEditableValue(
                        item,
                        detail.field,
                        <span className="block max-w-full truncate">{detail.value}</span>,
                        {
                          className: "min-w-0 max-w-full text-muted-foreground",
                          inputClassName: "w-40",
                        },
                      )}
                    </div>
                  ))}
                  {item.productLink ? (
                    <div className="flex min-w-0 items-center gap-2 rounded-xl bg-secondary/35 px-3 py-2">
                      <span className="shrink-0 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{t("shoppingList", "link")}</span>
                      {renderEditableValue(
                        item,
                        "productLink",
                        <span className="block max-w-full truncate text-primary">
                          {getProductLinkLabel(item.productLink)}
                        </span>,
                        {
                          className: "min-w-0 max-w-full",
                          inputClassName: "w-52",
                          placeholder: "https://...",
                        },
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {expandedDetails[itemId] && hasExpandedDetails ? (
              <div className="mt-4 border-t pt-4">
                <ShoppingListItemDetails item={item} teamMembers={teamMembers} />
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  const renderSetBlock = (set: ShoppingSet) => {
    const setItems = items.filter((item) => String(item.setId ?? "") === String(set._id));
    if (setItems.length === 0) {
      return null;
    }

    const selectedIds = new Set((set.resolvedItemIds ?? []).map((id) => String(id)));
    const preferredIds = new Set((set.preferredItemIds ?? []).map((id) => String(id)));
    const hasResolvedSelection = selectedIds.size > 0;
    const preferredLeadId = String(
      hasResolvedSelection
        ? set.resolvedItemIds?.[0] ?? ""
        : set.preferredItemIds?.[0] ?? set.resolvedItemIds?.[0] ?? "",
    );
    const leadItem =
      setItems.find((item) => String(item._id) === preferredLeadId) ??
      setItems[0];
    const orderedSetItems = leadItem
      ? [leadItem, ...setItems.filter((item) => item._id !== leadItem._id)]
      : setItems;
    const fallbackSelectedId = orderedSetItems[0]?._id ? String(orderedSetItems[0]._id) : null;
    const effectiveSelectedIds =
      selectedIds.size > 0
        ? selectedIds
        : preferredIds.size > 0
          ? preferredIds
          : set.selectionMode === "single" && fallbackSelectedId
          ? new Set([fallbackSelectedId])
          : new Set<string>();
    const visibleSetItems = hasResolvedSelection
      ? orderedSetItems.filter((item) => effectiveSelectedIds.has(String(item._id)))
      : orderedSetItems;

    const toggleSetSelection = async (itemId: string) => {
      if (set.selectionMode === "none") return;

      if (set.selectionMode === "single") {
        await onUpdateSet(set._id, {
          resolvedItemIds: [itemId as Id<"shoppingListItems">],
          status: "resolved",
          resolvedBySource: "team",
          resolvedByName: null,
          resolvedAt: Date.now(),
        });
        return;
      }

      const next = new Set(effectiveSelectedIds);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      await onUpdateSet(set._id, {
        resolvedItemIds: Array.from(next) as Id<"shoppingListItems">[],
        status: next.size > 0 ? "resolved" : set.status,
        resolvedBySource: next.size > 0 ? "team" : null,
        resolvedByName: null,
        resolvedAt: next.size > 0 ? Date.now() : null,
      });
    };

    return (
      <div key={set._id} className="vibe-surface p-5">
        <div className="mb-4 flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Layers3Icon className="h-4 w-4 text-primary" />
              <h3 className="text-base font-medium text-foreground">{leadItem?.name || set.title}</h3>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">{t("shoppingList", "alternativeGroup")}</Badge>
              <Badge variant="secondary" className="text-xs">
                {setItems.length} {t("shoppingList", "options")}
              </Badge>
              {hasResolvedSelection ? (
                <Badge
                  variant="outline"
                  className={cn("text-xs", getSelectionSourceTone(set.resolvedBySource))}
                >
                  {t("shoppingList", "chosenOption")}
                </Badge>
              ) : null}
            </div>
            {set.notes ? <p className="mt-3 text-sm text-muted-foreground">{set.notes}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setAddingAlternativeSetId((current) =>
                  current === String(set._id) ? null : String(set._id),
                )
              }
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              {t("shoppingList", "addAlternative")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="self-start text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDeleteSet(set._id)}
            >
              <TrashIcon className="mr-2 h-4 w-4" />
              {t("shoppingList", "removeGroup")}
            </Button>
          </div>
        </div>

        {addingAlternativeSetId === String(set._id) ? (
          <div className="vibe-row mb-4 p-4">
            <AddItemForm
              projectId={projectId}
              teamId={teamId}
              sections={sections}
              teamMembers={teamMembers}
              taxRates={activeTaxRates}
              currencySymbol={currencySymbol}
              onAddItem={async (itemData) => {
                const itemId = await onAddItem({
                  ...itemData,
                  sectionId,
                  setId: set._id,
                });
                setAddingAlternativeSetId(null);
                return itemId;
              }}
              isPending={isPending}
              defaultSectionId={sectionId}
              defaultSetId={set._id}
              hideSectionField
              hideAlternativeControls
              submitLabel={t("shoppingList", "addAlternative")}
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          {visibleSetItems.map((item) => {
            const isSelected = effectiveSelectedIds.has(String(item._id));
            const isPreferred = preferredIds.has(String(item._id));
            return (
              <div key={item._id} className="flex flex-col gap-3">
                {set.selectionMode !== "none" ? (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant={
                        set.selectionMode === "single"
                          ? "default"
                          : isSelected
                            ? "default"
                            : "outline"
                      }
                      onClick={
                        set.selectionMode === "single" && isSelected
                          ? undefined
                          : () => void toggleSetSelection(String(item._id))
                      }
                      className={
                        set.selectionMode === "single"
                          ? cn(
                              "bg-primary text-primary-foreground hover:bg-primary/90",
                              isSelected && "cursor-default hover:bg-primary",
                            )
                          : undefined
                      }
                    >
                      {isSelected ? <CheckIcon className="mr-1 h-4 w-4" /> : null}
                      {set.selectionMode === "single"
                        ? isSelected
                          ? getSelectionSourceLabel(
                              set.resolvedBySource,
                              set.selectionMode,
                            )
                          : hasResolvedSelection
                            ? t("shoppingList", "chooseInstead")
                            : t("shoppingList", "chooseThisOption")
                        : isSelected
                          ? t("shoppingList", "included")
                          : t("shoppingList", "include")}
                    </Button>
                  </div>
                ) : null}
                <div className="flex flex-col gap-2">
                  {set.selectionMode === "single" && (isSelected || isPreferred) ? (
                    <div className="flex flex-wrap items-center gap-2 px-1">
                      {isSelected ? (
                        <Badge
                          variant="outline"
                          className={cn("text-xs", getSelectionSourceTone(set.resolvedBySource))}
                        >
                          {getSelectionSourceLabel(
                            set.resolvedBySource,
                            set.selectionMode,
                          )}
                        </Badge>
                      ) : null}
                      {isPreferred && !isSelected ? (
                        <Badge variant="secondary" className="text-xs">
                          {t("shoppingList", "suggestedOption")}
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                  {renderItemRow(item, set)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="vibe-panel mb-10 p-5 sm:p-8">
      <div className="mb-7 flex flex-col justify-between gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-foreground">{sectionName}</h2>
          <span className="inline-flex items-center justify-center rounded-full border border-border/60 bg-secondary/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            {formatItemCountLabel(items.length)}
          </span>
          <span className="inline-flex items-center justify-center rounded-full border border-border/60 bg-secondary/70 px-3 py-1 text-xs font-medium text-foreground">
            {t("shoppingList", "totalLabel")} {sectionTotal.toFixed(2)} {currencySymbol}
          </span>
        </div>
        <Button variant="ghost" size="icon-sm" className="self-end rounded-full border border-border/60 bg-secondary/70 sm:self-auto" onClick={() => setShowAddForm((current) => !current)}>
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>

      {showAddForm ? (
        <div className="vibe-surface mb-8 p-6">
          <AddItemForm
            projectId={projectId}
            teamId={teamId}
            sections={sections}
            teamMembers={teamMembers}
            taxRates={activeTaxRates}
            currencySymbol={currencySymbol}
            onAddItem={async (itemData) => {
              const itemId = await onAddItem({
                ...itemData,
                sectionId,
              });
              setShowAddForm(false);
              return itemId;
            }}
            onEnableAlternatives={onCreateAlternativesForItem}
            isPending={isPending}
            defaultSectionId={sectionId}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {sectionSets.map((set) => renderSetBlock(set))}
        {standaloneItems.map((item) => renderItemRow(item))}
      </div>
    </div>
  );
}
