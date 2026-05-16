import { useState } from "react";
import type { CheckedState } from "@radix-ui/react-checkbox";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, WandSparkles } from "lucide-react";
import { Doc, Id } from "@/convex/_generated/dataModel";
import type { TeamMember } from "@/lib/teamMember";
import { toast } from "sonner";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import type { TeamTaxRate } from "@/lib/organizationTax";
import {
  calculatePriceTaxBreakdown,
  formatPriceTaxBreakdown,
  getDefaultPriceTaxRateId,
  normalizePriceTaxMode,
  resolvePriceTaxSnapshot,
  type PriceTaxMode,
  type PriceTaxRateSnapshot,
} from "@/lib/priceTax";
import { useI18n } from "@/lib/i18n";

interface AddItemFormProps {
  projectId: Id<"projects">;
  teamId: Id<"teams">;
  sections: Doc<"shoppingListSections">[];
  teamMembers?: TeamMember[];
  taxRates?: TeamTaxRate[];
  currencySymbol: string;
  onAddItem: (itemData: {
    name: string;
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
    priority: "low" | "medium" | "high" | "urgent";
    realizationStatus:
      | "PLANNED"
      | "ORDERED"
      | "IN_TRANSIT"
      | "DELIVERED"
      | "COMPLETED"
      | "CANCELLED";
    assignedTo?: string;
    buyBefore?: number;
  }) => Promise<Id<"shoppingListItems"> | void>;
  onEnableAlternatives?: (
    itemId: Id<"shoppingListItems">,
    itemName: string,
    sectionId?: Id<"shoppingListSections">,
  ) => Promise<Id<"shoppingSets"> | void>;
  isPending: boolean;
  defaultSectionId?: Id<"shoppingListSections">;
  defaultSetId?: Id<"shoppingSets">;
  hideSectionField?: boolean;
  hideAlternativeControls?: boolean;
  submitLabel?: string;
}

