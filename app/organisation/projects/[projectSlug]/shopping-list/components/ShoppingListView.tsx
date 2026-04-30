'use client';

import { useState, useTransition } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Doc, Id } from '@/convex/_generated/dataModel';
import { useProject } from '@/components/providers/ProjectProvider';
import { ProjectPageLayout } from '@/components/project/ProjectPageLayout';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SearchIcon, XIcon } from 'lucide-react';
import { apiAny } from '@/lib/convexApiAny';
import { downloadCsvFile } from '@/lib/csvExport';
import { exportSectionedTablePdf } from '@/lib/sectionedTablePdfExport';
import { calculateShoppingTotal, buildShoppingSetContext, isItemCountedInShoppingTotal } from '@/lib/shoppingSets';
import {
  type ShoppingExportColumnOptions,
  formatShoppingExportProductLabel,
  getShoppingExportCsvRow,
  getShoppingExportHeaders,
  type ShoppingExportRow,
} from '@/lib/shoppingListExport';
import type { TeamMember } from '@/lib/teamMember';
import { formatCurrency, getCurrencySymbol } from '@/lib/utils';
import { getActivePriceTaxRates } from '@/lib/priceTax';
import {
  formatMoney,
  sanitizeFileName,
} from '@/lib/pdfExport';
import { exportWorkbookTables, getSectionAccentColor } from '@/lib/xlsxExport';

import { AddItemForm } from './AddItemForm';
import { ExportModal, type ShoppingListExportOptions } from './ExportModal';
import { SectionManager } from './SectionManager';
import { ShoppingListHeader } from './ShoppingListHeader';
import { ShoppingListOnboarding } from './ShoppingListOnboarding';
import { ShoppingListSection } from './ShoppingListSection';

type ShoppingListItem = Doc<"shoppingListItems">;
type ShoppingSet = Doc<"shoppingSets"> & {
  resolvedBySource?: "team" | "client" | null;
  resolvedByName?: string | null;
  resolvedAt?: number | null;
};

