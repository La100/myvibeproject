"use node";

/**
 * Myvibe project AI Streaming Chat
 * 
 * Streaming architecture:
 * 1. Client calls initiateStreaming mutation
 * 2. Mutation schedules internalDoStreaming action and returns immediately
 * 3. Client subscribes to listThreadMessages query with threadId
 * 4. Action runs, saves deltas via Convex Agent saveStreamDeltas
 * 5. Client sees streaming updates via query subscription
 * 
 * See: https://docs.convex.dev/agents/streaming
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const apiAny = require("../_generated/api").api as any;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const internalAny = require("../_generated/api").internal as any;
import { components } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { createMyvibeProjectAgent } from "./agent";
import { usdToCredits } from "./billing";
import {
  buildTeamMembersContext,
  buildSystemInstructions,
  getCurrentDateTime,
} from "./helpers/contextBuilder";
import {
  prepareMessageWithFile,
  prepareMessageWithFiles,
  prepareMessageWithOpenAIFiles,
} from "./files";
import type { ProjectContextSnapshot } from "./types";
import { AI_MODEL, calculateCost } from "./config";
import { defaultPrompt } from "./prompt";
import type { Id } from "../_generated/dataModel";
import { buildFallbackResponseFromTools } from "./helpers/streamResponseBuilder";
import { aiDebugLog } from "./helpers/debugLog";

const AI_CREDITS_EXHAUSTED_MESSAGE =
  "You've run out of AI credits. Upgrade your plan or manage billing to continue.";

const READ_ONLY_TOOL_NAMES = new Set([
  "search_items",
  "load_full_project_context",
  "generate_moodboard_image",
]);

/**
 * Internal action that does the actual streaming work
 * Called by scheduler from initializeStreaming mutation - runs in background
 */
