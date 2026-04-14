import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProjectPageHeader } from '@/components/project/ProjectPageHeader';
import { DownloadIcon, PlusIcon, ShoppingCart } from 'lucide-react';

interface ShoppingListHeaderProps {
  projectName: string;
  grandTotalLabel: string;
  onExportClick: () => void;
  onAddProductClick: () => void;
}

export function ShoppingListHeader({
  projectName,
  grandTotalLabel,
  onExportClick,
  onAddProductClick
}: ShoppingListHeaderProps) {
  return (
    <ProjectPageHeader
      title="Shopping List"
      icon={<ShoppingCart className="h-8 w-8 text-primary" />}
      tags={(
        <>
          <Badge variant="outline">
            {projectName}
          </Badge>
          <Badge variant="secondary">
            {grandTotalLabel}
          </Badge>
        </>
      )}
      actions={(
        <>
          <Button onClick={onAddProductClick}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Add Product
          </Button>
          <Button
            onClick={onExportClick}
            variant="outline"
          >
            <DownloadIcon className="mr-2 h-4 w-4" />
            Export
          </Button>
        </>
      )}
    />
  );
}
