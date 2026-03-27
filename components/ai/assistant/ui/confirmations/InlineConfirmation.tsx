/**
 * Inline Confirmation Components
 * 
 * Displays confirmation cards inline within the AI message flow.
 * Allows users to confirm, edit, or reject items without a dialog.
 */

"use client";

import React, { memo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Loader2,
} from "lucide-react";
import type { PendingContentItem } from "../../data/types";
import {
  extractBulkCreateEntries,
  getApprovalState,
  getCanonicalType,
  shouldHideSectionCard,
  shouldRenderByState,
} from "./helpers";
import { InlineCreationForm } from "./InlineCreationForm";

// ============================================
// SINGLE CONFIRMATION CARD
// ============================================

interface ConfirmationCardProps {
  item: PendingContentItem;
  index: number;
  onConfirm?: (index: number | string) => Promise<void>;
  onReject?: (index: number | string) => void | Promise<void>;
  onEdit?: (index: number) => void;
  onUpdate?: (index: number | string, updates: Partial<PendingContentItem>) => void;
  isProcessing?: boolean;
  confirmationMode?: "always_ask" | "auto_confirm";
  onConfirmationModeChange?: (mode: "always_ask" | "auto_confirm") => void | Promise<void>;
  isModeUpdating?: boolean;
  showActions?: boolean;
}

export const ConfirmationCard = memo(function ConfirmationCard({
  item,
  index,
  onConfirm,
  onReject,
  onUpdate,
  showActions = true,
}: ConfirmationCardProps) {
  const canonicalType = getCanonicalType(item.type);
  const supportedTypes = [
    "task",
    "note",
    "moodboard",
    "shopping",
    "labor",
    "contact",
    "survey",
    "shoppingSection",
    "laborSection",
    "projectSettings",
  ];
  const approvalState = getApprovalState(item);
  if (!shouldRenderByState(approvalState)) {
    return null;
  }

  const isEditableState = !item.status && approvalState === "approval-requested";
  const canRenderInlineForm =
    supportedTypes.includes(canonicalType) &&
    isEditableState &&
    !!onUpdate &&
    !!onConfirm &&
    !!onReject;
  if (!canRenderInlineForm || !onUpdate || !onConfirm || !onReject) {
    return null;
  }

  return (
    <InlineCreationForm
      item={item}
      index={index}
      onConfirm={onConfirm}
      onReject={onReject}
      onUpdate={onUpdate}
      showActions={showActions}
    />
  );
});

ConfirmationCard.displayName = "ConfirmationCard";

// ============================================
// INLINE CONFIRMATION LIST
// ============================================

interface InlineConfirmationListProps {
  items: PendingContentItem[];
  onConfirmItem?: (index: number | string) => Promise<void>;
  onRejectItem?: (index: number | string) => void | Promise<void>;
  onEditItem?: (index: number) => void;
  onConfirmAll?: () => Promise<void>;
  onRejectAll?: () => void | Promise<void>;
  onUpdateItem?: (index: number | string, updates: Partial<PendingContentItem>) => void;
  isProcessing?: boolean;
  confirmationMode?: "always_ask" | "auto_confirm";
  onConfirmationModeChange?: (mode: "always_ask" | "auto_confirm") => void | Promise<void>;
  isModeUpdating?: boolean;
}

