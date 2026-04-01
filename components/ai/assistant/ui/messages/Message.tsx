"use client";

import { memo } from "react";
import type { UIMessage } from "@convex-dev/agent/react";
import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { MessageContent } from "@/components/ai/primitives/message";
import { MessageResponse } from "@/components/ai/primitives/message";
import { Download, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type UIMessagePart = NonNullable<UIMessage["parts"]>[number];

const hasText = (part: UIMessagePart): part is UIMessagePart & { text: string } =>
  typeof (part as { text?: unknown }).text === "string";

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
  mediaImageUrl,
  onImageClick,
  onDownloadImage,
  hideGeneratedPlaceholderText = false,
}: PreviewMessageProps) => {
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
  const hasVisibleAssistantContent =
    resolvedMessageText.trim().length > 0 ||
    Boolean(mediaImageUrl);

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
