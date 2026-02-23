'use client';

import { useState, useTransition } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { apiAny } from '@/lib/convexApiAny';
import { Doc, Id } from '@/convex/_generated/dataModel';
import type { TeamMember } from '@/lib/teamMember';
import { useProject } from '@/components/providers/ProjectProvider';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { format } from 'date-fns';
import { TooltipProvider } from '@/components/ui/tooltip';
import { addBrandHeader, addDocumentMeta, addPageNumbers, ensurePdfUnicodeFont, formatMoney, pdfTableTheme, resolvePageBreak, sanitizeFileName } from '@/lib/pdfExport';
import { buildAlternativeSelection, calculateShoppingTotal, isItemCountedInShoppingTotal } from '@/lib/shoppingAlternatives';

// Import new components
import { SectionManager } from './SectionManager';
import { AddItemForm } from './AddItemForm';
import { ShoppingListSection } from './ShoppingListSection';
import { ExportModal } from './ExportModal';
import { ProjectPageLayout } from '@/components/project/ProjectPageLayout';
import { ProjectPageHeader } from '@/components/project/ProjectPageHeader';
import { ShoppingCart, PlusIcon, DownloadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ShoppingListItem = Doc<"shoppingListItems"> & {
  alternativeToItemId?: Id<"shoppingListItems"> | null;
  selectedAlternativeItemId?: Id<"shoppingListItems"> | null;
};

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

const PDF_BODY_NOTE_MAX_LENGTH = 180;

const collapseSpacedCharacters = (value: string): string =>
  value.replace(/(?:\b[\p{L}\p{N}]\s+){3,}[\p{L}\p{N}]\b/gu, (match) => match.replace(/\s+/g, ''));

const normalizePdfText = (value: string | undefined | null, fallback = '-'): string => {
  if (!value) {
    return fallback;
  }

  const compact = collapseSpacedCharacters(value.replace(/\u00A0/g, ' ')).replace(/\s+/g, ' ').trim();
  return compact || fallback;
};

const truncatePdfText = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
};

const formatQuantity = (quantity: number): string =>
  Number.isInteger(quantity) ? `${quantity}` : quantity.toFixed(2);


export function ShoppingListViewSkeleton() {
  return <Spinner className="p-4 sm:p-6" />;
}

