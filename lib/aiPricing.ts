// Shared client-side display helpers for internal AI credits.

export const INTERNAL_CREDIT_COST_PER_1M_USD = 5;

export const GPT_INPUT_COST_PER_1M = 2.5;
export const GPT_OUTPUT_COST_PER_1M = 15.0;

export const GEMINI_FLASH_IMAGE_INPUT_COST_PER_1M = 0.3;
export const GEMINI_FLASH_IMAGE_OUTPUT_COST_PER_1M = 30.0;
export const GEMINI_FLASH_IMAGE_TYPICAL_OUTPUT_TOKENS = 1290;

export const AI_PRO_MONTHLY_TOKENS = 2340000;
export const AI_SCALE_MONTHLY_TOKENS = 9000000;
export const PRO_MONTHLY_TOKENS = 2940000;
export const ENTERPRISE_MONTHLY_TOKENS = 11940000;

export const usdToCredits = (usd: number): number => {
  if (!Number.isFinite(usd) || usd <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.ceil((usd / INTERNAL_CREDIT_COST_PER_1M_USD) * 1_000_000)
  );
};

export const calculateGPTCostUSD = (
  inputTokens: number,
  outputTokens: number
): number => {
  const inputCost = (Math.max(0, inputTokens) / 1_000_000) * GPT_INPUT_COST_PER_1M;
  const outputCost = (Math.max(0, outputTokens) / 1_000_000) * GPT_OUTPUT_COST_PER_1M;
  return inputCost + outputCost;
};

export const calculateGPTCostCents = (inputTokens: number, outputTokens: number): number => {
  return Math.round(calculateGPTCostUSD(inputTokens, outputTokens) * 100);
};

export const calculateGeminiFlashImageCostUSD = (
  inputTokens = 0,
  outputTokens = GEMINI_FLASH_IMAGE_TYPICAL_OUTPUT_TOKENS
): number => {
  const normalizedOutputTokens =
    outputTokens > 0 ? outputTokens : GEMINI_FLASH_IMAGE_TYPICAL_OUTPUT_TOKENS;

  return (
    (Math.max(0, inputTokens) / 1_000_000) * GEMINI_FLASH_IMAGE_INPUT_COST_PER_1M +
    (normalizedOutputTokens / 1_000_000) * GEMINI_FLASH_IMAGE_OUTPUT_COST_PER_1M
  );
};

export const GEMINI_FLASH_IMAGE_TYPICAL_CREDITS = usdToCredits(
  calculateGeminiFlashImageCostUSD()
);

export const formatTokens = (tokens: number): string => {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
};
