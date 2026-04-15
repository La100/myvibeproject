"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { Spinner } from "@/components/ui/spinner";
import {
  signInFallbackRedirectUrl,
  signInUrl,
  signUpFallbackRedirectUrl,
  signUpUrl,
} from "@/lib/authRedirects";

export default function SSOCallbackPage() {
  const router = useRouter();
  const clerk = useClerk();
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    void clerk
      .handleRedirectCallback(
        {
          signInUrl,
          signUpUrl,
          signInFallbackRedirectUrl,
          signUpFallbackRedirectUrl,
        },
        async (to) => {
          const parsed = new URL(to, window.location.origin);
          if (parsed.origin === window.location.origin) {
            router.replace(`${parsed.pathname}${parsed.search}${parsed.hash}`);
            return;
          }

          window.location.assign(to);
        },
      )
      .catch((callbackError) => {
        console.error("SSO callback failed:", callbackError);
        setError("Could not complete sign-in callback. Try again.");
      });
  }, [clerk, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <Spinner fullHeight={false} />
        <p className="text-sm text-muted-foreground">
          {error ?? "Finishing sign-in..."}
        </p>
      </div>
    </div>
  );
}
