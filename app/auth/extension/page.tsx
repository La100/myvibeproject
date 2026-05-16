/// <reference types="chrome" />
"use client"

import { useMutation } from "convex/react"
import { useUser } from "@clerk/nextjs"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiAny } from "@/lib/convexApiAny"
import { useI18n } from "@/lib/i18n"

const TOKEN_SYNC_KEY = "myvibeproject_extension_token_sync"
const TOKEN_SYNC_META_KEY = "myvibeproject_extension_token_sync_meta"

export default function ExtensionAuthPage() {
  const { t } = useI18n()
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const createExtensionSession = useMutation(apiAny.extensionSessions.createExtensionSession)
  const markClipperConnected = useMutation(apiAny.onboarding.markClipperConnected)

  const [status, setStatus] = useState(t("extensionAuth", "checkingAuthentication"))
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    if (!isSignedIn) {
      setStatus(t("extensionAuth", "noActiveSession"))
      router.push("/sign-up")
      return
    }

    setStatus(t("extensionAuth", "creatingSession"))
  }, [isLoaded, isSignedIn, router, t])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return
    }

    const storeToken = async () => {
      try {
        const session = await createExtensionSession({})
        const token = session?.token

        if (!token) {
          setStatus(t("extensionAuth", "error"))
          setError(t("extensionAuth", "tokenError"))
          return
        }

        localStorage.setItem(TOKEN_SYNC_KEY, token)
        localStorage.setItem(
          TOKEN_SYNC_META_KEY,
          JSON.stringify({
            updatedAt: Date.now(),
            expiresAt:
              typeof session?.expiresAt === "number" ? session.expiresAt : null,
          }),
        )
        await markClipperConnected()

        setStatus(t("extensionAuth", "success"))
        setError("")
      } catch (e: unknown) {
        setStatus(t("extensionAuth", "error"))
        setError(
          t("extensionAuth", "genericProblem", {
            message: e instanceof Error ? e.message : t("extensionAuth", "unknownError"),
          }),
        )
      }
    }

    void storeToken()
  }, [createExtensionSession, isLoaded, isSignedIn, markClipperConnected, t])

  return (
    <div
      style={{
        padding: "40px",
        fontFamily: "sans-serif",
        textAlign: "center",
        color: "var(--foreground)",
      }}
    >
      <h1>{t("extensionAuth", "title")}</h1>
      <h2 style={{ color: error ? "var(--destructive)" : "var(--ui-accent-brand)" }}>{status}</h2>
      {error && <p style={{ color: "var(--destructive)" }}>{error}</p>}
      <p>{t("extensionAuth", "returnToExtension")}</p>
    </div>
  )
}
