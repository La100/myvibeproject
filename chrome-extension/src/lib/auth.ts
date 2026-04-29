import { ACTIONS, isObjectMessage } from "./messages"
import { STORAGE_KEYS } from "./storageKeys"

const AUTH_SYNC_TIMEOUT_MS = 20_000
const TOKEN_REFRESH_SKEW_SECONDS = 90

let ongoingSync: Promise<string | null> | null = null

async function getStoredToken(): Promise<string | null> {
  const result = await chrome.storage.local.get([STORAGE_KEYS.TOKEN])
  return typeof result[STORAGE_KEYS.TOKEN] === "string"
    ? result[STORAGE_KEYS.TOKEN]
    : null
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".")
  if (parts.length < 2) {
    return null
  }

  try {
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")
    const json = atob(padded)
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

function getTokenExpiryMs(token: string): number | null {
  const payload = decodeJwtPayload(token)
  const exp = payload?.exp
  if (typeof exp !== "number" || !Number.isFinite(exp)) {
    return null
  }

  return exp * 1000
}

function isTokenExpiringSoon(token: string): boolean {
  const expiryMs = getTokenExpiryMs(token)
  if (!expiryMs) {
    return false
  }

  const refreshBeforeMs = TOKEN_REFRESH_SKEW_SECONDS * 1000
  return Date.now() >= expiryMs - refreshBeforeMs
}

function sendInitiateAuthMessage(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: ACTIONS.INITIATE_AUTH }, (response) => {
      const runtimeError = chrome.runtime.lastError
      if (runtimeError) {
        resolve(false)
        return
      }

      if (
        response &&
        typeof response === "object" &&
        "success" in response &&
        (response as { success?: boolean }).success === true
      ) {
        resolve(true)
        return
      }

      resolve(false)
    })
  })
}

function waitForTokenSync(
  timeoutMs: number,
  previousToken: string | null,
  previousTimestamp: number | null,
): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false

    const finish = (token: string | null) => {
      if (done) return
      done = true
      window.clearTimeout(timeoutId)
      chrome.storage.onChanged.removeListener(storageListener)
      chrome.runtime.onMessage.removeListener(runtimeListener)
      resolve(token)
    }

    const readAndResolve = (allowUnchangedToken = false) => {
      void chrome.storage.local
        .get([STORAGE_KEYS.TOKEN, STORAGE_KEYS.TOKEN_TIMESTAMP])
        .then((token) => {
          const candidate =
            typeof token[STORAGE_KEYS.TOKEN] === "string"
              ? token[STORAGE_KEYS.TOKEN]
              : null
          const candidateTimestamp =
            typeof token[STORAGE_KEYS.TOKEN_TIMESTAMP] === "number"
              ? token[STORAGE_KEYS.TOKEN_TIMESTAMP]
              : null

          if (!candidate) {
            return
          }

          if (allowUnchangedToken) {
            finish(candidate)
            return
          }

          if (
            candidate !== previousToken ||
            candidateTimestamp !== previousTimestamp
          ) {
            finish(candidate)
          }
        })
        .catch(() => {
          // Ignore and keep waiting until timeout.
        })
    }

    const storageListener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== "local") return
      if (
        STORAGE_KEYS.TOKEN in changes ||
        STORAGE_KEYS.TOKEN_TIMESTAMP in changes
      ) {
        readAndResolve()
      }
    }

    const runtimeListener = (message: unknown) => {
      if (!isObjectMessage(message)) return
      if (message.action === ACTIONS.AUTH_COMPLETED) {
        readAndResolve(true)
      }
    }

    const timeoutId = window.setTimeout(() => finish(null), timeoutMs)

    chrome.storage.onChanged.addListener(storageListener)
    chrome.runtime.onMessage.addListener(runtimeListener)

    // Covers the case where token is already available before listeners attach.
    readAndResolve()
  })
}

async function syncTokenWithMainApp(
  timeoutMs: number = AUTH_SYNC_TIMEOUT_MS,
): Promise<string | null> {
  if (ongoingSync) {
    return ongoingSync
  }

  ongoingSync = (async () => {
    const before = await chrome.storage.local.get([
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.TOKEN_TIMESTAMP,
    ])
    const previousToken =
      typeof before[STORAGE_KEYS.TOKEN] === "string"
        ? before[STORAGE_KEYS.TOKEN]
        : null
    const previousTimestamp =
      typeof before[STORAGE_KEYS.TOKEN_TIMESTAMP] === "number"
        ? before[STORAGE_KEYS.TOKEN_TIMESTAMP]
        : null

    const initiated = await sendInitiateAuthMessage()
    if (!initiated) {
      return null
    }

    return waitForTokenSync(timeoutMs, previousToken, previousTimestamp)
  })()

  try {
    return await ongoingSync
  } finally {
    ongoingSync = null
  }
}

async function ensureUsableToken(options?: {
  forceSync?: boolean
  allowInteractiveAuth?: boolean
}): Promise<string | null> {
  const forceSync = options?.forceSync === true
  const allowInteractiveAuth = options?.allowInteractiveAuth === true

  const token = await getStoredToken()
  if (token && !isTokenExpiringSoon(token)) {
    return token
  }

  // Prevent opening /auth/extension implicitly during normal background calls.
  // Interactive auth should happen only after explicit user intent.
  if (!allowInteractiveAuth) {
    // During forced refresh, returning a stale token causes ineffective auth retries.
    // Return null so callers can handle re-auth explicitly.
    return forceSync ? null : token ?? null
  }

  if (!forceSync && token) {
    return token
  }

  return syncTokenWithMainApp()
}

function withAuthHeader(init: RequestInit | undefined, token: string): RequestInit {
  const headers = new Headers(init?.headers)
  headers.set("Authorization", `Bearer ${token}`)
  return {
    ...init,
    headers,
  }
}

async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: {
    retryOnAuthFailure?: boolean
    preferredToken?: string | null
    allowInteractiveAuth?: boolean
  },
): Promise<Response> {
  const retryOnAuthFailure = options?.retryOnAuthFailure !== false
  const preferredToken = options?.preferredToken ?? null
  const allowInteractiveAuth = options?.allowInteractiveAuth === true

  const firstToken =
    preferredToken && !isTokenExpiringSoon(preferredToken)
      ? preferredToken
      : await ensureUsableToken({ allowInteractiveAuth })

  if (!firstToken) {
    throw new Error("AUTH_REQUIRED")
  }

  const firstResponse = await fetch(input, withAuthHeader(init, firstToken))
  if (firstResponse.status !== 401 || !retryOnAuthFailure) {
    return firstResponse
  }

  const refreshedToken = await ensureUsableToken({
    forceSync: true,
    allowInteractiveAuth,
  })
  if (!refreshedToken) {
    return firstResponse
  }

  return fetch(input, withAuthHeader(init, refreshedToken))
}

export { authenticatedFetch, ensureUsableToken }
