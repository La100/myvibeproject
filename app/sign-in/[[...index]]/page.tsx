"use client";

import { useEffect } from "react";
import { SignIn, useSignIn, useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { authClerkAppearance } from "@/lib/authClerkAppearance";
import {
  resolveLocalRedirectUrl,
  signInFallbackRedirectUrl,
  signInUrl,
  signUpUrl,
} from "@/lib/authRedirects";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { useI18n } from "@/lib/i18n";

export default function SignInPage() {
  const { t } = useI18n();
  const { signIn, setActive, isLoaded: isSignInLoaded } = useSignIn();
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = resolveLocalRedirectUrl(
    searchParams.get("redirect_url"),
    signInFallbackRedirectUrl,
  );

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace(redirectUrl);
    }
  }, [isLoaded, isSignedIn, redirectUrl, router]);

  useEffect(() => {
    if (!isSignInLoaded || !signIn || !setActive) {
      return;
    }

    const ticket = searchParams.get("__clerk_ticket");
    if (!ticket) {
      return;
    }

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
        toast.error(t("auth", "couldNotSignInFromLink"), {
          description: toUserFacingErrorMessage(error),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignInLoaded, redirectUrl, searchParams, setActive, signIn, t]);

  return (
    <AuthShell termsVerb="in">
      <SignIn
        path={signInUrl}
        routing="path"
        signUpUrl={signUpUrl}
        fallbackRedirectUrl={redirectUrl}
        forceRedirectUrl={null}
        oauthFlow="redirect"
        appearance={authClerkAppearance}
      />
    </AuthShell>
  );
}
