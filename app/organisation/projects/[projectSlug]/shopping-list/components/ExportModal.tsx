import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSpreadsheetIcon, FileTextIcon } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export type ShoppingListExportOptions = {
  format: 'csv' | 'pdf' | 'xlsx';
  groupBySections: boolean;
  includeNotes: boolean;
  includeStatus: boolean;
  includeSupplier: boolean;
  scope: 'all' | 'currentView';
};

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportOptions: ShoppingListExportOptions;
  onExportOptionsChange: (options: ShoppingListExportOptions) => void;
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
  const { t } = useI18n();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("shoppingList", "exportShoppingList")}</DialogTitle>
          <DialogDescription>
            {t("shoppingList", "selectFormatFilters")}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel>{t("shoppingList", "format")}</FieldLabel>
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
                variant={exportOptions.format === 'xlsx' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onExportOptionsChange({...exportOptions, format: 'xlsx'})}
              >
                <FileSpreadsheetIcon className="h-4 w-4 mr-1" />
                Excel
              </Button>
              <Button
                variant={exportOptions.format === 'pdf' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onExportOptionsChange({...exportOptions, format: 'pdf'})}
              >
                <FileTextIcon className="h-4 w-4 mr-1" />
                PDF
              </Button>
            </div>
          </Field>

          <Field>
            <FieldLabel>{t("shoppingList", "dataSource")}</FieldLabel>
            <Select
              value={exportOptions.scope}
              onValueChange={(value) => onExportOptionsChange({...exportOptions, scope: value as 'all' | 'currentView'})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("shoppingList", "allItems")}</SelectItem>
                <SelectItem value="currentView">{t("shoppingList", "currentViewOnly")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field className="gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={exportOptions.includeNotes}
                onCheckedChange={(checked) => onExportOptionsChange({...exportOptions, includeNotes: checked === true})}
              />
              <span className="text-sm">{t("shoppingList", "includeNotes")}</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={exportOptions.includeSupplier}
                onCheckedChange={(checked) => onExportOptionsChange({...exportOptions, includeSupplier: checked === true})}
              />
              <span className="text-sm">{t("shoppingList", "includeSupplier")}</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={exportOptions.includeStatus}
                onCheckedChange={(checked) => onExportOptionsChange({...exportOptions, includeStatus: checked === true})}
              />
              <span className="text-sm">{t("shoppingList", "includeStatus")}</span>
            </label>
            {exportOptions.format !== 'csv' ? (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={exportOptions.groupBySections}
                  onCheckedChange={(checked) => onExportOptionsChange({...exportOptions, groupBySections: checked === true})}
                />
                <span className="text-sm">{t("shoppingList", "groupBySections")}</span>
              </label>
            ) : null}
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button
            onClick={onExport}
            disabled={isPending}
          >
            {isPending
              ? t("shoppingList", "exporting")
              : `${t("shoppingList", "export")} ${exportOptions.format.toUpperCase()}`}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t("shoppingList", "cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 
