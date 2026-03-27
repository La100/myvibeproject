"use client";

import { memo, useMemo } from "react";
import { z } from "zod";
import type { UIMessage } from "@convex-dev/agent/react";
import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { MessageContent } from "@/components/ai/primitives/message";
import { MessageResponse } from "@/components/ai/primitives/message";
import { InlineConfirmationList } from "../confirmations/InlineConfirmation";
import type { PendingContentItem, PendingContentType } from "../../data/types";
import { Download, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const toolResultDataSchema = z.record(z.unknown());
const titleChangeSchema = z.object({
  taskId: z.string().optional(),
  currentTitle: z.string().optional(),
  originalTitle: z.string().optional(),
  newTitle: z.string(),
});
const pendingActionSchema = z.object({
  type: z.string(),
  operation: z.enum(["create", "edit", "delete", "bulk_create", "bulk_edit"]),
  data: toolResultDataSchema,
  status: z.string().optional(),
  outcome: z.unknown().optional(),
  updates: toolResultDataSchema.optional(),
  originalItem: toolResultDataSchema.optional(),
  selection: toolResultDataSchema.optional(),
  titleChanges: z.array(titleChangeSchema).optional(),
}).passthrough();

const bulkTasksSchema = z.object({
  type: z.literal("task"),
  operation: z.literal("bulk_create"),
  data: z.object({
    tasks: z.array(toolResultDataSchema),
  }),
});

const bulkNotesSchema = z.object({
  type: z.literal("note"),
  operation: z.literal("bulk_create"),
  data: z.object({
    notes: z.array(toolResultDataSchema),
  }),
});

const bulkShoppingSchema = z.object({
  type: z.string(),
  operation: z.literal("bulk_create"),
  data: z.object({
    items: z.array(toolResultDataSchema),
  }),
});

function safeParseToolResult(result: string): z.infer<typeof pendingActionSchema> | null {
  try {
    const parsed = JSON.parse(result);
    const validated = pendingActionSchema.safeParse(parsed);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}

function toPendingContentType(type: string): PendingContentType {
  return type as PendingContentType;
}

type UIMessagePart = NonNullable<UIMessage["parts"]>[number];

const hasText = (part: UIMessagePart): part is UIMessagePart & { text: string } =>
  typeof (part as { text?: unknown }).text === "string";

function extractPendingItemsFromMessage(message: UIMessage): PendingContentItem[] {
  const items: PendingContentItem[] = [];
  if (!message.parts) return items;

  for (const part of message.parts) {
    if (part.type.startsWith("tool-result:")) {
      const resultPart = part as { type: string; result?: string };
      if (!resultPart.result) continue;

      const parsed = safeParseToolResult(resultPart.result);
      if (!parsed) continue;

      // Skip if the tool result contains an error
      const hasError = typeof parsed === "object" && parsed !== null && "error" in parsed;
      if (hasError) continue;

      if (parsed.type && parsed.operation && parsed.data) {
        const callId = part.type.replace("tool-result:", "");
        const status =
          parsed.status === "confirmed" || parsed.status === "rejected"
            ? parsed.status
            : undefined;

        if (parsed.operation === "bulk_create") {
          const bulkTasks = bulkTasksSchema.safeParse(parsed);
          if (bulkTasks.success) {
            for (const task of bulkTasks.data.data.tasks) {
              items.push({
                type: "task",
                operation: "create",
                data: task as Record<string, unknown>,
                functionCall: { callId, functionName: "", arguments: "" },
                status,
              });
            }
            continue;
          }

          const bulkNotes = bulkNotesSchema.safeParse(parsed);
          if (bulkNotes.success) {
            for (const note of bulkNotes.data.data.notes) {
              items.push({
                type: "note",
                operation: "create",
                data: note as Record<string, unknown>,
                functionCall: { callId, functionName: "", arguments: "" },
                status,
              });
            }
            continue;
          }

          const bulkShopping = bulkShoppingSchema.safeParse(parsed);
          if (bulkShopping.success) {
            for (const item of bulkShopping.data.data.items) {
              items.push({
                type: toPendingContentType(parsed.type),
                operation: "create",
                data: item as Record<string, unknown>,
                functionCall: { callId, functionName: "", arguments: "" },
                status,
              });
            }
            continue;
          }
        }

        items.push({
          type: toPendingContentType(parsed.type),
          operation: parsed.operation,
          data: parsed.data,
          updates: parsed.updates as Record<string, unknown>,
          originalItem: parsed.originalItem as Record<string, unknown>,
          selection: parsed.selection as Record<string, unknown>,
          titleChanges: parsed.titleChanges as Array<{
            taskId?: string;
            currentTitle?: string;
            originalTitle?: string;
            newTitle: string;
          }>,
          functionCall: { callId, functionName: "", arguments: "" },
          status,
        });
      }
    }
  }

  return items;
}

function UserAttachmentPreview({
  metadata,
  localAttachments,
}: {
  metadata?: {
    fileId?: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
  };
  localAttachments?: Array<{
    name: string;
    size?: number;
    type: string;
    previewUrl?: string;
  }>;
}) {
  const file = useQuery(
    apiAny.files.getFileWithURL,
    metadata?.fileId ? { fileId: metadata.fileId as Id<"files"> } : "skip"
  );

  if (localAttachments && localAttachments.length > 0) {
    return (
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {localAttachments.map((attachment) => (
          <div
            key={`${attachment.name}-${attachment.size}`}
            className="flex items-center gap-2 bg-muted/40 p-2 rounded-xl border border-border/50"
          >
            {attachment.previewUrl ? (
              <img
                src={attachment.previewUrl}
                alt={attachment.name}
                className="h-8 w-8 rounded-md object-cover border border-border/60"
              />
            ) : (
              <div className="h-8 w-8 rounded-md border border-border/60 bg-muted" />
            )}
            <div className="flex flex-col">
              <span className="text-xs font-medium max-w-[120px] truncate">
                {attachment.name}
              </span>
              {typeof attachment.size === "number" && attachment.size > 0 ? (
                <span className="text-[10px] text-muted-foreground">
                  {(attachment.size / 1024 / 1024).toFixed(1)} MB
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!metadata?.fileId || !file) return null;

  const isImage = file.mimeType?.startsWith("image/");
  const sizeLabel = typeof file.size === "number" ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "";

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 bg-muted/40 p-2 rounded-xl border border-border/50">
        {isImage && file.url ? (
          <img
            src={file.url}
            alt={file.name}
            className="h-8 w-8 rounded-md object-cover border border-border/60"
          />
        ) : (
          <div className="h-8 w-8 rounded-md border border-border/60 bg-muted" />
        )}
        <div className="flex flex-col">
          <span className="text-xs font-medium max-w-[120px] truncate">{file.name}</span>
          {sizeLabel && (
            <span className="text-[10px] text-muted-foreground">{sizeLabel}</span>
          )}
        </div>
      </div>
    </div>
  );
}

type PreviewMessageProps = {
  message: UIMessage;
  isLoading: boolean;
  metadata?: {
    fileId?: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
  };
  localAttachments?: Array<{
    name: string;
    size?: number;
    type: string;
    previewUrl?: string;
  }>;
  onConfirmItem?: (index: number | string) => Promise<void>;
  onRejectItem?: (index: number | string) => void | Promise<void>;
  onEditItem?: (index: number | string) => void;
  onConfirmAll?: () => Promise<void>;
  onRejectAll?: () => void | Promise<void>;
  onUpdateItem?: (index: number | string, updates: Partial<PendingContentItem>) => void;
  isProcessing?: boolean;
  mediaImageUrl?: string;
  onImageClick?: (payload: { url: string; prompt: string }) => void;
  onDownloadImage?: (url: string) => void;
  hideGeneratedPlaceholderText?: boolean;
};

export const PurePreviewMessage = ({
  message,
  isLoading,
  metadata,
  localAttachments,
  pendingItems,
  onConfirmItem,
  onRejectItem,
  onEditItem,
  onConfirmAll,
  onRejectAll,
  onUpdateItem,
  isProcessing,
  mediaImageUrl,
  onImageClick,
  onDownloadImage,
  hideGeneratedPlaceholderText = false,
}: PreviewMessageProps & { pendingItems?: PendingContentItem[] }) => {
  const isUser = message.role === "user";
  const textFromParts =
    message.parts?.find(
      (part): part is UIMessagePart & { type: "text"; text: string } =>
        part.type === "text" && hasText(part)
    )?.text ?? "";
  const messageText = message.text || textFromParts;
  const resolvedMessageText =
    hideGeneratedPlaceholderText && messageText.trim() === "Generated image."
      ? ""
      : messageText;

  // Extract items and merge with local pending state for optimistic updates
  const inlineItems = useMemo(() => {
    const items = extractPendingItemsFromMessage(message);
    if (!pendingItems || pendingItems.length === 0) return items;

    const pendingStatusesByCallId = new Map<
      string,
      Array<PendingContentItem["status"]>
    >();
    for (const pendingItem of pendingItems) {
      const callId = pendingItem.functionCall?.callId;
      if (!callId) continue;

      const existing = pendingStatusesByCallId.get(callId);
      if (existing) {
        existing.push(pendingItem.status);
      } else {
        pendingStatusesByCallId.set(callId, [pendingItem.status]);
      }
    }

    const callOccurrence = new Map<string, number>();

    return items.map((item) => {
      const callId = item.functionCall?.callId;
      if (!callId) return item;

      const occurrence = callOccurrence.get(callId) ?? 0;
      callOccurrence.set(callId, occurrence + 1);

      const localStatus = pendingStatusesByCallId.get(callId)?.[occurrence];
      if (localStatus === "confirmed" || localStatus === "rejected") {
        return {
          ...item,
          status: localStatus,
        };
      }
      return item;
    });
  }, [message, pendingItems]);

  const hasConfirmations = inlineItems.length > 0 && !isLoading;
  const hasVisibleAssistantContent =
    resolvedMessageText.trim().length > 0 ||
    Boolean(mediaImageUrl) ||
    hasConfirmations;

  if (!isUser && !isLoading && !hasVisibleAssistantContent) {
    return null;
  }

  return (
    <div
      className="group/message fade-in mx-auto w-full max-w-[44rem] animate-in px-2 py-3 duration-150"
      data-role={message.role}
    >
      <div
        className={cn("flex w-full items-start gap-3", {
          "justify-end": isUser,
          "justify-start": !isUser,
        })}
      >
        {!isUser && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
        )}

        <div
          className={cn("flex flex-col", {
            "gap-2": true,
            "w-full": !isUser,
            "max-w-[85%]": isUser,
          })}
        >
          {isUser && (
            <UserAttachmentPreview metadata={metadata} localAttachments={localAttachments} />
          )}

          {resolvedMessageText && (
            <MessageContent
              className={cn({
                "wrap-break-word w-fit rounded-2xl bg-muted px-4 py-2.5 text-left text-foreground": isUser,
                "bg-transparent px-0 py-0 text-left leading-relaxed": !isUser,
              })}
            >
              <MessageResponse>{resolvedMessageText}</MessageResponse>
            </MessageContent>
          )}

          {!isUser && mediaImageUrl && (
            <div className="max-w-full space-y-2">
              <div
                className={cn(
                  "relative overflow-hidden rounded-2xl border border-border/50 bg-muted/20 shadow-sm transition-shadow",
                  onImageClick ? "cursor-zoom-in hover:shadow-md" : "",
                )}
                onClick={() => {
                  if (!onImageClick) return;
                  onImageClick({
                    url: mediaImageUrl,
                    prompt: resolvedMessageText || messageText,
                  });
                }}
              >
                <img
                  src={mediaImageUrl}
                  alt={resolvedMessageText || messageText || "Generated image"}
                  className="max-h-[60vh] w-full object-contain"
                />
              </div>

              {onDownloadImage && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDownloadImage(mediaImageUrl);
                  }}
                >
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Download
                </Button>
              )}
            </div>
          )}

          {hasConfirmations && onConfirmItem && onRejectItem && (
            <InlineConfirmationList
              items={inlineItems}
              onConfirmItem={onConfirmItem}
              onRejectItem={onRejectItem}
              onEditItem={onEditItem}
              onConfirmAll={onConfirmAll}
              onRejectAll={onRejectAll}
              onUpdateItem={onUpdateItem}
              isProcessing={isProcessing}
            />
          )}
        </div>

        {isUser && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted text-xs font-semibold text-muted-foreground">
            U
          </div>
        )}
      </div>
    </div>
  );
};

export const PreviewMessage = memo(PurePreviewMessage);
