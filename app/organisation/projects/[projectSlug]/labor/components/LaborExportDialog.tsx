import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSpreadsheetIcon, FileTextIcon } from 'lucide-react';

export type LaborListExportOptions = {
  format: 'csv' | 'pdf' | 'xlsx';
  groupBySections: boolean;
  includeNotes: boolean;
  includeReferenceLink: boolean;
  scope: 'all' | 'currentView';
};

type LaborExportDialogProps = {
  exportOptions: LaborListExportOptions;
  isOpen: boolean;
  isPending: boolean;
  onClose: () => void;
  onExport: () => void;
  onExportOptionsChange: (options: LaborListExportOptions) => void;
};

export function LaborExportDialog({
  exportOptions,
  isOpen,
  isPending,
  onClose,
  onExport,
  onExportOptionsChange,
}: LaborExportDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Labor List</DialogTitle>
          <DialogDescription>
            Choose the format, source, and columns for this labor export.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel>Format</FieldLabel>
            <div className="flex gap-2">
              <Button
                variant={exportOptions.format === 'csv' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onExportOptionsChange({ ...exportOptions, format: 'csv' })}
              >
                <FileSpreadsheetIcon className="mr-1 h-4 w-4" />
                CSV
              </Button>
              <Button
                variant={exportOptions.format === 'xlsx' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onExportOptionsChange({ ...exportOptions, format: 'xlsx' })}
              >
                <FileSpreadsheetIcon className="mr-1 h-4 w-4" />
                Excel
              </Button>
              <Button
                variant={exportOptions.format === 'pdf' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onExportOptionsChange({ ...exportOptions, format: 'pdf' })}
              >
                <FileTextIcon className="mr-1 h-4 w-4" />
                PDF
              </Button>
            </div>
          </Field>

          <Field>
            <FieldLabel>Data Source</FieldLabel>
            <Select
              value={exportOptions.scope}
              onValueChange={(value) =>
                onExportOptionsChange({ ...exportOptions, scope: value as 'all' | 'currentView' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All items</SelectItem>
                <SelectItem value="currentView">Current view only</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field className="gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={exportOptions.includeNotes}
                onCheckedChange={(checked) =>
                  onExportOptionsChange({ ...exportOptions, includeNotes: checked === true })
                }
              />
              <span className="text-sm">Include Notes</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={exportOptions.includeReferenceLink}
                onCheckedChange={(checked) =>
                  onExportOptionsChange({ ...exportOptions, includeReferenceLink: checked === true })
                }
              />
              <span className="text-sm">Include Reference Links</span>
            </label>
            {exportOptions.format !== 'csv' ? (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={exportOptions.groupBySections}
                  onCheckedChange={(checked) =>
                    onExportOptionsChange({ ...exportOptions, groupBySections: checked === true })
                  }
                />
                <span className="text-sm">Group by Sections</span>
              </label>
            ) : null}
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button onClick={onExport} disabled={isPending}>
            {isPending ? 'Exporting...' : `Export ${exportOptions.format.toUpperCase()}`}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
