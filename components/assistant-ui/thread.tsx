import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/assistant-ui/attachment";
import { QUICK_PROMPTS } from "@/components/ai/assistant/config";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { ToolFallback } from "@/components/assistant-ui/tool-fallback";
import { Switch } from "@/components/ui/switch";
import type { PendingContentItem } from "@/components/ai/assistant/data/types";
import {
  AuiIf,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarDays,
  ClipboardCheck,
  HardHat,
  ListChecks,
  ShoppingCart,
  Sparkles,
  SquareIcon,
  Users,
  Zap,
} from "lucide-react";
import NextImage from "next/image";
import { useMemo, type FC, type ComponentProps, type ReactNode } from "react";

type ThreadProps = {
  showWelcome?: boolean;
  assistantImageUrl?: string;
  assistantFallback?: string;
  userImageUrl?: string;
  userFallback?: string;
  inputDisabled?: boolean;
  inputPlaceholder?: string;
  composerBanner?: ReactNode;
  pendingItems?: PendingContentItem[];
  onConfirmItem?: (index: number | string) => Promise<void>;
  onRejectItem?: (index: number | string) => void | Promise<void>;
  onEditItem?: (index: number) => void;
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
  inputDisabled = false,
  inputPlaceholder,
  composerBanner,
  pendingItems = [],
  onConfirmItem,
  onRejectItem,
  onEditItem,
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
      onConfirmItem,
      onConfirmationModeChange,
      onEditItem,
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
          <div className="aui-thread-empty mx-auto flex min-h-full w-full max-w-(--thread-max-width) flex-col items-center justify-end gap-12 pb-8">
            <ThreadWelcome />
          </div>
        </AuiIf>

        <ThreadPrimitive.Messages components={messageComponents} />
      </ThreadPrimitive.Viewport>
      <div className="aui-thread-composer-footer w-full shrink-0 bg-transparent px-4 pt-3 pb-4">
        <div className="relative mx-auto flex w-full max-w-(--thread-max-width) flex-col gap-4">
          <ThreadScrollToBottom />
          {composerBanner}
          <Composer
            inputDisabled={inputDisabled}
            inputPlaceholder={inputPlaceholder}
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
    <ThreadPrimitive.ScrollToBottom
      className="aui-thread-scroll-to-bottom absolute -top-12 z-10 inline-flex size-10 items-center justify-center self-center rounded-full border border-border bg-card p-4 text-foreground shadow-soft-md transition-colors hover:bg-accent disabled:invisible dark:bg-background dark:hover:bg-accent"
      aria-label="Scroll to bottom"
      title="Scroll to bottom"
    >
      <ArrowDownIcon className="size-4" />
      <span className="sr-only">Scroll to bottom</span>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <div className="aui-thread-welcome-root flex w-full flex-col items-center text-center gap-8">
      <div className="aui-thread-welcome-center flex w-full flex-col items-center justify-center gap-2">
        <div className="aui-thread-welcome-message flex w-full flex-col items-center justify-center gap-1 px-4">
          <h1 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in font-display font-semibold text-3xl tracking-tight duration-200">
            Hi, I&apos;m Vibe.
          </h1>
          <p className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in text-muted-foreground text-base delay-75 duration-200 max-w-md">
            Your renovation copilot. I create tasks, shopping lists, cost estimates, and keep your project on track.
          </p>
        </div>
      </div>
      <ThreadSuggestions />
    </div>
  );
};

const CARD_ICONS: Record<string, FC<{ className?: string }>> = {
  "Set Up Phases": ListChecks,
  "Material List": ShoppingCart,
  "Labor Costs": HardHat,
  "Add Contractors": Users,
  "Week Plan": CalendarDays,
  "Status Check": ClipboardCheck,
};

const ThreadSuggestions: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestions grid w-full @md:grid-cols-2 gap-3 pb-4">
      {QUICK_PROMPTS.map((template, index) => {
        const Icon = CARD_ICONS[template.label] || Sparkles;
        return (
          <div
            key={`${template.label}-${index}`}
            className="aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 @md:nth-[n+3]:block nth-[n+3]:hidden animate-in fill-mode-both duration-200"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <ThreadPrimitive.Suggestion
              prompt={template.prompt}
              className="group aui-thread-welcome-suggestion inline-flex h-auto w-full items-start justify-start gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3.5 text-left text-sm transition-all hover:bg-muted hover:border-border hover:shadow-sm @md:flex-col @md:gap-2"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-foreground @md:h-7 @md:w-7">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="aui-thread-welcome-suggestion-text-1 font-medium text-foreground">
                  {template.label}
                </span>
                <span className="aui-thread-welcome-suggestion-text-2 text-muted-foreground text-xs leading-relaxed line-clamp-2">
                  {template.prompt}
                </span>
              </div>
            </ThreadPrimitive.Suggestion>
          </div>
        );
      })}
    </div>
  );
};

