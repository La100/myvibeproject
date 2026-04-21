"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { ChatStatus } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Download, History, X } from "lucide-react";

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
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScroll, setCanScroll] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) {
      return;
    }

    const updateScrollState = () => {
      const hasOverflow = element.scrollWidth > element.clientWidth + 16;
      setCanScroll(hasOverflow);
      setShowScrollHint(hasOverflow && element.scrollLeft < 24);
    };

    updateScrollState();

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(element);
    window.addEventListener("resize", updateScrollState);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateScrollState);
    };
  }, [suggestions.length]);

  return (
    <div className="mt-16 flex w-full max-w-[96rem] flex-col items-center">
      <AnimatePresence>
        {canScroll && showScrollHint ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-4 flex items-center gap-2 rounded-full border border-border/60 bg-background/90 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground shadow-sm backdrop-blur-sm"
          >
            <span>Swipe or scroll to explore prompts</span>
            <motion.span
              animate={{ x: [0, 5, 0] }}
              transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </motion.span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="relative w-full">
        <AnimatePresence>
          {canScroll && showScrollHint ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-y-0 right-0 z-20 hidden w-24 items-center justify-end bg-gradient-to-l from-background via-background/85 to-transparent pr-3 md:flex"
            >
              <motion.div
                animate={{ x: [0, 6, 0] }}
                transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                className="rounded-full border border-border/60 bg-background/90 p-2 text-muted-foreground shadow-md backdrop-blur-sm"
              >
                <ArrowRight className="h-4 w-4" />
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          ref={scrollerRef}
          onScroll={(event) => {
            const target = event.currentTarget;
            if (target.scrollLeft > 24) {
              setShowScrollHint(false);
            }
          }}
          className="mx-auto flex w-full snap-x snap-mandatory flex-nowrap gap-5 overflow-x-auto px-0 pb-4 no-scrollbar md:px-2"
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.title}
              onClick={() => textInput.setInput(suggestion.text)}
              className="group relative aspect-[5/3] min-w-[70vw] flex-shrink-0 snap-center overflow-hidden rounded-2xl border border-border/70 bg-card text-left shadow-lg transition-all duration-300 hover:-translate-y-1.5 hover:border-border hover:shadow-xl sm:min-w-[320px] md:min-w-[360px] lg:min-w-[420px]"
            >
              <div className="absolute inset-0 z-0">
                <img
                  src={suggestion.image}
                  alt={suggestion.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/78 via-black/28 via-38% to-transparent" />
              </div>

              <div className="relative z-10 flex h-full flex-col justify-start p-5">
                <div className="max-w-[85%] rounded-2xl border border-white/12 bg-black/42 p-4 backdrop-blur-md">
                  <p className="text-base font-semibold leading-tight text-white drop-shadow-md">
                    {suggestion.title}
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm leading-snug text-white/85 drop-shadow-sm">
                    {suggestion.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </motion.div>
      </div>
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
        className="max-w-[58rem]"
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
