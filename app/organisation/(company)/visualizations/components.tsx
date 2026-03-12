"use client";

import { memo } from "react";
import type { ChatStatus } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import { Download, History, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Composer } from "@/components/ai/assistant/ui/Composer";
import { usePromptInputController } from "@/components/ai/primitives/prompt-input";

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
    <Composer
      className={className}
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

  return (
    <div className="mt-16 flex w-full max-w-4xl flex-col items-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mx-auto flex max-w-5xl snap-x snap-mandatory flex-nowrap gap-5 overflow-x-auto px-6 pb-4 no-scrollbar"
      >
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.text}
            onClick={() => textInput.setInput(suggestion.text)}
            className="group relative aspect-[5/3] min-w-[70vw] flex-shrink-0 snap-center overflow-hidden rounded-[20px] border border-[color:var(--overlay-border)] text-left shadow-lg transition-all duration-300 hover:-translate-y-1.5 hover:border-[color:var(--overlay-border-strong)] hover:shadow-2xl sm:min-w-[300px] md:min-w-[280px] lg:min-w-[260px]"
          >
            <div className="absolute inset-0 z-0">
              <img
                src={suggestion.image}
                alt=""
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            </div>

            <div className="relative z-10 flex h-full flex-col justify-end p-5">
              <p className="text-sm font-semibold leading-snug text-[var(--overlay-foreground)] drop-shadow-sm">
                {suggestion.text}
              </p>
            </div>
          </button>
        ))}
      </motion.div>
    </div>
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
    <div className="mx-auto flex min-h-full w-full max-w-2xl animate-in flex-col items-center justify-center px-4 py-12 duration-500 fade-in zoom-in-95">
      <h1 className="mb-3 text-center font-display text-4xl font-medium tracking-tight text-foreground md:text-5xl">
        Visualizations
      </h1>

      <p className="mb-12 text-center text-lg text-muted-foreground">
        Describe your <span className="font-serif italic text-foreground">vision</span>. AI brings it to{" "}
        <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text font-semibold text-transparent">
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
            className="absolute bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-[color:var(--overlay-border-soft)] bg-black/50 p-2 shadow-xl backdrop-blur-md"
            onClick={(event) => event.stopPropagation()}
          >
            <Button
              variant="ghost"
              className="h-10 rounded-lg px-6 text-[var(--overlay-foreground)] hover:bg-card/20 hover:text-[var(--overlay-foreground)]"
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
