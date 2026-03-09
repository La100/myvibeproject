
import { calculateTextCostUsd } from "./billing";

export const AI_MODEL = "gpt-5.2";


export const AI_CONFIG = {
  model: AI_MODEL,
  temperature: 1,
  maxSteps: 5,
};


export function calculateCost(_model: string, inputTokens: number, outputTokens: number): number {
  return calculateTextCostUsd(inputTokens, outputTokens);
}
