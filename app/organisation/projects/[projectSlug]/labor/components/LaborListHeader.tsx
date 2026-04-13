import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProjectPageHeader } from '@/components/project/ProjectPageHeader';
import { formatCurrency } from '@/lib/utils';
import { DownloadIcon, Hammer, PlusIcon } from 'lucide-react';

interface LaborListHeaderProps {
  projectName: string;
  grandTotal: number;
  currencyCode?: string;
  onExportClick: () => void;
  onAddLaborClick: () => void;
}

export function LaborListHeader({
  projectName,
  grandTotal,
  currencyCode,
  onExportClick,
  onAddLaborClick,
}: LaborListHeaderProps) {
  return (
    <ProjectPageHeader
      title="Labor"
      icon={<Hammer className="h-8 w-8 text-primary" />}
      tags={(
        <>
          <Badge variant="outline">
            {projectName}
          </Badge>
          <Badge variant="secondary">
            Total: {formatCurrency(grandTotal, currencyCode)}
          </Badge>
        </>
      )}
      actions={(
        <>
          <Button onClick={onAddLaborClick}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Add Labor
          </Button>
          <Button onClick={onExportClick} variant="outline">
            <DownloadIcon className="mr-2 h-4 w-4" />
            Export
          </Button>
        </>
      )}
    />
  );
}
