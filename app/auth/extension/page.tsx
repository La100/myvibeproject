/// <reference types="chrome" />
"use client"

import { useAuth, useUser } from "@clerk/nextjs"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ONBOARDING_EXTENSION_READY_KEY,
  writeOnboardingFlag,
} from "@/lib/onboardingJourney"

const TOKEN_SYNC_KEY = "myvibeproject_extension_token_sync"
const TOKEN_SYNC_META_KEY = "myvibeproject_extension_token_sync_meta"

function extractTokenExpiry(token: string): number | null {
  const parts = token.split(".")
  if (parts.length < 2) return null

  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")))
    const exp = payload?.exp
    return typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : null
  } catch {
    return null
  }
}

export default function ExtensionAuthPage() {
  const { getToken } = useAuth()
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()

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

    setStatus("Getting extension token...")
  }, [isLoaded, isSignedIn, router])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return
    }

    const storeToken = async () => {
      try {
        const token = await getToken({ template: "convex" })

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
            expiresAt: extractTokenExpiry(token),
          }),
        )
        writeOnboardingFlag(ONBOARDING_EXTENSION_READY_KEY, true)

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
  }, [getToken, isLoaded, isSignedIn])

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
