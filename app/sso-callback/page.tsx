"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { Spinner } from "@/components/ui/spinner";

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

    const isChooseOrganizationTaskUrl = (targetUrl: string) => {
      try {
        const parsed = new URL(targetUrl, window.location.origin);
        return (
          parsed.pathname.includes("/sign-in/tasks/choose-organization") ||
          parsed.pathname.includes("/sign-up/tasks/choose-organization")
        );
      } catch {
        return targetUrl.includes("tasks/choose-organization");
      }
    };

    void clerk
      .handleRedirectCallback(
        {
          signInUrl: "/sign-in",
          signUpUrl: "/sign-up",
          signInFallbackRedirectUrl: "/dashboard",
          signUpFallbackRedirectUrl: "/dashboard",
          signInForceRedirectUrl: "/dashboard",
          signUpForceRedirectUrl: "/dashboard",
        },
        async (to) => {
          if (isChooseOrganizationTaskUrl(to)) {
            router.replace("/onboarding");
            return;
          }

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
