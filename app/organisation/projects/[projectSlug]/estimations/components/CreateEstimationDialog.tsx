'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { apiAny } from '@/lib/convexApiAny';
import { Id } from '@/convex/_generated/dataModel';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { toUserFacingErrorMessage } from '@/lib/userFacingErrors';
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
import { ChevronRightIcon, ChevronLeftIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  calculateTaxBreakdown,
  getPrimaryAmountKindForDisplay,
  getTaxAmountKindLabel,
  resolveOrganizationTaxSettings,
} from '@/lib/organizationTax';
import { useI18n } from '@/lib/i18n';

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
  const { t } = useI18n();
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
      return shoppingSectionNameById.get(item.sectionId) || t('estimations', 'uncategorized');
    }
    return t('estimations', 'uncategorized');
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
  const localizedPrimarySummaryAmountLabel =
    primarySummaryAmountKind === 'tax'
      ? primarySummaryAmountLabel
      : t('estimations', primarySummaryAmountKind === 'gross' ? 'gross' : 'net');
  const laborSummaryAmount =
    calculateTaxBreakdown(laborTotal, summaryTaxSettings)[primarySummaryAmountKind];
  const materialsSummaryAmount =
    calculateTaxBreakdown(materialsTotal, summaryTaxSettings)[primarySummaryAmountKind];
  const totalSummaryAmount =
    calculateTaxBreakdown(netTotal, summaryTaxSettings)[primarySummaryAmountKind];
  const taxSettingsDescription = hasTaxApplied
    ? t('estimations', 'taxDefaultDescription')
    : t('estimations', 'noTaxDefaultDescription');

  const validateStep = (targetStep: number) => {
    if (targetStep === 2) {
      if (!title.trim()) {
        toast.error(t('estimations', 'pleaseEnterTitle'));
        return false;
      }
      if (plannedStartDate && validUntil && validUntil < plannedStartDate) {
        toast.error(t('estimations', 'validUntilBeforeStart'));
        return false;
      }
    }

    if (targetStep === 3) {
      if (selectedLaborIds.length === 0 && selectedMaterialIds.length === 0) {
        toast.error(t('estimations', 'selectAtLeastOneItem'));
        return false;
      }
    }

    if (targetStep === 4) {
      if (!customerName.trim()) {
        toast.error(t('estimations', 'pleaseProvideCustomerName'));
        return false;
      }
      if (customerEmail.trim() && !CUSTOMER_EMAIL_REGEX.test(customerEmail.trim())) {
        toast.error(t('estimations', 'customerEmailInvalid'));
        return false;
      }
      if (vatPercent < 0 || vatPercent > 100) {
        toast.error(t('estimations', 'taxBetweenZeroAndHundred'));
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

      toast.success(isEditMode ? t('estimations', 'estimationUpdated') : t('estimations', 'estimationCreated'));
      onOpenChange(false);
    } catch (error) {
      toast.error(isEditMode ? t('estimations', 'failedToUpdateEstimation') : t('estimations', 'failedToCreateEstimation'), {
        description: toUserFacingErrorMessage(error),
      });
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

  const dialogTitle = isEditMode ? t('estimations', 'editCostEstimation') : t('estimations', 'newCostEstimation');
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
            <p className="text-lg font-medium">{t('estimations', 'estimationNotFound')}</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {t('estimations', 'estimationMissingDescription')}
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('estimations', 'close')}
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
            <h3 className="mb-4 text-lg font-medium">{t('estimations', 'details')}</h3>
            <div className="grid gap-4">
              <div>
                <Label>{t('estimations', 'titleRequired')}</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('estimations', 'estimationTitlePlaceholder')}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>{t('estimations', 'location')}</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={t('estimations', 'location')}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>{t('estimations', 'plannedStartDate')}</Label>
                  <DatePicker
                    date={plannedStartDate}
                    onDateChange={setPlannedStartDate}
                    placeholder={t('estimations', 'selectDate')}
                    className="mt-1 w-full border-border bg-secondary/70 hover:bg-secondary aria-expanded:bg-secondary"
                  />
                </div>
                <div>
                  <Label>{t('estimations', 'validUntil')}</Label>
                  <DatePicker
                    date={validUntil}
                    onDateChange={setValidUntil}
                    placeholder={t('estimations', 'selectDate')}
                    className="mt-1 w-full border-border bg-secondary/70 hover:bg-secondary aria-expanded:bg-secondary"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6">
            <h3 className="mb-4 text-lg font-medium">{t('estimations', 'labor')}</h3>
            <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-muted-foreground">{t('estimations', 'selectedCount', { count: selectedLaborIds.length })}</span>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Select value={laborFilter} onValueChange={setLaborFilter}>
                  <SelectTrigger className="h-8 w-full sm:w-[200px]">
                    <SelectValue placeholder={t('estimations', 'filterBySection')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('estimations', 'allSections')}</SelectItem>
                    {(laborSections || []).map((section) => (
                      <SelectItem key={section._id} value={section._id}>
                        {section.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="unassigned">{t('estimations', 'noSection')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="w-full sm:w-auto" variant="ghost" size="sm" onClick={toggleAllLaborSelection}>
                  {allLaborSelected ? t('estimations', 'deselectAll') : t('estimations', 'selectAll')}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('estimations', 'laborSelectionDescription')}
            </p>
            <div className="max-h-64 overflow-y-auto overflow-x-hidden rounded-lg border">
              {laborItems?.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {t('estimations', 'noLaborItems')}
                </div>
              ) : filteredLaborItems.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {t('estimations', 'noLaborItemsMatchFilter')}
                </div>
              ) : (
                filteredLaborItems.map((item) => (
                  <div
                  key={item._id}
                    className="flex items-center gap-3 border-b p-3 last:border-b-0 hover:bg-secondary/70"
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

            <h3 className="mb-4 mt-6 text-lg font-medium">{t('estimations', 'materials')}</h3>
            <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-muted-foreground">{t('estimations', 'selectedCount', { count: selectedMaterialIds.length })}</span>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Select value={materialFilter} onValueChange={setMaterialFilter}>
                  <SelectTrigger className="h-8 w-full sm:w-[220px]">
                    <SelectValue placeholder={t('estimations', 'filterByCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('estimations', 'allCategories')}</SelectItem>
                    {materialCategoryOptions.map((category) => (
                      <SelectItem key={category} value={`category:${category}`}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="w-full sm:w-auto" variant="ghost" size="sm" onClick={toggleAllMaterialSelection}>
                  {allMaterialsSelected ? t('estimations', 'deselectAll') : t('estimations', 'selectAll')}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('estimations', 'materialsSelectionDescription')}
            </p>
            <div className="max-h-64 overflow-y-auto overflow-x-hidden rounded-lg border">
              {materialItems?.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {t('estimations', 'noMaterials')}
                </div>
              ) : filteredMaterialItems.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {t('estimations', 'noMaterialsMatchFilter')}
                </div>
              ) : (
                filteredMaterialItems.map((item) => (
                  <div
                  key={item._id}
                    className="flex items-center gap-3 border-b p-3 last:border-b-0 hover:bg-secondary/70"
                  >
                    <Checkbox
                      checked={selectedMaterialIds.includes(item._id)}
                      onCheckedChange={() => toggleMaterialItem(item._id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.name}</div>
                      <div className="truncate text-sm text-muted-foreground">
                        {t('estimations', 'qtyWithValue', { value: item.quantity })}
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
            <h3 className="mb-4 text-lg font-medium">{t('estimations', 'customer')}</h3>
            <div>
              <Label>{t('estimations', 'projectContact')}</Label>
              <Select
                value={selectedContactId}
                onValueChange={(value) =>
                  setSelectedContactId(value === 'custom' ? 'custom' : (value as Id<"contacts">))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={t('estimations', 'chooseProjectContact')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">{t('estimations', 'customDetails')}</SelectItem>
                  {contactOptions.map((contact) => (
                    <SelectItem key={contact._id} value={contact._id}>
                      {contact.name}
                      {contact.companyName ? ` • ${contact.companyName}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('estimations', 'selectedContactDescription')}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>{t('estimations', 'name')}</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t('estimations', 'customerNamePlaceholder')}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>{t('estimations', 'email')}</Label>
                <Input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder={t('estimations', 'emailPlaceholder')}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>{t('estimations', 'phone')}</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder={t('estimations', 'phone')}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>{t('estimations', 'address')}</Label>
                <Input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder={t('estimations', 'address')}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <Label>{t('estimations', 'tax')}</Label>
              <div className="mt-1 rounded-xl border border-border/70 bg-secondary/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium">
                      {hasTaxApplied ? `${estimationTaxLabel} (${vatPercent}%)` : t('estimations', 'noTax')}
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
              <Label>{t('estimations', 'notes')}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('estimations', 'notes')}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <h3 className="mb-4 text-lg font-medium">{t('estimations', 'summary')}</h3>

            <Card className="rounded-2xl border border-border/70 bg-secondary/70 shadow-none">
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{title || t('estimations', 'untitledEstimation')}</span>
                  {summaryNumber && (
                    <Badge variant="outline" className="text-xs">#{summaryNumber}</Badge>
                  )}
                </div>
                {location && <p className="text-sm text-muted-foreground">{location}</p>}
                {customerName && <p className="text-sm text-muted-foreground">{t('estimations', 'customerWithName', { name: customerName })}</p>}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3 pt-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('estimations', 'summaryLineLabel', {
                    label: t('estimations', 'labor'),
                    count: selectedLaborIds.length,
                    amount: localizedPrimarySummaryAmountLabel.toLowerCase(),
                  })}
                </span>
                <span>{laborSummaryAmount.toFixed(2)} {currencySymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('estimations', 'summaryLineLabel', {
                    label: t('estimations', 'materials'),
                    count: selectedMaterialIds.length,
                    amount: localizedPrimarySummaryAmountLabel.toLowerCase(),
                  })}
                </span>
                <span>{materialsSummaryAmount.toFixed(2)} {currencySymbol}</span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="text-xl font-semibold">
                  {t('estimations', 'totalWithAmount', { amount: localizedPrimarySummaryAmountLabel.toLowerCase() })}
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
            {step === 1 ? t('estimations', 'cancel') : t('estimations', 'back')}
          </Button>

          {step < 4 ? (
            <Button onClick={handleNextStep}>
              {t('estimations', 'next')}
              <ChevronRightIcon className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting
                ? (isEditMode ? t('estimations', 'saving') : t('estimations', 'creating'))
                : (isEditMode ? t('estimations', 'saveChanges') : t('estimations', 'createEstimation'))}
            </Button>
          )}
        </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
