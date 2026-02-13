import { CONFIG } from "./config"
import { ACTIONS, isObjectMessage } from "./lib/messages"
import { STORAGE_KEYS } from "./lib/storageKeys"

const AUTH_PATH = "/auth/extension"
const LOG_PREFIX = "[MyVibeProject Background]"

let authTabId: number | null = null

function isSupportedTabUrl(url?: string): url is string {
  if (!url) return false
  return /^(https?:)\/\//.test(url)
}

function isRestrictedUrl(url?: string): boolean {
  if (!url) return true

  const restrictedPrefixes = [
    "chrome://",
    "chrome-extension://",
    "edge://",
    "about:",
    "devtools://",
    "view-source:",
    "https://chrome.google.com/webstore",
    "https://chromewebstore.google.com",
  ]

  return restrictedPrefixes.some((prefix) => url.startsWith(prefix))
}

function getAuthUrl(): string {
  return new URL(AUTH_PATH, CONFIG.MAIN_APP_URL).toString()
}

function isAuthUrl(url?: string): boolean {
  if (!url) return false
  const expected = new URL(getAuthUrl())
  const candidate = new URL(url)
  return (
    candidate.origin === expected.origin &&
    candidate.pathname === expected.pathname
  )
}

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0] ?? null
}

async function sendMessageToTab<TResponse = unknown>(
  tabId: number,
  payload: unknown,
): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, payload, (response: TResponse) => {
      const runtimeError = chrome.runtime.lastError
      if (runtimeError) {
        reject(new Error(runtimeError.message))
        return
      }
      resolve(response)
    })
  })
}

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    await sendMessageToTab(tabId, { action: ACTIONS.PING })
    return
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Script injection failed"
      throw new Error(`Cannot inject clipper on this page: ${message}`)
    }
  }

  // Ensure listener is actually available after fallback injection.
  await sendMessageToTab(tabId, { action: ACTIONS.PING })
}

async function openClipperInActiveTab(): Promise<void> {
  const tab = await getActiveTab()
  if (!tab?.id || !isSupportedTabUrl(tab.url) || isRestrictedUrl(tab.url)) {
    return
  }

  try {
    await ensureContentScript(tab.id)
    try {
      await sendMessageToTab(tab.id, { action: ACTIONS.OPEN_IFRAME_POPUP })
    } catch {
      // One quick retry covers race conditions right after script injection.
      await ensureContentScript(tab.id)
      await sendMessageToTab(tab.id, { action: ACTIONS.OPEN_IFRAME_POPUP })
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to open clipper`, error)
  }
}

async function initiateAuthFlow(): Promise<void> {
  if (authTabId !== null) {
    try {
      await chrome.tabs.update(authTabId, { active: true })
      return
    } catch {
      authTabId = null
    }
  }

  const tab = await chrome.tabs.create({ url: getAuthUrl(), active: true })
  authTabId = tab.id ?? null
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (!isObjectMessage(request)) {
    return false
  }

  if (request.action === ACTIONS.INITIATE_AUTH) {
    void initiateAuthFlow()
      .then(() => sendResponse({ success: true }))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unknown error"
        sendResponse({ success: false, error: message })
      })
    return true
  }

  return false
})

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === authTabId) {
    authTabId = null
  }
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId !== authTabId || changeInfo.status !== "complete" || !isAuthUrl(tab.url)) {
    return
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () =>
        localStorage.getItem("myvibeproject_extension_token_sync") ??
        localStorage.getItem("vibeplanner_extension_token_sync"),
    })

    const token = typeof results[0]?.result === "string" ? results[0].result : null

    if (token) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.TOKEN]: token,
        [STORAGE_KEYS.TOKEN_TIMESTAMP]: Date.now(),
      })

      chrome.runtime.sendMessage({ action: ACTIONS.AUTH_COMPLETED }).catch(() => {
        // No listeners is fine.
      })

      await chrome.tabs.remove(tabId)
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to finalize auth`, error)
  } finally {
    authTabId = null
  }
})

chrome.action.onClicked.addListener(() => {
  void openClipperInActiveTab()
})

chrome.commands.onCommand.addListener((command) => {
  if (command === "open-clipper") {
    void openClipperInActiveTab()
  }
})