export const internalDoStreaming = internalAction({
  args: {
    message: v.string(),
    projectId: v.id("projects"),
    userClerkId: v.string(),
    threadId: v.string(),
    fileId: v.optional(v.union(v.id("files"), v.string())),
    fileIds: v.optional(v.array(v.union(v.id("files"), v.string()))),
    openaiFiles: v.optional(
      v.array(
        v.object({
          fileId: v.string(),
          fileName: v.string(),
          fileType: v.optional(v.string()),
          fileSize: v.optional(v.number()),
        }),
      ),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const startTime = Date.now();
    const agentModeIdentifier = "convex_agent_stream";

    aiDebugLog("🚀 [STREAMING START]", {
      threadId: args.threadId,
      projectId: args.projectId,
      userClerkId: args.userClerkId,
      message: args.message.substring(0, 100) + (args.message.length > 100 ? "..." : ""),
      hasFiles: !!(
        args.fileId ||
        args.fileIds ||
        (args.openaiFiles && args.openaiFiles.length > 0)
      ),
      timestamp: new Date().toISOString(),
    });

    try {
      const providedThreadId = args.threadId;

      aiDebugLog("📝 [THREAD INFO]", {
        providedThreadId,
      });

      // Streaming start

      // Resolve teamId from project
      const projectForTeam = await ctx.runQuery(apiAny.projects.getProject, {
        projectId: args.projectId,
      }) as { teamId?: Id<"teams">; customAiPrompt?: string } | null;
      const teamId = projectForTeam?.teamId ?? null;
      if (!teamId) {
        throw new Error("Unable to resolve teamId");
      }

      // Snapshot loaded on-demand
      let snapshot: ProjectContextSnapshot | null = null;

      const ensureSnapshot = async (): Promise<ProjectContextSnapshot> => {
        if (!snapshot) {
          snapshot = (await ctx.runQuery(internalAny.ai.longContextQueries.getProjectContextSnapshot, {
            projectId: args.projectId,
          })) as unknown as ProjectContextSnapshot;
        }
        return snapshot!;
      };

      // Build system instructions
      // Custom prompt is additive so base guardrails/tool contract always remain active.
      const customPrompt = projectForTeam?.customAiPrompt?.trim();
      const hasCustomPrompt = Boolean(customPrompt && customPrompt !== defaultPrompt.trim());
      const systemPrompt = hasCustomPrompt
        ? `${defaultPrompt}

## Additional Project Instructions
${customPrompt}

Apply these additional instructions when they do not conflict with the tool contract, safety, or confirmation rules above.`
        : defaultPrompt;
      const pendingCallsForContext = (await ctx.runQuery(internalAny.ai.threads.listPendingItemsInternal, {
        threadId: providedThreadId,
        userClerkId: args.userClerkId,
      })) as Array<{ status?: string; functionName: string }>;
      const unresolvedPendingCalls = pendingCallsForContext.filter(
        (call) => call.status === "pending",
      );
      const resolvedConfirmedCalls = pendingCallsForContext.filter(
        (call) => call.status === "confirmed",
      );
      const resolvedRejectedCalls = pendingCallsForContext.filter(
        (call) => call.status === "rejected",
      );
      const pendingActionSummary = unresolvedPendingCalls.reduce((acc, call) => {
        acc[call.functionName] = (acc[call.functionName] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const resolvedActionSummary = pendingCallsForContext.reduce((acc, call) => {
        if (call.status !== "confirmed" && call.status !== "rejected") return acc;
        acc[call.functionName] = acc[call.functionName] ?? { confirmed: 0, rejected: 0 };
        if (call.status === "confirmed") {
          acc[call.functionName].confirmed += 1;
        } else {
          acc[call.functionName].rejected += 1;
        }
        return acc;
      }, {} as Record<string, { confirmed: number; rejected: number }>);
      const pendingActionSection =
        unresolvedPendingCalls.length > 0 ||
        resolvedConfirmedCalls.length > 0 ||
        resolvedRejectedCalls.length > 0
          ? [
            "## Pending Actions Context",
            `Unresolved pending actions: ${unresolvedPendingCalls.length}.`,
            `Resolved outcomes so far: ${resolvedConfirmedCalls.length} confirmed, ${resolvedRejectedCalls.length} rejected.`,
            unresolvedPendingCalls.length > 0
              ? "Treat the next user message as a possible refinement of pending actions unless the user explicitly asks to cancel/reject them."
              : "",
            "Do not describe pending actions as completed until confirmed. Rejected actions were not applied.",
            Object.keys(pendingActionSummary).length > 0
              ? `Pending by tool: ${Object.entries(pendingActionSummary)
                .map(([name, count]) => `${name} (${count})`)
                .join(", ")}`
              : "",
            Object.keys(resolvedActionSummary).length > 0
              ? `Resolved by tool: ${Object.entries(resolvedActionSummary)
                .map(([name, counts]) => `${name} (c:${counts.confirmed}, r:${counts.rejected})`)
                .join(", ")}`
              : "",
          ]
            .filter(Boolean)
            .join("\n")
          : "";
      const effectiveSystemPrompt = pendingActionSection
        ? `${systemPrompt}\n\n${pendingActionSection}`
        : systemPrompt;

      const teamMembers = await ctx.runQuery(internalAny.teams.getTeamMembersWithUserDetails, {
        projectId: args.projectId,
      }) as Array<Record<string, unknown>>;
      const teamMembersContext = buildTeamMembersContext(teamMembers);
      const team = await ctx.runQuery(apiAny.teams.getTeamById, { teamId: teamId! }) as { timezone?: string } | null;
      const timezone = team?.timezone; // Get timezone from team

      const { currentDate, currentDateTime } = getCurrentDateTime(timezone);
      const systemInstructions = buildSystemInstructions(
        effectiveSystemPrompt,
        currentDateTime,
        currentDate,
        teamMembersContext,
        args.userClerkId,
        timezone
      );

      aiDebugLog("📋 [SYSTEM INSTRUCTIONS]", {
        hasCustomPrompt,
        teamMembersCount: teamMembers.length,
        currentDate,
        unresolvedPendingCalls: unresolvedPendingCalls.length,
        resolvedConfirmedCalls: resolvedConfirmedCalls.length,
        resolvedRejectedCalls: resolvedRejectedCalls.length,
      });

      // Prepare user message
      let userPrompt = args.message;
      let userMessageContent:
        | string
        | Array<
          | { type: "text"; text: string }
          | { type: "image"; image: string; mediaType?: string }
          | { type: "file"; data: string; mediaType: string }
        > = userPrompt;
      if (args.openaiFiles && args.openaiFiles.length > 0) {
        const result = await prepareMessageWithOpenAIFiles({
          openaiFiles: args.openaiFiles,
          baseMessage: args.message,
        });
        userPrompt = result.message;
        userMessageContent = result.content;
      } else if (args.fileIds && args.fileIds.length > 0) {
        const result = await prepareMessageWithFiles({
          ctx,
          fileIds: args.fileIds as string[],
          baseMessage: args.message,
        });
        userPrompt = result.message;
        userMessageContent = result.content;
      } else if (args.fileId) {
        const result = await prepareMessageWithFile({
          ctx,
          fileId: args.fileId as string,
          baseMessage: args.message,
        });
        userPrompt = result.message;
        userMessageContent = result.content;
      }

      aiDebugLog("📨 [USER MESSAGE]", {
        messageLength: userPrompt.length,
        hasMultipartContent: Array.isArray(userMessageContent),
        openaiFiles: args.openaiFiles?.length || 0,
        fileIds: args.fileIds?.length || 0,
        fileId: args.fileId || null,
      });

      // Create agent
      const agent = createMyvibeProjectAgent(systemInstructions, {
        projectId: args.projectId as string,
        userClerkId: args.userClerkId,
        runAction: ctx.runAction,
        runQuery: ctx.runQuery,
        loadSnapshot: ensureSnapshot,
      });

      aiDebugLog("🤖 [AGENT CREATED]");

      const agentThreadId = providedThreadId;

      aiDebugLog("🔗 [FINAL THREAD ID]", {
        agentThreadId,
        providedThreadId,
      });

      const aiAccess = await ctx.runQuery(internalAny.stripe.checkAIFeatureAccessByProject, {
        projectId: args.projectId,
      }) as { allowed: boolean; message?: string };

      aiDebugLog("🔐 [AI ACCESS CHECK]", {
        allowed: aiAccess.allowed,
        message: aiAccess.message,
      });

      if (!aiAccess.allowed) {
        const quotaMessage = aiAccess.message || AI_CREDITS_EXHAUSTED_MESSAGE;
        console.error("❌ [AI ACCESS DENIED]", quotaMessage);

        await ctx.runMutation(components.agent.messages.addMessages, {
          threadId: agentThreadId,
          userId: args.userClerkId,
          messages: [
            {
              message: {
                role: "assistant",
                content: quotaMessage,
              },
              text: quotaMessage,
              status: "success",
              finishReason: "stop",
            },
          ],
        });

        await ctx.runMutation(internalAny.ai.threads.updateThreadSummary, {
          threadId: providedThreadId,
          lastMessageAt: Date.now(),
          lastMessagePreview: quotaMessage,
          lastMessageRole: "assistant",
          messageCountDelta: 1,
        });

        return null;
      }

      // Stream via Convex Agent (saves deltas for subscriptions)

      aiDebugLog("🌊 [START STREAMING]", {
        agentThreadId,
        userId: args.userClerkId,
      });

      // REPLAY LOGIC:
      // Fetch confirmed/rejected calls to feed back into agent history
      const replayCalls = (await ctx.runQuery(internalAny.ai.threads.getPendingFunctionCalls, {
        threadId: providedThreadId,
      })) as any[];

      const toolResultMessages: any[] = [];
      const replayedCallIds: string[] = [];

      if (replayCalls && replayCalls.length > 0) {
        aiDebugLog("🔄 [REPLAY] Found calls to replay", { count: replayCalls.length });

        const toolResults = replayCalls.map((call) => {
          replayedCallIds.push(call._id);
          return {
            type: "tool-result",
            toolCallId: call.callId,
            toolName: call.functionName,
            result:
              call.status === "rejected"
                ? JSON.stringify({ error: "User rejected this action." })
                : call.result,
          };
        });

        toolResultMessages.push({
          role: "tool" as const,
          content: toolResults,
        });
      }

      let response;
      try {
        response = await agent.streamText(
          ctx,
          { userId: args.userClerkId, threadId: agentThreadId },
          {
            system: systemInstructions,
            messages: [
              ...toolResultMessages,
              { role: "user" as const, content: userMessageContent },
            ],
            providerOptions: {
              openai: {
                reasoningEffort: "medium",
                reasoningSummary: "auto",
              },
            },
            toolChoice: "auto" as const, // Allow AI to decide when to use tools
          },
          {
            saveStreamDeltas: {
              chunking: "word",
              // throttleMs: 50,
            },
          },
        );
        aiDebugLog("✅ [STREAMING INITIATED]");

        // Mark calls as replayed to prevent duplicate processing
        if (replayedCallIds.length > 0) {
          await ctx.runMutation(internalAny.ai.threads.markFunctionCallsAsReplayed, {
            callIds: replayedCallIds as any,
          });
        }
      } catch (err) {
        console.error("❌ [STREAMING FAILED]", err);
        throw err;
      }

      // Get final result - need to extract from steps when tools are used
      const usage = await response.usage;

      const totalInputTokens = (usage as any)?.inputTokens || (usage as any)?.promptTokens || 0;
      const totalOutputTokens = (usage as any)?.outputTokens || (usage as any)?.completionTokens || 0;

      aiDebugLog("📊 [TOKEN USAGE]", {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      });

      // Extract the latest text from steps (avoid concatenating duplicates)
      const steps = await response.steps;

      aiDebugLog("🔄 [PROCESSING STEPS]", {
        stepsCount: steps?.length || 0,
      });

      let fullResponse = "";
      let shouldPersistSyntheticFallback = false;

      if (steps && Array.isArray(steps)) {
        let latestStepText = "";

        const extractStepText = (step: any): string => {
          let text = "";
          if (typeof step?.text === "string") {
            text = step.text;
          }
          if (step?.content && Array.isArray(step.content)) {
            const contentText = step.content
              .filter((part: any) => part?.type === "text" && typeof part.text === "string")
              .map((part: any) => part.text)
              .join("");
            // If content text exists, prefer it; otherwise keep text
            if (contentText.length > 0) {
              text = contentText;
            }
          }
          return text;
        };

        for (const step of steps) {
          const stepText = extractStepText(step);
          if (stepText && stepText.trim().length > 0) {
            latestStepText = stepText;
          }
        }

        fullResponse = latestStepText;
      }

      // Fallback to response.text if steps didn't have content
      if (!fullResponse) {
        fullResponse = await response.text;
      }

      // Extract tool calls first (moved up for availability)
      const allToolCalls: any[] = [];
      const allToolResults: any[] = [];
      const toolResultMap = new Map<string, any>();

      // Collect tool calls and results from the response steps
      if (steps && Array.isArray(steps)) {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          aiDebugLog(`📋 [STEP ${i + 1}/${steps.length}]`, {
            hasToolCalls: !!step.toolCalls,
            toolCallsCount: step.toolCalls?.length || 0,
            toolNames: step.toolCalls?.map((tc: any) => tc.toolName || tc.name) || [],
            hasToolResults: !!step.toolResults,
            toolResultsCount: step.toolResults?.length || 0,
            hasText: !!step.text,
            textLength: step.text?.length || 0,
          });
          if (step.toolCalls && Array.isArray(step.toolCalls)) {
            allToolCalls.push(...step.toolCalls);
          }
          if (step.toolResults && Array.isArray(step.toolResults)) {
            for (const result of step.toolResults) {
              allToolResults.push(result);
              const resultId = (result as any)?.toolCallId || (result as any)?.id;
              if (resultId) {
                toolResultMap.set(resultId, result);
              }
            }
          }
        }
      }

      // If still empty, but we had tool calls, derive fallback from tool results
      if (!fullResponse && allToolCalls.length > 0) {
        const toolSummary = buildFallbackResponseFromTools(allToolCalls, allToolResults);
        if (toolSummary) {
          fullResponse = toolSummary;
        } else {
          fullResponse = "✅ Operation completed";
        }
      }

      // Guard against empty assistant messages.
      if ((!fullResponse || fullResponse.trim().length === 0) && totalOutputTokens === 0) {
        fullResponse = "I'm sorry, I couldn't generate a response. Please try again.";
        shouldPersistSyntheticFallback = true;
      }

      aiDebugLog("💬 [FINAL RESPONSE]", {
        responseLength: fullResponse.length,
        responsePreview: fullResponse.substring(0, 100) + (fullResponse.length > 100 ? "..." : ""),
        toolCallsCount: allToolCalls.length,
      });

      if (allToolCalls.length > 0) {

        aiDebugLog("🔧 [PROCESSING TOOL CALLS]", {
          toolCallsCount: allToolCalls.length,
          toolNames: allToolCalls.map((tc: any) => tc.toolName || tc.name).filter(Boolean),
        });

        const functionCalls: Array<{
          callId: string;
          functionName: string;
          arguments: string;
        }> = [];

        // Fallback map so generic tools still create pending items even if parsing fails.
        const toolNameDefaults: Record<string, { type?: string; operation?: string }> = {
          create_item: { operation: 'create' },
          create_multiple_items: { operation: 'bulk_create' },
          update_item: { operation: 'edit' },
          update_multiple_items: { operation: 'bulk_edit' },
          delete_item: { operation: 'delete' },
          update_project_settings: { type: 'projectSettings', operation: 'edit' },
        };

        for (let i = 0; i < allToolCalls.length; i++) {
          const toolCall = allToolCalls[i] as any;
          // Create function call record - handle different property names
          const toolCallId = toolCall.toolCallId || toolCall.id || `tc_${Date.now()}_${i}`;
          const toolResult = toolResultMap.get(toolCallId) ?? (allToolResults[i] as any);

          const toolName = toolCall.toolName || toolCall.name || "unknown";
          const toolArgs = toolCall.args || toolCall.input || toolCall.arguments || {};

          // Skip read-only tools - they shouldn't create pending items
          if (READ_ONLY_TOOL_NAMES.has(toolName)) {
            continue;
          }

          // Parse tool result to verify it's an action item and persist full payload
          const resultValue = toolResult?.result || toolResult?.output || toolResult;
          let payload: any = undefined;

          // Try parsing tool result first
          if (resultValue) {
            try {
              const parsed = typeof resultValue === 'string'
                ? JSON.parse(resultValue)
                : resultValue;
              if (parsed && typeof parsed === 'object') {
                payload = parsed;
              }
            } catch {
              // Could not parse tool result
            }
          }

          // Fallback payload based on tool name/args when parsing fails or lacks type/operation
          if (!payload || !payload.type || !payload.operation) {
            const defaults = toolNameDefaults[toolName];
            const normalizedArgs = typeof toolArgs === 'string'
              ? (() => { try { return JSON.parse(toolArgs); } catch { return toolArgs; } })()
              : toolArgs;

            // Handle case where parsing returns a string (double JSON stringified)
            const finalArgs = typeof normalizedArgs === 'string'
              ? (() => { try { return JSON.parse(normalizedArgs); } catch { return normalizedArgs; } })()
              : normalizedArgs;

            const inferredType =
              payload?.type ??
              (
                finalArgs &&
                typeof finalArgs === "object" &&
                typeof (finalArgs as { type?: unknown }).type === "string"
                  ? (finalArgs as { type: string }).type
                  : undefined
              ) ??
              defaults?.type;
            const inferredOperation =
              payload?.operation ??
              (
                finalArgs &&
                typeof finalArgs === "object" &&
                typeof (finalArgs as { operation?: unknown }).operation === "string"
                  ? (finalArgs as { operation: string }).operation
                  : undefined
              ) ??
              defaults?.operation;

            payload = {
              ...(payload && typeof payload === 'object' ? payload : {}),
              type: inferredType,
              operation: inferredOperation,
              data: payload?.data ?? finalArgs ?? {},
            };
          } else if (!payload.data) {
            payload.data = toolArgs ?? {};
          }

          const payloadHasError =
            payload &&
            typeof payload === "object" &&
            typeof payload.error === "string";

          if (payloadHasError) {
            continue;
          }

          const hasSupportedOperation =
            typeof payload?.operation === "string" &&
            ["create", "bulk_create", "edit", "bulk_edit", "delete"].includes(payload.operation);

          // Only persist actionable items with type + operation
          if (payload?.type && hasSupportedOperation) {
            functionCalls.push({
              callId: toolCallId,
              functionName: toolName,
              arguments: JSON.stringify(payload),
            });
          }
        }

        const pendingCalls = await ctx.runQuery(internalAny.ai.threads.listPendingItemsInternal, {
          threadId: providedThreadId,
          userClerkId: args.userClerkId,
        }) as Array<{ callId: string; status?: string; responseId: string; arguments?: string }>;
        const unresolvedPendingCalls = pendingCalls.filter(
          (call) => call.status === "pending",
        );

        let replacedExistingPendingCall = false;
        const shouldReplacePending =
          unresolvedPendingCalls.length === 1 &&
          functionCalls.length === 1;

        if (shouldReplacePending) {
          const pendingCall = unresolvedPendingCalls[0];
          const safeParse = (value?: string) => {
            if (!value) return null;
            try {
              return JSON.parse(value);
            } catch {
              return null;
            }
          };
          const pendingPayload = safeParse(pendingCall.arguments);
          const nextPayload = safeParse(functionCalls[0].arguments);

          const isPendingCreateTask =
            pendingPayload?.type === "task" && pendingPayload?.operation === "create";

          if (isPendingCreateTask && nextPayload?.type === "task") {
            const pendingData = (pendingPayload?.data ?? {}) as Record<string, unknown>;
            const nextData = (nextPayload?.data ?? {}) as Record<string, unknown>;
            const mergedData = { ...pendingData, ...nextData } as Record<string, unknown>;

            const mergedPayload = {
              ...pendingPayload,
              type: "task",
              operation: "create",
              data: mergedData,
            };

            functionCalls[0] = {
              ...functionCalls[0],
              functionName: "create_item",
              arguments: JSON.stringify(mergedPayload),
            };

            await ctx.runMutation(internalAny.ai.threads.replacePendingFunctionCall, {
              threadId: providedThreadId,
              responseId: pendingCall.responseId,
              callId: pendingCall.callId,
              functionName: "create_item",
              arguments: functionCalls[0].arguments,
            });
            replacedExistingPendingCall = true;
          }
        }

        const actionFunctionCalls = functionCalls.filter(
          (fc) => !READ_ONLY_TOOL_NAMES.has(fc.functionName)
        );

        if (replacedExistingPendingCall) {
          aiDebugLog("♻️ [PENDING REFINED IN PLACE]", {
            threadId: providedThreadId,
            replacedCallCount: 1,
          });
        } else if (actionFunctionCalls.length > 0) {
          const responseId = `resp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

          aiDebugLog("💾 [SAVE FUNCTION CALLS]", {
            responseId,
            functionCallsCount: actionFunctionCalls.length,
            functionNames: actionFunctionCalls.map((fc) => fc.functionName),
            filteredOutCount: functionCalls.length - actionFunctionCalls.length,
          });

          await ctx.runMutation(internalAny.ai.threads.saveFunctionCalls, {
            threadId: providedThreadId,
            projectId: args.projectId,
            responseId,
            functionCalls: actionFunctionCalls,
          });
        } else {

          aiDebugLog("⚠️ [NO FUNCTION CALLS TO SAVE]", {
            allToolCallsCount: allToolCalls.length,
            message: "Tool calls did not generate pending items (read-only or parsing failed)",
          });

          // Heuristic: if user asked to delete and search_items returned shopping matches, auto-stage delete.
          const userAskedToDelete = /\b(delete|remove)\b/i.test(args.message);
          const onlyItemSearch =
            allToolCalls.length === 1 &&
            (allToolCalls[0]?.toolName || allToolCalls[0]?.name) === "search_items";

          if (userAskedToDelete && onlyItemSearch && allToolResults.length === 1) {
            const rawResult = allToolResults[0]?.result || allToolResults[0]?.output || allToolResults[0];
            try {
              const parsed = typeof rawResult === "string" ? JSON.parse(rawResult) : rawResult;
              const items = Array.isArray(parsed?.items) ? parsed.items : [];

              // If many items, stage individual delete calls so UI can show bulk grid
              if (items.length > 1) {
                const responseId = `resp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                const functionCalls = items.map((item: any, idx: number) => {
                  const itemId = item?.id || item?._id || `unknown_${idx}`;
                  return {
                    callId: `auto_delete_${itemId}`,
                    functionName: "delete_item",
                    arguments: JSON.stringify({
                      type: "shopping",
                      operation: "delete",
                      data: { itemId, name: item?.name },
                    }),
                  };
                });

                await ctx.runMutation(internalAny.ai.threads.saveFunctionCalls, {
                  threadId: providedThreadId,
                  projectId: args.projectId,
                  responseId,
                  functionCalls,
                });
              } else {
                const firstItem = items[0];
                const itemId = firstItem?.id || firstItem?._id;
                if (itemId) {
                  const responseId = `resp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                  const autoCall = {
                    callId: `auto_delete_${itemId}`,
                    functionName: "delete_item",
                    arguments: JSON.stringify({
                      type: "shopping",
                      operation: "delete",
                      data: { itemId, name: firstItem?.name },
                    }),
                  };
                  await ctx.runMutation(internalAny.ai.threads.saveFunctionCalls, {
                    threadId: providedThreadId,
                    projectId: args.projectId,
                    responseId,
                    functionCalls: [autoCall],
                  });
                }
              }
            } catch {
              // Failed to auto-stage delete after shopping search
            }
          }
        }
      }

      if (shouldPersistSyntheticFallback) {
        await ctx.runMutation(components.agent.messages.addMessages, {
          threadId: agentThreadId,
          userId: args.userClerkId,
          messages: [
            {
              message: {
                role: "assistant",
                content: fullResponse,
              },
              text: fullResponse,
              status: "success",
              finishReason: "stop",
            },
          ],
        });
      }

      // Calculate token usage
      const tokenUsage = {
        inputTokens: totalInputTokens || Math.ceil(userPrompt.length / 4),
        outputTokens: totalOutputTokens || Math.ceil(fullResponse.length / 4),
        totalTokens: (totalInputTokens || Math.ceil(userPrompt.length / 4)) +
          (totalOutputTokens || Math.ceil(fullResponse.length / 4)),
        estimatedCostUSD: calculateCost(AI_MODEL,
          totalInputTokens || Math.ceil(userPrompt.length / 4),
          totalOutputTokens || Math.ceil(fullResponse.length / 4)
        ),
      };
      const billableTokens = usdToCredits(tokenUsage.estimatedCostUSD);

      const responseTime = Date.now() - startTime;

      aiDebugLog("📝 [UPDATE THREAD SUMMARY]", {
        threadId: providedThreadId,
        responsePreview: fullResponse.substring(0, 50) + "...",
      });

      await ctx.runMutation(internalAny.ai.threads.updateThreadSummary, {
        threadId: providedThreadId,
        lastMessageAt: Date.now(),
        lastMessagePreview: fullResponse,
        lastMessageRole: "assistant",
        messageCountDelta: 1,
      });

      aiDebugLog("💰 [SAVE TOKEN USAGE]", {
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        totalTokens: tokenUsage.totalTokens,
        estimatedCostUSD: tokenUsage.estimatedCostUSD,
        responseTimeMs: responseTime,
      });

      // Save usage statistics
      await ctx.runMutation(internalAny.ai.usage.saveTokenUsage, {
        projectId: args.projectId,
        teamId: teamId as Id<"teams">,
        userClerkId: args.userClerkId,
        threadId: providedThreadId,
        model: AI_MODEL,
        feature: "assistant",
        requestType: "chat",
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        totalTokens: tokenUsage.totalTokens,
        billableTokens,
        contextSize: 0,
        mode: agentModeIdentifier,
        estimatedCostCents: Math.round(tokenUsage.estimatedCostUSD * 100),
        responseTimeMs: responseTime,
        success: true,
      });

      // Streaming completed
      aiDebugLog("✅ [STREAMING COMPLETED]", {
        threadId: providedThreadId,
        responseTimeMs: responseTime,
        success: true,
      });

      return null;
    } catch (error) {
      console.error("❌ [STREAMING ERROR]", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        threadId: args.threadId,
      });
      return null;
    }
  },
});
