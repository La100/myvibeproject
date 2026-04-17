/// <reference types="chrome" />
"use client"

import { useMutation } from "convex/react"
import { useUser } from "@clerk/nextjs"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiAny } from "@/lib/convexApiAny"

const TOKEN_SYNC_KEY = "myvibeproject_extension_token_sync"
const TOKEN_SYNC_META_KEY = "myvibeproject_extension_token_sync_meta"

export default function ExtensionAuthPage() {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const createExtensionSession = useMutation(apiAny.extensionSessions.createExtensionSession)
  const markClipperConnected = useMutation(apiAny.onboarding.markClipperConnected)

  const [status, setStatus] = useState("Checking authentication...")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    if (!isSignedIn) {
      setStatus("No active session. Redirecting to sign-in...")
      router.push("/sign-up")
      return
    }

    setStatus("Creating extension session...")
  }, [isLoaded, isSignedIn, router])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return
    }

    const storeToken = async () => {
      try {
        const session = await createExtensionSession({})
        const token = session?.token

        if (!token) {
          setStatus("Error")
          setError("Could not get an authentication token.")
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

        setStatus("Success. You can close this tab.")
        setError("")
      } catch (e: unknown) {
        setStatus("Error")
        setError(
          `There was a problem during authentication: ${
            e instanceof Error ? e.message : "Unknown error"
          }`,
        )
      }
    }

    void storeToken()
  }, [createExtensionSession, isLoaded, isSignedIn, markClipperConnected])

  return (
    <div
      style={{
        padding: "40px",
        fontFamily: "sans-serif",
        textAlign: "center",
        color: "var(--foreground)",
      }}
    >
      <h1>MyVibeProject Extension Authentication</h1>
      <h2 style={{ color: error ? "var(--destructive)" : "var(--ui-accent-brand)" }}>{status}</h2>
      {error && <p style={{ color: "var(--destructive)" }}>{error}</p>}
      <p>Once done, return to the extension to continue.</p>
    </div>
  )
}
