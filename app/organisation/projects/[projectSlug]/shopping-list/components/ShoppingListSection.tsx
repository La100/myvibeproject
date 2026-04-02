import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckIcon,
  EditIcon,
  ExternalLinkIcon,
  PlusIcon,
  SaveIcon,
  TrashIcon,
  XIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Doc, Id } from '@/convex/_generated/dataModel';
import type { TeamMember } from '@/lib/teamMember';
import { buildAlternativeGroups, buildAlternativeSelection, calculateShoppingTotal, isItemCountedInShoppingTotal } from '@/lib/shoppingAlternatives';
import { AddItemForm } from './AddItemForm';
import { ShoppingListItemDetails } from './ShoppingListItemDetails';

type ShoppingListItem = Doc<"shoppingListItems"> & {
  alternativeToItemId?: Id<"shoppingListItems"> | null;
  selectedAlternativeItemId?: Id<"shoppingListItems"> | null;
  customerDecision?: "accepted" | "rejected" | null;
  customerDecisionComment?: string | null;
  customerDecisionUpdatedAt?: number;
  customerDecisionByName?: string | null;
};
type Priority = ShoppingListItem["priority"];

type AlternativeGroup = {
  root: ShoppingListItem;
  options: ShoppingListItem[];
  selectedOptionId: string;
  selectedOption: ShoppingListItem;
  hasAlternatives: boolean;
  isOrphanAlternative: boolean;
};

interface EditFormData {
  name?: string;
  notes?: string;
  supplier?: string;
  category?: string;
  sectionId?: string | Id<"shoppingListSections">;
  catalogNumber?: string;
  dimensions?: string;
  quantity?: number;
  unitPrice?: string;
  productLink?: string;
  imageUrl?: string;
  priority?: Priority;
  realizationStatus?: string;
  buyBefore?: string;
  assigneeId?: string;
  alternativeToItemId?: string | Id<"shoppingListItems">;
}

interface ShoppingListSectionProps {
  sectionName: string;
  sectionId?: Id<"shoppingListSections">;
  items: ShoppingListItem[];
  currencySymbol: string;
  teamMembers?: TeamMember[];
  sections: Doc<"shoppingListSections">[];
  onUpdateItem: (id: Id<"shoppingListItems">, updates: Partial<ShoppingListItem>) => Promise<void>;
  onDeleteItem: (id: Id<"shoppingListItems">) => Promise<void>;
  onAddItem: (itemData: {
    name: string;
    notes?: string;
    supplier?: string;
    category?: string;
    sectionId?: Id<"shoppingListSections">;
    catalogNumber?: string;
    dimensions?: string;
    quantity: number;
    unitPrice?: number;
    productLink?: string;
    imageUrl?: string;
    priority?: Priority;
    realizationStatus?: string;
    buyBefore?: number;
    assignedTo?: string;
  }) => Promise<void>;
  isPending: boolean;
}

