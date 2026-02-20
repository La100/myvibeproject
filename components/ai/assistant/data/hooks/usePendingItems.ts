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
  ShoppingItemInput,
  LaborItemInput,
  BulkTaskData,
  BulkNoteData,
  BulkShoppingData,
  BulkLaborData,
  BulkSurveyData,
} from "../types";
import {
  isPendingItemType,
  normalizePendingItems,
  expandBulkEditItems,
  sanitizeShoppingItemData,
  sanitizeContactData,
  extractSurveyData,
  extractBulkSelection,
  extractBulkUpdates,
  resolveSectionName,
} from "../utils";

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
  handleAutoRejectPendingItems: () => Promise<number>;
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

  const parseFunctionCallArguments = useCallback((raw: string): Record<string, unknown> | null => {
    let parsed: unknown = raw;
    for (let i = 0; i < 2 && typeof parsed === "string"; i += 1) {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return null;
      }
    }

    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  }, []);

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
      if (pendingItems.length > 0) {
        setPendingItems([]);
      }
      setCurrentItemIndex(0);
      setShowConfirmationGrid(false);
      setIsConfirmationDialogOpen(false);
      return;
    }

    if (pendingFunctionCalls && pendingFunctionCalls.length > 0) {
      const pendingItemsFromDB = pendingFunctionCalls.map((call) => {
        try {
          const parsed = parseFunctionCallArguments(call.arguments);
          if (!parsed) {
            return null;
          }
          const parsedTypeValue = typeof parsed?.type === "string" ? parsed.type : undefined;
          const parsedType = isPendingItemType(parsedTypeValue) ? parsedTypeValue : undefined;
          const functionCallType = isPendingItemType(call.functionName) ? call.functionName : undefined;

          return {
            type: parsedType ?? functionCallType ?? "task",
            operation: parsed.operation,
            data: parsed.data || parsed,
            updates: parsed.updates,
            originalItem: parsed.originalItem,
            selection: parsed.selection,
            titleChanges: parsed.titleChanges,
            functionCall: {
              callId: call.callId,
              functionName: call.functionName,
              arguments: call.arguments,
            },
            responseId: call.responseId,
            status: (call.status === "confirmed" || call.status === "rejected") ? call.status : undefined,
          };
        } catch (e) {
          console.error("Failed to parse pending item:", e);
          return null;
        }
      }) as Array<PendingItem | null>;

      const normalizedPendingItems = pendingItemsFromDB.filter((i): i is PendingItem => i !== null);

      if (normalizedPendingItems.length > 0) {
        const expanded = expandBulkEditItems(normalizePendingItems(normalizedPendingItems));
        const withClientIds = expanded.map((item, index) => ({
          ...item,
          clientId: item.clientId ?? `${item.functionCall?.callId ?? "pending"}-${index}`,
        }));

        setPendingItems(prev => {
          const prevMap = new Map(prev.map(p => [p.clientId, p]));

          // 1. Process new items from server (preserving local confirmation status if they exist in prev)
          const newItems = withClientIds.map(newItem => {
            const prevItem = prevMap.get(newItem.clientId!);
            if (prevItem && (prevItem.status === 'confirmed' || prevItem.status === 'rejected')) {
              return { ...newItem, status: prevItem.status };
            }
            return newItem;
          });

          // 2. Find resolved items in prev that are NOT in newItems (preserved items)
          const newIds = new Set(newItems.map(i => i.clientId));
          const preservedItems = prev.filter((p) => {
            if (p.status !== "confirmed" && p.status !== "rejected") return false;
            if (!p.clientId) return true;
            return !newIds.has(p.clientId);
          });

          // 3. Combine
          return [...newItems, ...preservedItems];
        });
        setCurrentItemIndex(0);

        // Don't auto-open dialogs - let inline confirmations in StreamingMessage handle display
        // Dialogs can still be opened manually if needed
        setShowConfirmationGrid(false);
        setIsConfirmationDialogOpen(false);
      }
    } else if (pendingFunctionCalls && pendingFunctionCalls.length === 0 && pendingItems.length > 0) {
      // If server returns empty, keep only resolved items (receipts), remove any stale pending ones
      setPendingItems(prev => prev.filter(item => item.status === "confirmed" || item.status === "rejected"));

      // Close dialogs if they were open (optional, but good UX if the item we were acting on is gone)
      setShowConfirmationGrid(false);
      setIsConfirmationDialogOpen(false);
    }
  }, [threadId, pendingFunctionCalls, pendingItems.length, parseFunctionCallArguments]);

  const scheduleResolvedRemoval = useCallback((clientId?: string) => {
    // Intentionally left blank - keep resolved items visible in the UI.
    void clientId;
  }, []);

  // Helper functions
  const resolveTeamSlug = useCallback(() => {
    return teamSlug || undefined;
  }, [teamSlug]);

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
          for (const shoppingData of items) {
            const { sectionName } = shoppingData;
            const targetSectionName = resolveSectionName(sectionName, shoppingData.category);
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

          for (const shoppingData of items) {
            try {
              const { sectionName, ...shoppingItemData } = shoppingData;
              const targetSectionName = resolveSectionName(sectionName, shoppingData.category);

              if (targetSectionName && !shoppingItemData.sectionId) {
                const sectionId = sectionNameToId.get(targetSectionName);
                if (sectionId) {
                  shoppingItemData.sectionId = sectionId;
                }
              }

              const sanitizedItemData = sanitizeShoppingItemData(shoppingItemData as Record<string, unknown>);

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
          for (const laborData of items) {
            if (laborData.sectionName && !laborData.sectionId) {
              uniqueSectionNames.add(laborData.sectionName);
            }
          }

          const sectionNameToId = new Map<string, Id<"laborSections">>();
          for (const sectionName of uniqueSectionNames) {
            const sectionId = await findOrCreateLaborSection(sectionName);
            if (sectionId) {
              sectionNameToId.set(sectionName, sectionId);
            }
          }

          for (const laborData of items) {
            try {
              const { sectionName, ...laborItemData } = laborData;

              if (sectionName && !laborItemData.sectionId) {
                const sectionId = sectionNameToId.get(sectionName);
                if (sectionId) {
                  laborItemData.sectionId = sectionId;
                }
              }

              const laborResult = await createConfirmedLaborItem({
                projectId,
                itemData: {
                  name: laborItemData.name,
                  quantity: laborItemData.quantity,
                  unit: laborItemData.unit,
                  notes: laborItemData.notes,
                  unitPrice: laborItemData.unitPrice,
                  sectionId: laborItemData.sectionId,
                  assignedTo: laborItemData.assignedTo,
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
    } else if (item.operation === 'edit') {
      switch (item.type) {
        case 'task': {
          const cleanUpdates = { ...(item.updates as Record<string, unknown>) };
          delete cleanUpdates.assignedToName;

          result = await editConfirmedTask({
            taskId: item.originalItem?._id as Id<"tasks">,
            updates: cleanUpdates
          });
          break;
        }
        case 'note':
          result = await editConfirmedNote({
            noteId: item.originalItem?._id as Id<"notes">,
            updates: item.updates as Record<string, unknown>
          });
          break;
        case 'shopping': {
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

          result = await editConfirmedShoppingItem({
            itemId: item.originalItem?._id as Id<"shoppingListItems">,
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
        case 'survey':
          result = await editConfirmedSurvey({
            surveyId: item.originalItem?._id as Id<"surveys">,
            updates: item.updates as Record<string, unknown>
          });
          break;
        case 'labor': {
          const laborUpdates = { ...(item.updates as Record<string, unknown>) };
          const targetSectionName = laborUpdates["sectionName"] as string | undefined;

          if (targetSectionName && !laborUpdates["sectionId"]) {
            const sectionId = await findOrCreateLaborSection(targetSectionName);
            if (sectionId) {
              laborUpdates["sectionId"] = sectionId;
            }
          }

          delete laborUpdates["sectionName"];

          result = await editConfirmedLaborItem({
            itemId: item.originalItem?._id as Id<"laborItems">,
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
        default:
          throw new Error(`Unknown content type for editing: ${item.type}`);
      }
    } else {
      // Create operations
      switch (item.type) {
        case 'task':
        case 'create_task':
          if (item.operation === 'bulk_edit') {
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
            } else if (Array.isArray(item.data?.tasks)) {
              const tasks = item.data.tasks as Array<Record<string, unknown>>;
              if (tasks.length === 0) {
                throw new Error("No tasks provided for bulk edit");
              }

              let updatedCount = 0;
              const errors: string[] = [];

              for (const taskUpdate of tasks) {
                try {
                  const { taskId, ...updatesForTask } = taskUpdate as {
                    taskId?: string;
                    [key: string]: unknown;
                  };
                  if (!taskId) continue;

                  const cleanUpdates = { ...updatesForTask } as Record<string, unknown>;
                  delete cleanUpdates.assignedToName;

                  const editResult = await editConfirmedTask({
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
                  ? `Updated ${updatedCount}/${tasks.length} tasks successfully`
                  : `Updated ${updatedCount}/${tasks.length} tasks with errors: ${errors.slice(0, 3).join(', ')}`,
              };
            } else {
              throw new Error("No updates provided for bulk edit");
            }
          } else {
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
          }
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
          const rawShoppingData = item.data as ShoppingItemInput;
          const { sectionName, ...shoppingItemData } = rawShoppingData;
          const targetSectionName = resolveSectionName(sectionName, rawShoppingData.category);

          if (targetSectionName && !shoppingItemData.sectionId) {
            const sectionId = await findOrCreateSection(targetSectionName);
            if (sectionId) {
              shoppingItemData.sectionId = sectionId;
            }
          }

          const sanitizedItemData = sanitizeShoppingItemData(shoppingItemData);

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
          const rawLaborData = item.data as LaborItemInput;
          const { sectionName, ...laborItemData } = rawLaborData;

          if (sectionName && !laborItemData.sectionId) {
            const sectionId = await findOrCreateLaborSection(sectionName);
            if (sectionId) {
              laborItemData.sectionId = sectionId;
            }
          }

          result = await createConfirmedLaborItem({
            projectId,
            itemData: {
              name: laborItemData.name,
              quantity: laborItemData.quantity,
              unit: laborItemData.unit,
              notes: laborItemData.notes,
              unitPrice: laborItemData.unitPrice,
              sectionId: laborItemData.sectionId,
              assignedTo: laborItemData.assignedTo,
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
  ]);

  // Handlers - Helper functions defined first to avoid ReferenceErrors
  const handleConfirmItem = useCallback(async (indexOrCallId: number | string) => {
    // Resolve index if callId is passed
    let index = typeof indexOrCallId === 'number' ? indexOrCallId : -1;
    if (typeof indexOrCallId === 'string') {
      index = pendingItems.findIndex(i => i.functionCall?.callId === indexOrCallId);
    }

    // If not found in pending items, we might be clicking a "retry" on a historical item
    // For now, we only support confirming current pending items.
    // If the item is not in pendingItems, it might be that the view thinks it is, but state is cleared.
    if (index === -1) {
      console.warn("Item not found in pending items");
      return;
    }

    const item = pendingItems[index];
    try {
      const result = await confirmSingleItem(item);

      if (item.functionCall && item.responseId && threadId) {
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
      index = pendingItems.findIndex(i => i.functionCall?.callId === indexOrCallId);
    }

    if (index === -1) {
      console.warn("Item not found in pending items");
      return;
    }

    const item = pendingItems[index];
    const resolvedId = item.clientId;
    setPendingItems((prev) =>
      prev.map((entry) =>
        entry.clientId === resolvedId ? { ...entry, status: "rejected" } : entry
      )
    );

    if (pendingItems.length === 1) {
      setShowConfirmationGrid(false);
    }

    toast.info(`${item.type} creation cancelled`);

    if (item.functionCall && item.responseId && threadId) {
      try {
        await markFunctionCallsAsConfirmed({
          threadId,
          responseId: item.responseId,
          results: [{
            callId: item.functionCall.callId,
            status: 'rejected',
            result: "User rejected this action."
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
    toast.info("All item creations cancelled");

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
        content: "❌ Rejected all pending AI suggestions.",
      },
    ]);
    resolvedIds.forEach((id) => scheduleResolvedRemoval(id));
  }, [pendingItems, threadId, markFunctionCallsAsConfirmed, setChatHistory, scheduleResolvedRemoval]);

  const handleAutoRejectPendingItems = useCallback(async () => {
    const itemsToReject = pendingItems.filter(
      (item) => item.status !== "confirmed" && item.status !== "rejected"
    );
    if (itemsToReject.length === 0) return 0;

    const resolvedIds = itemsToReject.map((item) => item.clientId).filter(Boolean) as string[];
    setPendingItems((prev) =>
      prev.map((item) =>
        resolvedIds.includes(item.clientId ?? "") ? { ...item, status: "rejected" } : item
      )
    );
    setShowConfirmationGrid(false);
    setIsConfirmationDialogOpen(false);

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
          console.error("Failed to auto-reject function calls", error);
        }
      }
    }

    resolvedIds.forEach((id) => scheduleResolvedRemoval(id));
    return itemsToReject.length;
  }, [
    pendingItems,
    threadId,
    markFunctionCallsAsConfirmed,
    scheduleResolvedRemoval,
  ]);

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
      const resolvedIds = pendingItems.map((item) => item.clientId).filter(Boolean) as string[];
      let successCount = 0;
      let failureCount = 0;
      const resultsByResponseId = new Map<string, { callId: string; result: string }[]>();
      const createdItemsDetails: string[] = [];

      for (const item of pendingItems) {
        try {
          const result = await confirmSingleItem(item);
          successCount++;

          if (result.success) {
            if ('taskId' in result && result.taskId) {
              const title = (item.data as { title?: string }).title || 'Untitled';
              createdItemsDetails.push(`Task "${title}"`);
            } else if ('noteId' in result && result.noteId) {
              const title = (item.data as { title?: string }).title || 'Untitled';
              createdItemsDetails.push(`Note "${title}"`);
            } else if ('itemId' in result && result.itemId) {
              const name = (item.data as { name?: string }).name || 'Unnamed';
              createdItemsDetails.push(`Shopping item "${name}"`);
            } else if ('surveyId' in result && result.surveyId) {
              const title = (item.data as { title?: string }).title || 'Untitled';
              createdItemsDetails.push(`Survey "${title}"`);
            } else if ('contactId' in result && result.contactId) {
              const name = (item.data as { name?: string }).name || 'Unnamed';
              createdItemsDetails.push(`Contact "${name}"`);
            }
          }

          if (item.functionCall && item.responseId && result) {
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
        prev.map((item) => ({
          ...item,
          status: "confirmed",
        }))
      );
      setShowConfirmationGrid(false);
      resolvedIds.forEach((id) => scheduleResolvedRemoval(id));
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

    const batchKey = unresolvedItems
      .map((item) => item.clientId ?? item.functionCall?.callId ?? "")
      .filter(Boolean)
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
      : pendingItems.findIndex((item) => item.functionCall?.callId === indexOrCallId);

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
        index = prev.findIndex(i => i.functionCall?.callId === indexOrCallId);
      }

      if (index >= 0 && index < prev.length) {
        const newItems = [...prev];
        newItems[index] = { ...newItems[index], ...updates };
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
    handleAutoRejectPendingItems,
    handleEditItem,
    handleUpdatePendingItem,
    resetPendingState,
  };
};

export default usePendingItems;
