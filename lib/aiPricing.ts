// Shared client-side display helpers for internal AI credits.

const INTERNAL_CREDIT_COST_PER_1M_USD = 5;

const GPT_INPUT_COST_PER_1M = 2.5;
const GPT_OUTPUT_COST_PER_1M = 15.0;

const GPT_IMAGE_INPUT_COST_PER_1M = 5.0;
const GPT_IMAGE_OUTPUT_COST_PER_1M = 30.0;
const GPT_IMAGE_TYPICAL_OUTPUT_TOKENS = 6208;
const CLOUDFLARE_BROWSER_RENDERING_COST_PER_HOUR_USD = 0.09;

const FREE_MONTHLY_TOKENS = 200_000;
export const AI_PRO_MONTHLY_TOKENS = 2_340_000;
export const AI_SCALE_MONTHLY_TOKENS = 9_000_000;
export const PRO_MONTHLY_TOKENS = 2_940_000;
export const ENTERPRISE_MONTHLY_TOKENS = 11_940_000;

export const usdToCredits = (usd: number): number => {
  if (!Number.isFinite(usd) || usd <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.ceil((usd / INTERNAL_CREDIT_COST_PER_1M_USD) * 1_000_000)
  );
};

const calculateGPTCostUSD = (
  inputTokens: number,
  outputTokens: number
): number => {
  const inputCost = (Math.max(0, inputTokens) / 1_000_000) * GPT_INPUT_COST_PER_1M;
  const outputCost = (Math.max(0, outputTokens) / 1_000_000) * GPT_OUTPUT_COST_PER_1M;
  return inputCost + outputCost;
};

const calculateGPTCostCents = (inputTokens: number, outputTokens: number): number => {
  return Math.round(calculateGPTCostUSD(inputTokens, outputTokens) * 100);
};

const calculateGptImageCostUSD = (
  inputTokens = 0,
  outputTokens = GPT_IMAGE_TYPICAL_OUTPUT_TOKENS
): number => {
  const normalizedOutputTokens =
    outputTokens > 0 ? outputTokens : GPT_IMAGE_TYPICAL_OUTPUT_TOKENS;

  return (
    (Math.max(0, inputTokens) / 1_000_000) * GPT_IMAGE_INPUT_COST_PER_1M +
    (normalizedOutputTokens / 1_000_000) * GPT_IMAGE_OUTPUT_COST_PER_1M
  );
};

export const GPT_IMAGE_TYPICAL_CREDITS = usdToCredits(
  calculateGptImageCostUSD()
);

export const calculateCloudflareBrowserRenderingCostUSD = (
  browserMs: number
): number => {
  if (!Number.isFinite(browserMs) || browserMs <= 0) {
    return 0;
  }

  return (browserMs / 3_600_000) * CLOUDFLARE_BROWSER_RENDERING_COST_PER_HOUR_USD;
};

export const formatTokens = (tokens: number): string => {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
};

export {
  CLOUDFLARE_BROWSER_RENDERING_COST_PER_HOUR_USD,
  FREE_MONTHLY_TOKENS,
  GPT_IMAGE_INPUT_COST_PER_1M,
  GPT_IMAGE_OUTPUT_COST_PER_1M,
  GPT_IMAGE_TYPICAL_OUTPUT_TOKENS,
  GPT_INPUT_COST_PER_1M,
  GPT_OUTPUT_COST_PER_1M,
  INTERNAL_CREDIT_COST_PER_1M_USD,
  calculateGPTCostCents,
  calculateGPTCostUSD,
  calculateGptImageCostUSD,
};