export function InlineConfirmationList({
  items,
  onConfirmItem,
  onRejectItem,
  onEditItem,
  onConfirmAll,
  onRejectAll,
  onUpdateItem,
  isProcessing = false,
  confirmationMode = "always_ask",
  onConfirmationModeChange,
  isModeUpdating = false,
}: InlineConfirmationListProps) {
  const [showResolvedDetails, setShowResolvedDetails] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const noopUpdate: NonNullable<InlineConfirmationListProps["onUpdateItem"]> =
    React.useCallback(() => {
      // Bulk-expanded preview cards can share one source call id.
      // Keep the full inline form layout without mutating shared source payload.
    }, []);

  const getSectionNameFromRecord = React.useCallback(
    (value: unknown): string | undefined => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return undefined;
      }

      const record = value as Record<string, unknown>;
      const candidates = [
        record.sectionName,
        record.name,
        record.title,
        record.section,
        (record.sectionData as Record<string, unknown> | undefined)?.sectionName,
        (record.sectionData as Record<string, unknown> | undefined)?.name,
        (record.data as Record<string, unknown> | undefined)?.sectionName,
        (record.data as Record<string, unknown> | undefined)?.name,
      ];

      for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim().length > 0) {
          return candidate.trim();
        }
      }

      return undefined;
    },
    [],
  );

  const inferSharedSectionName = React.useCallback(
    (type: "shopping" | "labor") => {
      const sectionType = type === "shopping" ? "shoppingSection" : "laborSection";
      const matchingSections = items.filter((entry) => entry.type === sectionType);
      if (matchingSections.length !== 1) return undefined;

      const sectionData = (matchingSections[0]?.data ?? {}) as Record<string, unknown>;
      const candidates = [
        sectionData.name,
        sectionData.sectionName,
        sectionData.title,
        (sectionData.sectionData as Record<string, unknown> | undefined)?.name,
        (sectionData.sectionData as Record<string, unknown> | undefined)?.sectionName,
        (sectionData.data as Record<string, unknown> | undefined)?.name,
        (sectionData.data as Record<string, unknown> | undefined)?.sectionName,
      ];

      for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim().length > 0) {
          return candidate.trim();
        }
      }

      return undefined;
    },
    [items],
  );

  const referencedSectionNames = React.useMemo(() => {
    const shopping = new Set<string>();
    const labor = new Set<string>();

    for (const item of items) {
      const canonicalType = getCanonicalType(item.type);
      if (canonicalType !== "shopping" && canonicalType !== "labor") {
        continue;
      }

      const bulkEntries = extractBulkCreateEntries(item);
      const candidates =
        bulkEntries.length > 0 ? bulkEntries : [((item.data ?? {}) as Record<string, unknown>)];

      for (const candidate of candidates) {
        const sectionName = getSectionNameFromRecord(candidate);
        if (!sectionName) continue;

        if (canonicalType === "shopping") {
          shopping.add(sectionName);
        } else {
          labor.add(sectionName);
        }
      }
    }

    return { shopping, labor };
  }, [getSectionNameFromRecord, items]);

  const shoppingItemsExist = React.useMemo(
    () => items.some((entry) => getCanonicalType(entry.type) === "shopping"),
    [items],
  );
  const laborItemsExist = React.useMemo(
    () => items.some((entry) => getCanonicalType(entry.type) === "labor"),
    [items],
  );

  const hiddenSectionMeta = React.useMemo(() => {
    const shoppingSectionName = shoppingItemsExist ? inferSharedSectionName("shopping") : undefined;
    const laborSectionName = laborItemsExist ? inferSharedSectionName("labor") : undefined;

    return {
      shopping: shoppingItemsExist && !!shoppingSectionName ? shoppingSectionName : undefined,
      labor: laborItemsExist && !!laborSectionName ? laborSectionName : undefined,
    };
  }, [inferSharedSectionName, laborItemsExist, shoppingItemsExist]);

  const displayItems = items.flatMap((item, index) => {
    const bulkEntries = extractBulkCreateEntries(item);
    if (bulkEntries.length <= 1) {
      const canonicalType = getCanonicalType(item.type);
      const inferredSectionName =
        canonicalType === "shopping" || canonicalType === "labor"
          ? inferSharedSectionName(canonicalType)
          : undefined;
      const currentData = (item.data ?? {}) as Record<string, unknown>;
      const normalizedItem =
        inferredSectionName &&
        typeof currentData.sectionName !== "string"
          ? {
              ...item,
              data: {
                ...currentData,
                sectionName: inferredSectionName,
              },
            }
          : item;

      const normalizedData = (normalizedItem.data ?? {}) as Record<string, unknown>;
      const sectionCardName = getSectionNameFromRecord(normalizedData);

      const shouldHideCurrentSectionCard = shouldHideSectionCard({
        canonicalType,
        sectionCardName,
        referencedSectionNames,
        hiddenSectionMeta,
      });

      return [{
        item: normalizedItem,
        index,
        key: `${index}`,
        fromBulk: false,
        hidden: shouldHideCurrentSectionCard,
      }];
    }

    return bulkEntries.map((entry, entryIndex) => {
      const canonicalType = getCanonicalType(item.type);
      const inferredSectionName =
        canonicalType === "shopping" || canonicalType === "labor"
          ? inferSharedSectionName(canonicalType)
          : undefined;
      const normalizedEntry =
        inferredSectionName && typeof entry.sectionName !== "string"
          ? { ...entry, sectionName: inferredSectionName }
          : entry;
      const sectionCardName = getSectionNameFromRecord(normalizedEntry);
      const hidden = shouldHideSectionCard({
        canonicalType,
        sectionCardName,
        referencedSectionNames,
        hiddenSectionMeta,
      });

      return {
        item: {
          ...item,
          operation: "create" as const,
          data: normalizedEntry,
          clientId: item.clientId ? `${item.clientId}::${entryIndex}` : undefined,
        },
        index,
        key: `${index}-${entryIndex}`,
        fromBulk: true,
        hidden,
      };
    });
  });

  const visibleItems = displayItems
    .filter(({ item, hidden }) => !hidden && shouldRenderByState(getApprovalState(item)));

  if (visibleItems.length === 0) return null;

  const unresolvedItems = visibleItems.filter(({ item }) => {
    const approvalState = getApprovalState(item);
    return !(
      item.status === "confirmed" ||
      item.status === "rejected" ||
      approvalState === "output-available" ||
      approvalState === "output-denied" ||
      approvalState === "output-error" ||
      approvalState === "approval-responded"
    );
  });

  const allResolved = unresolvedItems.length === 0;
  if (allResolved) {
    const confirmedCount = visibleItems.filter(({ item }) => {
      const approvalState = getApprovalState(item);
      return item.status === "confirmed" || approvalState === "output-available";
    }).length;
    const rejectedCount = visibleItems.length - confirmedCount;
    const groupedByType = visibleItems.reduce((acc, { item }) => {
      const key = getCanonicalType(item.type);
      if (!acc[key]) {
        acc[key] = { confirmed: 0, rejected: 0 };
      }
      const approvalState = getApprovalState(item);
      const isConfirmed =
        item.status === "confirmed" || approvalState === "output-available";
      if (isConfirmed) {
        acc[key].confirmed += 1;
      } else {
        acc[key].rejected += 1;
      }
      return acc;
    }, {} as Record<string, { confirmed: number; rejected: number }>);
    const typeSummaries = Object.entries(groupedByType);
    const toTypeLabel = (type: string) => {
      switch (type) {
        case "task":
          return "Tasks";
        case "shopping":
          return "Shopping";
        case "labor":
          return "Labor";
        case "note":
          return "Notes";
        case "moodboard":
          return "Moodboard images";
        case "survey":
          return "Surveys";
        case "contact":
          return "Contacts";
        case "shoppingSection":
          return "Shopping sections";
        case "laborSection":
          return "Labor sections";
        case "projectSettings":
          return "Project settings";
        default:
          return type;
      }
    };

    return (
      <div
        className={cn(
          "rounded-xl border px-3 py-2.5",
          rejectedCount > 0
            ? "border-amber-200 bg-amber-50/70"
            : "border-green-200 bg-green-50/70",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <p
              className={cn(
                "text-sm font-semibold",
                rejectedCount > 0 ? "text-amber-900" : "text-green-900",
              )}
            >
              {visibleItems.length} item{visibleItems.length !== 1 ? "s" : ""} processed
            </p>
            <p
              className={cn(
                "text-xs",
                rejectedCount > 0 ? "text-amber-800/90" : "text-green-800/90",
              )}
            >
              {confirmedCount} confirmed
              {rejectedCount > 0 ? `, ${rejectedCount} rejected` : ""}
            </p>
          </div>
          {typeSummaries.length > 1 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setShowResolvedDetails((prev) => !prev)}
            >
              {showResolvedDetails ? "Hide details" : "Details"}
            </Button>
          )}
        </div>

        {showResolvedDetails && (
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {typeSummaries.map(([type, stats]) => (
              <div
                key={type}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-xs",
                  rejectedCount > 0
                    ? "border-amber-200/70 bg-card/70 text-amber-900"
                    : "border-green-200/70 bg-card/70 text-green-900",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{toTypeLabel(type)}</span>
                  <span>
                    {stats.confirmed} c
                    {stats.rejected > 0 ? ` / ${stats.rejected} r` : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const isInlineFormOnly =
    unresolvedItems.length === 1 &&
    !unresolvedItems[0].fromBulk &&
    Boolean(onUpdateItem) &&
    (!unresolvedItems[0].item.status || unresolvedItems[0].item.status === "rejected") &&
    ["task", "note", "moodboard", "shopping", "contact", "labor", "survey", "projectSettings"].includes(
      getCanonicalType(unresolvedItems[0].item.type),
    );

  if (isInlineFormOnly) {
    return (
      <div className="pt-2 pb-24 sm:pb-28">
        <ConfirmationCard
          item={unresolvedItems[0].item}
          index={unresolvedItems[0].index}
          onConfirm={onConfirmItem}
          onReject={onRejectItem}
          onEdit={onEditItem}
          onUpdate={onUpdateItem}
          isProcessing={isProcessing}
          confirmationMode={confirmationMode}
          onConfirmationModeChange={onConfirmationModeChange}
          isModeUpdating={isModeUpdating}
        />
      </div>
    );
  }

  const showRow = unresolvedItems.length > 1;
  const hiddenSectionLabels = [
    hiddenSectionMeta.shopping ? `shopping section "${hiddenSectionMeta.shopping}"` : null,
    hiddenSectionMeta.labor ? `labor section "${hiddenSectionMeta.labor}"` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {(() => {
            const allConfirmed = visibleItems.every(({ item }) => {
              const approvalState = getApprovalState(item);
              return item.status === "confirmed" || approvalState === "output-available";
            });

            return (
              <span className="font-medium text-sm">
                {allConfirmed
                  ? `${visibleItems.length} item${visibleItems.length !== 1 ? "s" : ""} confirmed`
                  : `${unresolvedItems.length} item${unresolvedItems.length !== 1 ? "s" : ""} to confirm`
                }
              </span>
            );
            })()}
            {isProcessing && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
            {showRow && (
              <span className="text-xs text-muted-foreground">
                ({unresolvedItems.length} in batch)
              </span>
            )}
          </div>
          {hiddenSectionLabels.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Includes: {hiddenSectionLabels.join(" • ")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {unresolvedItems.length > 1 && onConfirmAll && onRejectAll && !visibleItems.every(({ item }) => {
            const approvalState = getApprovalState(item);
            return item.status === "confirmed" || approvalState === "output-available";
          }) && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 text-destructive hover:text-destructive"
                onClick={onRejectAll}
                disabled={isProcessing}
              >
                Reject All
              </Button>
              <Button
                size="sm"
                className="text-xs h-7 bg-green-600 hover:bg-green-700 text-primary-foreground"
                onClick={onConfirmAll}
                disabled={isProcessing}
              >
                {isProcessing && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Confirm All
              </Button>
            </div>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className={cn(
          "flex gap-3 overflow-x-auto pb-2",
          showRow ? "items-stretch" : "block",
          "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        )}
      >
        {unresolvedItems.map(({ item, index: originalIndex, key, fromBulk }) => (
          <div
            key={key}
            className={cn(
              "min-w-0",
              showRow ? "w-[min(26rem,calc(100vw-7rem))] shrink-0" : "w-full"
            )}
          >
            <ConfirmationCard
              item={item}
              index={originalIndex}
              onConfirm={onConfirmItem}
              onReject={onRejectItem}
              onEdit={fromBulk ? undefined : onEditItem}
              onUpdate={fromBulk ? noopUpdate : onUpdateItem}
              isProcessing={isProcessing}
              confirmationMode={confirmationMode}
              onConfirmationModeChange={onConfirmationModeChange}
              isModeUpdating={isModeUpdating}
              showActions={!showRow}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default InlineConfirmationList;
