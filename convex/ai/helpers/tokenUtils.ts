/**
 * Token Usage Utils
 *
 * Utilities for calculating token usage and costs
 */

import type { AITokenUsage } from "../types";
import { calculateTextCostUsd } from "../billing";

type TokenUsageResult = {
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

export const calculateTokenUsage = (
  result: TokenUsageResult,
  userMessage: string,
  aiResponse: string,
): AITokenUsage => {
  const tokenUsage: AITokenUsage = {
    inputTokens: result.usage?.input_tokens || Math.floor(userMessage.length / 4),
    outputTokens: result.usage?.output_tokens || Math.floor(aiResponse.length / 4),
    totalTokens: result.usage?.total_tokens || 0,
    estimatedCostUSD: 0,
  };

  if (!tokenUsage.totalTokens) {
    tokenUsage.totalTokens = tokenUsage.inputTokens + tokenUsage.outputTokens;
  }

  tokenUsage.estimatedCostUSD = calculateTextCostUsd(
    tokenUsage.inputTokens,
    tokenUsage.outputTokens
  );

  return tokenUsage;
};
