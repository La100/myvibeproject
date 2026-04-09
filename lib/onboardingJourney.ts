export const ONBOARDING_EXTENSION_READY_KEY = "myvibeproject-onboarding-extension-ready";
export const ONBOARDING_DASHBOARD_QUESTS_HIDDEN_KEY = "myvibeproject-onboarding-dashboard-quests-hidden";

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
