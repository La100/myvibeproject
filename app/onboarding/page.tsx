"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuth, useOrganizationList } from "@clerk/nextjs";
import { toast } from "sonner";

import OnboardingHostedChatKit from "@/components/ai/chatkit/OnboardingHostedChatKit";
import { apiAny } from "@/lib/convexApiAny";
import { detectBrowserCurrency, isCurrencyCode, type CurrencyCode } from "@/lib/onboardingPreferences";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const detectTimezone = (): string => {
  if (typeof window === "undefined") {
    return "UTC";
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
};

function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <Spinner fullHeight={false} className="py-0" iconClassName="size-5" />
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const { createOrganization, setActive, isLoaded: organizationListLoaded } = useOrganizationList();
  const onboardingStatus = useQuery(apiAny.onboarding.getStatus);
  const completeOnboarding = useMutation(apiAny.onboarding.completeOnboarding);
  const ensureCurrentUserTeamMembership = useMutation(apiAny.teamMembership.ensureCurrentUserTeamMembership);
  const isForcedOrganizationSetup = searchParams.get("mode") === "organization";

  const [isFinishing, setIsFinishing] = useState(false);
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false);
  const [organizationName, setOrganizationName] = useState("");

  useEffect(() => {
    if (!isAuthLoaded) {
      return;
    }

    if (!isSignedIn) {
      router.replace("/sign-in");
    }
  }, [isAuthLoaded, isSignedIn, router]);

  const activeOrganization = onboardingStatus?.activeOrganization ?? null;
  const canUpdateOrganization = Boolean(activeOrganization?.canUpdateTeamSettings);

  useEffect(() => {
    if (!onboardingStatus || activeOrganization || organizationName) {
      return;
    }

    const displayName = onboardingStatus.profile.displayName?.trim();
    if (displayName) {
      setOrganizationName(`${displayName}'s Organization`);
      return;
    }
    setOrganizationName("My Organization");
  }, [activeOrganization, onboardingStatus, organizationName]);

  const createAndActivateOrganization = async () => {
    const trimmedName = organizationName.trim();
    if (trimmedName.length < 2) {
      toast.error("Enter at least 2 characters for organization name.");
      return;
    }
    if (!createOrganization || !setActive) {
      toast.error("Organization creation is not available yet.");
      return;
    }

    setIsCreatingOrganization(true);
    try {
      const createdOrganization = await createOrganization({ name: trimmedName });
      await setActive({ organization: createdOrganization.id });

      await ensureCurrentUserTeamMembership({
        clerkOrgId: createdOrganization.id,
        orgName: createdOrganization.name || trimmedName,
      });

      toast.success("Organization created.");
      router.replace("/onboarding?mode=organization");
    } catch (error) {
      console.error(error);
      toast.error("Could not create organization.");
    } finally {
      setIsCreatingOrganization(false);
    }
  };

  const completionDefaults = useMemo(() => {
    if (!onboardingStatus) {
      return { currency: "USD" as CurrencyCode, timezone: "UTC" };
    }

    const timezone =
      activeOrganization?.timezone ||
      onboardingStatus.profile.preferredTimezone ||
      detectTimezone();

    const currency =
      (isCurrencyCode(activeOrganization?.currency) && activeOrganization.currency) ||
      (isCurrencyCode(onboardingStatus.profile.preferredCurrency) && onboardingStatus.profile.preferredCurrency) ||
      detectBrowserCurrency({
        countryCode: onboardingStatus.profile.countryCode,
        timezone,
      });

    return {
      currency: (currency || "USD") as CurrencyCode,
      timezone,
    };
  }, [activeOrganization?.currency, activeOrganization?.timezone, onboardingStatus]);

  const handleFinish = async () => {
    if (!activeOrganization) {
      toast.error("Create or connect organization first.");
      return;
    }

    setIsFinishing(true);
    try {
      const payload: {
        organizationCurrency?: CurrencyCode;
        organizationTimezone?: string;
      } = {};

      if (canUpdateOrganization) {
        payload.organizationCurrency = completionDefaults.currency;
        payload.organizationTimezone = completionDefaults.timezone;
      }

      await completeOnboarding(payload);
      toast.success("Onboarding completed.");
      router.replace("/dashboard");
    } catch (error) {
      console.error(error);
      toast.error("Could not complete onboarding.");
    } finally {
      setIsFinishing(false);
    }
  };

  if (!isAuthLoaded || !isSignedIn || onboardingStatus === undefined) {
    return <LoadingState message="Preparing onboarding..." />;
  }

  if (!isForcedOrganizationSetup && onboardingStatus.completed && activeOrganization) {
    return <LoadingState message="Redirecting to workspace..." />;
  }

  if (!activeOrganization) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/35 px-4 py-4">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pt-10">
          <Card className="rounded-3xl border-border/70 bg-background/95 shadow-sm">
            <CardContent className="space-y-4 p-6">
              <h1 className="text-xl font-semibold">Create your organization to get started</h1>
              <p className="text-sm text-muted-foreground">
                Your guided setup starts right after this step.
              </p>
              <Input
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
                placeholder="Organization name"
                disabled={!organizationListLoaded || isCreatingOrganization}
              />
              <Button
                type="button"
                onClick={createAndActivateOrganization}
                disabled={!organizationListLoaded || isCreatingOrganization || organizationName.trim().length < 2}
                className="w-full"
              >
                {isCreatingOrganization ? "Creating..." : "Create organization"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/35 px-4 py-4">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <Card className="h-[calc(100vh-120px)] min-h-[620px] overflow-hidden rounded-3xl border-border/70 bg-background/95 shadow-sm">
          <CardContent className="h-full p-0">
            <OnboardingHostedChatKit />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="button" onClick={handleFinish} disabled={!activeOrganization || isFinishing}>
            {isFinishing ? "Saving..." : "Launch workspace"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<LoadingState message="Preparing onboarding..." />}>
      <OnboardingContent />
    </Suspense>
  );
}
