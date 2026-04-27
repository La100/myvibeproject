"use client";

import { memo } from "react";
import type { ChatStatus } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import { Download, History, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Composer } from "@/components/ai/assistant/ui/Composer";
import { usePromptInputController } from "@/components/ai/primitives/prompt-input";
import { cn } from "@/lib/utils";

import {
  VISUALIZATION_MAX_FILES,
  VISUALIZATION_MAX_FILE_SIZE,
  VISUALIZATION_PLACEHOLDER,
} from "./constants";
import type {
  VisualizationComposerPayload,
  VisualizationLightboxState,
  VisualizationSession,
  VisualizationSuggestion,
} from "./types";

type VisualizationComposerProps = {
  submitStatus: ChatStatus;
  onSubmit: (payload: VisualizationComposerPayload) => Promise<void> | void;
  onStopResponse: () => void;
  isUploading: boolean;
  disabled: boolean;
  className?: string;
};

export const VisualizationComposer = memo(function VisualizationComposer({
  submitStatus,
  onSubmit,
  onStopResponse,
  isUploading,
  disabled,
  className,
}: VisualizationComposerProps) {
  return (
    <div data-visualization-composer>
      <Composer
        className={[
          "max-w-[58rem] [&_[data-slot=input-group]]:border-border [&_[data-slot=input-group]]:bg-white [&_[data-slot=input-group]]:shadow-sm [&_textarea]:bg-transparent [&_textarea]:text-foreground [&_textarea]:placeholder:text-muted-foreground",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        submitStatus={submitStatus}
        onSubmit={onSubmit}
        onStopResponse={onStopResponse}
        placeholder={VISUALIZATION_PLACEHOLDER}
        accept="image/*"
        maxFiles={VISUALIZATION_MAX_FILES}
        maxFileSize={VISUALIZATION_MAX_FILE_SIZE}
        isUploading={isUploading}
        disabled={disabled}
      />
    </div>
  );
});

export const VisualizationHeader = memo(function VisualizationHeader({
  currentSession,
  showHistory,
  onToggleHistory,
}: {
  currentSession: VisualizationSession | null | undefined;
  showHistory: boolean;
  onToggleHistory: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 p-4">
      <div className="flex min-w-0 items-center gap-2">
        {currentSession && (
          <>
            <h2 className="max-w-[300px] truncate font-medium">
              {currentSession.title || "New visualization"}
            </h2>
            <Badge variant="secondary" className="text-xs">
              {currentSession.imageCount} image{currentSession.imageCount !== 1 ? "s" : ""}
            </Badge>
          </>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleHistory}
        className="h-8 w-8"
        title={showHistory ? "Hide history" : "Show history"}
      >
        <History className="h-4 w-4" />
      </Button>
    </div>
  );
});

export const VisualizationSuggestions = memo(function VisualizationSuggestions({
  suggestions,
}: {
  suggestions: VisualizationSuggestion[];
}) {
  const { textInput } = usePromptInputController();
  const handleSuggestionClick = (prompt: string) => {
    textInput.setInput(prompt);

    window.requestAnimationFrame(() => {
      const composer = document.querySelector("[data-visualization-composer]");
      const textarea = composer?.querySelector("textarea");

      composer?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (textarea instanceof HTMLTextAreaElement) {
        textarea.focus();
        const length = textarea.value.length;
        textarea.setSelectionRange(length, length);
      }
    });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="mt-12 w-full max-w-[72rem]"
    >
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Prompt Ideas
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Pick a direction to prefill the prompt and start from a stronger base.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:auto-rows-[180px] xl:grid-cols-[minmax(0,1.55fr)_minmax(380px,1fr)] xl:auto-rows-[205px]">
        {suggestions.map((suggestion, index) => {
          const isFeatured = index === 0 || index === 3;

          return (
            <button
              key={suggestion.title}
              onClick={() => handleSuggestionClick(suggestion.text)}
              className={cn(
                "group relative w-full overflow-hidden rounded-3xl border border-border/70 bg-card text-left shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-border hover:shadow-xl",
                isFeatured
                  ? "min-h-[260px] sm:col-span-2 sm:row-span-2 sm:min-h-0 xl:col-span-1"
                  : "min-h-[220px] sm:min-h-0"
              )}
            >
              <div className="absolute inset-0 z-0">
                <img
                  src={suggestion.image}
                  alt={suggestion.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/78 via-black/30 via-40% to-black/18" />
              </div>

              <div className="relative z-10 flex h-full items-end p-4 sm:p-5">
                <div className={cn(
                  "rounded-2xl border border-white/12 bg-black/42 backdrop-blur-md",
                  isFeatured ? "max-w-[28rem] p-5" : "max-w-[18rem] p-3.5 xl:max-w-[16rem]"
                )}>
                  <p className={cn(
                    "font-semibold leading-tight text-white drop-shadow-md",
                    isFeatured ? "text-lg sm:text-[1.35rem]" : "text-base"
                  )}>
                    {suggestion.title}
                  </p>
                  <p className={cn(
                    "mt-2 text-sm leading-snug text-white/85 drop-shadow-sm",
                    isFeatured ? "line-clamp-3" : "line-clamp-2"
                  )}>
                    {suggestion.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </motion.section>
  );
});

export const VisualizationEmptyState = memo(function VisualizationEmptyState({
  submitStatus,
  onSubmit,
  onStopResponse,
  isUploading,
  disabled,
  suggestions,
}: VisualizationComposerProps & { suggestions: VisualizationSuggestion[] }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-[96rem] animate-in flex-col items-center justify-center px-4 py-12 duration-500 fade-in zoom-in-95 md:px-6 xl:px-8">
      <h1 className="mb-3 text-center font-display text-4xl font-medium tracking-tight text-foreground md:text-5xl">
        Visualizations
      </h1>

      <p className="mb-12 text-center text-lg text-muted-foreground">
        Describe your <span className="font-serif italic text-foreground">vision</span>. AI brings it to{" "}
        <span className="font-semibold text-primary">
          life
        </span>
        .
      </p>

      <VisualizationComposer
        submitStatus={submitStatus}
        onSubmit={onSubmit}
        onStopResponse={onStopResponse}
        isUploading={isUploading}
        disabled={disabled}
      />

      <VisualizationSuggestions suggestions={suggestions} />
    </div>
  );
});

export const VisualizationLightbox = memo(function VisualizationLightbox({
  selectedLightbox,
  onClose,
  onDownload,
}: {
  selectedLightbox: VisualizationLightboxState | null;
  onClose: () => void;
  onDownload: (url: string) => Promise<void> | void;
}) {
  return (
    <AnimatePresence>
      {selectedLightbox && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-background/95 p-8 backdrop-blur-xl"
          onClick={onClose}
        >
          <div className="absolute right-4 top-4 z-50">
            <Button
              variant="secondary"
              size="icon"
              className="h-12 w-12 rounded-full shadow-lg"
              onClick={onClose}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>

          <motion.div
            className="relative flex h-full w-full items-center justify-center"
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
          >
            <img
              src={selectedLightbox.url}
              alt={selectedLightbox.prompt}
              className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
              onClick={(event) => event.stopPropagation()}
              loading="eager"
              decoding="async"
            />
          </motion.div>

          <div
            className="absolute bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border/70 bg-background/70 p-2 shadow-xl backdrop-blur-md"
            onClick={(event) => event.stopPropagation()}
          >
            <Button
              variant="ghost"
              className="h-10 rounded-lg px-6 text-foreground hover:bg-muted hover:text-foreground"
              onClick={() => onDownload(selectedLightbox.url)}
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