export function AddItemForm({
  projectId,
  teamId,
  sections,
  teamMembers,
  taxRates = [],
  currencySymbol,
  onAddItem,
  onEnableAlternatives,
  isPending,
  defaultSectionId,
  defaultSetId,
  hideSectionField = false,
  hideAlternativeControls = false,
  submitLabel,
}: AddItemFormProps) {
  const { t } = useI18n();
  const resolvedSubmitLabel = submitLabel ?? t("shoppingList", "addProduct");
  const [newItemName, setNewItemName] = useState("");
  const [newItemSupplier, setNewItemSupplier] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemSectionId, setNewItemSectionId] = useState<
    Id<"shoppingListSections"> | "none" | ""
  >(defaultSectionId || "");
  const [newItemCatalogNumber, setNewItemCatalogNumber] = useState("");
  const [newItemDimensions, setNewItemDimensions] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemUnitPrice, setNewItemUnitPrice] = useState("");
  const [newItemPriceTaxMode, setNewItemPriceTaxMode] =
    useState<PriceTaxMode>("unspecified");
  const [newItemTaxRateId, setNewItemTaxRateId] = useState<string>(
    getDefaultPriceTaxRateId(taxRates) ?? "",
  );
  const [newItemProductLink, setNewItemProductLink] = useState("");
  const [newItemImageUrl, setNewItemImageUrl] = useState("");
  const [newItemAssignedTo, setNewItemAssignedTo] = useState<string>("none");
  const [newItemBuyBefore, setNewItemBuyBefore] = useState<Date | undefined>(
    undefined,
  );
  const [isScraping, setIsScraping] = useState(false);
  const [newItemHasAlternatives, setNewItemHasAlternatives] = useState(false);
  const activeTaxRates = taxRates.filter((entry) => !entry.isArchived);
  const selectedTaxRateId =
    newItemTaxRateId || getDefaultPriceTaxRateId(activeTaxRates) || "";
  const selectedTaxSnapshot = resolvePriceTaxSnapshot(
    newItemPriceTaxMode,
    selectedTaxRateId,
    activeTaxRates,
  );

  const normalizeProductUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";

    const candidate = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Invalid URL protocol");
    }
    return parsed.toString();
  };

  const handleScrapeByUrl = async () => {
    const rawUrl = newItemProductLink.trim();
    if (!rawUrl || isScraping) {
      return;
    }

    let normalizedUrl = "";
    try {
      normalizedUrl = normalizeProductUrl(rawUrl);
    } catch {
      toast.error(t("shoppingList", "invalidProductUrl"));
      return;
    }

    setIsScraping(true);
    setNewItemProductLink(normalizedUrl);

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

      if (payload.name) setNewItemName(payload.name);
      if (payload.supplier) setNewItemSupplier(payload.supplier);
      if (payload.category) setNewItemCategory(payload.category);
      if (payload.catalogNumber) setNewItemCatalogNumber(payload.catalogNumber);
      if (payload.dimensions) setNewItemDimensions(payload.dimensions);
      if (
        typeof payload.unitPrice === "number" &&
        Number.isFinite(payload.unitPrice)
      ) {
        setNewItemUnitPrice(String(payload.unitPrice));
      }
      if (payload.imageUrl) setNewItemImageUrl(payload.imageUrl);
      if (payload.productLink) setNewItemProductLink(payload.productLink);

      toast.success(t("shoppingList", "productDetailsImported"));
    } catch (error) {
      toast.error(t("shoppingList", "couldNotImportProductDetails"), {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setIsScraping(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;

    let normalizedProductLink: string | undefined;
    if (newItemProductLink.trim()) {
      try {
        normalizedProductLink = normalizeProductUrl(newItemProductLink);
      } catch {
        toast.error(t("shoppingList", "invalidProductUrl"));
        return;
      }
    }

    const normalizedUnitPrice = newItemUnitPrice.trim();
    const unitPrice =
      normalizedUnitPrice === ""
        ? undefined
        : Number.parseFloat(normalizedUnitPrice);
    const normalizedPriceTaxMode = normalizePriceTaxMode(newItemPriceTaxMode);
    const taxRateSnapshot = resolvePriceTaxSnapshot(
      normalizedPriceTaxMode,
      selectedTaxRateId,
      activeTaxRates,
    );

    if (
      (normalizedPriceTaxMode === "net" || normalizedPriceTaxMode === "gross") &&
      !taxRateSnapshot
    ) {
      toast.error(t("shoppingList", "selectTaxRateOrLeaveUnspecified"));
      return;
    }

    try {
      const itemId = await onAddItem({
        name: newItemName.trim(),
        supplier: newItemSupplier.trim() || undefined,
        category: newItemCategory.trim() || undefined,
        sectionId:
          newItemSectionId === "none"
            ? undefined
            : newItemSectionId || undefined,
        setId: defaultSetId,
        catalogNumber: newItemCatalogNumber.trim() || undefined,
        dimensions: newItemDimensions.trim() || undefined,
        quantity: newItemQuantity,
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : undefined,
        priceTaxMode: normalizedPriceTaxMode,
        taxRateId:
          normalizedPriceTaxMode === "net" || normalizedPriceTaxMode === "gross"
            ? taxRateSnapshot?.id ?? selectedTaxRateId
            : null,
        taxRateSnapshot: taxRateSnapshot ?? null,
        productLink: normalizedProductLink,
        imageUrl: newItemImageUrl.trim() || undefined,
        priority: "medium",
        realizationStatus: "PLANNED",
        assignedTo:
          newItemAssignedTo === "none" ? undefined : newItemAssignedTo,
        buyBefore: newItemBuyBefore?.getTime(),
      });

      if (
        itemId &&
        !defaultSetId &&
        !hideAlternativeControls &&
        newItemHasAlternatives &&
        onEnableAlternatives
      ) {
        await onEnableAlternatives(
          itemId,
          newItemName.trim(),
          newItemSectionId === "none"
            ? undefined
            : newItemSectionId || undefined,
        );
      }

      setNewItemName("");
      setNewItemSupplier("");
      setNewItemCategory("");
      setNewItemSectionId(defaultSectionId || "");
      setNewItemCatalogNumber("");
      setNewItemDimensions("");
      setNewItemQuantity(1);
      setNewItemUnitPrice("");
      setNewItemPriceTaxMode("unspecified");
      setNewItemTaxRateId(getDefaultPriceTaxRateId(activeTaxRates) ?? "");
      setNewItemProductLink("");
      setNewItemImageUrl("");
      setNewItemAssignedTo("none");
      setNewItemBuyBefore(undefined);
      setNewItemHasAlternatives(false);
    } catch (error) {
      console.error("Error creating item:", error);
      toast.error(t("shoppingList", "failedToAddItem"), {
        description: toUserFacingErrorMessage(error),
      });
    }
  };

  const totalPrice = newItemUnitPrice
    ? newItemQuantity * (parseFloat(newItemUnitPrice) || 0)
    : 0;
  const unitPriceNumber = Number.parseFloat(newItemUnitPrice);
  const priceTaxMetadata = {
    priceTaxMode: newItemPriceTaxMode,
    taxRateId: selectedTaxRateId,
    taxRateSnapshot: selectedTaxSnapshot ?? null,
  };
  const unitBreakdownLabel = formatPriceTaxBreakdown(
    Number.isFinite(unitPriceNumber) ? unitPriceNumber : undefined,
    priceTaxMetadata,
    currencySymbol,
  );
  const totalBreakdown = calculatePriceTaxBreakdown(totalPrice, priceTaxMetadata);

  return (
    <div className="flex flex-col gap-4">
      {defaultSetId ? (
        <div className="vibe-row border-dashed px-4 py-3 text-sm text-muted-foreground">
          {t("shoppingList", "addedAsAnotherOption")}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Field>
          <FieldLabel>{t("shoppingList", "productName")}</FieldLabel>
          <Input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder={t("shoppingList", "productNamePlaceholder")}
            className="h-12 text-sm"
          />
        </Field>
        {!hideSectionField ? (
          <Field>
            <FieldLabel>{t("shoppingList", "section")}</FieldLabel>
            <Select
              value={newItemSectionId}
              onValueChange={(value) =>
                setNewItemSectionId(
                  value as Id<"shoppingListSections"> | "none",
                )
              }
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
        ) : null}
        <Field>
          <FieldLabel>{t("shoppingList", "supplier")}</FieldLabel>
          <Input
            value={newItemSupplier}
            onChange={(e) => setNewItemSupplier(e.target.value)}
            placeholder={t("shoppingList", "supplierPlaceholder")}
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>{t("shoppingList", "catalogNumber")}</FieldLabel>
          <Input
            value={newItemCatalogNumber}
            onChange={(e) => setNewItemCatalogNumber(e.target.value)}
            placeholder={t("shoppingList", "catalogNumberPlaceholder")}
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>{t("shoppingList", "category")}</FieldLabel>
          <Input
            value={newItemCategory}
            onChange={(e) => setNewItemCategory(e.target.value)}
            placeholder={t("shoppingList", "categoryPlaceholder")}
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>{t("shoppingList", "dimensions")}</FieldLabel>
          <Input
            value={newItemDimensions}
            onChange={(e) => setNewItemDimensions(e.target.value)}
            placeholder={t("shoppingList", "dimensionsPlaceholder")}
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>{t("shoppingList", "quantity")}</FieldLabel>
          <Input
            type="number"
            min="1"
            value={newItemQuantity}
            onChange={(e) =>
              setNewItemQuantity(parseInt(e.target.value, 10) || 1)
            }
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>{t("shoppingList", "unitPrice")} ({currencySymbol})</FieldLabel>
          <Input
            type="number"
            step="0.01"
            value={newItemUnitPrice}
            onChange={(e) => setNewItemUnitPrice(e.target.value)}
            placeholder="0.00"
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>{t("shoppingList", "taxTreatment")}</FieldLabel>
          <Select
            value={newItemPriceTaxMode}
            onValueChange={(value) => {
              const mode = normalizePriceTaxMode(value);
              setNewItemPriceTaxMode(mode);
              if ((mode === "net" || mode === "gross") && !newItemTaxRateId) {
                setNewItemTaxRateId(getDefaultPriceTaxRateId(activeTaxRates) ?? "");
              }
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
        {newItemPriceTaxMode === "net" || newItemPriceTaxMode === "gross" ? (
          <Field>
            <FieldLabel>{t("shoppingList", "taxRate")}</FieldLabel>
            <Select value={selectedTaxRateId} onValueChange={setNewItemTaxRateId}>
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
        <Field>
          <FieldLabel>{t("shoppingList", "productLink")}</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              value={newItemProductLink}
              onChange={(e) => setNewItemProductLink(e.target.value)}
              placeholder="https://..."
              className="h-12 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              disabled={isPending || isScraping || !newItemProductLink.trim()}
              onClick={handleScrapeByUrl}
              className="h-12 shrink-0 px-4"
            >
              {isScraping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <WandSparkles className="h-4 w-4" />
              )}
              <span className="ml-2 hidden xl:inline">
                {isScraping ? t("shoppingList", "scrapeProductDetails") : t("shoppingList", "autoFill")}
              </span>
            </Button>
          </div>
        </Field>
        <Field className="md:col-span-2 lg:col-span-3">
          <FieldLabel>{t("shoppingList", "imageUrl")}</FieldLabel>
          <Input
            value={newItemImageUrl}
            onChange={(e) => setNewItemImageUrl(e.target.value)}
            placeholder="https://..."
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>{t("shoppingList", "assignTo")}</FieldLabel>
          <Select
            value={newItemAssignedTo}
            onValueChange={setNewItemAssignedTo}
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
            date={newItemBuyBefore}
            onDateChange={setNewItemBuyBefore}
            placeholder={t("shoppingList", "pickDate")}
            className="h-12 w-full text-sm"
          />
        </Field>
      </div>

      {!defaultSetId && !hideAlternativeControls ? (
        <div className="vibe-row flex items-start gap-3 px-4 py-3">
          <Checkbox
            id="new-item-has-alternatives"
            checked={newItemHasAlternatives}
            onCheckedChange={(checked: CheckedState) =>
              setNewItemHasAlternatives(checked === true)
            }
            className="mt-0.5"
          />
          <label
            htmlFor="new-item-has-alternatives"
            className="cursor-pointer text-sm leading-6"
          >
            <span className="font-medium text-foreground">
              {t("shoppingList", "offerAlternatives")}
            </span>
            <span className="block text-muted-foreground">
              {t("shoppingList", "createAlternativeGroupDescription")}
            </span>
          </label>
        </div>
      ) : null}

      {totalPrice > 0 && (
        <div className="flex flex-col items-end gap-1 text-sm">
          <div className="flex items-center justify-end gap-2">
            <span className="text-muted-foreground">{t("shoppingList", "totalLabel")}</span>
            <span className="font-medium text-foreground">
              {totalPrice.toFixed(2)} {currencySymbol}
            </span>
          </div>
          {unitBreakdownLabel ? (
            <span className="text-xs text-muted-foreground">
              {t("shoppingList", "unitLabel")} {unitBreakdownLabel}
            </span>
          ) : null}
          {totalBreakdown.hasBreakdown ? (
            <span className="text-xs text-muted-foreground">
              {t("shoppingList", "grossTotal")} {totalBreakdown.gross.toFixed(2)} {currencySymbol}
            </span>
          ) : null}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button
          onClick={handleAddItem}
          disabled={isPending || isScraping || !newItemName.trim()}
          className="h-11 px-6"
        >
          {isPending ? t("shoppingList", "adding") : resolvedSubmitLabel}
        </Button>
      </div>
    </div>
  );
}
