import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProjectPageHeader } from '@/components/project/ProjectPageHeader';
import { formatCurrency } from '@/lib/utils';
import { DownloadIcon, Hammer, PlusIcon } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

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
  const { t } = useI18n();
  return (
    <ProjectPageHeader
      title={t('labor', 'labor')}
      icon={<Hammer className="h-8 w-8 text-primary" />}
      tags={(
        <>
          <Badge variant="outline" className="rounded-full border-border/70 bg-card px-3 py-1.5 text-[12px] font-semibold">
            {projectName}
          </Badge>
          <Badge variant="outline" className="rounded-full border-border/70 bg-card px-3 py-1.5 text-[12px] font-semibold text-foreground">
            {t('labor', 'totalLabel', { total: formatCurrency(grandTotal, currencyCode) })}
          </Badge>
        </>
      )}
      actions={(
        <>
          <Button onClick={onAddLaborClick} className="min-w-[148px] rounded-full">
            <PlusIcon className="mr-2 h-4 w-4" />
            {t('labor', 'addLabor')}
          </Button>
          <Button onClick={onExportClick} variant="outline" className="rounded-full border-border/70 bg-card">
            <DownloadIcon className="mr-2 h-4 w-4" />
            {t('labor', 'export')}
          </Button>
        </>
      )}
    />
  );
}
