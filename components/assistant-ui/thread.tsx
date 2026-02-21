import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/assistant-ui/attachment";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { ToolFallback } from "@/components/assistant-ui/tool-fallback";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { PendingContentItem } from "@/components/ai/assistant/data/types";
import {
  AuiIf,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  SuggestionPrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Sparkles,
  SquareIcon,
  Zap,
} from "lucide-react";
import NextImage from "next/image";
import { useMemo, type FC, type ComponentProps } from "react";

type ThreadProps = {
  showWelcome?: boolean;
  assistantImageUrl?: string;
  assistantFallback?: string;
  userImageUrl?: string;
  userFallback?: string;
  pendingItems?: PendingContentItem[];
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
};

export const Thread: FC<ThreadProps> = ({
  showWelcome = true,
  assistantImageUrl,
  assistantFallback,
  userImageUrl,
  userFallback,
  pendingItems = [],
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
}) => {
  const messageComponents = useMemo(
    () => ({
      UserMessage: () => (
        <UserMessage imageUrl={userImageUrl} fallback={userFallback} />
      ),
      EditComposer,
      AssistantMessage: () => (
        <AssistantMessage
          imageUrl={assistantImageUrl}
          fallback={assistantFallback}
          pendingItems={pendingItems}
          onConfirmItem={onConfirmItem}
          onRejectItem={onRejectItem}
          onEditItem={onEditItem}
          onConfirmAll={onConfirmAll}
          onRejectAll={onRejectAll}
          onUpdateItem={onUpdateItem}
          isProcessing={isProcessing}
          confirmationMode={confirmationMode}
          onConfirmationModeChange={onConfirmationModeChange}
          isModeUpdating={isModeUpdating}
        />
      ),
    }),
    [
      assistantFallback,
      assistantImageUrl,
      confirmationMode,
      isModeUpdating,
      isProcessing,
      onConfirmAll,
      onConfirmItem,
      onConfirmationModeChange,
      onEditItem,
      onRejectAll,
      onRejectItem,
      onUpdateItem,
      pendingItems,
      userFallback,
      userImageUrl,
    ],
  );

  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root @container flex h-full min-h-0 w-full flex-col bg-transparent"
      style={{
        ["--thread-max-width" as string]: "44rem",
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="bottom"
        className="aui-thread-viewport relative flex min-h-0 w-full flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth px-4 pt-4 pb-6"
      >
        <AuiIf condition={({ thread }) => showWelcome && thread.isEmpty}>
          <div className="aui-thread-empty mx-auto flex min-h-full w-full max-w-(--thread-max-width) flex-col items-center justify-center gap-16 py-16">
            <ThreadWelcome />
          </div>
        </AuiIf>

        <ThreadPrimitive.Messages components={messageComponents} />
      </ThreadPrimitive.Viewport>
      <div className="aui-thread-composer-footer w-full shrink-0 border-t border-border/50 bg-transparent px-4 pt-4 pb-4">
        <div className="relative mx-auto flex w-full max-w-(--thread-max-width) flex-col gap-4">
          <ThreadScrollToBottom />
          <Composer
            confirmationMode={confirmationMode}
            onConfirmationModeChange={onConfirmationModeChange}
            isModeUpdating={isModeUpdating}
          />
        </div>
      </div>
    </ThreadPrimitive.Root>
  );
};

type MessageAvatarProps = {
  imageUrl?: string;
  fallback?: string;
};

const MessageAvatar: FC<MessageAvatarProps> = ({ imageUrl, fallback }) => {
  const initials = fallback?.trim().slice(0, 1).toUpperCase() || "A";
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted text-xs font-semibold text-muted-foreground">
      {imageUrl ? (
        <NextImage
          src={imageUrl}
          alt=""
          width={36}
          height={36}
          sizes="36px"
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="aui-thread-scroll-to-bottom absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible dark:bg-background dark:hover:bg-accent"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <div className="aui-thread-welcome-root flex w-full flex-col items-center text-center">
      <div className="aui-thread-welcome-center flex w-full flex-col items-center justify-center">
        <div className="aui-thread-welcome-message flex w-full flex-col items-center justify-center px-4">
          <h1 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in font-semibold text-2xl duration-200">
            Hi, I'm VibePlanner.
          </h1>
          <p className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in text-muted-foreground text-xl delay-75 duration-200">
            I'm here to help you get things done. What would you like to learn or work on?
          </p>
        </div>
      </div>
      <ThreadSuggestions />
    </div>
  );
};

const ThreadSuggestions: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestions grid w-full @md:grid-cols-2 gap-2 pb-4">
      <ThreadPrimitive.Suggestions
        components={{
          Suggestion: ThreadSuggestionItem,
        }}
      />
    </div>
  );
};

