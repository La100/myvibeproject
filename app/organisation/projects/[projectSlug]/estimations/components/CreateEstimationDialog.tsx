'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { apiAny } from '@/lib/convexApiAny';
import { Id } from '@/convex/_generated/dataModel';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useProject } from '@/components/providers/ProjectProvider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, ChevronRightIcon, ChevronLeftIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CreateEstimationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: Id<"projects">;
  currencySymbol: string;
}

interface ProjectContactOption {
  _id: Id<"contacts">;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  projectRole?: string;
}

const MANUAL_CONTACT_VALUE = '__manual__' as const;
const CUSTOMER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CreateEstimationDialog({
  open,
  onOpenChange,
  projectId,
  currencySymbol
}: CreateEstimationDialogProps) {
  const { project } = useProject();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [plannedStartDate, setPlannedStartDate] = useState<Date | undefined>(undefined);
  const [validUntil, setValidUntil] = useState<Date | undefined>(undefined);
  const [vatPercent, setVatPercent] = useState(23);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<Id<"contacts"> | typeof MANUAL_CONTACT_VALUE>(MANUAL_CONTACT_VALUE);
  const [notes, setNotes] = useState('');
  const [selectedLaborIds, setSelectedLaborIds] = useState<Id<"laborItems">[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Id<"shoppingListItems">[]>([]);
  const [laborFilter, setLaborFilter] = useState('all');
  const [materialFilter, setMaterialFilter] = useState('all');

  // Queries
  const laborItems = useQuery(apiAny.labor.listLaborItems, { projectId });
  const laborSections = useQuery(apiAny.labor.listLaborSections, { projectId });
  const materialItems = useQuery(apiAny.shopping.listShoppingListItems, { projectId });
  const shoppingSections = useQuery(apiAny.shopping.listShoppingListSections, { projectId });
  const projectContacts = useQuery(
    apiAny.contacts.getProjectContacts,
    open ? { projectId } : "skip"
  );
  const nextNumber = useQuery(apiAny.costEstimations.getNextEstimationNumber, { projectId });

  const createEstimation = useMutation(apiAny.costEstimations.createCostEstimation);

  const contactOptions = (projectContacts || []) as ProjectContactOption[];
  const primaryProjectContact = contactOptions[0];
  const selectedContact = selectedContactId === MANUAL_CONTACT_VALUE
    ? undefined
    : contactOptions.find((contact) => contact._id === selectedContactId);

  const buildContactAddress = (contact: Pick<ProjectContactOption, 'address' | 'postalCode' | 'city' | 'country'> | undefined) => {
    if (!contact) return '';

    const parts: string[] = [];
    const line1 = contact.address?.trim();
    if (line1) {
      parts.push(line1);
    }

    const line2 = [contact.postalCode?.trim(), contact.city?.trim()].filter(Boolean).join(' ');
    if (line2) {
      parts.push(line2);
    }

    const country = contact.country?.trim();
    if (country) {
      parts.push(country);
    }

    return parts.join(', ');
  };

  const applyContactData = (contact: ProjectContactOption | undefined) => {
    if (!contact) return;
    setCustomerName(contact.name?.trim() || '');
    setCustomerEmail(contact.email?.trim() || '');
    setCustomerPhone(contact.phone?.trim() || '');
    setCustomerAddress(buildContactAddress(contact));
  };

  const defaultCustomerName = (primaryProjectContact?.name || project?.customer || '').trim();
  const defaultCustomerEmail = (primaryProjectContact?.email || '').trim();
  const defaultCustomerPhone = (primaryProjectContact?.phone || '').trim();
  const defaultCustomerAddress = buildContactAddress(primaryProjectContact);
  const hasProjectCustomerDefaults = Boolean(
    defaultCustomerName || defaultCustomerEmail || defaultCustomerPhone || defaultCustomerAddress
  );

  const laborSectionNameById = new Map<Id<"laborSections">, string>(
    (laborSections || []).map((section) => [section._id, section.name])
  );
  const shoppingSectionNameById = new Map<Id<"shoppingListSections">, string>(
    (shoppingSections || []).map((section) => [section._id, section.name])
  );

  const resolveMaterialCategory = (item: {
    category?: string;
    sectionId?: Id<"shoppingListSections"> | null;
  }) => {
    const explicitCategory = item.category?.trim();
    if (explicitCategory) return explicitCategory;
    if (item.sectionId) {
      return shoppingSectionNameById.get(item.sectionId) || 'Uncategorized';
    }
    return 'Uncategorized';
  };

  const filteredLaborItems = (laborItems || []).filter((item) => {
    if (laborFilter === 'all') return true;
    if (laborFilter === 'unassigned') return !item.sectionId;
    return item.sectionId === laborFilter;
  });

  const materialCategoryOptions = Array.from<string>(
    new Set((materialItems || []).map((item) => resolveMaterialCategory(item)))
  ).sort((a, b) => a.localeCompare(b));

  const filteredMaterialItems = (materialItems || []).filter((item) => {
    if (materialFilter === 'all') return true;
    const categoryValue = materialFilter.replace('category:', '');
    return resolveMaterialCategory(item) === categoryValue;
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setTitle('');
      setLocation('');
      setPlannedStartDate(undefined);
      setValidUntil(undefined);
      setVatPercent(23);
      setDiscountPercent(0);
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setCustomerAddress('');
      setSelectedContactId(MANUAL_CONTACT_VALUE);
      setNotes('');
      setSelectedLaborIds([]);
      setSelectedMaterialIds([]);
      setLaborFilter('all');
      setMaterialFilter('all');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (project?.location) {
      setLocation((prev) => prev || project.location || '');
    }
    if (primaryProjectContact?._id) {
      setSelectedContactId((prev) => (
        prev === MANUAL_CONTACT_VALUE ? primaryProjectContact._id : prev
      ));
    }
    if (defaultCustomerName) {
      setCustomerName((prev) => prev || defaultCustomerName);
    }
    if (defaultCustomerEmail) {
      setCustomerEmail((prev) => prev || defaultCustomerEmail);
    }
    if (defaultCustomerPhone) {
      setCustomerPhone((prev) => prev || defaultCustomerPhone);
    }
    if (defaultCustomerAddress) {
      setCustomerAddress((prev) => prev || defaultCustomerAddress);
    }
  }, [
    open,
    project?.location,
    defaultCustomerName,
    defaultCustomerEmail,
    defaultCustomerPhone,
    defaultCustomerAddress,
    primaryProjectContact?._id,
  ]);

  // Calculate totals
  const laborTotal = laborItems
    ?.filter(item => selectedLaborIds.includes(item._id))
    .reduce((sum, item) => sum + (item.totalPrice || 0), 0) || 0;

  const materialsTotal = materialItems
    ?.filter(item => selectedMaterialIds.includes(item._id))
    .reduce((sum, item) => sum + (item.totalPrice || 0), 0) || 0;

  const netTotal = laborTotal + materialsTotal;
  const discountAmount = netTotal * (discountPercent / 100);
  const afterDiscount = netTotal - discountAmount;
  const vatAmount = afterDiscount * (vatPercent / 100);
  const grossTotal = afterDiscount + vatAmount;

  const handleContactSelectionChange = (value: string) => {
    if (value === MANUAL_CONTACT_VALUE) {
      setSelectedContactId(MANUAL_CONTACT_VALUE);
      return;
    }

    const contactId = value as Id<"contacts">;
    setSelectedContactId(contactId);
    applyContactData(contactOptions.find((contact) => contact._id === contactId));
  };

  const validateStep = (targetStep: number) => {
    if (targetStep === 2) {
      if (!title.trim()) {
        toast.error('Please enter a title');
        return false;
      }
      if (plannedStartDate && validUntil && validUntil < plannedStartDate) {
        toast.error('Valid until date cannot be earlier than planned start date');
        return false;
      }
    }

    if (targetStep === 3) {
      if (selectedLaborIds.length === 0 && selectedMaterialIds.length === 0) {
        toast.error('Select at least one labor or shopping list item');
        return false;
      }
    }

    if (targetStep === 4) {
      if (!customerName.trim()) {
        toast.error('Please provide customer name or choose a contact');
        return false;
      }
      if (customerEmail.trim() && !CUSTOMER_EMAIL_REGEX.test(customerEmail.trim())) {
        toast.error('Customer email is invalid');
        return false;
      }
      if (vatPercent < 0 || vatPercent > 100 || discountPercent < 0 || discountPercent > 100) {
        toast.error('VAT and discount must be between 0 and 100');
        return false;
      }
    }

    return true;
  };

  const handleNextStep = () => {
    const nextStep = step + 1;
    if (!validateStep(nextStep)) return;
    setStep(nextStep);
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await createEstimation({
        projectId,
        title: title.trim(),
        location: location.trim() || undefined,
        plannedStartDate: plannedStartDate?.getTime(),
        validUntil: validUntil?.getTime(),
        vatPercent,
        discountPercent,
        materialItemIds: selectedMaterialIds,
        laborItemIds: selectedLaborIds,
        customerName: customerName.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        contactId: selectedContactId === MANUAL_CONTACT_VALUE ? undefined : selectedContactId,
        notes: notes.trim() || undefined,
      });

      toast.success('Estimation created successfully');
      onOpenChange(false);
    } catch {
      toast.error('Failed to create estimation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleLaborItem = (id: Id<"laborItems">) => {
    setSelectedLaborIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleMaterialItem = (id: Id<"shoppingListItems">) => {
    setSelectedMaterialIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const visibleLaborIds = filteredLaborItems.map((item) => item._id);
  const allVisibleLaborSelected = visibleLaborIds.length > 0
    && visibleLaborIds.every((id) => selectedLaborIds.includes(id));

  const toggleVisibleLaborSelection = () => {
    if (visibleLaborIds.length === 0) return;

    if (allVisibleLaborSelected) {
      setSelectedLaborIds((prev) => prev.filter((id) => !visibleLaborIds.includes(id)));
      return;
    }

    setSelectedLaborIds((prev) => {
      const next = new Set(prev);
      visibleLaborIds.forEach((id) => next.add(id));
      return Array.from(next) as Id<"laborItems">[];
    });
  };

  const visibleMaterialIds = filteredMaterialItems.map((item) => item._id);
  const allVisibleMaterialsSelected = visibleMaterialIds.length > 0
    && visibleMaterialIds.every((id) => selectedMaterialIds.includes(id));

  const toggleVisibleMaterialSelection = () => {
    if (visibleMaterialIds.length === 0) return;

    if (allVisibleMaterialsSelected) {
      setSelectedMaterialIds((prev) => prev.filter((id) => !visibleMaterialIds.includes(id)));
      return;
    }

    setSelectedMaterialIds((prev) => {
      const next = new Set(prev);
      visibleMaterialIds.forEach((id) => next.add(id));
      return Array.from(next) as Id<"shoppingListItems">[];
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="text-2xl font-[var(--font-display-serif)]">
            New Cost Estimation
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                  step === s
                    ? "bg-[var(--ui-action-bg)] text-[var(--primary-foreground)]"
                    : step > s
                      ? "bg-green-500 text-[var(--primary-foreground)]"
                      : "bg-[var(--ui-border-soft)] text-[var(--ui-text-muted)]"
                )}
              >
                {s}
              </div>
              {s < 4 && (
                <div className={cn(
                  "w-12 h-0.5",
                  step > s ? "bg-green-500" : "bg-[var(--ui-border-soft)]"
                )} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium mb-4">Basic Information</h3>
            <div className="grid gap-4">
              <div>
                <Label>Estimation Title *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Residential Architecture Phase 1"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Location / Address</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Warsaw, ul. Nowa 5"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Planned Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal mt-1",
                          !plannedStartDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {plannedStartDate ? format(plannedStartDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={plannedStartDate}
                        onSelect={setPlannedStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Valid Until</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal mt-1",
                          !validUntil && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {validUntil ? format(validUntil, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={validUntil}
                        onSelect={setValidUntil}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Select Items */}
        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium mb-4">Select Labor Items</h3>
            <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-[var(--ui-text-muted)]">{selectedLaborIds.length} selected</span>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Select value={laborFilter} onValueChange={setLaborFilter}>
                  <SelectTrigger className="h-8 w-full sm:w-[200px]">
                    <SelectValue placeholder="Filter by section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sections</SelectItem>
                    {(laborSections || []).map((section) => (
                      <SelectItem key={section._id} value={section._id}>
                        {section.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="unassigned">No section</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="w-full sm:w-auto" variant="ghost" size="sm" onClick={toggleVisibleLaborSelection}>
                  {allVisibleLaborSelected ? 'Deselect visible' : 'Select visible'}
                </Button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto overflow-x-hidden rounded-lg border">
              {laborItems?.length === 0 ? (
                <div className="p-4 text-center text-[var(--ui-text-muted)]">
                  No labor items. Add some in the Labor section first.
                </div>
              ) : filteredLaborItems.length === 0 ? (
                <div className="p-4 text-center text-[var(--ui-text-muted)]">
                  No labor items match this section filter.
                </div>
              ) : (
                filteredLaborItems.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-[var(--ui-surface-soft)]"
                  >
                    <Checkbox
                      checked={selectedLaborIds.includes(item._id)}
                      onCheckedChange={() => toggleLaborItem(item._id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.name}</div>
                      <div className="truncate text-sm text-[var(--ui-text-muted)]">
                        {item.quantity} {item.unit}
                        {item.sectionId && laborSectionNameById.get(item.sectionId) && (
                          <span> • {laborSectionNameById.get(item.sectionId)}</span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-right font-medium tabular-nums">
                      {item.totalPrice?.toFixed(2) || '0.00'} {currencySymbol}
                    </span>
                  </div>
                ))
              )}
            </div>

            <h3 className="text-lg font-medium mb-4 mt-6">Select Shopping List Items</h3>
            <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-[var(--ui-text-muted)]">{selectedMaterialIds.length} selected</span>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Select value={materialFilter} onValueChange={setMaterialFilter}>
                  <SelectTrigger className="h-8 w-full sm:w-[220px]">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {materialCategoryOptions.map((category) => (
                      <SelectItem key={category} value={`category:${category}`}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="w-full sm:w-auto" variant="ghost" size="sm" onClick={toggleVisibleMaterialSelection}>
                  {allVisibleMaterialsSelected ? 'Deselect visible' : 'Select visible'}
                </Button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto overflow-x-hidden rounded-lg border">
              {materialItems?.length === 0 ? (
                <div className="p-4 text-center text-[var(--ui-text-muted)]">
                  No shopping list items. Add some in the Shopping List section first.
                </div>
              ) : filteredMaterialItems.length === 0 ? (
                <div className="p-4 text-center text-[var(--ui-text-muted)]">
                  No shopping list items match this category filter.
                </div>
              ) : (
                filteredMaterialItems.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-[var(--ui-surface-soft)]"
                  >
                    <Checkbox
                      checked={selectedMaterialIds.includes(item._id)}
                      onCheckedChange={() => toggleMaterialItem(item._id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.name}</div>
                      <div className="truncate text-sm text-[var(--ui-text-muted)]">
                        Qty: {item.quantity}
                        <span> • {resolveMaterialCategory(item)}</span>
                      </div>
                    </div>
                    <span className="shrink-0 text-right font-medium tabular-nums">
                      {item.totalPrice?.toFixed(2) || '0.00'} {currencySymbol}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Step 3: Customer & Settings */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium mb-4">Customer Information & Settings</h3>
            {hasProjectCustomerDefaults && (
              <p className="text-sm text-[var(--ui-text-muted)]">
                Customer details were pre-filled from {primaryProjectContact ? 'the project contact' : 'the project settings'}.
              </p>
            )}
            <div>
              <Label>Customer Source</Label>
              <Select
                value={selectedContactId}
                onValueChange={handleContactSelectionChange}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Manual entry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MANUAL_CONTACT_VALUE}>Manual entry</SelectItem>
                  {contactOptions.map((contact) => (
                    <SelectItem key={contact._id} value={contact._id}>
                      {contact.name}
                      {contact.companyName ? ` (${contact.companyName})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedContact?.projectRole && (
                <p className="mt-2 text-xs text-[var(--ui-text-muted)]">
                  Project role: {selectedContact.projectRole}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Customer Name</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="John Smith"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+48 123 456 789"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Address</Label>
                <Input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Customer address"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
              <div>
                <Label>VAT (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={vatPercent}
                  onChange={(e) => setVatPercent(parseFloat(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Discount (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes for the estimation..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Step 4: Summary */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium mb-4">Summary</h3>

            <div className="rounded-lg border p-4 bg-[var(--ui-surface-soft)]">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">{title || 'Untitled Estimation'}</span>
                {nextNumber && (
                  <span className="text-sm text-[var(--ui-text-muted)]">#{nextNumber}</span>
                )}
              </div>
              {location && <p className="text-sm text-[var(--ui-text-muted)]">{location}</p>}
              {customerName && <p className="text-sm text-[var(--ui-text-muted)]">Client: {customerName}</p>}
            </div>

            <div className="space-y-3 pt-4">
              <div className="flex justify-between">
                <span className="text-[var(--ui-text-muted)]">Labor ({selectedLaborIds.length} items)</span>
                <span>{laborTotal.toFixed(2)} {currencySymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ui-text-muted)]">Shopping List ({selectedMaterialIds.length} items)</span>
                <span>{materialsTotal.toFixed(2)} {currencySymbol}</span>
              </div>
              <div className="flex justify-between font-medium border-t pt-3">
                <span>Net Total</span>
                <span>{netTotal.toFixed(2)} {currencySymbol}</span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Discount ({discountPercent}%)</span>
                  <span>-{discountAmount.toFixed(2)} {currencySymbol}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[var(--ui-text-muted)]">VAT ({vatPercent}%)</span>
                <span>{vatAmount.toFixed(2)} {currencySymbol}</span>
              </div>
              <div className="flex justify-between text-xl font-semibold border-t pt-3">
                <span>Gross Total</span>
                <span>{grossTotal.toFixed(2)} {currencySymbol}</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-6 border-t">
          <Button
            variant="outline"
            onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)}
          >
            <ChevronLeftIcon className="h-4 w-4 mr-2" />
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>

          {step < 4 ? (
            <Button onClick={handleNextStep}>
              Next
              <ChevronRightIcon className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Estimation'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
