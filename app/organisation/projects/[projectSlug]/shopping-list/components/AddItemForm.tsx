import { useState } from 'react';
import type { CheckedState } from '@radix-ui/react-checkbox';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CalendarIcon, Loader2, WandSparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Doc, Id } from '@/convex/_generated/dataModel';
import type { TeamMember } from '@/lib/teamMember';
import { toast } from 'sonner';

interface AddItemFormProps {
  projectId: Id<"projects">;
  teamId: Id<"teams">;
  sections: Doc<"shoppingListSections">[];
  teamMembers?: TeamMember[];
  currencySymbol: string;
  onAddItem: (itemData: {
    name: string;
    supplier?: string;
    category?: string;
    sectionId?: Id<"shoppingListSections">;
    setId?: Id<"shoppingSets">;
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
  }) => Promise<Id<"shoppingListItems"> | void>;
  onEnableAlternatives?: (
    itemId: Id<"shoppingListItems">,
    itemName: string,
    sectionId?: Id<"shoppingListSections">,
  ) => Promise<Id<"shoppingSets"> | void>;
  isPending: boolean;
  defaultSectionId?: Id<"shoppingListSections">;
  defaultSetId?: Id<"shoppingSets">;
  hideSectionField?: boolean;
  hideAlternativeControls?: boolean;
  submitLabel?: string;
}

