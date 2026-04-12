import { useMemo, useState } from "react";
import { Doc, Id } from "@/convex/_generated/dataModel";
import type { TeamMember } from "@/lib/teamMember";
import { buildShoppingSetContext, calculateShoppingTotal, isItemCountedInShoppingTotal } from "@/lib/shoppingSets";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { AddItemForm } from "./AddItemForm";
import { ShoppingListItemDetails } from "./ShoppingListItemDetails";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EditIcon,
  ExternalLinkIcon,
  CalendarIcon,
  Layers3Icon,
  Loader2,
  PlusIcon,
  SaveIcon,
  TrashIcon,
  WandSparkles,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type ShoppingListItem = Doc<"shoppingListItems">;
type ShoppingSet = Doc<"shoppingSets">;
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
  hasAlternatives?: boolean;
}

interface ShoppingListSectionProps {
  projectId: Id<"projects">;
  teamId: Id<"teams">;
  sectionName: string;
  sectionId?: Id<"shoppingListSections">;
  items: ShoppingListItem[];
  sets: ShoppingSet[];
  allSets: ShoppingSet[];
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
    setId?: Id<"shoppingSets">;
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
  }) => Promise<Id<"shoppingListItems"> | void>;
  onCreateAlternativesForItem: (
    itemId: Id<"shoppingListItems">,
    itemName: string,
    sectionId?: Id<"shoppingListSections">,
  ) => Promise<Id<"shoppingSets">>;
  onUpdateSet: (
    id: Id<"shoppingSets">,
    updates: Partial<Doc<"shoppingSets">>,
  ) => Promise<void>;
  onDeleteSet: (id: Id<"shoppingSets">) => Promise<void>;
  isPending: boolean;
}

