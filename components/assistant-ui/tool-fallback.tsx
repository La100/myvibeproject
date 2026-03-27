"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  LoaderIcon,
  XCircleIcon,
} from "lucide-react";
import {
  useScrollLock,
  type ToolCallMessagePartStatus,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { PendingContentItem } from "@/components/ai/assistant/data/types";
import { InlineConfirmationList } from "@/components/ai/assistant/ui/confirmations/InlineConfirmation";
import {
  getInlineConfirmationScope,
} from "@/components/assistant-ui/tool-fallback-confirmation-scope";
import {
  resolveInlineConfirmationItems,
  toPendingItemsFromResult,
} from "@/components/assistant-ui/tool-fallback-helpers";

const ANIMATION_DURATION = 200;

export type ToolFallbackRootProps = Omit<
  React.ComponentProps<typeof Collapsible>,
  "open" | "onOpenChange"
> & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
};

function ToolFallbackRoot({
  className,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultOpen = false,
  children,
  ...props
}: ToolFallbackRootProps) {
  const collapsibleRef = useRef<HTMLDivElement>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const lockScroll = useScrollLock(collapsibleRef, ANIMATION_DURATION);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        lockScroll();
      }
      if (!isControlled) {
        setUncontrolledOpen(open);
      }
      controlledOnOpenChange?.(open);
    },
    [lockScroll, isControlled, controlledOnOpenChange],
  );

  return (
    <Collapsible
      ref={collapsibleRef}
      data-slot="tool-fallback-root"
      open={isOpen}
      onOpenChange={handleOpenChange}
      className={cn(
        "aui-tool-fallback-root group/tool-fallback-root w-full rounded-lg border py-3",
        className,
      )}
      style={
        {
          "--animation-duration": `${ANIMATION_DURATION}ms`,
        } as React.CSSProperties
      }
      {...props}
    >
      {children}
    </Collapsible>
  );
}

type ToolStatus = ToolCallMessagePartStatus["type"];

const statusIconMap: Record<ToolStatus, React.ElementType> = {
  running: LoaderIcon,
  complete: CheckIcon,
  incomplete: XCircleIcon,
  "requires-action": AlertCircleIcon,
};

function ToolFallbackTrigger({
  toolName,
  status,
  className,
  ...props
}: React.ComponentProps<typeof CollapsibleTrigger> & {
  toolName: string;
  status?: ToolCallMessagePartStatus;
}) {
  const statusType = status?.type ?? "complete";
  const isRunning = statusType === "running";
  const isCancelled =
    status?.type === "incomplete" && status.reason === "cancelled";

  const Icon = statusIconMap[statusType];
  const label = isCancelled ? "Cancelled tool" : "Used tool";

  return (
    <CollapsibleTrigger
      data-slot="tool-fallback-trigger"
      className={cn(
        "aui-tool-fallback-trigger group/trigger flex w-full items-center gap-2 px-4 text-sm transition-colors",
        className,
      )}
      {...props}
    >
      <Icon
        data-slot="tool-fallback-trigger-icon"
        className={cn(
          "aui-tool-fallback-trigger-icon size-4 shrink-0",
          isCancelled && "text-muted-foreground",
          isRunning && "animate-spin",
        )}
      />
      <span
        data-slot="tool-fallback-trigger-label"
        className={cn(
          "aui-tool-fallback-trigger-label-wrapper relative inline-block grow text-left leading-none",
          isCancelled && "text-muted-foreground line-through",
        )}
      >
        <span>
          {label}: <b>{toolName}</b>
        </span>
        {isRunning && (
          <span
            aria-hidden
            data-slot="tool-fallback-trigger-shimmer"
            className="aui-tool-fallback-trigger-shimmer shimmer pointer-events-none absolute inset-0 motion-reduce:animate-none"
          >
            {label}: <b>{toolName}</b>
          </span>
        )}
      </span>
      <ChevronDownIcon
        data-slot="tool-fallback-trigger-chevron"
        className={cn(
          "aui-tool-fallback-trigger-chevron size-4 shrink-0",
          "transition-transform duration-(--animation-duration) ease-out",
          "group-data-[state=closed]/trigger:-rotate-90",
          "group-data-[state=open]/trigger:rotate-0",
        )}
      />
    </CollapsibleTrigger>
  );
}

function ToolFallbackContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsibleContent>) {
  return (
    <CollapsibleContent
      data-slot="tool-fallback-content"
      className={cn(
        "aui-tool-fallback-content relative overflow-hidden text-sm outline-none",
        "group/collapsible-content ease-out",
        "data-[state=closed]:animate-collapsible-up",
        "data-[state=open]:animate-collapsible-down",
        "data-[state=closed]:fill-mode-forwards",
        "data-[state=closed]:pointer-events-none",
        "data-[state=open]:duration-(--animation-duration)",
        "data-[state=closed]:duration-(--animation-duration)",
        className,
      )}
      {...props}
    >
      <div className="mt-3 flex flex-col gap-2 border-t pt-2">{children}</div>
    </CollapsibleContent>
  );
}

function ToolFallbackArgs({
  argsText,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  argsText?: string;
}) {
  if (!argsText) return null;

  return (
    <div
      data-slot="tool-fallback-args"
      className={cn("aui-tool-fallback-args px-4", className)}
      {...props}
    >
      <pre className="aui-tool-fallback-args-value whitespace-pre-wrap">
        {argsText}
      </pre>
    </div>
  );
}

function ToolFallbackResult({
  result,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  result?: unknown;
}) {
  if (result === undefined) return null;

  return (
    <div
      data-slot="tool-fallback-result"
      className={cn(
        "aui-tool-fallback-result border-t border-dashed px-4 pt-2",
        className,
      )}
      {...props}
    >
      <p className="aui-tool-fallback-result-header font-semibold">Result:</p>
      <pre className="aui-tool-fallback-result-content whitespace-pre-wrap">
        {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}

export interface ToolFallbackProps extends ToolCallMessagePartProps {
  pendingItems?: PendingContentItem[];
  onConfirmItem?: (index: number | string) => Promise<void>;
  onRejectItem?: (index: number | string) => void | Promise<void>;
  onEditItem?: (index: number) => void;
  onUpdateItem?: (
    index: number | string,
    updates: Partial<PendingContentItem>,
  ) => void;
  isProcessing?: boolean;
  confirmationMode?: "always_ask" | "auto_confirm";
  onConfirmationModeChange?: (
    mode: "always_ask" | "auto_confirm",
  ) => void | Promise<void>;
  isModeUpdating?: boolean;
}

function ToolFallbackError({
  status,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  status?: ToolCallMessagePartStatus;
}) {
  if (status?.type !== "incomplete") return null;

  const error = status.error;
  const errorText = error
    ? typeof error === "string"
      ? error
      : JSON.stringify(error)
    : null;

  if (!errorText) return null;

  const isCancelled = status.reason === "cancelled";
  const headerText = isCancelled ? "Cancelled reason:" : "Error:";

  return (
    <div
      data-slot="tool-fallback-error"
      className={cn("aui-tool-fallback-error px-4", className)}
      {...props}
    >
      <p className="aui-tool-fallback-error-header font-semibold text-muted-foreground">
        {headerText}
      </p>
      <p className="aui-tool-fallback-error-reason text-muted-foreground">
        {errorText}
      </p>
    </div>
  );
}

const ToolFallbackImpl = ({
  toolName,
  toolCallId,
  argsText,
  result,
  status,
  pendingItems,
  onConfirmItem,
  onRejectItem,
  onEditItem,
  onUpdateItem,
  isProcessing = false,
  confirmationMode = "always_ask",
  onConfirmationModeChange,
  isModeUpdating = false,
}: ToolFallbackProps) => {
  const isCancelled =
    status?.type === "incomplete" && status.reason === "cancelled";

  const matchedPendingItemsByCallId = useMemo(
    () =>
      toolCallId
        ? (pendingItems ?? []).filter(
            (item) => item.functionCall?.callId === toolCallId,
          )
        : [],
    [pendingItems, toolCallId],
  );
  const fallbackPendingItems = useMemo(
    () => (toolCallId ? toPendingItemsFromResult(toolCallId, result) : []),
    [toolCallId, result],
  );
  const isCrudLikeResult =
    matchedPendingItemsByCallId.length > 0 ||
    fallbackPendingItems.length > 0;
  const inlineConfirmationScope = useMemo(
    () => getInlineConfirmationScope(pendingItems, toolCallId),
    [pendingItems, toolCallId],
  );

  const itemsForInlineConfirmation = useMemo(() => {
    return resolveInlineConfirmationItems({
      inlineConfirmationScope,
      matchedPendingItemsByCallId,
      fallbackPendingItems,
    });
  }, [fallbackPendingItems, inlineConfirmationScope, matchedPendingItemsByCallId]);

  const showInlineConfirmation = itemsForInlineConfirmation.length > 0;
  const hasUnresolvedItemsInCard = itemsForInlineConfirmation.some(
    (item) => item.status !== "confirmed" && item.status !== "rejected",
  );
  const scopedActionIds = useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const item of itemsForInlineConfirmation) {
      const id = item.clientId ?? item.functionCall?.callId;
      if (typeof id !== "string" || id.length === 0 || seen.has(id)) {
        continue;
      }
      seen.add(id);
      ids.push(id);
    }
    return ids;
  }, [itemsForInlineConfirmation]);
  const handleConfirmVisibleItems = useCallback(async () => {
    if (!onConfirmItem) return;
    for (const id of scopedActionIds) {
      await onConfirmItem(id);
    }
  }, [onConfirmItem, scopedActionIds]);
  const handleRejectVisibleItems = useCallback(async () => {
    if (!onRejectItem) return;
    for (const id of scopedActionIds) {
      await onRejectItem(id);
    }
  }, [onRejectItem, scopedActionIds]);
  const [isOpen, setIsOpen] = useState(() => hasUnresolvedItemsInCard);
  const prevHadUnresolvedRef = useRef(hasUnresolvedItemsInCard);

  useEffect(() => {
    if (hasUnresolvedItemsInCard) {
      if (!prevHadUnresolvedRef.current) {
        setIsOpen(true);
      }
      prevHadUnresolvedRef.current = true;
      return;
    }

    if (prevHadUnresolvedRef.current && showInlineConfirmation) {
      setIsOpen(false);
    }
    prevHadUnresolvedRef.current = false;
  }, [hasUnresolvedItemsInCard, showInlineConfirmation]);

  if (inlineConfirmationScope.suppressToolFallback) {
    return null;
  }

  if (showInlineConfirmation) {
    return (
      <div className="px-0 pt-2">
        <InlineConfirmationList
          items={itemsForInlineConfirmation}
          onConfirmItem={onConfirmItem}
          onRejectItem={onRejectItem}
          onEditItem={onEditItem}
          onConfirmAll={
            scopedActionIds.length > 1 ? handleConfirmVisibleItems : undefined
          }
          onRejectAll={
            scopedActionIds.length > 1 ? handleRejectVisibleItems : undefined
          }
          onUpdateItem={onUpdateItem}
          isProcessing={isProcessing}
          confirmationMode={confirmationMode}
          onConfirmationModeChange={onConfirmationModeChange}
          isModeUpdating={isModeUpdating}
        />
      </div>
    );
  }

  if (isCrudLikeResult) {
    return null;
  }

  return (
    <ToolFallbackRoot
      className={cn(isCancelled && "border-muted-foreground/30 bg-muted/30")}
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <ToolFallbackTrigger toolName={toolName} status={status} />
      <ToolFallbackContent>
        <ToolFallbackError status={status} />
        {!isCrudLikeResult && (
          <ToolFallbackArgs
            argsText={argsText}
            className={cn(isCancelled && "opacity-60")}
          />
        )}
        {!isCancelled && !showInlineConfirmation && !isCrudLikeResult && (
          <ToolFallbackResult result={result} />
        )}
      </ToolFallbackContent>
    </ToolFallbackRoot>
  );
};

type ToolFallbackComponent = typeof ToolFallbackBase & {
  Root: typeof ToolFallbackRoot;
  Trigger: typeof ToolFallbackTrigger;
  Content: typeof ToolFallbackContent;
  Args: typeof ToolFallbackArgs;
  Result: typeof ToolFallbackResult;
  Error: typeof ToolFallbackError;
};

const ToolFallbackBase = memo(ToolFallbackImpl);
const ToolFallback = ToolFallbackBase as ToolFallbackComponent;

ToolFallback.displayName = "ToolFallback";
ToolFallback.Root = ToolFallbackRoot;
ToolFallback.Trigger = ToolFallbackTrigger;
ToolFallback.Content = ToolFallbackContent;
ToolFallback.Args = ToolFallbackArgs;
ToolFallback.Result = ToolFallbackResult;
ToolFallback.Error = ToolFallbackError;

export {
  ToolFallback,
  ToolFallbackRoot,
  ToolFallbackTrigger,
  ToolFallbackContent,
  ToolFallbackArgs,
  ToolFallbackResult,
  ToolFallbackError,
};
