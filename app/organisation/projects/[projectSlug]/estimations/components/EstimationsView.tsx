'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { apiAny } from '@/lib/convexApiAny';
import { Doc, Id } from '@/convex/_generated/dataModel';
import { useProject } from '@/components/providers/ProjectProvider';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  PlusIcon,
  Calculator,
  FileTextIcon,
  TrashIcon,
  EditIcon,
  EyeIcon,
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
import { EstimationPreviewDialog } from './EstimationPreviewDialog';
import { ProjectPageLayout } from '@/components/project/ProjectPageLayout';
import { ProjectPageHeader } from '@/components/project/ProjectPageHeader';

export function EstimationsViewSkeleton() {
  return <Spinner className="p-4 sm:p-6" />;
}

export default function EstimationsView() {
  const { project } = useProject();

  const estimations = useQuery(apiAny.costEstimations.listCostEstimations, { projectId: project._id });
  const stats = useQuery(apiAny.costEstimations.getEstimationStats, { projectId: project._id });

  const deleteEstimation = useMutation(apiAny.costEstimations.deleteCostEstimation);
  const updateStatus = useMutation(apiAny.costEstimations.updateEstimationStatus);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [previewEstimationId, setPreviewEstimationId] = useState<Id<"costEstimations"> | null>(null);

  if (estimations === undefined || stats === undefined) {
    return <EstimationsViewSkeleton />;
  }

  if (project === null) {
    return <div>Project not found</div>;
  }

  const currencySymbol = project.currency === "EUR" ? "€" : project.currency === "PLN" ? "zł" : "$";

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'sent': return 'default';
      case 'accepted': return 'default';
      case 'rejected': return 'destructive';
      case 'expired': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'sent': return 'Sent';
      case 'accepted': return 'Accepted';
      case 'rejected': return 'Rejected';
      case 'expired': return 'Expired';
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

  const handleStatusChange = async (id: Id<"costEstimations">, status: Doc<"costEstimations">["status"]) => {
    try {
      await updateStatus({ estimationId: id, status });
      toast.success(`Status updated to ${getStatusLabel(status)}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  return (
    <ProjectPageLayout>
      {/* Header */}
      <ProjectPageHeader
        title="Cost Estimations"
        icon={<Calculator className="h-8 w-8 text-[var(--ui-accent-brand)]" />}
        tags={
          <>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] px-4 py-2 text-sm font-medium text-[var(--ui-accent-brand)]">
              {project.name}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] px-4 py-2 text-sm font-medium text-[var(--ui-text-main)]">
              {stats.total} estimations
            </span>
            {stats.acceptedValue > 0 && (
              <span className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
                Accepted: {stats.acceptedValue.toFixed(2)} {currencySymbol}
              </span>
            )}
          </>
        }
        actions={
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="rounded-full bg-[var(--ui-action-bg)] px-6 text-[var(--primary-foreground)] shadow-[0_14px_36px_rgba(14,14,14,0.18)] hover:bg-[var(--ui-action-hover)] transition-transform hover:-translate-y-0.5"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            New Estimation
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        {[
          { label: 'Draft', count: stats.draft, color: 'bg-gray-100 text-gray-700' },
          { label: 'Sent', count: stats.sent, color: 'bg-blue-50 text-blue-700' },
          { label: 'Accepted', count: stats.accepted, color: 'bg-green-50 text-green-700' },
          { label: 'Rejected', count: stats.rejected, color: 'bg-red-50 text-red-700' },
          { label: 'Expired', count: stats.expired, color: 'bg-yellow-50 text-yellow-700' },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-[20px] p-4 ${stat.color}`}
          >
            <div className="text-2xl font-semibold">{stat.count}</div>
            <div className="text-sm opacity-80">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Estimations List */}
      {estimations.length === 0 ? (
        <div className="rounded-[32px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-12 text-center shadow-[0_24px_60px_rgba(20,20,20,0.08)]">
          <FileTextIcon className="h-16 w-16 mx-auto text-[var(--ui-text-subtle)] mb-4" />
          <h3 className="text-xl font-medium font-[var(--font-display-serif)] text-[var(--ui-text-strong)] mb-2">
            No Estimations Yet
          </h3>
          <p className="text-[var(--ui-text-muted)] mb-6">
            Create your first cost estimation to generate professional quotations for clients.
          </p>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="rounded-full bg-[var(--ui-action-bg)] px-6"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Estimation
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {estimations.map((estimation) => (
            <div
              key={estimation._id}
              className="rounded-[24px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-medium text-[var(--ui-text-strong)]">{estimation.title}</h3>
                    <Badge variant={getStatusColor(estimation.status)}>
                      {getStatusLabel(estimation.status)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-[var(--ui-text-muted)]">
                    {estimation.estimationNumber && (
                      <span>#{estimation.estimationNumber}</span>
                    )}
                    <span>Created: {format(new Date(estimation.estimationDate), 'MMM d, yyyy')}</span>
                    {estimation.location && (
                      <span>{estimation.location}</span>
                    )}
                    {estimation.customerName && (
                      <span>Client: {estimation.customerName}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-[var(--ui-text-muted)]">Gross Total</div>
                    <div className="text-xl font-semibold text-[var(--ui-text-strong)]">
                      {estimation.grossTotal?.toFixed(2) || '0.00'} {currencySymbol}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                        <MoreHorizontalIcon className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setPreviewEstimationId(estimation._id)}>
                        <EyeIcon className="h-4 w-4 mr-2" />
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <EditIcon className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleStatusChange(estimation._id, 'sent')}>
                        Mark as Sent
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(estimation._id, 'accepted')}>
                        Mark as Accepted
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(estimation._id, 'rejected')}>
                        Mark as Rejected
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => handleDelete(estimation._id)}
                      >
                        <TrashIcon className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Summary Row */}
              <div className="mt-4 pt-4 border-t border-[var(--ui-border-soft)] flex flex-wrap gap-6 text-sm">
                <div>
                  <span className="text-[var(--ui-text-muted)]">Labor: </span>
                  <span className="font-medium">{estimation.laborTotal?.toFixed(2) || '0.00'} {currencySymbol}</span>
                </div>
                <div>
                  <span className="text-[var(--ui-text-muted)]">Shopping List: </span>
                  <span className="font-medium">{estimation.materialsTotal?.toFixed(2) || '0.00'} {currencySymbol}</span>
                </div>
                <div>
                  <span className="text-[var(--ui-text-muted)]">VAT ({estimation.vatPercent}%): </span>
                  <span className="font-medium">{estimation.vatAmount?.toFixed(2) || '0.00'} {currencySymbol}</span>
                </div>
                {estimation.discountPercent && estimation.discountPercent > 0 && (
                  <div>
                    <span className="text-red-500">Discount ({estimation.discountPercent}%): </span>
                    <span className="font-medium text-red-500">-{estimation.discountAmount?.toFixed(2) || '0.00'} {currencySymbol}</span>
                  </div>
                )}
              </div>
            </div>
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

      {/* Preview Dialog */}
      {previewEstimationId && (
        <EstimationPreviewDialog
          open={!!previewEstimationId}
          onOpenChange={(open) => !open && setPreviewEstimationId(null)}
          estimationId={previewEstimationId}
          currencySymbol={currencySymbol}
        />
      )}
    </ProjectPageLayout>
  );
}
