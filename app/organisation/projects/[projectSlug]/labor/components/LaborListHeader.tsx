import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DownloadIcon, PlusIcon, Hammer } from 'lucide-react';

interface LaborListHeaderProps {
  projectName: string;
  grandTotal: number;
  currencySymbol: string;
  onExportClick: () => void;
  onAddLaborClick: () => void;
}

export function LaborListHeader({
  projectName,
  grandTotal,
  currencySymbol,
  onExportClick,
  onAddLaborClick
}: LaborListHeaderProps) {
  return (
    <div className="mb-10 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Hammer className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Labor
          </h1>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <Badge variant="outline" className="px-4 py-1.5 text-sm font-medium">
            {projectName}
          </Badge>
          <Badge variant="secondary" className="px-4 py-1.5 text-sm font-medium">
            Total: {grandTotal.toFixed(2)} {currencySymbol}
          </Badge>
        </div>
      </div>
      <div className="flex gap-3">
        <Button
          onClick={onExportClick}
          variant="outline"
          className="h-11 px-6"
        >
          <DownloadIcon className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
        <Button
          onClick={onAddLaborClick}
          className="h-11 px-6"
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          Add Labor
        </Button>
      </div>
    </div>
  );
}
