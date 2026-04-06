import { useState } from "react";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDownIcon, ChevronUpIcon, Layers3Icon, PlusIcon, TrashIcon } from "lucide-react";

interface ShoppingSetManagerProps {
  sets: Doc<"shoppingSets">[];
  sections: Doc<"shoppingListSections">[];
  onCreateSet: (input: {
    title: string;
    sectionId?: Id<"shoppingListSections">;
    setType: "variant" | "bundle" | "reference";
    selectionMode: "single" | "multiple" | "none";
    pricingMode: "selected_only" | "all_selected" | "none";
  }) => Promise<void>;
  onDeleteSet: (setId: Id<"shoppingSets">) => Promise<void>;
  isPending: boolean;
}

export function ShoppingSetManager({
  sets,
  sections,
  onCreateSet,
  onDeleteSet,
  isPending,
}: ShoppingSetManagerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [sectionId, setSectionId] = useState<Id<"shoppingListSections"> | "none">("none");
  const [setType, setSetType] = useState<"variant" | "bundle" | "reference">("variant");
  const [selectionMode, setSelectionMode] = useState<"single" | "multiple" | "none">("single");
  const [pricingMode, setPricingMode] = useState<"selected_only" | "all_selected" | "none">("selected_only");

  const handleCreate = async () => {
    if (!title.trim()) return;
    await onCreateSet({
      title: title.trim(),
      sectionId: sectionId === "none" ? undefined : sectionId,
      setType,
      selectionMode,
      pricingMode,
    });
    setTitle("");
    setSectionId("none");
    setSetType("variant");
    setSelectionMode("single");
    setPricingMode("selected_only");
  };

  return (
    <div className="mb-8 rounded-3xl border bg-card p-6 shadow-sm">
      <button
        onClick={() => setIsExpanded((current) => !current)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <Layers3Icon className="h-5 w-5 text-primary" />
          <span className="text-lg font-medium text-foreground">Manage Sets</span>
          <span className="text-sm text-muted-foreground">({sets.length} sets)</span>
        </div>
        {isExpanded ? (
          <ChevronUpIcon className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDownIcon className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {isExpanded ? (
        <div className="mt-6 flex flex-col gap-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="New set title..."
              className="xl:col-span-2"
            />
            <Select
              value={sectionId}
              onValueChange={(value) => setSectionId(value as Id<"shoppingListSections"> | "none")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Section" />
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
            <Select value={setType} onValueChange={(value) => setSetType(value as typeof setType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="variant">Variant</SelectItem>
                <SelectItem value="bundle">Bundle</SelectItem>
                <SelectItem value="reference">Reference</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleCreate} disabled={isPending || !title.trim()}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add set
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Select
              value={selectionMode}
              onValueChange={(value) => setSelectionMode(value as typeof selectionMode)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selection mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single choice</SelectItem>
                <SelectItem value="multiple">Multiple choice</SelectItem>
                <SelectItem value="none">No choice</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={pricingMode}
              onValueChange={(value) => setPricingMode(value as typeof pricingMode)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pricing mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="selected_only">Selected only</SelectItem>
                <SelectItem value="all_selected">All selected</SelectItem>
                <SelectItem value="none">Exclude from totals</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            {sets.map((set) => {
              const sectionName =
                sections.find((section) => section._id === set.sectionId)?.name || "No section";
              return (
                <div
                  key={set._id}
                  className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 p-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{set.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {set.setType} · {set.selectionMode} · {set.pricingMode} · {sectionName}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteSet(set._id)}
                    disabled={isPending}
                    className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
