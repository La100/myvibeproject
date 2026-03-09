const CLIENT_NOTIFICATION_ACTIONS = new Set([
  "shopping.customer.decision",
  "survey.response.submit",
]);

export const isClientNotificationAction = (actionType: string) =>
  CLIENT_NOTIFICATION_ACTIONS.has(actionType);

export const isClientNotificationActivity = (activity: { actionType: string }) =>
  isClientNotificationAction(activity.actionType);
