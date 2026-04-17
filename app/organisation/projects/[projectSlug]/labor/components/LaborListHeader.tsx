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
      subtitle="Track contractors, unit pricing, and delivery progress across the project scope."
      icon={<Hammer className="h-8 w-8 text-primary" />}
      tags={(
        <>
          <Badge variant="outline" className="rounded-full border-border/70 bg-white px-3 py-1.5 text-[12px] font-semibold">
            {projectName}
          </Badge>
          <Badge variant="outline" className="rounded-full border-border/70 bg-white px-3 py-1.5 text-[12px] font-semibold text-foreground">
            Total: {formatCurrency(grandTotal, currencyCode)}
          </Badge>
        </>
      )}
      actions={(
        <>
          <Button onClick={onAddLaborClick} className="min-w-[148px] rounded-full">
            <PlusIcon className="mr-2 h-4 w-4" />
            Add Labor
          </Button>
          <Button onClick={onExportClick} variant="outline" className="rounded-full border-border/70 bg-white">
            <DownloadIcon className="mr-2 h-4 w-4" />
            Export
          </Button>
        </>
      )}
    />
  );
}
