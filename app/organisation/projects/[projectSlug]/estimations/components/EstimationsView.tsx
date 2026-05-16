'use client';

import { useState } from 'react';
import { useQuery, useMutation, useConvex } from 'convex/react';
import { apiAny } from '@/lib/convexApiAny';
import { toUserFacingErrorMessage } from '@/lib/userFacingErrors';
import { Doc, Id } from '@/convex/_generated/dataModel';
import { useProject } from '@/components/providers/ProjectProvider';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PlusIcon,
  Calculator,
  FileTextIcon,
  TrashIcon,
  EditIcon,
  DownloadIcon,
  ExternalLinkIcon,
  MoreHorizontalIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { CreateEstimationDialog } from './CreateEstimationDialog';
import { ProjectPageLayout } from '@/components/project/ProjectPageLayout';
import { ProjectPageHeader } from '@/components/project/ProjectPageHeader';
import {
  calculateTaxBreakdown,
  getPrimaryAmountKindForDisplay,
  getTaxAmountKindLabel,
  resolveOrganizationTaxSettings,
} from '@/lib/organizationTax';
import { getCurrencySymbol } from '@/lib/utils';
import { exportEstimationPdf, openEstimationPdfInNewTab } from '@/lib/estimationPdfExport';
import { sanitizeFileName } from '@/lib/pdfExport';
import { useI18n } from '@/lib/i18n';

type VisibleEstimationStatus = 'draft' | 'accepted' | 'rejected';

export function EstimationsViewLoading() {
  return <Spinner className="p-4 sm:p-6" />;
}