const ThreadSuggestionItem: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 @md:nth-[n+3]:block nth-[n+3]:hidden animate-in fill-mode-both duration-200">
      <SuggestionPrimitive.Trigger send asChild>
        <Button
          variant="ghost"
          className="aui-thread-welcome-suggestion h-auto w-full @md:flex-col flex-wrap items-start justify-start gap-1 rounded-2xl border px-4 py-3 text-left text-sm transition-colors hover:bg-muted"
        >
          <span className="aui-thread-welcome-suggestion-text-1 font-medium">
            <SuggestionPrimitive.Title />
          </span>
          <span className="aui-thread-welcome-suggestion-text-2 text-muted-foreground">
            <SuggestionPrimitive.Description />
          </span>
        </Button>
      </SuggestionPrimitive.Trigger>
    </div>
  );
};

const Composer: FC<{
  confirmationMode?: "always_ask" | "auto_confirm";
  onConfirmationModeChange?: (mode: "always_ask" | "auto_confirm") => void | Promise<void>;
  isModeUpdating?: boolean;
}> = ({
  confirmationMode = "always_ask",
  onConfirmationModeChange,
  isModeUpdating = false,
}) => {
  return (
    <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
      <ComposerPrimitive.AttachmentDropzone className="aui-composer-attachment-dropzone flex w-full flex-col rounded-2xl border border-input bg-background px-1 pt-2 outline-none transition-shadow has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-ring/20 data-[dragging=true]:border-ring data-[dragging=true]:border-dashed data-[dragging=true]:bg-accent/50">
        <ComposerAttachments />
        <ComposerPrimitive.Input
          id="assistant-chat-input"
          placeholder="Send a message..."
          className="aui-composer-input mb-1 max-h-32 min-h-14 w-full resize-none bg-transparent px-4 pt-2 pb-3 text-sm text-foreground caret-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-0"
          rows={1}
          autoFocus
          aria-label="Message input"
        />
        <ComposerAction
          confirmationMode={confirmationMode}
          onConfirmationModeChange={onConfirmationModeChange}
          isModeUpdating={isModeUpdating}
        />
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Root>
  );
};

