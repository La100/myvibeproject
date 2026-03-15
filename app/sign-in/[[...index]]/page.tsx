"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSignIn, useSignUp, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";

export default function SignInPage() {
  const { signIn, setActive, isLoaded: isSignInLoaded } = useSignIn();
  const { signUp } = useSignUp();
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/dashboard");
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isSignInLoaded || !signIn || !setActive) {
      return;
    }

    const ticket = searchParams.get("__clerk_ticket");
    if (!ticket) {
      return;
    }

    const redirectUrl = searchParams.get("redirect_url") || "/dashboard";
    let cancelled = false;

    void (async () => {
      try {
        const result = await signIn.create({
          strategy: "ticket",
          ticket,
        });
        if (cancelled) {
          return;
        }

        if (result.status !== "complete" || !result.createdSessionId) {
          throw new Error(`Ticket sign-in did not complete: ${result.status}`);
        }

        await setActive({
          session: result.createdSessionId,
          redirectUrl,
        });
      } catch (error) {
        console.error("Error signing in with ticket:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignInLoaded, router, searchParams, setActive, signIn]);

  const handleGoogleSignIn = async () => {
    if (isSignedIn) {
      router.replace("/dashboard");
      return;
    }

    try {
      await signIn?.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/dashboard",

      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("already signed in")) {
        router.replace("/dashboard");
        return;
      }
      console.error("Error signing in with Google:", error);
    }
  };

  const handleSignUp = async () => {
    if (isSignedIn) {
      router.replace("/dashboard");
      return;
    }

    try {
      await signUp?.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/dashboard",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("already signed in")) {
        router.replace("/dashboard");
        return;
      }
      console.error("Error signing up with Google:", error);
    }
  };

  return (
    <AuthShell
      primaryActionLabel="Log in"
      primaryAction={handleGoogleSignIn}
      secondaryActionLabel="Sign up"
      secondaryAction={handleSignUp}
      termsVerb="in"
    />
  );
}
