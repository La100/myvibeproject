import type { ExtensionConfig } from "../types"

const MAIN_APP_URL =
  import.meta.env.VITE_MAIN_APP_URL?.trim() || "https://myvibeproject.com"

export const CONFIG: ExtensionConfig = {
  API_BASE: `${MAIN_APP_URL}/api`,
  MAIN_APP_URL,
  EXTENSION_ID: chrome.runtime?.id ?? "",
  VERSION: "3.0.2",
}

export type { ExtensionConfig }
