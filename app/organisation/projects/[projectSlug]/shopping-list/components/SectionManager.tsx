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
    <div className="mb-8 rounded-[24px] border border-[#E7E2D9] bg-white p-6 shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-3">
          <FolderIcon className="h-5 w-5 text-[#6D8B73]" />
          <span className="text-lg font-medium font-[var(--font-display-serif)] text-[#1A1A1A]">
            Manage Sections
          </span>
          <span className="text-sm text-[#8C8880]">
            ({sections.length} sections)
          </span>
        </div>
        {isExpanded ? (
          <ChevronUpIcon className="h-5 w-5 text-[#8C8880]" />
        ) : (
          <ChevronDownIcon className="h-5 w-5 text-[#8C8880]" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-6 space-y-6">
          <div className="flex gap-3">
            <Input
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="New section name..."
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSection()}
              className="h-11 rounded-[18px] border-[#E7E2D9] bg-white text-sm focus-visible:ring-[#6D8B73]"
            />
            <Button
              onClick={handleCreateSection}
              disabled={isPending || !newSectionName.trim()}
              className="rounded-full bg-[#0E0E0E] px-5 h-11 text-white shadow-sm hover:bg-[#1F1F1F]"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>

          {suggestedSections.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[#8C8880] mb-2">Quick add:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedSections.map((name) => (
                  <button
                    key={name}
                    onClick={() => onCreateSection(name)}
                    disabled={isPending}
                    className="px-3 py-1.5 text-xs font-medium rounded-full border border-[#E7E2D9] bg-[#FAF7F2] text-[#3C3A37] hover:bg-[#F0EBE3] transition-colors disabled:opacity-50"
                  >
                    + {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {sections.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[#8C8880] mb-3">Existing sections:</p>
              <div className="space-y-2">
                {sections.map((section) => (
                  <div
                    key={section._id}
                    className="flex items-center justify-between p-3 rounded-[14px] border border-[#E7E2D9] bg-[#FAF7F2]"
                  >
                    <span className="text-sm font-medium text-[#3C3A37]">{section.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteSection(section._id)}
                      disabled={isPending}
                      className="h-8 w-8 p-0 text-[#8C8880] hover:text-red-600 hover:bg-red-50"
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
