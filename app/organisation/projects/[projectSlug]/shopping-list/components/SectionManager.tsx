import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusIcon, TrashIcon, FolderIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { Doc, Id } from '@/convex/_generated/dataModel';

interface SectionManagerProps {
  sections: Doc<"shoppingListSections">[];
  onCreateSection: (name: string) => Promise<void>;
  onDeleteSection: (sectionId: Id<"shoppingListSections">) => Promise<void>;
  isPending: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export function SectionManager({
  sections,
  onCreateSection,
  onDeleteSection,
  isPending,
  expanded,
  onExpandedChange,
}: SectionManagerProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const isExpanded = expanded ?? internalExpanded;

  const setExpanded = (nextExpanded: boolean) => {
    if (expanded === undefined) {
      setInternalExpanded(nextExpanded);
    }
    onExpandedChange?.(nextExpanded);
  };

  const handleCreateSection = async () => {
    if (!newSectionName.trim()) return;

    await onCreateSection(newSectionName.trim());
    setNewSectionName('');
  };

  const defaultSections = [
    "Kitchen",
    "Bathroom",
    "Living Room",
    "Bedroom",
    "Lighting",
    "Furniture",
    "Hardware",
    "Decor",
  ];

  const existingSectionNames = sections.map(s => s.name.toLowerCase());
  const suggestedSections = defaultSections.filter(
    name => !existingSectionNames.includes(name.toLowerCase())
  );
  const sectionLabel = `${sections.length} ${sections.length === 1 ? 'section' : 'sections'}`;

  return (
    <div className="mb-8 rounded-[30px] border border-border/70 bg-white p-5 shadow-sm sm:p-6">
      <button
        onClick={() => setExpanded(!isExpanded)}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-secondary/35">
            <FolderIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-foreground">
                Manage Sections
              </span>
              <span className="rounded-full border border-border/60 bg-white px-2.5 py-1 text-[12px] font-medium text-muted-foreground">
                {sectionLabel}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Group products by room, package, or sourcing phase.
            </p>
          </div>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-white text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground">
          {isExpanded ? (
            <ChevronUpIcon className="h-5 w-5" />
          ) : (
            <ChevronDownIcon className="h-5 w-5" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="mt-6 flex flex-col gap-6 border-t border-border/60 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="Add a section, for example Kitchen or Lighting"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSection()}
              className="h-11 rounded-full border-border/70 px-4 text-sm shadow-none"
            />
            <Button
              onClick={handleCreateSection}
              disabled={isPending || !newSectionName.trim()}
              className="h-11 rounded-full px-5"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Section
            </Button>
          </div>

          {suggestedSections.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Quick add</p>
              <div className="flex flex-wrap gap-2">
                {suggestedSections.map((name) => (
                  <button
                    key={name}
                    onClick={() => onCreateSection(name)}
                    disabled={isPending}
                    className="rounded-full border border-border/70 bg-white px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/45 disabled:opacity-50"
                  >
                    + {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {sections.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Existing sections</p>
              <div className="flex flex-col gap-2">
                {sections.map((section) => (
                  <div
                    key={section._id}
                    className="flex items-center justify-between rounded-2xl border border-border/70 bg-secondary/20 p-3.5"
                  >
                    <span className="text-sm font-medium text-foreground">{section.name}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onDeleteSection(section._id)}
                      disabled={isPending}
                      className="rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
