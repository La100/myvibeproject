'use client';

import { useState, useTransition } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { apiAny } from '@/lib/convexApiAny';
import { Doc, Id } from '@/convex/_generated/dataModel';
import type { TeamMember } from '@/lib/teamMember';
import { useProject } from '@/components/providers/ProjectProvider';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { TooltipProvider } from '@/components/ui/tooltip';

// Extend jsPDF type to include autoTable method
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: unknown) => void;
    lastAutoTable: { finalY: number };
  }
}

// Import new components
import { ShoppingListHeader } from './ShoppingListHeader';
import { SectionManager } from './SectionManager';
import { AddItemForm } from './AddItemForm';
import { ShoppingListSection } from './ShoppingListSection';
import { ExportModal } from './ExportModal';

type ShoppingListItem = Doc<"shoppingListItems">;



export function ShoppingListViewSkeleton() {
  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div className="mb-4 sm:mb-0">
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-80" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>

      {/* Add Item Form Skeleton */}
      <div className="mb-6 border rounded-lg p-4">
        <Skeleton className="h-7 w-48 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      {/* Items List Skeleton */}
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border rounded-lg p-4">
            <Skeleton className="h-6 w-1/3 mb-4" />
            <div className="space-y-3">
              {[...Array(2)].map((_, j) => (
                <div key={j} className="flex items-center gap-4 p-2 border rounded-md">
                  <Skeleton className="h-12 w-12 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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
    const total = sectionItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    return { section, total, itemCount: sectionItems.length };
  });

  const grandTotal = sectionTotals.reduce((sum, section) => sum + section.total, 0);

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
    } catch(error) {
      console.error('Error deleting item:', error);
      toast.error("Error deleting item");
    }
  };

  // Export handlers
  const handleExportCSV = () => {
    const filteredItems = items.filter(item => {
      if (exportOptions.statusFilter === 'all') return true;
      return item.realizationStatus.toLowerCase() === exportOptions.statusFilter;
    });

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

    const csvData = filteredItems.map(item => {
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
        item.realizationStatus,
        item.priority || '',
        assignedMember || '',
        item.buyBefore ? format(new Date(item.buyBefore), 'yyyy-MM-dd') : '',
        ...(exportOptions.includeNotes ? [item.notes || ''] : [])
      ];
    });

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `shopping-list-${project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
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
      const jsPDF = (await import('jspdf')).default;
      // Import and initialize the autoTable plugin
      await import('jspdf-autotable');
      
      const doc = new jsPDF({
        putOnlyUsedFonts: true,
        format: 'a4',
        unit: 'mm'
      });
      
      // Add support for Polish characters by using a font that supports UTF-8
      doc.setFont('helvetica', 'normal');
      
      let yPosition = 20;
      
      // Organization Header
      if (team) {
        // Organization name - properly encoded for Polish characters
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        const orgName = team.name || 'Organizacja';
        doc.text(orgName, 20, yPosition);
        yPosition += 12;
        
        // Add logo if available
        if (team.imageUrl) {
          try {
            // Create a temporary image element to load the logo
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            await new Promise((resolve) => {
              img.onload = () => {
                try {
                  // Create canvas to convert image to base64
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d');
                  canvas.width = img.width;
                  canvas.height = img.height;
                  ctx?.drawImage(img, 0, 0);
                  
                  const dataURL = canvas.toDataURL('image/png');
                  
                  // Add logo to PDF (positioned at top right)
                  const logoWidth = 30;
                  const logoHeight = (img.height / img.width) * logoWidth;
                  const pageWidth = doc.internal.pageSize.getWidth();
                  
                  doc.addImage(dataURL, 'PNG', pageWidth - logoWidth - 20, 10, logoWidth, logoHeight);
                  resolve(true);
                } catch (error) {
                  console.warn('Error adding logo to PDF:', error);
                  resolve(false);
                }
              };
              img.onerror = () => {
                console.warn('Could not load organization logo');
                resolve(false);
              };
              img.src = team.imageUrl!;
            });
          } catch (error) {
            console.warn('Error processing organization logo:', error);
          }
        }
        
        // Add separator line
        doc.setLineWidth(0.5);
        doc.line(20, yPosition, doc.internal.pageSize.getWidth() - 20, yPosition);
        yPosition += 10;
      }
      
      // Document Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(`Shopping List - ${project.name}`, 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-US')}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Total Budget: ${grandTotal.toFixed(2)} ${currencySymbol}`, 20, yPosition);
      yPosition += 15;

      if (exportOptions.groupBySections) {
        Object.entries(itemsBySection)
          .sort(([a], [b]) => {
            if (a === 'No Category') return 1;
            if (b === 'No Category') return -1;
            return a.localeCompare(b);
          })
          .forEach(([sectionName, sectionItems]) => {
          if (sectionItems.length === 0) return;
          
          const filteredSectionItems = sectionItems.filter(item => {
            if (exportOptions.statusFilter === 'all') return true;
            return item.realizationStatus.toLowerCase() === exportOptions.statusFilter;
          });

          if (filteredSectionItems.length === 0) return;

          doc.setFontSize(16);
          doc.text(sectionName, 20, yPosition);
          yPosition += 10;

          const statusTranslations: Record<string, string> = {
            'PLANNED': 'Planned',
            'ORDERED': 'Ordered',
            'IN_TRANSIT': 'In Transit',
            'DELIVERED': 'Delivered',
            'COMPLETED': 'Completed',
            'CANCELLED': 'Cancelled'
          };

          const tableData = filteredSectionItems.map(item => [
            item.name,
            item.quantity.toString(),
            item.unitPrice ? `${item.unitPrice.toFixed(2)} ${currencySymbol}` : '-',
            item.totalPrice ? `${item.totalPrice.toFixed(2)} ${currencySymbol}` : '-',
            statusTranslations[item.realizationStatus] || item.realizationStatus,
            item.supplier || '-'
          ]);

          doc.autoTable({
            startY: yPosition,
            head: [['Product', 'Qty', 'Unit Price', 'Total', 'Status', 'Supplier']],
            body: tableData,
            margin: { left: 20, right: 20 },
            styles: { 
              fontSize: 9, 
              cellPadding: 4,
              font: 'helvetica',
              fontStyle: 'normal',
              textColor: [0, 0, 0],
              lineColor: [200, 200, 200],
              lineWidth: 0.1
            },
            headStyles: { 
              fillColor: [70, 70, 70], 
              textColor: [255, 255, 255],
              fontSize: 10,
              fontStyle: 'bold'
            },
            alternateRowStyles: {
              fillColor: [245, 245, 245]
            },
            theme: 'striped'
          });

          yPosition = doc.lastAutoTable.finalY + 10;
        });
      } else {
        const filteredItems = items.filter(item => {
          if (exportOptions.statusFilter === 'all') return true;
          return item.realizationStatus.toLowerCase() === exportOptions.statusFilter;
        });

        const statusTranslations: Record<string, string> = {
          'PLANNED': 'Planned',
          'ORDERED': 'Ordered',
          'IN_TRANSIT': 'In Transit',
          'DELIVERED': 'Delivered',
          'COMPLETED': 'Completed',
          'CANCELLED': 'Cancelled'
        };

        const tableData = filteredItems.map(item => {
          const sectionName = item.sectionId ? sectionMap.get(item.sectionId) || 'No Category' : 'No Category';
          return [
            sectionName,
            item.name,
            item.quantity.toString(),
            item.unitPrice ? `${item.unitPrice.toFixed(2)} ${currencySymbol}` : '',
            item.totalPrice ? `${item.totalPrice.toFixed(2)} ${currencySymbol}` : '',
            statusTranslations[item.realizationStatus] || item.realizationStatus
          ];
        });

        doc.autoTable({
          startY: yPosition,
          head: [['Section', 'Product', 'Qty', 'Unit Price', 'Total', 'Status']],
          body: tableData,
          margin: { left: 20, right: 20 },
          styles: { 
            fontSize: 9, 
            cellPadding: 4,
            font: 'helvetica',
            fontStyle: 'normal',
            textColor: [0, 0, 0],
            lineColor: [200, 200, 200],
            lineWidth: 0.1
          },
          headStyles: { 
            fillColor: [70, 70, 70], 
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: 'bold'
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245]
          },
          theme: 'striped'
        });
      }

      doc.save(`shopping-list-${project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      
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
      <div className="w-full max-w-6xl mx-auto px-6 pb-24 pt-8 sm:px-8">
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
        <ShoppingListHeader
          projectName={project.name}
          grandTotal={grandTotal}
          currencySymbol={currencySymbol}
          onExportClick={() => setIsExportModalOpen(true)}
          onAddProductClick={() => setShowMainAddForm(!showMainAddForm)}
        />

        {/* Main Add Product Form */}
        {showMainAddForm && (
          <div className="mb-10 rounded-[32px] border border-[#E7E2D9] bg-white p-8 shadow-[0_24px_60px_rgba(20,20,20,0.08)]">
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
        <div className="mt-12 rounded-[32px] border border-[#E7E2D9] bg-white p-8 shadow-[0_24px_60px_rgba(20,20,20,0.08)]">
          <div className="space-y-4">
            {sectionTotals.map(({ section, total }) => (
              <div key={section} className="flex justify-between items-center text-base text-[#3C3A37]">
                <span className="font-medium">{section}</span>
                <span>{total.toFixed(2)} {currencySymbol}</span>
              </div>
            ))}
            <div className="border-t border-[#E7E2D9] pt-4 flex justify-between items-center">
              <span className="text-xl font-medium font-[var(--font-display-serif)]">Grand Total</span>
              <span className="text-2xl font-medium font-[var(--font-display-serif)]">{grandTotal.toFixed(2)} {currencySymbol}</span>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
