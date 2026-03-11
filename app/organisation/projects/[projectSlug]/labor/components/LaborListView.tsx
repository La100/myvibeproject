'use client';

import { useState, useTransition } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { apiAny } from '@/lib/convexApiAny';
import { Doc, Id } from '@/convex/_generated/dataModel';
import type { TeamMember } from '@/lib/teamMember';
import { useProject } from '@/components/providers/ProjectProvider';
import { toast } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Hammer, PlusIcon, DownloadIcon } from 'lucide-react';
import { format } from 'date-fns';
import { addBrandHeader, addDocumentMeta, addPageNumbers, formatMoney, pdfTableTheme, resolvePageBreak, sanitizeFileName } from '@/lib/pdfExport';

import { LaborListSection } from './LaborListSection';
import { ProjectPageLayout } from '@/components/project/ProjectPageLayout';
import { ProjectPageHeader } from '@/components/project/ProjectPageHeader';
import { AddLaborItemForm } from './AddLaborItemForm';
import { LaborSectionManager } from './LaborSectionManager';

type LaborItem = Doc<"laborItems">;

export function LaborListViewSkeleton() {
  return <Spinner className="p-4 sm:p-6" />;
}

export default function LaborListView() {
  const [isPending] = useTransition();
  const [showMainAddForm, setShowMainAddForm] = useState(false);

  const { project } = useProject();

  const items = useQuery(apiAny.labor.listLaborItems, { projectId: project._id }) as LaborItem[] | undefined;
  const sections = useQuery(apiAny.labor.listLaborSections, { projectId: project._id }) as Doc<"laborSections">[] | undefined;
  const teamMembers = useQuery(apiAny.teams.getTeamMembers, { teamId: project.teamId }) as TeamMember[] | undefined;
  const team = useQuery(apiAny.teams.getTeamById, { teamId: project.teamId }) as Doc<"teams"> | undefined;

  const createItem = useMutation(apiAny.labor.createLaborItem);
  const updateItem = useMutation(apiAny.labor.updateLaborItem);
  const deleteItem = useMutation(apiAny.labor.deleteLaborItem);
  const createSection = useMutation(apiAny.labor.createLaborSection);
  const deleteSection = useMutation(apiAny.labor.deleteLaborSection);

  if (items === undefined || sections === undefined || team === undefined) {
    return null;
  }

  if (project === null) {
    return <div>Project not found</div>;
  }

  const currencySymbol = project.currency === "EUR" ? "€" : project.currency === "PLN" ? "zł" : "$";

  // Group items by section
  const sectionMap = new Map(sections.map(s => [s._id, s.name]));
  const itemsBySection = items.reduce((acc, item) => {
    const sectionName = item.sectionId ? sectionMap.get(item.sectionId) || 'No Category' : 'No Category';
    if (!acc[sectionName]) acc[sectionName] = [];
    acc[sectionName].push(item);
    return acc;
  }, {} as Record<string, LaborItem[]>);

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

  const handleDeleteSection = async (sectionId: Id<"laborSections">) => {
    const section = sections.find(s => s._id === sectionId);
    if (!section) return;

    const hasItems = items.some(item => item.sectionId === sectionId);
    if (hasItems) {
      if (!confirm(`Section "${section.name}" contains items. Are you sure you want to delete it? Items will be moved to "No Category".`)) {
        return;
      }
    }

    await deleteSection({ sectionId });
  };

  const handleAddItem = async (itemData: {
    name: string;
    notes?: string;
    sectionId?: Id<"laborSections">;
    quantity: number;
    unit: string;
    unitPrice?: number;
    assignedTo?: string;
    referenceLink?: string | null;
    attachmentFileId?: Id<"files"> | null;
  }) => {
    await createItem({
      projectId: project._id,
      ...itemData,
    });
    toast.success("Labor item added");
  };

  const handleUpdateItem = async (id: Id<"laborItems">, updates: Partial<LaborItem>) => {
    try {
      await updateItem({ itemId: id, ...updates });
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error("Error updating item");
    }
  };

  const handleDeleteItem = async (id: Id<"laborItems">) => {
    try {
      await deleteItem({ itemId: id });
      toast.success("Item deleted");
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error("Error deleting item");
    }
  };

  const handleExportPDF = async () => {
    if (items.length === 0) {
      toast.info('Add labor items before exporting.');
      return;
    }

    try {
      const jsPdfModule = await import("jspdf");
      const jsPDF = jsPdfModule.jsPDF ?? jsPdfModule.default;
      await import('jspdf-autotable');

      const doc = new jsPDF({
        putOnlyUsedFonts: true,
        format: 'a4',
        unit: 'mm'
      });

      doc.setFont('helvetica', 'normal');
      const pageWidth = doc.internal.pageSize.getWidth();

      let yPosition = await addBrandHeader(doc, {
        teamName: team.name || 'Organization',
        teamImageUrl: team.imageUrl,
      });

      yPosition = addDocumentMeta(doc, {
        title: `Labor - ${project.name}`,
        subtitle: `Items: ${items.length} | Total: ${formatMoney(grandTotal, currencySymbol)}`,
        generatedOn: format(new Date(), 'yyyy-MM-dd HH:mm'),
        startY: yPosition,
      });

      Object.entries(itemsBySection)
        .sort(([a], [b]) => {
          if (a === 'No Category') return 1;
          if (b === 'No Category') return -1;
          return a.localeCompare(b);
        })
        .forEach(([sectionName, sectionItems]) => {
          if (sectionItems.length === 0) return;

          yPosition = resolvePageBreak(doc, yPosition, 18);
          const sectionTotal = sectionItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

          doc.setFont('helvetica', 'bold');
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

          const tableData = sectionItems.map((item) => {
            const assignedMember = item.assignedTo
              ? teamMembers?.find((member) => member.clerkUserId === item.assignedTo)?.name || item.assignedTo
              : '-';
            const itemLabel = item.notes ? `${item.name}\nNote: ${item.notes}` : item.name;

            return [
              itemLabel,
              item.quantity.toString(),
              item.unit,
              formatMoney(item.unitPrice, currencySymbol),
              formatMoney(item.totalPrice, currencySymbol),
              assignedMember,
            ];
          });

          doc.autoTable({
            ...pdfTableTheme,
            startY: yPosition,
            head: [['Work', 'Qty', 'Unit', 'Unit Price', 'Total', 'Assigned']],
            body: tableData,
            columnStyles: {
              0: { cellWidth: 70 },
              1: { cellWidth: 16, halign: 'right' },
              2: { cellWidth: 16 },
              3: { cellWidth: 25, halign: 'right' },
              4: { cellWidth: 25, halign: 'right' },
              5: { cellWidth: 28 },
            },
          });

          yPosition = doc.lastAutoTable.finalY + 6;
        });

      yPosition = resolvePageBreak(doc, yPosition, 14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(20, 20, 20);
      doc.text(
        `Labor total: ${formatMoney(grandTotal, currencySymbol)}`,
        pageWidth - 18,
        yPosition,
        { align: 'right' },
      );

      addPageNumbers(doc);
      doc.save(`labor-${sanitizeFileName(project.name)}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('PDF exported successfully!');
    } catch (error) {
      console.error('Labor PDF export error:', error);
      toast.error('Failed to export labor PDF');
    }
  };

  return (
    <TooltipProvider>
      <ProjectPageLayout>
        {/* Header */}
        <ProjectPageHeader
          title="Labor"
          icon={<Hammer className="h-8 w-8" />}
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
                onClick={handleExportPDF}
                variant="outline"
                className="rounded-lg border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] px-6 text-[var(--ui-text-strong)] shadow-sm hover:bg-[var(--ui-surface-base)]/90 hover:-translate-y-0.5 transition-all"
              >
                <DownloadIcon className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
              <Button
                onClick={() => setShowMainAddForm(!showMainAddForm)}
                className="rounded-lg bg-[var(--ui-action-bg)] px-6 text-[var(--primary-foreground)] shadow-[0_14px_36px_rgba(14,14,14,0.18)] hover:bg-[var(--ui-action-hover)] transition-transform hover:-translate-y-0.5"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Labor
              </Button>
            </>
          }
        />

        {/* Main Add Labor Form */}
        {showMainAddForm && (
          <div className="mb-10 rounded-[32px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-8 shadow-[0_24px_60px_rgba(20,20,20,0.08)]">
            <h3 className="text-2xl font-medium font-[var(--font-display-serif)] mb-6">Add New Labor Item</h3>
            <AddLaborItemForm
              projectId={project._id}
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
        <LaborSectionManager
          sections={sections}
          onCreateSection={handleCreateSection}
          onDeleteSection={handleDeleteSection}
          isPending={isPending}
        />

        {/* Labor List Sections */}
        {Object.entries(itemsBySection)
          .sort(([a], [b]) => {
            if (a === 'No Category') return 1;
            if (b === 'No Category') return -1;
            return a.localeCompare(b);
          })
          .map(([sectionName, sectionItems]) => {
            const section = sections.find(s => s.name === sectionName);
            const sectionId = section?._id;

            return (
              <LaborListSection
                key={sectionName}
                projectId={project._id}
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
              <span className="text-xl font-medium font-[var(--font-display-serif)]">Labor Total</span>
              <span className="text-2xl font-medium font-[var(--font-display-serif)]">{grandTotal.toFixed(2)} {currencySymbol}</span>
            </div>
          </div>
        </div>
      </ProjectPageLayout>
    </TooltipProvider>
  );
}