export function ShoppingListSection({
  projectId,
  teamId,
  sectionName,
  sectionId,
  items,
  sets,
  allSets,
  currencySymbol,
  teamMembers,
  sections,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onCreateAlternativesForItem,
  onUpdateSet,
  onDeleteSet,
  isPending,
}: ShoppingListSectionProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({});
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingAlternativeSetId, setAddingAlternativeSetId] = useState<string | null>(null);
  const [isEditScraping, setIsEditScraping] = useState(false);

  const setsById = useMemo(
    () => new Map(allSets.map((set) => [String(set._id), set])),
    [allSets],
  );
  const sectionSets = useMemo(
    () => sets.slice().sort((left, right) => left.order - right.order || left.title.localeCompare(right.title)),
    [sets],
  );
  const standaloneItems = useMemo(
    () =>
      items.filter((item) => {
        if (!item.setId) return true;
        const set = setsById.get(String(item.setId));
        return !set || String(set.sectionId ?? "") !== String(sectionId ?? "");
      }),
    [items, sectionId, setsById],
  );

  const setContext = buildShoppingSetContext(items, sets);
  const sectionTotal = calculateShoppingTotal(items, sets);

  const getAssignedMemberName = (assignedTo?: string) => {
    if (!assignedTo) return null;
    const member = teamMembers?.find((entry) => entry.clerkUserId === assignedTo);
    return member?.name || assignedTo;
  };

  const toggleDetails = (itemId: string) => {
    setExpandedDetails((current) => ({
      ...current,
      [itemId]: !current[itemId],
    }));
  };

  const normalizeProductUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";

    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Invalid URL protocol");
    }
    return parsed.toString();
  };

  const handleStartEdit = (item: ShoppingListItem) => {
    setEditingItemId(String(item._id));
    setEditFormData({
      name: item.name,
      notes: item.notes || "",
      supplier: item.supplier || "",
      category: item.category || "",
      sectionId: item.sectionId || "none",
      catalogNumber: item.catalogNumber || "",
      dimensions: item.dimensions || "",
      quantity: item.quantity,
      unitPrice: item.unitPrice ? item.unitPrice.toString() : "",
      productLink: item.productLink || "",
      imageUrl: item.imageUrl || "",
      priority: item.priority,
      realizationStatus: item.realizationStatus,
      buyBefore: item.buyBefore ? format(new Date(item.buyBefore), "yyyy-MM-dd") : "",
      assigneeId: item.assignedTo || "none",
      hasAlternatives: Boolean(item.setId),
    });
  };

  const handleSaveEdit = async (itemId: Id<"shoppingListItems">) => {
    const item = items.find((entry) => entry._id === itemId);
    if (!item) {
      return;
    }

    const nextName = editFormData.name?.trim() || "";
    if (!nextName) {
      toast.error("Product name is required");
      return;
    }

    const unitPrice = parseFloat(editFormData.unitPrice || "0") || undefined;
    const buyBefore = editFormData.buyBefore ? new Date(editFormData.buyBefore).getTime() : undefined;
    const nextSectionId =
      editFormData.sectionId === "none"
        ? undefined
        : (editFormData.sectionId as Id<"shoppingListSections"> | undefined);
    const wantsAlternatives = editFormData.hasAlternatives ?? Boolean(item.setId);
    const relatedSetItems = item.setId
      ? items.filter((entry) => String(entry.setId ?? "") === String(item.setId))
      : [];
    let nextSetId = item.setId ?? null;

    if (wantsAlternatives && !item.setId) {
      nextSetId = await onCreateAlternativesForItem(item._id, nextName, nextSectionId);
    }

    if (!wantsAlternatives && item.setId) {
      if (relatedSetItems.length > 1) {
        toast.error("Remove the other alternative options first.");
        return;
      }
      await onDeleteSet(item.setId);
      nextSetId = null;
    }

    await onUpdateItem(itemId, {
      name: nextName,
      notes: editFormData.notes?.trim() || undefined,
      supplier: editFormData.supplier?.trim() || undefined,
      category: editFormData.category?.trim() || undefined,
      sectionId: nextSectionId,
      setId: nextSetId,
      catalogNumber: editFormData.catalogNumber?.trim() || undefined,
      dimensions: editFormData.dimensions?.trim() || undefined,
      quantity: editFormData.quantity || 1,
      unitPrice,
      productLink: editFormData.productLink?.trim() || undefined,
      imageUrl: editFormData.imageUrl?.trim() || undefined,
      priority: editFormData.priority,
      realizationStatus: editFormData.realizationStatus as ShoppingListItem["realizationStatus"],
      buyBefore,
      assignedTo: editFormData.assigneeId === "none" ? undefined : editFormData.assigneeId,
    });
    setEditingItemId(null);
    setEditFormData({});
  };

  const handleEditScrapeByUrl = async () => {
    const rawUrl = editFormData.productLink?.trim() || "";
    if (!rawUrl || isEditScraping) {
      return;
    }

    let normalizedUrl = "";
    try {
      normalizedUrl = normalizeProductUrl(rawUrl);
    } catch {
      toast.error("Invalid product URL");
      return;
    }

    setIsEditScraping(true);
    setEditFormData((current) => ({ ...current, productLink: normalizedUrl }));

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
        throw new Error(payload.message || "Failed to scrape product details");
      }

      setEditFormData((current) => ({
        ...current,
        name: payload.name ?? current.name,
        supplier: payload.supplier ?? current.supplier,
        category: payload.category ?? current.category,
        catalogNumber: payload.catalogNumber ?? current.catalogNumber,
        dimensions: payload.dimensions ?? current.dimensions,
        unitPrice:
          typeof payload.unitPrice === "number" && Number.isFinite(payload.unitPrice)
            ? String(payload.unitPrice)
            : current.unitPrice,
        imageUrl: payload.imageUrl ?? current.imageUrl,
        productLink: payload.productLink ?? current.productLink,
      }));

      toast.success("Product details imported from URL");
    } catch (error) {
      toast.error((error as Error).message || "Could not import product details");
    } finally {
      setIsEditScraping(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PLANNED":
        return "secondary";
      case "ORDERED":
      case "COMPLETED":
        return "default";
      case "IN_TRANSIT":
        return "destructive";
      default:
        return "outline";
    }
  };

  const renderEditForm = (item: ShoppingListItem) => (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-5 shadow-none">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field>
          <FieldLabel>Product Name *</FieldLabel>
          <Input
            value={editFormData.name || ""}
            onChange={(event) => setEditFormData({ ...editFormData, name: event.target.value })}
            placeholder="e.g. Kitchen Countertop Navona"
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>Section</FieldLabel>
          <Select
            value={editFormData.sectionId || "none"}
            onValueChange={(value) => setEditFormData({ ...editFormData, sectionId: value })}
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
        <Field>
          <FieldLabel>Supplier</FieldLabel>
          <Input
            value={editFormData.supplier || ""}
            onChange={(event) => setEditFormData({ ...editFormData, supplier: event.target.value })}
            placeholder="e.g. kronosfera.pl"
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>Catalog Number</FieldLabel>
          <Input
            value={editFormData.catalogNumber || ""}
            onChange={(event) => setEditFormData({ ...editFormData, catalogNumber: event.target.value })}
            placeholder="e.g. BU1K367PH-3BC1"
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>Category</FieldLabel>
          <Input
            value={editFormData.category || ""}
            onChange={(event) => setEditFormData({ ...editFormData, category: event.target.value })}
            placeholder="e.g. Furniture"
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>Dimensions</FieldLabel>
          <Input
            value={editFormData.dimensions || ""}
            onChange={(event) => setEditFormData({ ...editFormData, dimensions: event.target.value })}
            placeholder="e.g. 4100 x 1200"
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>Quantity</FieldLabel>
          <Input
            type="number"
            min="1"
            value={editFormData.quantity || 1}
            onChange={(event) => setEditFormData({ ...editFormData, quantity: parseInt(event.target.value, 10) || 1 })}
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>Unit Price ({currencySymbol})</FieldLabel>
          <Input
            type="number"
            step="0.01"
            value={editFormData.unitPrice || ""}
            onChange={(event) => setEditFormData({ ...editFormData, unitPrice: event.target.value })}
            placeholder="0.00"
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>Product Link</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              value={editFormData.productLink || ""}
              onChange={(event) => setEditFormData({ ...editFormData, productLink: event.target.value })}
              placeholder="https://..."
              className="h-12 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              disabled={isPending || isEditScraping || !(editFormData.productLink || "").trim()}
              onClick={handleEditScrapeByUrl}
              className="h-12 shrink-0 px-4"
            >
              {isEditScraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
              <span className="ml-2 hidden xl:inline">{isEditScraping ? "Scraping..." : "Auto-fill"}</span>
            </Button>
          </div>
        </Field>
        <Field className="md:col-span-2 lg:col-span-3">
          <FieldLabel>Image URL</FieldLabel>
          <Input
            value={editFormData.imageUrl || ""}
            onChange={(event) => setEditFormData({ ...editFormData, imageUrl: event.target.value })}
            placeholder="https://..."
            className="h-12 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel>Assign To</FieldLabel>
          <Select
            value={editFormData.assigneeId || "none"}
            onValueChange={(value) => setEditFormData({ ...editFormData, assigneeId: value })}
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
                variant="outline"
                className={cn(
                  "h-12 w-full justify-start text-left font-normal text-sm",
                  !editFormData.buyBefore && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {editFormData.buyBefore ? (
                  <span>{format(new Date(editFormData.buyBefore), "PPP")}</span>
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={editFormData.buyBefore ? new Date(editFormData.buyBefore) : undefined}
                onSelect={(date) =>
                  setEditFormData({
                    ...editFormData,
                    buyBefore: date ? format(date, "yyyy-MM-dd") : "",
                  })
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </Field>
      </div>

      <div className="rounded-2xl border border-border bg-background px-4 py-3">
        <div className="flex items-start gap-3">
          <Checkbox
            id={`item-${item._id}-has-alternatives`}
            checked={editFormData.hasAlternatives === true}
            onCheckedChange={(checked) =>
              setEditFormData({ ...editFormData, hasAlternatives: checked === true })
            }
            className="mt-0.5"
          />
          <label htmlFor={`item-${item._id}-has-alternatives`} className="cursor-pointer text-sm leading-6">
            <span className="font-medium text-foreground">Has alternatives?</span>
            <span className="block text-muted-foreground">
              Group this product with other options so the client can choose one in the portal.
            </span>
          </label>
        </div>
        {item.setId &&
        items.filter((entry) => String(entry.setId ?? "") === String(item.setId)).length > 1 ? (
          <p className="mt-3 text-xs text-foreground/70">
            To disable alternatives, first delete the other options from this group.
          </p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => handleSaveEdit(item._id)}
          disabled={isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <SaveIcon className="mr-1 h-4 w-4" />
          Save
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEditingItemId(null)}>
          <XIcon className="mr-1 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </div>
  );

  const renderItemRow = (item: ShoppingListItem, set?: ShoppingSet) => {
    const itemId = String(item._id);
    const isCounted = isItemCountedInShoppingTotal(item, setContext);
    const assignedName = getAssignedMemberName(item.assignedTo);
    const isEditing = editingItemId === itemId;

    return (
      <div
        key={item._id}
        className={cn(
          "rounded-2xl border p-4",
          !isCounted && "border-border/70 bg-muted/10",
        )}
      >
        {isEditing ? (
          renderEditForm(item)
        ) : (
          <div>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                {item.imageUrl ? (
                  <div className="h-20 w-20 overflow-hidden rounded-xl border bg-muted/40">
                    <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-medium text-foreground">{item.name}</h4>
                    {set ? (
                      <Badge variant="outline" className="text-xs">
                        Option
                      </Badge>
                    ) : null}
                    {!isCounted ? (
                      <Badge variant="secondary" className="text-xs">
                        Not counted in total
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>Qty: {item.quantity}</span>
                    {item.unitPrice ? <span>{item.unitPrice.toFixed(2)} {currencySymbol} / unit</span> : null}
                    {item.totalPrice ? <span className="font-medium text-foreground">{item.totalPrice.toFixed(2)} {currencySymbol}</span> : null}
                    {item.supplier ? <span>{item.supplier}</span> : null}
                  </div>
                  {assignedName ? (
                    <div className="mt-3 flex items-center gap-2">
                      <Avatar className="h-6 w-6 border border-border/70">
                        <AvatarImage src={teamMembers?.find((member) => member.clerkUserId === item.assignedTo)?.imageUrl} />
                        <AvatarFallback>{assignedName[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">{assignedName}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Badge variant={getStatusColor(item.realizationStatus)}>{item.realizationStatus}</Badge>
                {item.productLink ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="size-8 p-0" onClick={() => window.open(item.productLink, "_blank")}>
                        <ExternalLinkIcon className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open link</TooltipContent>
                  </Tooltip>
                ) : null}
                <Button variant="ghost" size="sm" className="size-8 p-0" onClick={() => toggleDetails(itemId)}>
                  {expandedDetails[itemId] ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="sm" className="size-8 p-0" onClick={() => handleStartEdit(item)}>
                  <EditIcon className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="size-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => onDeleteItem(item._id)}>
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {expandedDetails[itemId] ? (
              <div className="mt-4 border-t pt-4">
                <ShoppingListItemDetails item={item} teamMembers={teamMembers} />
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  const renderSetBlock = (set: ShoppingSet) => {
    const setItems = items.filter((item) => String(item.setId ?? "") === String(set._id));
    if (setItems.length === 0) {
      return null;
    }

    const preferredLeadId = String(set.preferredItemIds?.[0] ?? set.resolvedItemIds?.[0] ?? "");
    const leadItem =
      setItems.find((item) => String(item._id) === preferredLeadId) ??
      setItems[0];
    const orderedSetItems = leadItem
      ? [leadItem, ...setItems.filter((item) => item._id !== leadItem._id)]
      : setItems;
    const selectedIds = new Set((set.resolvedItemIds ?? []).map((id) => String(id)));
    const preferredIds = new Set((set.preferredItemIds ?? []).map((id) => String(id)));
    const fallbackSelectedId = orderedSetItems[0]?._id ? String(orderedSetItems[0]._id) : null;
    const effectiveSelectedIds =
      selectedIds.size > 0
        ? selectedIds
        : preferredIds.size > 0
          ? preferredIds
          : set.selectionMode === "single" && fallbackSelectedId
          ? new Set([fallbackSelectedId])
          : new Set<string>();

    const toggleSetSelection = async (itemId: string) => {
      if (set.selectionMode === "none") return;

      if (set.selectionMode === "single") {
        await onUpdateSet(set._id, {
          resolvedItemIds: [itemId as Id<"shoppingListItems">],
          status: "resolved",
        });
        return;
      }

      const next = new Set(effectiveSelectedIds);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      await onUpdateSet(set._id, {
        resolvedItemIds: Array.from(next) as Id<"shoppingListItems">[],
        status: next.size > 0 ? "resolved" : set.status,
      });
    };

    return (
      <div key={set._id} className="rounded-2xl border border-border/60 bg-muted/20 p-5">
        <div className="mb-4 flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Layers3Icon className="h-4 w-4 text-primary" />
              <h3 className="text-base font-medium text-foreground">{leadItem?.name || set.title}</h3>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">Alternatives</Badge>
              <Badge variant="secondary" className="text-xs">{setItems.length} options</Badge>
            </div>
            {set.notes ? <p className="mt-3 text-sm text-muted-foreground">{set.notes}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setAddingAlternativeSetId((current) =>
                  current === String(set._id) ? null : String(set._id),
                )
              }
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              Add option
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="self-start text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDeleteSet(set._id)}
            >
              <TrashIcon className="mr-2 h-4 w-4" />
              Remove alternatives
            </Button>
          </div>
        </div>

        {addingAlternativeSetId === String(set._id) ? (
          <div className="mb-4 rounded-2xl border bg-card/80 p-4">
            <AddItemForm
              projectId={projectId}
              teamId={teamId}
              sections={sections}
              teamMembers={teamMembers}
              currencySymbol={currencySymbol}
              onAddItem={async (itemData) => {
                const itemId = await onAddItem({
                  ...itemData,
                  sectionId,
                  setId: set._id,
                });
                setAddingAlternativeSetId(null);
                return itemId;
              }}
              isPending={isPending}
              defaultSectionId={sectionId}
              defaultSetId={set._id}
              hideSectionField
              hideAlternativeControls
              submitLabel="Add option"
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          {orderedSetItems.map((item) => {
            const isSelected = effectiveSelectedIds.has(String(item._id));
            return (
              <div key={item._id} className="flex flex-col gap-3">
                {set.selectionMode !== "none" ? (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant={
                        set.selectionMode === "single"
                          ? "default"
                          : isSelected
                            ? "default"
                            : "outline"
                      }
                      onClick={() => toggleSetSelection(String(item._id))}
                      className={
                        set.selectionMode === "single"
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : undefined
                      }
                    >
                      {isSelected ? <CheckIcon className="mr-1 h-4 w-4" /> : null}
                      {set.selectionMode === "single" ? (isSelected ? "Default" : "Set default") : isSelected ? "Selected" : "Toggle"}
                    </Button>
                  </div>
                ) : null}
                {renderItemRow(item, set)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="mb-10 rounded-3xl border bg-card p-4 shadow-sm sm:p-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-medium text-foreground sm:text-xl">{sectionName}</h2>
          <span className="inline-flex items-center justify-center rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {items.length} items
          </span>
          <span className="inline-flex items-center justify-center rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {sectionSets.length} alternative group{sectionSets.length === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center justify-center rounded-full border bg-muted px-3 py-1 text-xs font-medium text-foreground">
            {sectionTotal.toFixed(2)} {currencySymbol}
          </span>
        </div>
        <Button variant="ghost" size="sm" className="self-end rounded-full sm:self-auto" onClick={() => setShowAddForm((current) => !current)}>
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>

      {showAddForm ? (
        <div className="mb-8 rounded-3xl border bg-muted/40 p-6">
          <AddItemForm
            projectId={projectId}
            teamId={teamId}
            sections={sections}
            teamMembers={teamMembers}
            currencySymbol={currencySymbol}
            onAddItem={async (itemData) => {
              const itemId = await onAddItem({
                ...itemData,
                sectionId,
              });
              setShowAddForm(false);
              return itemId;
            }}
            onEnableAlternatives={onCreateAlternativesForItem}
            isPending={isPending}
            defaultSectionId={sectionId}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {sectionSets.map((set) => renderSetBlock(set))}
        {standaloneItems.map((item) => renderItemRow(item))}
      </div>
    </div>
  );
}