const STATUS_LABELS: Record<ShoppingListItem["realizationStatus"], string> = {
  PLANNED: 'Planned',
  ORDERED: 'Ordered',
  IN_TRANSIT: 'In Transit',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const getStatusLabel = (status: ShoppingListItem["realizationStatus"]) => STATUS_LABELS[status] ?? status;
const getToolbarStatusLabel = (status: ShoppingListItem["realizationStatus"]) => {
  switch (status) {
    case 'PLANNED':
      return 'Planned';
    case 'ORDERED':
      return 'Ordered';
    case 'IN_TRANSIT':
      return 'In transit';
    case 'DELIVERED':
      return 'Delivered';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status;
  }
};
const getSectionOptionLabel = (section: string) => section === 'No Section' ? 'No section' : section;
const formatItemCountLabel = (count: number) => `${count} ${count === 1 ? 'item' : 'items'}`;

export function ShoppingListViewSkeleton() {
  return <Spinner className="p-4 sm:p-6" />;
}

export default function ShoppingListView() {
  const [isPending] = useTransition();
  const [showMainAddForm, setShowMainAddForm] = useState(false);
  const [isSectionManagerOpen, setIsSectionManagerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ShoppingListItem["realizationStatus"]>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | NonNullable<ShoppingListItem["priority"]>>('all');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportOptions, setExportOptions] = useState<ShoppingListExportOptions>({
    format: 'xlsx',
    scope: 'currentView',
    includeNotes: true,
    includeStatus: true,
    includeSupplier: true,
    groupBySections: true,
  });

  const { project } = useProject();

  const items = useQuery(apiAny.shopping.listShoppingListItems, { projectId: project._id }) as ShoppingListItem[] | undefined;
  const sections = useQuery(apiAny.shopping.listShoppingListSections, { projectId: project._id }) as Doc<"shoppingListSections">[] | undefined;
  const sets = useQuery(apiAny.shopping.listShoppingSets, { projectId: project._id }) as ShoppingSet[] | undefined;
  const teamMembers = useQuery(apiAny.teams.getTeamMembers, { teamId: project.teamId }) as TeamMember[] | undefined;
  const team = useQuery(apiAny.teams.getTeamById, { teamId: project.teamId }) as Doc<"teams"> | undefined;
  const onboardingStatus = useQuery(apiAny.onboarding.getStatus);
  const extensionReady = onboardingStatus?.clipperConnected === true;

  const createItem = useMutation(apiAny.shopping.createShoppingListItem);
  const updateItem = useMutation(apiAny.shopping.updateShoppingListItem);
  const deleteItem = useMutation(apiAny.shopping.deleteShoppingListItem);
  const createSection = useMutation(apiAny.shopping.createShoppingListSection);
  const updateSection = useMutation(apiAny.shopping.updateShoppingListSection);
  const deleteSection = useMutation(apiAny.shopping.deleteShoppingListSection);
  const createSet = useMutation(apiAny.shopping.createShoppingSet);
  const updateSet = useMutation(apiAny.shopping.updateShoppingSet);
  const deleteSet = useMutation(apiAny.shopping.deleteShoppingSet);

  if (items === undefined || sections === undefined || sets === undefined || team === undefined || onboardingStatus === undefined) {
    return null;
  }

  const currencySymbol = getCurrencySymbol(project.currency);
  const activeTaxRates = getActivePriceTaxRates(
    team.taxRates,
    team.organizationTaxSettings,
  );
  const sectionMap = new Map(sections.map((section) => [String(section._id), section]));
  const resolveSectionName = (item: ShoppingListItem) => {
    if (!item.sectionId) return 'No Section';
    return sectionMap.get(String(item.sectionId))?.name || 'No Section';
  };

  const availableCategories = Array.from(
    new Set(
      items
        .map((item) => item.category?.trim())
        .filter((value): value is string => !!value),
    ),
  ).sort((left, right) => left.localeCompare(right));

  const availableSections = Array.from(
    new Set([
      ...sections.map((section) => section.name),
      ...(items.some((item) => !item.sectionId) ? ['No Section'] : []),
    ]),
  );

  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredItems = items.filter((item) => {
    const sectionName = resolveSectionName(item);
    const setTitle = item.setId ? sets.find((set) => set._id === item.setId)?.title : undefined;
    const matchesSearch =
      normalizedSearchQuery.length === 0 ||
      [
        item.name,
        item.notes,
        item.supplier,
        item.category,
        item.catalogNumber,
        item.dimensions,
        item.productLink,
        item.customerDecisionComment,
        sectionName,
        setTitle,
      ]
        .filter((value): value is string => !!value)
        .some((value) => value.toLocaleLowerCase().includes(normalizedSearchQuery));

    const matchesStatus = statusFilter === 'all' || item.realizationStatus === statusFilter;
    const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
    const matchesSection = sectionFilter === 'all' || sectionName === sectionFilter;
    const matchesCategory = categoryFilter === 'all' || (item.category?.trim() || '') === categoryFilter;

    return matchesSearch && matchesStatus && matchesPriority && matchesSection && matchesCategory;
  });

  const visibleSectionEntries = (() => {
    const sectionOrder = new Map(sections.map((section) => [String(section._id), section.order]));
    const namesById = new Map(sections.map((section) => [String(section._id), section.name]));
    const sectionBuckets = new Map<string, { sectionId?: Id<"shoppingListSections">; name: string; items: ShoppingListItem[]; sets: ShoppingSet[] }>();

    const ensureBucket = (key: string, name: string, sectionId?: Id<"shoppingListSections">) => {
      if (!sectionBuckets.has(key)) {
        sectionBuckets.set(key, { sectionId, name, items: [], sets: [] });
      }
      return sectionBuckets.get(key)!;
    };

    for (const item of filteredItems) {
      const key = item.sectionId ? String(item.sectionId) : '__none__';
      const name = item.sectionId ? namesById.get(String(item.sectionId)) || 'No Section' : 'No Section';
      ensureBucket(key, name, item.sectionId ?? undefined).items.push(item);
    }

    for (const set of sets) {
      const setItems = filteredItems.filter((item) => String(item.setId ?? '') === String(set._id));
      if (setItems.length === 0) {
        continue;
      }
      const key = set.sectionId ? String(set.sectionId) : '__none__';
      const name = set.sectionId ? namesById.get(String(set.sectionId)) || 'No Section' : 'No Section';
      ensureBucket(key, name, set.sectionId ?? undefined).sets.push(set);
    }

    if (
      normalizedSearchQuery.length === 0 &&
      statusFilter === 'all' &&
      priorityFilter === 'all' &&
      sectionFilter === 'all' &&
      categoryFilter === 'all'
    ) {
      for (const section of sections) {
        ensureBucket(String(section._id), section.name, section._id);
      }
    }

    return Array.from(sectionBuckets.values()).sort((left, right) => {
      if (left.name === 'No Section') return 1;
      if (right.name === 'No Section') return -1;
      const leftOrder = left.sectionId ? sectionOrder.get(String(left.sectionId)) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
      const rightOrder = right.sectionId ? sectionOrder.get(String(right.sectionId)) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.name.localeCompare(right.name);
    });
  })();

  const grandTotal = calculateShoppingTotal(items, sets);
  const visibleGrandTotal = calculateShoppingTotal(filteredItems, sets);
  const formatTotalSummary = (value: number) =>
    `Total: ${formatMoney(value, currencySymbol)}`;
  const shoppingPdfPriceColumns = [{ key: 'totalNet', label: 'Total' }];
  const showFirstRunOnboarding = items.length === 0;
  const hasActiveFilters =
    normalizedSearchQuery.length > 0 ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    sectionFilter !== 'all' ||
    categoryFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setSectionFilter('all');
    setCategoryFilter('all');
  };

  const handleCreateSection = async (name: string) => {
    await createSection({ name, projectId: project._id });
  };

  const handleUpdateSection = async (sectionId: Id<"shoppingListSections">, name: string) => {
    await updateSection({ sectionId, name });
  };

  const handleDeleteSection = async (sectionId: Id<"shoppingListSections">) => {
    await deleteSection({ sectionId });
  };

  const handleOpenSectionSetup = () => {
    setIsSectionManagerOpen(true);
  };

  const handleOpenAddProduct = () => {
    setShowMainAddForm(true);
  };

  const handleDeleteSet = async (setId: Id<"shoppingSets">) => {
    await deleteSet({ setId });
    toast.success('Alternative group removed');
  };

  const handleEnableAlternativesForItem = async (
    itemId: Id<"shoppingListItems">,
    itemName: string,
    sectionId?: Id<"shoppingListSections">,
  ) => {
    const setId = await createSet({
      projectId: project._id,
      title: itemName.trim(),
      sectionId,
      setType: 'variant',
      selectionMode: 'single',
      pricingMode: 'selected_only',
      status: 'active',
    });

    await updateItem({
      itemId,
      setId,
    });

    await updateSet({
      setId,
      preferredItemIds: [itemId],
      resolvedItemIds: [],
      status: 'active',
    });

    toast.success('Alternative group created');
    return setId;
  };

  const handleAddItem = async (itemData: {
    name: string;
    notes?: string;
    supplier?: string;
    category?: string;
    sectionId?: Id<"shoppingListSections">;
    setId?: Id<"shoppingSets">;
    catalogNumber?: string;
    dimensions?: string;
    quantity: number;
    unitPrice?: number;
    priceTaxMode?: ShoppingListItem["priceTaxMode"];
    taxRateId?: string | null;
    taxRateSnapshot?: ShoppingListItem["taxRateSnapshot"];
    productLink?: string;
    imageUrl?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    realizationStatus?: string;
    assignedTo?: string;
    buyBefore?: number;
  }) => {
    const { realizationStatus, ...rest } = itemData;
    const itemId = await createItem({
      projectId: project._id,
      ...rest,
      realizationStatus: (realizationStatus as ShoppingListItem["realizationStatus"]) || 'PLANNED',
    });
    toast.success('Product added');
    return itemId;
  };

  const handleUpdateItem = async (itemId: Id<"shoppingListItems">, updates: Partial<ShoppingListItem>) => {
    await updateItem({ itemId, ...updates });

    const currentItem = items.find((item) => item._id === itemId);
    if (!currentItem?.setId) {
      return;
    }

    const currentSet = sets.find((set) => set._id === currentItem.setId);
    if (!currentSet) {
      return;
    }

    const primaryItemId =
      currentSet.preferredItemIds?.[0] ??
      currentSet.resolvedItemIds?.[0] ??
      currentItem._id;

    const nextSetUpdates: Partial<ShoppingSet> = {};
    if (updates.name !== undefined && String(primaryItemId) === String(itemId)) {
      nextSetUpdates.title = updates.name.trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'sectionId')) {
      nextSetUpdates.sectionId = updates.sectionId ?? null;
    }

    if (Object.keys(nextSetUpdates).length > 0) {
      await updateSet({
        setId: currentSet._id,
        ...nextSetUpdates,
      });
    }
  };

  const handleDeleteItem = async (itemId: Id<"shoppingListItems">) => {
    await deleteItem({ itemId });
    toast.success('Item deleted');
  };

  const handleUpdateSet = async (setId: Id<"shoppingSets">, updates: Partial<ShoppingSet>) => {
    await updateSet({ setId, ...updates });
  };

  const exportSourceItems = exportOptions.scope === 'currentView' ? filteredItems : items;
  const exportSetIds = new Set(
    exportSourceItems.map((item) => item.setId).filter((value): value is Id<"shoppingSets"> => !!value),
  );
  const exportSets = sets.filter((set) => exportSetIds.has(set._id));
  const exportContext = buildShoppingSetContext(exportSourceItems, exportSets);
  const filteredItemsForExport = exportSourceItems.filter((item) =>
    isItemCountedInShoppingTotal(item, exportContext),
  );
  const exportSetTitleById = new Map(exportSets.map((set) => [String(set._id), set.title]));

  const groupedFilteredItems = Object.entries(
    filteredItemsForExport.reduce((acc, item) => {
      const sectionName = resolveSectionName(item);
      if (!acc[sectionName]) {
        acc[sectionName] = [];
      }
      acc[sectionName].push(item);
      return acc;
    }, {} as Record<string, ShoppingListItem[]>),
  ).map(([sectionName, sectionItems]) => ({ sectionName, sectionItems }));

  const shoppingExportSections = groupedFilteredItems.map(({ sectionName, sectionItems }) => ({
    sectionName,
    rows: sectionItems.map((item): ShoppingExportRow => ({
        sectionName,
        product: formatShoppingExportProductLabel(
          item.name,
          item.setId ? exportSetTitleById.get(String(item.setId)) : undefined,
        ),
        qty: String(item.quantity),
        unitNet: formatMoney(item.unitPrice, currencySymbol),
        unitTax: formatMoney(0, currencySymbol),
        unitGross: formatMoney(item.unitPrice, currencySymbol),
        totalNet: formatMoney(item.totalPrice, currencySymbol),
        totalTax: formatMoney(0, currencySymbol),
        totalGross: formatMoney(item.totalPrice, currencySymbol),
        status: getStatusLabel(item.realizationStatus),
        supplier: item.supplier || '-',
        notes: item.notes || '-',
      })),
  }));
  const flatShoppingExportRows = shoppingExportSections.flatMap((section) => section.rows);
  const groupedShoppingColumnOptions: ShoppingExportColumnOptions = {
    includeNotes: exportOptions.includeNotes,
    includeStatus: exportOptions.includeStatus,
    includeSupplier: exportOptions.includeSupplier,
  };
  const flatShoppingColumnOptions: ShoppingExportColumnOptions = {
    ...groupedShoppingColumnOptions,
    includeSection: true,
  };

  const buildShoppingPdfColumns = (includeSection: boolean) => [
    ...(includeSection ? [{ key: 'sectionName', label: 'Section' }] : []),
    { key: 'product', label: 'Product' },
    { key: 'qty', label: 'Qty' },
    ...shoppingPdfPriceColumns,
    ...(exportOptions.includeStatus ? [{ key: 'status', label: 'Status' }] : []),
    ...(exportOptions.includeSupplier ? [{ key: 'supplier', label: 'Supplier' }] : []),
    ...(exportOptions.includeNotes ? [{ key: 'notes', label: 'Notes' }] : []),
  ];

  const handleExportCSV = () => {
    if (filteredItemsForExport.length === 0) {
      toast.info('No items match the current export filters.');
      return;
    }

    downloadCsvFile({
      fileName: `shopping-list-${sanitizeFileName(project.name)}-${format(new Date(), 'yyyy-MM-dd')}.csv`,
      headers: getShoppingExportHeaders(flatShoppingColumnOptions),
      rows: flatShoppingExportRows.map((row) =>
        getShoppingExportCsvRow(row, flatShoppingColumnOptions),
      ),
    });
    setIsExportModalOpen(false);
    toast.success('CSV exported successfully!');
  };

  const handleExportPDF = async () => {
    if (filteredItemsForExport.length === 0) {
      toast.info('No items match the current export filters.');
      return;
    }

    await exportSectionedTablePdf({
      brand: {
        teamName: team.name || 'Organization',
        teamImageUrl: team.imageUrl,
      },
      columns: buildShoppingPdfColumns(!exportOptions.groupBySections),
      fileName: `shopping-list-${sanitizeFileName(project.name)}-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
      generatedOn: format(new Date(), 'yyyy-MM-dd HH:mm'),
      groupBySections: exportOptions.groupBySections,
      sections: shoppingExportSections.map((section) => ({
        sectionName: section.sectionName,
        rows: section.rows.map((row) => ({
          ...(exportOptions.groupBySections ? {} : { sectionName: row.sectionName }),
          product: row.product,
          qty: row.qty,
          totalNet: row.totalNet,
          totalTax: row.totalTax,
          totalGross: row.totalGross,
          ...(exportOptions.includeStatus ? { status: row.status } : {}),
          ...(exportOptions.includeSupplier ? { supplier: row.supplier } : {}),
          ...(exportOptions.includeNotes ? { notes: row.notes } : {}),
        })),
      })),
      subtitle: `Items: ${filteredItemsForExport.length} | ${formatTotalSummary(
        calculateShoppingTotal(filteredItemsForExport, exportSets),
      )}`,
      title: `Shopping List - ${project.name}`,
    });
    setIsExportModalOpen(false);
    toast.success('PDF exported successfully!');
  };

  const handleExportXlsx = async () => {
    if (filteredItemsForExport.length === 0) {
      toast.info('No items match the current export filters.');
      return;
    }

    const fileDate = format(new Date(), 'yyyy-MM-dd');
    const generatedOn = format(new Date(), 'yyyy-MM-dd HH:mm');
    const subtitle = `Items: ${filteredItemsForExport.length} | ${formatTotalSummary(
      calculateShoppingTotal(filteredItemsForExport, exportSets),
    )}`;

    await exportWorkbookTables({
      fileName: `shopping-list-${sanitizeFileName(project.name)}-${fileDate}.xlsx`,
      sheets: [
        {
          generatedOn,
          name: 'Shopping List',
          subtitle,
          tables: exportOptions.groupBySections
            ? shoppingExportSections.map((section, index) => ({
                accentColor: getSectionAccentColor(index),
                headers: getShoppingExportHeaders(groupedShoppingColumnOptions),
                rows: section.rows.map((row) =>
                  getShoppingExportCsvRow(row, groupedShoppingColumnOptions),
                ),
                title: section.sectionName,
              }))
            : [
                {
                  headers: getShoppingExportHeaders(flatShoppingColumnOptions),
                  rows: flatShoppingExportRows.map((row) =>
                    getShoppingExportCsvRow(row, flatShoppingColumnOptions),
                  ),
                  title: 'Items',
                },
              ],
          title: `Shopping List - ${project.name}`,
        },
      ],
    });
    setIsExportModalOpen(false);
    toast.success('Excel exported successfully!');
  };

  return (
    <TooltipProvider>
      <ProjectPageLayout>
        <div className="text-sm">
          <ShoppingListHeader
            projectName={project.name}
            grandTotalLabel={`Total: ${formatCurrency(grandTotal, project.currency)}`}
            onExportClick={() => setIsExportModalOpen(true)}
            onAddProductClick={() => setShowMainAddForm((current) => !current)}
          />

          {showMainAddForm ? (
            <div className="vibe-panel mb-8 p-6">
              <AddItemForm
                projectId={project._id}
                teamId={project.teamId}
                sections={sections}
                teamMembers={teamMembers}
                taxRates={activeTaxRates}
                currencySymbol={currencySymbol}
                onAddItem={handleAddItem}
                onEnableAlternatives={handleEnableAlternativesForItem}
                isPending={isPending}
              />
            </div>
          ) : null}

          {showFirstRunOnboarding ? (
            <ShoppingListOnboarding
              projectName={project.name}
              sectionsCount={sections.length}
              extensionReady={extensionReady}
              itemsCount={items.length}
              onCreateSectionClick={handleOpenSectionSetup}
              onAddProductClick={handleOpenAddProduct}
            />
          ) : null}

          <div className="mb-8">
            <SectionManager
              sections={sections}
              onCreateSection={handleCreateSection}
              onUpdateSection={handleUpdateSection}
              onDeleteSection={handleDeleteSection}
              isPending={isPending}
              expanded={isSectionManagerOpen}
              onExpandedChange={setIsSectionManagerOpen}
            />
          </div>

          <div className="vibe-panel sticky top-16 z-10 mb-8 p-4 backdrop-blur-xl xl:top-0">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
                  <Badge variant="outline" className="h-11 rounded-full border-border/70 bg-white px-4 text-[12px] font-semibold text-foreground">
                    {formatItemCountLabel(filteredItems.length)}
                  </Badge>

                  <Select value={sectionFilter} onValueChange={setSectionFilter}>
                    <SelectTrigger className="h-11 w-full rounded-full border-border/70 bg-white px-5 shadow-none sm:w-fit sm:min-w-[210px]">
                      <SelectValue placeholder="Section" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sections</SelectItem>
                      {availableSections.map((section) => (
                        <SelectItem key={section} value={section}>
                          {getSectionOptionLabel(section)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-11 w-full rounded-full border-border/70 bg-white px-5 shadow-none sm:w-fit sm:min-w-[210px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {availableCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                    <SelectTrigger className="h-11 w-full rounded-full border-border/70 bg-white px-5 shadow-none sm:w-fit sm:min-w-[210px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {Object.keys(STATUS_LABELS).map((value) => (
                        <SelectItem key={value} value={value}>
                          {getToolbarStatusLabel(value as ShoppingListItem["realizationStatus"])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
                  {hasActiveFilters ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetFilters}
                      className="h-11 rounded-full border border-border/70 px-4"
                    >
                      <XIcon className="mr-2 h-4 w-4" />
                      Clear filters
                    </Button>
                  ) : null}

                  <div className="min-w-0 rounded-2xl border border-border/60 bg-white px-4 py-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Total
                    </div>
                    <div className="mt-1 text-[1.35rem] font-semibold leading-none text-foreground sm:text-[1.6rem]">
                      {formatCurrency(visibleGrandTotal, project.currency)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <InputGroup className="h-11 min-w-0 flex-1 rounded-full border-border/70 bg-white shadow-none">
                  <InputGroupAddon align="inline-start" className="pointer-events-none pl-4 text-muted-foreground">
                    <SearchIcon className="h-4 w-4" />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search products, supplier, notes, or SKU"
                    className="h-11 rounded-full pr-4"
                  />
                </InputGroup>

                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as typeof priorityFilter)}>
                    <SelectTrigger className="h-10 w-full rounded-full border-border/70 bg-white px-4 shadow-none sm:w-fit sm:min-w-[190px]">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All priorities</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>

                  {searchQuery ? (
                    <Badge variant="outline" className="rounded-full border-border/60 px-3 py-1.5">
                      Search: {searchQuery}
                    </Badge>
                  ) : null}

                  {sectionFilter !== 'all' ? (
                    <Badge variant="outline" className="rounded-full border-border/60 px-3 py-1.5">
                      Section: {getSectionOptionLabel(sectionFilter)}
                    </Badge>
                  ) : null}

                  {categoryFilter !== 'all' ? (
                    <Badge variant="outline" className="rounded-full border-border/60 px-3 py-1.5">
                      Category: {categoryFilter}
                    </Badge>
                  ) : null}

                  {statusFilter !== 'all' ? (
                    <Badge variant="outline" className="rounded-full border-border/60 px-3 py-1.5">
                      Status: {getToolbarStatusLabel(statusFilter)}
                    </Badge>
                  ) : null}

                  {priorityFilter !== 'all' ? (
                    <Badge variant="outline" className="rounded-full border-border/60 px-3 py-1.5">
                      Priority: {priorityFilter === 'low' ? 'Low' : priorityFilter === 'medium' ? 'Medium' : priorityFilter === 'high' ? 'High' : 'Urgent'}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {visibleSectionEntries.length === 0 ? (
            <div className="vibe-panel border-dashed px-8 py-14 text-center">
              <h3 className="text-lg font-semibold text-foreground">No items match the current view</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Adjust your filters or clear the current search to bring products back into view.
              </p>
              {hasActiveFilters ? (
                <div className="mt-5">
                  <Button variant="outline" onClick={resetFilters} className="rounded-full border-border/70 bg-white">
                    <XIcon className="mr-2 h-4 w-4" />
                    Reset filters
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {visibleSectionEntries.map((entry) => (
            <ShoppingListSection
              key={entry.sectionId || entry.name}
              projectId={project._id}
              teamId={project.teamId}
              sectionName={entry.name}
              sectionId={entry.sectionId}
              items={entry.items}
              sets={entry.sets}
              allSets={sets}
              currencySymbol={currencySymbol}
              teamMembers={teamMembers}
              sections={sections}
              taxRates={activeTaxRates}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onAddItem={handleAddItem}
              onCreateAlternativesForItem={handleEnableAlternativesForItem}
              onUpdateSet={handleUpdateSet}
              onDeleteSet={handleDeleteSet}
              isPending={isPending}
            />
          ))}

          <ExportModal
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            exportOptions={exportOptions}
            onExportOptionsChange={setExportOptions}
            onExport={async () => {
              setIsExporting(true);
              try {
                if (exportOptions.format === 'csv') {
                  handleExportCSV();
                } else if (exportOptions.format === 'xlsx') {
                  await handleExportXlsx();
                } else {
                  await handleExportPDF();
                }
              } finally {
                setIsExporting(false);
              }
            }}
            isPending={isExporting}
          />
        </div>
      </ProjectPageLayout>
    </TooltipProvider>
  );
}
