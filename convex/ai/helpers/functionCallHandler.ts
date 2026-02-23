/**
 * Function Call Handler
 *
 * Handles all function calls from OpenAI and prepares pending items
 */

import type { ProjectContextSnapshot, TeamMember, PendingItem } from "../types";

export interface FunctionCallResult {
  pendingItems: PendingItem[];
  finalResponse: string;
  actionSummaries: string[];
}

// Helper to resolve team member assignment
const resolveTeamMember = (identifier: string | undefined, teamMembers: TeamMember[]) => {
  if (!identifier) return null;

  const member = teamMembers.find((m) =>
    m.name === identifier ||
    m.email === identifier ||
    m.clerkUserId === identifier
  );

  return member ? {
    clerkUserId: member.clerkUserId,
    name: member.name || member.email,
  } : null;
};

export const processFunctionCalls = async (
  functionCalls: any[],
  aiResponse: string,
  teamMembers: TeamMember[],
  getSnapshot: () => Promise<ProjectContextSnapshot>,
  responseId: string,
): Promise<FunctionCallResult> => {
  const pendingItems: PendingItem[] = [];
  const actionSummaries: string[] = [];
  let finalResponse = aiResponse;

  for (const functionCall of functionCalls) {
    const functionArgs = JSON.parse(functionCall.arguments);
    const funcCallDataPayload = {
      callId: functionCall.call_id,
      functionName: functionCall.name,
      arguments: functionCall.arguments,
    };

    switch (functionCall.name) {
      // ============================================
      // NEW GENERIC OPERATIONS
      // ============================================
      case "create_item":
        {
          const { type, data } = functionArgs;

          // Handle team member assignment for tasks
          if (type === "task" && data.assignedTo) {
            const resolved = resolveTeamMember(data.assignedTo, teamMembers);
            if (resolved) {
              data.assignedTo = resolved.clerkUserId;
              data.assignedToName = resolved.name;
            } else {
              data.assignedTo = null;
            }
          }

          pendingItems.push({
            type,
            operation: "create",
            data,
            functionCall: funcCallDataPayload,
            responseId,
          });

          const itemName = data.title || data.name || "item";
          actionSummaries.push(`${type}: "${itemName}"`);
          finalResponse = `I'll create a ${type}: "${itemName}". ${aiResponse}`;
        }
        break;

      case "create_multiple_items":
        {
          const { type, items } = functionArgs;

          items.forEach((itemData: any) => {
            // Handle team member assignment for tasks
            if (type === "task" && itemData.assignedTo) {
              const resolved = resolveTeamMember(itemData.assignedTo, teamMembers);
              if (resolved) {
                itemData.assignedTo = resolved.clerkUserId;
                itemData.assignedToName = resolved.name;
              } else {
                itemData.assignedTo = null;
              }
            }

            pendingItems.push({
              type,
              operation: "create",
              data: itemData,
              functionCall: funcCallDataPayload,
              responseId,
            });
          });

          actionSummaries.push(`${items.length} ${type}s`);
          finalResponse = `I'll create ${items.length} ${type}s for you. ${aiResponse}`;
        }
        break;

      case "update_item":
        {
          const { type, itemId, data } = functionArgs;
          const snapshot = await getSnapshot();

          // Handle team member assignment for tasks
          if (type === "task" && data.assignedTo) {
            const resolved = resolveTeamMember(data.assignedTo, teamMembers);
            if (resolved) {
              data.assignedTo = resolved.clerkUserId;
              data.assignedToName = resolved.name;
            } else {
              data.assignedTo = null;
            }
          }

          // Find original item based on type
          let originalItem: any = { _id: itemId };
          if (type === "task") {
            originalItem = snapshot.tasks.find((t) => t._id === itemId) || { _id: itemId };
          } else if (type === "note") {
            originalItem = snapshot.notes.find((n) => n._id === itemId) || { _id: itemId };
          } else if (type === "shopping") {
            originalItem = snapshot.shoppingItems.find((item) => item._id === itemId) || { _id: itemId };
          } else if (type === "survey") {
            originalItem = snapshot.surveys.find((s) => s._id === itemId) || { _id: itemId };
          }

          pendingItems.push({
            type,
            operation: "edit",
            data: { ...data, itemId },
            updates: data,
            originalItem,
            functionCall: funcCallDataPayload,
            responseId,
          });

          finalResponse = `I'll update the ${type}. ${aiResponse}`;
        }
        break;

      case "update_multiple_items":
        {
          const { type, updates } = functionArgs;
          const snapshot = await getSnapshot();

          for (const update of updates) {
            const { itemId, data } = update;

            // Handle team member assignment for tasks
            if (type === "task" && data.assignedTo) {
              const resolved = resolveTeamMember(data.assignedTo, teamMembers);
              if (resolved) {
                data.assignedTo = resolved.clerkUserId;
                data.assignedToName = resolved.name;
              } else {
                data.assignedTo = null;
              }
            }

            // Find original item based on type
            let originalItem: any = { _id: itemId };
            if (type === "task") {
              originalItem = snapshot.tasks.find((t) => t._id === itemId) || { _id: itemId };
            } else if (type === "note") {
              originalItem = snapshot.notes.find((n) => n._id === itemId) || { _id: itemId };
            } else if (type === "shopping") {
              originalItem = snapshot.shoppingItems.find((item) => item._id === itemId) || { _id: itemId };
            } else if (type === "survey") {
              originalItem = snapshot.surveys.find((s) => s._id === itemId) || { _id: itemId };
            }

            pendingItems.push({
              type,
              operation: "edit",
              data: { ...data, itemId },
              updates: data,
              originalItem,
              functionCall: funcCallDataPayload,
              responseId,
            });
          }

          finalResponse = `I'll update ${updates.length} ${type}s for you. ${aiResponse}`;
        }
        break;

      case "delete_item":
        {
          const { type, itemId, name, reason } = functionArgs;

          pendingItems.push({
            type,
            operation: "delete",
            data: { itemId, name, reason },
            functionCall: funcCallDataPayload,
            responseId,
          });

          finalResponse = name
            ? `I'll delete the ${type} "${name}". ${aiResponse}`
            : `I'll delete the ${type}. ${aiResponse}`;
        }
        break;

      // ============================================
      // LEGACY OPERATIONS (backward compatibility)
      // ============================================
      case "create_task":
        {
          // Resolve assignedTo name/email to Clerk ID
          if (functionArgs.assignedTo) {
            const assignedUser = teamMembers.find((m) =>
              m.name === functionArgs.assignedTo ||
              m.email === functionArgs.assignedTo ||
              m.clerkUserId === functionArgs.assignedTo
            );
            if (assignedUser) {
              functionArgs.assignedToName = assignedUser.name || assignedUser.email;
              functionArgs.assignedTo = assignedUser.clerkUserId;
            } else {
              functionArgs.assignedTo = null;
            }
          }

          pendingItems.push({
            type: "task",
            operation: "create",
            data: functionArgs,
            functionCall: funcCallDataPayload,
            responseId: responseId,
          });
          actionSummaries.push(`task: "${functionArgs.title}"`);
          finalResponse = `I'll create a task: "${functionArgs.title}". ${aiResponse}`;
        }
        break;

      case "create_multiple_tasks":
        {
          const tasks = Array.isArray(functionArgs.tasks)
            ? functionArgs.tasks
            : Array.isArray(functionArgs.items)
              ? functionArgs.items
              : [];

          tasks.forEach((task: any) => {
            if (task.assignedTo) {
              const assignedUser = teamMembers.find((m) =>
                m.name === task.assignedTo ||
                m.email === task.assignedTo ||
                m.clerkUserId === task.assignedTo
              );
              if (assignedUser) {
                task.assignedToName = assignedUser.name || assignedUser.email;
                task.assignedTo = assignedUser.clerkUserId;
              } else {
                task.assignedTo = null;
              }
            }

            pendingItems.push({
              type: "task",
              operation: "create",
              data: task,
              functionCall: funcCallDataPayload,
              responseId: responseId,
            });
          });
        }
        const taskCount = (Array.isArray(functionArgs.tasks) ? functionArgs.tasks : functionArgs.items || []).length;
        actionSummaries.push(`${taskCount} tasks`);
        finalResponse = `I'll create ${taskCount} tasks for you. ${aiResponse}`;
        break;

      case "edit_task":
        {
          const { taskId: editTaskId, ...taskUpdates } = functionArgs;
          const snapshot = await getSnapshot();
          const originalTask = snapshot.tasks.find((t) => t._id === editTaskId);

          if (taskUpdates.assignedTo) {
            const assignedUser = teamMembers.find(m =>
              m.name === taskUpdates.assignedTo ||
              m.email === taskUpdates.assignedTo ||
              m.clerkUserId === taskUpdates.assignedTo
            );
            if (assignedUser) {
              taskUpdates.assignedToName = assignedUser.name || assignedUser.email;
              taskUpdates.assignedTo = assignedUser.clerkUserId;
            } else {
              taskUpdates.assignedTo = null;
            }
          }

          pendingItems.push({
            type: "task",
            operation: "edit",
            data: functionArgs,
            updates: taskUpdates,
            originalItem: originalTask || { _id: editTaskId },
            functionCall: funcCallDataPayload,
            responseId: responseId,
          });
          finalResponse = `I'll update the task. ${aiResponse}`;
        }
        break;

      case "edit_multiple_tasks":
        {
          const snapshot = await getSnapshot();
          for (const task of functionArgs.tasks as Array<any>) {
            const { taskId: bulkEditTaskId, ...bulkTaskUpdates } = task;
            const originalBulkTask = snapshot.tasks.find((t) => t._id === bulkEditTaskId);

            if (bulkTaskUpdates.assignedTo) {
              const assignedUser = teamMembers.find(m =>
                m.name === bulkTaskUpdates.assignedTo ||
                m.email === bulkTaskUpdates.assignedTo ||
                m.clerkUserId === bulkTaskUpdates.assignedTo
              );
              if (assignedUser) {
                bulkTaskUpdates.assignedToName = assignedUser.name || assignedUser.email;
                bulkTaskUpdates.assignedTo = assignedUser.clerkUserId;
              } else {
                bulkTaskUpdates.assignedTo = null;
              }
            }

            pendingItems.push({
              type: "task",
              operation: "edit",
              data: task,
              updates: bulkTaskUpdates,
              originalItem: originalBulkTask || { _id: bulkEditTaskId },
              functionCall: funcCallDataPayload,
              responseId: responseId,
            });
          }
        }
        finalResponse = `I'll update ${functionArgs.tasks.length} tasks for you. ${aiResponse}`;
        break;

      case "create_note":
        pendingItems.push({
          type: "note",
          operation: "create",
          data: functionArgs,
          functionCall: funcCallDataPayload,
          responseId: responseId,
        });
        actionSummaries.push(`note: "${functionArgs.title}"`);
        finalResponse = `I'll create a note: "${functionArgs.title}". ${aiResponse}`;
        break;

      case "create_multiple_notes":
        {
          const notes = Array.isArray(functionArgs.notes)
            ? functionArgs.notes
            : Array.isArray(functionArgs.items)
              ? functionArgs.items
              : [];

          notes.forEach((note: any) => {
            pendingItems.push({
              type: "note",
              operation: "create",
              data: note,
              functionCall: funcCallDataPayload,
              responseId: responseId,
            });
          });
          actionSummaries.push(`${notes.length} notes`);
          finalResponse = `I'll create ${notes.length} notes for you. ${aiResponse}`;
        }
        break;

      case "edit_note":
        {
          const { noteId: editNoteId, ...noteUpdates } = functionArgs;
          const snapshot = await getSnapshot();
          const originalNote = snapshot.notes.find((n) => n._id === editNoteId);

          pendingItems.push({
            type: "note",
            operation: "edit",
            data: functionArgs,
            updates: noteUpdates,
            originalItem: originalNote || { _id: editNoteId },
            functionCall: funcCallDataPayload,
            responseId: responseId,
          });
          finalResponse = `I'll update the note. ${aiResponse}`;
        }
        break;

      case "edit_multiple_notes":
        {
          const snapshot = await getSnapshot();
          for (const note of functionArgs.notes as Array<any>) {
            const { noteId: bulkEditNoteId, ...bulkNoteUpdates } = note;
            const originalBulkNote = snapshot.notes.find((n) => n._id === bulkEditNoteId);

            pendingItems.push({
              type: "note",
              operation: "edit",
              data: note,
              updates: bulkNoteUpdates,
              originalItem: originalBulkNote || { _id: bulkEditNoteId },
              functionCall: funcCallDataPayload,
              responseId: responseId,
            });
          }
        }
        finalResponse = `I'll update ${functionArgs.notes.length} notes for you. ${aiResponse}`;
        break;

      case "create_shopping_item":
        pendingItems.push({
          type: "shopping",
          operation: "create",
          data: functionArgs,
          functionCall: funcCallDataPayload,
          responseId: responseId,
        });
        finalResponse = `I'll add "${functionArgs.name}" to shopping list. ${aiResponse}`;
        break;

      case "create_multiple_shopping_items":
        functionArgs.items.forEach((item: any) => {
          pendingItems.push({
            type: "shopping",
            operation: "create",
            data: item,
            functionCall: funcCallDataPayload,
            responseId: responseId,
          });
        });
        finalResponse = `I'll add ${functionArgs.items.length} items to the shopping list. ${aiResponse}`;
        break;

      case "edit_shopping_item":
        {
          const { itemId: editItemId, ...shoppingUpdates } = functionArgs;
          const snapshot = await getSnapshot();
          const originalItem = snapshot.shoppingItems.find((item) => item._id === editItemId);

          pendingItems.push({
            type: "shopping",
            operation: "edit",
            data: functionArgs,
            updates: shoppingUpdates,
            originalItem: originalItem || { _id: editItemId },
            functionCall: funcCallDataPayload,
            responseId: responseId,
          });
          finalResponse = `I'll update the shopping item. ${aiResponse}`;
        }
        break;

      case "edit_multiple_shopping_items":
        {
          const snapshot = await getSnapshot();
          for (const item of functionArgs.items as Array<any>) {
            const { itemId: bulkEditItemId, ...bulkItemUpdates } = item;
            const originalBulkItem = snapshot.shoppingItems.find((shoppingItem) => shoppingItem._id === bulkEditItemId);

            pendingItems.push({
              type: "shopping",
              operation: "edit",
              data: item,
              updates: bulkItemUpdates,
              originalItem: originalBulkItem || { _id: bulkEditItemId },
              functionCall: funcCallDataPayload,
              responseId: responseId,
            });
          }
        }
        finalResponse = `I'll update ${functionArgs.items.length} shopping items for you. ${aiResponse}`;
        break;

      case "create_survey":
        pendingItems.push({
          type: "survey",
          operation: "create",
          data: functionArgs,
          functionCall: funcCallDataPayload,
          responseId: responseId,
        });
        finalResponse = `I'll create survey: "${functionArgs.title}". ${aiResponse}`;
        break;

      case "create_multiple_surveys":
        functionArgs.surveys.forEach((survey: any) => {
          pendingItems.push({
            type: "survey",
            operation: "create",
            data: survey,
            functionCall: funcCallDataPayload,
            responseId: responseId,
          });
        });
        finalResponse = `I'll create ${functionArgs.surveys.length} surveys for you. ${aiResponse}`;
        break;

      case "edit_survey":
        {
          const { surveyId: editSurveyId, ...surveyUpdates } = functionArgs;
          const snapshot = await getSnapshot();
          const originalSurvey = snapshot.surveys.find((survey) => survey._id === editSurveyId);

          pendingItems.push({
            type: "survey",
            operation: "edit",
            data: functionArgs,
            updates: surveyUpdates,
            originalItem: originalSurvey || { _id: editSurveyId },
            functionCall: funcCallDataPayload,
            responseId: responseId,
          });
          finalResponse = `I'll update the survey. ${aiResponse}`;
        }
        break;

      case "edit_multiple_surveys":
        {
          const snapshot = await getSnapshot();
          for (const survey of functionArgs.surveys as Array<any>) {
            const { surveyId: bulkEditSurveyId, ...bulkSurveyUpdates } = survey;
            const originalBulkSurvey = snapshot.surveys.find((s) => s._id === bulkEditSurveyId);

            pendingItems.push({
              type: "survey",
              operation: "edit",
              data: survey,
              updates: bulkSurveyUpdates,
              originalItem: originalBulkSurvey || { _id: bulkEditSurveyId },
              functionCall: funcCallDataPayload,
              responseId: responseId,
            });
          }
        }
        finalResponse = `I'll update ${functionArgs.surveys.length} surveys for you. ${aiResponse}`;
        break;

      case "create_contact":
        pendingItems.push({
          type: "contact",
          operation: "create",
          data: functionArgs,
          functionCall: funcCallDataPayload,
          responseId: responseId,
        });
        finalResponse = `I'll create contact: "${functionArgs.name}" (${functionArgs.type}). ${aiResponse}`;
        break;

      case "create_shopping_section":
        pendingItems.push({
          type: "shoppingSection",
          operation: "create",
          data: functionArgs,
          functionCall: funcCallDataPayload,
          responseId: responseId,
        });
        actionSummaries.push(`shopping section: "${functionArgs.name}"`);
        finalResponse = `I'll create a shopping section: "${functionArgs.name}". ${aiResponse}`;
        break;

      case "edit_shopping_section":
        {
          const { sectionId: editSectionId, ...sectionUpdates } = functionArgs;
          // Note: shopping sections are not in the standard snapshot, would need to be added
          pendingItems.push({
            type: "shoppingSection",
            operation: "edit",
            data: functionArgs,
            updates: sectionUpdates,
            originalItem: { _id: editSectionId },
            functionCall: funcCallDataPayload,
            responseId: responseId,
          });
          finalResponse = `I'll update the shopping section. ${aiResponse}`;
        }
        break;

      case "delete_shopping_section":
        pendingItems.push({
          type: "shoppingSection",
          operation: "delete",
          data: { sectionId: functionArgs.sectionId },
          functionCall: funcCallDataPayload,
          responseId: responseId,
        });
        finalResponse = `I'll delete the shopping section. ${aiResponse}`;
        break;

      case "delete_task":
        pendingItems.push({
          type: "task",
          operation: "delete",
          data: { taskId: functionArgs.taskId, reason: functionArgs.reason },
          functionCall: funcCallDataPayload,
          responseId: responseId,
        });
        finalResponse = `I'll delete the task. ${aiResponse}`;
        break;

      case "delete_note":
        pendingItems.push({
          type: "note",
          operation: "delete",
          data: { noteId: functionArgs.noteId, reason: functionArgs.reason },
          functionCall: funcCallDataPayload,
          responseId: responseId,
        });
        finalResponse = `I'll delete the note. ${aiResponse}`;
        break;

      case "delete_shopping_item":
        pendingItems.push({
          type: "shopping",
          operation: "delete",
          data: { itemId: functionArgs.itemId, reason: functionArgs.reason },
          functionCall: funcCallDataPayload,
          responseId: responseId,
        });
        finalResponse = `I'll remove the item from shopping list. ${aiResponse}`;
        break;

      case "delete_survey":
        pendingItems.push({
          type: "survey",
          operation: "delete",
          data: {
            surveyId: functionArgs.surveyId,
            title: functionArgs.title,
            reason: functionArgs.reason,
          },
          functionCall: funcCallDataPayload,
          responseId: responseId,
        });
        finalResponse = `I'll delete the survey "${functionArgs.title}". ${aiResponse}`;
        break;

      case "delete_contact":
        pendingItems.push({
          type: "contact",
          operation: "delete",
          data: { contactId: functionArgs.contactId, reason: functionArgs.reason },
          functionCall: funcCallDataPayload,
          responseId: responseId,
        });
        finalResponse = `I'll delete the contact. ${aiResponse}`;
        break;

      default:
        console.warn("Unhandled function call:", functionCall.name);
        break;
    }
  }

  return {
    pendingItems,
    finalResponse,
    actionSummaries,
  };
};