const ComposerAction: FC<{
  confirmationMode?: "always_ask" | "auto_confirm";
  onConfirmationModeChange?: (mode: "always_ask" | "auto_confirm") => void | Promise<void>;
  isModeUpdating?: boolean;
}> = ({
  confirmationMode = "always_ask",
  onConfirmationModeChange,
  isModeUpdating = false,
}) => {
    return (
      <div className="aui-composer-action-wrapper relative mx-2 mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ComposerAddAttachment />
          {onConfirmationModeChange && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-2 py-1 cursor-pointer">
                  <Switch
                    checked={confirmationMode === "auto_confirm"}
                    onCheckedChange={(checked) =>
                      onConfirmationModeChange(checked ? "auto_confirm" : "always_ask")
                    }
                    disabled={isModeUpdating}
                    aria-label="Auto accept CRUD actions"
                  />
                  <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-56 text-center">
                {confirmationMode === "auto_confirm"
                  ? <><span className="font-medium">Auto-confirm ON</span><br />AI actions are applied automatically</>
                  : <><span className="font-medium">Auto-confirm OFF</span><br />AI actions require your approval</>
                }
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <AuiIf condition={({ thread }) => !thread.isRunning}>
          <ComposerPrimitive.Send asChild>
            <TooltipIconButton
              tooltip="Send message"
              side="bottom"
              type="submit"
              variant="default"
              size="icon"
              className="aui-composer-send size-8 rounded-full"
              aria-label="Send message"
            >
              <ArrowUpIcon className="aui-composer-send-icon size-4" />
            </TooltipIconButton>
          </ComposerPrimitive.Send>
        </AuiIf>
        <AuiIf condition={({ thread }) => thread.isRunning}>
          <ComposerPrimitive.Cancel asChild>
            <Button
              type="button"
              variant="default"
              size="icon"
              className="aui-composer-cancel size-8 rounded-full"
              aria-label="Stop generating"
            >
              <SquareIcon className="aui-composer-cancel-icon size-3 fill-current" />
            </Button>
          </ComposerPrimitive.Cancel>
        </AuiIf>
      </div>
    );
  };

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="aui-message-error-root mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-destructive text-sm dark:bg-destructive/5 dark:text-red-200">
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

type AssistantMessageProps = {
  imageUrl?: string;
  fallback?: string;
  pendingItems?: PendingContentItem[];
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
};

type ToolFallbackWithPendingProps = ComponentProps<typeof ToolFallback> & {
  pendingItems?: PendingContentItem[];
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
};

const ToolFallbackWithPending = ToolFallback as unknown as FC<ToolFallbackWithPendingProps>;

const AssistantMessage: FC<AssistantMessageProps> = ({
  imageUrl,
  fallback,
  pendingItems = [],
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
}) => {
  const PendingAwareToolFallback = (props: ComponentProps<typeof ToolFallback>) => (
    <ToolFallbackWithPending
      {...props}
      pendingItems={pendingItems}
      onConfirmItem={onConfirmItem}
      onRejectItem={onRejectItem}
      onEditItem={onEditItem}
      onConfirmAll={onConfirmAll}
      onRejectAll={onRejectAll}
      onUpdateItem={onUpdateItem}
      isProcessing={isProcessing}
      confirmationMode={confirmationMode}
      onConfirmationModeChange={onConfirmationModeChange}
      isModeUpdating={isModeUpdating}
    />
  );

  return (
    <MessagePrimitive.Root
      className="aui-assistant-message-root relative mx-auto w-full max-w-(--thread-max-width) py-3"
      data-role="assistant"
    >
      <div className="flex items-start gap-3 px-2">
        {imageUrl ? (
          <MessageAvatar imageUrl={imageUrl} fallback={fallback} />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
        )}
        <div className="aui-assistant-message-content min-w-0 break-words text-foreground leading-relaxed">
          <MessagePrimitive.Parts
            components={{
              Text: MarkdownText,
              tools: { Fallback: PendingAwareToolFallback },
            }}
          />
          <MessageError />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

type UserMessageProps = {
  imageUrl?: string;
  fallback?: string;
};

const UserMessage: FC<UserMessageProps> = ({ imageUrl, fallback }) => {
  return (
    <MessagePrimitive.Root
      className="aui-user-message-root mx-auto grid w-full max-w-(--thread-max-width) auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 py-3"
      data-role="user"
    >
      <div className="col-start-1 flex justify-end pr-2">
        <MessageAvatar imageUrl={imageUrl} fallback={fallback} />
      </div>
      <UserMessageAttachments />

      <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
        <div className="aui-user-message-content break-words rounded-2xl bg-muted px-4 py-2.5 text-foreground">
          <MessagePrimitive.Parts />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <MessagePrimitive.Root className="aui-edit-composer-wrapper mx-auto flex w-full max-w-(--thread-max-width) flex-col px-2 py-3">
      <ComposerPrimitive.Root className="aui-edit-composer-root ml-auto flex w-full max-w-[85%] flex-col rounded-2xl bg-muted">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input min-h-14 w-full resize-none bg-transparent p-4 text-foreground text-sm outline-none"
          autoFocus
        />
        <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm">Update</Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
};
