import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SurveyForm({ data, onUpdate }: { data: Record<string, unknown>; onUpdate: (u: Record<string, unknown>) => void }) {
    const [title, setTitle] = useState(String(data.title || ""));
    const [description, setDescription] = useState(String(data.description || ""));

    useEffect(() => {
        onUpdate({
            title,
            description: description || undefined,
        });
    }, [title, description, onUpdate]);

    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Survey Title
                </Label>
                <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="rounded-md border border-border/60 bg-white px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30 text-base font-medium"
                    placeholder="Enter survey title"
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Description
                </Label>
                <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="rounded-md border border-border/60 bg-white px-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30 min-h-[64px]"
                    placeholder="Survey description"
                />
            </div>
        </div>
    );
}

