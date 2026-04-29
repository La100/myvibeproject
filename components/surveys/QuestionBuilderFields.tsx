"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type RatingScaleValue = {
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
};

export type SurveyQuestionType =
  | "text_short"
  | "text_long"
  | "multiple_choice"
  | "single_choice"
  | "rating"
  | "yes_no"
  | "number"
  | "file";

export type SurveyQuestionBuilderFields = {
  options: string[];
  ratingMin: number;
  ratingMax: number;
  ratingMinLabel: string;
  ratingMaxLabel: string;
};

export const surveyQuestionTypes: Array<{
  value: SurveyQuestionType;
  label: string;
}> = [
  { value: "text_short", label: "Short Text" },
  { value: "text_long", label: "Long Text" },
  { value: "single_choice", label: "Single Choice" },
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "rating", label: "Rating Scale" },
  { value: "yes_no", label: "Yes/No" },
  { value: "number", label: "Number" },
  { value: "file", label: "File Upload" },
];

export function normalizeChoiceOptions(options: string[]) {
  return options.map((option) => option.trim()).filter(Boolean);
}

export function createDefaultOptions() {
  return ["", ""];
}

export function createDefaultQuestionBuilderFields(): SurveyQuestionBuilderFields {
  return {
    options: createDefaultOptions(),
    ratingMin: 1,
    ratingMax: 5,
    ratingMinLabel: "",
    ratingMaxLabel: "",
  };
}

export function usesChoiceOptions(questionType: SurveyQuestionType) {
  return questionType === "single_choice" || questionType === "multiple_choice";
}

export function usesRatingScale(questionType: SurveyQuestionType) {
  return questionType === "rating";
}

type ChoiceOptionsEditorProps = {
  options: string[];
  onChange: (options: string[]) => void;
};

export function ChoiceOptionsEditor({
  options,
  onChange,
}: ChoiceOptionsEditorProps) {
  const rows = options.length >= 2 ? options : createDefaultOptions();

  const updateOption = (index: number, value: string) => {
    onChange(
      rows.map((option, optionIndex) =>
        optionIndex === index ? value : option,
      ),
    );
  };

  const removeOption = (index: number) => {
    if (rows.length <= 2) return;
    onChange(rows.filter((_, optionIndex) => optionIndex !== index));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-semibold">Options</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...rows, ""])}
        >
          <Plus data-icon="inline-start" />
          Add option
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={option}
              onChange={(event) => updateOption(index, event.target.value)}
              placeholder={`Option ${index + 1}`}
              className="h-11 text-base"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={rows.length <= 2}
              onClick={() => removeOption(index)}
              aria-label={`Remove option ${index + 1}`}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

type RatingScaleEditorProps = {
  value: RatingScaleValue;
  onChange: (value: RatingScaleValue) => void;
};

export function RatingScaleEditor({ value, onChange }: RatingScaleEditorProps) {
  const min = Number.isFinite(value.min) ? value.min : 1;
  const max = Number.isFinite(value.max) ? value.max : 5;
  const previewMin = Math.min(min, max);
  const previewMax = Math.max(min, max);
  const previewValues = Array.from(
    { length: Math.min(previewMax - previewMin + 1, 10) },
    (_, index) => previewMin + index,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-semibold">Scale start</Label>
          <Input
            type="number"
            value={value.min}
            onChange={(event) =>
              onChange({ ...value, min: Number(event.target.value) })
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-semibold">Scale end</Label>
          <Input
            type="number"
            value={value.max}
            onChange={(event) =>
              onChange({ ...value, max: Number(event.target.value) })
            }
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-semibold">Start label</Label>
          <Input
            value={value.minLabel}
            onChange={(event) =>
              onChange({ ...value, minLabel: event.target.value })
            }
            placeholder="Not important"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-semibold">End label</Label>
          <Input
            value={value.maxLabel}
            onChange={(event) =>
              onChange({ ...value, maxLabel: event.target.value })
            }
            placeholder="Very important"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{value.minLabel.trim() || previewMin}</span>
          <span>{value.maxLabel.trim() || previewMax}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {previewValues.map((previewValue) => (
            <span
              key={previewValue}
              className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-sm font-medium"
            >
              {previewValue}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
