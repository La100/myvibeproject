export const isAiDebugLoggingEnabled = () =>
  process.env.AI_DEBUG_LOGS === "true" || process.env.NODE_ENV !== "production";

export const aiDebugLog = (...args: unknown[]) => {
  if (!isAiDebugLoggingEnabled()) {
    return;
  }
  console.log(...args);
};
