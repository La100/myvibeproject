const CLIENT_NOTIFICATION_ACTIONS = new Set([
  "shopping.customer.decision",
  "survey.response.submit",
]);

export const CLIENT_NOTIFICATION_READ_EVENT = "project-client-notifications-read";

export const getProjectClientNotificationsStorageKey = (projectId: string) =>
  `project:${projectId}:client-notifications:last-seen`;

export const isClientNotificationAction = (actionType: string) =>
  CLIENT_NOTIFICATION_ACTIONS.has(actionType);

export const isClientNotificationActivity = (activity: { actionType: string }) =>
  isClientNotificationAction(activity.actionType);

export const getProjectClientNotificationsLastSeen = (projectId: string) => {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(getProjectClientNotificationsStorageKey(projectId));
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

export const markProjectClientNotificationsRead = (projectId: string, lastSeenAt: number) => {
  if (typeof window === "undefined") return;
  const normalized = Number.isFinite(lastSeenAt) ? Math.floor(lastSeenAt) : Date.now();
  const currentLastSeen = getProjectClientNotificationsLastSeen(projectId);
  if (normalized <= currentLastSeen) {
    return;
  }

  window.localStorage.setItem(
    getProjectClientNotificationsStorageKey(projectId),
    String(normalized),
  );
  window.dispatchEvent(
    new CustomEvent(CLIENT_NOTIFICATION_READ_EVENT, {
      detail: { projectId, lastSeenAt: normalized },
    }),
  );
};
