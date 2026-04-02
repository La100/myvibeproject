import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
    <Card className="mb-8 gap-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <FolderIcon className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold text-foreground">
            Manage Sections
          </span>
          <Badge variant="outline" className="text-xs font-medium">
            ({sections.length} sections)
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronUpIcon className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDownIcon className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <CardContent className="flex flex-col gap-6 pt-0">
          <div className="flex gap-3">
            <Input
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="New section name..."
              className="h-11 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSection()}
            />
            <Button
              onClick={handleCreateSection}
              disabled={isPending || !newSectionName.trim()}
              className="h-11 px-5"
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>

          {suggestedSections.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">Quick add:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedSections.map((name) => (
                  <Button
                    key={name}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onCreateSection(name)}
                    className="h-8 px-3 text-xs font-medium"
                  >
                    + {name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {sections.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium text-muted-foreground">Existing sections:</p>
              <div className="flex flex-col gap-2">
                {sections.map((section) => (
                  <div
                    key={section._id}
                    className="flex items-center justify-between rounded-2xl border border-border bg-muted/35 p-3"
                  >
                    <span className="text-sm font-medium text-foreground">{section.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteSection(section._id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
