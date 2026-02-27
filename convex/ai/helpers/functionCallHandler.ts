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
    let functionArgs: any;
    try {
      const parsedArgs = JSON.parse(functionCall.arguments);
      functionArgs =
        parsedArgs && typeof parsedArgs === "object" && !Array.isArray(parsedArgs)
          ? parsedArgs
          : {};
    } catch (error) {
      console.error("Failed to parse function call arguments", {
        name: functionCall.name,
        callId: functionCall.call_id,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
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

      case "update_project_settings":
        {
          const snapshot = await getSnapshot();

          pendingItems.push({
            type: "projectSettings",
            operation: "edit",
            data: functionArgs,
            updates: functionArgs,
            originalItem: snapshot.project || {},
            functionCall: funcCallDataPayload,
            responseId,
          });

          finalResponse = `I'll update project settings. ${aiResponse}`;
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
