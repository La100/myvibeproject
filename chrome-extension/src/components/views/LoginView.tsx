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

  const verifyTokenAndLogin = async (token: string) => {
    setIsLoading(true)

    try {
      const response = await fetch(`${CONFIG.API_BASE}/clipper`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        showToast("Sesja wygasła. Zaloguj się ponownie.", "error")
        await chrome.storage.local.remove([STORAGE_KEYS.TOKEN])
        return
      }

      const data = (await response.json()) as { user?: User; teams?: Team[] }
      if (data.user && Array.isArray(data.teams)) {
        onLogin(data.user, data.teams)
        showToast("Zalogowano pomyślnie.", "success")
      } else {
        showToast("Nieprawidłowa odpowiedź serwera.", "error")
      }
    } catch {
      showToast("Błąd połączenia z serwerem.", "error")
    } finally {
      setIsLoading(false)
    }
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
            return verifyTokenAndLogin(token)
          }
          return Promise.resolve()
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

  const handleSyncFromApp = () => {
    setIsLoading(true)
    showToast("Dokończ logowanie w nowej karcie.", "info")

    chrome.runtime.sendMessage({ action: ACTIONS.INITIATE_AUTH }, () => {
      const runtimeError = chrome.runtime.lastError
      if (runtimeError) {
        showToast("Nie udało się uruchomić logowania.", "error")
        setIsLoading(false)
        return
      }

      window.setTimeout(() => {
        setIsLoading(false)
      }, 3000)
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
          Dodawaj produkty
          <br />
          bez opuszczania strony.
        </h1>
        <p className="text-sm text-muted-foreground">
          Połącz rozszerzenie z MyVibeProject i zacznij automatyczne clipowanie.
        </p>
      </div>

      <Card className="clean-panel flex-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Logowanie</CardTitle>
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <CardDescription>
            Uwierzytelnianie jest wykonywane przez główną aplikację.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <Button className="w-full" onClick={handleSyncFromApp} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Synchronizuj sesję
          </Button>

          <Button variant="outline" className="w-full" onClick={handleOpenMainApp}>
            Otwórz MyVibeProject
          </Button>

          <div className="mt-2 rounded-xl border border-white/80 bg-white/75 px-3 py-2 text-[11px] text-muted-foreground">
            Wersja {CONFIG.VERSION}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default LoginView
