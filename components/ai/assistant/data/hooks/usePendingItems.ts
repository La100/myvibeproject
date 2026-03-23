"use client";
/**
 * usePendingItems Hook
 * 
 * Manages pending AI suggestions and their confirmation/rejection flow.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import type {
  PendingItem,
  ChatHistoryEntry,
} from "../types";
import {
  hydratePendingItems,
  keepOnlyResolvedPendingItems,
  mergePendingItems,
  type PendingFunctionCall,
} from "./pendingItemsHydration";
import {
  areValuesEqual,
} from "./pendingItemsHelpers";
import { createConfirmSingleItem } from "./pendingItemsConfirm";

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

const PENDING_STATUSES_STORAGE_PREFIX = "ai.pending-item-statuses.v1";
const normalizeSectionName = (value: string) => value.trim().toLocaleLowerCase();

type PersistedPendingStatuses = Record<string, "confirmed" | "rejected">;

const getPersistedStatusesStorageKey = (threadId: string) =>
  `${PENDING_STATUSES_STORAGE_PREFIX}:${threadId}`;

const readPersistedStatuses = (threadId: string): PersistedPendingStatuses => {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(getPersistedStatusesStorageKey(threadId));
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([key, value]) =>
          typeof key === "string" &&
          (value === "confirmed" || value === "rejected")
      )
    ) as PersistedPendingStatuses;
  } catch {
    return {};
  }
};

const writePersistedStatuses = (
  threadId: string,
  statuses: PersistedPendingStatuses,
) => {
  if (typeof window === "undefined") return;

  try {
    if (Object.keys(statuses).length === 0) {
      window.localStorage.removeItem(getPersistedStatusesStorageKey(threadId));
      return;
    }
    window.localStorage.setItem(
      getPersistedStatusesStorageKey(threadId),
      JSON.stringify(statuses),
    );
  } catch {
    // Ignore storage write errors (private mode, quota limits, etc.)
  }
};

const applyPersistedStatuses = (
  items: PendingItem[],
  statuses: PersistedPendingStatuses,
): PendingItem[] =>
  items.map((item) => {
    if (!item.clientId) return item;
    const persistedStatus = statuses[item.clientId];
    if (persistedStatus !== "confirmed" && persistedStatus !== "rejected") {
      return item;
    }
    return { ...item, status: persistedStatus };
  });

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
  const shoppingSectionCacheRef = useRef<Map<string, Id<"shoppingListSections">>>(new Map());
  const shoppingSectionInFlightRef = useRef<
    Map<string, Promise<Id<"shoppingListSections"> | undefined>>
  >(new Map());
  const laborSectionCacheRef = useRef<Map<string, Id<"laborSections">>>(new Map());
  const laborSectionInFlightRef = useRef<
    Map<string, Promise<Id<"laborSections"> | undefined>>
  >(new Map());

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
  const deleteFile = useMutation(apiAny.files.deleteFile);
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
  const editConfirmedContact = useAction(apiAny.ai.confirmedActions.editConfirmedContact);
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
      const persistedStatuses = readPersistedStatuses(threadId);
      const hydratedPendingItems = applyPersistedStatuses(
        hydratePendingItems(
          pendingFunctionCalls as PendingFunctionCall[],
        ),
        persistedStatuses,
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

  useEffect(() => {
    if (!threadId) return;

    const resolvedStatuses = pendingItems.reduce<PersistedPendingStatuses>(
      (acc, item) => {
        if (!item.clientId) return acc;
        if (item.status === "confirmed" || item.status === "rejected") {
          acc[item.clientId] = item.status;
        }
        return acc;
      },
      {},
    );

    writePersistedStatuses(threadId, resolvedStatuses);
  }, [threadId, pendingItems]);

  const scheduleResolvedRemoval = useCallback((clientId?: string) => {
    // Intentionally left blank - keep resolved items visible in the UI.
    void clientId;
  }, []);

  useEffect(() => {
    shoppingSectionCacheRef.current.clear();
    shoppingSectionInFlightRef.current.clear();
    laborSectionCacheRef.current.clear();
    laborSectionInFlightRef.current.clear();
  }, [projectId]);

  useEffect(() => {
    shoppingSectionCacheRef.current.clear();
    if (!shoppingSections) return;
    for (const section of shoppingSections) {
      shoppingSectionCacheRef.current.set(normalizeSectionName(section.name), section._id);
    }
  }, [shoppingSections]);

  useEffect(() => {
    laborSectionCacheRef.current.clear();
    if (!laborSections) return;
    for (const section of laborSections) {
      laborSectionCacheRef.current.set(normalizeSectionName(section.name), section._id);
    }
  }, [laborSections]);

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
    const trimmedName = sectionName?.trim();
    if (!trimmedName || !projectId) return undefined;

    const sectionKey = normalizeSectionName(trimmedName);
    const cachedId = shoppingSectionCacheRef.current.get(sectionKey);
    if (cachedId) {
      return cachedId;
    }

    const existingSection = shoppingSections?.find(
      (s) => normalizeSectionName(s.name) === sectionKey
    );

    if (existingSection) {
      shoppingSectionCacheRef.current.set(sectionKey, existingSection._id);
      return existingSection._id;
    }

    const inFlight = shoppingSectionInFlightRef.current.get(sectionKey);
    if (inFlight) {
      return await inFlight;
    }

    const createPromise = (async () => {
      try {
        const newSectionId = await createShoppingSection({
          projectId,
          name: trimmedName,
        });
        if (newSectionId) {
          shoppingSectionCacheRef.current.set(sectionKey, newSectionId);
        }
        return newSectionId as Id<"shoppingListSections"> | undefined;
      } catch (error) {
        console.error("Failed to create section:", error);
        return undefined;
      } finally {
        shoppingSectionInFlightRef.current.delete(sectionKey);
      }
    })();
    shoppingSectionInFlightRef.current.set(sectionKey, createPromise);

    try {
      return await createPromise;
    } finally {
      shoppingSectionInFlightRef.current.delete(sectionKey);
    }
  }, [projectId, shoppingSections, createShoppingSection]);

  const findOrCreateLaborSection = useCallback(async (sectionName: string): Promise<Id<"laborSections"> | undefined> => {
    const trimmedName = sectionName?.trim();
    if (!trimmedName || !projectId) return undefined;

    const sectionKey = normalizeSectionName(trimmedName);
    const cachedId = laborSectionCacheRef.current.get(sectionKey);
    if (cachedId) {
      return cachedId;
    }

    const existingSection = laborSections?.find(
      (s) => normalizeSectionName(s.name) === sectionKey
    );

    if (existingSection) {
      laborSectionCacheRef.current.set(sectionKey, existingSection._id);
      return existingSection._id;
    }

    const inFlight = laborSectionInFlightRef.current.get(sectionKey);
    if (inFlight) {
      return await inFlight;
    }

    const createPromise = (async () => {
      try {
        const newSectionId = await createLaborSection({
          projectId,
          name: trimmedName,
        });
        if (newSectionId) {
          laborSectionCacheRef.current.set(sectionKey, newSectionId);
        }
        return newSectionId as Id<"laborSections"> | undefined;
      } catch (error) {
        console.error("Failed to create labor section:", error);
        return undefined;
      } finally {
        laborSectionInFlightRef.current.delete(sectionKey);
      }
    })();
    laborSectionInFlightRef.current.set(sectionKey, createPromise);

    try {
      return await createPromise;
    } finally {
      laborSectionInFlightRef.current.delete(sectionKey);
    }
  }, [projectId, laborSections, createLaborSection]);

  // Confirm single item helper

  // Confirm single item helper
  const confirmSingleItem = useMemo(
    () =>
      createConfirmSingleItem({
        projectId,
        resolveTeamSlug,
        resolvePendingTargetId,
        findOrCreateSection,
        findOrCreateLaborSection,
        createConfirmedTask,
        createConfirmedNote,
        createConfirmedShoppingItem,
        createConfirmedSurvey,
        createConfirmedContact,
        editConfirmedTask,
        editConfirmedNote,
        editConfirmedShoppingItem,
        editConfirmedSurvey,
        editConfirmedContact,
        bulkEditConfirmedTasks,
        createConfirmedLaborItem,
        editConfirmedLaborItem,
        deleteTask,
        deleteNote,
        deleteFile,
        deleteShoppingItem,
        createShoppingSection,
        updateShoppingSection,
        deleteShoppingSection,
        deleteSurvey,
        deleteContact,
        deleteLaborItem,
        createLaborSection,
        updateLaborSection,
        deleteLaborSection,
        updateProjectSettings,
      }),
    [
      projectId,
      resolveTeamSlug,
      resolvePendingTargetId,
      findOrCreateSection,
      findOrCreateLaborSection,
      createConfirmedTask,
      createConfirmedNote,
      createConfirmedShoppingItem,
      createConfirmedSurvey,
      createConfirmedContact,
      editConfirmedTask,
      editConfirmedNote,
      editConfirmedShoppingItem,
      editConfirmedSurvey,
      editConfirmedContact,
      bulkEditConfirmedTasks,
      createConfirmedLaborItem,
      editConfirmedLaborItem,
      deleteTask,
      deleteNote,
      deleteFile,
      deleteShoppingItem,
      createShoppingSection,
      updateShoppingSection,
      deleteShoppingSection,
      deleteSurvey,
      deleteContact,
      deleteLaborItem,
      createLaborSection,
      updateLaborSection,
      deleteLaborSection,
      updateProjectSettings,
    ],
  );
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