export function ShoppingListSection({
  sectionName,
  sectionId,
  items,
  currencySymbol,
  teamMembers,
  sections,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  isPending
}: ShoppingListSectionProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  const toggleDetails = (itemId: string) => {
    setExpandedDetails((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const sectionTotal = calculateShoppingTotal(items);
  const selection = buildAlternativeSelection(items);
  const itemsById = new Map(items.map((item) => [String(item._id), item]));

  const alternativeGroups: AlternativeGroup[] = buildAlternativeGroups(items).map((group) => {
    const root = group.baseItem;
    const selectedOption =
      group.options.find((option) => String(option._id) === group.selectedItemId) || root;

    return {
      root,
      options: group.options,
      selectedOptionId: group.selectedItemId,
      selectedOption,
      hasAlternatives: group.options.length > 1,
      isOrphanAlternative: !!root.alternativeToItemId && !itemsById.has(String(root.alternativeToItemId)),
    };
  });

  const visibleGroupCount = alternativeGroups.length;
  const hiddenAlternativeCount = Math.max(0, items.length - visibleGroupCount);

  const handleStartEdit = (item: ShoppingListItem) => {
    setEditingItemId(String(item._id));
    setEditFormData({
      name: item.name,
      notes: item.notes || '',
      supplier: item.supplier || '',
      category: item.category || '',
      sectionId: item.sectionId || 'none',
      catalogNumber: item.catalogNumber || '',
      dimensions: item.dimensions || '',
      quantity: item.quantity,
      unitPrice: item.unitPrice ? item.unitPrice.toString() : '',
      productLink: item.productLink || '',
      imageUrl: item.imageUrl || '',
      priority: item.priority,
      realizationStatus: item.realizationStatus,
      buyBefore: item.buyBefore ? format(new Date(item.buyBefore), 'yyyy-MM-dd') : '',
      assigneeId: item.assignedTo || 'none',
      alternativeToItemId: item.alternativeToItemId || 'none',
    });
  };

  const handleSaveEdit = async (itemId: Id<"shoppingListItems">) => {
    const unitPrice = parseFloat(editFormData.unitPrice || '0') || undefined;
    const buyBefore = editFormData.buyBefore ? new Date(editFormData.buyBefore).getTime() : undefined;

    try {
      await onUpdateItem(itemId, {
        name: editFormData.name?.trim() || '',
        notes: editFormData.notes?.trim() || undefined,
        supplier: editFormData.supplier?.trim() || undefined,
        category: editFormData.category?.trim() || undefined,
        sectionId: editFormData.sectionId === 'none' ? undefined : editFormData.sectionId as Id<"shoppingListSections">,
        catalogNumber: editFormData.catalogNumber?.trim() || undefined,
        dimensions: editFormData.dimensions?.trim() || undefined,
        quantity: editFormData.quantity || 1,
        unitPrice: unitPrice,
        productLink: editFormData.productLink?.trim() || undefined,
        imageUrl: editFormData.imageUrl?.trim() || undefined,
        priority: editFormData.priority,
        realizationStatus: editFormData.realizationStatus as "PLANNED" | "ORDERED" | "IN_TRANSIT" | "DELIVERED" | "COMPLETED" | "CANCELLED",
        buyBefore: buyBefore,
        assignedTo: editFormData.assigneeId === 'none' ? undefined : editFormData.assigneeId,
        alternativeToItemId: editFormData.alternativeToItemId === 'none'
          ? null
          : editFormData.alternativeToItemId as Id<"shoppingListItems">,
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

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case 'urgent': return 'bg-destructive';
      case 'high': return 'bg-primary';
      case 'medium': return 'bg-muted-foreground';
      case 'low': return 'bg-secondary-foreground';
      default: return 'bg-border';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'planned': return 'secondary';
      case 'ordered': return 'default';
      case 'in_transit': return 'destructive';
      case 'delivered': return 'outline';
      case 'completed': return 'default';
      case 'cancelled': return 'secondary';
      default: return 'secondary';
    }
  };

  const getAssignedMemberName = (assignedTo: string) => {
    const member = teamMembers?.find((m) => m.clerkUserId === assignedTo);
    return member?.name || assignedTo;
  };

  const handleSelectAlternative = async (
    rootItemId: Id<"shoppingListItems">,
    selectedId: string,
  ) => {
    try {
      await onUpdateItem(rootItemId, {
        selectedAlternativeItemId:
          selectedId === String(rootItemId)
            ? null
            : (selectedId as Id<"shoppingListItems">),
      });
    } catch (error) {
      console.error('Error selecting alternative:', error);
    }
  };

  const renderEditForm = (item: ShoppingListItem) => (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="text-sm font-medium">Product Name</label>
          <Input
            value={editFormData.name || ''}
            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Section</label>
          <Select
            value={editFormData.sectionId || 'none'}
            onValueChange={(value) => setEditFormData({ ...editFormData, sectionId: value })}
          >
            <SelectTrigger>
              <SelectValue />
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
        <div>
          <label className="text-sm font-medium">Alternative For</label>
          <Select
            value={editFormData.alternativeToItemId || 'none'}
            onValueChange={(value) => setEditFormData({ ...editFormData, alternativeToItemId: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Alternative Group</SelectItem>
              {items
                .filter((candidate) => candidate._id !== item._id && !candidate.alternativeToItemId)
                .map((candidate) => (
                  <SelectItem key={candidate._id} value={candidate._id}>
                    {candidate.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Supplier</label>
          <Input
            value={editFormData.supplier || ''}
            onChange={(e) => setEditFormData({ ...editFormData, supplier: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Quantity</label>
          <Input
            type="number"
            min="1"
            value={editFormData.quantity || 1}
            onChange={(e) => setEditFormData({ ...editFormData, quantity: parseInt(e.target.value, 10) || 1 })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Unit Price ({currencySymbol})</label>
          <Input
            type="number"
            step="0.01"
            value={editFormData.unitPrice || ''}
            onChange={(e) => setEditFormData({ ...editFormData, unitPrice: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Category</label>
          <Input
            value={editFormData.category || ''}
            onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
            placeholder="e.g. Furniture"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Catalog Number</label>
          <Input
            value={editFormData.catalogNumber || ''}
            onChange={(e) => setEditFormData({ ...editFormData, catalogNumber: e.target.value })}
            placeholder="e.g. BU1K367PH-3BC1"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Dimensions</label>
          <Input
            value={editFormData.dimensions || ''}
            onChange={(e) => setEditFormData({ ...editFormData, dimensions: e.target.value })}
            placeholder="e.g. 4100 x 1200"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Product Link</label>
          <Input
            value={editFormData.productLink || ''}
            onChange={(e) => setEditFormData({ ...editFormData, productLink: e.target.value })}
            placeholder="https://..."
          />
        </div>
        <div>
          <label className="text-sm font-medium">Image URL</label>
          <Input
            value={editFormData.imageUrl || ''}
            onChange={(e) => setEditFormData({ ...editFormData, imageUrl: e.target.value })}
            placeholder="https://..."
          />
        </div>
        <div>
          <label className="text-sm font-medium">Priority</label>
          <Select
            value={editFormData.priority || 'medium'}
            onValueChange={(value) => setEditFormData({ ...editFormData, priority: value as Priority })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Status</label>
          <Select
            value={editFormData.realizationStatus || 'PLANNED'}
            onValueChange={(value) => setEditFormData({ ...editFormData, realizationStatus: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PLANNED">Planned</SelectItem>
              <SelectItem value="ORDERED">Ordered</SelectItem>
              <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
              <SelectItem value="DELIVERED">Delivered</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Assign To</label>
          <Select
            value={editFormData.assigneeId || 'none'}
            onValueChange={(value) => setEditFormData({ ...editFormData, assigneeId: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {teamMembers?.map((member) => (
                <SelectItem key={member.clerkUserId} value={member.clerkUserId}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={member.imageUrl} />
                      <AvatarFallback>{member.name?.[0]}</AvatarFallback>
                    </Avatar>
                    {member.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Buy Before</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !editFormData.buyBefore && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {editFormData.buyBefore ? format(new Date(editFormData.buyBefore), "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={editFormData.buyBefore ? new Date(editFormData.buyBefore) : undefined}
                onSelect={(date) => setEditFormData({ ...editFormData, buyBefore: date ? format(date, 'yyyy-MM-dd') : '' })}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <label className="text-sm font-medium">Notes</label>
          <Input
            value={editFormData.notes || ''}
            onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
            placeholder="Additional notes..."
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => handleSaveEdit(item._id)}
          disabled={isPending}
        >
          <SaveIcon className="mr-1 h-4 w-4" />
          Save
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancelEdit}
        >
          <XIcon className="mr-1 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </div>
  );

  const renderCustomerFeedback = (item: ShoppingListItem) => {
    if (
      item.customerDecision !== "accepted" &&
      item.customerDecision !== "rejected" &&
      (!item.customerDecisionComment || item.customerDecisionComment.trim().length === 0)
    ) {
      return null;
    }

    return (
      <div className="rounded-md border bg-muted/40 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Customer feedback:
          </span>
          <Badge
            variant={
              item.customerDecision === "accepted"
                ? "default"
                : item.customerDecision === "rejected"
                  ? "destructive"
                  : "secondary"
            }
            className={
              item.customerDecision ? "" : "border-border"
            }
          >
            {item.customerDecision === "accepted"
              ? "Accepted"
              : item.customerDecision === "rejected"
                ? "Rejected"
                : "Comment only"}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-foreground">
          {item.customerDecisionComment && item.customerDecisionComment.trim().length > 0
            ? item.customerDecisionComment
            : "No comment."}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {item.customerDecisionByName ? `${item.customerDecisionByName} · ` : ""}
          {item.customerDecisionUpdatedAt
            ? new Date(item.customerDecisionUpdatedAt).toLocaleString()
            : "No updates yet."}
        </p>
      </div>
    );
  };

  const renderItemActions = (item: ShoppingListItem) => (
    <div className="flex gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="size-8 p-0 text-muted-foreground"
            onClick={() => toggleDetails(String(item._id))}
          >
            {expandedDetails[String(item._id)] ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Show details</TooltipContent>
      </Tooltip>
      {item.productLink && (
        <Tooltip>
          <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
              className="size-8 p-0 text-muted-foreground"
              onClick={() => window.open(item.productLink, '_blank')}
            >
              <ExternalLinkIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open product link</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="size-8 p-0 text-muted-foreground"
            onClick={() => handleStartEdit(item)}
          >
            <EditIcon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Edit item</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="size-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDeleteItem(item._id)}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete item</TooltipContent>
      </Tooltip>
    </div>
  );

  const renderOptionRow = (
    item: ShoppingListItem,
    group: AlternativeGroup,
  ) => {
    const isAlternativeItem = String(item._id) !== String(group.root._id);
    const isSelectedOption = String(item._id) === group.selectedOptionId;
    const isCountedInTotal = isItemCountedInShoppingTotal(item, selection);

    return (
      <div
        key={item._id}
        className={cn(
          "rounded-2xl border p-4 transition-colors",
          isSelectedOption
            ? "bg-muted/40"
            : "border-border/60 bg-background",
        )}
      >
        {editingItemId === String(item._id) ? (
          renderEditForm(item)
        ) : (
          <div>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                {item.imageUrl && (
                  <div className="h-20 w-20 overflow-hidden rounded-xl border bg-muted/40">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-start gap-2">
                    <h4 className="flex-1 break-words pr-2 text-base font-medium leading-snug text-foreground">
                      {item.name}
                    </h4>
                    {item.priority && (
                      <div className={cn("mt-2 h-2 w-2 flex-shrink-0 rounded-full", getPriorityColor(item.priority))} />
                    )}
                  </div>

                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {group.isOrphanAlternative && (
                      <Badge variant="outline" className="text-xs">
                        Alternative linked outside this section
                      </Badge>
                    )}
                    {group.hasAlternatives && !isAlternativeItem && (
                      <Badge variant="outline" className="text-xs">
                        Base option
                      </Badge>
                    )}
                    {group.hasAlternatives && isAlternativeItem && (
                      <Badge variant="outline" className="text-xs">
                        Alternative
                      </Badge>
                    )}
                    {group.hasAlternatives && isSelectedOption && (
                      <Badge variant="default" className="text-xs">
                        Selected for total
                      </Badge>
                    )}
                    {group.hasAlternatives && !isSelectedOption && (
                      <Badge variant="secondary" className="text-xs">
                        Not counted in totals
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 text-sm text-foreground">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-md border bg-muted px-2 py-0.5 text-xs font-medium">
                        Qty: {item.quantity}
                      </span>
                      {item.unitPrice && (
                        <span className="text-muted-foreground">
                          {item.unitPrice.toFixed(2)} {currencySymbol} / unit
                        </span>
                      )}
                    </div>
                    {item.totalPrice && (
                      <span className={cn("mt-1 font-medium", group.hasAlternatives && !isCountedInTotal && "text-muted-foreground")}>
                        Total: {item.totalPrice.toFixed(2)} {currencySymbol}
                      </span>
                    )}
                    {item.catalogNumber && (
                      <span className="mt-1 text-xs text-muted-foreground">
                        Catalog #: <span className="font-medium text-foreground">{item.catalogNumber}</span>
                      </span>
                    )}
                  </div>

                  {item.assignedTo && (
                    <div className="mt-3 flex items-center gap-2">
                      <Avatar className="h-6 w-6 border border-border/70 shadow-sm">
                        <AvatarImage src={teamMembers?.find((member) => member.clerkUserId === item.assignedTo)?.imageUrl} />
                        <AvatarFallback className="bg-muted text-xs text-foreground">
                          {getAssignedMemberName(item.assignedTo)?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">
                        {getAssignedMemberName(item.assignedTo)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t pt-3 lg:w-auto lg:flex-col lg:items-end lg:border-t-0 lg:pt-0">
                <Badge variant={getStatusColor(item.realizationStatus)} className="text-xs px-2.5 py-0.5">
                  {item.realizationStatus}
                </Badge>
                {group.hasAlternatives && (
                  <Button
                    size="sm"
                    variant={isSelectedOption ? "default" : "outline"}
                    className={cn("min-w-[124px]", isSelectedOption && "pointer-events-none")}
                    onClick={() => handleSelectAlternative(group.root._id, String(item._id))}
                  >
                    {isSelectedOption ? (
                      <>
                        <CheckIcon className="mr-1 h-4 w-4" />
                        Counted
                      </>
                    ) : (
                      'Use for total'
                    )}
                  </Button>
                )}
                {renderItemActions(item)}
              </div>
            </div>

            {expandedDetails[String(item._id)] && (
              <div className="mt-4 animate-in slide-in-from-top-2 border-t pt-4 duration-200">
                <ShoppingListItemDetails item={item} teamMembers={teamMembers} />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mb-10 rounded-3xl border bg-card p-4 shadow-sm sm:p-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:mb-8 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <h2 className="text-xl font-medium text-foreground sm:text-2xl">{sectionName}</h2>
          <span className="inline-flex items-center justify-center rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {visibleGroupCount} {visibleGroupCount === 1 ? 'group' : 'groups'}
          </span>
          {hiddenAlternativeCount > 0 && (
            <span className="inline-flex items-center justify-center rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {hiddenAlternativeCount} hidden in groups
            </span>
          )}
          {sectionTotal > 0 && (
            <span className="inline-flex items-center justify-center rounded-full border bg-muted px-3 py-1 text-xs font-medium text-foreground">
              {sectionTotal.toFixed(2)} {currencySymbol}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="self-end rounded-full sm:self-auto"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        {showAddForm && (
          <div className="mb-8 rounded-3xl border bg-muted/40 p-6">
            <AddItemForm
              sections={sections}
              teamMembers={teamMembers}
              currencySymbol={currencySymbol}
              onAddItem={async (itemData) => {
                await onAddItem({
                  ...itemData,
                  sectionId: sectionId,
                });
                setShowAddForm(false);
              }}
              isPending={isPending}
              defaultSectionId={sectionId}
            />
          </div>
        )}

        <div className="flex flex-col gap-4">
          {alternativeGroups.map((group) => (
            (() => {
              const hasCustomerFeedback =
                (group.root.customerDecision === "accepted" || group.root.customerDecision === "rejected") ||
                !!group.root.customerDecisionComment?.trim();
              const shouldRenderGroupShell =
                group.hasAlternatives || group.isOrphanAlternative || hasCustomerFeedback;

              if (!shouldRenderGroupShell) {
                return (
                  <div key={group.root._id}>
                    {group.options.map((item) => renderOptionRow(item, group))}
                  </div>
                );
              }

              return (
                <div
                  key={group.root._id}
                  className="rounded-2xl border border-border/40 bg-transparent p-5"
                >
                  {(group.hasAlternatives || group.isOrphanAlternative) && (
                    <div className="mb-4 flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <h3 className="text-lg font-medium text-foreground">
                          {group.root.name}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {group.hasAlternatives && (
                            <Badge variant="outline" className="text-xs">
                              {group.options.length} options in this group
                            </Badge>
                          )}
                          {group.hasAlternatives && (
                            <Badge variant="secondary" className="text-xs">
                              Counted in total: {group.selectedOption.name}
                            </Badge>
                          )}
                          {group.isOrphanAlternative && (
                            <Badge variant="outline" className="text-xs">
                              Parent item is not in this section
                            </Badge>
                          )}
                        </div>
                      </div>
                      {group.hasAlternatives && (
                        <div className="max-w-xs text-sm text-muted-foreground">
                          Client choice is handled inside the option rows. The selected row is the only one counted in totals.
                        </div>
                      )}
                    </div>
                  )}

                  {!group.isOrphanAlternative && renderCustomerFeedback(group.root)}

                  <div className={cn("flex flex-col gap-3", !group.isOrphanAlternative && group.hasAlternatives && "mt-4")}>
                    {group.options.map((item) => renderOptionRow(item, group))}
                  </div>
                </div>
              );
            })()
          ))}
        </div>

        {items.length === 0 && !showAddForm && (
          <Empty className="py-8">
            <EmptyHeader>
              <EmptyTitle>No shopping items in this section</EmptyTitle>
              <EmptyDescription>Add the first product to start building this section.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
                <PlusIcon className="mr-2 h-4 w-4" />
                Add first item
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </div>
    </div>
  );
}
