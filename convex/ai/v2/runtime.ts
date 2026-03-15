"use node";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const internalAny = require("../../_generated/api").internal as any;

import OpenAI from "openai";
import { zodSchema } from "ai";
import { v } from "convex/values";
import { internalAction } from "../../_generated/server";

import { usdToCredits } from "../billing";
import { calculateCost } from "../config";
import {
  buildTeamMembersContext,
  buildSystemInstructions,
  getCurrentDateTime,
} from "../helpers/contextBuilder";
import {
  prepareMessageWithFile,
  prepareMessageWithFiles,
  prepareMessageWithOpenAIFiles,
} from "../files";
import { buildFallbackResponseFromTools } from "../helpers/streamResponseBuilder";
import { defaultPrompt } from "../prompt";
import { createStreamingTools } from "../tools";
import type { ProjectContextSnapshot } from "../types";

const READ_ONLY_TOOL_NAMES = new Set([
  "search_items",
  "load_full_project_context",
]);

const MAX_RESPONSE_ITERATIONS = 6;
type RuntimeContext = {
  group: {
    groupId: string;
    threadId: string;
    projectId: string;
    teamId: string;
    userClerkId: string;
  };
  project: {
    _id: string;
    name?: string;
    customAiPrompt?: string;
  };
  team: {
    _id: string;
    timezone?: string;
  } | null;
  profile: {
    displayName: string;
    defaultModel: string;
    systemPrompt?: string;
    confirmationMode: "always_ask" | "auto_confirm";
    memoryMode: "thread_only" | "project_summary" | "hybrid";
    enabledTools: string[];
    featureFlags: string[];
  };
  history: Array<{
    groupId: string;
    role: "user" | "assistant";
    text: string;
  }>;
};

function sanitizeJsonSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
  delete clone.$schema;
  return clone;
}

