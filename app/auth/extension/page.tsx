/// <reference types="chrome" />
"use client"

import { useAuth, useUser } from "@clerk/nextjs"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

const TOKEN_SYNC_KEY = "myvibeproject_extension_token_sync"
const LEGACY_TOKEN_SYNC_KEY = "vibeplanner_extension_token_sync"

export default function ExtensionAuthPage() {
  const { getToken } = useAuth()
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()

  const [status, setStatus] = useState("Sprawdzanie autoryzacji...")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    if (!isSignedIn) {
      setStatus("Brak sesji. Przekierowanie do logowania...")
      router.push("/sign-up")
      return
    }

    setStatus("Pobieranie tokena dla rozszerzenia...")
  }, [isLoaded, isSignedIn, router])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return
    }

    const storeToken = async () => {
      try {
        const token = await getToken({ template: "convex" })

        if (!token) {
          setStatus("Błąd")
          setError("Nie udało się pobrać tokena autoryzacji.")
          return
        }

        localStorage.setItem(TOKEN_SYNC_KEY, token)
        localStorage.setItem(LEGACY_TOKEN_SYNC_KEY, token)

        setStatus("Sukces. Możesz zamknąć tę kartę.")
        setError("")
      } catch (e: unknown) {
        setStatus("Błąd")
        setError(
          `Wystąpił problem podczas autoryzacji: ${
            e instanceof Error ? e.message : "Unknown error"
          }`,
        )
      }
    }

    void storeToken()
  }, [getToken, isLoaded, isSignedIn])

  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif", textAlign: "center", color: "#333" }}>
      <h1>MyVibeProject Extension Authentication</h1>
      <h2 style={{ color: error ? "#b91c1c" : "#15803d" }}>{status}</h2>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      <p>Po zakończeniu możesz wrócić do rozszerzenia i kontynuować.</p>
    </div>
  )
}
