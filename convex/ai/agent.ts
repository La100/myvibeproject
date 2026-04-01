/**
 * Myvibe project AI Agent - Convex Agent Implementation
 *
 * This replaces the manual OpenAI Responses API implementation with @convex-dev/agent
 * while preserving all custom tools and functionality.
 *
 * NOTE: All tools are now imported from tools.ts (single source of truth)
 */

import { components } from "../_generated/api";
import { Agent } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { AI_MODEL, AI_CONFIG } from "./config";
import type { ProjectContextSnapshot } from "./types";
import { createAgentTools } from "./tools";
import type { ModelMessage } from "ai";
import { sanitizeIncompleteToolHistory } from "./helpers/sanitizeToolHistory";

// RunAction type matches ctx.runAction signature
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunActionFn = (action: any, args: any) => Promise<any>;
// RunQuery type matches ctx.runQuery signature
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunQueryFn = (query: any, args: any) => Promise<any>;
// RunMutation type matches ctx.runMutation signature
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunMutationFn = (mutation: any, args: any) => Promise<any>;

interface AgentOptions {
  projectId?: string;
  teamSlug?: string;
  userClerkId?: string;
  runAction?: RunActionFn;
  runQuery?: RunQueryFn;
  runMutation?: RunMutationFn;
  loadSnapshot?: () => Promise<ProjectContextSnapshot>;
  allowedToolNames?: readonly string[];
  crudApprovalMode?: "always_ask" | "auto_confirm";
}

/**
 * Create the Myvibe project AI Agent with all tools and advanced features
 *
 * Features:
 * - All 27 custom tools
 * - Uses Convex Agent threads/messages for context
 * - Project context handled via load_full_project_context tool
 *
 * See: https://docs.convex.dev/agents/context
 */
export const createMyvibeProjectAgent = (
  instructions: string,
  options?: AgentOptions
) => {
  // Agent configuration with proper typing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentConfig: Record<string, any> = {
    name: "Myvibe project Assistant",
    languageModel: openai(AI_MODEL),
    instructions,
    maxSteps: AI_CONFIG.maxSteps,

    // Context options - we use contextHandler to load messages from custom tables
    // See: https://docs.convex.dev/agents/context
    contextOptions: {
      // Include tool messages in context so the AI remembers search results and previous actions
      excludeToolMessages: false,
    },
    contextHandler: async (
      _ctx: unknown,
      args: { allMessages: ModelMessage[] },
    ) => {
      return sanitizeIncompleteToolHistory(args.allMessages);
    },

    // Import all tools from tools.ts (single source of truth)
    tools: createAgentTools({
      projectId: options?.projectId,
      teamSlug: options?.teamSlug,
      userClerkId: options?.userClerkId,
      runAction: options?.runAction,
      runQuery: options?.runQuery,
      runMutation: options?.runMutation,
      loadSnapshot: options?.loadSnapshot,
      allowedToolNames: options?.allowedToolNames,
      crudApprovalMode: options?.crudApprovalMode,
    }),
  };

  // Cast to satisfy Agent constructor while preserving flexibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Agent(components.agent, agentConfig as any);
};
