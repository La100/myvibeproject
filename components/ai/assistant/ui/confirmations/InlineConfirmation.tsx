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
  ChevronDown,
  Loader2,
} from "lucide-react";
import type { PendingContentItem } from "../../data/types";
import {
  getApprovalState,
  getCanonicalType,
  getDescription,
  getTitle,
  shouldRenderByState,
} from "./helpers";
import { InlineCreationForm } from "./InlineCreationForm";
import { prepareInlineConfirmationViewModel } from "./viewModel";

// ============================================
// SINGLE CONFIRMATION CARD
// ============================================

interface ConfirmationCardProps {
  item: PendingContentItem;
  index: number;
  onConfirm?: (index: number | string) => Promise<void>;
  onReject?: (index: number | string) => void | Promise<void>;
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

const GROUP_LABELS: Record<string, string> = {
  task: "Tasks",
  note: "Notes",
  moodboard: "Moodboard images",
  shopping: "Shopping items",
  labor: "Labor items",
  contact: "Contacts",
  survey: "Surveys",
  shoppingSection: "Shopping sections",
  laborSection: "Labor sections",
  projectSettings: "Project settings",
};

function BatchConfirmationCard({
  items,
  index,
  onConfirm,
  onReject,
  isProcessing = false,
}: {
  items: PendingContentItem[];
  index: number;
  onConfirm?: (index: number | string) => Promise<void>;
  onReject?: (index: number | string) => void | Promise<void>;
  isProcessing?: boolean;
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const firstItem = items[0];
  if (!firstItem) return null;

  const canonicalType = getCanonicalType(firstItem.type);
  const label = GROUP_LABELS[canonicalType] ?? "Items";
  const total = items.length;
  const preview = items
    .slice(0, 3)
    .map((item) => getTitle(item))
    .filter((value) => value && value !== "Untitled");
  const remaining = total - preview.length;

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between border-b border-border/70 bg-card px-4 py-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Review {total} {label.toLowerCase()}
          </p>
          <p className="text-xs text-muted-foreground">
            One confirmation for the whole batch.
          </p>
        </div>
        <span className="rounded-full border border-border/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {label}
        </span>
      </div>

      <div className="space-y-3 p-4">
        <div className="space-y-1.5">
          {preview.map((entry) => (
            <div key={entry} className="truncate text-sm text-foreground">
              {entry}
            </div>
          ))}
          {remaining > 0 ? (
            <div className="text-sm text-muted-foreground">
              +{remaining} more in this batch
            </div>
          ) : null}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-muted-foreground"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <ChevronDown
            className={cn("mr-1 h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")}
          />
          {isExpanded ? "Hide details" : "Show details"}
        </Button>

        {isExpanded ? (
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-3">
            {items.map((item, itemIndex) => {
              const title = getTitle(item);
              const description = getDescription(item);
              return (
                <div key={item.clientId ?? `${index}-${itemIndex}`} className="space-y-0.5">
                  <div className="text-sm font-medium text-foreground">{title}</div>
                  {description ? (
                    <div className="line-clamp-2 text-xs text-muted-foreground">
                      {description}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2.5 border-t border-border/70 bg-card px-4 py-2.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onReject?.(index)}
          className="h-8 px-3 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
          disabled={isProcessing}
        >
          Reject batch
        </Button>
        <Button
          size="sm"
          onClick={() => void onConfirm?.(index)}
          className="h-8 px-4 font-medium shadow-sm"
          disabled={isProcessing}
        >
          {isProcessing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          Confirm batch
        </Button>
      </div>
    </div>
  );
}

// ============================================
// INLINE CONFIRMATION LIST
// ============================================

interface InlineConfirmationListProps {
  items: PendingContentItem[];
  onConfirmItem?: (index: number | string) => Promise<void>;
  onRejectItem?: (index: number | string) => void | Promise<void>;
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
  onConfirmAll,
  onRejectAll,
  onUpdateItem,
  isProcessing = false,
  confirmationMode = "always_ask",
  onConfirmationModeChange,
  isModeUpdating = false,
}: InlineConfirmationListProps) {
  const [showResolvedDetails, setShowResolvedDetails] = React.useState(false);
  const noopUpdate: NonNullable<InlineConfirmationListProps["onUpdateItem"]> =
    React.useCallback(() => {
      // Bulk-expanded preview cards can share one source call id.
      // Keep the full inline form layout without mutating shared source payload.
    }, []);
  const {
    visibleItems,
    unresolvedItems,
    hiddenSectionLabels,
    resolvedSummary,
  } = React.useMemo(() => prepareInlineConfirmationViewModel(items), [items]);
  const groupedItems = React.useMemo(() => {
    const groups = new Map<
      string,
      { index: number; fromBulk: boolean; items: PendingContentItem[]; key: string }
    >();

    for (const entry of unresolvedItems) {
      const groupKey = entry.fromBulk ? `bulk:${entry.index}` : `single:${entry.key}`;
      const existing = groups.get(groupKey);
      if (existing) {
        existing.items.push(entry.item);
        continue;
      }
      groups.set(groupKey, {
        index: entry.index,
        fromBulk: entry.fromBulk,
        items: [entry.item],
        key: groupKey,
      });
    }

    return Array.from(groups.values());
  }, [unresolvedItems]);

  if (visibleItems.length === 0) return null;

  const allResolved = unresolvedItems.length === 0;
  if (allResolved) {
    const confirmedCount = resolvedSummary?.confirmedCount ?? 0;
    const rejectedCount = resolvedSummary?.rejectedCount ?? 0;
    const typeSummaries = resolvedSummary?.typeSummaries ?? [];
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
        className={cn(
          "flex gap-3 overflow-x-auto pb-2",
          groupedItems.length > 1 ? "items-stretch" : "block",
          "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        )}
      >
        {groupedItems.map(({ items: groupedEntries, index: originalIndex, key, fromBulk }) => (
          <div
            key={key}
            className={cn(
              "min-w-0",
              groupedItems.length > 1 ? "w-[min(26rem,calc(100vw-7rem))] shrink-0" : "w-full"
            )}
          >
            {fromBulk && groupedEntries.length > 1 ? (
              <BatchConfirmationCard
                items={groupedEntries}
                index={originalIndex}
                onConfirm={onConfirmItem}
                onReject={onRejectItem}
                isProcessing={isProcessing}
              />
            ) : (
              <ConfirmationCard
                item={groupedEntries[0]!}
                index={originalIndex}
                onConfirm={onConfirmItem}
                onReject={onRejectItem}
                onUpdate={fromBulk ? noopUpdate : onUpdateItem}
                isProcessing={isProcessing}
                confirmationMode={confirmationMode}
                onConfirmationModeChange={onConfirmationModeChange}
                isModeUpdating={isModeUpdating}
                showActions={!showRow}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default InlineConfirmationList;
