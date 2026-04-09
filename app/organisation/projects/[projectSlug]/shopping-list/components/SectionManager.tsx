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
}

export function SectionManager({
  sections,
  onCreateSection,
  onDeleteSection,
  isPending
}: SectionManagerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

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

  return (
    <div className="mb-8 rounded-3xl border bg-card p-6 shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-3">
          <FolderIcon className="h-5 w-5 text-primary" />
          <span className="text-base font-medium text-foreground">
            Manage Sections
          </span>
          <span className="text-sm text-muted-foreground">
            ({sections.length} sections)
          </span>
        </div>
        {isExpanded ? (
          <ChevronUpIcon className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDownIcon className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-6 flex flex-col gap-6">
          <div className="flex gap-3">
            <Input
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="New section name..."
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSection()}
              className="h-11 text-sm"
            />
            <Button
              onClick={handleCreateSection}
              disabled={isPending || !newSectionName.trim()}
              className="h-11 px-5"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>

          {suggestedSections.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Quick add:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedSections.map((name) => (
                  <button
                    key={name}
                    onClick={() => onCreateSection(name)}
                    disabled={isPending}
                    className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/80 disabled:opacity-50"
                  >
                    + {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {sections.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-medium text-muted-foreground">Existing sections:</p>
              <div className="flex flex-col gap-2">
                {sections.map((section) => (
                  <div
                    key={section._id}
                    className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 p-3"
                  >
                    <span className="text-sm font-medium text-foreground">{section.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteSection(section._id)}
                      disabled={isPending}
                      className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
