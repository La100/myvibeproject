"use client";

/**
 * Chat Sidebar Component
 * 
 * Displays chat history in a sidebar for desktop view.
 */

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  Loader2,
  X,
  MessageSquare,
  Plus,
} from "lucide-react";

export interface ThreadListItem {
  threadId: string;
  title: string;
  lastMessageAt?: number;
  lastMessagePreview?: string;
  lastMessageRole?: "user" | "assistant";
  messageCount?: number;
  imageCount?: number;
}

interface ChatSidebarProps {
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
  isDisabled?: boolean;
  isThreadListLoading: boolean;
  hasThreads: boolean;
  threadList: ThreadListItem[];
  currentThreadId?: string;
  onThreadSelect: (threadId: string) => void;
  onNewChat: () => void;
  title?: string;
  newChatLabel?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
}

function ChatSidebarBody({
  isDisabled,
  isThreadListLoading,
  hasThreads,
  threadList,
  currentThreadId,
  onThreadSelect,
  onNewChat,
  onClose,
  title,
  newChatLabel,
  emptyStateTitle,
  emptyStateDescription,
  className,
  hideInlineClose = false,
}: Omit<ChatSidebarProps, "showHistory" | "setShowHistory"> & {
  onClose: () => void;
  className?: string;
  hideInlineClose?: boolean;
}) {
  return (
    <div className={cn("flex h-full flex-col", className)}>
        <div className="border-b border-border/60 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
            </div>
            {!hideInlineClose && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-2xl text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                onClick={onClose}
                disabled={isDisabled}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close sidebar</span>
              </Button>
            )}
          </div>
        </div>

        <div className="border-b border-border/50 px-5 py-4">
          <Button
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="h-14 w-full justify-start rounded-2xl border-border/80 bg-background px-5 text-[1.05rem] shadow-sm hover:bg-muted/50"
            variant="outline"
            size="default"
            disabled={isDisabled}
          >
            <Plus className="mr-2 h-5 w-5" />
            {newChatLabel}
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {isThreadListLoading ? (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <span className="text-xs">Loading history...</span>
            </div>
          ) : hasThreads ? (
            <div className="flex flex-col gap-2 p-3">
              {threadList.map((thread) => {
                const isActive = thread.threadId === currentThreadId;
                const previewRaw = (thread.lastMessagePreview ?? "").replace(/\s+/g, " ").trim();
                const preview =
                  previewRaw.length > 0
                    ? previewRaw
                    : thread.messageCount === 0
                      ? "No messages yet."
                      : thread.lastMessageRole === "assistant"
                        ? "Assistant replied."
                        : thread.lastMessageRole === "user"
                          ? "You replied."
                          : "";
                const relativeTime = formatDistanceToNow(
                  new Date(thread.lastMessageAt ?? Date.now()),
                  { addSuffix: true }
                );

                return (
                  <Button
                    key={thread.threadId}
                    variant="ghost"
                    className={cn(
                      "h-auto w-full flex-col items-start justify-start rounded-3xl border px-4 py-4 text-left transition-colors",
                      isActive
                        ? "border-border bg-background text-foreground shadow-sm ring-1 ring-border/40"
                        : "border-border/70 bg-muted/40 text-foreground hover:border-border hover:bg-muted/65 hover:text-foreground"
                    )}
                    onClick={() => {
                      onThreadSelect(thread.threadId);
                      onClose();
                    }}
                    disabled={isDisabled}
                  >
                    <div className="flex w-full items-start justify-between gap-3">
                      <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                        {thread.title}
                      </span>
                      <span className="shrink-0 whitespace-nowrap rounded-full bg-muted px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        {relativeTime}
                      </span>
                    </div>

                    {preview && preview !== `${thread.imageCount ?? 0} image${(thread.imageCount ?? 0) !== 1 ? "s" : ""}` && (
                      <span
                        className={cn(
                          "mt-2 line-clamp-2 w-full text-left text-[13px] leading-relaxed",
                          isActive ? "text-foreground/75" : "text-muted-foreground"
                        )}
                      >
                        {preview}
                      </span>
                    )}

                    <div className="mt-3 flex w-full flex-wrap items-center gap-2">
                      {typeof thread.imageCount === "number" && (
                        <span className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-foreground/80">
                          {thread.imageCount} image{thread.imageCount !== 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-foreground/80">
                        {thread.messageCount ?? 0} message
                        {(thread.messageCount ?? 0) !== 1 ? "s" : ""}
                      </span>
                      {isActive && (
                        <span className="rounded-full border border-border bg-foreground/[0.05] px-2.5 py-1 text-[11px] font-medium text-foreground/75">
                          Current
                        </span>
                      )}
                    </div>
                  </Button>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">{emptyStateTitle}</p>
              <p className="mt-1 text-xs text-muted-foreground">{emptyStateDescription}</p>
            </div>
          )}
        </ScrollArea>
    </div>
  );
}

export function ChatSidebar({
  showHistory,
  setShowHistory,
  isDisabled = false,
  isThreadListLoading,
  hasThreads,
  threadList,
  currentThreadId,
  onThreadSelect,
  onNewChat,
  title = "Project chats",
  newChatLabel = "New Chat",
  emptyStateTitle = "No chats yet",
  emptyStateDescription = "Start a new conversation to get help with your project.",
}: ChatSidebarProps) {
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => setIsMobileViewport(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);

    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  const sharedProps = {
    isDisabled,
    isThreadListLoading,
    hasThreads,
    threadList,
    currentThreadId,
    onThreadSelect,
    onNewChat,
    title,
    newChatLabel,
    emptyStateTitle,
    emptyStateDescription,
  };

  return (
    <>
      {isMobileViewport && (
        <Sheet open={showHistory} onOpenChange={setShowHistory}>
          <SheetContent
            side="right"
            className="w-[min(92vw,26rem)] border-l border-border/80 bg-background p-0"
          >
            <SheetTitle className="sr-only">{title}</SheetTitle>
            <ChatSidebarBody
              {...sharedProps}
              onClose={() => setShowHistory(false)}
              hideInlineClose
            />
          </SheetContent>
        </Sheet>
      )}

      <aside
        className={cn(
          "hidden md:absolute md:top-4 md:right-4 md:bottom-4 md:flex z-30 w-[25.5rem] flex-col overflow-hidden rounded-4xl border border-border/80 bg-background/95 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/88 transition-all duration-300 ease-out",
          showHistory
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-6 opacity-0"
        )}
      >
        <div
          className={cn(
            "flex flex-col h-full transition-all duration-200 ease-out",
            showHistory ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2 pointer-events-none"
          )}
        >
          <ChatSidebarBody
            {...sharedProps}
            onClose={() => setShowHistory(false)}
          />
        </div>
      </aside>
    </>
  );
}

export default ChatSidebar;
