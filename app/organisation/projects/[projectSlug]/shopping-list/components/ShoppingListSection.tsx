import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  EditIcon, 
  TrashIcon, 
  SaveIcon, 
  XIcon, 
  PlusIcon,
  CalendarIcon,
  ExternalLinkIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Doc, Id } from '@/convex/_generated/dataModel';
import type { TeamMember } from '@/lib/teamMember';
import { AddItemForm } from './AddItemForm';
import { ShoppingListItemDetails } from './ShoppingListItemDetails';

type ShoppingListItem = Doc<"shoppingListItems">;
type Priority = ShoppingListItem["priority"];

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
    setExpandedDetails(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const sectionTotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

  const handleStartEdit = (item: ShoppingListItem) => {
    setEditingItemId(item._id);
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
      assigneeId: item.assignedTo || 'none'
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
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'planned': return 'secondary';        // szary - planowane
      case 'ordered': return 'default';          // ciemny - zamówione  
      case 'in_transit': return 'destructive';   // czerwony - w transporcie  
      case 'delivered': return 'outline';        // border - dostarczone
      case 'completed': return 'default';        // ciemny - ukończone
      case 'cancelled': return 'secondary';      // szary - anulowane
      default: return 'secondary';
    }
  };

  const getAssignedMemberName = (assignedTo: string) => {
    const member = teamMembers?.find(m => m.clerkUserId === assignedTo);
    return member?.name || assignedTo;
  };


  return (
    <div className="mb-10 rounded-[24px] sm:rounded-[32px] border border-[#E7E2D9] bg-white p-4 sm:p-8 shadow-[0_24px_60px_rgba(20,20,20,0.08)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <h2 className="text-xl sm:text-2xl font-medium font-[var(--font-display-serif)] text-[#1A1A1A]">{sectionName}</h2>
          <span className="inline-flex items-center justify-center rounded-full bg-[#FAF7F2] border border-[#E7E2D9] px-3 py-1 text-xs font-medium text-[#8C8880]">
            {items.length} items
          </span>
          {sectionTotal > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-[#FAF7F2] border border-[#E7E2D9] px-3 py-1 text-xs font-medium text-[#3C3A37]">
              {sectionTotal.toFixed(2)} {currencySymbol}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="self-end sm:self-auto rounded-full hover:bg-[#FAF7F2]"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="space-y-4">
        {/* Add Item Form */}
        {showAddForm && (
          <div className="mb-8 rounded-[24px] border border-[#E7E2D9] bg-[#FAF7F2] p-6">
            <AddItemForm
              sections={sections}
              teamMembers={teamMembers}
              currencySymbol={currencySymbol}
              onAddItem={async (itemData) => {
                await onAddItem({
                  ...itemData,
                  sectionId: sectionId
                });
                setShowAddForm(false);
              }}
              isPending={isPending}
              defaultSectionId={sectionId}
            />
          </div>
        )}

        {/* Items List */}
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item._id} className="group relative rounded-[20px] border border-[#E7E2D9]/50 bg-white p-5 transition-all hover:border-[#E7E2D9] hover:shadow-sm">
              {editingItemId === item._id ? (
                // Edit Mode
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                        onChange={(e) => setEditFormData({ ...editFormData, quantity: parseInt(e.target.value) || 1 })}
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
                              !editFormData.buyBefore && "text-muted-foreground"
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
                      onClick={() => handleSaveEdit(item._id as Id<"shoppingListItems">)}
                      disabled={isPending}
                    >
                      <SaveIcon className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleCancelEdit}
                    >
                      <XIcon className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div>
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-2">
                    <div className="flex items-start gap-4 flex-1 w-full">
                      {item.imageUrl ? (
                        <div className="w-24 h-24 sm:w-20 sm:h-20 rounded-xl border border-[#E7E2D9] overflow-hidden flex-shrink-0 bg-[#FAF7F2]">
                          <img 
                            src={item.imageUrl} 
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-24 h-24 sm:w-20 sm:h-20 rounded-xl border border-[#E7E2D9] overflow-hidden flex-shrink-0 bg-[#FAF7F2] flex items-center justify-center text-[#C0B9AF]">
                           <span className="text-xs">No image</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0 py-1">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-medium text-lg text-[#1A1A1A] truncate pr-2">{item.name}</h4>
                          {item.priority && (
                             <div className={cn("w-2 h-2 rounded-full mt-2 flex-shrink-0", getPriorityColor(item.priority))} />
                          )}
                        </div>
                        
                        <div className="flex flex-col gap-1 text-sm text-[#3C3A37]">
                          <div className="flex items-center gap-3">
                             <span className="bg-[#FAF7F2] px-2 py-0.5 rounded-md border border-[#E7E2D9] text-xs font-medium">Qty: {item.quantity}</span>
                             {item.unitPrice && (
                               <span className="text-[#8C8880]">
                                 {item.unitPrice.toFixed(2)} {currencySymbol} / unit
                               </span>
                             )}
                          </div>
                          {item.totalPrice && (
                            <span className="font-medium mt-1">
                              Total: {item.totalPrice.toFixed(2)} {currencySymbol}
                            </span>
                          )}
                        </div>

                        {item.assignedTo && (
                          <div className="flex items-center gap-2 mt-3">
                            <Avatar className="h-6 w-6 border border-white shadow-sm">
                              <AvatarImage src={teamMembers?.find(m => m.clerkUserId === item.assignedTo)?.imageUrl} />
                              <AvatarFallback className="text-[10px] bg-[#FAF7F2] text-[#3C3A37]">
                                {getAssignedMemberName(item.assignedTo)?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-[#666]">
                              {getAssignedMemberName(item.assignedTo)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between w-full sm:w-auto sm:flex-col sm:items-end gap-3 sm:gap-2 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E7E2D9] sm:border-none mt-2 sm:mt-0">
                      <Badge variant={getStatusColor(item.realizationStatus)} className="order-1 sm:order-none text-xs px-2.5 py-0.5">
                        {item.realizationStatus}
                      </Badge>
                      <div className="flex gap-1 order-2 sm:order-none">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-[#8C8880] hover:text-[#1A1A1A] hover:bg-[#FAF7F2]"
                              onClick={() => toggleDetails(item._id)}
                            >
                              {expandedDetails[item._id] ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
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
                                className="h-8 w-8 p-0 text-[#8C8880] hover:text-[#1A1A1A] hover:bg-[#FAF7F2]"
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
                              className="h-8 w-8 p-0 text-[#8C8880] hover:text-[#1A1A1A] hover:bg-[#FAF7F2]"
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
                              className="h-8 w-8 p-0 text-[#8C8880] hover:bg-red-50 hover:text-red-600"
                              onClick={() => onDeleteItem(item._id)}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete item</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                  
                  {expandedDetails[item._id] && (
                    <div className="pt-4 border-t border-[#E7E2D9] mt-4 animate-in slide-in-from-top-2 duration-200">
                      <ShoppingListItemDetails item={item} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {items.length === 0 && !showAddForm && (
          <div className="text-center py-8 text-[#8C8880]">
            <p className="text-sm">No shopping items in this section</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setShowAddForm(true)}
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add first item
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
