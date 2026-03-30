export function recoverReplayedCallStatus(
  status: string | undefined,
  result: string | undefined,
) {
  if (status !== "replayed" || !result) {
    return status;
  }

  try {
    const parsedResult = JSON.parse(result);
    if (parsedResult.status === "confirmed" || parsedResult.status === "rejected") {
      return parsedResult.status;
    }
    if (
      typeof parsedResult.result === "string" &&
      parsedResult.result.toLowerCase().includes("rejected")
    ) {
      return "rejected";
    }
    return "confirmed";
  } catch {
    const normalizedResult = result.toLowerCase();
    return normalizedResult.includes("rejected") ? "rejected" : "confirmed";
  }
}
