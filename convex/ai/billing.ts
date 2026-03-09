export const INTERNAL_CREDIT_COST_PER_1M_USD = 5;

export const GPT_INPUT_COST_PER_1M_USD = 1.75;
export const GPT_OUTPUT_COST_PER_1M_USD = 14;

export const GEMINI_FLASH_IMAGE_INPUT_COST_PER_1M_USD = 0.3;
export const GEMINI_FLASH_IMAGE_OUTPUT_COST_PER_1M_USD = 30;
export const DEFAULT_GEMINI_FLASH_IMAGE_OUTPUT_TOKENS = 1290;

export function usdToCredits(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.ceil((usd / INTERNAL_CREDIT_COST_PER_1M_USD) * 1_000_000)
  );
}

export function centsToCredits(cents: number): number {
  if (!Number.isFinite(cents) || cents <= 0) {
    return 0;
  }

  return usdToCredits(cents / 100);
}

export function calculateTextCostUsd(
  inputTokens: number,
  outputTokens: number
): number {
  const normalizedInputTokens = Math.max(0, inputTokens);
  const normalizedOutputTokens = Math.max(0, outputTokens);

  return (
    (normalizedInputTokens / 1_000_000) * GPT_INPUT_COST_PER_1M_USD +
    (normalizedOutputTokens / 1_000_000) * GPT_OUTPUT_COST_PER_1M_USD
  );
}

export function calculateGeminiFlashImageCostUsd(
  inputTokens: number,
  outputTokens: number
): number {
  const normalizedInputTokens = Math.max(0, inputTokens);
  const normalizedOutputTokens =
    outputTokens > 0 ? outputTokens : DEFAULT_GEMINI_FLASH_IMAGE_OUTPUT_TOKENS;

  return (
    (normalizedInputTokens / 1_000_000) * GEMINI_FLASH_IMAGE_INPUT_COST_PER_1M_USD +
    (normalizedOutputTokens / 1_000_000) * GEMINI_FLASH_IMAGE_OUTPUT_COST_PER_1M_USD
  );
}
