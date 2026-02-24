import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ProjectSettingsForm({ data, onUpdate }: { data: Record<string, unknown>; onUpdate: (u: Record<string, unknown>) => void }) {
    const statusValue = typeof data.status === "string" ? data.status : "planning";
    const currencyValue = typeof data.currency === "string" ? data.currency : "PLN";

    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project Name</Label>
                <Input
                    value={String(data.name || "")}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    className="rounded-md border border-border/60 bg-white px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30 text-base font-medium"
                    placeholder="Project name"
                />
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</Label>
                <Textarea
                    value={String(data.description || "")}
                    onChange={(e) => onUpdate({ description: e.target.value })}
                    className="min-h-[72px] resize-none rounded-md border border-border/60 bg-white px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                    placeholder="Project description"
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</Label>
                    <Select
                        value={statusValue}
                        onValueChange={(value) => onUpdate({ status: value })}
                    >
                        <SelectTrigger className="h-9 rounded-md border border-border/60 bg-white px-3 shadow-none">
                            <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="planning">Planning</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="on_hold">On Hold</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Currency</Label>
                    <Select
                        value={currencyValue}
                        onValueChange={(value) => onUpdate({ currency: value })}
                    >
                        <SelectTrigger className="h-9 rounded-md border border-border/60 bg-white px-3 shadow-none">
                            <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="PLN">PLN</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                            <SelectItem value="CAD">CAD</SelectItem>
                            <SelectItem value="AUD">AUD</SelectItem>
                            <SelectItem value="JPY">JPY</SelectItem>
                            <SelectItem value="CHF">CHF</SelectItem>
                            <SelectItem value="SEK">SEK</SelectItem>
                            <SelectItem value="NOK">NOK</SelectItem>
                            <SelectItem value="DKK">DKK</SelectItem>
                            <SelectItem value="CZK">CZK</SelectItem>
                            <SelectItem value="HUF">HUF</SelectItem>
                            <SelectItem value="CNY">CNY</SelectItem>
                            <SelectItem value="INR">INR</SelectItem>
                            <SelectItem value="BRL">BRL</SelectItem>
                            <SelectItem value="MXN">MXN</SelectItem>
                            <SelectItem value="KRW">KRW</SelectItem>
                            <SelectItem value="SGD">SGD</SelectItem>
                            <SelectItem value="HKD">HKD</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client</Label>
                    <Input
                        value={String(data.customer || "")}
                        onChange={(e) => onUpdate({ customer: e.target.value })}
                        className="rounded-md border border-border/60 bg-white px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                        placeholder="Client name"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location</Label>
                    <Input
                        value={String(data.location || "")}
                        onChange={(e) => onUpdate({ location: e.target.value })}
                        className="rounded-md border border-border/60 bg-white px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                        placeholder="City / address"
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Budget</Label>
                <Input
                    type="number"
                    value={data.budget === undefined || data.budget === null ? "" : String(data.budget)}
                    onChange={(e) => onUpdate({ budget: e.target.value ? Number(e.target.value) : undefined })}
                    className="rounded-md border border-border/60 bg-white px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                    placeholder="Project budget"
                />
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cover Image URL</Label>
                <Input
                    value={String(data.coverImageUrl || "")}
                    onChange={(e) => onUpdate({ coverImageUrl: e.target.value })}
                    className="rounded-md border border-border/60 bg-white px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                    placeholder="https://example.com/cover.jpg"
                />
            </div>
        </div>
    );
}

