import { Button } from '@/components/ui/button';
import { DownloadIcon, PlusIcon, ShoppingCart } from 'lucide-react';

interface ShoppingListHeaderProps {
  projectName: string;
  grandTotal: number;
  currencySymbol: string;
  onExportClick: () => void;
  onAddProductClick: () => void;
}

export function ShoppingListHeader({ 
  projectName, 
  grandTotal, 
  currencySymbol, 
  onExportClick,
  onAddProductClick
}: ShoppingListHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10">
      <div className="mb-4 sm:mb-0 space-y-4">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-8 w-8 text-[var(--ui-accent-brand)]" />
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight font-[var(--font-display-serif)] text-[var(--ui-text-strong)]">
            Shopping List
          </h1>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] px-4 py-2 text-sm font-medium text-[var(--ui-accent-brand)]">
            {projectName}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] px-4 py-2 text-sm font-medium text-[var(--ui-text-main)]">
            Total: {grandTotal.toFixed(2)} {currencySymbol}
          </span>
        </div>
      </div>
      <div className="flex gap-3">
        <Button 
          onClick={onAddProductClick} 
          className="rounded-full bg-[var(--ui-action-bg)] px-6 text-[var(--primary-foreground)] shadow-[0_14px_36px_rgba(14,14,14,0.18)] hover:bg-[var(--ui-action-hover)] transition-transform hover:-translate-y-0.5"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Product
        </Button>
        <Button 
          onClick={onExportClick} 
          variant="outline"
          className="rounded-full border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] px-6 text-[var(--ui-text-strong)] shadow-sm hover:bg-[var(--ui-surface-base)]/90 hover:-translate-y-0.5 transition-all"
        >
          <DownloadIcon className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>
    </div>
  );
}
