"use client";

import { useEffect, useState, type FC } from "react";
import type { ReasoningMessagePartProps } from "@assistant-ui/react";
import { ChevronDown, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export const StreamingReasoning: FC<ReasoningMessagePartProps> = ({
  text,
  status,
}) => {
  const isStreaming = status.type === "running";
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (isStreaming) {
      setIsOpen(true);
    }
  }, [isStreaming]);

  if (!text && !isStreaming) {
    return null;
  }

  return (
    <div className="aui-reasoning-root mb-3 rounded-2xl border border-border/60 bg-muted/25">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="aui-reasoning-trigger flex w-full items-center gap-2 px-4 py-3 text-left"
        aria-expanded={isOpen}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-current/70" />
          )}
        </span>
        <span className="min-w-0 flex-1 text-[15px] font-medium leading-none text-foreground/90">
          {isStreaming ? "Streaming reasoning" : "Reasoning"}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen ? (
        <div className="aui-reasoning-body border-t border-border/50 px-4 py-3">
          <div className="aui-reasoning-copy whitespace-pre-wrap text-[14px] leading-7 text-muted-foreground">
            {text || (isStreaming ? "..." : "")}
          </div>
        </div>
      ) : null}
    </div>
  );
};
