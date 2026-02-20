import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusIcon, TrashIcon, FolderIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { Doc, Id } from '@/convex/_generated/dataModel';

interface LaborSectionManagerProps {
  sections: Doc<"laborSections">[];
  onCreateSection: (name: string) => Promise<void>;
  onDeleteSection: (sectionId: Id<"laborSections">) => Promise<void>;
  isPending: boolean;
}

export function LaborSectionManager({
  sections,
  onCreateSection,
  onDeleteSection,
  isPending
}: LaborSectionManagerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  const handleCreateSection = async () => {
    if (!newSectionName.trim()) return;
    await onCreateSection(newSectionName.trim());
    setNewSectionName('');
  };

  // Default section suggestions for labor
  const defaultSections = [
    "Tiling",
    "Plumbing",
    "Electrical",
    "Painting",
    "Carpentry",
    "Demolition",
    "Installation",
    "Finishing",
  ];

  const existingSectionNames = sections.map(s => s.name.toLowerCase());
  const suggestedSections = defaultSections.filter(
    name => !existingSectionNames.includes(name.toLowerCase())
  );

  return (
    <div className="mb-8 rounded-[24px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-6 shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-3">
          <FolderIcon className="h-5 w-5 text-[var(--ui-accent-brand)]" />
          <span className="text-lg font-medium font-[var(--font-display-serif)] text-[var(--ui-text-strong)]">
            Manage Sections
          </span>
          <span className="text-sm text-[var(--ui-text-muted)]">
            ({sections.length} sections)
          </span>
        </div>
        {isExpanded ? (
          <ChevronUpIcon className="h-5 w-5 text-[var(--ui-text-muted)]" />
        ) : (
          <ChevronDownIcon className="h-5 w-5 text-[var(--ui-text-muted)]" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-6 space-y-6">
          {/* Create new section */}
          <div className="flex gap-3">
            <Input
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="New section name..."
              className="h-11 rounded-[18px] border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] text-sm focus-visible:ring-[var(--ui-accent-brand)]"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSection()}
            />
            <Button
              onClick={handleCreateSection}
              disabled={isPending || !newSectionName.trim()}
              className="rounded-lg bg-[var(--ui-action-bg)] px-5 h-11 text-[var(--primary-foreground)] shadow-sm hover:bg-[var(--ui-action-hover)]"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>

          {/* Suggested sections */}
          {suggestedSections.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--ui-text-muted)] mb-2">Quick add:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedSections.map((name) => (
                  <button
                    key={name}
                    onClick={() => onCreateSection(name)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] text-[var(--ui-text-main)] hover:bg-[var(--ui-surface-soft)] transition-colors"
                  >
                    + {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Existing sections */}
          {sections.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--ui-text-muted)] mb-3">Existing sections:</p>
              <div className="space-y-2">
                {sections.map((section) => (
                  <div
                    key={section._id}
                    className="flex items-center justify-between p-3 rounded-[14px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)]"
                  >
                    <span className="text-sm font-medium text-[var(--ui-text-main)]">{section.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteSection(section._id)}
                      className="h-8 w-8 p-0 text-[var(--ui-text-muted)] hover:text-red-600 hover:bg-red-50"
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


