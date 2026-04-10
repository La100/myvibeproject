export const ONBOARDING_EXTENSION_READY_KEY = "myvibeproject-onboarding-extension-ready";
export const ONBOARDING_DASHBOARD_QUESTS_HIDDEN_KEY = "myvibeproject-onboarding-dashboard-quests-hidden";
export const ONBOARDING_PROJECT_DASHBOARD_QUESTS_HIDDEN_KEY_PREFIX =
  "myvibeproject-onboarding-project-dashboard-quests-hidden";
export const ONBOARDING_PROJECT_DASHBOARD_QUESTS_GLOBAL_HIDDEN_KEY =
  "myvibeproject-onboarding-project-dashboard-quests-global-hidden";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readOnboardingFlag(key: string): boolean {
  if (!canUseStorage()) {
    return false;
  }

  return window.localStorage.getItem(key) === "true";
}

export function writeOnboardingFlag(key: string, value: boolean) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(key, value ? "true" : "false");
}

export function getProjectOnboardingQuestsHiddenKey(projectId: string) {
  return `${ONBOARDING_PROJECT_DASHBOARD_QUESTS_HIDDEN_KEY_PREFIX}:${projectId}`;
}
