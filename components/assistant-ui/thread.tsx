import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/assistant-ui/attachment";
import {
  ASSISTANT_AT_COMMANDS,
  QUICK_PROMPTS,
} from "@/components/ai/assistant/config";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { StreamingReasoning } from "@/components/assistant-ui/reasoning";
import { ToolFallback } from "@/components/assistant-ui/tool-fallback";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import {
  AuiIf,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAssistantApi,
  useAuiState,
} from "@assistant-ui/react";
import { ArrowDownIcon, ArrowUpIcon, Loader2, Sparkles, SquareIcon } from "lucide-react";
import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentProps,
  type FC,
  type KeyboardEvent,
  type ReactNode,
} from "react";

type ThreadProps = {
  showWelcome?: boolean;
  assistantImageUrl?: string;
  assistantFallback?: string;
  userImageUrl?: string;
  userFallback?: string;
  inputDisabled?: boolean;
  inputPlaceholder?: string;
  composerBanner?: ReactNode;
  onRespondToToolApproval?: (args: {
    approvalId: string;
    approved: boolean;
    toolCallId: string;
    reason?: string;
  }) => Promise<void>;
  confirmationMode?: "always_ask" | "auto_confirm";
  onConfirmationModeChange?: (mode: "always_ask" | "auto_confirm") => void | Promise<void>;
  isModeUpdating?: boolean;
};

type PendingInteractionContextValue = {
  onRespondToToolApproval?: (args: {
    approvalId: string;
    approved: boolean;
    toolCallId: string;
    reason?: string;
  }) => Promise<void>;
  confirmationMode: "always_ask" | "auto_confirm";
  onConfirmationModeChange?: (mode: "always_ask" | "auto_confirm") => void | Promise<void>;
  isModeUpdating: boolean;
};

const PendingInteractionContext = createContext<PendingInteractionContextValue | null>(null);

const WELCOME_SUGGESTIONS = QUICK_PROMPTS.slice(0, 2).map((item, index) => ({
  prompt: item.prompt,
  title: item.label,
  description:
    index === 0
      ? "Create a renovation roadmap with clear stages."
      : "Build a starter material list for the project.",
}));

export const Thread: FC<ThreadProps> = ({
  showWelcome = true,
  inputDisabled = false,
  inputPlaceholder,
  composerBanner,
  onRespondToToolApproval,
  confirmationMode = "always_ask",
  onConfirmationModeChange,
  isModeUpdating = false,
}) => {
  const pendingInteractionValue = useMemo<PendingInteractionContextValue>(
    () => ({
      onRespondToToolApproval,
      confirmationMode,
      onConfirmationModeChange,
      isModeUpdating,
    }),
    [
      confirmationMode,
      isModeUpdating,
      onRespondToToolApproval,
      onConfirmationModeChange,
    ],
  );

  return (
    <PendingInteractionContext.Provider value={pendingInteractionValue}>
      <ThreadPrimitive.Root
        className="aui-root aui-thread-root @container flex h-full min-h-0 w-full flex-col bg-background"
        style={{
          ["--thread-max-width" as string]: "72rem",
        }}
      >
        <ThreadPrimitive.Viewport
          turnAnchor="top"
          className="aui-thread-viewport relative flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth px-4 pt-5 md:px-6 md:pt-5"
        >
          <AuiIf condition={({ thread }) => showWelcome && thread.isEmpty}>
            <ThreadWelcome />
          </AuiIf>

          <ThreadPrimitive.Messages components={THREAD_MESSAGE_COMPONENTS} />

          <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer sticky bottom-0 mx-auto mt-auto flex w-full max-w-(--thread-max-width) flex-col gap-5 overflow-visible bg-background pb-5 md:pb-7">
            <ThreadScrollToBottom />
            {composerBanner}
            <Composer
              inputDisabled={inputDisabled}
              inputPlaceholder={inputPlaceholder}
              confirmationMode={confirmationMode}
              onConfirmationModeChange={onConfirmationModeChange}
              isModeUpdating={isModeUpdating}
            />
          </ThreadPrimitive.ViewportFooter>
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
    </PendingInteractionContext.Provider>
  );
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="aui-thread-scroll-to-bottom absolute -top-14 z-10 self-center rounded-full p-4 disabled:invisible"
      >
        <ArrowDownIcon className="size-4" />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <div className="aui-thread-welcome-root mx-auto my-auto flex w-full max-w-[72rem] grow flex-col justify-end gap-7 pb-5">
      <div className="aui-thread-welcome-center flex w-full grow flex-col justify-center px-2 md:px-4">
        <div className="aui-thread-welcome-message mx-auto flex w-full max-w-[26rem] flex-col justify-center gap-2 text-center">
          <h1 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both font-semibold text-4xl tracking-tight duration-200 sm:text-5xl">
            Hello there!
          </h1>
          <p className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in text-2xl text-muted-foreground delay-75 duration-200 sm:text-[2.1rem] sm:leading-[1.15]">
            How can I help you today?
          </p>
        </div>
      </div>
      <ThreadSuggestions />
    </div>
  );
};

