import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function LaborForm({
    data,
    onUpdate,
    currency,
}: {
    data: Record<string, unknown>;
    onUpdate: (u: Record<string, unknown>) => void;
    currency?: string;
}) {
    const [name, setName] = useState(String(data.name || ""));
    const [notes, setNotes] = useState(String(data.notes || ""));
    const [quantity, setQuantity] = useState(String(data.quantity || ""));
    const [unit, setUnit] = useState(String(data.unit || "m²"));
    const [unitPrice, setUnitPrice] = useState(String(data.unitPrice || ""));
    const [sectionName, setSectionName] = useState(String(data.sectionName || ""));
    const currencySuffix = typeof currency === "string" && currency.trim().length > 0
        ? ` (${currency.trim()})`
        : "";

    useEffect(() => {
        onUpdate({
            name,
            notes: notes || undefined,
            quantity: quantity ? parseFloat(quantity) : undefined,
            unit: unit || undefined,
            unitPrice: unitPrice ? parseFloat(unitPrice) : undefined,
            sectionName: sectionName || undefined,
        });
    }, [name, notes, quantity, unit, unitPrice, sectionName, onUpdate]);

    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Work Description
                </Label>
                <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30 text-base font-medium"
                    placeholder="Enter work description"
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label htmlFor="quantity" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Quantity
                    </Label>
                    <Input
                        id="quantity"
                        type="number"
                        step="0.01"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                        placeholder="0"
                    />
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="unit" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Unit
                    </Label>
                    <Input
                        id="unit"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                        placeholder="m², m, hours, pcs"
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="unitPrice" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Unit Price{currencySuffix}
                </Label>
                <Input
                    id="unitPrice"
                    type="number"
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                    placeholder="0.00"
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="sectionName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Section
                </Label>
                <Input
                    id="sectionName"
                    value={sectionName}
                    onChange={(e) => setSectionName(e.target.value)}
                    className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                    placeholder="Optional section name"
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Notes
                </Label>
                <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30 min-h-[60px]"
                    placeholder="Additional notes"
                />
            </div>
        </div>
    );
}