export function AddItemForm({
  projectId,
  teamId,
  sections,
  teamMembers,
  currencySymbol,
  onAddItem,
  onEnableAlternatives,
  isPending,
  defaultSectionId,
  defaultSetId,
  hideSectionField = false,
  hideAlternativeControls = false,
  submitLabel = 'Add Product',
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
  const [isScraping, setIsScraping] = useState(false);
  const [newItemHasAlternatives, setNewItemHasAlternatives] = useState(false);

  const normalizeProductUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';

    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Invalid URL protocol');
    }
    return parsed.toString();
  };

  const handleScrapeByUrl = async () => {
    const rawUrl = newItemProductLink.trim();
    if (!rawUrl || isScraping) {
      return;
    }

    let normalizedUrl = '';
    try {
      normalizedUrl = normalizeProductUrl(rawUrl);
    } catch {
      toast.error('Invalid product URL');
      return;
    }

    setIsScraping(true);
    setNewItemProductLink(normalizedUrl);

    try {
      const response = await fetch(
        `/api/shopping/scrape?projectId=${encodeURIComponent(String(projectId))}&teamId=${encodeURIComponent(String(teamId))}&url=${encodeURIComponent(normalizedUrl)}`,
      );
      const payload = (await response.json()) as {
        message?: string;
        name?: string;
        supplier?: string;
        category?: string;
        catalogNumber?: string;
        dimensions?: string;
        unitPrice?: number;
        productLink?: string;
        imageUrl?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message || 'Failed to scrape product details');
      }

      if (payload.name) setNewItemName(payload.name);
      if (payload.supplier) setNewItemSupplier(payload.supplier);
      if (payload.category) setNewItemCategory(payload.category);
      if (payload.catalogNumber) setNewItemCatalogNumber(payload.catalogNumber);
      if (payload.dimensions) setNewItemDimensions(payload.dimensions);
      if (typeof payload.unitPrice === 'number' && Number.isFinite(payload.unitPrice)) {
        setNewItemUnitPrice(String(payload.unitPrice));
      }
      if (payload.imageUrl) setNewItemImageUrl(payload.imageUrl);
      if (payload.productLink) setNewItemProductLink(payload.productLink);

      toast.success('Product details imported from URL');
    } catch (error) {
      toast.error((error as Error).message || 'Could not import product details');
    } finally {
      setIsScraping(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;

    let normalizedProductLink: string | undefined;
    if (newItemProductLink.trim()) {
      try {
        normalizedProductLink = normalizeProductUrl(newItemProductLink);
      } catch {
        toast.error('Invalid product URL');
        return;
      }
    }

    const unitPrice = parseFloat(newItemUnitPrice) || undefined;

    try {
      const itemId = await onAddItem({
        name: newItemName.trim(),
        supplier: newItemSupplier.trim() || undefined,
        category: newItemCategory.trim() || undefined,
        sectionId: newItemSectionId === "none" ? undefined : (newItemSectionId || undefined),
        setId: defaultSetId,
        catalogNumber: newItemCatalogNumber.trim() || undefined,
        dimensions: newItemDimensions.trim() || undefined,
        quantity: newItemQuantity,
        unitPrice,
        productLink: normalizedProductLink,
        imageUrl: newItemImageUrl.trim() || undefined,
        priority: "medium",
        realizationStatus: "PLANNED",
        assignedTo: newItemAssignedTo === 'none' ? undefined : newItemAssignedTo,
        buyBefore: newItemBuyBefore?.getTime(),
      });

      if (
        itemId &&
        !defaultSetId &&
        !hideAlternativeControls &&
        newItemHasAlternatives &&
        onEnableAlternatives
      ) {
        await onEnableAlternatives(
          itemId,
          newItemName.trim(),
          newItemSectionId === "none" ? undefined : (newItemSectionId || undefined),
        );
      }

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
      setNewItemHasAlternatives(false);
    } catch (error) {
      console.error('Error creating item:', error);
    }
  };

  const totalPrice = newItemUnitPrice ? newItemQuantity * (parseFloat(newItemUnitPrice) || 0) : 0;

  return (
    <div className="flex flex-col gap-4">
      {defaultSetId ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          This will be added as another option for the current product.
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Field>
          <FieldLabel>Product Name *</FieldLabel>
          <Input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="e.g. Kitchen Countertop Navona"
            className="h-12 text-sm"
          />
        </Field>
        {!hideSectionField ? (
          <Field>
            <FieldLabel>Section</FieldLabel>
            <Select
              value={newItemSectionId}
              onValueChange={(value) => setNewItemSectionId(value as Id<"shoppingListSections"> | "none")}
            >
              <SelectTrigger className="h-12 text-sm">
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
          </Field>
        ) : null}
        <Field>
          <FieldLabel>Supplier</FieldLabel>
          <Input
            value={newItemSupplier}
            onChange={(e) => setNewItemSupplier(e.target.value)}
            placeholder="e.g. kronosfera.pl"
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>Catalog Number</FieldLabel>
          <Input
            value={newItemCatalogNumber}
            onChange={(e) => setNewItemCatalogNumber(e.target.value)}
            placeholder="e.g. BU1K367PH-3BC1"
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>Category</FieldLabel>
          <Input
            value={newItemCategory}
            onChange={(e) => setNewItemCategory(e.target.value)}
            placeholder="e.g. Furniture"
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>Dimensions</FieldLabel>
          <Input
            value={newItemDimensions}
            onChange={(e) => setNewItemDimensions(e.target.value)}
            placeholder="e.g. 4100 x 1200"
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>Quantity</FieldLabel>
          <Input
            type="number"
            min="1"
            value={newItemQuantity}
            onChange={(e) => setNewItemQuantity(parseInt(e.target.value, 10) || 1)}
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>Unit Price ({currencySymbol})</FieldLabel>
          <Input
            type="number"
            step="0.01"
            value={newItemUnitPrice}
            onChange={(e) => setNewItemUnitPrice(e.target.value)}
            placeholder="0.00"
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>Product Link</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              value={newItemProductLink}
              onChange={(e) => setNewItemProductLink(e.target.value)}
              placeholder="https://..."
              className="h-12 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              disabled={isPending || isScraping || !newItemProductLink.trim()}
              onClick={handleScrapeByUrl}
              className="h-12 shrink-0 px-4"
            >
              {isScraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
              <span className="ml-2 hidden xl:inline">{isScraping ? 'Scraping...' : 'Auto-fill'}</span>
            </Button>
          </div>
        </Field>
        <Field className="md:col-span-2 lg:col-span-3">
          <FieldLabel>Image URL</FieldLabel>
          <Input
            value={newItemImageUrl}
            onChange={(e) => setNewItemImageUrl(e.target.value)}
            placeholder="https://..."
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>Assign To</FieldLabel>
          <Select
            value={newItemAssignedTo}
            onValueChange={setNewItemAssignedTo}
          >
            <SelectTrigger className="h-12 text-sm">
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
        </Field>
        <Field>
          <FieldLabel>Buy Before</FieldLabel>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "h-12 w-full justify-start text-left font-normal text-sm",
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
        </Field>
      </div>

      {!defaultSetId && !hideAlternativeControls ? (
        <div className="flex items-start gap-3 rounded-2xl border bg-muted/20 px-4 py-3">
          <Checkbox
            id="new-item-has-alternatives"
            checked={newItemHasAlternatives}
            onCheckedChange={(checked: CheckedState) => setNewItemHasAlternatives(checked === true)}
            className="mt-0.5"
          />
          <label htmlFor="new-item-has-alternatives" className="cursor-pointer text-sm leading-6">
            <span className="font-medium text-foreground">Has alternatives?</span>
            <span className="block text-muted-foreground">
              Enable this if the client should choose one option from a few versions of this product.
            </span>
          </label>
        </div>
      ) : null}

      {totalPrice > 0 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-medium text-foreground">
            {totalPrice.toFixed(2)} {currencySymbol}
          </span>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button
          onClick={handleAddItem}
          disabled={isPending || isScraping || !newItemName.trim()}
          className="h-11 px-6"
        >
          {isPending ? 'Adding...' : submitLabel}
        </Button>
      </div>
    </div>
  );
}
