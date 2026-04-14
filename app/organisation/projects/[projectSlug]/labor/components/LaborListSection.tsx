import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  EditIcon,
  TrashIcon,
  SaveIcon,
  XIcon,
  PlusIcon,
  ExternalLinkIcon,
  PaperclipIcon,
} from 'lucide-react';
import { Doc, Id } from '@/convex/_generated/dataModel';
import { AddLaborItemForm } from './AddLaborItemForm';
import {
  getDefaultLaborUnit,
  getLaborUnitsForMeasurementSystem,
  type MeasurementSystem,
} from './laborUnits';

type LaborItem = Doc<"laborItems">;

type TeamMember = {
  _id: Id<"teamMembers">;
  _creationTime: number;
  teamId: Id<"teams">;
  clerkUserId: string;
  clerkOrgId: string;
  role: string;
  permissions: string[];
  name: string;
  email: string;
  imageUrl?: string;
  joinedAt?: number;
  projectIds?: Id<"projects">[];
  isActive: boolean;
};

interface EditFormData {
  name?: string;
  notes?: string;
  sectionId?: string | Id<"laborSections">;
  quantity?: number;
  unit?: string;
  unitPrice?: string;
  assignedTo?: string;
}

interface LaborListSectionProps {
  projectId: Id<"projects">;
  sectionName: string;
  sectionId?: Id<"laborSections">;
  items: LaborItem[];
  currencySymbol: string;
  teamMembers?: TeamMember[];
  sections: Doc<"laborSections">[];
  onUpdateItem: (id: Id<"laborItems">, updates: Partial<LaborItem>) => Promise<void>;
  onDeleteItem: (id: Id<"laborItems">) => Promise<void>;
  onAddItem: (itemData: {
    name: string;
    notes?: string;
    sectionId?: Id<"laborSections">;
    quantity: number;
    unit: string;
    unitPrice?: number;
    assignedTo?: string;
    referenceLink?: string | null;
    attachmentFileId?: Id<"files"> | null;
  }) => Promise<void>;
  isPending: boolean;
  measurementSystem?: MeasurementSystem;
}

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
    setEditingItemId(item._id);
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

  const handleSaveEdit = async (itemId: Id<"laborItems">) => {
    const unitPrice = parseFloat(editFormData.unitPrice || '0') || undefined;

    try {
      await onUpdateItem(itemId, {
        name: editFormData.name?.trim() || '',
        notes: editFormData.notes?.trim() || undefined,
        sectionId: editFormData.sectionId === 'none' ? undefined : editFormData.sectionId as Id<"laborSections">,
        quantity: editFormData.quantity || 1,
        unit: editFormData.unit || defaultLaborUnit,
        unitPrice,
        assignedTo: editFormData.assignedTo === 'none' ? undefined : editFormData.assignedTo,
      });
      setEditingItemId(null);
      setEditFormData({});
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditFormData({});
  };

  const getAssignedMemberName = (assignedTo: string) => {
    const member = teamMembers?.find((entry) => entry.clerkUserId === assignedTo);
    return member?.name || assignedTo;
  };

  const getCustomerDecisionTone = (decision: LaborItem["customerDecision"] | undefined) => {
    if (decision === "accepted") {
      return "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
    }
    if (decision === "rejected") {
      return "border-destructive/20 bg-destructive/10 text-destructive";
    }
    return null;
  };

  const getCustomerDecisionLabel = (decision: LaborItem["customerDecision"] | undefined) => {
    if (decision === "accepted") return "Accepted";
    if (decision === "rejected") return "Rejected";
    return null;
  };

  return (
    <Card className="mb-10 rounded-3xl border bg-card p-4 shadow-sm sm:p-8">
      <CardHeader className="mb-6 flex flex-col justify-between gap-4 px-0 pt-0 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <CardTitle className="text-lg font-medium text-foreground sm:text-xl">{sectionName}</CardTitle>
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-medium">
            {items.length} items
          </Badge>
          {sectionTotal > 0 ? (
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
              {sectionTotal.toFixed(2)} {currencySymbol}
            </Badge>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="self-end rounded-full sm:self-auto"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 px-0 pb-0">
        {showAddForm ? (
          <div className="mb-8 rounded-3xl border bg-muted/40 p-6">
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
          <div className="overflow-hidden rounded-2xl border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Work Description</TableHead>
                  <TableHead className="w-24 text-right">Qty</TableHead>
                  <TableHead className="w-20 text-center">Unit</TableHead>
                  <TableHead className="w-32 text-right">Price/Unit</TableHead>
                  <TableHead className="w-32 text-right">Total</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item._id}
                    className={
                      item.customerDecision === "accepted"
                        ? "bg-emerald-500/6"
                        : item.customerDecision === "rejected"
                          ? "bg-destructive/5"
                          : undefined
                    }
                  >
                    {editingItemId === item._id ? (
                      <TableCell colSpan={6} className="bg-muted/20 p-4">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className="space-y-1.5 xl:col-span-2">
                            <p className="text-xs font-medium text-muted-foreground">Work Description</p>
                            <Input
                              value={editFormData.name || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                              className="h-10 rounded-lg text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">Section</p>
                            <Select
                              value={editFormData.sectionId || 'none'}
                              onValueChange={(value) => setEditFormData({ ...editFormData, sectionId: value })}
                            >
                              <SelectTrigger className="h-10 rounded-lg text-sm">
                                <SelectValue placeholder="Select section" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No Category</SelectItem>
                                {sections.map((section) => (
                                  <SelectItem key={section._id} value={section._id}>
                                    {section.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">Assign To</p>
                            <Select
                              value={editFormData.assignedTo || 'none'}
                              onValueChange={(value) => setEditFormData({ ...editFormData, assignedTo: value })}
                            >
                              <SelectTrigger className="h-10 rounded-lg text-sm">
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
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">Quantity</p>
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={editFormData.quantity || 1}
                              onChange={(e) => setEditFormData({ ...editFormData, quantity: parseFloat(e.target.value) || 1 })}
                              className="h-10 rounded-lg text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">Unit</p>
                            <Select
                              value={editFormData.unit || defaultLaborUnit}
                              onValueChange={(value) => setEditFormData({ ...editFormData, unit: value })}
                            >
                              <SelectTrigger className="h-10 rounded-lg text-sm">
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
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">Price / Unit</p>
                            <Input
                              type="number"
                              step="0.01"
                              value={editFormData.unitPrice || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, unitPrice: e.target.value })}
                              className="h-10 rounded-lg text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">Total</p>
                            <div className="flex h-10 items-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground">
                              {((editFormData.quantity || 0) * (parseFloat(editFormData.unitPrice || '0') || 0)).toFixed(2)} {currencySymbol}
                            </div>
                          </div>
                          <div className="space-y-1.5 md:col-span-2 xl:col-span-3">
                            <p className="text-xs font-medium text-muted-foreground">Notes</p>
                            <Input
                              value={editFormData.notes || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                              placeholder="Additional notes..."
                              className="h-10 rounded-lg text-sm"
                            />
                          </div>
                        </div>

                        <div className="mt-4 flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary hover:bg-primary/10 hover:text-primary"
                            onClick={() => handleSaveEdit(item._id)}
                            disabled={isPending}
                          >
                            <SaveIcon className="mr-1 h-4 w-4" />
                            Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            onClick={handleCancelEdit}
                          >
                            <XIcon className="mr-1 h-4 w-4" />
                            Cancel
                          </Button>
                        </div>
                      </TableCell>
                    ) : (
                      <>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-foreground">{item.name}</span>
                            {getCustomerDecisionLabel(item.customerDecision) ? (
                              <Badge
                                variant="outline"
                                className={getCustomerDecisionTone(item.customerDecision) || undefined}
                              >
                                {getCustomerDecisionLabel(item.customerDecision)}
                              </Badge>
                            ) : null}
                            {item.assignedTo ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Avatar className="h-6 w-6 border border-border/70 shadow-sm">
                                    <AvatarImage src={teamMembers?.find((member) => member.clerkUserId === item.assignedTo)?.imageUrl} />
                                    <AvatarFallback className="bg-muted text-[10px] text-foreground">
                                      {getAssignedMemberName(item.assignedTo)?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                </TooltipTrigger>
                                <TooltipContent>{getAssignedMemberName(item.assignedTo)}</TooltipContent>
                              </Tooltip>
                            ) : null}
                          </div>
                          {item.notes ? (
                            <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>
                          ) : null}
                          {item.customerDecisionComment ? (
                            <p className="mt-1 text-xs text-foreground/80">
                              Client: {item.customerDecisionComment}
                            </p>
                          ) : null}
                          <div className="mt-1 flex flex-wrap items-center gap-3">
                            {item.referenceLink ? (
                              <a
                                href={item.referenceLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <ExternalLinkIcon className="h-3 w-3" />
                                Link
                              </a>
                            ) : null}
                            {item.attachmentFileId ? (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <PaperclipIcon className="h-3 w-3" />
                                Attachment in Files/labor
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm text-foreground">{item.quantity}</TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">{item.unit}</TableCell>
                        <TableCell className="text-right text-sm text-foreground">
                          {item.unitPrice ? `${item.unitPrice.toFixed(2)} ${currencySymbol}` : '-'}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium text-foreground">
                          {item.totalPrice ? `${item.totalPrice.toFixed(2)} ${currencySymbol}` : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground"
                                  onClick={() => handleStartEdit(item)}
                                >
                                  <EditIcon className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => onDeleteItem(item._id)}
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="text-right text-sm font-medium text-foreground">
                    Section Total:
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold text-foreground">
                    {sectionTotal.toFixed(2)} {currencySymbol}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        ) : null}

        {items.length === 0 && !showAddForm ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 py-8 text-center text-muted-foreground">
            <p className="text-sm">No labor items in this section</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 rounded-full"
              onClick={() => setShowAddForm(true)}
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              Add first item
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