const Composer: FC<{
  inputDisabled?: boolean;
  inputPlaceholder?: string;
  confirmationMode?: "always_ask" | "auto_confirm";
  onConfirmationModeChange?: (mode: "always_ask" | "auto_confirm") => void | Promise<void>;
  isModeUpdating?: boolean;
}> = ({
  inputDisabled = false,
  inputPlaceholder,
  confirmationMode = "always_ask",
  onConfirmationModeChange,
  isModeUpdating = false,
}) => {
  const resolvedPlaceholder =
    inputPlaceholder ?? "Describe the renovation stage, problem, or question...";

  return (
    <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
      <ComposerPrimitive.AttachmentDropzone className="aui-composer-attachment-dropzone flex w-full flex-col rounded-2xl border border-border/80 bg-card shadow-sm px-1 pt-2 outline-none transition-shadow has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-ring/20 data-[dragging=true]:border-ring data-[dragging=true]:border-dashed data-[dragging=true]:bg-accent/50">
        <ComposerAttachments />
        <ComposerPrimitive.Input
          id="assistant-chat-input"
          placeholder={resolvedPlaceholder}
          className="aui-composer-input mb-1 max-h-32 min-h-14 w-full resize-none bg-transparent px-4 pt-2 pb-3 text-sm text-foreground caret-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-0"
          rows={1}
          autoFocus
          aria-label="Message input"
          disabled={inputDisabled}
        />
        <ComposerAction
          inputDisabled={inputDisabled}
          confirmationMode={confirmationMode}
          onConfirmationModeChange={onConfirmationModeChange}
          isModeUpdating={isModeUpdating}
        />
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Root>
  );
};

const ComposerAction: FC<{
  inputDisabled?: boolean;
  confirmationMode?: "always_ask" | "auto_confirm";
  onConfirmationModeChange?: (mode: "always_ask" | "auto_confirm") => void | Promise<void>;
  isModeUpdating?: boolean;
}> = ({
  inputDisabled = false,
  confirmationMode = "always_ask",
  onConfirmationModeChange,
  isModeUpdating = false,
}) => {
  return (
    <div className="aui-composer-action-wrapper relative mx-2 mb-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <ComposerAddAttachment disabled={inputDisabled} />
        {onConfirmationModeChange && (
          <div
            className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-2 py-1 cursor-pointer"
            title={
              confirmationMode === "auto_confirm"
                ? "Auto-confirm ON. AI actions are applied automatically"
                : "Auto-confirm OFF. AI actions require your approval"
            }
          >
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
        )}
      </div>
      <AuiIf condition={({ thread }) => !thread.isRunning}>
        <ComposerPrimitive.Send
          type="submit"
          className="aui-composer-send inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft-md transition-colors hover:bg-primary/92 disabled:opacity-50"
          aria-label="Send message"
          title="Send message"
          disabled={inputDisabled}
        >
          <ArrowUpIcon className="aui-composer-send-icon size-4" />
          <span className="sr-only">Send message</span>
        </ComposerPrimitive.Send>
      </AuiIf>
      <AuiIf condition={({ thread }) => thread.isRunning}>
        <ComposerPrimitive.Cancel
          type="button"
          className="aui-composer-cancel inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft-md transition-colors hover:bg-primary/92 disabled:opacity-50"
          aria-label="Stop generating"
          title="Stop generating"
        >
          <SquareIcon className="aui-composer-cancel-icon size-3 fill-current" />
          <span className="sr-only">Stop generating</span>
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
  onUpdateItem?: (index: number | string, updates: Partial<PendingContentItem>) => void;
  isProcessing?: boolean;
  confirmationMode?: "always_ask" | "auto_confirm";
  onConfirmationModeChange?: (mode: "always_ask" | "auto_confirm") => void | Promise<void>;
  isModeUpdating?: boolean;
};

const AssistantMessage: FC<AssistantMessageProps> = ({
  imageUrl,
  fallback,
  pendingItems = [],
  onConfirmItem,
  onRejectItem,
  onEditItem,
  onUpdateItem,
  isProcessing = false,
  confirmationMode = "always_ask",
  onConfirmationModeChange,
  isModeUpdating = false,
}) => {
  const PendingAwareToolFallback = (props: ComponentProps<typeof ToolFallback>) => (
    <ToolFallback
      {...props}
      pendingItems={pendingItems}
      onConfirmItem={onConfirmItem}
      onRejectItem={onRejectItem}
      onEditItem={onEditItem}
      onUpdateItem={onUpdateItem}
      isProcessing={isProcessing}
      confirmationMode={confirmationMode}
      onConfirmationModeChange={onConfirmationModeChange}
      isModeUpdating={isModeUpdating}
    />
  );

  return (
    <div
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
    </div>
  );
};

type UserMessageProps = {
  imageUrl?: string;
  fallback?: string;
};

const UserMessage: FC<UserMessageProps> = ({ imageUrl, fallback }) => {
  return (
    <div
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
    </div>
  );
};

const EditComposer: FC = () => {
  return (
    <div className="aui-edit-composer-wrapper mx-auto flex w-full max-w-(--thread-max-width) flex-col px-2 py-3">
      <ComposerPrimitive.Root className="aui-edit-composer-root ml-auto flex w-full max-w-[85%] flex-col rounded-2xl bg-muted">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input min-h-14 w-full resize-none bg-transparent p-4 text-foreground text-sm outline-none"
          autoFocus
        />
        <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center gap-2 self-end">
          <ComposerPrimitive.Cancel
            className="inline-flex h-9 items-center justify-center rounded-lg px-3.5 text-sm font-medium transition-colors hover:bg-accent/70 disabled:opacity-50"
          >
            Cancel
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-soft-md transition-colors hover:bg-primary/92 disabled:opacity-50"
          >
            Update
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </div>
  );
};
