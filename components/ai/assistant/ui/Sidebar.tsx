"use client";

/**
 * Chat Sidebar Component
 * 
 * Displays chat history in a sidebar for desktop view.
 */

import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  return (
    <aside
      className={cn(
        "hidden md:flex md:absolute md:top-4 md:left-4 md:bottom-4 z-30 w-[25.5rem] flex-col overflow-hidden rounded-4xl border border-border/70 bg-background shadow-none transition-all duration-300 ease-out",
        showHistory
          ? "translate-x-0 opacity-100"
          : "pointer-events-none -translate-x-6 opacity-0"
      )}
    >
      <div
        className={cn(
          "flex flex-col h-full transition-all duration-200 ease-out",
          showHistory ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2 pointer-events-none"
        )}
      >
        <div className="flex items-center justify-between p-5 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">{title}</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
            onClick={() => setShowHistory(false)}
            disabled={isDisabled}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close sidebar</span>
          </Button>
        </div>

        <div className="px-5 pb-5">
          <Button
            onClick={onNewChat}
            className="h-14 w-full justify-start rounded-2xl px-5 text-[1.05rem]"
            variant="outline"
            size="default"
            disabled={isDisabled}
          >
            <Plus className="mr-2 h-5 w-5" />
            {newChatLabel}
          </Button>

        </div>

        <Separator className="opacity-50" />

        <ScrollArea className="flex-1">
          {isThreadListLoading ? (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <span className="text-xs">Loading history...</span>
            </div>
          ) : hasThreads ? (
            <div className="flex flex-col gap-1.5 p-3">
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
                        : "You replied.";
                const relativeTime = formatDistanceToNow(
                  new Date(thread.lastMessageAt ?? Date.now()),
                  { addSuffix: true }
                );

                return (
                  <Button
                    key={thread.threadId}
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "h-auto w-full items-start justify-start rounded-2xl px-4 py-3.5 text-left",
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => onThreadSelect(thread.threadId)}
                    disabled={isDisabled}
                  >
                    <div className="flex w-full justify-between items-baseline gap-2">
                      <span className="truncate text-sm font-medium">{thread.title}</span>
                      <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">{relativeTime}</span>
                    </div>
                    <span className="line-clamp-1 w-full text-left text-[13px] font-normal text-muted-foreground opacity-90">
                      {preview}
                    </span>
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
    </aside>
  );
}

export default ChatSidebar;
