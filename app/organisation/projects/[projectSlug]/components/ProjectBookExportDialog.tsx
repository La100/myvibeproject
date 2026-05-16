"use client";

import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { useI18n } from "@/lib/i18n";

export type ProjectBookSectionKey =
  | "shoppingList"
  | "labor"
  | "tasks"
  | "budget"
  | "payments"
  | "moodboard";

export type ProjectBookExportOptions = {
  sections: Record<ProjectBookSectionKey, boolean>;
  showNotes: boolean;
  showPrice: boolean;
  showSupplier: boolean;
};

const SECTION_LABEL_KEYS: Record<
  ProjectBookSectionKey,
  | "shoppingList"
  | "labor"
  | "tasks"
  | "budget"
  | "payments"
  | "moodboard"
> = {
  shoppingList: "shoppingList",
  labor: "labor",
  tasks: "tasks",
  budget: "budget",
  payments: "payments",
  moodboard: "moodboard",
};

type ProjectBookExportDialogProps = {
  exportOptions: ProjectBookExportOptions;
  isOpen: boolean;
  isPending: boolean;
  onClose: () => void;
  onExport: () => void;
  onExportOptionsChange: (options: ProjectBookExportOptions) => void;
};

export function ProjectBookExportDialog({
  exportOptions,
  isOpen,
  isPending,
  onClose,
  onExport,
  onExportOptionsChange,
}: ProjectBookExportDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("projectBookExport", "exportProjectBook")}</DialogTitle>
          <DialogDescription>
            {t("projectBookExport", "buildOnePdf")}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel>{t("projectBookExport", "sections")}</FieldLabel>
            <FieldDescription>
              {t("projectBookExport", "sectionsDescription")}
            </FieldDescription>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(SECTION_LABEL_KEYS) as ProjectBookSectionKey[]).map((section) => (
                <label
                  key={section}
                  className="flex items-start gap-3 rounded-lg border border-border/70 px-3 py-3 text-sm"
                >
                  <Checkbox
                    checked={exportOptions.sections[section]}
                    onCheckedChange={(checked) =>
                      onExportOptionsChange({
                        ...exportOptions,
                        sections: {
                          ...exportOptions.sections,
                          [section]: checked === true,
                        },
                      })
                    }
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {t("projectBookExport", SECTION_LABEL_KEYS[section])}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </Field>

          <Field>
            <FieldLabel>{t("projectBookExport", "detailVisibility")}</FieldLabel>
            <FieldDescription>
              {t("projectBookExport", "controlDetails")}
            </FieldDescription>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex items-start gap-3 rounded-lg border border-border/70 px-3 py-3 text-sm">
                <Checkbox
                  checked={exportOptions.showPrice}
                  onCheckedChange={(checked) =>
                    onExportOptionsChange({
                      ...exportOptions,
                      showPrice: checked === true,
                    })
                  }
                />
                <div className="flex flex-col">
                  <span className="font-medium">{t("projectBookExport", "prices")}</span>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-border/70 px-3 py-3 text-sm">
                <Checkbox
                  checked={exportOptions.showSupplier}
                  onCheckedChange={(checked) =>
                    onExportOptionsChange({
                      ...exportOptions,
                      showSupplier: checked === true,
                    })
                  }
                />
                <div className="flex flex-col">
                  <span className="font-medium">{t("projectBookExport", "suppliers")}</span>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-border/70 px-3 py-3 text-sm">
                <Checkbox
                  checked={exportOptions.showNotes}
                  onCheckedChange={(checked) =>
                    onExportOptionsChange({
                      ...exportOptions,
                      showNotes: checked === true,
                    })
                  }
                />
                <div className="flex flex-col">
                  <span className="font-medium">{t("projectBookExport", "notes")}</span>
                </div>
              </label>
            </div>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button
            disabled={
              isPending || !Object.values(exportOptions.sections).some(Boolean)
            }
            onClick={onExport}
            type="button"
          >
            <FileText className="mr-2 h-4 w-4" />
            {isPending
              ? t("projectBookExport", "exporting")
              : t("projectBookExport", "exportPdf")}
          </Button>
          <Button onClick={onClose} type="button" variant="outline">
            {t("projectBookExport", "cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
