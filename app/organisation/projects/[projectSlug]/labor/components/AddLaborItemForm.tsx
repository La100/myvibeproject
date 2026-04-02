import { useState } from 'react';
import { useMutation } from 'convex/react';
import { Button } from '@/components/ui/button';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Doc, Id } from '@/convex/_generated/dataModel';
import { apiAny } from '@/lib/convexApiAny';
import type { TeamMember } from '@/lib/teamMember';
import { LinkIcon, PaperclipIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';

// Common units for labor
const LABOR_UNITS = [
  { value: "m²", label: "Square meters (m²)" },
  { value: "m", label: "Linear meters (m)" },
  { value: "hours", label: "Hours" },
  { value: "pcs", label: "Pieces (pcs)" },
  { value: "m³", label: "Cubic meters (m³)" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "set", label: "Complete set" },
  { value: "room", label: "Per room" },
  { value: "item", label: "Per item" },
];


interface AddLaborItemFormProps {
  projectId: Id<"projects">;
  sections: Doc<"laborSections">[];
  teamMembers?: TeamMember[];
  currencySymbol: string;
  onAddItem: (itemData: {
    name: string;
    notes?: string;
    sectionId?: Id<"laborSections">;
    quantity: number;
    unit: string;
    unitPrice?: number;
    assignedTo?: string;
    referenceLink?: string | null;
    attachmentFileId?: Id<"files"> | null;
  }) => Promise<void>;
  isPending: boolean;
  defaultSectionId?: Id<"laborSections">;
  isInline?: boolean;
}

export function AddLaborItemForm({
  projectId,
  sections,
  teamMembers,
  currencySymbol,
  onAddItem,
  isPending,
  defaultSectionId,
}: AddLaborItemFormProps) {
  const ensureLaborFolder = useMutation(apiAny.files.ensureLaborFolder);
  const generateUploadUrl = useMutation(apiAny.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(apiAny.files.addFile);

  const [newItemName, setNewItemName] = useState('');
  const [newItemNotes, setNewItemNotes] = useState('');
  const [newItemSectionId, setNewItemSectionId] = useState<Id<"laborSections"> | "none" | "">(defaultSectionId || "");
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemUnit, setNewItemUnit] = useState('m²');
  const [newItemUnitPrice, setNewItemUnitPrice] = useState('');
  const [newItemAssignedTo, setNewItemAssignedTo] = useState<string>('none');
  const [newItemReferenceLink, setNewItemReferenceLink] = useState('');
  const [newItemAttachment, setNewItemAttachment] = useState<File | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  const normalizeReferenceLink = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsedUrl = new URL(candidate);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('Invalid link format');
    }
    return candidate;
  };

  const uploadAttachmentToLaborFolder = async (file: File): Promise<Id<"files">> => {
    const laborFolderId = await ensureLaborFolder({ projectId });

    const uploadData = await generateUploadUrl({
      projectId,
      fileName: file.name,
      fileSize: file.size,
    });

    const response = await fetch(uploadData.url, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    return await addFile({
      projectId,
      folderId: laborFolderId,
      fileKey: uploadData.key,
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
    });
  };

  const handleAddItem = async () => {
    if (!newItemName.trim() || isUploadingAttachment) return;

    const unitPrice = parseFloat(newItemUnitPrice) || undefined;

    try {
      const normalizedReferenceLink = normalizeReferenceLink(newItemReferenceLink);
      let attachmentFileId: Id<"files"> | null = null;
      if (newItemAttachment) {
        setIsUploadingAttachment(true);
        attachmentFileId = await uploadAttachmentToLaborFolder(newItemAttachment);
      }

      await onAddItem({
        name: newItemName.trim(),
        notes: newItemNotes.trim() || undefined,
        sectionId: newItemSectionId === "none" ? undefined : (newItemSectionId || undefined),
        quantity: newItemQuantity,
        unit: newItemUnit,
        unitPrice: unitPrice,
        assignedTo: newItemAssignedTo === 'none' ? undefined : newItemAssignedTo,
        referenceLink: normalizedReferenceLink,
        attachmentFileId,
      });

      // Reset form
      setNewItemName('');
      setNewItemNotes('');
      setNewItemSectionId(defaultSectionId || '');
      setNewItemQuantity(1);
      setNewItemUnit('m²');
      setNewItemUnitPrice('');
      setNewItemAssignedTo('none');
      setNewItemReferenceLink('');
      setNewItemAttachment(null);
    } catch (error) {
      console.error('Error creating item:', error);
      toast.error('Failed to add labor item', {
        description: (error as Error).message,
      });
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const totalPrice = newItemUnitPrice ? newItemQuantity * parseFloat(newItemUnitPrice) : 0;

  return (
    <div className="flex flex-col gap-4">
      <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field className="gap-2 lg:col-span-2">
          <FieldLabel>Work Description *</FieldLabel>
          <Input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="e.g. Tile installation"
            className="h-12 text-sm"
          />
        </Field>
        <Field className="gap-2">
          <FieldLabel>Section</FieldLabel>
          <Select
            value={newItemSectionId}
            onValueChange={(value) => setNewItemSectionId(value as Id<"laborSections"> | "none")}
          >
            <SelectTrigger className="h-12 text-sm">
              <SelectValue placeholder="Select section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Category</SelectItem>
              {sections.map((section) => (
                <SelectItem key={section._id} value={section._id}>
                  {section.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field className="gap-2">
          <FieldLabel>Quantity *</FieldLabel>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={newItemQuantity}
            onChange={(e) => setNewItemQuantity(parseFloat(e.target.value) || 0)}
            className="h-12 text-sm"
          />
        </Field>
        <Field className="gap-2">
          <FieldLabel>Unit *</FieldLabel>
          <Select value={newItemUnit} onValueChange={setNewItemUnit}>
            <SelectTrigger className="h-12 text-sm">
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              {LABOR_UNITS.map((unit) => (
                <SelectItem key={unit.value} value={unit.value}>
                  {unit.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field className="gap-2">
          <FieldLabel>Price per Unit ({currencySymbol})</FieldLabel>
          <Input
            type="number"
            step="0.01"
            value={newItemUnitPrice}
            onChange={(e) => setNewItemUnitPrice(e.target.value)}
            placeholder="0.00"
            className="h-12 text-sm"
          />
        </Field>
        <Field className="gap-2">
          <FieldLabel>Assign To (Contractor)</FieldLabel>
          <Select
            value={newItemAssignedTo}
            onValueChange={setNewItemAssignedTo}
          >
            <SelectTrigger className="h-12 text-sm">
              <SelectValue placeholder="Select contractor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {teamMembers?.map((member: TeamMember) => (
                <SelectItem key={member.clerkUserId} value={member.clerkUserId}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={member.imageUrl} />
                      <AvatarFallback>{member.name?.[0]}</AvatarFallback>
                    </Avatar>
                    {member.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field className="gap-2 lg:col-span-2">
          <FieldLabel>Notes</FieldLabel>
          <Input
            value={newItemNotes}
            onChange={(e) => setNewItemNotes(e.target.value)}
            placeholder="Additional notes..."
            className="h-12 text-sm"
          />
        </Field>
        <Field className="gap-2 lg:col-span-2">
          <FieldLabel>Reference Link</FieldLabel>
          <div className="relative">
            <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={newItemReferenceLink}
              onChange={(e) => setNewItemReferenceLink(e.target.value)}
              placeholder="https://example.com"
              className="h-12 pl-10 text-sm"
            />
          </div>
        </Field>
        <Field className="gap-2">
          <FieldLabel>Attachment</FieldLabel>
          <FieldContent className="gap-2">
            <label className="flex h-12 cursor-pointer items-center gap-2 rounded-2xl border border-input bg-background px-4 text-sm text-foreground transition-colors hover:bg-muted">
              <PaperclipIcon className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{newItemAttachment?.name || 'Choose file'}</span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => setNewItemAttachment(e.target.files?.[0] ?? null)}
              />
            </label>
            {newItemAttachment && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setNewItemAttachment(null)}
              >
                <XIcon className="mr-1 h-3 w-3" />
                Remove file
              </Button>
            )}
            <FieldDescription className="text-xs">
              Stored automatically in <span className="font-medium">Files/labor</span>.
            </FieldDescription>
          </FieldContent>
        </Field>
      </FieldGroup>

      {totalPrice > 0 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-medium text-foreground">
            {totalPrice.toFixed(2)} {currencySymbol}
          </span>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button
          onClick={handleAddItem}
          disabled={isPending || isUploadingAttachment || !newItemName.trim()}
          className="h-11 px-6"
        >
          {isUploadingAttachment ? 'Uploading...' : isPending ? 'Adding...' : 'Add Labor Item'}
        </Button>
      </div>
    </div>
  );
}