function getPendingActionSection(
  calls: Array<{ status?: string; functionName: string }>,
) {
  const unresolvedPendingCalls = calls.filter((call) => call.status === "pending");
  const resolvedConfirmedCalls = calls.filter((call) => call.status === "confirmed");
  const resolvedRejectedCalls = calls.filter((call) => call.status === "rejected");
  const pendingActionSummary = unresolvedPendingCalls.reduce((acc, call) => {
    acc[call.functionName] = (acc[call.functionName] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const resolvedActionSummary = calls.reduce((acc, call) => {
    if (call.status !== "confirmed" && call.status !== "rejected") return acc;
    acc[call.functionName] = acc[call.functionName] ?? { confirmed: 0, rejected: 0 };
    if (call.status === "confirmed") {
      acc[call.functionName].confirmed += 1;
    } else {
      acc[call.functionName].rejected += 1;
    }
    return acc;
  }, {} as Record<string, { confirmed: number; rejected: number }>);

  if (
    unresolvedPendingCalls.length === 0 &&
    resolvedConfirmedCalls.length === 0 &&
    resolvedRejectedCalls.length === 0
  ) {
    return "";
  }

  return [
    "## Pending Actions Context",
    `Unresolved pending actions: ${unresolvedPendingCalls.length}.`,
    `Resolved outcomes so far: ${resolvedConfirmedCalls.length} confirmed, ${resolvedRejectedCalls.length} rejected.`,
    unresolvedPendingCalls.length > 0
      ? "Treat the next user message as a possible refinement of pending actions unless the user explicitly asks to cancel or reject them."
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
    .join("\n");
}

function buildEffectivePrompt(args: {
  projectPrompt?: string;
  profilePrompt?: string;
  pendingActionSection?: string;
}) {
  const promptParts = [defaultPrompt.trim()];

  const projectPrompt = args.projectPrompt?.trim();
  if (projectPrompt && projectPrompt !== defaultPrompt.trim()) {
    promptParts.push(
      "## Additional Project Instructions",
      projectPrompt,
    );
  }

  const profilePrompt = args.profilePrompt?.trim();
  if (profilePrompt) {
    promptParts.push(
      "## Additional Tenant Instructions",
      profilePrompt,
    );
  }

  if (args.pendingActionSection) {
    promptParts.push(args.pendingActionSection);
  }

  return promptParts.join("\n\n");
}

function isActionableToolOutput(output: string) {
  try {
    const parsed = JSON.parse(output) as Record<string, unknown>;
    return (
      typeof parsed.type === "string" &&
      typeof parsed.operation === "string" &&
      ["create", "bulk_create", "edit", "bulk_edit", "delete"].includes(
        parsed.operation,
      ) &&
      typeof parsed.error !== "string"
    );
  } catch {
    return false;
  }
}

function formatErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export const runResponseGroup = internalAction({
  args: {
    groupId: v.string(),
    message: v.string(),
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
    const startedAt = Date.now();
    let runtimeContext: RuntimeContext | null = null;
    let finalSummary = "";
    let partialAssistantText = "";
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let wasSuccessful = false;
    let wasAborted = false;

    const queue: Array<{
      eventType:
        | "message.assistant.delta"
        | "message.assistant.completed"
        | "reasoning.summary.delta"
        | "reasoning.summary.completed"
        | "tool.called"
        | "tool.output.delta"
        | "tool.awaiting_confirmation"
        | "tool.completed"
        | "tool.failed"
        | "turn.awaiting_confirmation"
        | "turn.completed"
        | "turn.aborted"
        | "turn.failed";
      role?: "assistant" | "tool" | "system";
      callId?: string;
      text?: string;
      data?: unknown;
    }> = [];

    const flushEvents = async () => {
      if (queue.length === 0) return;
      await ctx.runMutation(internalAny.ai.v2.events.appendGroupEvents, {
        groupId: args.groupId,
        events: queue.splice(0, queue.length),
      });
    };

    const pushEvent = async (event: (typeof queue)[number]) => {
      queue.push(event);
      if (queue.length >= 20) {
        await flushEvents();
      }
    };

    const isAbortRequested = async () => {
      const state = await ctx.runQuery(internalAny.ai.v2.groups.getGroupAbortState, {
        groupId: args.groupId,
      });
      return state.abortRequested || state.status === "aborted";
    };

    const abortCurrentRun = async (stream?: { abort?: () => void; controller?: AbortController | null }) => {
      wasAborted = true;
      if (stream?.abort) {
        stream.abort();
      } else {
        stream?.controller?.abort();
      }

      const partialText = partialAssistantText.trim();
      finalSummary = partialText || "Response stopped by user.";

      if (partialText.length > 0) {
        await pushEvent({
          eventType: "message.assistant.completed",
          role: "assistant",
          text: partialText,
          data: { aborted: true, partial: true },
        });
      }

      await pushEvent({
        eventType: "turn.aborted",
        role: "system",
        data: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          reason: "user_requested",
        },
      });
      await flushEvents();

      await ctx.runMutation(internalAny.ai.v2.groups.updateGroupStatus, {
        groupId: args.groupId,
        status: "aborted",
        summary: finalSummary,
      });

      if (runtimeContext?.group.threadId) {
        await ctx.runMutation(internalAny.ai.threads.updateThreadSummary, {
          threadId: runtimeContext.group.threadId,
          lastMessageAt: Date.now(),
          lastMessagePreview: finalSummary,
          lastMessageRole: "assistant",
          messageCountDelta: 1,
        });
      }
    };

    try {
      runtimeContext = await ctx.runQuery(
        internalAny.ai.v2.runtimeContext.getRuntimeContextInternal,
        { groupId: args.groupId },
      );

      if (!runtimeContext) {
        throw new Error("Assistant v2 runtime context not found");
      }

      const aiAccess = await ctx.runQuery(
        internalAny.stripe.checkAIFeatureAccessByProject,
        {
          projectId: runtimeContext.group.projectId,
        },
      );

      if (!aiAccess?.allowed) {
        finalSummary =
          aiAccess?.message ||
          "You've run out of AI credits. Upgrade your plan or manage billing to continue.";

        await pushEvent({
          eventType: "message.assistant.completed",
          role: "assistant",
          text: finalSummary,
          data: { quotaBlocked: true },
        });
        await pushEvent({
          eventType: "turn.failed",
          role: "system",
          data: { reason: "quota_exhausted" },
        });
        await flushEvents();

        await ctx.runMutation(internalAny.ai.v2.groups.updateGroupStatus, {
          groupId: args.groupId,
          status: "failed",
          summary: finalSummary,
        });
        await ctx.runMutation(internalAny.ai.threads.updateThreadSummary, {
          threadId: runtimeContext.group.threadId,
          lastMessageAt: Date.now(),
          lastMessagePreview: finalSummary,
          lastMessageRole: "assistant",
          messageCountDelta: 1,
        });
        return null;
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not configured");
      }

      const client = new OpenAI({ apiKey });
      let snapshot: ProjectContextSnapshot | null = null;
      const ensureSnapshot = async (): Promise<ProjectContextSnapshot> => {
        if (!snapshot) {
          snapshot = (await ctx.runQuery(
            internalAny.ai.longContextQueries.getProjectContextSnapshot,
            { projectId: runtimeContext!.group.projectId },
          )) as ProjectContextSnapshot;
        }
        return snapshot;
      };

      const pendingCallsForContext = (await ctx.runQuery(
        internalAny.ai.threads.listPendingItemsInternal,
        {
          threadId: runtimeContext.group.threadId,
          userClerkId: runtimeContext.group.userClerkId,
        },
      )) as Array<{ status?: string; functionName: string }>;

      const pendingActionSection = getPendingActionSection(pendingCallsForContext);
      const effectivePrompt = buildEffectivePrompt({
        projectPrompt: runtimeContext.project.customAiPrompt,
        profilePrompt: runtimeContext.profile.systemPrompt,
        pendingActionSection,
      });

      const teamMembers = (await ctx.runQuery(
        internalAny.teams.getTeamMembersWithUserDetails,
        {
          projectId: runtimeContext.group.projectId,
        },
      )) as Array<Record<string, unknown>>;
      const teamMembersContext = buildTeamMembersContext(teamMembers);
      const timezone = runtimeContext.team?.timezone;
      const { currentDate, currentDateTime } = getCurrentDateTime(timezone);
      const systemInstructions = buildSystemInstructions(
        effectivePrompt,
        currentDateTime,
        currentDate,
        teamMembersContext,
        runtimeContext.group.userClerkId,
        timezone,
      );

      const streamingTools = createStreamingTools({
        projectId: runtimeContext.group.projectId,
        runAction: ctx.runAction,
        runQuery: ctx.runQuery,
        loadSnapshot: ensureSnapshot,
      }) as Record<
        string,
        {
          description?: string;
          inputSchema: unknown;
          execute: (args: unknown) => Promise<string>;
        }
      >;

      const toolEntries = Object.entries(streamingTools).filter(([name]) => {
        if (runtimeContext?.profile.enabledTools.includes("app")) return true;
        return READ_ONLY_TOOL_NAMES.has(name);
      });

      const toolDefinitions = toolEntries.map(([name, tool]) => ({
        type: "function" as const,
        name,
        description: tool.description ?? "",
        strict: true,
        parameters: sanitizeJsonSchema(
          zodSchema(tool.inputSchema as any).jsonSchema as Record<string, unknown>,
        ),
      }));

      const toolExecutors = new Map(
        toolEntries.map(([name, tool]) => [name, tool.execute]),
      );

      const historyInput = runtimeContext.history.map((entry) => ({
        role: entry.role,
        content: entry.text,
      }));

      let userMessageContent: any = args.message;
      if (args.openaiFiles && args.openaiFiles.length > 0) {
        const result = await prepareMessageWithOpenAIFiles({
          openaiFiles: args.openaiFiles,
          baseMessage: args.message,
        });
        userMessageContent = result.content;
      } else if (args.fileIds && args.fileIds.length > 0) {
        const result = await prepareMessageWithFiles({
          ctx,
          fileIds: args.fileIds as string[],
          baseMessage: args.message,
        });
        userMessageContent = result.content;
      } else if (args.fileId) {
        const result = await prepareMessageWithFile({
          ctx,
          fileId: args.fileId as string,
          baseMessage: args.message,
        });
        userMessageContent = result.content;
      }

      let previousResponseId: string | undefined;
      let currentInput: any = [
        ...historyInput,
        { role: "user", content: userMessageContent },
      ];
      let hadPendingWrites = false;
      const fallbackToolCalls: Array<{ name?: string; args?: unknown }> = [];
      const fallbackToolResults: Array<{ output?: unknown }> = [];

      for (let iteration = 0; iteration < MAX_RESPONSE_ITERATIONS; iteration += 1) {
        if (await isAbortRequested()) {
          await abortCurrentRun();
          return null;
        }

        const stream = client.responses.stream({
          model: runtimeContext.profile.defaultModel || "gpt-5.4",
          instructions: systemInstructions,
          input: currentInput,
          previous_response_id: previousResponseId,
          max_output_tokens: 2000,
          parallel_tool_calls: true,
          reasoning: {
            effort: "medium",
            summary:
              runtimeContext.profile.featureFlags.includes("reasoning_summary")
                ? "auto"
                : null,
          },
          metadata: {
            group_id: args.groupId,
            project_id: runtimeContext.group.projectId,
            thread_id: runtimeContext.group.threadId,
          },
          tool_choice: toolDefinitions.length > 0 ? "auto" : "none",
          tools: toolDefinitions,
        });

        for await (const event of stream) {
          switch (event.type) {
            case "response.output_text.delta":
              if (event.delta) {
                partialAssistantText += event.delta;
                await pushEvent({
                  eventType: "message.assistant.delta",
                  role: "assistant",
                  text: event.delta,
                });
              }
              break;
            case "response.reasoning_summary_text.delta":
              if (event.delta) {
                await pushEvent({
                  eventType: "reasoning.summary.delta",
                  role: "assistant",
                  text: event.delta,
                });
              }
              break;
            case "response.reasoning_summary_text.done":
              if (event.text) {
                await pushEvent({
                  eventType: "reasoning.summary.completed",
                  role: "assistant",
                  text: event.text,
                });
              }
              break;
            case "response.function_call_arguments.delta":
              if ((event as any).delta) {
                await pushEvent({
                  eventType: "tool.output.delta",
                  role: "tool",
                  callId: (event as any).call_id,
                  text: (event as any).delta,
                });
              }
              break;
            default:
              break;
          }

          if (await isAbortRequested()) {
            await abortCurrentRun(stream as any);
            return null;
          }
        }

        const response = await stream.finalResponse();
        await flushEvents();

        previousResponseId = response.id;
        totalInputTokens += response.usage?.input_tokens ?? 0;
        totalOutputTokens += response.usage?.output_tokens ?? 0;

        if (response.output_text && response.output_text.trim().length > 0) {
          finalSummary = response.output_text.trim();
          await pushEvent({
            eventType: "message.assistant.completed",
            role: "assistant",
            text: finalSummary,
            data: { responseId: response.id, iteration },
          });
          await flushEvents();
        }

        const functionCalls = (response.output || []).filter(
          (item: any) => item.type === "function_call",
        ) as Array<any>;

        if (functionCalls.length === 0) {
          break;
        }

        const toolOutputs: Array<{
          type: "function_call_output";
          call_id: string;
          output: string;
        }> = [];
        const actionableCalls: Array<{
          callId: string;
          functionName: string;
          arguments: string;
        }> = [];

        for (const functionCall of functionCalls) {
          if (await isAbortRequested()) {
            await abortCurrentRun(stream as any);
            return null;
          }

          const callId = functionCall.call_id || functionCall.id;
          const functionName = functionCall.name;
          const rawArguments = functionCall.arguments || "{}";

          fallbackToolCalls.push({
            name: functionName,
            args: rawArguments,
          });

          await pushEvent({
            eventType: "tool.called",
            role: "tool",
            callId,
            data: {
              toolName: functionName,
              arguments: rawArguments,
              responseId: response.id,
            },
          });

          const execute = toolExecutors.get(functionName);
          if (!execute) {
            const errorOutput = JSON.stringify({
              error: `Tool '${functionName}' is not available in this runtime`,
            });
            fallbackToolResults.push({ output: errorOutput });
            toolOutputs.push({
              type: "function_call_output",
              call_id: callId,
              output: errorOutput,
            });
            await pushEvent({
              eventType: "tool.failed",
              role: "tool",
              callId,
              data: {
                toolName: functionName,
                output: errorOutput,
              },
            });
            continue;
          }

          let parsedArguments: unknown = {};
          try {
            parsedArguments = JSON.parse(rawArguments);
          } catch {
            parsedArguments = {};
          }

          try {
            const output = await execute(parsedArguments);
            fallbackToolResults.push({ output });
            toolOutputs.push({
              type: "function_call_output",
              call_id: callId,
              output,
            });

            if (!READ_ONLY_TOOL_NAMES.has(functionName) && isActionableToolOutput(output)) {
              actionableCalls.push({
                callId,
                functionName,
                arguments: output,
              });
              hadPendingWrites = true;
              await pushEvent({
                eventType: "tool.awaiting_confirmation",
                role: "tool",
                callId,
                data: {
                  toolName: functionName,
                  output,
                },
              });
            } else {
              await pushEvent({
                eventType: "tool.completed",
                role: "tool",
                callId,
                data: {
                  toolName: functionName,
                  output,
                },
              });
            }
          } catch (error) {
            const errorOutput = JSON.stringify({
              error: formatErrorMessage(error),
            });
            fallbackToolResults.push({ output: errorOutput });
            toolOutputs.push({
              type: "function_call_output",
              call_id: callId,
              output: errorOutput,
            });
            await pushEvent({
              eventType: "tool.failed",
              role: "tool",
              callId,
              data: {
                toolName: functionName,
                output: errorOutput,
              },
            });
          }
        }

        if (actionableCalls.length > 0) {
          await ctx.runMutation(internalAny.ai.threads.saveFunctionCalls, {
            threadId: runtimeContext.group.threadId,
            projectId: runtimeContext.group.projectId,
            responseId: args.groupId,
            functionCalls: actionableCalls,
          });
        }

        await flushEvents();
        currentInput = toolOutputs;
      }

      if (!finalSummary && fallbackToolCalls.length > 0) {
        const fallback = buildFallbackResponseFromTools(
          fallbackToolCalls,
          fallbackToolResults,
        );
        if (fallback) {
          finalSummary = fallback;
          await pushEvent({
            eventType: "message.assistant.completed",
            role: "assistant",
            text: fallback,
            data: { fallback: true },
          });
        }
      }

      if (!finalSummary) {
        finalSummary = hadPendingWrites
          ? "Prepared changes and stored them for confirmation."
          : "Completed without any visible assistant output.";
      }

      await pushEvent({
        eventType: hadPendingWrites ? "turn.awaiting_confirmation" : "turn.completed",
        role: "system",
        data: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        },
      });
      await flushEvents();

      await ctx.runMutation(internalAny.ai.v2.groups.updateGroupStatus, {
        groupId: args.groupId,
        status: hadPendingWrites ? "awaiting_confirmation" : "completed",
        summary: finalSummary,
      });
      await ctx.runMutation(internalAny.ai.threads.updateThreadSummary, {
        threadId: runtimeContext.group.threadId,
        lastMessageAt: Date.now(),
        lastMessagePreview: finalSummary,
        lastMessageRole: "assistant",
        messageCountDelta: 1,
      });
      wasSuccessful = true;
    } catch (error) {
      if (wasAborted) {
        return null;
      }

      const errorMessage = formatErrorMessage(error);
      finalSummary = finalSummary || `Assistant v2 failed: ${errorMessage}`;

      await pushEvent({
        eventType: "turn.failed",
        role: "system",
        data: { error: errorMessage },
      });
      await flushEvents();

      await ctx.runMutation(internalAny.ai.v2.groups.updateGroupStatus, {
        groupId: args.groupId,
        status: "failed",
        summary: finalSummary,
      });

      if (runtimeContext?.group.threadId) {
        await ctx.runMutation(internalAny.ai.threads.updateThreadSummary, {
          threadId: runtimeContext.group.threadId,
          lastMessageAt: Date.now(),
          lastMessagePreview: finalSummary,
          lastMessageRole: "assistant",
          messageCountDelta: 1,
        });
      }

      console.error("Assistant v2 runtime failed", {
        groupId: args.groupId,
        error: errorMessage,
      });
    } finally {
      if (runtimeContext) {
        const totalTokens = totalInputTokens + totalOutputTokens;
        const estimatedCostUsd = calculateCost(
          runtimeContext.profile.defaultModel || "gpt-5.4",
          totalInputTokens,
          totalOutputTokens,
        );
        const billableTokens = wasSuccessful ? usdToCredits(estimatedCostUsd) : 0;
        const estimatedCostCents = wasSuccessful
          ? Math.round(estimatedCostUsd * 100)
          : 0;

        await ctx.runMutation(internalAny.ai.usage.saveTokenUsage, {
          projectId: runtimeContext.group.projectId,
          teamId: runtimeContext.group.teamId,
          userClerkId: runtimeContext.group.userClerkId,
          threadId: runtimeContext.group.threadId,
          model: runtimeContext.profile.defaultModel || "gpt-5.4",
          feature: "assistant",
          requestType: "chat",
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          totalTokens,
          billableTokens,
          mode: "v2",
          estimatedCostCents,
          responseTimeMs: Date.now() - startedAt,
          success: wasSuccessful,
          errorMessage: finalSummary.startsWith("Assistant v2 failed:")
            ? finalSummary
            : undefined,
        });
      }
    }

    return null;
  },
});
