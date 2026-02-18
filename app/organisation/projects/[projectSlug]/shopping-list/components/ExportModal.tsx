import { Button } from '@/components/ui/button';
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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[var(--ui-surface-base)] rounded-lg p-6 w-96 max-w-[90vw]">
        <h3 className="text-lg font-semibold mb-4">Export Shopping List</h3>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Format:</label>
            <div className="flex gap-2 mt-1">
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
          </div>

          <div>
            <label className="text-sm font-medium">Filter by Status:</label>
            <Select 
              value={exportOptions.statusFilter} 
              onValueChange={(value) => onExportOptionsChange({...exportOptions, statusFilter: value as 'all' | 'planned' | 'ordered' | 'completed'})}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="planned">Planned Only</SelectItem>
                <SelectItem value="ordered">Ordered Only</SelectItem>
                <SelectItem value="completed">Completed Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={exportOptions.includeNotes}
                onChange={(e) => onExportOptionsChange({...exportOptions, includeNotes: e.target.checked})}
              />
              <span className="text-sm">Include Notes</span>
            </label>
            
            {exportOptions.format === 'pdf' && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={exportOptions.groupBySections}
                  onChange={(e) => onExportOptionsChange({...exportOptions, groupBySections: e.target.checked})}
                />
                <span className="text-sm">Group by Sections</span>
              </label>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button
            onClick={onExport}
            disabled={isPending}
          >
            {isPending ? 'Exporting...' : `Export ${exportOptions.format.toUpperCase()}`}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
} 