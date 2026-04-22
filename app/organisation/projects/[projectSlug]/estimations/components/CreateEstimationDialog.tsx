'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
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
import {
  calculateTaxBreakdown,
  getPrimaryAmountKindForDisplay,
  getTaxAmountKindLabel,
  resolveOrganizationTaxSettings,
} from '@/lib/organizationTax';

interface CreateEstimationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: Id<"projects">;
  currencySymbol: string;
  estimationId?: Id<"costEstimations">;
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

const CUSTOMER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CreateEstimationDialog({
  open,
  onOpenChange,
  projectId,
  currencySymbol,
  estimationId,
}: CreateEstimationDialogProps) {
  const { project, team } = useProject();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hydratedEditId, setHydratedEditId] = useState<Id<"costEstimations"> | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [plannedStartDate, setPlannedStartDate] = useState<Date | undefined>(undefined);
  const [validUntil, setValidUntil] = useState<Date | undefined>(undefined);
  const [vatPercent, setVatPercent] = useState(23);
  const [selectedContactId, setSelectedContactId] = useState<Id<"contacts"> | "custom">("custom");
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedLaborIds, setSelectedLaborIds] = useState<Id<"laborItems">[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Id<"shoppingListItems">[]>([]);
  const [laborFilter, setLaborFilter] = useState('all');
  const [materialFilter, setMaterialFilter] = useState('all');
  const [didInitializeLaborSelection, setDidInitializeLaborSelection] = useState(false);
  const [didInitializeMaterialSelection, setDidInitializeMaterialSelection] = useState(false);

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
  const estimationToEdit = useQuery(
    apiAny.costEstimations.getCostEstimationWithItems,
    open && estimationId ? { estimationId } : "skip"
  );

  const createEstimation = useMutation(apiAny.costEstimations.createCostEstimation);
  const updateEstimation = useMutation(apiAny.costEstimations.updateCostEstimation);
  const isEditMode = Boolean(estimationId);

  const contactOptions = useMemo(
    () => (projectContacts || []) as ProjectContactOption[],
    [projectContacts]
  );
  const primaryProjectContact = contactOptions[0];
  const primaryProjectContactId = primaryProjectContact?._id;

  const buildContactAddress = useCallback((contact: Pick<ProjectContactOption, 'address' | 'postalCode' | 'city' | 'country'> | undefined) => {
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
  }, []);

  const defaultCustomerName = (primaryProjectContact?.name || project?.customer || '').trim();
  const defaultCustomerEmail = (primaryProjectContact?.email || '').trim();
  const defaultCustomerPhone = (primaryProjectContact?.phone || '').trim();
  const defaultCustomerAddress = buildContactAddress(primaryProjectContact);
  const defaultPlannedStartTimestamp = project?.startDate;
  const defaultValidUntilTimestamp = project?.endDate;
  const organizationTaxSettings = useMemo(
    () => resolveOrganizationTaxSettings(team?.organizationTaxSettings),
    [team?.organizationTaxSettings],
  );
  const estimationTaxLabel = organizationTaxSettings.taxLabel;
  const defaultVatPercent =
    organizationTaxSettings.taxEnabled ? organizationTaxSettings.taxRate : 0;
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

  // Reset form when create dialog opens
  useEffect(() => {
    if (!open) {
      setHydratedEditId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || isEditMode) return;

    setStep(1);
    setTitle('');
    setLocation('');
    setPlannedStartDate(
      defaultPlannedStartTimestamp ? new Date(defaultPlannedStartTimestamp) : undefined
    );
    setValidUntil(
      defaultValidUntilTimestamp ? new Date(defaultValidUntilTimestamp) : undefined
    );
    setVatPercent(defaultVatPercent);
    setSelectedContactId(primaryProjectContactId || 'custom');
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setCustomerAddress('');
    setNotes('');
    setSelectedLaborIds([]);
    setSelectedMaterialIds([]);
    setLaborFilter('all');
    setMaterialFilter('all');
    setDidInitializeLaborSelection(false);
    setDidInitializeMaterialSelection(false);
    setHydratedEditId(null);
  }, [
    defaultPlannedStartTimestamp,
    defaultValidUntilTimestamp,
    defaultVatPercent,
    isEditMode,
    open,
    primaryProjectContactId,
  ]);

  useEffect(() => {
    if (!open || !isEditMode || !estimationToEdit) return;
    if (hydratedEditId === estimationToEdit._id) return;

    setStep(1);
    setTitle(estimationToEdit.title || '');
    setLocation(estimationToEdit.location || '');
    setPlannedStartDate(
      estimationToEdit.plannedStartDate ? new Date(estimationToEdit.plannedStartDate) : undefined
    );
    setValidUntil(
      estimationToEdit.validUntil ? new Date(estimationToEdit.validUntil) : undefined
    );
    setVatPercent(
      estimationToEdit.taxSnapshot?.taxRate ?? estimationToEdit.vatPercent ?? defaultVatPercent,
    );
    setSelectedContactId(estimationToEdit.contactId || 'custom');
    setCustomerName(estimationToEdit.customerName || '');
    setCustomerEmail(estimationToEdit.customerEmail || '');
    setCustomerPhone(estimationToEdit.customerPhone || '');
    setCustomerAddress(estimationToEdit.customerAddress || '');
    setNotes(estimationToEdit.notes || '');
    setSelectedLaborIds(estimationToEdit.laborItemIds || []);
    setSelectedMaterialIds(estimationToEdit.materialItemIds || []);
    setLaborFilter('all');
    setMaterialFilter('all');
    setDidInitializeLaborSelection(true);
    setDidInitializeMaterialSelection(true);
    setHydratedEditId(estimationToEdit._id);
  }, [defaultVatPercent, estimationToEdit, hydratedEditId, isEditMode, open]);

  useEffect(() => {
    if (!open || isEditMode || didInitializeLaborSelection || laborItems === undefined) return;

    setDidInitializeLaborSelection(true);
  }, [didInitializeLaborSelection, isEditMode, laborItems, open]);

  useEffect(() => {
    if (!open || isEditMode || didInitializeMaterialSelection || materialItems === undefined) return;

    setDidInitializeMaterialSelection(true);
  }, [didInitializeMaterialSelection, isEditMode, materialItems, open]);

  useEffect(() => {
    if (!open || isEditMode) return;

    if (project?.location) {
      setLocation((prev) => prev || project.location || '');
    }
    if (defaultPlannedStartTimestamp) {
      setPlannedStartDate((prev) => prev || new Date(defaultPlannedStartTimestamp));
    }
    if (defaultValidUntilTimestamp) {
      setValidUntil((prev) => prev || new Date(defaultValidUntilTimestamp));
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
    defaultPlannedStartTimestamp,
    defaultValidUntilTimestamp,
    defaultCustomerName,
    defaultCustomerEmail,
    defaultCustomerPhone,
    defaultCustomerAddress,
    isEditMode,
    primaryProjectContactId,
  ]);

  useEffect(() => {
    if (!open || !selectedContactId || selectedContactId === 'custom') {
      return;
    }

    const selectedContact = contactOptions.find((contact) => contact._id === selectedContactId);
    if (!selectedContact) {
      return;
    }

    setCustomerName(selectedContact.name || '');
    setCustomerEmail(selectedContact.email || '');
    setCustomerPhone(selectedContact.phone || '');
    setCustomerAddress(buildContactAddress(selectedContact));
  }, [buildContactAddress, contactOptions, open, selectedContactId]);

  // Calculate totals
  const laborTotal = laborItems
    ?.filter(item => selectedLaborIds.includes(item._id))
    .reduce((sum, item) => sum + (item.totalPrice || 0), 0) || 0;

  const materialsTotal = materialItems
    ?.filter(item => selectedMaterialIds.includes(item._id))
    .reduce((sum, item) => sum + (item.totalPrice || 0), 0) || 0;

  const netTotal = laborTotal + materialsTotal;
  const hasTaxApplied = vatPercent > 0;
  const summaryTaxSettings = {
    taxEnabled: hasTaxApplied,
    taxRate: vatPercent,
    taxLabel: estimationTaxLabel,
  };
  const primarySummaryAmountKind = getPrimaryAmountKindForDisplay(summaryTaxSettings);
  const primarySummaryAmountLabel = getTaxAmountKindLabel(
    primarySummaryAmountKind,
    summaryTaxSettings,
  );
  const laborSummaryAmount =
    calculateTaxBreakdown(laborTotal, summaryTaxSettings)[primarySummaryAmountKind];
  const materialsSummaryAmount =
    calculateTaxBreakdown(materialsTotal, summaryTaxSettings)[primarySummaryAmountKind];
  const totalSummaryAmount =
    calculateTaxBreakdown(netTotal, summaryTaxSettings)[primarySummaryAmountKind];
  const taxSettingsDescription = hasTaxApplied
    ? 'Uses the current workspace tax default for document exports.'
    : 'No default tax is configured for this workspace.';

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
        toast.error('Please provide a customer name');
        return false;
      }
      if (customerEmail.trim() && !CUSTOMER_EMAIL_REGEX.test(customerEmail.trim())) {
        toast.error('Customer email is invalid');
        return false;
      }
      if (vatPercent < 0 || vatPercent > 100) {
        toast.error('Tax must be between 0 and 100');
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
      const payload = {
        title: title.trim(),
        location: location.trim() || undefined,
        plannedStartDate: plannedStartDate?.getTime(),
        validUntil: validUntil?.getTime(),
        vatPercent,
        discountPercent: 0,
        materialItemIds: selectedMaterialIds,
        laborItemIds: selectedLaborIds,
        customerName: customerName.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        contactId: selectedContactId !== 'custom' ? selectedContactId : undefined,
        notes: notes.trim() || undefined,
      };

      if (isEditMode && estimationId) {
        await updateEstimation({
          estimationId,
          ...payload,
        });
      } else {
        await createEstimation({
          projectId,
          ...payload,
        });
      }

      toast.success(isEditMode ? 'Estimation updated successfully' : 'Estimation created successfully');
      onOpenChange(false);
    } catch {
      toast.error(isEditMode ? 'Failed to update estimation' : 'Failed to create estimation');
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

  const allLaborIds = (laborItems || []).map((item) => item._id);
  const allLaborSelected = allLaborIds.length > 0
    && allLaborIds.every((id) => selectedLaborIds.includes(id));

  const toggleAllLaborSelection = () => {
    if (allLaborIds.length === 0) return;

    if (allLaborSelected) {
      setSelectedLaborIds([]);
      return;
    }

    setSelectedLaborIds(allLaborIds);
  };

  const allMaterialIds = (materialItems || []).map((item) => item._id);
  const allMaterialsSelected = allMaterialIds.length > 0
    && allMaterialIds.every((id) => selectedMaterialIds.includes(id));

  const toggleAllMaterialSelection = () => {
    if (allMaterialIds.length === 0) return;

    if (allMaterialsSelected) {
      setSelectedMaterialIds([]);
      return;
    }

    setSelectedMaterialIds(allMaterialIds);
  };

  const dialogTitle = isEditMode ? 'Edit Cost Estimation' : 'New Cost Estimation';
  const summaryNumber = isEditMode ? estimationToEdit?.estimationNumber : nextNumber;
  const isEditLoading = isEditMode && estimationToEdit === undefined;
  const isEditMissing = isEditMode && estimationToEdit === null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            {dialogTitle}
          </DialogTitle>
        </DialogHeader>

        {isEditLoading ? (
          <div className="flex min-h-80 items-center justify-center">
            <Spinner className="p-4" />
          </div>
        ) : isEditMissing ? (
          <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-center">
            <p className="text-lg font-medium">Estimation not found</p>
            <p className="max-w-md text-sm text-muted-foreground">
              This estimation could not be loaded. It may have been deleted in another session.
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <>
        <div className="mb-6 flex items-center justify-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : step > s
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {s}
              </div>
              {s < 4 && (
                <div className={cn(
                  "h-0.5 w-12",
                  step > s ? "bg-primary" : "bg-border"
                )} />
              )}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <h3 className="mb-4 text-lg font-medium">Details</h3>
            <div className="grid gap-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Estimation title"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Location"
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
                          "mt-1 w-full justify-start border-border bg-white text-left font-normal hover:bg-white aria-expanded:bg-white",
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
                          "mt-1 w-full justify-start border-border bg-white text-left font-normal hover:bg-white aria-expanded:bg-white",
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

        {step === 2 && (
          <div className="flex flex-col gap-6">
            <h3 className="mb-4 text-lg font-medium">Labor</h3>
            <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-muted-foreground">{selectedLaborIds.length} selected</span>
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
                <Button className="w-full sm:w-auto" variant="ghost" size="sm" onClick={toggleAllLaborSelection}>
                  {allLaborSelected ? 'Deselect all' : 'Select all'}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Start from an empty document and choose only the work items you want in this estimation.
            </p>
            <div className="max-h-64 overflow-y-auto overflow-x-hidden rounded-lg border">
              {laborItems?.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No labor items. Add some in the Labor section first.
                </div>
              ) : filteredLaborItems.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No labor items match this section filter.
                </div>
              ) : (
                filteredLaborItems.map((item) => (
                  <div
                  key={item._id}
                    className="flex items-center gap-3 border-b p-3 last:border-b-0 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedLaborIds.includes(item._id)}
                      onCheckedChange={() => toggleLaborItem(item._id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.name}</div>
                      <div className="truncate text-sm text-muted-foreground">
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

            <h3 className="mb-4 mt-6 text-lg font-medium">Materials</h3>
            <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-muted-foreground">{selectedMaterialIds.length} selected</span>
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
                <Button className="w-full sm:w-auto" variant="ghost" size="sm" onClick={toggleAllMaterialSelection}>
                  {allMaterialsSelected ? 'Deselect all' : 'Select all'}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Materials are not auto-included anymore. Select the exact scope for this client document.
            </p>
            <div className="max-h-64 overflow-y-auto overflow-x-hidden rounded-lg border">
              {materialItems?.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No materials available. Add items in Shopping list first.
                </div>
              ) : filteredMaterialItems.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No materials match this category filter.
                </div>
              ) : (
                filteredMaterialItems.map((item) => (
                  <div
                  key={item._id}
                    className="flex items-center gap-3 border-b p-3 last:border-b-0 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedMaterialIds.includes(item._id)}
                      onCheckedChange={() => toggleMaterialItem(item._id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.name}</div>
                      <div className="truncate text-sm text-muted-foreground">
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

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <h3 className="mb-4 text-lg font-medium">Customer</h3>
            <div>
              <Label>Project Contact</Label>
              <Select
                value={selectedContactId}
                onValueChange={(value) =>
                  setSelectedContactId(value === 'custom' ? 'custom' : (value as Id<"contacts">))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose project contact" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom details</SelectItem>
                  {contactOptions.map((contact) => (
                    <SelectItem key={contact._id} value={contact._id}>
                      {contact.name}
                      {contact.companyName ? ` • ${contact.companyName}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-sm text-muted-foreground">
                The selected contact fills the document snapshot, but you can still adjust the values below before saving.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer name"
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
                  placeholder="Phone"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Address</Label>
                <Input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Address"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <Label>Tax</Label>
              <div className="mt-1 rounded-xl border border-border/70 bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {hasTaxApplied ? `${estimationTaxLabel} (${vatPercent}%)` : 'No tax'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {taxSettingsDescription}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {hasTaxApplied ? `${vatPercent}%` : '0%'}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes"
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <h3 className="mb-4 text-lg font-medium">Summary</h3>

            <Card className="rounded-2xl border border-border/70 bg-muted/30 shadow-none">
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{title || 'Untitled estimation'}</span>
                  {summaryNumber && (
                    <Badge variant="outline" className="text-xs">#{summaryNumber}</Badge>
                  )}
                </div>
                {location && <p className="text-sm text-muted-foreground">{location}</p>}
                {customerName && <p className="text-sm text-muted-foreground">Customer: {customerName}</p>}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3 pt-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Labor ({selectedLaborIds.length} items, {primarySummaryAmountLabel.toLowerCase()})
                </span>
                <span>{laborSummaryAmount.toFixed(2)} {currencySymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Materials ({selectedMaterialIds.length} items, {primarySummaryAmountLabel.toLowerCase()})
                </span>
                <span>{materialsSummaryAmount.toFixed(2)} {currencySymbol}</span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="text-xl font-semibold">
                  Total ({primarySummaryAmountLabel.toLowerCase()})
                </span>
                <span className="text-xl font-semibold">
                  {totalSummaryAmount.toFixed(2)} {currencySymbol}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between border-t pt-6">
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
              {isSubmitting ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Estimation')}
            </Button>
          )}
        </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
