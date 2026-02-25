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
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { PendingContentItem } from "../../data/types";
import {
  extractBulkCreateEntries,
  getApprovalState,
  getCanonicalType,
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
}

export const ConfirmationCard = memo(function ConfirmationCard({
  item,
  index,
  onConfirm,
  onReject,
  onUpdate,
}: ConfirmationCardProps) {
  const canonicalType = getCanonicalType(item.type);
  const supportedTypes = [
    "task",
    "note",
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
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [showResolvedDetails, setShowResolvedDetails] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const noopUpdate: NonNullable<InlineConfirmationListProps["onUpdateItem"]> =
    React.useCallback(() => {
      // Bulk-expanded preview cards can share one source call id.
      // Keep the full inline form layout without mutating shared source payload.
    }, []);

  const displayItems = items.flatMap((item, index) => {
    const bulkEntries = extractBulkCreateEntries(item);
    if (bulkEntries.length <= 1) {
      return [{ item, index, key: `${index}`, fromBulk: false }];
    }

    return bulkEntries.map((entry, entryIndex) => ({
      item: {
        ...item,
        operation: "create" as const,
        data: entry,
        clientId: item.clientId ? `${item.clientId}::${entryIndex}` : undefined,
      },
      index,
      key: `${index}-${entryIndex}`,
      fromBulk: true,
    }));
  });

  const visibleItems = displayItems
    .filter(({ item }) => shouldRenderByState(getApprovalState(item)));

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

  const safeCurrentIndex =
    unresolvedItems.length === 0
      ? 0
      : Math.min(currentIndex, unresolvedItems.length - 1);

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
    ["task", "note", "shopping", "contact", "labor", "survey", "projectSettings"].includes(
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

  const showSlider = unresolvedItems.length > 1;
  const canGoBack = safeCurrentIndex > 0;
  const canGoForward = safeCurrentIndex < unresolvedItems.length - 1;

  const goToIndex = (index: number) => {
    if (unresolvedItems.length === 0) return;
    const clampedIndex = Math.max(0, Math.min(index, unresolvedItems.length - 1));
    setCurrentIndex(clampedIndex);
    if (scrollRef.current) {
      const cardWidth = scrollRef.current.clientWidth;
      scrollRef.current.scrollTo({
        left: cardWidth * clampedIndex,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
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
          {showSlider && (
            <span className="text-xs text-muted-foreground">
              ({safeCurrentIndex + 1}/{unresolvedItems.length})
            </span>
          )}
        </div>

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
                Accept All
              </Button>
            </div>
          )}
      </div>

      {/* Slider container */}
      <div className="relative">
        {/* Navigation arrows */}
        {showSlider && (
          <>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 h-8 w-8 rounded-full shadow-md bg-background",
                !canGoBack && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => canGoBack && goToIndex(safeCurrentIndex - 1)}
              disabled={!canGoBack || isProcessing}
            >
              <ChevronUp className="h-4 w-4 -rotate-90" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 h-8 w-8 rounded-full shadow-md bg-background",
                !canGoForward && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => canGoForward && goToIndex(safeCurrentIndex + 1)}
              disabled={!canGoForward || isProcessing}
            >
              <ChevronDown className="h-4 w-4 -rotate-90" />
            </Button>
          </>
        )}

        {/* Cards slider */}
        <div
          ref={scrollRef}
          className={cn(
            "flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2",
            showSlider ? "px-2" : "",
            // Hide scrollbar
            "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          )}
          onScroll={(e) => {
            const container = e.currentTarget;
            const cardWidth = container.clientWidth;
            const newIndex = Math.round(container.scrollLeft / cardWidth);
            if (newIndex !== safeCurrentIndex) {
              setCurrentIndex(newIndex);
            }
          }}
        >
          {unresolvedItems.map(({ item, index: originalIndex, key, fromBulk }) => (
            <div
              key={key}
              className={cn(
                "flex-shrink-0 snap-center",
                showSlider ? "w-[calc(100%-16px)]" : "w-full"
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
              />
            </div>
          ))}
        </div>
      </div>

      {/* Dots indicator */}
      {showSlider && (
        <div className="flex justify-center gap-1.5">
          {unresolvedItems.map((_, index) => (
            <button
              key={index}
              onClick={() => goToIndex(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                index === safeCurrentIndex
                  ? "bg-primary w-4"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default InlineConfirmationList;
