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
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
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
  const [editingEstimationId, setEditingEstimationId] = useState<Id<"costEstimations"> | null>(null);
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
        icon={<Calculator className="h-8 w-8 text-primary" />}
        tags={
          <>
            <Badge variant="outline" className="px-4 py-2 text-sm font-medium">
              {project.name}
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 text-sm font-medium">
              {stats.total} estimations
            </Badge>
            {stats.acceptedValue > 0 && (
              <Badge variant="default" className="px-4 py-2 text-sm font-medium">
                Accepted: {stats.acceptedValue.toFixed(2)} {currencySymbol}
              </Badge>
            )}
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

      {/* Stats Cards */}
      <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          { label: 'Draft', count: stats.draft, className: 'border-border bg-muted text-muted-foreground' },
          { label: 'Sent', count: stats.sent, className: 'border-border bg-background text-foreground' },
          { label: 'Accepted', count: stats.accepted, className: 'border-border bg-primary/5 text-primary' },
          { label: 'Rejected', count: stats.rejected, className: 'border-border bg-destructive/10 text-destructive' },
          { label: 'Expired', count: stats.expired, className: 'border-border bg-muted text-muted-foreground' },
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
      ) : (
        <div className="flex flex-col gap-4">
          {estimations.map((estimation) => (
            <div
              key={estimation._id}
              className="rounded-3xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-medium text-foreground">{estimation.title}</h3>
                    <Badge variant={getStatusColor(estimation.status)}>
                      {getStatusLabel(estimation.status)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
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
                    <div className="text-sm text-muted-foreground">Gross Total</div>
                    <div className="text-xl font-semibold text-foreground">
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
                      <DropdownMenuItem onClick={() => setEditingEstimationId(estimation._id)}>
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

              {/* Summary Row */}
              <div className="mt-4 flex flex-wrap gap-6 border-t border-border pt-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Labor: </span>
                  <span className="font-medium">{estimation.laborTotal?.toFixed(2) || '0.00'} {currencySymbol}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Shopping List: </span>
                  <span className="font-medium">{estimation.materialsTotal?.toFixed(2) || '0.00'} {currencySymbol}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">VAT ({estimation.vatPercent}%): </span>
                  <span className="font-medium">{estimation.vatAmount?.toFixed(2) || '0.00'} {currencySymbol}</span>
                </div>
                {estimation.discountPercent && estimation.discountPercent > 0 && (
                  <div>
                    <span className="text-destructive">Discount ({estimation.discountPercent}%): </span>
                    <span className="font-medium text-destructive">-{estimation.discountAmount?.toFixed(2) || '0.00'} {currencySymbol}</span>
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

      {editingEstimationId && (
        <CreateEstimationDialog
          open={!!editingEstimationId}
          onOpenChange={(open) => !open && setEditingEstimationId(null)}
          projectId={project._id}
          currencySymbol={currencySymbol}
          estimationId={editingEstimationId}
        />
      )}

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
