import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SectionForm({ data, onUpdate, type }: { data: Record<string, unknown>; onUpdate: (u: Record<string, unknown>) => void; type: string }) {
    const [name, setName] = useState(String(data.name || ""));

    useEffect(() => {
        onUpdate({ name });
    }, [name, onUpdate]);

    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {type === "shoppingSection" ? "Shopping List" : "Labor"} Section Name
                </Label>
                <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-md border border-border/60 bg-card px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30 text-base font-medium"
                    placeholder="Enter section name"
                />
            </div>
        </div>
    );
}

