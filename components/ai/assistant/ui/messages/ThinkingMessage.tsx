"use client";

import { Sparkles } from "lucide-react";

export const ThinkingMessage = () => {
  return (
    <div
      className="group/message fade-in mx-auto w-full max-w-[44rem] animate-in px-2 py-3 duration-200"
      data-role="assistant"
      data-testid="message-assistant-loading"
    >
      <div className="flex items-start justify-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
          <div className="animate-pulse">
            <Sparkles className="h-4 w-4" />
          </div>
        </div>

        <div className="flex w-full flex-col gap-2">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted/60">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/80 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
};
