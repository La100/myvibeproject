"use client";

import { FileSpreadsheet, FileText } from "lucide-react";

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

export type ReportSectionKey = "overview" | "projects" | "tasks" | "financial";

export type ReportExportOptions = {
  format: "csv" | "pdf" | "xlsx";
  includeDetails: boolean;
  sections: Record<ReportSectionKey, boolean>;
};

const SECTION_LABELS: Record<ReportSectionKey, string> = {
  overview: "Overview",
  projects: "Projects",
  tasks: "Tasks",
  financial: "Financial",
};

type ReportsExportDialogProps = {
  activeSection: ReportSectionKey;
  exportOptions: ReportExportOptions;
  isOpen: boolean;
  isPending: boolean;
  onClose: () => void;
  onExport: () => void;
  onExportOptionsChange: (options: ReportExportOptions) => void;
  onSelectAllSections: () => void;
  onSelectCurrentSection: () => void;
  timeRangeLabel: string;
};

export function ReportsExportDialog({
  activeSection,
  exportOptions,
  isOpen,
  isPending,
  onClose,
  onExport,
  onExportOptionsChange,
  onSelectAllSections,
  onSelectCurrentSection,
  timeRangeLabel,
}: ReportsExportDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Reports</DialogTitle>
          <DialogDescription>
            Choose what to include in the export for <span className="font-medium text-foreground">{timeRangeLabel}</span>.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel>Format</FieldLabel>
            <div className="flex gap-2">
              <Button
                size="sm"
                type="button"
                variant={exportOptions.format === "csv" ? "default" : "outline"}
                onClick={() => onExportOptionsChange({ ...exportOptions, format: "csv" })}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button
                size="sm"
                type="button"
                variant={exportOptions.format === "xlsx" ? "default" : "outline"}
                onClick={() => onExportOptionsChange({ ...exportOptions, format: "xlsx" })}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button
                size="sm"
                type="button"
                variant={exportOptions.format === "pdf" ? "default" : "outline"}
                onClick={() => onExportOptionsChange({ ...exportOptions, format: "pdf" })}
              >
                <FileText className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          </Field>

          <Field>
            <div className="flex items-center justify-between gap-3">
              <FieldLabel>Sections</FieldLabel>
              <div className="flex gap-2">
                <Button size="sm" type="button" variant="ghost" onClick={onSelectCurrentSection}>
                  Current tab
                </Button>
                <Button size="sm" type="button" variant="ghost" onClick={onSelectAllSections}>
                  All sections
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(SECTION_LABELS) as ReportSectionKey[]).map((section) => (
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
                    <span className="text-xs text-muted-foreground">
                      {section === activeSection ? "Currently open tab" : "Optional section"}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </Field>

          <Field className="gap-2">
            <label className="flex items-start gap-3 rounded-lg border border-border/70 px-3 py-3 text-sm">
              <Checkbox
                checked={exportOptions.includeDetails}
                onCheckedChange={(checked) =>
                  onExportOptionsChange({
                    ...exportOptions,
                    includeDetails: checked === true,
                  })
                }
              />
              <div className="flex flex-col">
                <span className="font-medium">Include detailed rows</span>
                <FieldDescription>
                  Adds full project, task, and financial breakdowns instead of only summary tables.
                </FieldDescription>
              </div>
            </label>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button disabled={isPending} onClick={onExport} type="button">
            {isPending ? "Exporting..." : `Export ${exportOptions.format.toUpperCase()}`}
          </Button>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
