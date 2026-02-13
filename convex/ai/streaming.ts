"use node";

/**
 * Myvibe project AI Streaming Chat
 * 
 * Streaming architecture:
 * 1. Client calls /api/ai/stream which calls initializeStreaming mutation
 * 2. Mutation schedules internalDoStreaming action and returns immediately
 * 3. Client subscribes to listStreamingMessages query with threadId
 * 4. Action runs, saves deltas to DB as they're generated via Convex Agent saveStreamDeltas
 * 5. Client sees streaming updates via query subscription
 * 
 * See: https://docs.convex.dev/agents/streaming
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const apiAny = require("../_generated/api").api as any;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const internalAny = require("../_generated/api").internal as any;
import { components } from "../_generated/api";
import { action, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { createMyvibeProjectAgent } from "./agent";
import {
  buildTeamMembersContext,
  buildSystemInstructions,
  getCurrentDateTime,
} from "./helpers/contextBuilder";
import { prepareMessageWithFile, prepareMessageWithFiles } from "./files";
import type { ProjectContextSnapshot } from "./types";
import { AI_MODEL, calculateCost } from "./config";
import { defaultPrompt } from "./prompt";
import type { Id } from "../_generated/dataModel";
import { buildFallbackResponseFromTools } from "./helpers/streamResponseBuilder";

const AI_CREDITS_EXHAUSTED_MESSAGE =
  "You've run out of AI credits. Contact your administrator to add more tokens.";

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
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const startTime = Date.now();
    const agentModeIdentifier = "convex_agent_stream";

    console.log("🚀 [STREAMING START]", {
      threadId: args.threadId,
      projectId: args.projectId,
      userClerkId: args.userClerkId,
      message: args.message.substring(0, 100) + (args.message.length > 100 ? "..." : ""),
      hasFiles: !!(args.fileId || args.fileIds),
      timestamp: new Date().toISOString(),
    });

    try {
      const providedThreadId = args.threadId;
      const isLegacyThreadId = providedThreadId.startsWith("thread-") || providedThreadId.startsWith("thread_");

      console.log("📝 [THREAD INFO]", {
        providedThreadId,
        isLegacyThreadId,
      });

      // AUTO-REJECT LOGIC:
      // If there are any pending function calls from previous turns, reject them now.
      // This allows the user to "cancel" a pending action simply by sending a new message.
      const pendingCalls = await ctx.runQuery(apiAny.ai.threads.listPendingItems, {
        threadId: providedThreadId,
      }) as Array<{ status: string; callId: string; responseId: string }>;

      if (pendingCalls.length > 0) {
        // Filter to only actual pending items to avoid touching history
        const actuallyPending = pendingCalls.filter(c => c.status === "pending");

        if (actuallyPending.length > 0) {
          console.log("🚫 [AUTO-REJECT] Found pending calls, rejecting them before new message", {
            count: actuallyPending.length,
            callIds: actuallyPending.map(c => c.callId),
          });

          // Group by responseId for efficient batch updates
          const pendingByResponse = new Map<string, Array<{ callId: string; result?: string | null }>>();
          for (const call of actuallyPending) {
            const list = pendingByResponse.get(call.responseId) || [];
            list.push({ callId: call.callId, result: null }); // null result = reject
            pendingByResponse.set(call.responseId, list);
          }

          // Execute rejections
          for (const [responseId, results] of pendingByResponse.entries()) {
            await ctx.runMutation(apiAny.ai.threads.markFunctionCallsAsConfirmed, {
              threadId: providedThreadId,
              responseId,
              results: results.map((r) => ({ ...r, status: "rejected" })) as any,
            });
          }
        }
      }

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
      // Use custom AI prompt from project if available, otherwise use default
      const systemPrompt = projectForTeam?.customAiPrompt || defaultPrompt;

      const teamMembers = await ctx.runQuery(internalAny.teams.getTeamMembersWithUserDetails, {
        projectId: args.projectId,
      }) as Array<Record<string, unknown>>;
      const teamMembersContext = buildTeamMembersContext(teamMembers);
      const team = await ctx.runQuery(apiAny.teams.getTeamById, { teamId: teamId! }) as { timezone?: string } | null;
      const timezone = team?.timezone; // Get timezone from team

      const { currentDate, currentDateTime } = getCurrentDateTime(timezone);
      const systemInstructions = buildSystemInstructions(
        systemPrompt,
        currentDateTime,
        currentDate,
        teamMembersContext,
        args.userClerkId,
        timezone
      );

      console.log("📋 [SYSTEM INSTRUCTIONS]", {
        hasCustomPrompt: !!projectForTeam?.customAiPrompt,
        teamMembersCount: teamMembers.length,
        currentDate,
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
      if (args.fileIds && args.fileIds.length > 0) {
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

      console.log("📨 [USER MESSAGE]", {
        messageLength: userPrompt.length,
        hasMultipartContent: Array.isArray(userMessageContent),
        fileIds: args.fileIds?.length || 0,
        fileId: args.fileId || null,
      });

      // Create agent
      const agent = createMyvibeProjectAgent(systemInstructions, {
        projectId: args.projectId as string,
        runAction: ctx.runAction,
        loadSnapshot: ensureSnapshot,
      });

      console.log("🤖 [AGENT CREATED]");

      // Determine the agent thread ID
      let agentThreadId: string | undefined;

      if (isLegacyThreadId) {
        // Legacy thread ID - look up or create mapping
        const mapping: any = await ctx.runQuery(internalAny.ai.threads.getThreadForResponses, {
          threadId: providedThreadId
        });
        if (mapping && mapping.agentThreadId) {
          agentThreadId = mapping.agentThreadId;
          console.log("🔗 [FOUND EXISTING MAPPING]", {
            legacyThreadId: providedThreadId,
            agentThreadId,
          });
        } else {
          // Create new agent thread for legacy ID
          console.log("🆕 [CREATE NEW AGENT THREAD]");
          const createResult = await agent.createThread(ctx, {
            userId: args.userClerkId,
          });
          agentThreadId = createResult.threadId;

          console.log("💾 [SAVE THREAD MAPPING]", {
            legacyThreadId: providedThreadId,
            agentThreadId: agentThreadId,
          });

          await ctx.runMutation(internalAny.ai.threads.saveAgentThreadMapping, {
            threadId: providedThreadId,
            agentThreadId: agentThreadId
          });
        }
      } else {
        // Not a legacy ID - providedThreadId IS the agent thread ID
        // (created via createThread in the mutation)
        agentThreadId = providedThreadId;
        console.log("✅ [USING DIRECT AGENT THREAD ID]", {
          agentThreadId,
        });
      }

      console.log("🔗 [FINAL THREAD ID]", {
        agentThreadId,
        providedThreadId,
      });

      if (!agentThreadId) {
        throw new Error("Unable to resolve agent thread ID");
      }

      const aiAccess = await ctx.runQuery(internalAny.stripe.checkAIFeatureAccessByProject, {
        projectId: args.projectId,
      }) as { allowed: boolean; message?: string };

      console.log("🔐 [AI ACCESS CHECK]", {
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

      console.log("🌊 [START STREAMING]", {
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
        console.log("🔄 [REPLAY] Found calls to replay", { count: replayCalls.length });

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
            toolChoice: "auto" as const, // Allow AI to decide when to use tools
          },
          {
            saveStreamDeltas: {
              chunking: "word",
              // throttleMs: 50,
            },
          },
        );
        console.log("✅ [STREAMING INITIATED]");

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

      console.log("📊 [TOKEN USAGE]", {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      });

      // Extract the latest text from steps (avoid concatenating duplicates)
      const steps = await response.steps;

      console.log("🔄 [PROCESSING STEPS]", {
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
          console.log(`📋 [STEP ${i + 1}/${steps.length}]`, {
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

      console.log("💬 [FINAL RESPONSE]", {
        responseLength: fullResponse.length,
        responsePreview: fullResponse.substring(0, 100) + (fullResponse.length > 100 ? "..." : ""),
        toolCallsCount: allToolCalls.length,
      });

      if (allToolCalls.length > 0) {

        console.log("🔧 [PROCESSING TOOL CALLS]", {
          toolCallsCount: allToolCalls.length,
          toolNames: allToolCalls.map((tc: any) => tc.toolName || tc.name).filter(Boolean),
        });

        // Tools that should NOT create pending items (read-only/search tools)
        const readOnlyTools = new Set([
          'search_tasks',
          'search_shopping_items',
          'search_notes',
          'search_surveys',
          'search_contacts',
          'load_full_project_context',
        ]);

        const functionCalls: Array<{
          callId: string;
          functionName: string;
          arguments: string;
        }> = [];

        // Fallback map so delete/edit tools still create pending items even if parsing fails
        const toolNameDefaults: Record<string, { type: string; operation?: string }> = {
          delete_task: { type: 'task', operation: 'delete' },
          delete_note: { type: 'note', operation: 'delete' },
          delete_shopping_item: { type: 'shopping', operation: 'delete' },
          delete_shopping_section: { type: 'shoppingSection', operation: 'delete' },
          delete_survey: { type: 'survey', operation: 'delete' },
          delete_contact: { type: 'contact', operation: 'delete' },
          edit_task: { type: 'task', operation: 'edit' },
          edit_note: { type: 'note', operation: 'edit' },
          edit_shopping_item: { type: 'shopping', operation: 'edit' },
          edit_shopping_section: { type: 'shoppingSection', operation: 'edit' },
          edit_survey: { type: 'survey', operation: 'edit' },
          edit_contact: { type: 'contact', operation: 'edit' },
          create_multiple_tasks: { type: 'task', operation: 'bulk_create' },
          create_multiple_notes: { type: 'note', operation: 'bulk_create' },
          create_multiple_shopping_items: { type: 'shopping', operation: 'bulk_create' },
          create_multiple_surveys: { type: 'survey', operation: 'bulk_create' },
        };

        for (let i = 0; i < allToolCalls.length; i++) {
          const toolCall = allToolCalls[i] as any;
          // Create function call record - handle different property names
          const toolCallId = toolCall.toolCallId || toolCall.id || `tc_${Date.now()}_${i}`;
          const toolResult = toolResultMap.get(toolCallId) ?? (allToolResults[i] as any);

          const toolName = toolCall.toolName || toolCall.name || "unknown";
          const toolArgs = toolCall.args || toolCall.input || toolCall.arguments || {};

          // Skip read-only tools - they shouldn't create pending items
          if (readOnlyTools.has(toolName)) {
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

            payload = {
              ...(payload && typeof payload === 'object' ? payload : {}),
              type: payload?.type ?? defaults?.type ?? toolName,
              operation: payload?.operation ?? defaults?.operation,
              data: payload?.data ?? finalArgs ?? {},
            };
          } else if (!payload.data) {
            payload.data = toolArgs ?? {};
          }

          // Only persist if we have at least a type
          if (payload?.type) {
            functionCalls.push({
              callId: toolCallId,
              functionName: toolName,
              arguments: JSON.stringify(payload),
            });
          }
        }

        const pendingCalls = await ctx.runQuery(apiAny.ai.threads.listPendingItems, {
          threadId: providedThreadId,
        }) as Array<{ callId: string; status: string; responseId: string; arguments?: string }>;

        const shouldReplacePending =
          pendingCalls.length === 1 &&
          functionCalls.length === 1;

        if (shouldReplacePending) {
          const pendingCall = pendingCalls[0];
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
            delete mergedData.taskId;

            const mergedPayload = {
              ...pendingPayload,
              type: "task",
              operation: "create",
              data: mergedData,
            };

            functionCalls[0] = {
              ...functionCalls[0],
              functionName: "create_task",
              arguments: JSON.stringify(mergedPayload),
            };

            const groupedResults = new Map<string, { callId: string; result: string | undefined }[]>();
            const responseId = pendingCall.responseId;
            groupedResults.set(responseId, [
              { callId: pendingCall.callId, result: undefined },
            ]);

            for (const [responseId, results] of groupedResults.entries()) {
              await ctx.runMutation(apiAny.ai.threads.markFunctionCallsAsConfirmed, {
                threadId: providedThreadId,
                responseId,
                results,
              });
            }
          }
        }

        // Save action function calls to database for confirmation UI
        // Filter out read-only tools that don't require confirmation
        const READ_ONLY_TOOLS = new Set([
          "search_items",
          "search_tasks",
          "search_notes",
          "search_shopping_items",
          "search_labor_items",
          "search_surveys",
          "search_contacts",
          "load_full_project_context",
        ]);

        const actionFunctionCalls = functionCalls.filter(
          (fc) => !READ_ONLY_TOOLS.has(fc.functionName)
        );

        if (actionFunctionCalls.length > 0) {
          const responseId = `resp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

          console.log("💾 [SAVE FUNCTION CALLS]", {
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

          console.log("⚠️ [NO FUNCTION CALLS TO SAVE]", {
            allToolCallsCount: allToolCalls.length,
            message: "Tool calls did not generate pending items (read-only or parsing failed)",
          });

          // Heuristic: if user asked to delete and search_shopping_items returned exactly one item, auto-stage delete
          const userAskedToDelete = /\b(delete|remove|usun|usuń)\b/i.test(args.message);
          const onlyShoppingSearch =
            allToolCalls.length === 1 &&
            (allToolCalls[0]?.toolName || allToolCalls[0]?.name) === "search_shopping_items";

          if (userAskedToDelete && onlyShoppingSearch && allToolResults.length === 1) {
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
                    functionName: "delete_shopping_item",
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
                    functionName: "delete_shopping_item",
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

      const responseTime = Date.now() - startTime;

      console.log("📝 [UPDATE THREAD SUMMARY]", {
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

      console.log("💰 [SAVE TOKEN USAGE]", {
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
        contextSize: 0,
        mode: agentModeIdentifier,
        estimatedCostCents: Math.round(tokenUsage.estimatedCostUSD * 100),
        responseTimeMs: responseTime,
        success: true,
      });

      // Streaming completed
      console.log("✅ [STREAMING COMPLETED]", {
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

/**
 * Public action for backwards compatibility
 * Now schedules streaming via mutation and returns immediately
 */
