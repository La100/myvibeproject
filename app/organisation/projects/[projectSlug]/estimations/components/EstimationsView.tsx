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

type VisibleEstimationStatus = 'draft' | 'accepted' | 'rejected';

export function EstimationsViewLoading() {
  return <Spinner className="p-4 sm:p-6" />;
}

export default function EstimationsView() {
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
    return <div>Project not found</div>;
  }

  const currencySymbol = getCurrencySymbol(project.currency);
  const fallbackTaxSettings = resolveOrganizationTaxSettings(team?.organizationTaxSettings);
  const estimationPdfBrand = team
    ? {
        teamImageUrl:
          team.customOrganizationImageSetAt && team.imageUrl?.trim()
            ? team.imageUrl
            : undefined,
        teamName: team.name || 'Organization',
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
      label: getTaxAmountKindLabel(kind, taxSettings),
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
      case 'draft': return 'Draft';
      case 'accepted': return 'Accepted';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  };

  const handleDelete = async (id: Id<"costEstimations">) => {
    if (!confirm('Are you sure you want to delete this estimation?')) return;
    try {
      await deleteEstimation({ estimationId: id });
      toast.success('Estimation deleted');
    } catch {
      toast.error('Failed to delete estimation');
    }
  };

  const handleStatusChange = async (id: Id<"costEstimations">, status: VisibleEstimationStatus) => {
    try {
      await updateStatus({ estimationId: id, status });
      toast.success(`Status updated to ${getStatusLabel(status)}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleOpenPdf = async (estimationId: Id<"costEstimations">) => {
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      toast.error('Allow pop-ups to open the PDF in a new tab');
      return;
    }

    previewWindow.opener = null;
    previewWindow.document.write(
      '<!doctype html><html><head><title>Opening PDF…</title></head><body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f4f1ec;color:#4a3b2e;">Preparing PDF…</body></html>',
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
        toast.error('Estimation not found');
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
      toast.error('Failed to open PDF in a new tab', {
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
        toast.error('Estimation not found');
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
      toast.error('Failed to export PDF', {
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
        title="Cost Estimations"
        icon={<Calculator className="h-8 w-8 text-primary" />}
        tags={
          <>
            <Badge variant="outline" className="px-4 py-2 text-sm font-medium">
              {project.name}
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 text-sm font-medium">
              {visibleStats.total} estimations
            </Badge>
          </>
        }
        actions={
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="px-6"
          >
            <PlusIcon data-icon="inline-start" />
            New Estimation
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by title, number, customer, or location"
          className="h-11 md:max-w-md"
        />
        <Select
          value={statusFilter}
          onValueChange={(value) =>
            setStatusFilter(value as 'all' | VisibleEstimationStatus)
          }
        >
          <SelectTrigger className="h-11 md:w-[220px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {[
          { label: 'Draft', count: visibleStats.draft, className: 'border-border bg-muted text-muted-foreground' },
          { label: 'Accepted', count: visibleStats.accepted, className: 'border-border bg-primary/5 text-primary' },
          { label: 'Rejected', count: visibleStats.rejected, className: 'border-border bg-destructive/10 text-destructive' },
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
            <EmptyTitle>No Estimations Yet</EmptyTitle>
            <EmptyDescription>
              Create your first cost estimation to generate professional quotations for clients.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setIsCreateOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              Create Estimation
            </Button>
          </EmptyContent>
        </Empty>
      ) : filteredEstimations.length === 0 ? (
        <Empty className="rounded-3xl border-border/70 bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileTextIcon />
            </EmptyMedia>
            <EmptyTitle>No Matching Estimations</EmptyTitle>
            <EmptyDescription>
              Adjust the search or status filter to see more documents.
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
                Clear Filters
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
                        <span>Created: {format(new Date(estimation.estimationDate), 'MMM d, yyyy')}</span>
                        {validUntilLabel && (
                          <span>Valid until: {validUntilLabel}</span>
                        )}
                        {estimation.location && (
                          <span>{estimation.location}</span>
                        )}
                        {estimation.customerName && (
                          <span>Customer: {estimation.customerName}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">{totalAmount.label} total</div>
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
                        {openingPdfEstimationId === estimation._id ? 'Opening...' : 'Open PDF'}
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
                            {downloadingPdfEstimationId === estimation._id ? 'Exporting PDF...' : 'Download PDF'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingEstimationId(estimation._id)}>
                            <EditIcon className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleStatusChange(estimation._id, 'draft')}>
                            Set as Draft
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(estimation._id, 'accepted')}>
                            Mark as Accepted
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(estimation._id, 'rejected')}>
                            Mark as Rejected
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(estimation._id)}
                          >
                            <TrashIcon data-icon="inline-start" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-6 border-t border-border pt-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Labor ({laborAmount.label}): </span>
                      <span className="font-medium">{laborAmount.value.toFixed(2)} {currencySymbol}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Materials ({materialsAmount.label}): </span>
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