export default function ShoppingListView() {
  const [isPending] = useTransition();
  const [showMainAddForm, setShowMainAddForm] = useState(false);

  const { project } = useProject();

  const items = useQuery(apiAny.shopping.listShoppingListItems, { projectId: project._id }) as ShoppingListItem[] | undefined;
  const sections = useQuery(apiAny.shopping.listShoppingListSections, { projectId: project._id }) as Doc<"shoppingListSections">[] | undefined;
  const teamMembers = useQuery(apiAny.teams.getTeamMembers, { teamId: project.teamId }) as TeamMember[] | undefined;
  const team = useQuery(apiAny.teams.getTeamById, { teamId: project.teamId }) as Doc<"teams"> | undefined;

  const createItem = useMutation(apiAny.shopping.createShoppingListItem);
  const updateItem = useMutation(apiAny.shopping.updateShoppingListItem);
  const deleteItem = useMutation(apiAny.shopping.deleteShoppingListItem);
  const createSection = useMutation(apiAny.shopping.createShoppingListSection);
  const deleteSection = useMutation(apiAny.shopping.deleteShoppingListSection);


  // Export state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    format: 'csv' as 'csv' | 'pdf',
    includeImages: false,
    statusFilter: 'all' as 'all' | 'planned' | 'ordered' | 'completed',
    includeNotes: true,
    groupBySections: true
  });

  if (items === undefined || sections === undefined || team === undefined) {
    return null;
  }

  if (project === null) {
    return <div>Project not found</div>
  }

  const currencySymbol = project.currency === "EUR" ? "€" : project.currency === "PLN" ? "zł" : "$";

  // Group items by section
  const sectionMap = new Map(sections.map(s => [s._id, s.name]));
  const itemsBySection = items.reduce((acc, item) => {
    const sectionName = item.sectionId ? sectionMap.get(item.sectionId) || 'No Category' : 'No Category';
    if (!acc[sectionName]) acc[sectionName] = [];
    acc[sectionName].push(item);
    return acc;
  }, {} as Record<string, ShoppingListItem[]>);

  sections.forEach(section => {
    if (!itemsBySection[section.name]) {
      itemsBySection[section.name] = [];
    }
  });

  const hasItemsWithoutSection = items.some(item => !item.sectionId);
  if (!hasItemsWithoutSection && itemsBySection['No Category']) {
    delete itemsBySection['No Category'];
  }

  const sectionTotals = Object.entries(itemsBySection).map(([section, sectionItems]) => {
    const total = calculateShoppingTotal(sectionItems);
    return { section, total, itemCount: sectionItems.length };
  });

  const grandTotal = calculateShoppingTotal(items);

  // Handlers
  const handleCreateSection = async (name: string) => {
    await createSection({ name, projectId: project._id });
  };

  const handleDeleteSection = async (sectionId: Id<"shoppingListSections">) => {
    const section = sections.find(s => s._id === sectionId);
    if (!section) return;

    const hasItems = items.some(item => item.sectionId === sectionId);
    if (hasItems) {
      if (!confirm(`Section "${section.name}" contains products. Are you sure you want to delete it? Products will be moved to "No Category".`)) {
        return;
      }
    }

    await deleteSection({ sectionId });
  };

  const handleAddItem = async (itemData: {
    name: string;
    notes?: string;
    supplier?: string;
    category?: string;
    sectionId?: Id<"shoppingListSections">;
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
      realizationStatus: (realizationStatus as "PLANNED" | "ORDERED" | "IN_TRANSIT" | "DELIVERED" | "COMPLETED" | "CANCELLED") || "PLANNED"
    });
    toast.success("Product added");
  };

  const handleUpdateItem = async (id: Id<"shoppingListItems">, updates: Partial<ShoppingListItem>) => {
    try {
      await updateItem({ itemId: id, ...updates });
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error("Error updating item");
    }
  };

  const handleDeleteItem = async (id: Id<"shoppingListItems">) => {
    try {
      await deleteItem({ itemId: id });
      toast.success("Item deleted");
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error("Error deleting item");
    }
  };

  // Export handlers
  const statusFilteredItemsForExport = items.filter((item) => {
    if (exportOptions.statusFilter === 'all') {
      return true;
    }
    return item.realizationStatus === STATUS_FILTER_TO_VALUE[exportOptions.statusFilter];
  });

  const exportSelection = buildAlternativeSelection(statusFilteredItemsForExport);
  const filteredItemsForExport = statusFilteredItemsForExport.filter((item) =>
    isItemCountedInShoppingTotal(item, exportSelection),
  );

  const groupedFilteredItems = Object.entries(
    filteredItemsForExport.reduce((acc, item) => {
      const sectionName = item.sectionId ? sectionMap.get(item.sectionId) || 'No Category' : 'No Category';
      if (!acc[sectionName]) {
        acc[sectionName] = [];
      }
      acc[sectionName].push(item);
      return acc;
    }, {} as Record<string, ShoppingListItem[]>),
  )
    .sort(([a], [b]) => {
      if (a === 'No Category') return 1;
      if (b === 'No Category') return -1;
      return a.localeCompare(b);
    })
    .map(([sectionName, sectionItems]) => ({ sectionName, sectionItems }));

  const handleExportCSV = () => {
    if (filteredItemsForExport.length === 0) {
      toast.info('No items match the current export filters.');
      return;
    }

    const csvHeaders = [
      'Section',
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
      'Assigned To',
      'Buy Before',
      ...(exportOptions.includeNotes ? ['Notes'] : [])
    ];

    const csvData = filteredItemsForExport.map(item => {
      const sectionName = item.sectionId ? sectionMap.get(item.sectionId) || 'No Category' : 'No Category';
      const assignedMember = item.assignedTo ? teamMembers?.find(m => m.clerkUserId === item.assignedTo)?.name : '';

      return [
        sectionName,
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
        assignedMember || '',
        item.buyBefore ? format(new Date(item.buyBefore), 'yyyy-MM-dd') : '',
        ...(exportOptions.includeNotes ? [item.notes || ''] : [])
      ];
    });

    const csvContent = [csvHeaders, ...csvData]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `shopping-list-${sanitizeFileName(project.name)}-${format(new Date(), 'yyyy-MM-dd')}.csv`,
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    setIsExportModalOpen(false);
    toast.success('CSV exported with UTF-8 encoding');
  };

  const handleExportPDF = async () => {
    try {
      if (filteredItemsForExport.length === 0) {
        toast.info('No items match the current export filters.');
        return;
      }

      const jsPDF = (await import('jspdf')).default;
      await import('jspdf-autotable');

      const doc = new jsPDF({
        putOnlyUsedFonts: true,
        format: 'a4',
        unit: 'mm'
      });

      let pdfFontFamily = 'helvetica';
      try {
        pdfFontFamily = await ensurePdfUnicodeFont(doc);
      } catch (fontError) {
        console.warn('Could not load Unicode PDF font, falling back to Helvetica:', fontError);
      }
      doc.setFont(pdfFontFamily, 'normal');
      const pageWidth = doc.internal.pageSize.getWidth();
      const filteredTotal = calculateShoppingTotal(filteredItemsForExport);
      const printableWidth = pageWidth - 36;
      const hasAnyUnit = filteredItemsForExport.some((item) => !!item.unit?.trim());
      const hasAnyPrice = filteredItemsForExport.some((item) => item.totalPrice !== undefined && item.totalPrice !== null);
      const hasAnySupplier = filteredItemsForExport.some((item) => !!item.supplier?.trim());
      const hasAnyAssigned = filteredItemsForExport.some((item) => !!item.assignedTo);
      const hasAnyNonPlannedStatus = filteredItemsForExport.some((item) => item.realizationStatus !== 'PLANNED');

      type PdfColumnKey = 'section' | 'product' | 'qty' | 'unit' | 'total' | 'status' | 'supplier' | 'assigned';

      const columnLabels: Record<PdfColumnKey, string> = {
        section: 'Section',
        product: 'Product',
        qty: 'Qty',
        unit: 'Unit',
        total: 'Total',
        status: 'Status',
        supplier: 'Supplier',
        assigned: 'Assigned',
      };

      const baseColumnWidths: Record<Exclude<PdfColumnKey, 'product'>, number> = {
        section: 28,
        qty: 14,
        unit: 14,
        total: 22,
        status: 22,
        supplier: 26,
        assigned: 26,
      };

      const visibleOptionalKeys: PdfColumnKey[] = [
        ...(hasAnyPrice ? ['total' as const] : []),
        ...(hasAnyUnit ? ['unit' as const] : []),
        ...(hasAnyNonPlannedStatus ? ['status' as const] : []),
        ...(hasAnySupplier ? ['supplier' as const] : []),
        ...(hasAnyAssigned ? ['assigned' as const] : []),
      ];

      const getFixedWidth = (keys: PdfColumnKey[]) =>
        keys.reduce((sum, key) => sum + (key === 'product' ? 0 : baseColumnWidths[key]), 0);

      const getTableConfig = (grouped: boolean) => {
        const minProductWidth = grouped ? 58 : 48;
        const leadingKeys: PdfColumnKey[] = grouped ? [] : ['section'];
        const selectedKeys: PdfColumnKey[] = [...leadingKeys, 'product', 'qty'];

        for (const key of visibleOptionalKeys) {
          const projectedKeys = [...selectedKeys, key];
          if (printableWidth - getFixedWidth(projectedKeys) >= minProductWidth) {
            selectedKeys.push(key);
          }
        }

        const productWidth = Math.max(minProductWidth, printableWidth - getFixedWidth(selectedKeys));
        const columnStyles = Object.fromEntries(
          selectedKeys.map((key, index) => {
            if (key === 'product') {
              return [
                index,
                {
                  cellWidth: productWidth,
                },
              ];
            }
            if (key === 'qty' || key === 'total') {
              return [
                index,
                {
                  cellWidth: baseColumnWidths[key],
                  halign: 'right',
                },
              ];
            }
            return [
              index,
              {
                cellWidth: baseColumnWidths[key],
              },
            ];
          }),
        );

        return {
          keys: selectedKeys,
          head: [selectedKeys.map((key) => columnLabels[key])],
          columnStyles,
        };
      };

      const groupedTableConfig = getTableConfig(true);
      const flatTableConfig = getTableConfig(false);

      const buildRow = (item: ShoppingListItem, keys: PdfColumnKey[]) => {
        const sectionName = item.sectionId ? sectionMap.get(item.sectionId) || 'No Category' : 'No Category';
        const assignedMember = item.assignedTo
          ? teamMembers?.find((member) => member.clerkUserId === item.assignedTo)?.name || item.assignedTo
          : '-';
        const notes = exportOptions.includeNotes ? normalizePdfText(item.notes, '') : '';
        const productLabel = normalizePdfText(item.name, 'Untitled item');
        const productCell = notes
          ? `${productLabel}\nNote: ${truncatePdfText(notes, PDF_BODY_NOTE_MAX_LENGTH)}`
          : productLabel;

        const rowData: Record<PdfColumnKey, string> = {
          section: normalizePdfText(sectionName, 'No Category'),
          product: productCell,
          qty: formatQuantity(item.quantity),
          unit: normalizePdfText(item.unit, '-'),
          total: formatMoney(item.totalPrice, currencySymbol),
          status: getStatusLabel(item.realizationStatus),
          supplier: normalizePdfText(item.supplier, '-'),
          assigned: normalizePdfText(assignedMember, '-'),
        };

        return keys.map((key) => rowData[key]);
      };

      const tableThemeOverride = {
        ...pdfTableTheme,
        styles: {
          ...pdfTableTheme.styles,
          font: pdfFontFamily,
          fontSize: 8.2,
          cellPadding: 2,
          valign: 'top' as const,
        },
        headStyles: {
          ...pdfTableTheme.headStyles,
          font: pdfFontFamily,
          fontSize: 8.4,
          lineWidth: 0.12,
        },
      };

      let yPosition = await addBrandHeader(doc, {
        teamName: team.name || 'Organization',
        teamImageUrl: team.imageUrl,
        fontFamily: pdfFontFamily,
      });

      yPosition = addDocumentMeta(doc, {
        title: `Shopping List - ${project.name}`,
        subtitle: `Items: ${filteredItemsForExport.length} | Total: ${formatMoney(filteredTotal, currencySymbol)}`,
        generatedOn: format(new Date(), 'yyyy-MM-dd HH:mm'),
        startY: yPosition,
        fontFamily: pdfFontFamily,
      });

      if (exportOptions.groupBySections) {
        groupedFilteredItems.forEach(({ sectionName, sectionItems }) => {
          yPosition = resolvePageBreak(doc, yPosition, 18);
          const sectionTotal = calculateShoppingTotal(sectionItems);

          doc.setFont(pdfFontFamily, 'bold');
          doc.setFontSize(12);
          doc.setTextColor(30, 30, 30);
          doc.text(sectionName, 18, yPosition);
          doc.text(
            `Section total: ${formatMoney(sectionTotal, currencySymbol)}`,
            pageWidth - 18,
            yPosition,
            { align: 'right' },
          );
          yPosition += 3;

          const tableData = sectionItems.map((item) => buildRow(item, groupedTableConfig.keys));

          doc.autoTable({
            ...tableThemeOverride,
            startY: yPosition,
            head: groupedTableConfig.head,
            body: tableData,
            columnStyles: groupedTableConfig.columnStyles,
          });

          yPosition = doc.lastAutoTable.finalY + 6;
        });
      } else {
        const tableData = filteredItemsForExport.map((item) => buildRow(item, flatTableConfig.keys));

        doc.autoTable({
          ...tableThemeOverride,
          startY: yPosition,
          head: flatTableConfig.head,
          body: tableData,
          columnStyles: flatTableConfig.columnStyles,
        });

        yPosition = doc.lastAutoTable.finalY + 6;
      }

      yPosition = resolvePageBreak(doc, yPosition, 14);
      doc.setFont(pdfFontFamily, 'bold');
      doc.setFontSize(12);
      doc.setTextColor(20, 20, 20);
      doc.text(
        `Grand total: ${formatMoney(filteredTotal, currencySymbol)}`,
        pageWidth - 18,
        yPosition,
        { align: 'right' },
      );

      addPageNumbers(doc, pdfFontFamily);
      doc.save(`shopping-list-${sanitizeFileName(project.name)}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);

      setIsExportModalOpen(false);
      toast.success('PDF exported successfully!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF');
    }
  };

  const handleExport = () => {
    if (exportOptions.format === 'csv') {
      handleExportCSV();
    } else {
      handleExportPDF();
    }
  };

  return (
    <TooltipProvider>
      <ProjectPageLayout>
        {/* Export Modal */}
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          exportOptions={exportOptions}
          onExportOptionsChange={setExportOptions}
          onExport={handleExport}
          isPending={isPending}
        />

        {/* Header */}
        <ProjectPageHeader
          title="Shopping List"
          icon={<ShoppingCart className="h-8 w-8" />}
          tags={
            <>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] px-4 py-2 text-sm font-medium text-[var(--ui-accent-brand)]">
                {project.name}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] px-4 py-2 text-sm font-medium text-[var(--ui-text-main)]">
                Total: {grandTotal.toFixed(2)} {currencySymbol}
              </span>
            </>
          }
          actions={
            <>
              <Button
                onClick={() => setShowMainAddForm(!showMainAddForm)}
                className="rounded-lg bg-[var(--ui-action-bg)] px-6 text-[var(--primary-foreground)] shadow-[0_14px_36px_rgba(14,14,14,0.18)] hover:bg-[var(--ui-action-hover)] transition-transform hover:-translate-y-0.5"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Product
              </Button>
              <Button
                onClick={() => setIsExportModalOpen(true)}
                variant="outline"
                className="rounded-lg border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] px-6 text-[var(--ui-text-strong)] shadow-sm hover:bg-[var(--ui-surface-base)]/90 hover:-translate-y-0.5 transition-all"
              >
                <DownloadIcon className="h-4 w-4 mr-2" />
                Export
              </Button>
            </>
          }
        />

        {/* Main Add Product Form */}
        {showMainAddForm && (
          <div className="mb-10 rounded-[32px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-8 shadow-[0_24px_60px_rgba(20,20,20,0.08)]">
            <h3 className="text-2xl font-medium font-[var(--font-display-serif)] mb-6">Add New Product</h3>
            <AddItemForm
              sections={sections}
              teamMembers={teamMembers}
              currencySymbol={currencySymbol}
              onAddItem={async (itemData) => {
                await handleAddItem(itemData);
                setShowMainAddForm(false);
              }}
              isPending={isPending}
            />
          </div>
        )}

        {/* Section Manager */}
        <SectionManager
          sections={sections}
          onCreateSection={handleCreateSection}
          onDeleteSection={handleDeleteSection}
          isPending={isPending}
        />

        {/* Shopping List Sections */}
        {Object.entries(itemsBySection)
          .sort(([a], [b]) => {
            if (a === 'No Category') return 1;
            if (b === 'No Category') return -1;
            return a.localeCompare(b);
          })
          .map(([sectionName, sectionItems]) => {
            // Find the section ID for this section name
            const section = sections.find(s => s.name === sectionName);
            const sectionId = section?._id;

            return (
              <ShoppingListSection
                key={sectionName}
                sectionName={sectionName}
                sectionId={sectionId}
                items={sectionItems}
                currencySymbol={currencySymbol}
                teamMembers={teamMembers}
                sections={sections}
                onUpdateItem={handleUpdateItem}
                onDeleteItem={handleDeleteItem}
                onAddItem={handleAddItem}
                isPending={isPending}
              />
            );
          })}

        {/* Grand Total */}
        <div className="mt-12 rounded-[32px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-8 shadow-[0_24px_60px_rgba(20,20,20,0.08)]">
          <div className="space-y-4">
            {sectionTotals.map(({ section, total }) => (
              <div key={section} className="flex justify-between items-center text-base text-[var(--ui-text-main)]">
                <span className="font-medium">{section}</span>
                <span>{total.toFixed(2)} {currencySymbol}</span>
              </div>
            ))}
            <div className="border-t border-[var(--ui-border-soft)] pt-4 flex justify-between items-center">
              <span className="text-xl font-medium font-[var(--font-display-serif)]">Grand Total</span>
              <span className="text-2xl font-medium font-[var(--font-display-serif)]">{grandTotal.toFixed(2)} {currencySymbol}</span>
            </div>
          </div>
        </div>
      </ProjectPageLayout>
    </TooltipProvider>
  );
}
