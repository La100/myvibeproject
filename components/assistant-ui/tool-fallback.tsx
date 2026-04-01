"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildToolPreviewSummary,
  toPendingItemsFromResult,
} from "@/components/assistant-ui/tool-fallback-helpers";
import { getCategoryStyles, getToolConfig } from "@/components/ai/shared/ToolIcons";
import { toast } from "sonner";

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

function ToolPreviewCard({
  toolName,
  summary,
  status,
  statusLabelOverride,
}: {
  toolName: string;
  summary: NonNullable<ReturnType<typeof buildToolPreviewSummary>>;
  status?: ToolCallMessagePartStatus;
  statusLabelOverride?: string;
}) {
  const config = getToolConfig(toolName);
  const styles = getCategoryStyles(config.category);
  const Icon = config.icon;
  const statusLabel =
    statusLabelOverride ??
    (status?.type === "running"
      ? "Running"
      : status?.type === "incomplete"
        ? "Failed"
        : status?.type === "requires-action"
          ? "Needs review"
          : "Complete");

  return (
    <div className={cn("px-4", status?.type === "incomplete" && "opacity-80")}>
      <div
        className={cn(
          "rounded-xl border p-3 shadow-sm",
          styles.bgColor,
          styles.borderColor,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 rounded-lg border border-black/5 bg-background/80 p-2">
              <Icon className={cn("size-4", config.color, status?.type === "running" && "animate-spin")} />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-semibold text-foreground">{summary.title}</p>
              {summary.subtitle ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {summary.subtitle}
                </p>
              ) : null}
            </div>
          </div>
          <span className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {statusLabel}
          </span>
        </div>

        {summary.badges && summary.badges.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.badges.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                {badge}
              </span>
            ))}
          </div>
        ) : null}

        {summary.items && summary.items.length > 0 ? (
          <div className="mt-3 space-y-2">
            {summary.items.map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                className="rounded-lg border border-border/60 bg-background/70 px-3 py-2"
              >
                <div className="text-sm font-medium text-foreground">{item.title}</div>
                {item.description ? (
                  <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </div>
                ) : null}
                {item.meta ? (
                  <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
                    {item.meta}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export interface ToolFallbackProps extends ToolCallMessagePartProps {
  onRespondToToolApproval?: (args: {
    approvalId: string;
    approved: boolean;
    toolCallId: string;
    reason?: string;
  }) => Promise<void>;
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
  onRespondToToolApproval,
  confirmationMode = "always_ask",
  ...toolPart
}: ToolFallbackProps) => {
  const isCancelled =
    status?.type === "incomplete" && status.reason === "cancelled";
  const nativeToolPart = toolPart as Record<string, unknown>;
  const nativeState =
    typeof nativeToolPart.state === "string" ? nativeToolPart.state : undefined;
  const approval = nativeToolPart.approval as
    | { id?: string; approved?: boolean; reason?: string }
    | undefined;
  const approvalId =
    typeof approval?.id === "string" && approval.id.length > 0
      ? approval.id
      : undefined;
  const previewSource = result ?? nativeToolPart.args ?? undefined;
  const previewItems = useMemo(
    () => (toolCallId ? toPendingItemsFromResult(toolCallId, previewSource) : []),
    [previewSource, toolCallId],
  );
  const previewSummary = useMemo(
    () =>
      buildToolPreviewSummary({
        toolName,
        argsText,
        result,
        pendingItems: previewItems,
      }),
    [argsText, previewItems, result, toolName],
  );
  const isApprovalRequested =
    nativeState === "approval-requested" && !!approvalId;
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [isOpen, setIsOpen] = useState(() => isApprovalRequested);
  const prevNeedsApprovalRef = useRef(isApprovalRequested);

  useEffect(() => {
    if (isApprovalRequested && !prevNeedsApprovalRef.current) {
      setIsOpen(true);
    }
    if (!isApprovalRequested && prevNeedsApprovalRef.current) {
      setIsOpen(false);
    }
    prevNeedsApprovalRef.current = isApprovalRequested;
  }, [isApprovalRequested]);

  const handleApproval = useCallback(
    async (approved: boolean) => {
      if (!approvalId || !toolCallId || !onRespondToToolApproval) return;
      setIsSubmittingApproval(true);
      try {
        await onRespondToToolApproval({
          approvalId,
          approved,
          toolCallId,
        });
        toast.success(approved ? "Action approved" : "Action rejected");
      } catch (error) {
        console.error("Failed to submit tool approval:", error);
        toast.error("Couldn't continue this tool action");
      } finally {
        setIsSubmittingApproval(false);
      }
    },
    [approvalId, onRespondToToolApproval, toolCallId],
  );

  if (isApprovalRequested) {
    return (
      <div className="px-0 pt-2">
        <div className="rounded-xl border border-border/70 bg-card shadow-sm">
          <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Approval required</p>
              <p className="text-xs text-muted-foreground">
                Review the proposed `{toolName}` action before execution.
              </p>
            </div>
            <span className="rounded-full border border-border/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {confirmationMode === "auto_confirm" ? "Auto mode mismatch" : "Manual review"}
            </span>
          </div>
          <div className="space-y-3 px-4 py-3">
            {previewItems.length > 0 ? (
              <div className="space-y-2">
                {previewItems.map((item, index) => {
                  const title =
                    typeof item.data?.title === "string"
                      ? item.data.title
                      : typeof item.data?.name === "string"
                        ? item.data.name
                        : `${item.operation} ${item.type}`;
                  return (
                    <div
                      key={item.clientId ?? `${toolCallId}-${index}`}
                      className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
                    >
                      <div className="text-sm font-medium text-foreground">{title}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.operation} {item.type}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              previewSummary ? (
                <ToolPreviewCard
                  toolName={toolName}
                  summary={previewSummary}
                  status={status}
                  statusLabelOverride="Needs review"
                />
              ) : (
                <ToolFallbackArgs argsText={argsText} />
              )
            )}
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-border/70 px-4 py-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleApproval(false)}
              disabled={isSubmittingApproval || !onRespondToToolApproval}
            >
              {isSubmittingApproval ? <LoaderIcon className="mr-1 size-3 animate-spin" /> : null}
              Reject
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleApproval(true)}
              disabled={isSubmittingApproval || !onRespondToToolApproval}
            >
              {isSubmittingApproval ? <LoaderIcon className="mr-1 size-3 animate-spin" /> : null}
              Approve
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ToolFallbackRoot
      className={cn(isCancelled && "border-muted-foreground/30 bg-muted/30")}
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <ToolFallbackTrigger toolName={toolName} status={status} />
      <ToolFallbackContent>
        {nativeState === "approval-responded" ? (
          <div className="flex items-center gap-2 px-4 text-sm text-muted-foreground">
            <CheckCircle2Icon className="size-4 text-emerald-600" />
            Approved and continuing execution.
          </div>
        ) : null}
        <ToolFallbackError status={status} />
        {previewSummary ? (
          <ToolPreviewCard toolName={toolName} summary={previewSummary} status={status} />
        ) : null}
        <div className="px-4">
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/10">
            <div className="border-b border-dashed border-border/70 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Raw details
            </div>
            <ToolFallbackArgs
              argsText={argsText}
              className={cn("px-3 py-3", isCancelled && "opacity-60")}
            />
            {!isCancelled && (
              <ToolFallbackResult result={result} className="border-t-0 px-3 pb-3 pt-0" />
            )}
          </div>
        </div>
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
