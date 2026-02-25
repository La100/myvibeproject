import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ShoppingForm({
    data,
    onUpdate,
    currency,
}: {
    data: Record<string, unknown>;
    onUpdate: (u: Record<string, unknown>) => void;
    currency?: string;
}) {
    const priorityValue = typeof data.priority === "string" ? data.priority : "none";
    const toNumber = (value: unknown): number | undefined => {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (typeof value === "string") {
            const raw = value.trim();
            const numericLike = raw.match(/-?\d[\d\s.,]*/)?.[0];
            if (!numericLike) return undefined;

            let normalized = numericLike.replace(/\s+/g, "");
            const commaCount = (normalized.match(/,/g) || []).length;
            const dotCount = (normalized.match(/\./g) || []).length;

            if (commaCount > 0 && dotCount > 0) {
                if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
                    normalized = normalized.replace(/\./g, "").replace(",", ".");
                } else {
                    normalized = normalized.replace(/,/g, "");
                }
            } else if (commaCount > 0) {
                if (commaCount > 1) {
                    normalized = normalized.replace(/,/g, "");
                } else {
                    const [intPart, fracPart = ""] = normalized.split(",");
                    normalized = fracPart.length === 3 ? `${intPart}${fracPart}` : `${intPart}.${fracPart}`;
                }
            } else if (dotCount > 1) {
                normalized = normalized.replace(/\./g, "");
            } else if (dotCount === 1) {
                const [intPart, fracPart = ""] = normalized.split(".");
                if (fracPart.length === 3) {
                    normalized = `${intPart}${fracPart}`;
                }
            }

            const parsed = Number(normalized);
            if (Number.isFinite(parsed)) return parsed;
        }
        return undefined;
    };
    const quantityValue = toNumber(data.quantity) ?? 1;
    const unitPriceValue = (() => {
        const direct = toNumber(data.unitPrice);
        if (direct !== undefined && direct > 0) return direct;
        const alias = toNumber(data.price);
        if (alias !== undefined && alias > 0) return alias;
        const total = toNumber(data.totalPrice);
        if (total !== undefined && total > 0 && quantityValue > 0) {
            return total / quantityValue;
        }
        return undefined;
    })();
    const currencySuffix = typeof currency === "string" && currency.trim().length > 0
        ? ` (${currency.trim()})`
        : "";
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
                        value={quantityValue}
                        onChange={(e) => onUpdate({ quantity: Number(e.target.value) })}
                        className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Price{currencySuffix} (Optional)
                    </Label>
                    <Input
                        type="number"
                        value={unitPriceValue === undefined ? "" : String(unitPriceValue)}
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
