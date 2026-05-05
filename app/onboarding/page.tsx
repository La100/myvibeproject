"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useOrganization } from "@clerk/nextjs";

import { selectOrganizationUrl } from "@/lib/authRedirects";
import { Spinner } from "@/components/ui/spinner";

export default function OnboardingPage() {
  const router = useRouter();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { organization, isLoaded: isOrganizationLoaded } = useOrganization();

  useEffect(() => {
    if (!isAuthLoaded || !isOrganizationLoaded) {
      return;
    }

    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }

    router.replace(organization?.id ? "/organisation" : selectOrganizationUrl);
  }, [isAuthLoaded, isOrganizationLoaded, isSignedIn, organization?.id, router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="clean-panel flex w-full max-w-sm flex-col items-center gap-3 px-6 py-8 text-center">
        <Spinner fullHeight={false} className="py-0" iconClassName="size-5" />
        <p className="text-sm text-muted-foreground">Opening your workspace...</p>
      </div>
    </div>
  );
}
