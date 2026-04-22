"use client";

import Image from "next/image";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type OrganizationImagePickerProps = {
  buttonLabel?: string;
  currentImageUrl: string;
  description?: string;
  disabled?: boolean;
  inputId: string;
  layout?: "inline" | "stacked";
  name: string;
  onPick: () => void;
  previewClassName?: string;
  statusLabel?: string;
};

export function OrganizationImagePicker({
  buttonLabel = "Upload image",
  currentImageUrl,
  description,
  disabled = false,
  inputId,
  layout = "inline",
  name,
  onPick,
  previewClassName,
  statusLabel,
}: OrganizationImagePickerProps) {
  return (
    <div
      className={cn(
        layout === "stacked"
          ? "flex flex-col items-center gap-5 text-center"
          : "flex items-center gap-4",
      )}
    >
      <div
        className={cn(
          "relative shrink-0 overflow-hidden border border-border/50 bg-background",
          layout === "stacked"
            ? "h-40 w-full rounded-2xl"
            : "h-16 w-16 rounded-xl",
          previewClassName,
        )}
      >
        {currentImageUrl.trim() ? (
          <img
            src={currentImageUrl}
            alt={name || "Organization"}
            className="h-full w-full object-cover"
          />
        ) : (
          <Image
            src="/logo.svg"
            alt="Myvibe Project"
            fill
            className="object-contain p-2"
          />
        )}
      </div>
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-3",
          layout === "stacked" ? "items-center" : "",
        )}
      >
        <div className="space-y-1">
          <Label htmlFor={inputId}>Organization image</Label>
          {statusLabel ? (
            <p className="text-xs font-medium text-foreground">{statusLabel}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onPick}
            disabled={disabled}
          >
            <Upload data-icon="inline-start" />
            {buttonLabel}
          </Button>
        </div>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
