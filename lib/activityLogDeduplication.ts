type ActivityLike = {
  _creationTime: number;
  actionType: string;
  entityId?: string;
  details?: Record<string, unknown> | null;
};

const DUPLICATE_WINDOW_MS = 2_000;

const getDecisionKey = (activity: ActivityLike) => {
  if (activity.actionType !== "shopping.customer.decision") {
    return null;
  }

  const details = activity.details ?? {};
  const entityId = activity.entityId || "";
  const decision = typeof details.decision === "string" ? details.decision : "";
  const actorName = typeof details.actorName === "string" ? details.actorName : "";
  const itemName = typeof details.itemName === "string" ? details.itemName : "";

  if (!entityId || !decision) {
    return null;
  }

  return `${entityId}:${decision}:${actorName}:${itemName}`;
};

export const dedupeActivityLogActivities = <T extends ActivityLike>(activities: T[]): T[] => {
  const seenDecisionKeys = new Map<string, number>();

  return activities.filter((activity) => {
    const details = activity.details ?? {};
    const decisionKey = getDecisionKey(activity);

    if (decisionKey) {
      const previousTimestamp = seenDecisionKeys.get(decisionKey);
      if (
        previousTimestamp !== undefined &&
        Math.abs(previousTimestamp - activity._creationTime) <= DUPLICATE_WINDOW_MS
      ) {
        return false;
      }

      seenDecisionKeys.set(decisionKey, activity._creationTime);
      return true;
    }

    if (activity.actionType !== "shopping.customer.feedback") {
      return true;
    }

    const entityId = activity.entityId || "";
    const decision = typeof details.decision === "string" ? details.decision : "";
    const actorName = typeof details.actorName === "string" ? details.actorName : "";
    const itemName = typeof details.itemName === "string" ? details.itemName : "";
    const comment = typeof details.comment === "string" ? details.comment.trim() : "";

    if (!entityId || !decision || comment) {
      return true;
    }

    const matchingDecisionTime = seenDecisionKeys.get(
      `${entityId}:${decision}:${actorName}:${itemName}`,
    );

    if (
      matchingDecisionTime !== undefined &&
      Math.abs(matchingDecisionTime - activity._creationTime) <= DUPLICATE_WINDOW_MS
    ) {
      return false;
    }

    return true;
  });
};
