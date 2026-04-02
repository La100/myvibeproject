import { Badge } from '@/components/ui/badge';
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
    <div className="mb-10 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Shopping List
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="rounded-full px-4 py-2 text-sm font-medium text-primary">
            {projectName}
          </Badge>
          <Badge variant="secondary" className="rounded-full px-4 py-2 text-sm font-medium">
            Total: {grandTotal.toFixed(2)} {currencySymbol}
          </Badge>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={onAddProductClick}
          className="h-11 rounded-full px-6"
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          Add Product
        </Button>
        <Button
          onClick={onExportClick}
          variant="outline"
          className="h-11 rounded-full px-6"
        >
          <DownloadIcon className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>
    </div>
  );
}
