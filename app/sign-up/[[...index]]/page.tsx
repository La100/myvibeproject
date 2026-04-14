"use client";

import { useEffect } from "react";
import { SignUp, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { authClerkAppearance } from "@/lib/authClerkAppearance";
import {
  resolveLocalRedirectUrl,
  signInFallbackRedirectUrl,
  signInUrl,
  signUpFallbackRedirectUrl,
  signUpUrl,
} from "@/lib/authRedirects";

export default function SignUpPage() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = resolveLocalRedirectUrl(
    searchParams.get("redirect_url"),
    signUpFallbackRedirectUrl,
  );

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace(redirectUrl);
    }
  }, [isLoaded, isSignedIn, redirectUrl, router]);

  return (
    <AuthShell termsVerb="up">
      <SignUp
        path={signUpUrl}
        routing="path"
        signInUrl={signInUrl}
        fallbackRedirectUrl={signUpFallbackRedirectUrl}
        signInFallbackRedirectUrl={signInFallbackRedirectUrl}
        forceRedirectUrl={null}
        signInForceRedirectUrl={null}
        oauthFlow="redirect"
        appearance={authClerkAppearance}
      />
    </AuthShell>
  );
}
