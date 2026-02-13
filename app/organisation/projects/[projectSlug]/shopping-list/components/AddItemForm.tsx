import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Doc, Id } from '@/convex/_generated/dataModel';
import type { TeamMember } from '@/lib/teamMember';

interface AddItemFormProps {
  sections: Doc<"shoppingListSections">[];
  teamMembers?: TeamMember[];
  currencySymbol: string;
  onAddItem: (itemData: {
    name: string;
    supplier?: string;
    category?: string;
    sectionId?: Id<"shoppingListSections">;
    catalogNumber?: string;
    dimensions?: string;
    quantity: number;
    unitPrice?: number;
    productLink?: string;
    imageUrl?: string;
    priority: "low" | "medium" | "high" | "urgent";
    realizationStatus: "PLANNED" | "ORDERED" | "IN_TRANSIT" | "DELIVERED" | "COMPLETED" | "CANCELLED";
    assignedTo?: string;
    buyBefore?: number;
  }) => Promise<void>;
  isPending: boolean;
  defaultSectionId?: Id<"shoppingListSections">;
}

export function AddItemForm({
  sections,
  teamMembers,
  currencySymbol,
  onAddItem,
  isPending,
  defaultSectionId,
}: AddItemFormProps) {
  const [newItemName, setNewItemName] = useState('');
  const [newItemSupplier, setNewItemSupplier] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemSectionId, setNewItemSectionId] = useState<Id<"shoppingListSections"> | "none" | "">(defaultSectionId || "");
  const [newItemCatalogNumber, setNewItemCatalogNumber] = useState('');
  const [newItemDimensions, setNewItemDimensions] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemUnitPrice, setNewItemUnitPrice] = useState('');
  const [newItemProductLink, setNewItemProductLink] = useState('');
  const [newItemImageUrl, setNewItemImageUrl] = useState('');
  const [newItemAssignedTo, setNewItemAssignedTo] = useState<string>('none');
  const [newItemBuyBefore, setNewItemBuyBefore] = useState<Date | undefined>(undefined);

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;

    const unitPrice = parseFloat(newItemUnitPrice) || undefined;

    try {
      await onAddItem({
        name: newItemName.trim(),
        supplier: newItemSupplier.trim() || undefined,
        category: newItemCategory.trim() || undefined,
        sectionId: newItemSectionId === "none" ? undefined : (newItemSectionId || undefined),
        catalogNumber: newItemCatalogNumber.trim() || undefined,
        dimensions: newItemDimensions.trim() || undefined,
        quantity: newItemQuantity,
        unitPrice,
        productLink: newItemProductLink.trim() || undefined,
        imageUrl: newItemImageUrl.trim() || undefined,
        priority: "medium",
        realizationStatus: "PLANNED",
        assignedTo: newItemAssignedTo === 'none' ? undefined : newItemAssignedTo,
        buyBefore: newItemBuyBefore?.getTime(),
      });

      setNewItemName('');
      setNewItemSupplier('');
      setNewItemCategory('');
      setNewItemSectionId(defaultSectionId || '');
      setNewItemCatalogNumber('');
      setNewItemDimensions('');
      setNewItemQuantity(1);
      setNewItemUnitPrice('');
      setNewItemProductLink('');
      setNewItemImageUrl('');
      setNewItemAssignedTo('none');
      setNewItemBuyBefore(undefined);
    } catch (error) {
      console.error('Error creating item:', error);
    }
  };

  const totalPrice = newItemUnitPrice ? newItemQuantity * (parseFloat(newItemUnitPrice) || 0) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium text-[#3C3A37] mb-1.5 block">Product Name *</label>
          <Input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="e.g. Kitchen Countertop Navona"
            className="h-12 rounded-[18px] border-[#E7E2D9] bg-white text-sm focus-visible:ring-[#6D8B73]"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#3C3A37] mb-1.5 block">Section</label>
          <Select
            value={newItemSectionId}
            onValueChange={(value) => setNewItemSectionId(value as Id<"shoppingListSections"> | "none")}
          >
            <SelectTrigger className="h-12 rounded-[18px] border-[#E7E2D9] bg-white text-sm focus-visible:ring-[#6D8B73]">
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
        <div>
          <label className="text-sm font-medium text-[#3C3A37] mb-1.5 block">Supplier</label>
          <Input
            value={newItemSupplier}
            onChange={(e) => setNewItemSupplier(e.target.value)}
            placeholder="e.g. kronosfera.pl"
            className="h-12 rounded-[18px] border-[#E7E2D9] bg-white text-sm focus-visible:ring-[#6D8B73]"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#3C3A37] mb-1.5 block">Catalog Number</label>
          <Input
            value={newItemCatalogNumber}
            onChange={(e) => setNewItemCatalogNumber(e.target.value)}
            placeholder="e.g. BU1K367PH-3BC1"
            className="h-12 rounded-[18px] border-[#E7E2D9] bg-white text-sm focus-visible:ring-[#6D8B73]"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#3C3A37] mb-1.5 block">Category</label>
          <Input
            value={newItemCategory}
            onChange={(e) => setNewItemCategory(e.target.value)}
            placeholder="e.g. Furniture"
            className="h-12 rounded-[18px] border-[#E7E2D9] bg-white text-sm focus-visible:ring-[#6D8B73]"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#3C3A37] mb-1.5 block">Dimensions</label>
          <Input
            value={newItemDimensions}
            onChange={(e) => setNewItemDimensions(e.target.value)}
            placeholder="e.g. 4100 x 1200"
            className="h-12 rounded-[18px] border-[#E7E2D9] bg-white text-sm focus-visible:ring-[#6D8B73]"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#3C3A37] mb-1.5 block">Quantity</label>
          <Input
            type="number"
            min="1"
            value={newItemQuantity}
            onChange={(e) => setNewItemQuantity(parseInt(e.target.value, 10) || 1)}
            className="h-12 rounded-[18px] border-[#E7E2D9] bg-white text-sm focus-visible:ring-[#6D8B73]"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#3C3A37] mb-1.5 block">Unit Price ({currencySymbol})</label>
          <Input
            type="number"
            step="0.01"
            value={newItemUnitPrice}
            onChange={(e) => setNewItemUnitPrice(e.target.value)}
            placeholder="0.00"
            className="h-12 rounded-[18px] border-[#E7E2D9] bg-white text-sm focus-visible:ring-[#6D8B73]"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#3C3A37] mb-1.5 block">Product Link</label>
          <Input
            value={newItemProductLink}
            onChange={(e) => setNewItemProductLink(e.target.value)}
            placeholder="https://..."
            className="h-12 rounded-[18px] border-[#E7E2D9] bg-white text-sm focus-visible:ring-[#6D8B73]"
          />
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <label className="text-sm font-medium text-[#3C3A37] mb-1.5 block">Image URL</label>
          <Input
            value={newItemImageUrl}
            onChange={(e) => setNewItemImageUrl(e.target.value)}
            placeholder="https://..."
            className="h-12 rounded-[18px] border-[#E7E2D9] bg-white text-sm focus-visible:ring-[#6D8B73]"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#3C3A37] mb-1.5 block">Assign To</label>
          <Select
            value={newItemAssignedTo}
            onValueChange={setNewItemAssignedTo}
          >
            <SelectTrigger className="h-12 rounded-[18px] border-[#E7E2D9] bg-white text-sm focus-visible:ring-[#6D8B73]">
              <SelectValue placeholder="Select user" />
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
          <label className="text-sm font-medium text-[#3C3A37] mb-1.5 block">Buy Before</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal h-12 rounded-[18px] border-[#E7E2D9] bg-white text-sm hover:bg-[#FAF7F2]",
                  !newItemBuyBefore && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {newItemBuyBefore ? format(newItemBuyBefore, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={newItemBuyBefore}
                onSelect={setNewItemBuyBefore}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {totalPrice > 0 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-[#8C8880]">Total:</span>
          <span className="font-medium text-[#1A1A1A]">
            {totalPrice.toFixed(2)} {currencySymbol}
          </span>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button
          onClick={handleAddItem}
          disabled={isPending || !newItemName.trim()}
          className="rounded-full bg-[#0E0E0E] px-6 h-11 text-white shadow-[0_14px_36px_rgba(14,14,14,0.18)] hover:bg-[#1F1F1F]"
        >
          {isPending ? 'Adding...' : 'Add Product'}
        </Button>
      </div>
    </div>
  );
}
