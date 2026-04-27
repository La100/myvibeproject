import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FolderIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from 'lucide-react';
import { Doc, Id } from '@/convex/_generated/dataModel';
import { toast } from 'sonner';
import { toUserFacingErrorMessage } from '@/lib/userFacingErrors';

interface LaborSectionManagerProps {
  sections: Doc<"laborSections">[];
  onCreateSection: (name: string) => Promise<void>;
  onUpdateSection: (sectionId: Id<"laborSections">, name: string) => Promise<void>;
  onDeleteSection: (sectionId: Id<"laborSections">) => Promise<void>;
  isPending: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export function LaborSectionManager({
  sections,
  onCreateSection,
  onUpdateSection,
  onDeleteSection,
  isPending,
  expanded,
  onExpandedChange,
}: LaborSectionManagerProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<Id<"laborSections"> | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');
  const [savingSectionId, setSavingSectionId] = useState<Id<"laborSections"> | null>(null);
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

  const startEditingSection = (section: Doc<"laborSections">) => {
    setEditingSectionId(section._id);
    setEditingSectionName(section.name);
  };

  const cancelEditingSection = () => {
    setEditingSectionId(null);
    setEditingSectionName('');
  };

  const handleUpdateSection = async (section: Doc<"laborSections">) => {
    const normalizedName = editingSectionName.trim();
    if (!normalizedName) return;

    if (normalizedName === section.name) {
      cancelEditingSection();
      return;
    }

    setSavingSectionId(section._id);
    try {
      await onUpdateSection(section._id, normalizedName);
      cancelEditingSection();
      toast.success('Section name updated');
    } catch (error) {
      toast.error('Could not update section name', {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setSavingSectionId(null);
    }
  };

  const defaultSections = [
    'Tiling',
    'Plumbing',
    'Electrical',
    'Painting',
    'Carpentry',
    'Demolition',
    'Installation',
    'Finishing',
  ];

  const existingSectionNames = sections.map((section) => section.name.toLowerCase());
  const suggestedSections = defaultSections.filter(
    (name) => !existingSectionNames.includes(name.toLowerCase()),
  );
  const sectionLabel = `${sections.length} ${sections.length === 1 ? 'section' : 'sections'}`;

  return (
    <div className="vibe-panel mb-8 p-5 sm:p-6">
      <button
        onClick={() => setExpanded(!isExpanded)}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-secondary/70">
            <FolderIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-foreground">
                Manage Sections
              </span>
              <span className="rounded-full border border-border/60 bg-secondary/70 px-2.5 py-1 text-[12px] font-medium text-muted-foreground">
                {sectionLabel}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Group labor items by trade, phase, or contractor package.
            </p>
          </div>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-secondary/70 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
          {isExpanded ? (
            <ChevronUpIcon className="h-5 w-5" />
          ) : (
            <ChevronDownIcon className="h-5 w-5" />
          )}
        </div>
      </button>

      {isExpanded ? (
        <div className="mt-6 flex flex-col gap-6 border-t border-border/60 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="Add a section, for example Electrical or Finishing"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSection()}
              className="h-11 rounded-full border-border/70 px-4 text-sm shadow-none"
            />
            <Button
              onClick={handleCreateSection}
              disabled={isPending || !newSectionName.trim()}
              className="h-11 rounded-full px-5"
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              Add Section
            </Button>
          </div>

          {suggestedSections.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Quick add</p>
              <div className="flex flex-wrap gap-2">
                {suggestedSections.map((name) => (
                  <button
                    key={name}
                    onClick={() => onCreateSection(name)}
                    disabled={isPending}
                    className="rounded-full border border-border/70 bg-secondary/70 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
                  >
                    + {name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {sections.length > 0 ? (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Existing sections</p>
              <div className="flex flex-col gap-2">
                {sections.map((section) => (
                  <div
                    key={section._id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-secondary/70 p-3.5"
                  >
                    {editingSectionId === section._id ? (
                      <Input
                        value={editingSectionName}
                        onChange={(e) => setEditingSectionName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleUpdateSection(section);
                          if (e.key === 'Escape') cancelEditingSection();
                        }}
                        className="h-9 min-w-0 rounded-full border-border/70 bg-white px-3 text-sm shadow-none"
                        autoFocus
                      />
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{section.name}</span>
                    )}
                    <div className="flex shrink-0 items-center gap-1">
                      {editingSectionId === section._id ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleUpdateSection(section)}
                            disabled={isPending || savingSectionId === section._id || !editingSectionName.trim()}
                            className="rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          >
                            <CheckIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={cancelEditingSection}
                            disabled={savingSectionId === section._id}
                            className="rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                          >
                            <XIcon className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => startEditingSection(section)}
                          disabled={isPending}
                          className="rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onDeleteSection(section._id)}
                        disabled={isPending || editingSectionId === section._id}
                        className="rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