export const startStreamingChat = action({
  args: {
    message: v.string(),
    projectId: v.id("projects"),
    userClerkId: v.string(),
    threadId: v.optional(v.string()),
    fileId: v.optional(v.union(v.id("files"), v.string())),
    fileIds: v.optional(v.array(v.union(v.id("files"), v.string()))),
  },
  returns: v.object({
    threadId: v.string(),
    agentThreadId: v.optional(v.string()),
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{
    threadId: string;
    agentThreadId: string | undefined;
    success: boolean;
    error?: string;
  }> => {
    console.log("🎬 [START STREAMING CHAT ACTION]", {
      projectId: args.projectId,
      userClerkId: args.userClerkId,
      hasThreadId: !!args.threadId,
      messageLength: args.message.length,
    });

    try {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        console.error("❌ [UNAUTHORIZED] No identity");
        throw new Error("Unauthorized");
      }

      if (identity.subject !== args.userClerkId) {
        console.error("❌ [FORBIDDEN] Identity mismatch");
        throw new Error("Forbidden");
      }

      const project = await ctx.runQuery(apiAny.projects.getProject, { projectId: args.projectId }) as { teamId: Id<"teams"> } | null;
      if (!project) {
        throw new Error("Project not found");
      }

      const membership = await ctx.runQuery(apiAny.teams.getCurrentUserTeamMember, {
        teamId: project.teamId,
      }) as { isActive?: boolean } | null;

      if (!membership || membership.isActive === false) {
        throw new Error("Forbidden");
      }

      // Generate threadId if not provided
      const providedThreadId = typeof args.threadId === "string" && args.threadId.trim().length > 0
        ? args.threadId
        : `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      await ctx.runMutation(internalAny.activityLog.logActivity, {
        teamId: project.teamId,
        actionType: "analytics.ai.message_sent",
        details: {
          threadId: providedThreadId,
          hasFiles: Boolean(args.fileId || (args.fileIds && args.fileIds.length > 0)),
          messageLength: args.message.length,
        },
        entityId: providedThreadId,
        entityType: "ai_thread",
      });

      console.log("📅 [SCHEDULE STREAMING]", {
        providedThreadId,
        isNewThread: !args.threadId,
      });

      // Call the mutation to initialize and schedule streaming
      // Type annotation to break circular reference
      await ctx.scheduler.runAfter(0, internalAny.ai.streaming.internalDoStreaming, {
        message: args.message,
        projectId: args.projectId,
        userClerkId: args.userClerkId,
        threadId: providedThreadId,
        fileId: args.fileId,
        fileIds: args.fileIds,
      });

      console.log("✅ [STREAMING SCHEDULED]", {
        threadId: providedThreadId,
      });

      return {
        threadId: providedThreadId,
        agentThreadId: undefined,
        success: true,
      };
    } catch (error) {
      console.error("❌ [ERROR SCHEDULING STREAMING]", {
        error: error instanceof Error ? error.message : String(error),
        threadId: args.threadId,
      });
      return {
        threadId: args.threadId || "",
        agentThreadId: undefined,
        success: false,
        error: (error as Error).message,
      };
    }
  },
});
