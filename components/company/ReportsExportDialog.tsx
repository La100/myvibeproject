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
import { useI18n } from "@/lib/i18n";

export type ReportSectionKey = "overview" | "projects" | "tasks" | "financial";

export type ReportExportOptions = {
  format: "csv" | "pdf" | "xlsx";
  includeDetails: boolean;
  sections: Record<ReportSectionKey, boolean>;
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
  const { t } = useI18n();
  const sectionLabels: Record<ReportSectionKey, string> = {
    overview: t("reportsExport", "overview"),
    projects: t("reportsExport", "projects"),
    tasks: t("reportsExport", "tasks"),
    financial: t("reportsExport", "financial"),
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reportsExport", "title")}</DialogTitle>
          <DialogDescription>
            {t("reportsExport", "description", {
              timeRange: timeRangeLabel,
            })}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel>{t("reportsExport", "format")}</FieldLabel>
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
              <FieldLabel>{t("reportsExport", "sections")}</FieldLabel>
              <div className="flex gap-2">
                <Button size="sm" type="button" variant="ghost" onClick={onSelectCurrentSection}>
                  {t("reportsExport", "currentTab")}
                </Button>
                <Button size="sm" type="button" variant="ghost" onClick={onSelectAllSections}>
                  {t("reportsExport", "allSections")}
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(sectionLabels) as ReportSectionKey[]).map((section) => (
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
                    <span className="font-medium">{sectionLabels[section]}</span>
                    <span className="text-xs text-muted-foreground">
                      {section === activeSection
                        ? t("reportsExport", "currentlyOpenTab")
                        : t("reportsExport", "optionalSection")}
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
                <span className="font-medium">{t("reportsExport", "includeDetails")}</span>
                <FieldDescription>
                  {t("reportsExport", "includeDetailsDescription")}
                </FieldDescription>
              </div>
            </label>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button disabled={isPending} onClick={onExport} type="button">
            {isPending
              ? t("reportsExport", "exporting")
              : t("reportsExport", "exportFormat", {
                  format: exportOptions.format.toUpperCase(),
                })}
          </Button>
          <Button onClick={onClose} type="button" variant="outline">
            {t("reportsExport", "cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
