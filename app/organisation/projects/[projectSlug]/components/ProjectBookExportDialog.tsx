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

const SECTION_LABELS: Record<ProjectBookSectionKey, string> = {
  shoppingList: "Shopping List",
  labor: "Labor",
  tasks: "Tasks",
  budget: "Budget",
  payments: "Payments",
  moodboard: "Moodboard",
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
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Project Book</DialogTitle>
          <DialogDescription>
            Build one PDF with selected project sections.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel>Sections</FieldLabel>
            <FieldDescription>
              All sections start selected by default. Uncheck the ones you want to skip.
            </FieldDescription>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(SECTION_LABELS) as ProjectBookSectionKey[]).map((section) => (
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
                    <span className="font-medium">{SECTION_LABELS[section]}</span>
                  </div>
                </label>
              ))}
            </div>
          </Field>

          <Field>
            <FieldLabel>Detail Visibility</FieldLabel>
            <FieldDescription>
              Control which shopping and labor details are included in the PDF.
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
                  <span className="font-medium">Prices</span>
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
                  <span className="font-medium">Suppliers</span>
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
                  <span className="font-medium">Notes</span>
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
            {isPending ? "Exporting..." : "Export PDF"}
          </Button>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
