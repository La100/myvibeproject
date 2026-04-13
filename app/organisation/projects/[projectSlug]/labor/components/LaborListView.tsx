'use client';

import { useState, useTransition } from 'react';
import { useQuery, useMutation } from 'convex/react';
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
import type { TeamMember } from '@/lib/teamMember';
import { formatCurrency } from '@/lib/utils';
import {
  addBrandHeader,
  addDocumentMeta,
  addPageNumbers,
  formatMoney,
  pdfTableTheme,
  renderPdfTable,
  resolvePageBreak,
  sanitizeFileName,
} from '@/lib/pdfExport';
import { resolveMeasurementSystem } from './laborUnits';

import { AddLaborItemForm } from './AddLaborItemForm';
import { LaborListHeader } from './LaborListHeader';
import { LaborListSection } from './LaborListSection';
import { LaborSectionManager } from './LaborSectionManager';

type LaborItem = Doc<"laborItems">;

export function LaborListViewSkeleton() {
  return <Spinner className="p-4 sm:p-6" />;
}

export default function LaborListView() {
  const [isPending] = useTransition();
  const [showMainAddForm, setShowMainAddForm] = useState(false);
  const [isSectionManagerOpen, setIsSectionManagerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

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

  const currencySymbol = project.currency === 'EUR' ? '€' : project.currency === 'PLN' ? 'zł' : '$';
  const measurementSystem = resolveMeasurementSystem((project as Doc<"projects"> & { measurements?: string }).measurements);
  const sectionMap = new Map(sections.map((section) => [String(section._id), section]));

  const resolveSectionName = (item: LaborItem) => {
    if (!item.sectionId) return 'No Category';
    return sectionMap.get(String(item.sectionId))?.name || 'No Category';
  };

  const getAssignedMemberName = (assignedTo?: string) => {
    if (!assignedTo) return null;
    const member = teamMembers?.find((entry) => entry.clerkUserId === assignedTo);
    return member?.name || assignedTo;
  };

  const availableSections = Array.from(
    new Set([
      ...sections.map((section) => section.name),
      ...(items.some((item) => !item.sectionId) ? ['No Category'] : []),
    ]),
  );

  const availableAssignees = Array.from(
    new Set(items.map((item) => item.assignedTo).filter((value): value is string => !!value)),
  ).sort((left, right) => {
    const leftLabel = getAssignedMemberName(left) || left;
    const rightLabel = getAssignedMemberName(right) || right;
    return leftLabel.localeCompare(rightLabel);
  });

  const buildSectionEntries = (sourceItems: LaborItem[], includeEmptySections: boolean) => {
    const sectionOrder = new Map(sections.map((section) => [String(section._id), section.order]));
    const sectionBuckets = new Map<string, { sectionId?: Id<"laborSections">; name: string; items: LaborItem[] }>();

    const ensureBucket = (key: string, name: string, sectionId?: Id<"laborSections">) => {
      if (!sectionBuckets.has(key)) {
        sectionBuckets.set(key, { sectionId, name, items: [] });
      }
      return sectionBuckets.get(key)!;
    };

    for (const item of sourceItems) {
      const key = item.sectionId ? String(item.sectionId) : '__none__';
      ensureBucket(key, resolveSectionName(item), item.sectionId ?? undefined).items.push(item);
    }

    if (includeEmptySections) {
      for (const section of sections) {
        ensureBucket(String(section._id), section.name, section._id);
      }
    }

    return Array.from(sectionBuckets.values()).sort((left, right) => {
      if (left.name === 'No Category') return 1;
      if (right.name === 'No Category') return -1;
      const leftOrder = left.sectionId ? sectionOrder.get(String(left.sectionId)) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
      const rightOrder = right.sectionId ? sectionOrder.get(String(right.sectionId)) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.name.localeCompare(right.name);
    });
  };

  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredItems = items.filter((item) => {
    const sectionName = resolveSectionName(item);
    const assignedLabel = getAssignedMemberName(item.assignedTo);
    const matchesSearch =
      normalizedSearchQuery.length === 0 ||
      [
        item.name,
        item.notes,
        item.unit,
        item.referenceLink,
        sectionName,
        assignedLabel,
      ]
        .filter((value): value is string => !!value)
        .some((value) => value.toLocaleLowerCase().includes(normalizedSearchQuery));

    const matchesSection = sectionFilter === 'all' || sectionName === sectionFilter;
    const matchesAssignee = assigneeFilter === 'all' || item.assignedTo === assigneeFilter;

    return matchesSearch && matchesSection && matchesAssignee;
  });

  const visibleSectionEntries = buildSectionEntries(
    filteredItems,
    normalizedSearchQuery.length === 0 && sectionFilter === 'all' && assigneeFilter === 'all',
  );
  const exportSectionEntries = buildSectionEntries(items, false);

  const grandTotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  const visibleGrandTotal = filteredItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  const hasActiveFilters =
    normalizedSearchQuery.length > 0 ||
    sectionFilter !== 'all' ||
    assigneeFilter !== 'all';

  const handleCreateSection = async (name: string) => {
    await createSection({ name, projectId: project._id });
  };

  const handleDeleteSection = async (sectionId: Id<"laborSections">) => {
    const section = sections.find((entry) => entry._id === sectionId);
    if (!section) return;

    const hasItems = items.some((item) => item.sectionId === sectionId);
    if (hasItems) {
      if (!confirm(`Section "${section.name}" contains items. Are you sure you want to delete it? Items will be moved to "No Category".`)) {
        return;
      }
    }

    await deleteSection({ sectionId });
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSectionFilter('all');
    setAssigneeFilter('all');
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
    toast.success('Labor item added');
  };

  const handleUpdateItem = async (id: Id<"laborItems">, updates: Partial<LaborItem>) => {
    try {
      await updateItem({ itemId: id, ...updates });
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('Error updating item');
    }
  };

  const handleDeleteItem = async (id: Id<"laborItems">) => {
    try {
      await deleteItem({ itemId: id });
      toast.success('Item deleted');
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Error deleting item');
    }
  };

  const handleExportPDF = async () => {
    if (items.length === 0) {
      toast.info('Add labor items before exporting.');
      return;
    }

    try {
      const jsPdfModule = await import('jspdf');
      const jsPDF = jsPdfModule.jsPDF ?? jsPdfModule.default;

      const doc = new jsPDF({
        putOnlyUsedFonts: true,
        format: 'a4',
        unit: 'mm',
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

      for (const entry of exportSectionEntries) {
        if (entry.items.length === 0) {
          continue;
        }

        yPosition = resolvePageBreak(doc, yPosition, 18);
        const sectionTotal = entry.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(30, 30, 30);
        doc.text(entry.name, 18, yPosition);
        doc.text(
          `Section total: ${formatMoney(sectionTotal, currencySymbol)}`,
          pageWidth - 18,
          yPosition,
          { align: 'right' },
        );
        yPosition += 3;

        const tableData = entry.items.map((item) => {
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

        await renderPdfTable(doc, {
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
      }

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
        <div className="text-sm">
          <LaborListHeader
            projectName={project.name}
            grandTotal={grandTotal}
            currencyCode={project.currency}
            onExportClick={handleExportPDF}
            onAddLaborClick={() => setShowMainAddForm((current) => !current)}
          />

          {showMainAddForm ? (
            <div className="mb-8 rounded-3xl border bg-card p-6 shadow-sm">
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
                measurementSystem={measurementSystem}
              />
            </div>
          ) : null}

          <div className="mb-8">
            <LaborSectionManager
              sections={sections}
              onCreateSection={handleCreateSection}
              onDeleteSection={handleDeleteSection}
              isPending={isPending}
              expanded={isSectionManagerOpen}
              onExpandedChange={setIsSectionManagerOpen}
            />
          </div>

          <div className="sticky top-16 z-10 mb-8 rounded-[30px] border border-border/70 bg-card/95 p-3 shadow-[0_18px_40px_-32px_rgba(22,22,22,0.45)] backdrop-blur-sm xl:top-0">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-1 flex-wrap items-center gap-2.5">
                <Badge variant="secondary" className="h-11 rounded-full px-4 text-[12px] font-semibold">
                  {filteredItems.length} items
                </Badge>

                <Select value={sectionFilter} onValueChange={setSectionFilter}>
                  <SelectTrigger className="h-11 min-w-[220px] rounded-full border-transparent bg-muted/55 px-5 shadow-none">
                    <SelectValue placeholder="Show sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Show all sections</SelectItem>
                    {availableSections.map((section) => (
                      <SelectItem key={section} value={section}>
                        {section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                  <SelectTrigger className="h-11 min-w-[220px] rounded-full border-transparent bg-muted/55 px-5 shadow-none">
                    <SelectValue placeholder="Show assignees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Show all assignees</SelectItem>
                    {availableAssignees.map((assigneeId) => (
                      <SelectItem key={assigneeId} value={assigneeId}>
                        {getAssignedMemberName(assigneeId) || assigneeId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <InputGroup className="h-11 min-w-[280px] flex-1 rounded-full border-border/70 bg-background shadow-none">
                  <InputGroupAddon align="inline-start" className="pointer-events-none pl-4 text-muted-foreground">
                    <SearchIcon className="h-4 w-4" />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by work, notes, assignee, or link"
                    className="h-11 rounded-full pr-4"
                  />
                </InputGroup>
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                {hasActiveFilters ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="h-11 rounded-full border border-border/70 px-4"
                  >
                    <XIcon className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                ) : null}

                <div className="inline-flex h-11 items-center justify-end gap-2 rounded-full px-2 text-sm">
                  <span className="font-medium text-muted-foreground">total:</span>
                  <span className="text-[1.75rem] font-semibold leading-none tracking-[-0.03em] text-foreground">
                    {formatCurrency(visibleGrandTotal, project.currency)}
                  </span>
                </div>
              </div>
            </div>

            {hasActiveFilters ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {searchQuery ? (
                  <Badge variant="outline" className="rounded-full px-3 py-1.5">
                    Search: {searchQuery}
                  </Badge>
                ) : null}
                {sectionFilter !== 'all' ? (
                  <Badge variant="outline" className="rounded-full px-3 py-1.5">
                    Section: {sectionFilter}
                  </Badge>
                ) : null}
                {assigneeFilter !== 'all' ? (
                  <Badge variant="outline" className="rounded-full px-3 py-1.5">
                    Assignee: {getAssignedMemberName(assigneeFilter) || assigneeFilter}
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>

          {visibleSectionEntries.map((entry) => (
            <LaborListSection
              key={entry.sectionId || entry.name}
              projectId={project._id}
              sectionName={entry.name}
              sectionId={entry.sectionId}
              items={entry.items}
              currencySymbol={currencySymbol}
              teamMembers={teamMembers}
              sections={sections}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onAddItem={handleAddItem}
              isPending={isPending}
              measurementSystem={measurementSystem}
            />
          ))}

          {visibleSectionEntries.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/70 bg-muted/10 p-10 text-center">
              <p className="text-sm font-medium text-foreground">No labor items match the current filters.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Clear filters or add a new labor item.
              </p>
              {hasActiveFilters ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="mt-4 rounded-full"
                >
                  Clear filters
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMainAddForm(true)}
                  className="mt-4 rounded-full"
                >
                  Add labor item
                </Button>
              )}
            </div>
          ) : null}

          {filteredItems.length > 0 ? (
            <div className="mt-8 flex flex-wrap items-center justify-end gap-2">
              {visibleSectionEntries
                .filter((entry) => entry.items.length > 0)
                .map((entry) => (
                  <Badge key={entry.sectionId || entry.name} variant="outline" className="rounded-full px-3 py-1.5">
                    {entry.name}: {formatCurrency(entry.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0), project.currency)}
                  </Badge>
                ))}
              <Badge variant="secondary" className="rounded-full px-4 py-2 text-sm font-semibold">
                Visible total: {formatCurrency(visibleGrandTotal, project.currency)}
              </Badge>
            </div>
          ) : null}
        </div>
      </ProjectPageLayout>
    </TooltipProvider>
  );
}