export default function EstimationsView() {
  const { t } = useI18n();
  const { project, team } = useProject();
  const convex = useConvex();

  const estimations = useQuery(apiAny.costEstimations.listCostEstimations, { projectId: project._id });

  const deleteEstimation = useMutation(apiAny.costEstimations.deleteCostEstimation);
  const updateStatus = useMutation(apiAny.costEstimations.updateEstimationStatus);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEstimationId, setEditingEstimationId] = useState<Id<"costEstimations"> | null>(null);
  const [openingPdfEstimationId, setOpeningPdfEstimationId] = useState<Id<"costEstimations"> | null>(null);
  const [downloadingPdfEstimationId, setDownloadingPdfEstimationId] = useState<Id<"costEstimations"> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | VisibleEstimationStatus>('all');

  if (estimations === undefined) {
    return <EstimationsViewLoading />;
  }

  if (project === null) {
    return <div>{t('estimations', 'projectNotFound')}</div>;
  }

  const currencySymbol = getCurrencySymbol(project.currency);
  const fallbackTaxSettings = resolveOrganizationTaxSettings(team?.organizationTaxSettings);
  const estimationPdfBrand = team
    ? {
        teamImageUrl:
          team.customOrganizationImageSetAt && team.imageUrl?.trim()
            ? team.imageUrl
            : undefined,
        teamName: team.name || t('estimations', 'organization'),
      }
    : undefined;

  const resolveVisibleStatus = (status: Doc<"costEstimations">["status"]): VisibleEstimationStatus => {
    if (status === 'accepted' || status === 'rejected') {
      return status;
    }

    return 'draft';
  };

  const buildEstimationTaxSettings = (estimation: Doc<"costEstimations">) => {
    const snapshot = estimation.taxSnapshot;
    if (snapshot?.taxEnabled) {
      return {
        taxEnabled: true,
        taxLabel: snapshot.taxLabel || fallbackTaxSettings.taxLabel,
        taxRate: snapshot.taxRate,
        priceDisplay: snapshot.priceDisplay || fallbackTaxSettings.priceDisplay,
      };
    }

    if (estimation.vatPercent > 0) {
      return {
        taxEnabled: true,
        taxLabel: fallbackTaxSettings.taxLabel,
        taxRate: estimation.vatPercent,
        priceDisplay: fallbackTaxSettings.priceDisplay,
      };
    }

    return {
      ...fallbackTaxSettings,
      taxEnabled: false,
      taxRate: 0,
    };
  };

  const getPrimaryAmount = (netAmount: number | undefined, estimation: Doc<"costEstimations">) => {
    const taxSettings = buildEstimationTaxSettings(estimation);
    const breakdown = calculateTaxBreakdown(netAmount, taxSettings);
    const kind = getPrimaryAmountKindForDisplay(taxSettings);

    return {
      kind,
      label:
        kind === 'tax'
          ? getTaxAmountKindLabel(kind, taxSettings)
          : t('estimations', kind === 'gross' ? 'gross' : 'net'),
      value: breakdown[kind],
    };
  };

  const getStatusColor = (status: VisibleEstimationStatus) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'accepted': return 'default';
      case 'rejected': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: VisibleEstimationStatus) => {
    switch (status) {
      case 'draft': return t('estimations', 'draft');
      case 'accepted': return t('estimations', 'accepted');
      case 'rejected': return t('estimations', 'rejected');
      default: return status;
    }
  };

  const handleDelete = async (id: Id<"costEstimations">) => {
    if (!confirm(t('estimations', 'deleteConfirm'))) return;
    try {
      await deleteEstimation({ estimationId: id });
      toast.success(t('estimations', 'estimationDeleted'));
    } catch {
      toast.error(t('estimations', 'failedToDeleteEstimation'));
    }
  };

  const handleStatusChange = async (id: Id<"costEstimations">, status: VisibleEstimationStatus) => {
    try {
      await updateStatus({ estimationId: id, status });
      toast.success(t('estimations', 'statusUpdatedTo', { status: getStatusLabel(status) }));
    } catch {
      toast.error(t('estimations', 'failedToUpdateStatus'));
    }
  };

  const handleOpenPdf = async (estimationId: Id<"costEstimations">) => {
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      toast.error(t('estimations', 'allowPopups'));
      return;
    }

    previewWindow.opener = null;
    previewWindow.document.write(
      `<!doctype html><html><head><title>${t('estimations', 'openingPdf')}</title></head><body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f4f1ec;color:#4a3b2e;">${t('estimations', 'preparingPdf')}</body></html>`,
    );
    previewWindow.document.close();

    try {
      setOpeningPdfEstimationId(estimationId);
      const estimation = await convex.query(
        apiAny.costEstimations.getCostEstimationWithItems,
        { estimationId },
      );

      if (!estimation) {
        previewWindow.close();
        toast.error(t('estimations', 'estimationNotFound'));
        return;
      }

      await openEstimationPdfInNewTab({
        brand: estimationPdfBrand,
        currencySymbol,
        estimation,
        fileName: `estimation-${sanitizeFileName(estimation.estimationNumber || estimation.title || String(estimation._id))}-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
        generatedOn: format(new Date(), 'yyyy-MM-dd HH:mm'),
        organizationTaxSettings: team?.organizationTaxSettings,
        projectName: project.name,
      }, previewWindow);
    } catch (error) {
      previewWindow.close();
      console.error('Open PDF error:', error);
      toast.error(t('estimations', 'failedToOpenPdf'), {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setOpeningPdfEstimationId(null);
    }
  };

  const handleDownloadPdf = async (estimationId: Id<"costEstimations">) => {
    try {
      setDownloadingPdfEstimationId(estimationId);
      const estimation = await convex.query(
        apiAny.costEstimations.getCostEstimationWithItems,
        { estimationId },
      );

      if (!estimation) {
        toast.error(t('estimations', 'estimationNotFound'));
        return;
      }

      await exportEstimationPdf({
        brand: estimationPdfBrand,
        currencySymbol,
        estimation,
        fileName: `estimation-${sanitizeFileName(estimation.estimationNumber || estimation.title || String(estimation._id))}-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
        generatedOn: format(new Date(), 'yyyy-MM-dd HH:mm'),
        organizationTaxSettings: team?.organizationTaxSettings,
        projectName: project.name,
      });
    } catch (error) {
      console.error('Download PDF error:', error);
      toast.error(t('estimations', 'failedToExportPdf'), {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setDownloadingPdfEstimationId(null);
    }
  };

  const visibleStats = estimations.reduce(
    (summary, estimation) => {
      summary.total += 1;
      summary[resolveVisibleStatus(estimation.status)] += 1;
      return summary;
    },
    {
      total: 0,
      draft: 0,
      accepted: 0,
      rejected: 0,
    },
  );

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredEstimations = estimations.filter((estimation) => {
    const visibleStatus = resolveVisibleStatus(estimation.status);
    const matchesStatus =
      statusFilter === 'all' || visibleStatus === statusFilter;
    const matchesSearch =
      normalizedSearchQuery.length === 0 ||
      [
        estimation.title,
        estimation.estimationNumber,
        estimation.customerName,
        estimation.location,
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalizedSearchQuery));

    return matchesStatus && matchesSearch;
  });
  const hasActiveFilters =
    normalizedSearchQuery.length > 0 || statusFilter !== 'all';

  return (
    <ProjectPageLayout>
      {/* Header */}
    <ProjectPageHeader
        title={t('estimations', 'costEstimations')}
        icon={<Calculator className="h-8 w-8 text-primary" />}
        tags={
          <>
            <Badge variant="outline" className="px-4 py-2 text-sm font-medium">
              {project.name}
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 text-sm font-medium">
              {t('estimations', 'estimationsCount', { count: visibleStats.total })}
            </Badge>
          </>
        }
        actions={
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="px-6"
          >
            <PlusIcon data-icon="inline-start" />
            {t('estimations', 'newEstimation')}
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t('estimations', 'searchPlaceholder')}
          className="h-11 md:max-w-md"
        />
        <Select
          value={statusFilter}
          onValueChange={(value) =>
            setStatusFilter(value as 'all' | VisibleEstimationStatus)
          }
        >
          <SelectTrigger className="h-11 md:w-[220px]">
            <SelectValue placeholder={t('estimations', 'filterByStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('estimations', 'allStatuses')}</SelectItem>
            <SelectItem value="draft">{t('estimations', 'draft')}</SelectItem>
            <SelectItem value="accepted">{t('estimations', 'accepted')}</SelectItem>
            <SelectItem value="rejected">{t('estimations', 'rejected')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {[
          { label: t('estimations', 'draft'), count: visibleStats.draft, className: 'border-border bg-muted text-muted-foreground' },
          { label: t('estimations', 'accepted'), count: visibleStats.accepted, className: 'border-border bg-primary/5 text-primary' },
          { label: t('estimations', 'rejected'), count: visibleStats.rejected, className: 'border-border bg-destructive/10 text-destructive' },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-2xl border p-4 ${stat.className}`}
          >
            <div className="text-2xl font-semibold">{stat.count}</div>
            <div className="text-sm text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Estimations List */}
      {estimations.length === 0 ? (
        <Empty className="rounded-3xl border-border/70 bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileTextIcon />
            </EmptyMedia>
            <EmptyTitle>{t('estimations', 'noEstimationsYet')}</EmptyTitle>
            <EmptyDescription>
              {t('estimations', 'noEstimationsDescription')}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setIsCreateOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              {t('estimations', 'createEstimation')}
            </Button>
          </EmptyContent>
        </Empty>
      ) : filteredEstimations.length === 0 ? (
        <Empty className="rounded-3xl border-border/70 bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileTextIcon />
            </EmptyMedia>
            <EmptyTitle>{t('estimations', 'noMatchingEstimations')}</EmptyTitle>
            <EmptyDescription>
              {t('estimations', 'noMatchingDescription')}
            </EmptyDescription>
          </EmptyHeader>
          {hasActiveFilters ? (
            <EmptyContent>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
              >
                {t('estimations', 'clearFilters')}
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredEstimations.map((estimation) => (
            (() => {
              const visibleStatus = resolveVisibleStatus(estimation.status);
              const totalAmount = getPrimaryAmount(estimation.netTotal, estimation);
              const laborAmount = getPrimaryAmount(estimation.laborTotal, estimation);
              const materialsAmount = getPrimaryAmount(estimation.materialsTotal, estimation);
              const validUntilLabel = estimation.validUntil
                ? format(new Date(estimation.validUntil), 'MMM d, yyyy')
                : null;

              return (
                <div
                  key={estimation._id}
                  className="rounded-3xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <h3 className="text-lg font-medium text-foreground">{estimation.title}</h3>
                        <Badge variant={getStatusColor(visibleStatus)}>
                          {getStatusLabel(visibleStatus)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        {estimation.estimationNumber && (
                          <span>#{estimation.estimationNumber}</span>
                        )}
                        <span>{t('estimations', 'createdWithDate', { date: format(new Date(estimation.estimationDate), 'MMM d, yyyy') })}</span>
                        {validUntilLabel && (
                          <span>{t('estimations', 'validUntilWithDate', { date: validUntilLabel })}</span>
                        )}
                        {estimation.location && (
                          <span>{estimation.location}</span>
                        )}
                        {estimation.customerName && (
                          <span>{t('estimations', 'customerWithName', { name: estimation.customerName })}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">{t('estimations', 'amountTotal', { amount: totalAmount.label })}</div>
                        <div className="text-xl font-semibold text-foreground">
                          {totalAmount.value.toFixed(2)} {currencySymbol}
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={openingPdfEstimationId === estimation._id}
                        onClick={() => void handleOpenPdf(estimation._id)}
                      >
                        <ExternalLinkIcon className="mr-2 h-4 w-4" />
                        {openingPdfEstimationId === estimation._id ? t('estimations', 'opening') : t('estimations', 'openPdf')}
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                            <MoreHorizontalIcon className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={downloadingPdfEstimationId === estimation._id}
                            onClick={() => void handleDownloadPdf(estimation._id)}
                          >
                            <DownloadIcon className="mr-2 h-4 w-4" />
                            {downloadingPdfEstimationId === estimation._id ? t('estimations', 'exportingPdf') : t('estimations', 'downloadPdf')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingEstimationId(estimation._id)}>
                            <EditIcon className="mr-2 h-4 w-4" />
                            {t('estimations', 'edit')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleStatusChange(estimation._id, 'draft')}>
                            {t('estimations', 'setAsDraft')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(estimation._id, 'accepted')}>
                            {t('estimations', 'markAsAccepted')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(estimation._id, 'rejected')}>
                            {t('estimations', 'markAsRejected')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(estimation._id)}
                          >
                            <TrashIcon data-icon="inline-start" />
                            {t('estimations', 'delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-6 border-t border-border pt-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('estimations', 'laborAmountLabel', { amount: laborAmount.label })} </span>
                      <span className="font-medium">{laborAmount.value.toFixed(2)} {currencySymbol}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('estimations', 'materialsAmountLabel', { amount: materialsAmount.label })} </span>
                      <span className="font-medium">{materialsAmount.value.toFixed(2)} {currencySymbol}</span>
                    </div>
                  </div>
                </div>
              );
            })()
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <CreateEstimationDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        projectId={project._id}
        currencySymbol={currencySymbol}
      />

      {editingEstimationId && (
        <CreateEstimationDialog
          open={!!editingEstimationId}
          onOpenChange={(open) => !open && setEditingEstimationId(null)}
          projectId={project._id}
          currencySymbol={currencySymbol}
          estimationId={editingEstimationId}
        />
      )}
    </ProjectPageLayout>
  );
}
