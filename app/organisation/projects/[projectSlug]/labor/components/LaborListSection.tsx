import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  EditIcon,
  ExternalLinkIcon,
  PaperclipIcon,
  PlusIcon,
  SaveIcon,
  TrashIcon,
  XIcon,
} from 'lucide-react';
import { Doc, Id } from '@/convex/_generated/dataModel';
import { AddLaborItemForm } from './AddLaborItemForm';
import {
  getDefaultLaborUnit,
  getLaborUnitsForMeasurementSystem,
  type MeasurementSystem,
} from './laborUnits';
import { cn } from '@/lib/utils';

type LaborItem = Doc<'laborItems'>;

type TeamMember = {
  _id: Id<'teamMembers'>;
  _creationTime: number;
  teamId: Id<'teams'>;
  clerkUserId: string;
  clerkOrgId: string;
  role: string;
  permissions: string[];
  name: string;
  email: string;
  imageUrl?: string;
  joinedAt?: number;
  projectIds?: Id<'projects'>[];
  isActive: boolean;
};

interface EditFormData {
  name?: string;
  notes?: string;
  sectionId?: string | Id<'laborSections'>;
  quantity?: number;
  unit?: string;
  unitPrice?: string;
  assignedTo?: string;
}

interface LaborListSectionProps {
  projectId: Id<'projects'>;
  sectionName: string;
  sectionId?: Id<'laborSections'>;
  items: LaborItem[];
  currencySymbol: string;
  teamMembers?: TeamMember[];
  sections: Doc<'laborSections'>[];
  onUpdateItem: (id: Id<'laborItems'>, updates: Partial<LaborItem>) => Promise<void>;
  onDeleteItem: (id: Id<'laborItems'>) => Promise<void>;
  onAddItem: (itemData: {
    name: string;
    notes?: string;
    sectionId?: Id<'laborSections'>;
    quantity: number;
    unit: string;
    unitPrice?: number;
    assignedTo?: string;
    referenceLink?: string | null;
    attachmentFileId?: Id<'files'> | null;
  }) => Promise<void>;
  isPending: boolean;
  measurementSystem?: MeasurementSystem;
}

const formatItemCountLabel = (count: number) => `${count} ${count === 1 ? 'item' : 'items'}`;

