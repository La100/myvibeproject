import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ShoppingForm({ data, onUpdate }: { data: Record<string, unknown>; onUpdate: (u: Record<string, unknown>) => void }) {
    const priorityValue = typeof data.priority === "string" ? data.priority : "none";
    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item Name</Label>
                <Input
                    value={String(data.name || "")}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30 text-base font-medium"
                    placeholder="e.g. Milk"
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quantity</Label>
                    <Input
                        type="number"
                        value={Number(data.quantity || 1)}
                        onChange={(e) => onUpdate({ quantity: Number(e.target.value) })}
                        className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Price (Optional)</Label>
                    <Input
                        type="number"
                        value={Number(data.unitPrice || "")}
                        onChange={(e) => onUpdate({ unitPrice: e.target.value ? Number(e.target.value) : undefined })}
                        placeholder="0.00"
                        className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority</Label>
                    <Select
                        value={priorityValue}
                        onValueChange={(value) => onUpdate({ priority: value === "none" ? undefined : value })}
                    >
                        <SelectTrigger className="h-9 rounded-md border border-border/60 bg-card px-3 shadow-none">
                            <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">No priority</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Buy Before</Label>
                    <Input
                        type="date"
                        value={String(data.buyBefore || "")}
                        onChange={(e) => onUpdate({ buyBefore: e.target.value || undefined })}
                        className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</Label>
                <Input
                    value={String(data.category || "")}
                    onChange={(e) => onUpdate({ category: e.target.value })}
                    className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                    placeholder="e.g. Dairy"
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Supplier</Label>
                    <Input
                        value={String(data.supplier || "")}
                        onChange={(e) => onUpdate({ supplier: e.target.value })}
                        className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                        placeholder="Supplier name"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Section</Label>
                    <Input
                        value={String(data.sectionName || "")}
                        onChange={(e) => onUpdate({ sectionName: e.target.value })}
                        className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                        placeholder="e.g. Bathroom"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dimensions</Label>
                    <Input
                        value={String(data.dimensions || "")}
                        onChange={(e) => onUpdate({ dimensions: e.target.value })}
                        className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                        placeholder="e.g. 120x60 cm"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Catalog Number</Label>
                    <Input
                        value={String(data.catalogNumber || "")}
                        onChange={(e) => onUpdate({ catalogNumber: e.target.value })}
                        className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                        placeholder="Model / SKU"
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Product Link</Label>
                <Input
                    value={String(data.productLink || "")}
                    onChange={(e) => onUpdate({ productLink: e.target.value })}
                    className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                    placeholder="https://"
                />
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</Label>
                <Input
                    value={String(data.notes || "")}
                    onChange={(e) => onUpdate({ notes: e.target.value })}
                    className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                    placeholder="Add details..."
                />
            </div>
        </div>
    );
}

