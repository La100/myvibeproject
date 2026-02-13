"use client";

import type { ChatStatus, FileUIPart } from "ai";
import { toast } from "sonner";

import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai/primitives/prompt-input";
import { cn } from "@/lib/utils";

type ComposerSubmitPayload = {
  text: string;
  files: FileUIPart[];
};

type ComposerProps = {
  submitStatus: ChatStatus;
  onSubmit: (payload: ComposerSubmitPayload) => Promise<void> | void;
  onStopResponse: () => void;
  placeholder?: string;
  accept?: string;
  maxFiles?: number;
  maxFileSize?: number;
  multiple?: boolean;
  isUploading?: boolean;
  disabled?: boolean;
  className?: string;
};

export function Composer({
  submitStatus,
  onSubmit,
  onStopResponse,
  placeholder = "Send a message...",
  accept,
  maxFiles,
  maxFileSize,
  multiple = true,
  isUploading = false,
  disabled = false,
  className,
}: ComposerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-[44rem]", className)}>
      <PromptInput
        accept={accept}
        className="w-full [&_[data-slot=input-group]]:rounded-2xl [&_[data-slot=input-group]]:border-input [&_[data-slot=input-group]]:bg-background [&_[data-slot=input-group]]:shadow-none"
        multiple={multiple}
        maxFiles={maxFiles}
        maxFileSize={maxFileSize}
        onError={(err) => toast.error(err.message)}
        onSubmit={onSubmit}
      >
        <PromptInputBody>
          <PromptInputAttachments className="w-full px-2 pt-2 pb-0">
            {(file) => <PromptInputAttachment className="rounded-lg" data={file} />}
          </PromptInputAttachments>
          <PromptInputTextarea
            className="mb-1 max-h-32 min-h-14 px-4 pt-2 pb-3 text-sm"
            placeholder={isUploading ? "Uploading..." : placeholder}
          />
        </PromptInputBody>
        <PromptInputFooter className="mx-2 mb-2 justify-between">
          <PromptInputTools>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger className="size-8 rounded-full" />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
          </PromptInputTools>
          <PromptInputSubmit
            className="size-8 rounded-full"
            status={submitStatus}
            onStop={onStopResponse}
            disabled={disabled || isUploading}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

export default Composer;
