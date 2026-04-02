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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { addBrandHeader, addDocumentMeta, addPageNumbers, ensurePdfUnicodeFont, formatMoney, pdfTableTheme, resolvePageBreak, sanitizeFileName } from '@/lib/pdfExport';
import { buildAlternativeSelection, calculateShoppingTotal, isItemCountedInShoppingTotal } from '@/lib/shoppingAlternatives';

// Import new components
import { SectionManager } from './SectionManager';
import { AddItemForm } from './AddItemForm';
import { ShoppingListSection } from './ShoppingListSection';
import { ExportModal } from './ExportModal';
import { ProjectPageLayout } from '@/components/project/ProjectPageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DownloadIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react';

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

type PdfInlineImage = {
  dataUrl: string;
  width: number;
  height: number;
  format: 'PNG' | 'JPEG';
};

const PDF_IMAGE_MAX_SIDE = 220;
const PDF_IMAGE_JPEG_QUALITY = 0.82;

const loadImageElement = (sourceUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${sourceUrl}`));
    img.src = sourceUrl;
  });

const loadPdfInlineImage = async (imageUrl: string): Promise<PdfInlineImage | null> => {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const image = await loadImageElement(objectUrl);

    const scale = Math.min(1, PDF_IMAGE_MAX_SIDE / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      URL.revokeObjectURL(objectUrl);
      return null;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const mimeType = blob.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const dataUrl = mimeType === 'image/png'
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', PDF_IMAGE_JPEG_QUALITY);

    URL.revokeObjectURL(objectUrl);

    return {
      dataUrl,
      width: canvas.width,
      height: canvas.height,
      format: mimeType === 'image/png' ? 'PNG' : 'JPEG',
    };
  } catch (error) {
    console.warn('Failed to load inline PDF image:', error);
    return null;
  }
};

const preloadPdfInlineImages = async (items: ShoppingListItem[]): Promise<Map<string, PdfInlineImage>> => {
  const urlCandidates = Array.from(
    new Set(
      items
        .map((item) => item.imageUrl?.trim())
        .filter((value): value is string => !!value),
    ),
  );

  if (urlCandidates.length === 0) {
    return new Map();
  }

  const byUrl = new Map<string, PdfInlineImage | null>();
  await Promise.all(
    urlCandidates.map(async (url) => {
      const loaded = await loadPdfInlineImage(url);
      byUrl.set(url, loaded);
    }),
  );

  const byItemId = new Map<string, PdfInlineImage>();
  items.forEach((item) => {
    const url = item.imageUrl?.trim();
    if (!url) {
      return;
    }
    const loaded = byUrl.get(url);
    if (loaded) {
      byItemId.set(String(item._id), loaded);
    }
  });

  return byItemId;
};


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
    includeImages: true,
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

  const sectionMap = new Map(sections.map(s => [s._id, s.name]));
  const resolveSectionName = (item: ShoppingListItem) =>
    item.sectionId ? sectionMap.get(item.sectionId) || 'No Category' : 'No Category';

  const hasItemsWithoutSection = items.some(item => !item.sectionId);

  const availableCategories = Array.from(
    new Set(
      items
        .map((item) => item.category?.trim())
        .filter((value): value is string => !!value),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const availableSections = Array.from(
    new Set([
      ...sections.map((section) => section.name),
      ...(hasItemsWithoutSection ? ['No Category'] : []),
    ]),
  ).sort((a, b) => {
    if (a === 'No Category') return 1;
    if (b === 'No Category') return -1;
    return a.localeCompare(b);
  });

  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();

  const filteredItems = items.filter((item) => {
    const sectionName = resolveSectionName(item);
    const categoryName = item.category?.trim() || '';
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
      ]
        .filter((value): value is string => !!value)
        .some((value) => value.toLocaleLowerCase().includes(normalizedSearchQuery));

    const matchesStatus = statusFilter === 'all' || item.realizationStatus === statusFilter;
    const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
    const matchesSection = sectionFilter === 'all' || sectionName === sectionFilter;
    const matchesCategory = categoryFilter === 'all' || categoryName === categoryFilter;

    return matchesSearch && matchesStatus && matchesPriority && matchesSection && matchesCategory;
  });

  const hasActiveFilters =
    normalizedSearchQuery.length > 0 ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    sectionFilter !== 'all' ||
    categoryFilter !== 'all';

  const visibleItemsBySection = filteredItems.reduce((acc, item) => {
    const sectionName = resolveSectionName(item);
    if (!acc[sectionName]) acc[sectionName] = [];
    acc[sectionName].push(item);
    return acc;
  }, {} as Record<string, ShoppingListItem[]>);

  if (!hasActiveFilters) {
    sections.forEach(section => {
      if (!visibleItemsBySection[section.name]) {
        visibleItemsBySection[section.name] = [];
      }
    });

    if (!hasItemsWithoutSection && visibleItemsBySection['No Category']) {
      delete visibleItemsBySection['No Category'];
    }
  }

  const sortedVisibleSections = Object.entries(visibleItemsBySection)
    .sort(([a], [b]) => {
      if (a === 'No Category') return 1;
      if (b === 'No Category') return -1;
      return a.localeCompare(b);
    });

  const sectionTotals = sortedVisibleSections.map(([section, sectionItems]) => {
    const total = calculateShoppingTotal(sectionItems);
    return { section, total, itemCount: sectionItems.length };
  });

  const grandTotal = calculateShoppingTotal(items);
  const visibleGrandTotal = calculateShoppingTotal(filteredItems);

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setSectionFilter('all');
    setCategoryFilter('all');
  };

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

      const jsPdfModule = await import("jspdf");
      const jsPDF = jsPdfModule.jsPDF ?? jsPdfModule.default;
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
      const includeImagesInPdf = exportOptions.includeImages;
      const itemsWithImageUrl = filteredItemsForExport.filter((item) => !!item.imageUrl?.trim());
      const pdfImagesByItemId = includeImagesInPdf
        ? await preloadPdfInlineImages(filteredItemsForExport)
        : new Map<string, PdfInlineImage>();
      const hasImageColumn = includeImagesInPdf && itemsWithImageUrl.length > 0;
      const hasAnyUnit = filteredItemsForExport.some((item) => !!item.unit?.trim());
      const hasAnyPrice = filteredItemsForExport.some((item) => item.totalPrice !== undefined && item.totalPrice !== null);
      const hasAnySupplier = filteredItemsForExport.some((item) => !!item.supplier?.trim());
      const hasAnyAssigned = filteredItemsForExport.some((item) => !!item.assignedTo);
      const hasAnyNonPlannedStatus = filteredItemsForExport.some((item) => item.realizationStatus !== 'PLANNED');

      type PdfColumnKey = 'image' | 'section' | 'product' | 'qty' | 'unit' | 'total' | 'status' | 'supplier' | 'assigned';

      const columnLabels: Record<PdfColumnKey, string> = {
        image: 'Image',
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
        image: 18,
        section: 28,
        qty: 14,
        unit: 14,
        total: 22,
        status: 22,
        supplier: 26,
        assigned: 26,
      };

      const visibleOptionalKeys: PdfColumnKey[] = [
        ...(hasImageColumn ? ['image' as const] : []),
        ...(hasAnyPrice ? ['total' as const] : []),
        ...(hasAnyUnit ? ['unit' as const] : []),
        ...(hasAnyNonPlannedStatus ? ['status' as const] : []),
        ...(hasAnySupplier ? ['supplier' as const] : []),
        ...(hasAnyAssigned ? ['assigned' as const] : []),
      ];

      const getFixedWidth = (keys: PdfColumnKey[]) =>
        keys.reduce((sum, key) => sum + (key === 'product' ? 0 : baseColumnWidths[key]), 0);

      const getTableConfig = (grouped: boolean) => {
        const minProductWidth = grouped ? 52 : 44;
        const leadingKeys: PdfColumnKey[] = grouped
          ? (hasImageColumn ? ['image'] : [])
          : (hasImageColumn ? ['image', 'section'] : ['section']);
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
            if (key === 'image') {
              return [
                index,
                {
                  cellWidth: baseColumnWidths[key],
                  minCellHeight: 16,
                  halign: 'center',
                  valign: 'middle',
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
          image: '',
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

      type PdfPreparedRow = {
        cells: string[];
        image: PdfInlineImage | null;
      };

      const tableThemeOverride = {
        ...pdfTableTheme,
        styles: {
          ...pdfTableTheme.styles,
          font: pdfFontFamily,
          fontSize: 8.2,
          cellPadding: 2,
          valign: 'top' as const,
          ...(hasImageColumn ? { minCellHeight: 16 } : {}),
        },
        headStyles: {
          ...pdfTableTheme.headStyles,
          font: pdfFontFamily,
          fontSize: 8.4,
          lineWidth: 0.12,
        },
      };

      const renderTable = (tableConfig: ReturnType<typeof getTableConfig>, rows: PdfPreparedRow[], startY: number) => {
        const imageColumnIndex = tableConfig.keys.indexOf('image');

        doc.autoTable({
          ...tableThemeOverride,
          startY,
          head: tableConfig.head,
          body: rows.map((row) => row.cells),
          columnStyles: tableConfig.columnStyles,
          didDrawCell: (data: {
            section: string;
            row: { index: number };
            column: { index: number };
            cell: { x: number; y: number; width: number; height: number };
          }) => {
            if (imageColumnIndex === -1 || data.section !== 'body' || data.column.index !== imageColumnIndex) {
              return;
            }

            const image = rows[data.row.index]?.image;
            if (!image) {
              return;
            }

            const padding = 1.2;
            const maxWidth = Math.max(0, data.cell.width - padding * 2);
            const maxHeight = Math.max(0, data.cell.height - padding * 2);
            if (maxWidth <= 0 || maxHeight <= 0) {
              return;
            }

            const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
            const drawWidth = image.width * scale;
            const drawHeight = image.height * scale;
            const drawX = data.cell.x + (data.cell.width - drawWidth) / 2;
            const drawY = data.cell.y + (data.cell.height - drawHeight) / 2;

            doc.addImage(image.dataUrl, image.format, drawX, drawY, drawWidth, drawHeight);
          },
        });
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

          const preparedRows = sectionItems.map((item) => ({
            cells: buildRow(item, groupedTableConfig.keys),
            image: pdfImagesByItemId.get(String(item._id)) ?? null,
          }));
          renderTable(groupedTableConfig, preparedRows, yPosition);

          yPosition = doc.lastAutoTable.finalY + 6;
        });
      } else {
        const preparedRows = filteredItemsForExport.map((item) => ({
          cells: buildRow(item, flatTableConfig.keys),
          image: pdfImagesByItemId.get(String(item._id)) ?? null,
        }));
        renderTable(flatTableConfig, preparedRows, yPosition);

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
      if (includeImagesInPdf && itemsWithImageUrl.length > pdfImagesByItemId.size) {
        toast.info('Some images could not be embedded because the source blocked loading.');
      }
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

        <div className="sticky top-0 z-30 mb-6">
          <Card className="gap-0 rounded-3xl border-border/70 bg-card/95 p-3 backdrop-blur-xl sm:p-4">
            <CardContent className="flex flex-col gap-3 px-0 py-0 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-primary">
                    {project.name}
                  </Badge>
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    Showing {filteredItems.length} / {items.length} items
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    Total: {grandTotal.toFixed(2)} {currencySymbol}
                  </Badge>
                  {hasActiveFilters && (
                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      Visible: {visibleGrandTotal.toFixed(2)} {currencySymbol}
                    </Badge>
                  )}
                </div>
                <CardDescription className="max-w-3xl">
                  Search products and narrow the list by status, priority, section, and category.
                </CardDescription>
              </div>

              <div className="flex flex-wrap gap-2">
                {hasActiveFilters && (
                  <Button
                    onClick={resetFilters}
                    variant="outline"
                    className="h-10 rounded-full px-4"
                  >
                    <XIcon data-icon="inline-start" />
                    Clear filters
                  </Button>
                )}
                <Button
                  onClick={() => setShowMainAddForm(!showMainAddForm)}
                  className="h-10 rounded-full px-5"
                >
                  <PlusIcon data-icon="inline-start" />
                  Add Product
                </Button>
                <Button
                  onClick={() => setIsExportModalOpen(true)}
                  variant="outline"
                  className="h-10 rounded-full px-5"
                >
                  <DownloadIcon data-icon="inline-start" />
                  Export
                </Button>
              </div>
            </CardContent>

            <CardContent className="mt-4 grid gap-2.5 px-0 pb-0 xl:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,0.8fr))]">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by product, supplier, notes, category..."
                  className="h-10 pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | ShoppingListItem["realizationStatus"])}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="PLANNED">Planned</SelectItem>
                  <SelectItem value="ORDERED">Ordered</SelectItem>
                  <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                  <SelectItem value="DELIVERED">Delivered</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as 'all' | NonNullable<ShoppingListItem["priority"]>)}>
                <SelectTrigger className="h-10 w-full">
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
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sections</SelectItem>
                  {availableSections.map((sectionName) => (
                    <SelectItem key={sectionName} value={sectionName}>
                      {sectionName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {availableCategories.map((categoryName) => (
                    <SelectItem key={categoryName} value={categoryName}>
                      {categoryName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>

            {availableSections.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Sections
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant={sectionFilter === 'all' ? 'secondary' : 'outline'}
                  onClick={() => setSectionFilter('all')}
                >
                  All
                </Button>
                {availableSections.map((sectionName) => (
                  <Button
                    key={sectionName}
                    type="button"
                    size="sm"
                    variant={sectionFilter === sectionName ? 'secondary' : 'outline'}
                    onClick={() => setSectionFilter(sectionName)}
                  >
                    {sectionName}
                  </Button>
                ))}
              </div>
            )}

            {availableCategories.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Categories
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant={categoryFilter === 'all' ? 'secondary' : 'outline'}
                  onClick={() => setCategoryFilter('all')}
                >
                  All
                </Button>
                {availableCategories.map((categoryName) => (
                  <Button
                    key={categoryName}
                    type="button"
                    size="sm"
                    variant={categoryFilter === categoryName ? 'secondary' : 'outline'}
                    onClick={() => setCategoryFilter(categoryName)}
                  >
                    {categoryName}
                  </Button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Main Add Product Form */}
        {showMainAddForm && (
          <Card className="mb-10 rounded-3xl border-border/70">
            <CardHeader>
              <CardTitle className="text-2xl">Add New Product</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        )}

        {/* Section Manager */}
        <SectionManager
          sections={sections}
          onCreateSection={handleCreateSection}
          onDeleteSection={handleDeleteSection}
          isPending={isPending}
        />

        {/* Shopping List Sections */}
        {sortedVisibleSections.length === 0 && (
          <Card className="mb-10 rounded-3xl border-dashed border-border/70">
            <CardContent className="p-10 text-center">
              <p className="text-base font-medium text-foreground">No products match the current filters.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Adjust the search or clear the filters to see the full list again.
              </p>
              <Button
                onClick={resetFilters}
                variant="outline"
                className="mt-4 rounded-full"
              >
                Reset filters
              </Button>
            </CardContent>
          </Card>
        )}

        {sortedVisibleSections.map(([sectionName, sectionItems]) => {
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
        <Card className="mt-12 rounded-3xl border-border/70">
          <CardContent className="flex flex-col gap-4 p-8">
            {sectionTotals.map(({ section, total, itemCount }) => (
              <div key={section} className="flex items-center justify-between text-base text-foreground">
                <span className="font-medium">
                  {section} <span className="text-muted-foreground">({itemCount})</span>
                </span>
                <span>{total.toFixed(2)} {currencySymbol}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="text-xl font-semibold">
                {hasActiveFilters ? 'Filtered Total' : 'Grand Total'}
              </span>
              <span className="text-2xl font-semibold">
                {hasActiveFilters ? visibleGrandTotal.toFixed(2) : grandTotal.toFixed(2)} {currencySymbol}
              </span>
            </div>
            {hasActiveFilters && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Full list total</span>
                <span>{grandTotal.toFixed(2)} {currencySymbol}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </ProjectPageLayout>
    </TooltipProvider>
  );
}
