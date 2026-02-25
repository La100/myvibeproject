import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ContactForm({ data, onUpdate }: { data: Record<string, unknown>; onUpdate: (u: Record<string, unknown>) => void }) {
    const contactTypeValue = typeof data.type === "string" ? data.type : "contractor";
    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full Name</Label>
                <Input
                    value={String(data.name || "")}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30 text-base font-medium"
                    placeholder="e.g. John Doe"
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company Name</Label>
                <Input
                    value={String(data.companyName || "")}
                    onChange={(e) => onUpdate({ companyName: e.target.value })}
                    className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                    placeholder="Company name"
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</Label>
                <Input
                    value={String(data.email || "")}
                    onChange={(e) => onUpdate({ email: e.target.value })}
                    className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                    placeholder="john@example.com"
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</Label>
                <Input
                    value={String(data.phone || "")}
                    onChange={(e) => onUpdate({ phone: e.target.value })}
                    className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                    placeholder="+1 234 567 890"
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</Label>
                <Select
                    value={contactTypeValue}
                    onValueChange={(value) => onUpdate({ type: value })}
                >
                    <SelectTrigger className="h-9 rounded-md border border-border/60 bg-card px-3 shadow-none">
                        <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="contractor">Contractor</SelectItem>
                        <SelectItem value="supplier">Supplier</SelectItem>
                        <SelectItem value="subcontractor">Subcontractor</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Address</Label>
                <Input
                    value={String(data.address || "")}
                    onChange={(e) => onUpdate({ address: e.target.value })}
                    className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                    placeholder="Street address"
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">City</Label>
                    <Input
                        value={String(data.city || "")}
                        onChange={(e) => onUpdate({ city: e.target.value })}
                        className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                        placeholder="City"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Postal Code</Label>
                    <Input
                        value={String(data.postalCode || "")}
                        onChange={(e) => onUpdate({ postalCode: e.target.value })}
                        className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                        placeholder="Postal code"
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Country</Label>
                    <Input
                        value={String(data.country || "")}
                        onChange={(e) => onUpdate({ country: e.target.value })}
                        className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                        placeholder="Country"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Website</Label>
                    <Input
                        value={String(data.website || "")}
                        onChange={(e) => onUpdate({ website: e.target.value })}
                        className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                        placeholder="https://"
                    />
                </div>
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tax ID</Label>
                <Input
                    value={String(data.taxId || "")}
                    onChange={(e) => onUpdate({ taxId: e.target.value })}
                    className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                    placeholder="Tax ID"
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</Label>
                <Textarea
                    value={String(data.notes || "")}
                    onChange={(e) => onUpdate({ notes: e.target.value })}
                    className="min-h-[64px] resize-none rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                    placeholder="Notes"
                />
            </div>
        </div>
    );
}
