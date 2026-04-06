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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchIcon, XIcon } from 'lucide-react';
import { apiAny } from '@/lib/convexApiAny';
import type { TeamMember } from '@/lib/teamMember';
import { calculateShoppingTotal, buildShoppingSetContext, isItemCountedInShoppingTotal } from '@/lib/shoppingSets';
import {
  addBrandHeader,
  addDocumentMeta,
  addPageNumbers,
  ensurePdfUnicodeFont,
  formatMoney,
  pdfTableTheme,
  sanitizeFileName,
} from '@/lib/pdfExport';

import { AddItemForm } from './AddItemForm';
import { ExportModal } from './ExportModal';
import { SectionManager } from './SectionManager';
import { ShoppingListHeader } from './ShoppingListHeader';
import { ShoppingListSection } from './ShoppingListSection';
import { ShoppingSetManager } from './ShoppingSetManager';

type ShoppingListItem = Doc<"shoppingListItems">;
type ShoppingSet = Doc<"shoppingSets">;

const STATUS_FILTER_TO_VALUE: Record<'planned' | 'ordered' | 'completed', ShoppingListItem["realizationStatus"]> = {
  planned: 'PLANNED',
  ordered: 'ORDERED',
  completed: 'COMPLETED',
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

export function ShoppingListViewSkeleton() {
  return <Spinner className="p-4 sm:p-6" />;
}

export default function ShoppingListView() {
  const [isPending] = useTransition();
  const [showMainAddForm, setShowMainAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ShoppingListItem["realizationStatus"]>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | NonNullable<ShoppingListItem["priority"]>>('all');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    format: 'csv' as 'csv' | 'pdf',
    includeImages: false,
    statusFilter: 'all' as 'all' | 'planned' | 'ordered' | 'completed',
    includeNotes: true,
    groupBySections: true,
  });

  const { project } = useProject();

  const items = useQuery(apiAny.shopping.listShoppingListItems, { projectId: project._id }) as ShoppingListItem[] | undefined;
  const sections = useQuery(apiAny.shopping.listShoppingListSections, { projectId: project._id }) as Doc<"shoppingListSections">[] | undefined;
  const sets = useQuery(apiAny.shopping.listShoppingSets, { projectId: project._id }) as ShoppingSet[] | undefined;
  const teamMembers = useQuery(apiAny.teams.getTeamMembers, { teamId: project.teamId }) as TeamMember[] | undefined;
  const team = useQuery(apiAny.teams.getTeamById, { teamId: project.teamId }) as Doc<"teams"> | undefined;

  const createItem = useMutation(apiAny.shopping.createShoppingListItem);
  const updateItem = useMutation(apiAny.shopping.updateShoppingListItem);
  const deleteItem = useMutation(apiAny.shopping.deleteShoppingListItem);
  const createSection = useMutation(apiAny.shopping.createShoppingListSection);
  const deleteSection = useMutation(apiAny.shopping.deleteShoppingListSection);
  const createSet = useMutation(apiAny.shopping.createShoppingSet);
  const updateSet = useMutation(apiAny.shopping.updateShoppingSet);
  const deleteSet = useMutation(apiAny.shopping.deleteShoppingSet);

  if (items === undefined || sections === undefined || sets === undefined || team === undefined) {
    return null;
  }

  const currencySymbol = project.currency === "EUR" ? "€" : project.currency === "PLN" ? "zł" : "$";
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

  const handleDeleteSection = async (sectionId: Id<"shoppingListSections">) => {
    await deleteSection({ sectionId });
  };

  const handleCreateSet = async (input: {
    title: string;
    sectionId?: Id<"shoppingListSections">;
    setType: "variant" | "bundle" | "reference";
    selectionMode: "single" | "multiple" | "none";
    pricingMode: "selected_only" | "all_selected" | "none";
  }) => {
    await createSet({
      projectId: project._id,
      title: input.title,
      sectionId: input.sectionId,
      setType: input.setType,
      selectionMode: input.selectionMode,
      pricingMode: input.pricingMode,
      status: 'active',
    });
    toast.success('Set created');
  };

  const handleDeleteSet = async (setId: Id<"shoppingSets">) => {
    await deleteSet({ setId });
    toast.success('Set deleted');
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
    productLink?: string;
    imageUrl?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    realizationStatus?: string;
    assignedTo?: string;
    buyBefore?: number;
  }) => {
    const { realizationStatus, ...rest } = itemData;
    await createItem({
      projectId: project._id,
      ...rest,
      realizationStatus: (realizationStatus as ShoppingListItem["realizationStatus"]) || 'PLANNED',
    });
    toast.success('Product added');
  };

  const handleUpdateItem = async (itemId: Id<"shoppingListItems">, updates: Partial<ShoppingListItem>) => {
    await updateItem({ itemId, ...updates });
  };

  const handleDeleteItem = async (itemId: Id<"shoppingListItems">) => {
    await deleteItem({ itemId });
    toast.success('Item deleted');
  };

  const handleUpdateSet = async (setId: Id<"shoppingSets">, updates: Partial<ShoppingSet>) => {
    await updateSet({ setId, ...updates });
  };

  const statusFilteredItemsForExport = items.filter((item) => {
    if (exportOptions.statusFilter === 'all') {
      return true;
    }
    return item.realizationStatus === STATUS_FILTER_TO_VALUE[exportOptions.statusFilter];
  });
  const exportSetIds = new Set(
    statusFilteredItemsForExport.map((item) => item.setId).filter((value): value is Id<"shoppingSets"> => !!value),
  );
  const exportSets = sets.filter((set) => exportSetIds.has(set._id));
  const exportContext = buildShoppingSetContext(statusFilteredItemsForExport, exportSets);
  const filteredItemsForExport = statusFilteredItemsForExport.filter((item) =>
    isItemCountedInShoppingTotal(item, exportContext),
  );

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

  const handleExportCSV = () => {
    if (filteredItemsForExport.length === 0) {
      toast.info('No items match the current export filters.');
      return;
    }

    const rows = filteredItemsForExport.map((item) => {
      const setTitle = item.setId ? sets.find((set) => set._id === item.setId)?.title || '' : '';
      return [
        resolveSectionName(item),
        setTitle,
        item.name,
        item.supplier || '',
        item.category || '',
        item.catalogNumber || '',
        item.dimensions || '',
        item.quantity,
        item.unitPrice ? `${item.unitPrice.toFixed(2)} ${currencySymbol}` : '',
        item.totalPrice ? `${item.totalPrice.toFixed(2)} ${currencySymbol}` : '',
        getStatusLabel(item.realizationStatus),
        item.priority || '',
        item.buyBefore ? format(new Date(item.buyBefore), 'yyyy-MM-dd') : '',
        ...(exportOptions.includeNotes ? [item.notes || ''] : []),
      ];
    });

    const headers = [
      'Section',
      'Set',
      'Product Name',
      'Supplier',
      'Category',
      'Catalog Number',
      'Dimensions',
      'Quantity',
      'Unit Price',
      'Total Price',
      'Status',
      'Priority',
      'Buy Before',
      ...(exportOptions.includeNotes ? ['Notes'] : []),
    ];

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `shopping-list-${sanitizeFileName(project.name)}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsExportModalOpen(false);
  };

  const handleExportPDF = async () => {
    if (filteredItemsForExport.length === 0) {
      toast.info('No items match the current export filters.');
      return;
    }

    const jsPdfModule = await import('jspdf');
    const jsPDF = jsPdfModule.jsPDF ?? jsPdfModule.default;
    await import('jspdf-autotable');

    const doc = new jsPDF({
      putOnlyUsedFonts: true,
      format: 'a4',
      unit: 'mm',
    });

    let pdfFontFamily = 'helvetica';
    try {
      pdfFontFamily = await ensurePdfUnicodeFont(doc);
    } catch (error) {
      console.warn('Unicode PDF font unavailable, using helvetica', error);
    }
    doc.setFont(pdfFontFamily, 'normal');

    let yPosition = await addBrandHeader(doc, {
      teamName: team.name || 'Organization',
      teamImageUrl: team.imageUrl,
      fontFamily: pdfFontFamily,
    });

    yPosition = addDocumentMeta(doc, {
      title: `Shopping List - ${project.name}`,
      subtitle: `Items: ${filteredItemsForExport.length} | Total: ${formatMoney(calculateShoppingTotal(filteredItemsForExport, exportSets), currencySymbol)}`,
      generatedOn: format(new Date(), 'yyyy-MM-dd HH:mm'),
      startY: yPosition,
      fontFamily: pdfFontFamily,
    });

    const buildRows = (sectionItems: ShoppingListItem[]) =>
      sectionItems.map((item) => [
        item.setId ? sets.find((set) => set._id === item.setId)?.title || '-' : '-',
        item.name,
        String(item.quantity),
        formatMoney(item.totalPrice, currencySymbol),
        getStatusLabel(item.realizationStatus),
        item.supplier || '-',
        ...(exportOptions.includeNotes ? [item.notes || '-'] : []),
      ]);

    const head = [[
      'Set',
      'Product',
      'Qty',
      'Total',
      'Status',
      'Supplier',
      ...(exportOptions.includeNotes ? ['Notes'] : []),
    ]];

    if (exportOptions.groupBySections) {
      for (const { sectionName, sectionItems } of groupedFilteredItems) {
        doc.setFont(pdfFontFamily, 'bold');
        doc.setFontSize(12);
        doc.text(sectionName, 18, yPosition);
        yPosition += 4;
        doc.autoTable({
          ...pdfTableTheme,
          startY: yPosition,
          head,
          body: buildRows(sectionItems),
          styles: {
            ...pdfTableTheme.styles,
            font: pdfFontFamily,
          },
          headStyles: {
            ...pdfTableTheme.headStyles,
            font: pdfFontFamily,
          },
        });
        yPosition = ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || yPosition) + 8;
      }
    } else {
      doc.autoTable({
        ...pdfTableTheme,
        startY: yPosition,
        head,
        body: buildRows(filteredItemsForExport),
        styles: {
          ...pdfTableTheme.styles,
          font: pdfFontFamily,
        },
        headStyles: {
          ...pdfTableTheme.headStyles,
          font: pdfFontFamily,
        },
      });
    }

    addPageNumbers(doc, pdfFontFamily);
    doc.save(`shopping-list-${sanitizeFileName(project.name)}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    setIsExportModalOpen(false);
  };

  return (
    <TooltipProvider>
      <ProjectPageLayout>
        <ShoppingListHeader
          projectName={project.name}
          grandTotal={grandTotal}
          currencySymbol={currencySymbol}
          onExportClick={() => setIsExportModalOpen(true)}
          onAddProductClick={() => setShowMainAddForm((current) => !current)}
        />

        {showMainAddForm ? (
          <div className="mb-8 rounded-3xl border bg-card p-6 shadow-sm">
            <AddItemForm
              sections={sections}
              sets={sets}
              teamMembers={teamMembers}
              currencySymbol={currencySymbol}
              onAddItem={handleAddItem}
              isPending={isPending}
            />
          </div>
        ) : null}

        <div className="mb-8 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <SectionManager
            sections={sections}
            onCreateSection={handleCreateSection}
            onDeleteSection={handleDeleteSection}
            isPending={isPending}
          />
          <ShoppingSetManager
            sets={sets}
            sections={sections}
            onCreateSet={handleCreateSet}
            onDeleteSet={handleDeleteSet}
            isPending={isPending}
          />
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Visible total: {visibleGrandTotal.toFixed(2)} {currencySymbol}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search items, sets, suppliers..."
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as typeof priorityFilter)}>
                <SelectTrigger>
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
              <Select value={sectionFilter} onValueChange={setSectionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sections</SelectItem>
                  {availableSections.map((section) => (
                    <SelectItem key={section} value={section}>
                      {section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
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
            </div>

            {(searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' || sectionFilter !== 'all' || categoryFilter !== 'all') ? (
              <div className="mt-4 flex items-center gap-3">
                <Badge variant="secondary">
                  {filteredItems.length} visible item{filteredItems.length === 1 ? '' : 's'}
                </Badge>
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  <XIcon className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {visibleSectionEntries.map((entry) => (
          <ShoppingListSection
            key={entry.sectionId || entry.name}
            sectionName={entry.name}
            sectionId={entry.sectionId}
            items={entry.items}
            sets={entry.sets}
            allSets={sets}
            currencySymbol={currencySymbol}
            teamMembers={teamMembers}
            sections={sections}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            onAddItem={handleAddItem}
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
            if (exportOptions.format === 'csv') {
              handleExportCSV();
              return;
            }
            await handleExportPDF();
          }}
          isPending={false}
        />
      </ProjectPageLayout>
    </TooltipProvider>
  );
}
