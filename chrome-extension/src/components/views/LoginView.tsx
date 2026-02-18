import { useEffect, useState } from "react"
import type { Team, User } from "../../types"
import { CONFIG } from "../../config"
import { ACTIONS } from "../../lib/messages"
import { STORAGE_KEYS } from "../../lib/storageKeys"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Loader2, ShieldCheck, Sparkles } from "lucide-react"

interface LoginViewProps {
  onLogin: (user: User, teams: Team[]) => void
  showToast: (message: string, type?: "success" | "error" | "info") => void
}

const LoginView = ({ onLogin, showToast }: LoginViewProps) => {
  const [isLoading, setIsLoading] = useState(false)

  const verifyTokenAndLogin = async (token: string): Promise<boolean> => {
    setIsLoading(true)

    try {
      const response = await fetch(`${CONFIG.API_BASE}/clipper`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        let errorMessage = "Sign-in failed. Please sync your session again."
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null
        if (payload?.message) {
          errorMessage = payload.message
        }
        showToast(errorMessage, "error")
        await chrome.storage.local.remove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.TOKEN_TIMESTAMP])
        return false
      }

      const data = (await response.json()) as { user?: User; teams?: Team[] }
      if (data.user && Array.isArray(data.teams)) {
        onLogin(data.user, data.teams)
        showToast("Signed in successfully.", "success")
        return true
      } else {
        showToast("Invalid server response.", "error")
        return false
      }
    } catch {
      showToast("Could not connect to the server.", "error")
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const pollForSyncedToken = async (
    baselineToken: string | null,
    baselineTimestamp: number | null,
  ) => {
    const timeoutAt = Date.now() + 25_000
    let seenToken = baselineToken
    let seenTimestamp = baselineTimestamp

    while (Date.now() < timeoutAt) {
      const snapshot = await chrome.storage.local.get([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.TOKEN_TIMESTAMP,
      ])
      const token =
        typeof snapshot[STORAGE_KEYS.TOKEN] === "string"
          ? snapshot[STORAGE_KEYS.TOKEN]
          : null
      const timestamp =
        typeof snapshot[STORAGE_KEYS.TOKEN_TIMESTAMP] === "number"
          ? snapshot[STORAGE_KEYS.TOKEN_TIMESTAMP]
          : null

      const tokenChanged = token !== seenToken || timestamp !== seenTimestamp
      if (token && tokenChanged) {
        seenToken = token
        seenTimestamp = timestamp
        const success = await verifyTokenAndLogin(token)
        if (success) {
          return
        }
      }

      await new Promise((resolve) => window.setTimeout(resolve, 400))
    }

    setIsLoading(false)
    showToast("Sign-in timed out. Please click Sync session again.", "error")
  }

  useEffect(() => {
    const storageListener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== "local") return

      const tokenChange = changes[STORAGE_KEYS.TOKEN]
      if (typeof tokenChange?.newValue === "string" && tokenChange.newValue) {
        void verifyTokenAndLogin(tokenChange.newValue)
      }
    }

    const runtimeListener = (message: unknown) => {
      if (
        typeof message === "object" &&
        message !== null &&
        "action" in message &&
        (message as { action?: string }).action === ACTIONS.AUTH_COMPLETED
      ) {
        void chrome.storage.local.get([STORAGE_KEYS.TOKEN]).then((result) => {
          const token = result[STORAGE_KEYS.TOKEN]
          if (typeof token === "string") {
            void verifyTokenAndLogin(token)
            return
          }
        })
      }
    }

    chrome.storage.onChanged.addListener(storageListener)
    chrome.runtime.onMessage.addListener(runtimeListener)

    return () => {
      chrome.storage.onChanged.removeListener(storageListener)
      chrome.runtime.onMessage.removeListener(runtimeListener)
    }
  }, [])

  const handleSyncFromApp = async () => {
    setIsLoading(true)
    showToast("Finish sign-in in the newly opened tab.", "info")

    const baseline = await chrome.storage.local.get([
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.TOKEN_TIMESTAMP,
    ])
    const baselineToken =
      typeof baseline[STORAGE_KEYS.TOKEN] === "string"
        ? baseline[STORAGE_KEYS.TOKEN]
        : null
    const baselineTimestamp =
      typeof baseline[STORAGE_KEYS.TOKEN_TIMESTAMP] === "number"
        ? baseline[STORAGE_KEYS.TOKEN_TIMESTAMP]
        : null

    chrome.runtime.sendMessage({ action: ACTIONS.INITIATE_AUTH }, () => {
      const runtimeError = chrome.runtime.lastError
      if (runtimeError) {
        showToast("Could not start sign-in.", "error")
        setIsLoading(false)
        return
      }

      void pollForSyncedToken(baselineToken, baselineTimestamp)
    })
  }

  const handleOpenMainApp = () => {
    void chrome.tabs.create({ url: CONFIG.MAIN_APP_URL })
  }

  return (
    <div className="flex h-full flex-col px-4 pb-4 pt-6">
      <div className="mb-4 space-y-2">
        <span className="vp-chip">MyVibeProject Clipper</span>
        <h1 className="clean-title text-2xl font-medium leading-tight text-foreground">
          Add products
          <br />
          without leaving the page.
        </h1>
        <p className="text-sm text-muted-foreground">
          Connect the extension to MyVibeProject and start clipping automatically.
        </p>
      </div>

      <Card className="clean-panel flex-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Sign In</CardTitle>
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <CardDescription>
            Authentication is handled by the main app.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <Button className="w-full" onClick={handleSyncFromApp} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Sync session
          </Button>

          <Button variant="outline" className="w-full" onClick={handleOpenMainApp}>
            Open MyVibeProject
          </Button>

          <div className="mt-2 rounded-xl border border-white/80 bg-white/75 px-3 py-2 text-[11px] text-muted-foreground">
            Version {CONFIG.VERSION}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default LoginView
