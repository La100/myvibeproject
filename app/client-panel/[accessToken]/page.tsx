"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ExternalLink, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { apiAny } from "@/lib/convexApiAny";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

type ClientPanelItem = Doc<"clientPanelItems">;
type ClientPanelSection = Doc<"clientPanelSections">;

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

  return (
    <div
      className={`${sizeClass} flex items-center justify-center rounded-xl border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] text-xs text-[var(--ui-text-muted)]`}
    >
      No image
    </div>
  );
}

function ClientPanelSkeleton() {
  return <Spinner className="mx-auto w-full max-w-6xl px-6 pb-24 pt-8 sm:px-8" />;
}

export default function PublicClientPanelPage() {
  const params = useParams<{ accessToken: string }>();
  const accessToken = params.accessToken;

  const panelData = useQuery(apiAny.shopping.getPublicShoppingListByAccessToken, {
    accessToken,
  });
  const selectAlternative = useMutation(apiAny.shopping.selectShoppingAlternativeByAccessToken);

  const [localSelection, setLocalSelection] = useState<Record<string, string>>({});
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  const project = panelData?.project;
  const sections = (panelData?.sections || []) as ClientPanelSection[];
  const items = (panelData?.items || []) as ClientPanelItem[];
  const settings = panelData?.settings || {
    showNotes: true,
    showSupplier: true,
    showPrice: true,
  };

  const currencySymbol = getCurrencySymbol(project?.currency);

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

  if (panelData === undefined) {
    return <ClientPanelSkeleton />;
  }

  if (panelData === null || !project) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-xl items-center justify-center px-4 text-center">
        <div>
          <h1 className="mb-2 text-2xl font-semibold">Invalid link</h1>
          <p className="text-muted-foreground">
            This customer panel link is invalid or no longer active.
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
            <ShoppingCart className="h-8 w-8 text-[var(--ui-accent-brand)]" />
            <h1 className="text-4xl font-medium tracking-tight font-[var(--font-display-serif)] text-[var(--ui-text-strong)] md:text-5xl">
              Shopping List
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] px-4 py-2 text-sm font-medium text-[var(--ui-accent-brand)]">
              {project.name}
            </span>
            {settings.showPrice ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] px-4 py-2 text-sm font-medium text-[var(--ui-text-main)]">
                Total: {formatAmount(grandTotal, currencySymbol)}
              </span>
            ) : null}
          </div>
          <p className="max-w-4xl text-sm text-muted-foreground">
            Select one option for each material. Your choices are saved automatically, and list
            content changes only after the team clicks Update panel.
          </p>
        </div>
      </div>

      {panelData.version === 0 ? (
        <div className="mb-8 rounded-[20px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] px-5 py-4 text-sm text-[var(--ui-text-muted)]">
          This panel has not been updated yet. Ask the project team to click Update in Customer
          Panel settings.
        </div>
      ) : null}

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

                      {savingItemId === baseItemId ? (
                        <p className="pt-3 text-xs text-[var(--ui-text-muted)]">Saving selection...</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {settings.showPrice && sectionSummaries.length > 0 ? (
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
