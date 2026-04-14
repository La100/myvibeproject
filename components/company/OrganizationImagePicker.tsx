"use client";

import Image from "next/image";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type OrganizationImagePickerProps = {
  buttonLabel?: string;
  currentImageUrl: string;
  description: string;
  disabled?: boolean;
  inputId: string;
  name: string;
  onPick: () => void;
  statusLabel?: string;
};

export function OrganizationImagePicker({
  buttonLabel = "Upload image",
  currentImageUrl,
  description,
  disabled = false,
  inputId,
  name,
  onPick,
  statusLabel,
}: OrganizationImagePickerProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border/40 bg-muted/20 p-4">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border/40 bg-background">
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
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="space-y-1">
          <Label htmlFor={inputId}>Organization image</Label>
          {statusLabel ? (
            <p className="text-xs font-medium text-foreground">{statusLabel}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onPick} disabled={disabled}>
            <Upload data-icon="inline-start" />
            {buttonLabel}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