export function LaborListSection({
  projectId,
  sectionName,
  sectionId,
  items,
  currencySymbol,
  teamMembers,
  sections,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  isPending,
  measurementSystem = 'metric',
}: LaborListSectionProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const laborUnits = getLaborUnitsForMeasurementSystem(measurementSystem);
  const defaultLaborUnit = getDefaultLaborUnit(measurementSystem);

  const sectionTotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

  const handleStartEdit = (item: LaborItem) => {
    setEditingItemId(String(item._id));
    setEditFormData({
      name: item.name,
      notes: item.notes || '',
      sectionId: item.sectionId || 'none',
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice ? item.unitPrice.toString() : '',
      assignedTo: item.assignedTo || 'none',
    });
  };

  const handleSaveEdit = async (itemId: Id<'laborItems'>) => {
    const nextName = editFormData.name?.trim() || '';
    if (!nextName) {
      return;
    }

    const unitPrice = parseFloat(editFormData.unitPrice || '0') || undefined;

    await onUpdateItem(itemId, {
      name: nextName,
      notes: editFormData.notes?.trim() || undefined,
      sectionId:
        editFormData.sectionId === 'none'
          ? undefined
          : (editFormData.sectionId as Id<'laborSections'>),
      quantity: editFormData.quantity || 1,
      unit: editFormData.unit || defaultLaborUnit,
      unitPrice,
      assignedTo: editFormData.assignedTo === 'none' ? undefined : editFormData.assignedTo,
    });
    setEditingItemId(null);
    setEditFormData({});
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditFormData({});
  };

  const getAssignedMemberName = (assignedTo?: string) => {
    if (!assignedTo) return null;
    const member = teamMembers?.find((entry) => entry.clerkUserId === assignedTo);
    return member?.name || assignedTo;
  };

  const getCustomerDecisionTone = (decision: LaborItem['customerDecision'] | undefined) => {
    if (decision === 'accepted') {
      return 'border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300';
    }
    if (decision === 'rejected') {
      return 'border-destructive/20 bg-destructive/10 text-destructive';
    }
    return null;
  };

  const getCustomerDecisionLabel = (decision: LaborItem['customerDecision'] | undefined) => {
    if (decision === 'accepted') return 'Accepted';
    if (decision === 'rejected') return 'Rejected';
    return null;
  };

  const renderEditForm = (item: LaborItem) => (
    <div className="flex flex-col gap-4 rounded-[28px] border border-border/70 bg-white p-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field className="lg:col-span-2">
          <FieldLabel>Work Item *</FieldLabel>
          <Input
            value={editFormData.name || ''}
            onChange={(event) => setEditFormData({ ...editFormData, name: event.target.value })}
            placeholder="e.g. Bathroom waterproofing"
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>Section</FieldLabel>
          <Select
            value={editFormData.sectionId || 'none'}
            onValueChange={(value) => setEditFormData({ ...editFormData, sectionId: value })}
          >
            <SelectTrigger className="h-12 text-sm">
              <SelectValue placeholder="Select section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Section</SelectItem>
              {sections.map((section) => (
                <SelectItem key={section._id} value={section._id}>
                  {section.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Quantity</FieldLabel>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={editFormData.quantity || 1}
            onChange={(event) => setEditFormData({ ...editFormData, quantity: parseFloat(event.target.value) || 1 })}
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>Unit</FieldLabel>
          <Select
            value={editFormData.unit || defaultLaborUnit}
            onValueChange={(value) => setEditFormData({ ...editFormData, unit: value })}
          >
            <SelectTrigger className="h-12 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {laborUnits.map((unit) => (
                <SelectItem key={unit.value} value={unit.value}>
                  {unit.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Unit Price ({currencySymbol})</FieldLabel>
          <Input
            type="number"
            step="0.01"
            value={editFormData.unitPrice || ''}
            onChange={(event) => setEditFormData({ ...editFormData, unitPrice: event.target.value })}
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>Assign To</FieldLabel>
          <Select
            value={editFormData.assignedTo || 'none'}
            onValueChange={(value) => setEditFormData({ ...editFormData, assignedTo: value })}
          >
            <SelectTrigger className="h-12 text-sm">
              <SelectValue placeholder="Select contractor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {teamMembers?.map((member) => (
                <SelectItem key={member.clerkUserId} value={member.clerkUserId}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field className="md:col-span-2 lg:col-span-3">
          <FieldLabel>Notes</FieldLabel>
          <Input
            value={editFormData.notes || ''}
            onChange={(event) => setEditFormData({ ...editFormData, notes: event.target.value })}
            placeholder="Additional scope, assumptions, or delivery notes"
            className="h-12 text-sm"
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => void handleSaveEdit(item._id)}
          disabled={isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <SaveIcon className="mr-1 h-4 w-4" />
          Save
        </Button>
        <Button variant="outline" size="sm" onClick={handleCancelEdit}>
          <XIcon className="mr-1 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </div>
  );

  const renderItemRow = (item: LaborItem) => {
    const itemId = String(item._id);
    const isEditing = editingItemId === itemId;
    const customerDecisionTone = getCustomerDecisionTone(item.customerDecision);
    const customerDecisionLabel = getCustomerDecisionLabel(item.customerDecision);
    const assignedName = getAssignedMemberName(item.assignedTo);

    return (
      <div
        key={item._id}
        className={cn(
          'rounded-[28px] border border-border/70 px-5 py-4',
          customerDecisionTone &&
            (item.customerDecision === 'accepted'
              ? 'border-emerald-500/25 bg-emerald-500/6'
              : 'border-destructive/20 bg-destructive/5'),
          !customerDecisionTone && 'bg-white',
        )}
      >
        {isEditing ? (
          renderEditForm(item)
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h4 className="text-[15px] font-semibold text-foreground">{item.name}</h4>
                {customerDecisionLabel ? (
                  <Badge variant="outline" className={cn('text-xs', customerDecisionTone)}>
                    {customerDecisionLabel}
                  </Badge>
                ) : null}
                {assignedName ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6 border border-border/70">
                      <AvatarImage src={teamMembers?.find((member) => member.clerkUserId === item.assignedTo)?.imageUrl} />
                      <AvatarFallback>{assignedName[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">{assignedName}</span>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground/75">
                  Qty {item.quantity} {item.unit}
                </span>
                <span>
                  Unit: {item.unitPrice ? `${item.unitPrice.toFixed(2)} ${currencySymbol}` : '-'}
                </span>
                <span className="font-medium text-foreground">
                  Total: {item.totalPrice ? `${item.totalPrice.toFixed(2)} ${currencySymbol}` : '-'}
                </span>
              </div>

              {item.notes ? (
                <p className="mt-3 text-sm text-muted-foreground">{item.notes}</p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {item.referenceLink ? (
                  <a
                    href={item.referenceLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLinkIcon className="h-3 w-3" />
                    Reference link
                  </a>
                ) : null}
                {item.attachmentFileId ? (
                  <span className="inline-flex items-center gap-1">
                    <PaperclipIcon className="h-3 w-3" />
                    Attachment saved in Files/labor
                  </span>
                ) : null}
                {item.customerDecisionComment ? (
                  <span>Client: {item.customerDecisionComment}</span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1 lg:justify-end">
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                onClick={() => handleStartEdit(item)}
              >
                <EditIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDeleteItem(item._id)}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mb-10 rounded-[32px] border border-border/70 bg-white p-5 shadow-sm sm:p-8">
      <div className="mb-7 flex flex-col justify-between gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-foreground">{sectionName}</h2>
          <span className="inline-flex items-center justify-center rounded-full border border-border/60 bg-white px-3 py-1 text-xs font-medium text-muted-foreground">
            {formatItemCountLabel(items.length)}
          </span>
          <span className="inline-flex items-center justify-center rounded-full border border-border/60 bg-secondary/25 px-3 py-1 text-xs font-medium text-foreground">
            Total: {sectionTotal.toFixed(2)} {currencySymbol}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="self-end rounded-full border border-border/60 bg-white sm:self-auto"
          onClick={() => setShowAddForm((current) => !current)}
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>

      {showAddForm ? (
        <div className="mb-8 rounded-[28px] border border-border/70 bg-secondary/15 p-6">
          <AddLaborItemForm
            projectId={projectId}
            sections={sections}
            teamMembers={teamMembers}
            currencySymbol={currencySymbol}
            onAddItem={async (itemData) => {
              await onAddItem({
                ...itemData,
                sectionId,
              });
              setShowAddForm(false);
            }}
            isPending={isPending}
            defaultSectionId={sectionId}
            isInline={true}
            measurementSystem={measurementSystem}
          />
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="flex flex-col gap-3">
          {items.map((item) => renderItemRow(item))}
        </div>
      ) : null}

      {items.length === 0 && !showAddForm ? (
        <div className="rounded-[28px] border border-dashed border-border/80 bg-white px-8 py-12 text-center">
          <p className="text-sm font-medium text-foreground">No labor items in this section yet</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 rounded-full border-border/70 bg-white"
            onClick={() => setShowAddForm(true)}
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            Add first item
          </Button>
        </div>
      ) : null}
    </div>
  );
}
