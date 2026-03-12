"use client";

import { useEffect } from "react";
import { useSignIn, useSignUp, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";

export default function SignUpPage() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/dashboard");
    }
  }, [isLoaded, isSignedIn, router]);

  const handleGoogleSignUp = async () => {
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

  const handleLogIn = async () => {
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

  return (
    <AuthShell
      primaryActionLabel="Sign up"
      primaryAction={handleGoogleSignUp}
      secondaryActionLabel="Log in"
      secondaryAction={handleLogIn}
      termsVerb="up"
    />
  );
}