const ThreadSuggestions: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestions mx-auto grid w-full max-w-[72rem] gap-3 px-2 md:grid-cols-2 md:px-4">
      {WELCOME_SUGGESTIONS.map((suggestion, index) => (
        <ThreadPrimitive.Suggestion
          key={`${suggestion.title}-${index}`}
          prompt={suggestion.prompt}
          className="aui-thread-welcome-suggestion fade-in slide-in-from-bottom-2 animate-in fill-mode-both inline-flex min-h-28 w-full flex-col items-start justify-center gap-1.5 rounded-[2rem] border border-border/80 bg-background px-7 py-5 text-left transition-all hover:border-border hover:bg-muted/30"
          style={{ animationDelay: `${index * 75}ms` }}
        >
          <span className="aui-thread-welcome-suggestion-text-1 text-[1.05rem] font-semibold tracking-tight text-foreground">
            {suggestion.title}
          </span>
          <span className="aui-thread-welcome-suggestion-text-2 text-[0.95rem] leading-relaxed text-muted-foreground">
            {suggestion.description}
          </span>
        </ThreadPrimitive.Suggestion>
      ))}
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
    inputPlaceholder ?? "Send a message...";

  return (
    <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
      <ComposerPrimitive.AttachmentDropzone className="aui-composer-attachment-dropzone flex w-full flex-col rounded-[2rem] border border-border/80 bg-background px-3 pt-3 shadow-none outline-none transition-shadow has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-ring/20 data-[dragging=true]:border-ring data-[dragging=true]:border-dashed data-[dragging=true]:bg-accent/40">
        <ComposerAttachments />
        <ComposerInputWithCommands
          inputDisabled={inputDisabled}
          placeholder={resolvedPlaceholder}
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

type MentionMatch = {
  start: number;
  end: number;
  query: string;
};

const getMentionMatch = (value: string, cursor: number): MentionMatch | null => {
  const textBeforeCursor = value.slice(0, cursor);
  const match = textBeforeCursor.match(/(^|\s)@([a-z-]*)$/i);
  if (!match) return null;

  const query = match[2] ?? "";
  return {
    start: cursor - query.length - 1,
    end: cursor,
    query,
  };
};

const ComposerInputWithCommands: FC<{
  inputDisabled?: boolean;
  placeholder: string;
}> = ({ inputDisabled = false, placeholder }) => {
  const assistant = useAssistantApi();
  const composerText = useAuiState((s) =>
    s.composer.isEditing ? s.composer.text : "",
  );
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [mentionMatch, setMentionMatch] = useState<MentionMatch | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredCommands = useMemo(() => {
    if (!mentionMatch) return [];

    const query = mentionMatch.query.trim().toLowerCase();
    if (!query) return [...ASSISTANT_AT_COMMANDS];

    return ASSISTANT_AT_COMMANDS.filter((command) =>
      [command.id, command.label, command.description].some((field) =>
        field.toLowerCase().includes(query),
      ),
    );
  }, [mentionMatch]);

  useEffect(() => {
    setActiveIndex(0);
  }, [mentionMatch?.query]);

  const updateMention = (value: string, cursor: number | null | undefined) => {
    if (cursor === null || cursor === undefined) {
      setMentionMatch(null);
      return;
    }

    setMentionMatch(getMentionMatch(value, cursor));
  };

  const applyCommand = (commandId: (typeof ASSISTANT_AT_COMMANDS)[number]["id"]) => {
    if (!mentionMatch) return;

    const nextText =
      `${composerText.slice(0, mentionMatch.start)}@${commandId} ` +
      composerText.slice(mentionMatch.end);

    assistant.composer().setText(nextText);
    setMentionMatch(null);

    requestAnimationFrame(() => {
      const nextCursor = mentionMatch.start + commandId.length + 2;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    updateMention(event.target.value, event.target.selectionStart);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (filteredCommands.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % filteredCommands.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current === 0 ? filteredCommands.length - 1 : current - 1,
      );
      return;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      applyCommand(filteredCommands[activeIndex]?.id ?? filteredCommands[0].id);
      return;
    }

    if (event.key === "Escape") {
      setMentionMatch(null);
    }
  };

  return (
    <div className="relative">
      {filteredCommands.length > 0 ? (
        <div className="absolute inset-x-3 bottom-full z-20 mb-2 overflow-hidden rounded-2xl border border-border/80 bg-background shadow-lg">
          <div className="border-b border-border/70 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Assistant actions
          </div>
          <div className="p-2">
            {filteredCommands.map((command, index) => (
              <button
                key={command.id}
                type="button"
                className={`flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                  index === activeIndex ? "bg-muted" : "hover:bg-muted/70"
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyCommand(command.id)}
              >
                <span className="min-w-[9rem] text-sm font-medium text-foreground">
                  @{command.id}
                </span>
                <span className="text-sm text-muted-foreground">
                  {command.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <ComposerPrimitive.Input
        id="assistant-chat-input"
        ref={inputRef}
        placeholder={placeholder}
        className="aui-composer-input min-h-[6.75rem] w-full resize-none bg-transparent px-5 pt-4 pb-3 text-lg text-foreground caret-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-0"
        rows={3}
        autoFocus
        aria-label="Message input"
        disabled={inputDisabled}
        onChange={handleChange}
        onClick={(event) => {
          updateMention(event.currentTarget.value, event.currentTarget.selectionStart);
        }}
        onKeyUp={(event) => {
          updateMention(event.currentTarget.value, event.currentTarget.selectionStart);
        }}
        onKeyDown={handleKeyDown}
      />
    </div>
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
  const isAutoMode = confirmationMode === "auto_confirm";

  return (
    <div className="aui-composer-action-wrapper relative mx-2 mb-2 flex items-center justify-between md:mx-3 md:mb-3">
      <div className="flex items-center gap-2">
        <ComposerAddAttachment disabled={inputDisabled} />
        {onConfirmationModeChange ? (
          <button
            type="button"
            className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${
              isAutoMode
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
            onClick={() =>
              void onConfirmationModeChange(
                isAutoMode ? "always_ask" : "auto_confirm",
              )
            }
            disabled={inputDisabled || isModeUpdating}
            aria-pressed={isAutoMode}
            aria-label={isAutoMode ? "Disable auto mode" : "Enable auto mode"}
            title={isAutoMode ? "Disable auto mode" : "Enable auto mode"}
          >
            {isModeUpdating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            <span>Auto mode {isAutoMode ? "On" : "Off"}</span>
          </button>
        ) : null}
      </div>
      <AuiIf condition={({ thread }) => !thread.isRunning}>
        <ComposerPrimitive.Send
          type="submit"
          className="aui-composer-send inline-flex size-11 items-center justify-center rounded-full bg-foreground/40 text-background transition-colors hover:bg-foreground/55 disabled:opacity-50"
          aria-label="Send message"
          title="Send message"
          disabled={inputDisabled}
        >
          <ArrowUpIcon className="aui-composer-send-icon size-5" />
          <span className="sr-only">Send message</span>
        </ComposerPrimitive.Send>
      </AuiIf>
      <AuiIf condition={({ thread }) => thread.isRunning}>
        <ComposerPrimitive.Cancel
          type="button"
          className="aui-composer-cancel inline-flex size-11 items-center justify-center rounded-full bg-foreground/40 text-background transition-colors hover:bg-foreground/55 disabled:opacity-50"
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
      <ErrorPrimitive.Root className="aui-message-error-root mt-3 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

const PendingAwareToolFallback: FC<ComponentProps<typeof ToolFallback>> = (props) => {
  const context = useContext(PendingInteractionContext);
  if (!context) {
    return <ToolFallback {...props} />;
  }

  return (
    <ToolFallback
      {...props}
      onRespondToToolApproval={context.onRespondToToolApproval}
      confirmationMode={context.confirmationMode}
      onConfirmationModeChange={context.onConfirmationModeChange}
      isModeUpdating={context.isModeUpdating}
    />
  );
};

const AssistantMessage: FC = () => {
  const toolComponents = useMemo(
    () => ({
      Text: MarkdownText,
      Reasoning: StreamingReasoning,
      tools: { Fallback: PendingAwareToolFallback },
    }),
    [],
  );

  return (
    <div
      className="aui-assistant-message-root mx-auto flex w-full max-w-(--thread-max-width) flex-col px-2 py-4"
      data-role="assistant"
    >
      <div className="aui-assistant-message-content min-w-0 break-words text-[15px] leading-7 text-foreground">
        <MessagePrimitive.Parts components={toolComponents} />
      </div>
      <MessageError />
    </div>
  );
};

const UserMessage: FC = () => {
  return (
    <div
      className="aui-user-message-root mx-auto grid w-full max-w-(--thread-max-width) auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 py-4"
      data-role="user"
    >
      <UserMessageAttachments />

      <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
        <div className="aui-user-message-content break-words rounded-[1.75rem] bg-muted px-4 py-3 text-[15px] leading-6 text-foreground">
          <MessagePrimitive.Parts />
        </div>
      </div>
    </div>
  );
};

const EditComposer: FC = () => {
  return (
    <div className="aui-edit-composer-wrapper mx-auto flex w-full max-w-(--thread-max-width) flex-col px-2 py-4">
      <ComposerPrimitive.Root className="aui-edit-composer-root ml-auto flex w-full max-w-[85%] flex-col rounded-[1.75rem] border border-border/70 bg-background shadow-sm">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input min-h-14 w-full resize-none bg-transparent p-4 text-sm text-foreground outline-none"
          autoFocus
        />
        <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center gap-2 self-end">
          <ComposerPrimitive.Cancel className="inline-flex h-9 items-center justify-center rounded-lg px-3.5 text-sm font-medium transition-colors hover:bg-accent/70 disabled:opacity-50">
            Cancel
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-soft-md transition-colors hover:bg-primary/92 disabled:opacity-50">
            Update
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </div>
  );
};

const THREAD_MESSAGE_COMPONENTS = {
  UserMessage,
  EditComposer,
  AssistantMessage,
};
