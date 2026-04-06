import { useMemo, useState } from "react";
import { Doc, Id } from "@/convex/_generated/dataModel";
import type { TeamMember } from "@/lib/teamMember";
import { buildShoppingSetContext, calculateShoppingTotal, isItemCountedInShoppingTotal } from "@/lib/shoppingSets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AddItemForm } from "./AddItemForm";
import { ShoppingListItemDetails } from "./ShoppingListItemDetails";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EditIcon,
  ExternalLinkIcon,
  Layers3Icon,
  PlusIcon,
  SaveIcon,
  TrashIcon,
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
  setId?: string | Id<"shoppingSets">;
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
  }) => Promise<void>;
  onUpdateSet: (
    id: Id<"shoppingSets">,
    updates: Partial<Doc<"shoppingSets">>,
  ) => Promise<void>;
  onDeleteSet: (id: Id<"shoppingSets">) => Promise<void>;
  isPending: boolean;
}

export function ShoppingListSection({
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
  onUpdateSet,
  onDeleteSet,
  isPending,
}: ShoppingListSectionProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({});
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [showAddForm, setShowAddForm] = useState(false);

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

  const handleStartEdit = (item: ShoppingListItem) => {
    setEditingItemId(String(item._id));
    setEditFormData({
      name: item.name,
      notes: item.notes || "",
      supplier: item.supplier || "",
      category: item.category || "",
      sectionId: item.sectionId || "none",
      setId: item.setId || "none",
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
    });
  };

  const handleSaveEdit = async (itemId: Id<"shoppingListItems">) => {
    const unitPrice = parseFloat(editFormData.unitPrice || "0") || undefined;
    const buyBefore = editFormData.buyBefore ? new Date(editFormData.buyBefore).getTime() : undefined;

    await onUpdateItem(itemId, {
      name: editFormData.name?.trim() || "",
      notes: editFormData.notes?.trim() || undefined,
      supplier: editFormData.supplier?.trim() || undefined,
      category: editFormData.category?.trim() || undefined,
      sectionId:
        editFormData.sectionId === "none"
          ? undefined
          : (editFormData.sectionId as Id<"shoppingListSections">),
      setId: editFormData.setId === "none" ? null : (editFormData.setId as Id<"shoppingSets">),
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
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="text-sm font-medium">Product Name</label>
          <Input value={editFormData.name || ""} onChange={(event) => setEditFormData({ ...editFormData, name: event.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium">Section</label>
          <Select
            value={editFormData.sectionId || "none"}
            onValueChange={(value) => setEditFormData({ ...editFormData, sectionId: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No section</SelectItem>
              {sections.map((section) => (
                <SelectItem key={section._id} value={section._id}>
                  {section.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Set</label>
          <Select
            value={editFormData.setId || "none"}
            onValueChange={(value) => setEditFormData({ ...editFormData, setId: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No set</SelectItem>
              {allSets.map((set) => (
                <SelectItem key={set._id} value={set._id}>
                  {set.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Supplier</label>
          <Input value={editFormData.supplier || ""} onChange={(event) => setEditFormData({ ...editFormData, supplier: event.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium">Quantity</label>
          <Input
            type="number"
            min="1"
            value={editFormData.quantity || 1}
            onChange={(event) => setEditFormData({ ...editFormData, quantity: parseInt(event.target.value, 10) || 1 })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Unit Price ({currencySymbol})</label>
          <Input
            type="number"
            step="0.01"
            value={editFormData.unitPrice || ""}
            onChange={(event) => setEditFormData({ ...editFormData, unitPrice: event.target.value })}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={() => handleSaveEdit(item._id)} disabled={isPending}>
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
      <div key={item._id} className={cn("rounded-2xl border p-4", !isCounted && "opacity-70")}>
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
                    <h4 className="text-base font-medium text-foreground">{item.name}</h4>
                    {set ? (
                      <Badge variant="outline" className="text-xs">
                        {set.title}
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

    const selectedIds = new Set((set.resolvedItemIds ?? []).map((id) => String(id)));
    const fallbackSelectedId = setItems[0]?._id ? String(setItems[0]._id) : null;
    const effectiveSelectedIds =
      selectedIds.size > 0
        ? selectedIds
        : set.selectionMode === "single" && fallbackSelectedId
          ? new Set([fallbackSelectedId])
          : new Set((set.preferredItemIds ?? []).map((id) => String(id)));

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
              <h3 className="text-lg font-medium text-foreground">{set.title}</h3>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">{set.setType}</Badge>
              <Badge variant="outline" className="text-xs">{set.selectionMode}</Badge>
              <Badge variant="outline" className="text-xs">{set.pricingMode}</Badge>
              <Badge variant="secondary" className="text-xs">{set.status}</Badge>
            </div>
            {set.notes ? <p className="mt-3 text-sm text-muted-foreground">{set.notes}</p> : null}
          </div>
          <Button variant="ghost" size="sm" className="self-start text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => onDeleteSet(set._id)}>
            <TrashIcon className="mr-2 h-4 w-4" />
            Delete set
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {setItems.map((item) => {
            const isSelected = effectiveSelectedIds.has(String(item._id));
            return (
              <div key={item._id} className="flex flex-col gap-3">
                {set.selectionMode !== "none" ? (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => toggleSetSelection(String(item._id))}
                    >
                      {isSelected ? <CheckIcon className="mr-1 h-4 w-4" /> : null}
                      {set.selectionMode === "single" ? "Select" : isSelected ? "Selected" : "Toggle"}
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
          <h2 className="text-xl font-medium text-foreground sm:text-2xl">{sectionName}</h2>
          <span className="inline-flex items-center justify-center rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {items.length} items
          </span>
          <span className="inline-flex items-center justify-center rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {sectionSets.length} sets
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
            sections={sections}
            sets={sectionSets}
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
