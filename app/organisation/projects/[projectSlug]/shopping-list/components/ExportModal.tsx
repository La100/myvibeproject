import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DownloadIcon, FileSpreadsheetIcon } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportOptions: {
    format: 'csv' | 'pdf';
    includeImages: boolean;
    statusFilter: 'all' | 'planned' | 'ordered' | 'completed';
    includeNotes: boolean;
    groupBySections: boolean;
  };
  onExportOptionsChange: (options: {
    format: 'csv' | 'pdf';
    includeImages: boolean;
    statusFilter: 'all' | 'planned' | 'ordered' | 'completed';
    includeNotes: boolean;
    groupBySections: boolean;
  }) => void;
  onExport: () => void;
  isPending: boolean;
}

export function ExportModal({ 
  isOpen, 
  onClose, 
  exportOptions, 
  onExportOptionsChange, 
  onExport, 
  isPending 
}: ExportModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Shopping List</DialogTitle>
          <DialogDescription>
            Choose the format and filters for your export.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel>Format</FieldLabel>
            <div className="flex gap-2">
              <Button
                variant={exportOptions.format === 'csv' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onExportOptionsChange({...exportOptions, format: 'csv'})}
              >
                <FileSpreadsheetIcon className="h-4 w-4 mr-1" />
                CSV
              </Button>
              <Button
                variant={exportOptions.format === 'pdf' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onExportOptionsChange({...exportOptions, format: 'pdf'})}
              >
                <DownloadIcon className="h-4 w-4 mr-1" />
                PDF
              </Button>
            </div>
          </Field>

          <Field>
            <FieldLabel>Filter by Status</FieldLabel>
            <Select 
              value={exportOptions.statusFilter} 
              onValueChange={(value) => onExportOptionsChange({...exportOptions, statusFilter: value as 'all' | 'planned' | 'ordered' | 'completed'})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="planned">Planned Only</SelectItem>
                <SelectItem value="ordered">Ordered Only</SelectItem>
                <SelectItem value="completed">Completed Only</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field className="gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={exportOptions.includeNotes}
                onCheckedChange={(checked) => onExportOptionsChange({...exportOptions, includeNotes: checked === true})}
              />
              <span className="text-sm">Include Notes</span>
            </label>
            
            {exportOptions.format === 'pdf' && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={exportOptions.includeImages}
                    onCheckedChange={(checked) => onExportOptionsChange({...exportOptions, includeImages: checked === true})}
                  />
                  <span className="text-sm">Include Images</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={exportOptions.groupBySections}
                    onCheckedChange={(checked) => onExportOptionsChange({...exportOptions, groupBySections: checked === true})}
                  />
                  <span className="text-sm">Group by Sections</span>
                </label>
              </>
            )}
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button
            onClick={onExport}
            disabled={isPending}
          >
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
