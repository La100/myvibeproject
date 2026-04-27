import { useEffect, useMemo, useState } from 'react';
import { useMutation } from 'convex/react';
import { Button } from '@/components/ui/button';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Doc, Id } from '@/convex/_generated/dataModel';
import { apiAny } from '@/lib/convexApiAny';
import type { TeamMember } from '@/lib/teamMember';
import { LinkIcon, PaperclipIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { toUserFacingErrorMessage } from '@/lib/userFacingErrors';
import type { TeamTaxRate } from '@/lib/organizationTax';
import {
  calculatePriceTaxBreakdown,
  formatPriceTaxBreakdown,
  getDefaultPriceTaxRateId,
  normalizePriceTaxMode,
  resolvePriceTaxSnapshot,
  type PriceTaxMode,
  type PriceTaxRateSnapshot,
} from '@/lib/priceTax';
import {
  getDefaultLaborUnit,
  getLaborUnitsForMeasurementSystem,
  type MeasurementSystem,
} from './laborUnits';


interface AddLaborItemFormProps {
  projectId: Id<"projects">;
  sections: Doc<"laborSections">[];
  teamMembers?: TeamMember[];
  taxRates?: TeamTaxRate[];
  currencySymbol: string;
  onAddItem: (itemData: {
    name: string;
    notes?: string;
    sectionId?: Id<"laborSections">;
    quantity: number;
    unit: string;
    unitPrice?: number;
    priceTaxMode?: PriceTaxMode;
    taxRateId?: string | null;
    taxRateSnapshot?: PriceTaxRateSnapshot | null;
    assignedTo?: string;
    referenceLink?: string | null;
    attachmentFileId?: Id<"files"> | null;
    startDate?: number;
    endDate?: number;
  }) => Promise<void>;
  isPending: boolean;
  defaultSectionId?: Id<"laborSections">;
  isInline?: boolean;
  measurementSystem?: MeasurementSystem;
  initialValues?: {
    name?: string;
    notes?: string;
    sectionId?: Id<"laborSections"> | null;
    quantity?: number;
    unit?: string;
    unitPrice?: number;
    priceTaxMode?: PriceTaxMode;
    taxRateId?: string | null;
    taxRateSnapshot?: PriceTaxRateSnapshot | null;
    assignedTo?: string;
    referenceLink?: string | null;
    startDate?: number;
    endDate?: number;
  };
  submitLabel?: string;
  onSubmitted?: () => void;
}

export function AddLaborItemForm({
  projectId,
  sections,
  teamMembers,
  taxRates = [],
  currencySymbol,
  onAddItem,
  isPending,
  defaultSectionId,
  measurementSystem = 'metric',
  initialValues,
  submitLabel = 'Add Labor Item',
  onSubmitted,
}: AddLaborItemFormProps) {
  const ensureLaborFolder = useMutation(apiAny.files.ensureLaborFolder);
  const generateUploadUrl = useMutation(apiAny.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(apiAny.files.addFile);
  const laborUnits = getLaborUnitsForMeasurementSystem(measurementSystem);
  const defaultLaborUnit = getDefaultLaborUnit(measurementSystem);

  const [newItemName, setNewItemName] = useState(initialValues?.name ?? '');
  const [newItemNotes, setNewItemNotes] = useState(initialValues?.notes ?? '');
  const [newItemSectionId, setNewItemSectionId] = useState<Id<"laborSections"> | "none" | "">(
    initialValues?.sectionId ?? defaultSectionId ?? '',
  );
  const [newItemQuantity, setNewItemQuantity] = useState(initialValues?.quantity ?? 1);
  const [newItemUnit, setNewItemUnit] = useState(initialValues?.unit ?? defaultLaborUnit);
  const [newItemUnitPrice, setNewItemUnitPrice] = useState(
    initialValues?.unitPrice !== undefined ? initialValues.unitPrice.toString() : '',
  );
  const [newItemPriceTaxMode, setNewItemPriceTaxMode] = useState<PriceTaxMode>(
    normalizePriceTaxMode(initialValues?.priceTaxMode),
  );
  const [newItemTaxRateId, setNewItemTaxRateId] = useState<string>(
    initialValues?.taxRateId ??
      initialValues?.taxRateSnapshot?.id ??
      getDefaultPriceTaxRateId(taxRates) ??
      '',
  );
  const [newItemAssignedTo, setNewItemAssignedTo] = useState<string>(initialValues?.assignedTo ?? 'none');
  const [newItemReferenceLink, setNewItemReferenceLink] = useState(initialValues?.referenceLink ?? '');
  const [newItemAttachment, setNewItemAttachment] = useState<File | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [singleDayItem, setSingleDayItem] = useState(false);
  const [isAllDay, setIsAllDay] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('');
  const [hasEndTime, setHasEndTime] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const activeTaxRates = useMemo(
    () => taxRates.filter((entry) => !entry.isArchived),
    [taxRates],
  );
  const selectedTaxRateId =
    newItemTaxRateId || getDefaultPriceTaxRateId(activeTaxRates) || '';
  const selectedTaxSnapshot = resolvePriceTaxSnapshot(
    newItemPriceTaxMode,
    selectedTaxRateId,
    activeTaxRates,
  );

  useEffect(() => {
    const initialStartDate = initialValues?.startDate ? new Date(initialValues.startDate) : undefined;
    const initialEndDate = initialValues?.endDate ? new Date(initialValues.endDate) : undefined;

    setNewItemName(initialValues?.name ?? '');
    setNewItemNotes(initialValues?.notes ?? '');
    setNewItemSectionId(initialValues?.sectionId ?? defaultSectionId ?? '');
    setNewItemQuantity(initialValues?.quantity ?? 1);
    setNewItemUnit(initialValues?.unit ?? defaultLaborUnit);
    setNewItemUnitPrice(initialValues?.unitPrice !== undefined ? initialValues.unitPrice.toString() : '');
    setNewItemPriceTaxMode(normalizePriceTaxMode(initialValues?.priceTaxMode));
    setNewItemTaxRateId(
      initialValues?.taxRateId ??
        initialValues?.taxRateSnapshot?.id ??
        getDefaultPriceTaxRateId(activeTaxRates) ??
        '',
    );
    setNewItemAssignedTo(initialValues?.assignedTo ?? 'none');
    setNewItemReferenceLink(initialValues?.referenceLink ?? '');
    setNewItemAttachment(null);
    setStartDate(initialStartDate);
    setEndDate(initialEndDate);

    const isSingleDayRange =
      initialStartDate && initialEndDate
        ? initialStartDate.toDateString() === initialEndDate.toDateString()
        : false;
    setSingleDayItem(isSingleDayRange);

    const hasStartTimeValue =
      Boolean(initialStartDate) &&
      (initialStartDate!.getHours() !== 0 || initialStartDate!.getMinutes() !== 0);
    const hasEndTimeValue =
      Boolean(initialEndDate) &&
      (initialEndDate!.getHours() !== 0 || initialEndDate!.getMinutes() !== 0);
    const hasSpecificTime = hasStartTimeValue || hasEndTimeValue;
    setIsAllDay(!hasSpecificTime);

    if (hasStartTimeValue && initialStartDate) {
      setStartTime(`${String(initialStartDate.getHours()).padStart(2, '0')}:${String(initialStartDate.getMinutes()).padStart(2, '0')}`);
    } else {
      setStartTime('09:00');
    }

    if (hasEndTimeValue && initialEndDate) {
      const endTimeStr = `${String(initialEndDate.getHours()).padStart(2, '0')}:${String(initialEndDate.getMinutes()).padStart(2, '0')}`;
      const startTimeStr = initialStartDate
        ? `${String(initialStartDate.getHours()).padStart(2, '0')}:${String(initialStartDate.getMinutes()).padStart(2, '0')}`
        : '';
      if (!hasStartTimeValue || endTimeStr !== startTimeStr) {
        setEndTime(endTimeStr);
        setHasEndTime(true);
      } else {
        setEndTime('');
        setHasEndTime(false);
      }
    } else {
      setEndTime('');
      setHasEndTime(false);
    }
  }, [activeTaxRates, defaultSectionId, defaultLaborUnit, initialValues]);

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

  const buildTimestamp = (date: Date | undefined, time: string) => {
    if (!date) return undefined;
    const next = new Date(date);
    if (isAllDay) {
      next.setHours(0, 0, 0, 0);
      return next.getTime();
    }
    const [hours, minutes] = time.split(':').map(Number);
    next.setHours(hours, minutes, 0, 0);
    return next.getTime();
  };

  const handleAddItem = async () => {
    if (!newItemName.trim() || isUploadingAttachment) return;

    const unitPrice = parseFloat(newItemUnitPrice) || undefined;
    const normalizedPriceTaxMode = normalizePriceTaxMode(newItemPriceTaxMode);
    const taxRateSnapshot = resolvePriceTaxSnapshot(
      normalizedPriceTaxMode,
      selectedTaxRateId,
      activeTaxRates,
    );

    if (
      (normalizedPriceTaxMode === 'net' || normalizedPriceTaxMode === 'gross') &&
      !taxRateSnapshot
    ) {
      toast.error('Select a tax rate or leave tax as not specified');
      return;
    }

    try {
      const normalizedReferenceLink = normalizeReferenceLink(newItemReferenceLink);
      let attachmentFileId: Id<"files"> | null = null;
      if (newItemAttachment) {
        setIsUploadingAttachment(true);
        attachmentFileId = await uploadAttachmentToLaborFolder(newItemAttachment);
      }

      const computedStartDate = buildTimestamp(startDate, startTime);
      const computedEndDate = buildTimestamp(
        singleDayItem ? startDate : endDate,
        hasEndTime && endTime ? endTime : startTime,
      );

      if (
        typeof computedStartDate === 'number' &&
        typeof computedEndDate === 'number' &&
        computedEndDate < computedStartDate
      ) {
        toast.error('End date cannot be earlier than start date.');
        return;
      }

      await onAddItem({
        name: newItemName.trim(),
        notes: newItemNotes.trim() || undefined,
        sectionId: newItemSectionId === "none" ? undefined : (newItemSectionId || undefined),
        quantity: newItemQuantity,
        unit: newItemUnit,
        unitPrice: unitPrice,
        priceTaxMode: normalizedPriceTaxMode,
        taxRateId:
          normalizedPriceTaxMode === 'net' || normalizedPriceTaxMode === 'gross'
            ? taxRateSnapshot?.id ?? selectedTaxRateId
            : null,
        taxRateSnapshot: taxRateSnapshot ?? null,
        assignedTo: newItemAssignedTo === 'none' ? undefined : newItemAssignedTo,
        referenceLink: normalizedReferenceLink,
        attachmentFileId,
        startDate: computedStartDate,
        endDate: computedEndDate,
      });

      // Reset form
      if (!initialValues) {
        setNewItemName('');
        setNewItemNotes('');
        setNewItemSectionId(defaultSectionId || '');
        setNewItemQuantity(1);
        setNewItemUnit(defaultLaborUnit);
        setNewItemUnitPrice('');
        setNewItemPriceTaxMode('unspecified');
        setNewItemTaxRateId(getDefaultPriceTaxRateId(activeTaxRates) ?? '');
        setNewItemAssignedTo('none');
        setNewItemReferenceLink('');
        setNewItemAttachment(null);
        setSingleDayItem(false);
        setIsAllDay(false);
        setStartTime('09:00');
        setEndTime('');
        setHasEndTime(false);
        setStartDate(undefined);
        setEndDate(undefined);
      }
      onSubmitted?.();
    } catch (error) {
      console.error('Error creating item:', error);
      toast.error('Failed to add labor item', {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const totalPrice = newItemUnitPrice ? newItemQuantity * parseFloat(newItemUnitPrice) : 0;
  const unitPriceNumber = Number.parseFloat(newItemUnitPrice);
  const priceTaxMetadata = {
    priceTaxMode: newItemPriceTaxMode,
    taxRateId: selectedTaxRateId,
    taxRateSnapshot: selectedTaxSnapshot ?? null,
  };
  const unitBreakdownLabel = formatPriceTaxBreakdown(
    Number.isFinite(unitPriceNumber) ? unitPriceNumber : undefined,
    priceTaxMetadata,
    currencySymbol,
  );
  const totalBreakdown = calculatePriceTaxBreakdown(totalPrice, priceTaxMetadata);

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
              {laborUnits.map((unit) => (
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
          <FieldLabel>Tax treatment</FieldLabel>
          <Select
            value={newItemPriceTaxMode}
            onValueChange={(value) => {
              const mode = normalizePriceTaxMode(value);
              setNewItemPriceTaxMode(mode);
              if ((mode === 'net' || mode === 'gross') && !newItemTaxRateId) {
                setNewItemTaxRateId(getDefaultPriceTaxRateId(activeTaxRates) ?? '');
              }
            }}
          >
            <SelectTrigger className="h-12 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unspecified">Not specified</SelectItem>
              <SelectItem value="net" disabled={activeTaxRates.length === 0}>
                Net + tax
              </SelectItem>
              <SelectItem value="gross" disabled={activeTaxRates.length === 0}>
                Gross incl. tax
              </SelectItem>
              <SelectItem value="exempt">Tax exempt</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {newItemPriceTaxMode === 'net' || newItemPriceTaxMode === 'gross' ? (
          <Field className="gap-2">
            <FieldLabel>Tax rate</FieldLabel>
            <Select value={selectedTaxRateId} onValueChange={setNewItemTaxRateId}>
              <SelectTrigger className="h-12 text-sm">
                <SelectValue placeholder="Select tax rate" />
              </SelectTrigger>
              <SelectContent>
                {activeTaxRates.map((rate) => (
                  <SelectItem key={rate.id} value={rate.id}>
                    {rate.name} ({rate.rate}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        <Field className="gap-2">
          <FieldLabel>Assign To</FieldLabel>
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
        <Field className="gap-3 lg:col-span-3">
          <div className="flex items-center justify-between">
            <FieldLabel>Schedule</FieldLabel>
            <div className="flex items-center gap-2">
              <Checkbox
                id="labor-all-day"
                checked={isAllDay}
                onCheckedChange={(checked) => setIsAllDay(checked as boolean)}
              />
              <Label htmlFor="labor-all-day" className="cursor-pointer text-sm font-normal">
                All day
              </Label>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="labor-single-day"
              checked={singleDayItem}
              onCheckedChange={(checked) => {
                const nextChecked = checked as boolean;
                setSingleDayItem(nextChecked);
                if (nextChecked && startDate) {
                  setEndDate(startDate);
                }
              }}
            />
            <Label htmlFor="labor-single-day" className="cursor-pointer text-sm font-normal">
              Single day
            </Label>
          </div>
          <div className={singleDayItem ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 gap-4 md:grid-cols-2'}>
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">
                {singleDayItem ? 'Date' : 'Start Date'}
              </Label>
              <DatePicker
                date={startDate}
                onDateChange={(date) => {
                  setStartDate(date);
                  if (singleDayItem && date) {
                    setEndDate(date);
                  }
                }}
              />
            </div>
            {!singleDayItem ? (
              <div className="flex flex-col gap-2">
                <Label className="text-sm text-muted-foreground">End Date</Label>
                <DatePicker date={endDate} onDateChange={setEndDate} />
              </div>
            ) : null}
          </div>
          {!isAllDay ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-sm text-muted-foreground">Start Time</Label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className="mt-1"
                  />
                </div>
                {hasEndTime ? (
                  <div>
                    <Label className="text-sm text-muted-foreground">End Time</Label>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                      className="mt-1"
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="labor-has-end-time"
                  checked={hasEndTime}
                  onCheckedChange={(checked) => {
                    const nextChecked = checked as boolean;
                    setHasEndTime(nextChecked);
                    if (nextChecked && !endTime) {
                      const [hours, minutes] = startTime.split(':').map(Number);
                      const nextHour = (hours + 1) % 24;
                      setEndTime(`${String(nextHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
                    }
                  }}
                />
                <Label htmlFor="labor-has-end-time" className="cursor-pointer text-sm font-normal">
                  Specify end time
                </Label>
              </div>
            </div>
          ) : null}
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
        <div className="flex flex-col items-end gap-1 text-sm">
          <div className="flex items-center justify-end gap-2">
            <span className="text-muted-foreground">Total:</span>
            <span className="font-medium text-foreground">
              {totalPrice.toFixed(2)} {currencySymbol}
            </span>
          </div>
          {unitBreakdownLabel ? (
            <span className="text-xs text-muted-foreground">
              Unit: {unitBreakdownLabel}
            </span>
          ) : null}
          {totalBreakdown.hasBreakdown ? (
            <span className="text-xs text-muted-foreground">
              Gross total: {totalBreakdown.gross.toFixed(2)} {currencySymbol}
            </span>
          ) : null}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button
          onClick={handleAddItem}
          disabled={isPending || isUploadingAttachment || !newItemName.trim()}
          className="h-11 px-6"
        >
          {isUploadingAttachment ? 'Uploading...' : isPending ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </div>
  );
}
