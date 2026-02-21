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
import { Badge } from "@/components/ui/badge";
import {
  Check,
  X,
  Pencil,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { PendingContentItem } from "../../data/types";
import {
  extractBulkCreateEntries,
  getApprovalLabel,
  getApprovalState,
  getCanonicalType,
  getDescription,
  getOperation,
  getTitle,
  OPERATION_LABELS,
  shouldRenderByState,
  TYPE_COLORS,
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
  onEdit,
  onUpdate,
  isProcessing = false,
}: ConfirmationCardProps) {
  const [isConfirming, setIsConfirming] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const operation = getOperation(item);
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
  ];
  const isEditableState = !item.status;
  const canRenderInlineForm =
    supportedTypes.includes(canonicalType) &&
    isEditableState &&
    !!onUpdate &&
    !!onConfirm &&
    !!onReject;
  const needsInlineForm = canRenderInlineForm;

  if (needsInlineForm && onUpdate && onConfirm && onReject) {
    return (
      <InlineCreationForm
        item={item}
        index={index}
        onConfirm={onConfirm}
        onReject={onReject}
        onUpdate={onUpdate}
      />
    );
  }

  const colorClass = TYPE_COLORS[canonicalType] || TYPE_COLORS.task;
  const operationInfo = OPERATION_LABELS[operation] || OPERATION_LABELS.create;
  const isDeleteOperation = operation === "delete";
  const resolvedStatus = item.status;
  const approvalState = getApprovalState(item);
  const approvalLabel = getApprovalLabel(approvalState);
  const isResolved =
    resolvedStatus === "confirmed" ||
    resolvedStatus === "rejected" ||
    approvalState === "approval-responded" ||
    approvalState === "output-available" ||
    approvalState === "output-denied" ||
    approvalState === "output-error";
  const isAwaitingApproval = approvalState === "approval-requested";
  const isConfirmed = resolvedStatus === "confirmed" || approvalState === "output-available";
  const resolvedLabel =
    isConfirmed
      ? "Confirmed"
      : resolvedStatus === "rejected" || approvalState === "output-denied"
        ? "Rejected"
        : approvalState === "output-error"
          ? "Failed"
          : approvalState === "approval-responded"
            ? "Responded"
            : null;

  if (!shouldRenderByState(approvalState)) {
    return null;
  }

  const title = getTitle(item);
  const description = getDescription(item);

  if (isConfirmed) {
    return (
      <div className={cn("rounded-lg border bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800", isProcessing && "opacity-60")}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full p-3 flex items-center gap-2 hover:bg-green-100 dark:hover:bg-green-900/20 transition-colors text-left"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-green-600 dark:text-green-400" />
          ) : (
            <ChevronUp className="h-4 w-4 rotate-[-90deg] text-green-600 dark:text-green-400" />
          )}
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-900 dark:text-green-100">{title}</span>
          <Badge variant="secondary" className="ml-auto text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            Confirmed
          </Badge>
        </button>

        {expanded && (
          <div className="px-3 pb-3 pt-1 border-t border-green-200 dark:border-green-800">
            <dl className="space-y-2 text-sm">
              {description && (
                <div>
                  <dt className="text-green-700 dark:text-green-300 font-medium mb-1">Description:</dt>
                  <dd className="text-green-900 dark:text-green-100">{description}</dd>
                </div>
              )}
              {Object.entries(item.data).map(([key, value]) => {
                if (!value || key === "type" || key === "operation" || key === "title" || key === "description") return null;
                return (
                  <div key={key}>
                    <dt className="text-green-700 dark:text-green-300 font-medium capitalize">
                      {key.replace(/([A-Z])/g, " $1").trim()}:
                    </dt>
                    <dd className="text-green-900 dark:text-green-100">
                      {typeof value === "object" ? JSON.stringify(value) : String(value)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        )}
      </div>
    );
  }

  const handleConfirm = async () => {
    if (!onConfirm) return;
    setIsConfirming(true);
    try {
      await onConfirm(item.functionCall?.callId ?? index);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-all",
        colorClass,
        isProcessing && "opacity-60"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className={cn("text-xs", operationInfo.color)}>
              {operationInfo.label}
            </Badge>
            {approvalLabel && !isResolved && (
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs",
                  approvalState === "approval-requested" && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                )}
              >
                {approvalLabel}
              </Badge>
            )}
            {isResolved && resolvedLabel && (
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs",
                  resolvedLabel === "Confirmed"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    : resolvedLabel === "Failed" || resolvedLabel === "Rejected"
                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                      : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                )}
              >
                {resolvedLabel}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground capitalize">
              {canonicalType}
            </span>
          </div>

          <h4 className="font-medium mt-1 truncate">{title}</h4>

          {description && !expanded && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <dl className="space-y-2 text-sm">
            {Object.entries(item.data).map(([key, value]) => {
              if (!value || key === "type" || key === "operation") return null;
              return (
                <div key={key} className="flex gap-2">
                  <dt className="text-muted-foreground capitalize min-w-[80px]">
                    {key.replace(/([A-Z])/g, " $1").trim()}:
                  </dt>
                  <dd className="flex-1 break-words">
                    {typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
        <Button
          size="sm"
          variant="ghost"
          className="text-xs h-8"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" />
              Less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" />
              More
            </>
          )}
        </Button>

        <div className="flex-1" />

        {isResolved && resolvedLabel ? (
          <span className="text-xs text-muted-foreground">
            {resolvedLabel}
          </span>
        ) : isAwaitingApproval && onConfirm && onReject ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onReject?.(item.functionCall?.callId ?? index)}
              disabled={isProcessing || isConfirming}
            >
              <X className="h-3 w-3 mr-1" />
              Reject
            </Button>

            {onEdit && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-8"
                onClick={() => onEdit(index)}
                disabled={isProcessing || isConfirming}
              >
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
            )}

            <Button
              size="sm"
              variant={isDeleteOperation ? "destructive" : "default"}
              className={cn(
                "text-xs h-8",
                !isDeleteOperation && "bg-green-600 hover:bg-green-700 text-white"
              )}
              onClick={handleConfirm}
              disabled={isProcessing || isConfirming}
            >
              {isConfirming ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              {isDeleteOperation ? "Delete" : "Confirm"}
            </Button>
          </>
        ) : !onConfirm && !onReject ? (
          null
        ) : (
          <span className="text-xs text-muted-foreground">Waiting for approval</span>
        )}
      </div>
    </div>
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

  const isInlineFormOnly =
    visibleItems.length === 1 &&
    !visibleItems[0].fromBulk &&
    Boolean(onUpdateItem) &&
    (!visibleItems[0].item.status || visibleItems[0].item.status === "rejected") &&
    ["task", "note", "shopping", "contact", "labor", "survey"].includes(
      getCanonicalType(visibleItems[0].item.type),
    );

  if (isInlineFormOnly) {
    return (
      <div className="pt-2 pb-24 sm:pb-28">
        <ConfirmationCard
          item={visibleItems[0].item}
          index={visibleItems[0].index}
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

  const showSlider = visibleItems.length > 1;
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < visibleItems.length - 1;

  const goToIndex = (index: number) => {
    setCurrentIndex(index);
    if (scrollRef.current) {
      const cardWidth = scrollRef.current.clientWidth;
      scrollRef.current.scrollTo({
        left: cardWidth * index,
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
                  : `${visibleItems.length} item${visibleItems.length !== 1 ? "s" : ""} to confirm`
                }
              </span>
            );
          })()}
          {isProcessing && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          {showSlider && (
            <span className="text-xs text-muted-foreground">
              ({currentIndex + 1}/{visibleItems.length})
            </span>
          )}
        </div>

        {visibleItems.length > 1 && onConfirmAll && onRejectAll && !visibleItems.every(({ item }) => {
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
                className="text-xs h-7 bg-green-600 hover:bg-green-700 text-white"
                onClick={onConfirmAll}
                disabled={isProcessing}
              >
                {isProcessing && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Confirm All
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
              onClick={() => canGoBack && goToIndex(currentIndex - 1)}
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
              onClick={() => canGoForward && goToIndex(currentIndex + 1)}
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
            if (newIndex !== currentIndex) {
              setCurrentIndex(newIndex);
            }
          }}
        >
          {visibleItems.map(({ item, index: originalIndex, key, fromBulk }) => (
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
          {visibleItems.map((_, index) => (
            <button
              key={index}
              onClick={() => goToIndex(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                index === currentIndex
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
