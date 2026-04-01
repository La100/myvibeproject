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

type ModelFunctionCall = {
  call_id: string;
  name: string;
  arguments: string;
};

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

const inferManagedType = (
  functionName: string,
  functionArgs: Record<string, unknown>,
): PendingItem["type"] | null => {
  const entity = functionArgs.entity;
  switch (functionName) {
    case "manage_tasks":
      return "task";
    case "manage_notes":
      return "note";
    case "manage_contacts":
      return "contact";
    case "manage_surveys":
      return "survey";
    case "manage_shopping":
      return entity === "section" ? "shoppingSection" : "shopping";
    case "manage_labor":
      return entity === "section" ? "laborSection" : "labor";
    default:
      return null;
  }
};

const findOriginalItem = (
  snapshot: ProjectContextSnapshot,
  type: PendingItem["type"],
  itemId: string,
) => {
  if (type === "task") {
    return snapshot.tasks.find((item) => item._id === itemId) || { _id: itemId };
  }
  if (type === "note") {
    return snapshot.notes.find((item) => item._id === itemId) || { _id: itemId };
  }
  if (type === "shopping") {
    return snapshot.shoppingItems.find((item) => item._id === itemId) || { _id: itemId };
  }
  if (type === "survey") {
    return snapshot.surveys.find((item) => item._id === itemId) || { _id: itemId };
  }
  if (type === "contact") {
    return snapshot.contacts.find((item) => item._id === itemId) || { _id: itemId };
  }
  return { _id: itemId };
};

export const processFunctionCalls = async (
  functionCalls: ModelFunctionCall[],
  aiResponse: string,
  teamMembers: TeamMember[],
  getSnapshot: () => Promise<ProjectContextSnapshot>,
  responseId: string,
): Promise<FunctionCallResult> => {
  const pendingItems: PendingItem[] = [];
  const actionSummaries: string[] = [];
  let finalResponse = aiResponse;

  for (const functionCall of functionCalls) {
    let functionArgs: Record<string, unknown>;
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
      case "manage_tasks":
      case "manage_notes":
      case "manage_contacts":
      case "manage_shopping":
      case "manage_labor":
      case "manage_surveys":
        {
          const type = inferManagedType(functionCall.name, functionArgs);
          const action = functionArgs.action;
          const data =
            functionArgs.data && typeof functionArgs.data === "object"
              ? (functionArgs.data as Record<string, unknown>)
              : {};

          if (!type || (action !== "create" && action !== "update" && action !== "delete")) {
            break;
          }

          if (type === "task" && typeof data.assignedTo === "string") {
            const resolved = resolveTeamMember(data.assignedTo, teamMembers);
            if (resolved) {
              data.assignedTo = resolved.clerkUserId;
              data.assignedToName = resolved.name;
            } else {
              data.assignedTo = null;
            }
          }

          if (action === "create") {
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
            break;
          }

          const itemId =
            typeof functionArgs.itemId === "string"
              ? functionArgs.itemId
              : typeof functionArgs.taskId === "string"
                ? functionArgs.taskId
                : typeof functionArgs.noteId === "string"
                  ? functionArgs.noteId
                  : typeof functionArgs.contactId === "string"
                    ? functionArgs.contactId
                    : typeof functionArgs.surveyId === "string"
                      ? functionArgs.surveyId
                      : typeof functionArgs.sectionId === "string"
                        ? functionArgs.sectionId
                        : typeof functionArgs.id === "string"
                          ? functionArgs.id
                          : undefined;

          if (!itemId) {
            break;
          }

          if (action === "update") {
            const snapshot = await getSnapshot();
            pendingItems.push({
              type,
              operation: "edit",
              data: { ...data, itemId },
              updates: data,
              originalItem: findOriginalItem(snapshot, type, itemId),
              functionCall: funcCallDataPayload,
              responseId,
            });

            finalResponse = `I'll update the ${type}. ${aiResponse}`;
            break;
          }

          pendingItems.push({
            type,
            operation: "delete",
            data: {
              itemId,
              name:
                (typeof data.name === "string" && data.name) ||
                (typeof data.title === "string" && data.title) ||
                undefined,
              reason: typeof data.reason === "string" ? data.reason : undefined,
            },
            functionCall: funcCallDataPayload,
            responseId,
          });

          finalResponse =
            typeof data.name === "string" || typeof data.title === "string"
              ? `I'll delete the ${type} "${String(data.name ?? data.title)}". ${aiResponse}`
              : `I'll delete the ${type}. ${aiResponse}`;
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
