import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProjectPageHeader } from '@/components/project/ProjectPageHeader';
import { DownloadIcon, ExternalLinkIcon, PlusIcon, ShoppingCart } from 'lucide-react';

const CHROME_EXTENSION_URL =
  'https://chromewebstore.google.com/detail/myvibeproject-web-clipper/nklbcopiimkboameblhnmdookkelncih';

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
          <Badge variant="outline" className="rounded-full border-border/70 bg-card px-3 py-1.5 text-[12px] font-semibold">
            {projectName}
          </Badge>
          <Badge variant="outline" className="rounded-full border-border/70 bg-card px-3 py-1.5 text-[12px] font-semibold text-foreground">
            {grandTotalLabel}
          </Badge>
        </>
      )}
      actions={(
        <>
          <Button onClick={onAddProductClick} className="min-w-[148px] rounded-full">
            <PlusIcon className="mr-2 h-4 w-4" />
            Add Product
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-full border-border/70 bg-card"
          >
            <Link href={CHROME_EXTENSION_URL} target="_blank" rel="noreferrer">
              <ExternalLinkIcon className="mr-2 h-4 w-4" />
              Chrome Extension
            </Link>
          </Button>
          <Button
            onClick={onExportClick}
            variant="outline"
            className="rounded-full border-border/70 bg-card"
          >
            <DownloadIcon className="mr-2 h-4 w-4" />
            Export
          </Button>
        </>
      )}
    />
  );
}
