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
import { toUserFacingErrorMessage } from '@/lib/userFacingErrors';
import { downloadCsvFile } from '@/lib/csvExport';
import {
  getLaborExportCsvRow,
  getLaborExportHeaders,
  type LaborExportColumnOptions,
  type LaborExportRow,
} from '@/lib/laborExport';
import type { TeamMember } from '@/lib/teamMember';
import { exportSectionedTablePdf } from '@/lib/sectionedTablePdfExport';
import { formatCurrency } from '@/lib/utils';
import {
  formatMoney,
  sanitizeFileName,
} from '@/lib/pdfExport';
import { exportWorkbookTables, getSectionAccentColor } from '@/lib/xlsxExport';
import { resolveMeasurementSystem } from './laborUnits';

import { AddLaborItemForm } from './AddLaborItemForm';
import { LaborExportDialog, type LaborListExportOptions } from './LaborExportDialog';
import { LaborListHeader } from './LaborListHeader';
import { LaborListSection } from './LaborListSection';
import { LaborSectionManager } from './LaborSectionManager';

type LaborItem = Doc<"laborItems">;
const formatItemCountLabel = (count: number) => `${count} ${count === 1 ? 'item' : 'items'}`;
const getSectionOptionLabel = (section: string) => section === 'No Section' ? 'No section' : section;

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
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportOptions, setExportOptions] = useState<LaborListExportOptions>({
    format: 'xlsx',
    groupBySections: true,
    includeNotes: true,
    includeReferenceLink: true,
    scope: 'currentView',
  });

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
    if (!item.sectionId) return 'No Section';
    return sectionMap.get(String(item.sectionId))?.name || 'No Section';
  };

  const getAssignedMemberName = (assignedTo?: string) => {
    if (!assignedTo) return null;
    const member = teamMembers?.find((entry) => entry.clerkUserId === assignedTo);
    return member?.name || assignedTo;
  };

  const availableSections = Array.from(
    new Set([
      ...sections.map((section) => section.name),
      ...(items.some((item) => !item.sectionId) ? ['No Section'] : []),
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
      if (left.name === 'No Section') return 1;
      if (right.name === 'No Section') return -1;
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
  const exportSourceItems = exportOptions.scope === 'currentView' ? filteredItems : items;
  const exportSectionEntries = buildSectionEntries(exportSourceItems, false);
  const laborExportSections = exportSectionEntries.map((entry) => ({
    sectionName: entry.name,
    rows: entry.items.map((item): LaborExportRow => ({
      sectionName: entry.name,
      work: item.name,
      qty: String(item.quantity),
      unit: item.unit || '-',
      unitNet: formatMoney(item.unitPrice, currencySymbol),
      unitTax: formatMoney(0, currencySymbol),
      unitGross: formatMoney(item.unitPrice, currencySymbol),
      totalNet: formatMoney(item.totalPrice, currencySymbol),
      totalTax: formatMoney(0, currencySymbol),
      totalGross: formatMoney(item.totalPrice, currencySymbol),
      notes: item.notes || '-',
      referenceLink: item.referenceLink || '-',
    })),
  }));
  const laborExportRows = laborExportSections.flatMap((section) => section.rows);
  const groupedLaborColumnOptions: LaborExportColumnOptions = {
    includeNotes: exportOptions.includeNotes,
    includeReferenceLink: exportOptions.includeReferenceLink,
  };
  const flatLaborColumnOptions: LaborExportColumnOptions = {
    ...groupedLaborColumnOptions,
    includeSection: true,
  };

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
    startDate?: number;
    endDate?: number;
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
      toast.error('Error updating item', {
        description: toUserFacingErrorMessage(error),
      });
    }
  };

  const handleDeleteItem = async (id: Id<"laborItems">) => {
    try {
      await deleteItem({ itemId: id });
      toast.success('Item deleted');
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Error deleting item', {
        description: toUserFacingErrorMessage(error),
      });
    }
  };

  const buildLaborPdfColumns = (includeSection: boolean) => [
    ...(includeSection ? [{ key: 'sectionName', label: 'Section' }] : []),
    { key: 'work', label: 'Work' },
    { key: 'qty', label: 'Qty' },
    { key: 'unit', label: 'Unit' },
    { key: 'unitNet', label: 'Unit Net' },
    { key: 'totalNet', label: 'Net Total' },
    ...(exportOptions.includeNotes ? [{ key: 'notes', label: 'Notes' }] : []),
    ...(exportOptions.includeReferenceLink ? [{ key: 'referenceLink', label: 'Reference Link' }] : []),
  ];

  const handleExportPDF = async () => {
    if (laborExportRows.length === 0) {
      toast.info('Add labor items before exporting.');
      return;
    }

    try {
      await exportSectionedTablePdf({
        brand: {
          teamName: team.name || 'Organization',
          teamImageUrl: team.imageUrl,
        },
        columns: buildLaborPdfColumns(!exportOptions.groupBySections),
        fileName: `labor-${sanitizeFileName(project.name)}-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
        generatedOn: format(new Date(), 'yyyy-MM-dd HH:mm'),
        groupBySections: exportOptions.groupBySections,
        sections: laborExportSections.map((section) => ({
          sectionName: section.sectionName,
          rows: section.rows.map((row) => ({
            ...(exportOptions.groupBySections ? {} : { sectionName: row.sectionName }),
            work: row.work,
            qty: row.qty,
            unit: row.unit,
            unitNet: row.unitNet,
            totalNet: row.totalNet,
            ...(exportOptions.includeNotes ? { notes: row.notes } : {}),
            ...(exportOptions.includeReferenceLink ? { referenceLink: row.referenceLink } : {}),
          })),
        })),
        subtitle: `Items: ${laborExportRows.length} | Total: ${formatMoney(
          exportSourceItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0),
          currencySymbol,
        )}`,
        title: `Labor - ${project.name}`,
      });
      setIsExportModalOpen(false);
      toast.success('PDF exported successfully!');
    } catch (error) {
      console.error('Labor PDF export error:', error);
      toast.error('Failed to export labor PDF', {
        description: toUserFacingErrorMessage(error),
      });
    }
  };

  const handleExportCSV = () => {
    if (laborExportRows.length === 0) {
      toast.info('Add labor items before exporting.');
      return;
    }

    downloadCsvFile({
      fileName: `labor-${sanitizeFileName(project.name)}-${format(new Date(), 'yyyy-MM-dd')}.csv`,
      headers: getLaborExportHeaders(flatLaborColumnOptions),
      rows: laborExportRows.map((row) => getLaborExportCsvRow(row, flatLaborColumnOptions)),
    });
    setIsExportModalOpen(false);
    toast.success('CSV exported successfully!');
  };

  const handleExportXlsx = async () => {
    if (laborExportRows.length === 0) {
      toast.info('Add labor items before exporting.');
      return;
    }

    await exportWorkbookTables({
      fileName: `labor-${sanitizeFileName(project.name)}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`,
      sheets: [
        {
          generatedOn: format(new Date(), 'yyyy-MM-dd HH:mm'),
          name: 'Labor',
          subtitle: `Items: ${laborExportRows.length} | Total: ${formatMoney(
            exportSourceItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0),
            currencySymbol,
          )}`,
          tables: exportOptions.groupBySections
            ? laborExportSections.map((section, index) => ({
                accentColor: getSectionAccentColor(index),
                headers: getLaborExportHeaders(groupedLaborColumnOptions),
                rows: section.rows.map((row) => getLaborExportCsvRow(row, groupedLaborColumnOptions)),
                title: section.sectionName,
              }))
            : [
                {
                  headers: getLaborExportHeaders(flatLaborColumnOptions),
                  rows: laborExportRows.map((row) => getLaborExportCsvRow(row, flatLaborColumnOptions)),
                  title: 'Items',
                },
              ],
          title: `Labor - ${project.name}`,
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
          <LaborListHeader
            projectName={project.name}
            grandTotal={grandTotal}
            currencyCode={project.currency}
            onExportClick={() => setIsExportModalOpen(true)}
            onAddLaborClick={() => setShowMainAddForm((current) => !current)}
          />

          {showMainAddForm ? (
            <div className="vibe-panel mb-8 p-6">
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

          <div className="vibe-panel sticky top-16 z-10 mb-8 p-4 xl:top-0">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-1 flex-wrap items-center gap-2.5">
                  <Badge variant="outline" className="h-11 rounded-full border-border/70 bg-secondary/70 px-4 text-[12px] font-semibold text-foreground">
                    {formatItemCountLabel(filteredItems.length)}
                  </Badge>

                  <Select value={sectionFilter} onValueChange={setSectionFilter}>
                    <SelectTrigger className="h-11 min-w-[210px] rounded-full border-border/70 bg-card px-5 shadow-none">
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

                  <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                    <SelectTrigger className="h-11 min-w-[210px] rounded-full border-border/70 bg-card px-5 shadow-none">
                      <SelectValue placeholder="Assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All assignees</SelectItem>
                      {availableAssignees.map((assigneeId) => (
                        <SelectItem key={assigneeId} value={assigneeId}>
                          {getAssignedMemberName(assigneeId) || assigneeId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                      Clear filters
                    </Button>
                  ) : null}

                  <div className="rounded-2xl border border-border/60 bg-secondary/70 px-4 py-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Labor total
                    </div>
                    <div className="mt-1 text-[1.6rem] font-semibold leading-none tracking-[-0.03em] text-foreground">
                      {formatCurrency(visibleGrandTotal, project.currency)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <InputGroup className="h-11 min-w-[280px] flex-1 rounded-full border-border/70 bg-secondary/70 shadow-none">
                  <InputGroupAddon align="inline-start" className="pointer-events-none pl-4 text-muted-foreground">
                    <SearchIcon className="h-4 w-4" />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search work items, notes, assignee, or link"
                    className="h-11 rounded-full pr-4"
                  />
                </InputGroup>

                <div className="flex flex-wrap items-center gap-2">
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
                  {assigneeFilter !== 'all' ? (
                    <Badge variant="outline" className="rounded-full border-border/60 px-3 py-1.5">
                      Assignee: {getAssignedMemberName(assigneeFilter) || assigneeFilter}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
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
            <div className="vibe-panel border-dashed px-8 py-14 text-center">
              <h3 className="text-lg font-semibold text-foreground">No labor items match the current view</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Adjust your filters or clear the current search to bring labor items back into view.
              </p>
              {hasActiveFilters ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="mt-4 rounded-full border-border/70 bg-card"
                >
                  Reset filters
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMainAddForm(true)}
                  className="mt-4 rounded-full border-border/70 bg-card"
                >
                  Add labor item
                </Button>
              )}
            </div>
          ) : null}

          {filteredItems.length > 0 ? (
            <div className="mt-8 flex flex-wrap items-center justify-end gap-2">
              <Badge variant="secondary" className="rounded-full border border-border/60 bg-secondary/70 px-4 py-2 text-sm font-semibold">
                Visible total: {formatCurrency(visibleGrandTotal, project.currency)}
              </Badge>
            </div>
          ) : null}

          <LaborExportDialog
            exportOptions={exportOptions}
            isOpen={isExportModalOpen}
            isPending={isExporting}
            onClose={() => setIsExportModalOpen(false)}
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
            onExportOptionsChange={setExportOptions}
          />
        </div>
      </ProjectPageLayout>
    </TooltipProvider>
  );
}
