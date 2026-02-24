"use client";
/**
 * usePendingItems Hook
 * 
 * Manages pending AI suggestions and their confirmation/rejection flow.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import type {
  PendingItem,
  ChatHistoryEntry,
  BulkTaskData,
  BulkNoteData,
  BulkShoppingData,
  BulkLaborData,
  BulkSurveyData,
} from "../types";
import {
  sanitizeShoppingItemData,
  sanitizeContactData,
  extractSurveyData,
  extractBulkSelection,
  extractBulkUpdates,
  resolveSectionName,
} from "../utils";
import {
  hydratePendingItems,
  keepOnlyResolvedPendingItems,
  mergePendingItems,
  type PendingFunctionCall,
} from "./pendingItemsHydration";
import {
  areValuesEqual,
  extractLaborInput,
  extractShoppingInput,
  getFirstNonEmptyString,
  sanitizeProjectSettingsUpdates,
  toFiniteNumber,
} from "./pendingItemsHelpers";

interface UsePendingItemsProps {
  projectId: Id<"projects"> | undefined;
  teamSlug: string | undefined;
  threadId: string | undefined;
  autoConfirmCrud?: boolean;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryEntry[]>>;
}

interface UsePendingItemsReturn {
  pendingItems: PendingItem[];
  setPendingItems: React.Dispatch<React.SetStateAction<PendingItem[]>>;
  currentItemIndex: number;
  setCurrentItemIndex: (index: number) => void;
  isConfirmationDialogOpen: boolean;
  setIsConfirmationDialogOpen: (open: boolean) => void;
  showConfirmationGrid: boolean;
  setShowConfirmationGrid: (show: boolean) => void;
  isCreatingContent: boolean;
  isBulkProcessing: boolean;
  editingItemIndex: number | null;
  setEditingItemIndex: (index: number | null) => void;
  handleContentConfirm: () => Promise<void>;
  handleContentCancel: () => void;
  handleContentEdit: (updatedItem: { data: Record<string, unknown> }) => void;
  handleContentDialogClose: () => void;
  handleConfirmAll: () => Promise<void>;
  handleConfirmItem: (index: number | string) => Promise<void>;
  handleRejectItem: (index: number | string) => Promise<void>;
  handleRejectAll: () => Promise<void>;
  handleEditItem: (index: number | string) => void;
  handleUpdatePendingItem: (index: number | string, updates: Partial<PendingItem>) => void;
  resetPendingState: () => void;
}

export const usePendingItems = ({
  projectId,
  teamSlug,
  threadId,
  autoConfirmCrud = false,
  setChatHistory,
}: UsePendingItemsProps): UsePendingItemsReturn => {
  // State
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = useState(false);
  const [showConfirmationGrid, setShowConfirmationGrid] = useState(false);
  const [isCreatingContent, setIsCreatingContent] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const autoConfirmBatchKeyRef = useRef<string | null>(null);

  // Queries
  const pendingFunctionCalls = useQuery(
    apiAny.ai.threads.listPendingItems,
    threadId ? { threadId } : "skip"
  );

  const shoppingSections = useQuery(
    apiAny.shopping.getShoppingListSections,
    projectId ? { projectId } : "skip"
  );

  const laborSections = useQuery(
    apiAny.labor.getLaborSections,
    projectId ? { projectId } : "skip"
  );

  // Mutations
  const markFunctionCallsAsConfirmed = useMutation(apiAny.ai.threads.markFunctionCallsAsConfirmed);
  const deleteTask = useMutation(apiAny.tasks.deleteTask);
  const deleteNote = useMutation(apiAny.notes.deleteNote);
  const deleteShoppingItem = useMutation(apiAny.shopping.deleteShoppingListItem);
  const createShoppingSection = useMutation(apiAny.shopping.createShoppingListSection);
  const updateShoppingSection = useMutation(apiAny.shopping.updateShoppingListSection);
  const deleteShoppingSection = useMutation(apiAny.shopping.deleteShoppingListSection);
  const deleteSurvey = useMutation(apiAny.surveys.deleteSurvey);
  const deleteContact = useMutation(apiAny.contacts.deleteContact);
  const deleteLaborItem = useMutation(apiAny.labor.deleteLaborItem);
  const createLaborSection = useMutation(apiAny.labor.createLaborSection);
  const updateLaborSection = useMutation(apiAny.labor.updateLaborSection);
  const deleteLaborSection = useMutation(apiAny.labor.deleteLaborSection);
  const updateProjectSettings = useMutation(apiAny.projects.updateProject);

  // Actions
  const createConfirmedTask = useAction(apiAny.ai.confirmedActions.createConfirmedTask);
  const createConfirmedNote = useAction(apiAny.ai.confirmedActions.createConfirmedNote);
  const createConfirmedShoppingItem = useAction(apiAny.ai.confirmedActions.createConfirmedShoppingItem);
  const createConfirmedSurvey = useAction(apiAny.ai.confirmedActions.createConfirmedSurvey);
  const createConfirmedContact = useAction(apiAny.ai.confirmedActions.createConfirmedContact);
  const editConfirmedTask = useAction(apiAny.ai.confirmedActions.editConfirmedTask);
  const editConfirmedNote = useAction(apiAny.ai.confirmedActions.editConfirmedNote);
  const editConfirmedShoppingItem = useAction(apiAny.ai.confirmedActions.editConfirmedShoppingItem);
  const editConfirmedSurvey = useAction(apiAny.ai.confirmedActions.editConfirmedSurvey);
  const bulkEditConfirmedTasks = useAction(apiAny.ai.actions.bulkEditConfirmedTasks);
  const createConfirmedLaborItem = useAction(apiAny.ai.confirmedActions.createConfirmedLaborItem);
  const editConfirmedLaborItem = useAction(apiAny.ai.confirmedActions.editConfirmedLaborItem);

  // Load pending items from DB
  useEffect(() => {
    // Hard reset local confirmation state when there is no active thread.
    if (!threadId) {
      setPendingItems((prev) => (prev.length === 0 ? prev : []));
      setCurrentItemIndex((prev) => (prev === 0 ? prev : 0));
      setShowConfirmationGrid((prev) => (prev ? false : prev));
      setIsConfirmationDialogOpen((prev) => (prev ? false : prev));
      return;
    }

    if (pendingFunctionCalls && pendingFunctionCalls.length > 0) {
      const hydratedPendingItems = hydratePendingItems(
        pendingFunctionCalls as PendingFunctionCall[],
      );

      if (hydratedPendingItems.length > 0) {
        setPendingItems((prev) => mergePendingItems(prev, hydratedPendingItems));
        setCurrentItemIndex((prev) => (prev === 0 ? prev : 0));

        // Don't auto-open dialogs - let inline confirmations in StreamingMessage handle display
        // Dialogs can still be opened manually if needed
        setShowConfirmationGrid((prev) => (prev ? false : prev));
        setIsConfirmationDialogOpen((prev) => (prev ? false : prev));
      }
    } else if (pendingFunctionCalls && pendingFunctionCalls.length === 0) {
      // If server returns empty, keep only resolved items (receipts), remove any stale pending ones
      setPendingItems((prev) => keepOnlyResolvedPendingItems(prev));

      // Close dialogs if they were open (optional, but good UX if the item we were acting on is gone)
      setShowConfirmationGrid((prev) => (prev ? false : prev));
      setIsConfirmationDialogOpen((prev) => (prev ? false : prev));
    }
  }, [threadId, pendingFunctionCalls]);

  const scheduleResolvedRemoval = useCallback((clientId?: string) => {
    // Intentionally left blank - keep resolved items visible in the UI.
    void clientId;
  }, []);

  // Helper functions
  const resolveTeamSlug = useCallback(() => {
    return teamSlug || undefined;
  }, [teamSlug]);

  const resolvePendingTargetId = useCallback(
    (item: PendingItem, keys: string[]): string | undefined => {
      const originalItem = (item.originalItem ?? {}) as Record<string, unknown>;
      const data = (item.data ?? {}) as Record<string, unknown>;

      if (typeof originalItem._id === "string" && originalItem._id.trim().length > 0) {
        return originalItem._id;
      }

      for (const key of keys) {
        const dataValue = data[key];
        if (typeof dataValue === "string" && dataValue.trim().length > 0) {
          return dataValue;
        }

        const originalValue = originalItem[key];
        if (typeof originalValue === "string" && originalValue.trim().length > 0) {
          return originalValue;
        }
      }

      return undefined;
    },
    [],
  );

  const findOrCreateSection = useCallback(async (sectionName: string): Promise<Id<"shoppingListSections"> | undefined> => {
    if (!sectionName || !projectId) return undefined;

    const existingSection = shoppingSections?.find(
      (s) => s.name.toLowerCase() === sectionName.toLowerCase()
    );

    if (existingSection) {
      return existingSection._id;
    }

    try {
      const newSectionId = await createShoppingSection({
        projectId,
        name: sectionName,
      });
      return newSectionId;
    } catch (error) {
      console.error("Failed to create section:", error);
      return undefined;
    }
  }, [projectId, shoppingSections, createShoppingSection]);

  const findOrCreateLaborSection = useCallback(async (sectionName: string): Promise<Id<"laborSections"> | undefined> => {
    if (!sectionName || !projectId) return undefined;

    const existingSection = laborSections?.find(
      (s) => s.name.toLowerCase() === sectionName.toLowerCase()
    );

    if (existingSection) {
      return existingSection._id;
    }

    try {
      const newSectionId = await createLaborSection({
        projectId,
        name: sectionName,
      });
      return newSectionId;
    } catch (error) {
      console.error("Failed to create labor section:", error);
      return undefined;
    }
  }, [projectId, laborSections, createLaborSection]);

  // Confirm single item helper
  const confirmSingleItem = useCallback(async (item: PendingItem) => {
    if (!projectId) throw new Error("No project available");

    let result;

    if (item.operation === 'bulk_create') {
      switch (item.type) {
        case 'create_multiple_tasks':
        case 'task': {
          const data = item.data as BulkTaskData;
          const tasks = Array.isArray(data.tasks) ? data.tasks : [];

          if (tasks.length === 0) {
            throw new Error("No tasks provided for bulk creation");
          }

          const createdIds: string[] = [];
          const errors: string[] = [];

          for (const taskData of tasks) {
            try {
              const cleanTaskData = { ...taskData };
              delete (cleanTaskData as Record<string, unknown>).assignedToName;

              const taskResult = await createConfirmedTask({
                projectId,
                taskData: cleanTaskData as {
                  title: string;
                  status?: 'todo' | 'in_progress' | 'review' | 'done';
                  description?: string;
                  assignedTo?: string | null;
                  priority?: 'low' | 'medium' | 'high' | 'urgent';
                  startDate?: string;
                  endDate?: string;
                  tags?: string[];
                },
              });

              if (taskResult.success && taskResult.taskId) {
                createdIds.push(taskResult.taskId);
              } else if (!taskResult.success) {
                errors.push(taskResult.message);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              errors.push(message);
            }
          }

          result = {
            success: errors.length === 0,
            message: `Created ${createdIds.length}/${tasks.length} tasks successfully${errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
              }`,
          };
          break;
        }
        case 'create_multiple_notes':
        case 'note': {
          const data = item.data as BulkNoteData;
          const notes = Array.isArray(data.notes) ? data.notes : [];

          if (notes.length === 0) {
            throw new Error("No notes provided for bulk creation");
          }

          const createdIds: string[] = [];
          const errors: string[] = [];

          for (const noteData of notes) {
            try {
              const noteResult = await createConfirmedNote({
                projectId,
                noteData: noteData as { title: string; content: string },
              });

              if (noteResult.success && noteResult.noteId) {
                createdIds.push(noteResult.noteId);
              } else if (!noteResult.success) {
                errors.push(noteResult.message);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              errors.push(message);
            }
          }

          result = {
            success: errors.length === 0,
            message: `Created ${createdIds.length}/${notes.length} notes successfully${errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
              }`,
          };
          break;
        }
        case 'create_multiple_shopping_items':
        case 'shopping': {
          const data = item.data as BulkShoppingData;
          const items = Array.isArray(data.items) ? data.items : [];

          if (items.length === 0) {
            throw new Error("No shopping items provided for bulk creation");
          }

          const createdIds: string[] = [];
          const errors: string[] = [];

          // Pre-create sections
          const uniqueSectionNames = new Set<string>();
          for (const rawShoppingData of items) {
            const shoppingData = extractShoppingInput(rawShoppingData);
            const targetSectionName = resolveSectionName(
              shoppingData.sectionName,
              shoppingData.category,
            );
            if (targetSectionName && !shoppingData.sectionId) {
              uniqueSectionNames.add(targetSectionName);
            }
          }

          const sectionNameToId = new Map<string, Id<"shoppingListSections">>();
          for (const sectionName of uniqueSectionNames) {
            const sectionId = await findOrCreateSection(sectionName);
            if (sectionId) {
              sectionNameToId.set(sectionName, sectionId);
            }
          }

          for (const rawShoppingData of items) {
            try {
              const shoppingData = extractShoppingInput(rawShoppingData);
              const { sectionName, ...shoppingItemData } = shoppingData;
              const targetSectionName = resolveSectionName(sectionName, shoppingData.category);

              if (targetSectionName && !shoppingItemData.sectionId) {
                const sectionId = sectionNameToId.get(targetSectionName);
                if (sectionId) {
                  shoppingItemData.sectionId = sectionId;
                }
              }

              const sanitizedItemData = sanitizeShoppingItemData(shoppingItemData as Record<string, unknown>);
              const normalizedName =
                typeof sanitizedItemData.name === "string"
                  ? sanitizedItemData.name.trim()
                  : "";
              if (normalizedName.length === 0) {
                errors.push("Skipped shopping item without a name");
                continue;
              }

              const normalizedQuantity = toFiniteNumber(sanitizedItemData.quantity);
              const normalizedUnitPrice = toFiniteNumber(sanitizedItemData.unitPrice);
              const normalizedTotalPrice = toFiniteNumber(sanitizedItemData.totalPrice);
              sanitizedItemData.name = normalizedName;
              sanitizedItemData.quantity = normalizedQuantity ?? 1;
              if (normalizedUnitPrice !== undefined) {
                sanitizedItemData.unitPrice = normalizedUnitPrice;
              }
              if (normalizedTotalPrice !== undefined) {
                sanitizedItemData.totalPrice = normalizedTotalPrice;
              }

              const shoppingResult = await createConfirmedShoppingItem({
                projectId,
                itemData: sanitizedItemData as {
                  name: string;
                  quantity: number;
                  notes?: string;
                  priority?: 'low' | 'medium' | 'high' | 'urgent';
                  buyBefore?: string;
                  supplier?: string;
                  category?: string;
                  unitPrice?: number;
                  sectionId?: Id<'shoppingListSections'>;
                },
              });

              if (shoppingResult.success && shoppingResult.itemId) {
                createdIds.push(shoppingResult.itemId);
              } else if (!shoppingResult.success) {
                errors.push(shoppingResult.message);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              errors.push(message);
            }
          }

          result = {
            success: errors.length === 0,
            message: `Created ${createdIds.length}/${items.length} shopping items successfully${errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
              }`,
          };
          break;
        }
        case 'create_multiple_surveys':
        case 'create_survey':
        case 'survey': {
          const data = item.data as BulkSurveyData;
          const surveys = Array.isArray(data.surveys) ? data.surveys : [];

          if (surveys.length === 0) {
            throw new Error("No surveys provided for bulk creation");
          }

          const createdIds: string[] = [];
          const errors: string[] = [];

          for (const surveyData of surveys) {
            try {
              const surveyResult = await createConfirmedSurvey({
                projectId,
                surveyData: extractSurveyData(surveyData as Record<string, unknown>),
              });

              if (surveyResult.success && surveyResult.surveyId) {
                createdIds.push(surveyResult.surveyId);
              } else if (!surveyResult.success) {
                errors.push(surveyResult.message);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              errors.push(message);
            }
          }

          result = {
            success: errors.length === 0,
            message: `Created ${createdIds.length}/${surveys.length} surveys successfully${errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
              }`,
          };
          break;
        }
        case 'create_contact':
        case 'contact': {
          const contacts = Array.isArray(
            (item.data as { contacts?: Array<Record<string, unknown>> }).contacts
          )
            ? ((item.data as { contacts?: Array<Record<string, unknown>> }).contacts as Array<Record<string, unknown>>)
            : [];

          if (contacts.length === 0) {
            throw new Error("No contacts provided for bulk creation");
          }

          const slug = resolveTeamSlug();
          if (!slug) {
            throw new Error("Missing team slug for contact creation");
          }

          const createdIds: string[] = [];
          const errors: string[] = [];

          for (const contact of contacts) {
            try {
              const contactResult = await createConfirmedContact({
                teamSlug: slug,
                contactData: sanitizeContactData(contact),
              });

              if (contactResult.success && contactResult.contactId) {
                createdIds.push(contactResult.contactId);
              } else if (!contactResult.success) {
                errors.push(contactResult.message);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              errors.push(message);
            }
          }

          result = {
            success: errors.length === 0,
            message: `Created ${createdIds.length}/${contacts.length} contacts successfully${errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
              }`,
          };
          break;
        }
        case 'labor': {
          const data = item.data as BulkLaborData;
          const items = Array.isArray(data.items) ? data.items : [];

          if (items.length === 0) {
            throw new Error("No labor items provided for bulk creation");
          }

          const createdIds: string[] = [];
          const errors: string[] = [];

          // Pre-create sections
          const uniqueSectionNames = new Set<string>();
          for (const rawLaborData of items) {
            const laborData = extractLaborInput(rawLaborData);
            const targetSectionName = getFirstNonEmptyString(laborData.sectionName);
            if (targetSectionName && !laborData.sectionId) {
              uniqueSectionNames.add(targetSectionName);
            }
          }

          const sectionNameToId = new Map<string, Id<"laborSections">>();
          for (const sectionName of uniqueSectionNames) {
            const sectionId = await findOrCreateLaborSection(sectionName);
            if (sectionId) {
              sectionNameToId.set(sectionName, sectionId);
            }
          }

          for (const rawLaborData of items) {
            try {
              const laborData = extractLaborInput(rawLaborData);
              const { sectionName, ...laborItemData } = laborData;
              const targetSectionName = getFirstNonEmptyString(sectionName);

              if (targetSectionName && !laborItemData.sectionId) {
                const sectionId = sectionNameToId.get(targetSectionName);
                if (sectionId) {
                  laborItemData.sectionId = sectionId;
                }
              }

              const normalizedName = getFirstNonEmptyString(laborItemData.name);
              if (!normalizedName) {
                errors.push("Skipped labor item without a name");
                continue;
              }
              const normalizedQuantity = toFiniteNumber(laborItemData.quantity) ?? 1;
              const normalizedUnitPrice = toFiniteNumber(laborItemData.unitPrice);
              const normalizedUnit = getFirstNonEmptyString(laborItemData.unit);
              const normalizedNotes = getFirstNonEmptyString(laborItemData.notes);
              const normalizedAssignedTo = getFirstNonEmptyString(laborItemData.assignedTo);

              const laborResult = await createConfirmedLaborItem({
                projectId,
                itemData: {
                  name: normalizedName,
                  quantity: normalizedQuantity,
                  unit: normalizedUnit,
                  notes: normalizedNotes,
                  unitPrice: normalizedUnitPrice,
                  sectionId: laborItemData.sectionId,
                  assignedTo: normalizedAssignedTo,
                },
              });

              if (laborResult.success && laborResult.itemId) {
                createdIds.push(laborResult.itemId);
              } else if (!laborResult.success) {
                errors.push(laborResult.message);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              errors.push(message);
            }
          }

          result = {
            success: errors.length === 0,
            message: `Created ${createdIds.length}/${items.length} labor items successfully${errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
              }`,
          };
          break;
        }
        case 'shoppingSection': {
          const rawData = item.data as Record<string, unknown>;
          const rawItems = Array.isArray(rawData.items)
            ? (rawData.items as Array<Record<string, unknown>>)
            : [];
          const namesFromItems = rawItems
            .map((entry) => (typeof entry.name === "string" ? entry.name.trim() : ""))
            .filter((name) => name.length > 0);
          const singleName = typeof rawData.name === "string" ? rawData.name.trim() : "";
          const sectionNames = Array.from(new Set(
            (namesFromItems.length > 0 ? namesFromItems : [singleName]).filter((name) => name.length > 0)
          ));

          if (sectionNames.length === 0) {
            throw new Error("No shopping sections provided for bulk creation");
          }

          const resolvedIds: string[] = [];
          const errors: string[] = [];

          for (const sectionName of sectionNames) {
            try {
              const sectionId = await findOrCreateSection(sectionName);
              if (sectionId) {
                resolvedIds.push(sectionId);
              } else {
                errors.push(`Failed to create or resolve shopping section "${sectionName}"`);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              errors.push(message);
            }
          }

          result = {
            success: errors.length === 0,
            message: `Processed ${resolvedIds.length}/${sectionNames.length} shopping sections${errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
              }`,
          };
          break;
        }
        case 'laborSection': {
          const rawData = item.data as Record<string, unknown>;
          const rawItems = Array.isArray(rawData.items)
            ? (rawData.items as Array<Record<string, unknown>>)
            : [];
          const namesFromItems = rawItems
            .map((entry) => (typeof entry.name === "string" ? entry.name.trim() : ""))
            .filter((name) => name.length > 0);
          const singleName = typeof rawData.name === "string" ? rawData.name.trim() : "";
          const sectionNames = Array.from(new Set(
            (namesFromItems.length > 0 ? namesFromItems : [singleName]).filter((name) => name.length > 0)
          ));

          if (sectionNames.length === 0) {
            throw new Error("No labor sections provided for bulk creation");
          }

          const resolvedIds: string[] = [];
          const errors: string[] = [];

          for (const sectionName of sectionNames) {
            try {
              const sectionId = await findOrCreateLaborSection(sectionName);
              if (sectionId) {
                resolvedIds.push(sectionId);
              } else {
                errors.push(`Failed to create or resolve labor section "${sectionName}"`);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              errors.push(message);
            }
          }

          result = {
            success: errors.length === 0,
            message: `Processed ${resolvedIds.length}/${sectionNames.length} labor sections${errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
              }`,
          };
          break;
        }
        default:
          throw new Error(`Unsupported bulk create type: ${item.type}`);
      }
    } else if (item.operation === 'delete') {
      switch (item.type) {
        case 'task': {
          // Support both legacy format (taskId) and new format (itemId)
          const taskId = (item.data.taskId ?? item.data.itemId) as Id<"tasks">;
          if (!taskId) {
            throw new Error("Missing taskId or itemId for task deletion");
          }
          await deleteTask({ taskId });
          result = { success: true, message: "Task deleted successfully" };
          break;
        }
        case 'note': {
          // Support both legacy format (noteId) and new format (itemId)
          const noteId = (item.data.noteId ?? item.data.itemId) as Id<"notes">;
          if (!noteId) {
            throw new Error("Missing noteId or itemId for note deletion");
          }
          await deleteNote({ noteId });
          result = { success: true, message: "Note deleted successfully" };
          break;
        }
        case 'shopping': {
          // itemId is consistent across both formats
          const itemId = item.data.itemId as Id<"shoppingListItems">;
          if (!itemId) {
            throw new Error("Missing itemId for shopping item deletion");
          }
          await deleteShoppingItem({ itemId });
          result = { success: true, message: "Shopping item deleted successfully" };
          break;
        }
        case 'shoppingSection': {
          const sectionId = item.data.sectionId as Id<"shoppingListSections">;
          if (!sectionId) {
            throw new Error("Missing sectionId for shopping section deletion");
          }
          await deleteShoppingSection({ sectionId });
          result = { success: true, message: "Shopping section deleted successfully" };
          break;
        }
        case 'survey': {
          // Support both legacy format (surveyId) and new format (itemId)
          const surveyId = (item.data.surveyId ?? item.data.itemId) as Id<"surveys">;
          if (!surveyId) {
            throw new Error("Missing surveyId or itemId for survey deletion");
          }
          await deleteSurvey({ surveyId });
          result = { success: true, message: "Survey deleted successfully" };
          break;
        }
        case 'contact': {
          // Support both legacy format (contactId) and new format (itemId)
          const contactId = (item.data.contactId ?? item.data.itemId) as Id<"contacts">;
          if (!contactId) {
            throw new Error("Missing contactId or itemId for contact deletion");
          }
          await deleteContact({ contactId });
          result = { success: true, message: "Contact deleted successfully" };
          break;
        }
        case 'labor': {
          // itemId is consistent across both formats
          const itemId = item.data.itemId as Id<"laborItems">;
          if (!itemId) {
            throw new Error("Missing itemId for labor item deletion");
          }
          await deleteLaborItem({ itemId });
          result = { success: true, message: "Labor item deleted successfully" };
          break;
        }
        case 'laborSection': {
          const sectionId = item.data.sectionId as Id<"laborSections">;
          if (!sectionId) {
            throw new Error("Missing sectionId for labor section deletion");
          }
          await deleteLaborSection({ sectionId });
          result = { success: true, message: "Labor section deleted successfully" };
          break;
        }
        default:
          throw new Error(`Unknown content type for deletion: ${item.type}`);
      }
    } else if (item.operation === 'edit' || item.operation === 'bulk_edit') {
      const isBulkEdit = item.operation === 'bulk_edit';
      const bulkItems = Array.isArray((item.data as { items?: unknown })?.items)
        ? ((item.data as { items: Array<Record<string, unknown>> }).items)
        : [];

      switch (item.type) {
        case 'task': {
          if (isBulkEdit) {
            const selection = extractBulkSelection(item);
            const updates = extractBulkUpdates(item);

            if (Object.keys(updates).length > 0) {
              result = await bulkEditConfirmedTasks({
                projectId,
                selection,
                updates: updates as {
                  title?: string;
                  description?: string;
                  status?: 'todo' | 'in_progress' | 'review' | 'done';
                  priority?: 'low' | 'medium' | 'high' | 'urgent';
                  assignedTo?: string | null;
                  tags?: string[];
                },
                reason: selection.reason,
              });
              break;
            }

            const taskEdits = Array.isArray(item.data?.tasks)
              ? (item.data.tasks as Array<Record<string, unknown>>)
              : bulkItems;

            if (taskEdits.length === 0) {
              throw new Error("No tasks provided for bulk edit");
            }

            let updatedCount = 0;
            const errors: string[] = [];

            for (const taskUpdate of taskEdits) {
              try {
                const candidateItem: PendingItem = {
                  ...item,
                  data: taskUpdate,
                  originalItem: isPlainObject(taskUpdate.originalItem)
                    ? (taskUpdate.originalItem as Record<string, unknown>)
                    : item.originalItem,
                };
                const taskId = resolvePendingTargetId(candidateItem, ["taskId", "itemId"]);
                if (!taskId) {
                  errors.push("Skipped task edit without taskId");
                  continue;
                }

                const rawUpdates = isPlainObject(taskUpdate.updates)
                  ? (taskUpdate.updates as Record<string, unknown>)
                  : taskUpdate;
                const cleanUpdates = { ...rawUpdates };
                delete cleanUpdates.assignedToName;
                delete cleanUpdates.taskId;
                delete cleanUpdates.itemId;
                delete cleanUpdates.originalItem;
                delete cleanUpdates.updates;

                const editResult = await editConfirmedTask({
                  projectId,
                  taskId: taskId as Id<"tasks">,
                  updates: cleanUpdates as {
                    title?: string;
                    description?: string;
                    content?: string;
                    status?: 'todo' | 'in_progress' | 'review' | 'done';
                    assignedTo?: string | null;
                    priority?: 'low' | 'medium' | 'high' | 'urgent';
                    startDate?: string;
                    endDate?: string;
                    tags?: string[];
                  },
                });

                if (editResult.success) {
                  updatedCount++;
                } else {
                  errors.push(editResult.message);
                }
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                errors.push(message);
              }
            }

            result = {
              success: errors.length === 0,
              message: errors.length === 0
                ? `Updated ${updatedCount}/${taskEdits.length} tasks successfully`
                : `Updated ${updatedCount}/${taskEdits.length} tasks with errors: ${errors.slice(0, 3).join(', ')}`,
            };
            break;
          }

          const cleanUpdates = { ...(item.updates as Record<string, unknown>) };
          delete cleanUpdates.assignedToName;
          const taskId = resolvePendingTargetId(item, ["taskId", "itemId"]);
          if (!taskId) {
            throw new Error("Missing taskId for task edit");
          }

          result = await editConfirmedTask({
            projectId,
            taskId: taskId as Id<"tasks">,
            updates: cleanUpdates
          });
          break;
        }
        case 'note': {
          if (isBulkEdit) {
            if (bulkItems.length === 0) {
              throw new Error("No notes provided for bulk edit");
            }

            let updatedCount = 0;
            const errors: string[] = [];

            for (const noteUpdate of bulkItems) {
              try {
                const candidateItem: PendingItem = {
                  ...item,
                  data: noteUpdate,
                  originalItem: isPlainObject(noteUpdate.originalItem)
                    ? (noteUpdate.originalItem as Record<string, unknown>)
                    : item.originalItem,
                };
                const noteId = resolvePendingTargetId(candidateItem, ["noteId", "itemId"]);
                if (!noteId) {
                  errors.push("Skipped note edit without noteId");
                  continue;
                }
                const rawUpdates = isPlainObject(noteUpdate.updates)
                  ? (noteUpdate.updates as Record<string, unknown>)
                  : noteUpdate;
                const updates = {
                  title: typeof rawUpdates.title === "string" ? rawUpdates.title : undefined,
                  content: typeof rawUpdates.content === "string" ? rawUpdates.content : undefined,
                };

                const editResult = await editConfirmedNote({
                  projectId,
                  noteId: noteId as Id<"notes">,
                  updates,
                });

                if (editResult.success) {
                  updatedCount++;
                } else {
                  errors.push(editResult.message);
                }
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                errors.push(message);
              }
            }

            result = {
              success: errors.length === 0,
              message: errors.length === 0
                ? `Updated ${updatedCount}/${bulkItems.length} notes successfully`
                : `Updated ${updatedCount}/${bulkItems.length} notes with errors: ${errors.slice(0, 3).join(', ')}`,
            };
            break;
          }

          const noteId = resolvePendingTargetId(item, ["noteId", "itemId"]);
          if (!noteId) {
            throw new Error("Missing noteId for note edit");
          }
          result = await editConfirmedNote({
            projectId,
            noteId: noteId as Id<"notes">,
            updates: item.updates as Record<string, unknown>
          });
          break;
        }
        case 'shopping': {
          if (isBulkEdit) {
            if (bulkItems.length === 0) {
              throw new Error("No shopping items provided for bulk edit");
            }

            let updatedCount = 0;
            const errors: string[] = [];

            for (const shoppingUpdate of bulkItems) {
              try {
                const candidateItem: PendingItem = {
                  ...item,
                  data: shoppingUpdate,
                  originalItem: isPlainObject(shoppingUpdate.originalItem)
                    ? (shoppingUpdate.originalItem as Record<string, unknown>)
                    : item.originalItem,
                };
                const shoppingItemId = resolvePendingTargetId(candidateItem, ["itemId"]);
                if (!shoppingItemId) {
                  errors.push("Skipped shopping edit without itemId");
                  continue;
                }

                const rawUpdates = isPlainObject(shoppingUpdate.updates)
                  ? (shoppingUpdate.updates as Record<string, unknown>)
                  : shoppingUpdate;
                const updates = { ...rawUpdates };
                delete updates.itemId;
                delete updates.originalItem;
                delete updates.updates;
                const fallbackCategory =
                  updates["category"] ??
                  (candidateItem.data ? (candidateItem.data as Record<string, unknown>)["category"] : undefined);
                const targetSectionName = resolveSectionName(updates["sectionName"], fallbackCategory);

                if (targetSectionName && !updates["sectionId"]) {
                  const sectionId = await findOrCreateSection(targetSectionName);
                  if (sectionId) {
                    updates["sectionId"] = sectionId;
                  }
                }

                delete updates["sectionName"];
                const sanitizedUpdates = sanitizeShoppingItemData(updates);

                const editResult = await editConfirmedShoppingItem({
                  projectId,
                  itemId: shoppingItemId as Id<"shoppingListItems">,
                  updates: sanitizedUpdates,
                });

                if (editResult.success) {
                  updatedCount++;
                } else {
                  errors.push(editResult.message);
                }
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                errors.push(message);
              }
            }

            result = {
              success: errors.length === 0,
              message: errors.length === 0
                ? `Updated ${updatedCount}/${bulkItems.length} shopping items successfully`
                : `Updated ${updatedCount}/${bulkItems.length} shopping items with errors: ${errors.slice(0, 3).join(', ')}`,
            };
            break;
          }

          const updates = { ...(item.updates as Record<string, unknown>) };
          const fallbackCategory =
            updates["category"] ?? (item.data ? (item.data as Record<string, unknown>)["category"] : undefined);
          const targetSectionName = resolveSectionName(updates["sectionName"], fallbackCategory);

          if (targetSectionName && !updates["sectionId"]) {
            const sectionId = await findOrCreateSection(targetSectionName);
            if (sectionId) {
              updates["sectionId"] = sectionId;
            }
          }

          delete updates["sectionName"];
          const sanitizedUpdates = sanitizeShoppingItemData(updates);
          const shoppingItemId = resolvePendingTargetId(item, ["itemId"]);
          if (!shoppingItemId) {
            throw new Error("Missing itemId for shopping item edit");
          }

          result = await editConfirmedShoppingItem({
            projectId,
            itemId: shoppingItemId as Id<"shoppingListItems">,
            updates: sanitizedUpdates,
          });
          break;
        }
        case 'shoppingSection':
          await updateShoppingSection({
            sectionId: item.originalItem?._id as Id<"shoppingListSections">,
            name: item.data.name as string,
          });
          result = { success: true, message: "Shopping section updated successfully" };
          break;
        case 'survey': {
          if (isBulkEdit) {
            if (bulkItems.length === 0) {
              throw new Error("No surveys provided for bulk edit");
            }

            let updatedCount = 0;
            const errors: string[] = [];

            for (const surveyUpdate of bulkItems) {
              try {
                const candidateItem: PendingItem = {
                  ...item,
                  data: surveyUpdate,
                  originalItem: isPlainObject(surveyUpdate.originalItem)
                    ? (surveyUpdate.originalItem as Record<string, unknown>)
                    : item.originalItem,
                };
                const surveyId = resolvePendingTargetId(candidateItem, ["surveyId", "itemId"]);
                if (!surveyId) {
                  errors.push("Skipped survey edit without surveyId");
                  continue;
                }

                const rawUpdates = isPlainObject(surveyUpdate.updates)
                  ? (surveyUpdate.updates as Record<string, unknown>)
                  : surveyUpdate;
                const updates = { ...rawUpdates };
                delete updates.itemId;
                delete updates.surveyId;
                delete updates.originalItem;
                delete updates.updates;

                const editResult = await editConfirmedSurvey({
                  projectId,
                  surveyId: surveyId as Id<"surveys">,
                  updates,
                });

                if (editResult.success) {
                  updatedCount++;
                } else {
                  errors.push(editResult.message);
                }
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                errors.push(message);
              }
            }

            result = {
              success: errors.length === 0,
              message: errors.length === 0
                ? `Updated ${updatedCount}/${bulkItems.length} surveys successfully`
                : `Updated ${updatedCount}/${bulkItems.length} surveys with errors: ${errors.slice(0, 3).join(', ')}`,
            };
            break;
          }

          const surveyId = resolvePendingTargetId(item, ["surveyId", "itemId"]);
          if (!surveyId) {
            throw new Error("Missing surveyId for survey edit");
          }
          result = await editConfirmedSurvey({
            projectId,
            surveyId: surveyId as Id<"surveys">,
            updates: item.updates as Record<string, unknown>
          });
          break;
        }
        case 'labor': {
          if (isBulkEdit) {
            if (bulkItems.length === 0) {
              throw new Error("No labor items provided for bulk edit");
            }

            let updatedCount = 0;
            const errors: string[] = [];

            for (const laborUpdate of bulkItems) {
              try {
                const candidateItem: PendingItem = {
                  ...item,
                  data: laborUpdate,
                  originalItem: isPlainObject(laborUpdate.originalItem)
                    ? (laborUpdate.originalItem as Record<string, unknown>)
                    : item.originalItem,
                };
                const laborItemId = resolvePendingTargetId(candidateItem, ["itemId"]);
                if (!laborItemId) {
                  errors.push("Skipped labor edit without itemId");
                  continue;
                }

                const rawUpdates = isPlainObject(laborUpdate.updates)
                  ? (laborUpdate.updates as Record<string, unknown>)
                  : laborUpdate;
                const laborUpdates = { ...rawUpdates };
                delete laborUpdates.itemId;
                delete laborUpdates.originalItem;
                delete laborUpdates.updates;
                const targetSectionName = laborUpdates["sectionName"] as string | undefined;

                if (targetSectionName && !laborUpdates["sectionId"]) {
                  const sectionId = await findOrCreateLaborSection(targetSectionName);
                  if (sectionId) {
                    laborUpdates["sectionId"] = sectionId;
                  }
                }

                delete laborUpdates["sectionName"];

                const editResult = await editConfirmedLaborItem({
                  projectId,
                  itemId: laborItemId as Id<"laborItems">,
                  updates: laborUpdates,
                });

                if (editResult.success) {
                  updatedCount++;
                } else {
                  errors.push(editResult.message);
                }
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                errors.push(message);
              }
            }

            result = {
              success: errors.length === 0,
              message: errors.length === 0
                ? `Updated ${updatedCount}/${bulkItems.length} labor items successfully`
                : `Updated ${updatedCount}/${bulkItems.length} labor items with errors: ${errors.slice(0, 3).join(', ')}`,
            };
            break;
          }

          const laborUpdates = { ...(item.updates as Record<string, unknown>) };
          const targetSectionName = laborUpdates["sectionName"] as string | undefined;

          if (targetSectionName && !laborUpdates["sectionId"]) {
            const sectionId = await findOrCreateLaborSection(targetSectionName);
            if (sectionId) {
              laborUpdates["sectionId"] = sectionId;
            }
          }

          delete laborUpdates["sectionName"];
          const laborItemId = resolvePendingTargetId(item, ["itemId"]);
          if (!laborItemId) {
            throw new Error("Missing itemId for labor item edit");
          }

          result = await editConfirmedLaborItem({
            projectId,
            itemId: laborItemId as Id<"laborItems">,
            updates: laborUpdates,
          });
          break;
        }
        case 'laborSection':
          await updateLaborSection({
            sectionId: item.originalItem?._id as Id<"laborSections">,
            name: item.data.name as string,
          });
          result = { success: true, message: "Labor section updated successfully" };
          break;
        case 'projectSettings': {
          const source = isPlainObject(item.updates)
            ? item.updates
            : isPlainObject(item.data)
              ? item.data
              : {};
          const updates = sanitizeProjectSettingsUpdates(source);
          if (Object.keys(updates).length === 0) {
            throw new Error("No valid project settings changes were provided");
          }

          await updateProjectSettings({
            projectId,
            ...updates,
          });
          result = { success: true, message: "Project settings updated successfully" };
          break;
        }
        default:
          throw new Error(`Unknown content type for editing: ${item.type}`);
      }
    } else {
      // Create operations
      switch (item.type) {
        case 'task':
        case 'create_task':
          const cleanTaskData = { ...(item.data as Record<string, unknown>) };
          delete cleanTaskData.assignedToName;
          result = await createConfirmedTask({
            projectId,
            taskData: cleanTaskData as {
              title: string;
              status?: 'todo' | 'in_progress' | 'review' | 'done';
              description?: string;
              assignedTo?: string | null;
              priority?: 'low' | 'medium' | 'high' | 'urgent';
              startDate?: string;
              endDate?: string;
              tags?: string[];
            },
          });
          break;
        case 'create_multiple_notes':
        case 'create_note':
        case 'note':
          result = await createConfirmedNote({
            projectId,
            noteData: item.data as { title: string; content: string }
          });
          break;
        case 'create_multiple_shopping_items':
        case 'create_shopping_item':
        case 'shopping': {
          const rawShoppingData = extractShoppingInput(item.data);
          const { sectionName, ...shoppingItemData } = rawShoppingData;
          const targetSectionName = resolveSectionName(sectionName, rawShoppingData.category);

          if (targetSectionName && !shoppingItemData.sectionId) {
            const sectionId = await findOrCreateSection(targetSectionName);
            if (sectionId) {
              shoppingItemData.sectionId = sectionId;
            }
          }

          const sanitizedItemData = sanitizeShoppingItemData(shoppingItemData);
          const normalizedName =
            typeof sanitizedItemData.name === "string"
              ? sanitizedItemData.name.trim()
              : "";
          if (normalizedName.length === 0) {
            result = {
              success: false,
              message: "Shopping item is missing name. Edit it and try again.",
            };
            break;
          }

          const normalizedQuantity = toFiniteNumber(sanitizedItemData.quantity);
          const normalizedUnitPrice = toFiniteNumber(sanitizedItemData.unitPrice);
          const normalizedTotalPrice = toFiniteNumber(sanitizedItemData.totalPrice);
          sanitizedItemData.name = normalizedName;
          sanitizedItemData.quantity = normalizedQuantity ?? 1;
          if (normalizedUnitPrice !== undefined) {
            sanitizedItemData.unitPrice = normalizedUnitPrice;
          }
          if (normalizedTotalPrice !== undefined) {
            sanitizedItemData.totalPrice = normalizedTotalPrice;
          }

          result = await createConfirmedShoppingItem({
            projectId,
            itemData: sanitizedItemData as {
              name: string;
              quantity: number;
              notes?: string;
              priority?: "low" | "medium" | "high" | "urgent";
              buyBefore?: string;
              supplier?: string;
              category?: string;
              unitPrice?: number;
              sectionId?: Id<"shoppingListSections">;
            },
          });
          break;
        }
        case 'shoppingSection':
          await createShoppingSection({
            projectId,
            name: item.data.name as string,
          });
          result = { success: true, message: "Shopping section created successfully" };
          break;
        case 'create_multiple_surveys':
        case 'create_survey':
        case 'survey':
          result = await createConfirmedSurvey({
            projectId,
            surveyData: extractSurveyData(item.data)
          });
          break;
        case 'contact':
        case 'create_contact': {
          const slug = resolveTeamSlug();
          if (!slug) {
            throw new Error("Missing team slug for contact creation");
          }
          result = await createConfirmedContact({
            teamSlug: slug,
            contactData: sanitizeContactData(item.data),
          });
          break;
        }
        case 'labor': {
          const rawLaborData = extractLaborInput(item.data);
          const { sectionName, ...laborItemData } = rawLaborData;
          const targetSectionName = getFirstNonEmptyString(sectionName);

          if (targetSectionName && !laborItemData.sectionId) {
            const sectionId = await findOrCreateLaborSection(targetSectionName);
            if (sectionId) {
              laborItemData.sectionId = sectionId;
            }
          }

          const normalizedName = getFirstNonEmptyString(laborItemData.name);
          if (!normalizedName) {
            result = {
              success: false,
              message: "Labor item is missing name. Edit it and try again.",
            };
            break;
          }
          const normalizedQuantity = toFiniteNumber(laborItemData.quantity) ?? 1;
          const normalizedUnitPrice = toFiniteNumber(laborItemData.unitPrice);
          const normalizedUnit = getFirstNonEmptyString(laborItemData.unit);
          const normalizedNotes = getFirstNonEmptyString(laborItemData.notes);
          const normalizedAssignedTo = getFirstNonEmptyString(laborItemData.assignedTo);

          result = await createConfirmedLaborItem({
            projectId,
            itemData: {
              name: normalizedName,
              quantity: normalizedQuantity,
              unit: normalizedUnit,
              notes: normalizedNotes,
              unitPrice: normalizedUnitPrice,
              sectionId: laborItemData.sectionId,
              assignedTo: normalizedAssignedTo,
            },
          });
          break;
        }
        case 'laborSection':
          await createLaborSection({
            projectId,
            name: item.data.name as string,
          });
          result = { success: true, message: "Labor section created successfully" };
          break;
        default:
          throw new Error(`Unknown content type: ${item.type}`);
      }
    }

    return result;
  }, [
    projectId,
    resolveTeamSlug,
    resolvePendingTargetId,
    findOrCreateSection,
    findOrCreateLaborSection,
    createConfirmedTask,
    createConfirmedNote,
    createConfirmedShoppingItem,
    createConfirmedLaborItem,
    createConfirmedSurvey,
    createConfirmedContact,
    editConfirmedTask,
    editConfirmedNote,
    editConfirmedShoppingItem,
    editConfirmedLaborItem,
    editConfirmedSurvey,
    bulkEditConfirmedTasks,
    deleteTask,
    deleteNote,
    deleteShoppingItem,
    deleteShoppingSection,
    deleteLaborItem,
    deleteLaborSection,
    deleteSurvey,
    deleteContact,
    createShoppingSection,
    updateShoppingSection,
    createLaborSection,
    updateLaborSection,
    updateProjectSettings,
  ]);

  // Handlers - Helper functions defined first to avoid ReferenceErrors
  const handleConfirmItem = useCallback(async (indexOrCallId: number | string) => {
    // Resolve index if callId is passed
    let index = typeof indexOrCallId === 'number' ? indexOrCallId : -1;
    if (typeof indexOrCallId === 'string') {
      index = pendingItems.findIndex(i => i.clientId === indexOrCallId);
      if (index === -1) {
        index = pendingItems.findIndex(i => i.functionCall?.callId === indexOrCallId);
      }
    }

    // If not found in pending items, we might be clicking a "retry" on a historical item
    // For now, we only support confirming current pending items.
    // If the item is not in pendingItems, it might be that the view thinks it is, but state is cleared.
    if (index === -1) {
      console.warn("Item not found in pending items");
      return;
    }

    const item = pendingItems[index];
    const callId = item.functionCall?.callId;
    const siblingItems = callId
      ? pendingItems.filter((entry) => entry.functionCall?.callId === callId)
      : [item];
    const allSiblingsResolvedAfterConfirm = siblingItems.every((entry) =>
      entry.clientId === item.clientId ||
      entry.status === "confirmed" ||
      entry.status === "rejected"
    );

    try {
      const result = await confirmSingleItem(item);

      if (item.functionCall && item.responseId && threadId && allSiblingsResolvedAfterConfirm) {
        try {
          await markFunctionCallsAsConfirmed({
            threadId,
            responseId: item.responseId,
            results: [{
              callId: item.functionCall.callId,
              result: JSON.stringify({
                ...item,
                status: 'confirmed',
                outcome: result
              }),
            }]
          });
        } catch (e) {
          console.error("Failed to mark function call as confirmed", e);
        }
      }

      const resolvedId = item.clientId;
      setPendingItems((prev) =>
        prev.map((entry) =>
          entry.clientId === resolvedId ? { ...entry, status: "confirmed" } : entry
        )
      );

      let successMessage = result.message || `${item.type} created successfully`;
      if ('taskId' in result && result.taskId) {
        const title = (item.data as { title?: string }).title || 'Untitled';
        successMessage = `Task "${title}" created`;
      } else if ('noteId' in result && result.noteId) {
        const title = (item.data as { title?: string }).title || 'Untitled';
        successMessage = `Note "${title}" created`;
      } else if ('itemId' in result && result.itemId) {
        const name = (item.data as { name?: string }).name || 'Unnamed';
        if (item.type === 'labor') {
          successMessage = `Labor item "${name}" created`;
        } else {
          successMessage = `Shopping item "${name}" created`;
        }
      } else if ('surveyId' in result && result.surveyId) {
        const title = (item.data as { title?: string }).title || 'Untitled';
        successMessage = `Survey "${title}" created`;
      } else if ('contactId' in result && result.contactId) {
        const name = (item.data as { name?: string }).name || 'Unnamed';
        successMessage = `Contact "${name}" created`;
      }

      toast.success(successMessage);

      if (pendingItems.length === 1) {
        setShowConfirmationGrid(false);
      }
      scheduleResolvedRemoval(resolvedId);
    } catch (error) {
      toast.error(`Failed to create ${item.type}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [pendingItems, threadId, confirmSingleItem, markFunctionCallsAsConfirmed, scheduleResolvedRemoval]);

  const handleRejectItem = useCallback(async (indexOrCallId: number | string) => {
    // Resolve index
    let index = typeof indexOrCallId === 'number' ? indexOrCallId : -1;
    if (typeof indexOrCallId === 'string') {
      index = pendingItems.findIndex(i => i.clientId === indexOrCallId);
      if (index === -1) {
        index = pendingItems.findIndex(i => i.functionCall?.callId === indexOrCallId);
      }
    }

    if (index === -1) {
      console.warn("Item not found in pending items");
      return;
    }

    const item = pendingItems[index];
    const callId = item.functionCall?.callId;
    const siblingItems = callId
      ? pendingItems.filter((entry) => entry.functionCall?.callId === callId)
      : [item];
    const siblingStatusesAfterReject = siblingItems.map((entry) =>
      entry.clientId === item.clientId ? "rejected" : entry.status
    );
    const allSiblingsResolvedAfterReject = siblingStatusesAfterReject.every(
      (status) => status === "confirmed" || status === "rejected"
    );
    const allSiblingsRejected = siblingStatusesAfterReject.every(
      (status) => status === "rejected"
    );

    const resolvedId = item.clientId;
    setPendingItems((prev) =>
      prev.map((entry) =>
        entry.clientId === resolvedId ? { ...entry, status: "rejected" } : entry
      )
    );

    if (pendingItems.length === 1) {
      setShowConfirmationGrid(false);
    }

    toast.info(`${item.type} action cancelled`);

    if (item.functionCall && item.responseId && threadId && allSiblingsResolvedAfterReject) {
      try {
        await markFunctionCallsAsConfirmed({
          threadId,
          responseId: item.responseId,
          results: [{
            callId: item.functionCall.callId,
            status: allSiblingsRejected ? 'rejected' : undefined,
            result: allSiblingsRejected
              ? "User rejected this action."
              : "User reviewed this action."
          }],
        });
      } catch (error) {
        console.error("Failed to mark function call as rejected", error);
      }
    }

    setChatHistory(prev => [
      ...prev,
      {
        role: "assistant",
        content: `❌ Rejected ${item.type} suggestion${item.data?.title ? `: "${item.data.title}"` : ""}.`,
      },
    ]);
    scheduleResolvedRemoval(resolvedId);
  }, [pendingItems, threadId, markFunctionCallsAsConfirmed, setChatHistory, scheduleResolvedRemoval]);

  const handleRejectAll = useCallback(async () => {
    const itemsToReject = [...pendingItems];
    const resolvedIds = itemsToReject.map((item) => item.clientId).filter(Boolean) as string[];
    setPendingItems((prev) =>
      prev.map((item) => ({
        ...item,
        status: "rejected",
      }))
    );
    setShowConfirmationGrid(false);
    toast.info("All pending AI actions cancelled");

    if (threadId) {
      const groupedResults = new Map<string, { callId: string; result: string | undefined; status?: "rejected" }[]>();
      for (const item of itemsToReject) {
        if (item.functionCall && item.responseId) {
          if (!groupedResults.has(item.responseId)) {
            groupedResults.set(item.responseId, []);
          }
          groupedResults.get(item.responseId)!.push({
            callId: item.functionCall.callId,
            result: "User rejected this action.",
            status: 'rejected',
          });
        }
      }

      for (const [responseId, results] of groupedResults.entries()) {
        try {
          await markFunctionCallsAsConfirmed({
            threadId,
            responseId,
            results,
          });
        } catch (error) {
          console.error("Failed to mark function calls as rejected", error);
        }
      }
    }

    setChatHistory(prev => [
      ...prev,
      {
        role: "assistant",
        content: "❌ Rejected all pending AI actions.",
      },
    ]);
    resolvedIds.forEach((id) => scheduleResolvedRemoval(id));
  }, [pendingItems, threadId, markFunctionCallsAsConfirmed, setChatHistory, scheduleResolvedRemoval]);

  const handleContentConfirm = useCallback(async () => {
    if (!projectId || pendingItems.length === 0) return;

    const currentItem = pendingItems[currentItemIndex];
    setIsCreatingContent(true);

    try {
      const result = await confirmSingleItem(currentItem);

      if (result.success) {
        toast.success(result.message);

        if (currentItem.functionCall && currentItem.responseId && threadId) {
          try {
            await markFunctionCallsAsConfirmed({
              threadId,
              responseId: currentItem.responseId,
              results: [{
                callId: currentItem.functionCall.callId,
                result: JSON.stringify({
                  ...currentItem,
                  status: 'confirmed',
                  outcome: result
                }),
              }]
            });
          } catch (e) {
            console.error("Failed to mark function call as confirmed", e);
          }
        }

        const itemTitle = currentItem.data.title || currentItem.data.name || currentItem.data.content;
        const successMessage = itemTitle
          ? `✅ ${result.message}: ${itemTitle}`
          : `✅ ${result.message}`;

        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: successMessage
        }]);

        if (currentItemIndex < pendingItems.length - 1) {
          setCurrentItemIndex(prev => prev + 1);
        } else {
          setIsConfirmationDialogOpen(false);
          setPendingItems([]);
          setCurrentItemIndex(0);
        }
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error(`Error creating ${currentItem.type}:`, error);
      toast.error(`Failed to create ${currentItem.type}`);
    } finally {
      setIsCreatingContent(false);
    }
  }, [projectId, pendingItems, currentItemIndex, threadId, confirmSingleItem, markFunctionCallsAsConfirmed, setChatHistory]);

  const handleContentCancel = useCallback(async () => {
    const currentItem = pendingItems[currentItemIndex];
    if (currentItem) {
      await handleRejectItem(currentItemIndex);
    }

    if (currentItemIndex < pendingItems.length - 1) {
      setCurrentItemIndex(prev => prev + 1);
    } else {
      setIsConfirmationDialogOpen(false);
      setCurrentItemIndex(0);
    }
  }, [pendingItems, currentItemIndex, handleRejectItem]);

  const handleContentEdit = useCallback((updatedItem: { data: Record<string, unknown> }) => {
    setPendingItems(prev => {
      const updated = [...prev];
      if (updated[currentItemIndex]) {
        updated[currentItemIndex] = {
          ...updated[currentItemIndex],
          data: { ...updated[currentItemIndex].data, ...updatedItem.data },
        };
      }
      return updated;
    });
  }, [currentItemIndex]);

  const handleContentDialogClose = useCallback(() => {
    setIsConfirmationDialogOpen(false);
    if (editingItemIndex !== null) {
      // Don't re-open grid - keep everything inline
      setShowConfirmationGrid(false);
      setEditingItemIndex(null);
    }
  }, [editingItemIndex]);

  const handleConfirmAll = useCallback(async () => {
    setIsBulkProcessing(true);
    try {
      const confirmedClientIds = new Set<string>();
      let successCount = 0;
      let failureCount = 0;
      const resultsByResponseId = new Map<string, { callId: string; result: string }[]>();
      const createdItemsDetails: string[] = [];

      for (const item of pendingItems) {
        try {
          const result = await confirmSingleItem(item);
          if (!result.success) {
            failureCount++;
            continue;
          }

          successCount++;

          if (item.clientId) {
            confirmedClientIds.add(item.clientId);
          }

          if ('taskId' in result && result.taskId) {
            const title = (item.data as { title?: string }).title || 'Untitled';
            createdItemsDetails.push(`Task "${title}"`);
          } else if ('noteId' in result && result.noteId) {
            const title = (item.data as { title?: string }).title || 'Untitled';
            createdItemsDetails.push(`Note "${title}"`);
          } else if ('itemId' in result && result.itemId) {
            const name = (item.data as { name?: string; title?: string }).name
              || (item.data as { name?: string; title?: string }).title
              || 'Unnamed';
            const label = item.type === "labor" ? "Labor item" : "Shopping item";
            createdItemsDetails.push(`${label} "${name}"`);
          } else if ('surveyId' in result && result.surveyId) {
            const title = (item.data as { title?: string }).title || 'Untitled';
            createdItemsDetails.push(`Survey "${title}"`);
          } else if ('contactId' in result && result.contactId) {
            const name = (item.data as { name?: string }).name || 'Unnamed';
            createdItemsDetails.push(`Contact "${name}"`);
          }

          if (item.functionCall && item.responseId) {
            if (!resultsByResponseId.has(item.responseId)) {
              resultsByResponseId.set(item.responseId, []);
            }
            resultsByResponseId.get(item.responseId)!.push({
              callId: item.functionCall.callId,
              result: JSON.stringify({
                ...item,
                status: 'confirmed',
                outcome: result
              }),
            });
          }
        } catch (error) {
          console.error(`Failed to create ${item.type}:`, error);
          failureCount++;
        }
      }

      if (threadId) {
        for (const [responseId, results] of resultsByResponseId.entries()) {
          try {
            await markFunctionCallsAsConfirmed({
              threadId,
              responseId,
              results,
            });
          } catch (e) {
            console.error("Failed to mark function calls as confirmed", e);
          }
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully created ${successCount} items${failureCount > 0 ? `, ${failureCount} failed` : ''}`);

        let successMessage = `✅ Successfully created ${successCount} items${failureCount > 0 ? ` (${failureCount} failed)` : ''}`;
        if (createdItemsDetails.length > 0) {
          successMessage += '\n\nCreated items:\n' + createdItemsDetails.join('\n');
        }

        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: successMessage
        }]);
      }

      if (failureCount > 0 && successCount === 0) {
        toast.error(`Failed to create all ${failureCount} items`);
      }

      setPendingItems((prev) =>
        prev.map((item) =>
          item.clientId && confirmedClientIds.has(item.clientId)
            ? { ...item, status: "confirmed" }
            : item
        )
      );
      setShowConfirmationGrid(false);
      Array.from(confirmedClientIds).forEach((id) => scheduleResolvedRemoval(id));
    } catch {
      toast.error("Failed to process items");
    } finally {
      setIsBulkProcessing(false);
    }
  }, [pendingItems, threadId, confirmSingleItem, markFunctionCallsAsConfirmed, setChatHistory, scheduleResolvedRemoval]);

  useEffect(() => {
    if (!autoConfirmCrud) {
      autoConfirmBatchKeyRef.current = null;
      return;
    }

    if (isBulkProcessing || isCreatingContent) {
      return;
    }

    const unresolvedItems = pendingItems.filter(
      (item) => item.status !== "confirmed" && item.status !== "rejected"
    );

    if (unresolvedItems.length === 0) {
      autoConfirmBatchKeyRef.current = null;
      return;
    }

    const batchKey = Array.from(
      new Set(
        unresolvedItems
          .map((item) => item.functionCall?.callId ?? item.clientId ?? "")
          .filter(Boolean)
      )
    )
      .sort()
      .join("|");

    if (!batchKey || autoConfirmBatchKeyRef.current === batchKey) {
      return;
    }

    autoConfirmBatchKeyRef.current = batchKey;
    void handleConfirmAll();
  }, [autoConfirmCrud, pendingItems, isBulkProcessing, isCreatingContent, handleConfirmAll]);



  const handleEditItem = useCallback((indexOrCallId: number | string) => {
    const index = typeof indexOrCallId === "number"
      ? indexOrCallId
      : (() => {
        const byClientId = pendingItems.findIndex((item) => item.clientId === indexOrCallId);
        if (byClientId !== -1) return byClientId;
        return pendingItems.findIndex((item) => item.functionCall?.callId === indexOrCallId);
      })();

    if (index < 0) return;
    setEditingItemIndex(index);
    setShowConfirmationGrid(false);
    setIsConfirmationDialogOpen(true);
    setCurrentItemIndex(index);
  }, [pendingItems]);

  const resetPendingState = useCallback(() => {
    setPendingItems([]);
    setCurrentItemIndex(0);
    setShowConfirmationGrid(false);
    setIsConfirmationDialogOpen(false);
    setEditingItemIndex(null);
  }, []);

  const handleUpdatePendingItem = useCallback((indexOrCallId: number | string, updates: Partial<PendingItem>) => {
    setPendingItems((prev) => {
      let index = typeof indexOrCallId === 'number' ? indexOrCallId : -1;
      if (typeof indexOrCallId === 'string') {
        index = prev.findIndex(i => i.clientId === indexOrCallId);
        if (index === -1) {
          index = prev.findIndex(i => i.functionCall?.callId === indexOrCallId);
        }
      }

      if (index >= 0 && index < prev.length) {
        const currentItem = prev[index];
        const hasActualChange = Object.entries(updates).some(([key, value]) => {
          return !areValuesEqual(currentItem[key as keyof PendingItem], value);
        });

        if (!hasActualChange) {
          return prev;
        }

        const newItems = [...prev];
        newItems[index] = { ...currentItem, ...updates };
        return newItems;
      }
      return prev;
    });
  }, []);

  return {
    pendingItems,
    setPendingItems,
    currentItemIndex,
    setCurrentItemIndex,
    isConfirmationDialogOpen,
    setIsConfirmationDialogOpen,
    showConfirmationGrid,
    setShowConfirmationGrid,
    isCreatingContent,
    isBulkProcessing,
    editingItemIndex,
    setEditingItemIndex,
    handleContentConfirm,
    handleContentCancel,
    handleContentEdit,
    handleContentDialogClose,
    handleConfirmAll,
    handleConfirmItem,
    handleRejectItem,
    handleRejectAll,
    handleEditItem,
    handleUpdatePendingItem,
    resetPendingState,
  };
};

export default usePendingItems;
