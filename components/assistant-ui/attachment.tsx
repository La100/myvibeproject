"use client";

import { PropsWithChildren, useEffect, useState, type FC } from "react";
import { XIcon, PlusIcon, FileText } from "lucide-react";
import {
  AttachmentPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useAuiState,
  useAui,
} from "@assistant-ui/react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const useFileSrc = (file: File | undefined) => {
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!file) {
      setSrc(undefined);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return src;
};

const useAttachmentSrc = () => {
  const file = useAuiState(({ attachment }) =>
    attachment.type === "image" ? attachment.file : undefined,
  );
  const src = useAuiState(({ attachment }) => {
    if (attachment.type !== "image") return undefined;
    return attachment.content?.find((content) => content.type === "image")
      ?.image;
  });

  return useFileSrc(file) ?? src;
};

type AttachmentPreviewProps = {
  src: string;
};

const AttachmentPreview: FC<AttachmentPreviewProps> = ({ src }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  return (
    <img
      src={src}
      alt="Image Preview"
      className={cn(
        "block h-auto max-h-[80vh] w-auto max-w-full object-contain",
        isLoaded
          ? "aui-attachment-preview-image-loaded"
          : "aui-attachment-preview-image-loading invisible",
      )}
      onLoad={() => setIsLoaded(true)}
    />
  );
};

const AttachmentPreviewDialog: FC<PropsWithChildren> = ({ children }) => {
  const src = useAttachmentSrc();

  if (!src) return children;

  return (
    <Dialog>
      <DialogTrigger
        className="aui-attachment-preview-trigger cursor-pointer transition-colors hover:bg-accent/50"
        asChild
      >
        {children}
      </DialogTrigger>
      <DialogContent className="aui-attachment-preview-dialog-content p-2 sm:max-w-3xl [&>button]:rounded-full [&>button]:bg-foreground/60 [&>button]:p-1 [&>button]:opacity-100 [&>button]:ring-0! [&_svg]:text-background [&>button]:hover:[&_svg]:text-destructive">
        <DialogTitle className="aui-sr-only sr-only">
          Image Attachment Preview
        </DialogTitle>
        <div className="aui-attachment-preview relative mx-auto flex max-h-[80dvh] w-full items-center justify-center overflow-hidden bg-background">
          <AttachmentPreview src={src} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AttachmentThumb: FC = () => {
  const isImage = useAuiState(({ attachment }) => attachment.type === "image");
  const src = useAttachmentSrc();

  return (
    <Avatar className="aui-attachment-tile-avatar h-full w-full rounded-none">
      <AvatarImage
        src={src}
        alt="Attachment preview"
        className="aui-attachment-tile-image object-cover"
      />
      <AvatarFallback delayMs={isImage ? 200 : 0}>
        <FileText className="aui-attachment-tile-fallback-icon size-8 text-muted-foreground" />
      </AvatarFallback>
    </Avatar>
  );
};

const AttachmentUI: FC = () => {
  const aui = useAui();
  const isComposer = aui.attachment.source === "composer";

  const isImage = useAuiState(({ attachment }) => attachment.type === "image");
  const typeLabel = useAuiState(({ attachment }) => {
    const type = attachment.type;
    switch (type) {
      case "image":
        return "Image";
      case "document":
        return "Document";
      case "file":
        return "File";
      default:
        return "Attachment";
    }
  });

  return (
    <AttachmentPrimitive.Root
      className={cn(
        "aui-attachment-root relative",
        isImage &&
          "aui-attachment-root-composer only:[&>#attachment-tile]:size-24",
      )}
    >
      <AttachmentPreviewDialog>
        <button
          className={cn(
            "aui-attachment-tile size-14 cursor-pointer overflow-hidden rounded-[14px] border bg-muted transition-opacity hover:opacity-75",
            isComposer &&
              "aui-attachment-tile-composer border-foreground/20",
          )}
          id="attachment-tile"
          aria-label={`${typeLabel} attachment`}
          title={typeLabel}
          type="button"
        >
          <AttachmentThumb />
        </button>
      </AttachmentPreviewDialog>
      {isComposer && <AttachmentRemove />}
    </AttachmentPrimitive.Root>
  );
};

const AttachmentRemove: FC = () => {
  return (
    <AttachmentPrimitive.Remove
      className="aui-attachment-tile-remove absolute top-1.5 right-1.5 inline-flex size-3.5 items-center justify-center rounded-full bg-white text-muted-foreground opacity-100 shadow-sm transition-colors hover:bg-white! disabled:opacity-50 [&_svg]:text-black hover:[&_svg]:text-destructive"
      aria-label="Remove file"
      title="Remove file"
    >
      <XIcon className="aui-attachment-remove-icon size-3 dark:stroke-[2.5px]" />
      <span className="sr-only">Remove file</span>
    </AttachmentPrimitive.Remove>
  );
};

export const UserMessageAttachments: FC = () => {
  return (
    <div className="aui-user-message-attachments-end col-span-full col-start-1 row-start-1 flex w-full flex-row justify-end gap-2">
      <MessagePrimitive.Attachments components={{ Attachment: AttachmentUI }} />
    </div>
  );
};

export const ComposerAttachments: FC = () => {
  return (
    <div className="aui-composer-attachments mb-2 flex w-full flex-row items-center gap-2 overflow-x-auto px-1.5 pt-0.5 pb-1 empty:hidden">
      <ComposerPrimitive.Attachments
        components={{ Attachment: AttachmentUI }}
      />
    </div>
  );
};

export const ComposerAddAttachment: FC = () => {
  return (
    <ComposerPrimitive.AddAttachment
      className="aui-composer-add-attachment inline-flex size-8.5 items-center justify-center rounded-full p-1 font-semibold text-xs transition-colors hover:bg-muted-foreground/15 disabled:opacity-50 dark:border-muted-foreground/15 dark:hover:bg-muted-foreground/30"
      aria-label="Add Attachment"
      title="Add Attachment"
    >
      <PlusIcon className="aui-attachment-add-icon size-5 stroke-[1.5px]" />
      <span className="sr-only">Add Attachment</span>
    </ComposerPrimitive.AddAttachment>
  );
};
