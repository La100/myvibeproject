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
        "hidden shrink-0 flex-col border-l border-border/50 overflow-hidden transition-[width] duration-300 ease-out md:flex md:sticky md:self-start md:top-4 md:h-full",
        showHistory ? "w-80" : "w-0"
      )}
    >
      <div
        className={cn(
          "flex flex-col h-full transition-all duration-200 ease-out",
          showHistory ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
        )}
      >
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">{title}</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setShowHistory(false)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close sidebar</span>
          </Button>
        </div>

        <div className="px-4 pb-4">
          <Button
            onClick={onNewChat}
            className="w-full justify-start pl-3"
            variant="outline"
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
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
            <div className="flex flex-col p-2 gap-1">
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
                      "w-full justify-start h-auto py-3 px-3 flex-col items-start gap-1",
                      isActive ? "bg-secondary" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => onThreadSelect(thread.threadId)}
                  >
                    <div className="flex w-full justify-between items-baseline gap-2">
                      <span className="font-medium text-sm truncate">{thread.title}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">{relativeTime}</span>
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-1 text-left w-full font-normal opacity-90">
                      {preview}
                    </span>
                  </Button>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="bg-muted/50 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">{emptyStateTitle}</p>
              <p className="text-xs text-muted-foreground mt-1">{emptyStateDescription}</p>
            </div>
          )}
        </ScrollArea>
      </div>
    </aside>
  );
}

export default ChatSidebar;
