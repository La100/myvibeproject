import { CONFIG } from "./config"
import { ACTIONS, isObjectMessage } from "./lib/messages"
import { STORAGE_KEYS } from "./lib/storageKeys"

const AUTH_PATH = "/auth/extension"
const LOG_PREFIX = "[MyVibeProject Background]"
const AUTH_TOKEN_POLL_TIMEOUT_MS = 12_000
const AUTH_TOKEN_POLL_INTERVAL_MS = 350
const MIN_TOKEN_VALIDITY_SECONDS = 60

let authTabId: number | null = null
let authRequestedAt: number | null = null
let returnTabId: number | null = null

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
  authRequestedAt = Date.now()
  try {
    const activeTab = await getActiveTab()
    returnTabId =
      activeTab?.id && !isAuthUrl(activeTab.url) ? activeTab.id : returnTabId
  } catch {
    // Best effort only; auth can proceed without a return target.
  }

  if (authTabId !== null) {
    try {
      await chrome.tabs.remove(authTabId)
    } catch {
      // Ignore stale tab id and continue with a fresh auth tab.
    }
    authTabId = null
  }

  const tab = await chrome.tabs.create({ url: getAuthUrl(), active: true })
  authTabId = tab.id ?? null
}

async function restoreReturnTab(): Promise<void> {
  if (returnTabId === null) {
    return
  }

  try {
    await chrome.tabs.update(returnTabId, { active: true })
  } catch {
    // Ignore when original tab no longer exists.
  } finally {
    returnTabId = null
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".")
  if (parts.length < 2) return null

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")
    return JSON.parse(atob(padded)) as Record<string, unknown>
  } catch {
    return null
  }
}

function isTokenFresh(token: string): boolean {
  const payload = decodeJwtPayload(token)
  const exp = payload?.exp
  if (typeof exp !== "number" || !Number.isFinite(exp)) {
    return false
  }

  return Date.now() + MIN_TOKEN_VALIDITY_SECONDS * 1000 < exp * 1000
}

type AuthSyncMeta = {
  updatedAt?: unknown
  expiresAt?: unknown
}

type AuthTabPayload = {
  token: string | null
  legacyToken: string | null
  metaUpdatedAt: number | null
}

async function readAuthPayloadFromTab(tabId: number): Promise<AuthTabPayload> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const token = localStorage.getItem("myvibeproject_extension_token_sync")
      const legacyToken = localStorage.getItem("vibeplanner_extension_token_sync")
      const rawMeta = localStorage.getItem("myvibeproject_extension_token_sync_meta")

      let metaUpdatedAt: number | null = null
      if (rawMeta) {
        try {
          const meta = JSON.parse(rawMeta) as AuthSyncMeta
          metaUpdatedAt =
            typeof meta?.updatedAt === "number" ? meta.updatedAt : null
        } catch {
          metaUpdatedAt = null
        }
      }

      return {
        token,
        legacyToken,
        metaUpdatedAt,
      }
    },
  })

  const payload = results[0]?.result as AuthTabPayload | undefined
  return {
    token: payload?.token ?? null,
    legacyToken: payload?.legacyToken ?? null,
    metaUpdatedAt: payload?.metaUpdatedAt ?? null,
  }
}

async function waitForFreshTokenFromAuthTab(
  tabId: number,
  previousToken: string | null,
  requestedAt: number | null,
): Promise<string | null> {
  const deadline = Date.now() + AUTH_TOKEN_POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    const payload = await readAuthPayloadFromTab(tabId).catch(() => null)
    const candidate = payload?.token ?? payload?.legacyToken ?? null
    if (!candidate) {
      await new Promise((resolve) => setTimeout(resolve, AUTH_TOKEN_POLL_INTERVAL_MS))
      continue
    }

    const markerIsFresh =
      typeof payload?.metaUpdatedAt === "number" &&
      typeof requestedAt === "number" &&
      payload.metaUpdatedAt >= requestedAt

    const tokenIsNew = candidate !== previousToken
    const freshEnough = isTokenFresh(candidate)

    // Accept token immediately when auth page confirms a fresh sync marker.
    // This avoids false negatives when token value stays the same or exp parsing differs.
    if (markerIsFresh) {
      return candidate
    }

    // Fallback: still accept genuinely new and sufficiently fresh tokens.
    if (freshEnough && tokenIsNew) {
      return candidate
    }

    await new Promise((resolve) => setTimeout(resolve, AUTH_TOKEN_POLL_INTERVAL_MS))
  }

  return null
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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

  if (request.action === ACTIONS.CAPTURE_VISIBLE_TAB) {
    void (async () => {
      try {
        const windowId = sender.tab?.windowId
        if (typeof windowId !== "number") {
          throw new Error("Active browser window is unavailable")
        }

        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
          format: "png",
        })
        sendResponse({ success: true, dataUrl })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to capture screenshot"
        sendResponse({ success: false, error: message })
      }
    })()
    return true
  }

  return false
})

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === authTabId) {
    authTabId = null
    authRequestedAt = null
  }
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId !== authTabId || changeInfo.status !== "complete" || !isAuthUrl(tab.url)) {
    return
  }

  try {
    const existing = await chrome.storage.local.get([STORAGE_KEYS.TOKEN])
    const previousToken =
      typeof existing[STORAGE_KEYS.TOKEN] === "string"
        ? existing[STORAGE_KEYS.TOKEN]
        : null

    const token = await waitForFreshTokenFromAuthTab(
      tabId,
      previousToken,
      authRequestedAt,
    )

    if (token) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.TOKEN]: token,
        [STORAGE_KEYS.TOKEN_TIMESTAMP]: Date.now(),
      })

      chrome.runtime.sendMessage({ action: ACTIONS.AUTH_COMPLETED }).catch(() => {
        // No listeners is fine.
      })

      await chrome.tabs.remove(tabId)
      await restoreReturnTab()
    } else {
      console.warn(`${LOG_PREFIX} Auth tab completed but fresh token was not found`)
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to finalize auth`, error)
  } finally {
    authTabId = null
    authRequestedAt = null
    if (authTabId === null) {
      // Keep returnTabId only while auth tab is active.
      // If auth ends or is interrupted, clear to avoid stale jumps later.
      returnTabId = null
    }
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
