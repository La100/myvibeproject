"use node";

/* eslint-disable @typescript-eslint/no-explicit-any */

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
import { buildDefaultPrompt, defaultPrompt } from "./prompt";
import type { Id } from "../_generated/dataModel";
import { buildFallbackResponseFromTools } from "./helpers/streamResponseBuilder";
import { buildWorkflowRuntimeContext } from "./helpers/workflowRuntime";

const AI_CREDITS_EXHAUSTED_MESSAGE =
  "You've run out of AI credits. Upgrade your plan or manage billing to continue.";

/**
 * Internal action that does the actual streaming work
 * Called by scheduler from initializeStreaming mutation - runs in background
 */
export const internalDoStreaming = internalAction({
  args: {
    message: v.optional(v.string()),
    projectId: v.id("projects"),
    userClerkId: v.string(),
    threadId: v.string(),
    promptMessageId: v.optional(v.string()),
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
    const providedThreadId = args.threadId;
    const isApprovalContinuation = !!args.promptMessageId;

    const getThreadRuntimeState = async () =>
      (await ctx.runQuery(internalAny.ai.threads.getThreadRuntimeState, {
        threadId: providedThreadId,
      })) as {
        abortedAt?: number;
        workflowContext?: {
          workflowId: string;
          stepId: string;
          previousResponses?: Array<{ stepId: string; response: string }>;
        };
      } | null;

    const wasAborted = async () => {
      const runtimeState = await getThreadRuntimeState();
      return Boolean(runtimeState?.abortedAt && runtimeState.abortedAt >= startTime);
    };

    const persistAssistantMessage = async (content: string) => {
      await ctx.runMutation(components.agent.messages.addMessages, {
        threadId: providedThreadId,
        userId: args.userClerkId,
        messages: [
          {
            message: {
              role: "assistant",
              content,
            },
            text: content,
            status: "success",
            finishReason: "stop",
          },
        ],
      });
    };

    console.log("🚀 [STREAMING START]", {
      threadId: args.threadId,
      projectId: args.projectId,
      userClerkId: args.userClerkId,
      message:
        (args.message ?? "").substring(0, 100) +
        ((args.message ?? "").length > 100 ? "..." : ""),
      isApprovalContinuation,
      promptMessageId: args.promptMessageId,
      hasFiles: !!(
        args.fileId ||
        args.fileIds ||
        (args.openaiFiles && args.openaiFiles.length > 0)
      ),
      timestamp: new Date().toISOString(),
    });

    try {
      console.log("📝 [THREAD INFO]", {
        providedThreadId,
      });

      // Streaming start

      // Resolve teamId from project
      const projectForTeam = await ctx.runQuery(apiAny.projects.getProject, {
        projectId: args.projectId,
      }) as { teamId?: Id<"teams">; customAiPrompt?: string; aiAutoConfirmCrud?: boolean } | null;
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

      const threadRuntimeState = await getThreadRuntimeState();
      const hasUploadedFile = Boolean(
        args.fileId ||
        (args.fileIds && args.fileIds.length > 0) ||
        (args.openaiFiles && args.openaiFiles.length > 0),
      );
      const workflowRuntime = buildWorkflowRuntimeContext(
        threadRuntimeState?.workflowContext,
        hasUploadedFile,
      );
      const activeRuntimeToolNames = workflowRuntime.allowedToolNames;
      // Build system instructions
      // Custom prompt is additive so base guardrails/tool contract always remain active.
      const basePrompt = buildDefaultPrompt(activeRuntimeToolNames);
      const customPrompt = projectForTeam?.customAiPrompt?.trim();
      const hasCustomPrompt = Boolean(customPrompt && customPrompt !== defaultPrompt.trim());
      const systemPrompt = hasCustomPrompt
        ? `${basePrompt}

## Additional Project Instructions
${customPrompt}

Apply these additional instructions when they do not conflict with the tool contract, safety, or confirmation rules above.`
        : basePrompt;
      const effectiveSystemPrompt = [
        systemPrompt,
        workflowRuntime.workflowSection,
      ]
        .filter(Boolean)
        .join("\n\n");

      const teamMembers = await ctx.runQuery(internalAny.teams.getTeamMembersWithUserDetails, {
        projectId: args.projectId,
      }) as Array<Record<string, unknown>>;
      const teamMembersContext = buildTeamMembersContext(teamMembers);
      const team = await ctx.runQuery(apiAny.teams.getTeamById, { teamId: teamId! }) as {
        timezone?: string;
        slug?: string;
      } | null;
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

      console.log("📋 [SYSTEM INSTRUCTIONS]", {
        hasCustomPrompt,
        teamMembersCount: teamMembers.length,
        currentDate,
        activeRuntimeToolNames,
        workflowId: threadRuntimeState?.workflowContext?.workflowId,
        workflowStepId: threadRuntimeState?.workflowContext?.stepId,
      });

      // Approval continuations reuse the saved approval-response message as prompt.
      let userPrompt = args.message ?? "";
      let userMessageContent:
        | string
        | Array<
          | { type: "text"; text: string }
          | { type: "image"; image: string; mediaType?: string }
          | { type: "file"; data: string; mediaType: string }
        > = userPrompt;
      if (!isApprovalContinuation) {
        if (args.openaiFiles && args.openaiFiles.length > 0) {
          const result = await prepareMessageWithOpenAIFiles({
            openaiFiles: args.openaiFiles,
            baseMessage: userPrompt,
          });
          userPrompt = result.message;
          userMessageContent = result.content;
        } else if (args.fileIds && args.fileIds.length > 0) {
          const result = await prepareMessageWithFiles({
            ctx,
            fileIds: args.fileIds as string[],
            baseMessage: userPrompt,
          });
          userPrompt = result.message;
          userMessageContent = result.content;
        } else if (args.fileId) {
          const result = await prepareMessageWithFile({
            ctx,
            fileId: args.fileId as string,
            baseMessage: userPrompt,
          });
          userPrompt = result.message;
          userMessageContent = result.content;
        }

        console.log("📨 [USER MESSAGE]", {
          messageLength: userPrompt.length,
          hasMultipartContent: Array.isArray(userMessageContent),
          openaiFiles: args.openaiFiles?.length || 0,
          fileIds: args.fileIds?.length || 0,
          fileId: args.fileId || null,
        });
      }

      // Create agent
      const agent = createMyvibeProjectAgent(systemInstructions, {
        projectId: args.projectId as string,
        teamSlug: team?.slug,
        userClerkId: args.userClerkId,
        runAction: ctx.runAction,
        runQuery: ctx.runQuery,
        runMutation: ctx.runMutation,
        loadSnapshot: ensureSnapshot,
        allowedToolNames: activeRuntimeToolNames,
        crudApprovalMode: projectForTeam?.aiAutoConfirmCrud ? "auto_confirm" : "always_ask",
      });

      console.log("🤖 [AGENT CREATED]");

      const agentThreadId = providedThreadId;

      console.log("🔗 [FINAL THREAD ID]", {
        agentThreadId,
        providedThreadId,
      });

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
          promptMessageId: args.promptMessageId,
          messages: [
            ...(!isApprovalContinuation
              ? [{
                  message: {
                    role: "user" as const,
                    content: userMessageContent,
                  },
                  text: userPrompt,
                  status: "success" as const,
                  finishReason: "stop" as const,
                }]
              : []),
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

      let response;
      try {
        response = await agent.streamText(
          ctx,
          { userId: args.userClerkId, threadId: agentThreadId },
          {
            system: systemInstructions,
            ...(args.promptMessageId
              ? { promptMessageId: args.promptMessageId }
              : {
                  messages: [
                    { role: "user" as const, content: userMessageContent },
                  ],
                }),
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
      } catch (err) {
        console.error("❌ [STREAMING FAILED]", err);
        throw err;
      }

      if (await wasAborted()) {
        console.log("🛑 [STREAMING ABORTED] Skipping post-stream side effects", {
          threadId: providedThreadId,
        });
        return null;
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
        console.log("🔧 [TOOL CALLS COMPLETED IN AGENT FLOW]", {
          toolCallsCount: allToolCalls.length,
          toolNames: allToolCalls.map((tc: any) => tc.toolName || tc.name).filter(Boolean),
        });
      }

      if (shouldPersistSyntheticFallback) {
        await persistAssistantMessage(fullResponse);
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
        billableTokens,
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

      if (!(await wasAborted())) {
        const failureMessage =
          "I ran into an error while generating a response. Please try again.";

        try {
          await persistAssistantMessage(failureMessage);
          await ctx.runMutation(internalAny.ai.threads.updateThreadSummary, {
            threadId: providedThreadId,
            lastMessageAt: Date.now(),
            lastMessagePreview: failureMessage,
            lastMessageRole: "assistant",
            messageCountDelta: 1,
          });
        } catch (persistError) {
          console.error("❌ [STREAMING ERROR PERSIST FAILED]", {
            error:
              persistError instanceof Error
                ? persistError.message
                : String(persistError),
            threadId: args.threadId,
          });
        }
      }

      return null;
    }
  },
});
