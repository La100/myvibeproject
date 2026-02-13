"use client";

/**
 * Suggested Actions Component (Vercel AI Chatbot Style)
 *
 * Displays suggested prompt cards that animate in on empty state.
 */

import { motion } from "framer-motion";
import { memo } from "react";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

type SuggestedActionsProps = {
  onSuggestionClick: (suggestion: string) => void;
  suggestions?: Array<{ label: string; prompt: string }>;
};

const DEFAULT_SUGGESTIONS = [
  {
    label: "Plan tasks",
    prompt: "Help me plan the architectural project tasks for this week",
  },
  {
    label: "Generate estimate",
    prompt: "Create a cost estimate for a kitchen architecture scope",
  },
  {
    label: "Shopping list",
    prompt: "Generate a shopping list for bathroom materials",
  },
  {
    label: "Timeline",
    prompt: "Create a project timeline with milestones",
  },
];

function PureSuggestedActions({
  onSuggestionClick,
  suggestions = DEFAULT_SUGGESTIONS,
}: SuggestedActionsProps) {
  return (
    <div className="grid w-full gap-2 sm:grid-cols-2">
      {suggestions.map((suggestion, index) => (
        <motion.div
          key={suggestion.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
        >
          <button
            onClick={() => onSuggestionClick(suggestion.prompt)}
            className={cn(
              "h-auto w-full whitespace-normal p-4 text-left",
              "rounded-xl border border-border/40 bg-card/40",
              "hover:bg-card hover:border-primary/20",
              "transition-all duration-200 group/item shadow-sm"
            )}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary/70 group-hover/item:text-primary transition-colors" />
              <span className="font-medium text-sm text-foreground/80 group-hover/item:text-foreground">
                {suggestion.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 group-hover/item:text-foreground/70">
              {suggestion.prompt}
            </p>
          </button>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(PureSuggestedActions);
