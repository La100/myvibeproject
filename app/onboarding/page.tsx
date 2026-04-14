"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuth, useOrganizationList } from "@clerk/nextjs";
import { toast } from "sonner";

import { apiAny } from "@/lib/convexApiAny";
import { detectBrowserCurrency, isCurrencyCode, type CurrencyCode } from "@/lib/onboardingPreferences";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { TimezonePicker } from "@/components/ui/timezone-picker";

const CURRENCY_OPTIONS: Array<{ value: CurrencyCode; label: string }> = [
  { value: "USD", label: "US Dollar ($)" },
  { value: "EUR", label: "Euro (€)" },
  { value: "PLN", label: "Polish Zloty (zł)" },
  { value: "GBP", label: "British Pound (£)" },
  { value: "CAD", label: "Canadian Dollar (C$)" },
  { value: "AUD", label: "Australian Dollar (A$)" },
  { value: "JPY", label: "Japanese Yen (¥)" },
  { value: "CHF", label: "Swiss Franc (CHF)" },
  { value: "SEK", label: "Swedish Krona (SEK)" },
  { value: "NOK", label: "Norwegian Krone (NOK)" },
  { value: "DKK", label: "Danish Krone (DKK)" },
  { value: "CZK", label: "Czech Koruna (CZK)" },
  { value: "HUF", label: "Hungarian Forint (HUF)" },
  { value: "CNY", label: "Chinese Yuan (CNY)" },
  { value: "INR", label: "Indian Rupee (INR)" },
  { value: "BRL", label: "Brazilian Real (BRL)" },
  { value: "MXN", label: "Mexican Peso (MXN)" },
  { value: "KRW", label: "South Korean Won (KRW)" },
  { value: "SGD", label: "Singapore Dollar (SGD)" },
  { value: "HKD", label: "Hong Kong Dollar (HKD)" },
];

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
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>("USD");
  const [selectedTimezone, setSelectedTimezone] = useState("UTC");
  const [hasInitializedPreferences, setHasInitializedPreferences] = useState(false);

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

  useEffect(() => {
    if (hasInitializedPreferences || onboardingStatus === undefined || !activeOrganization) {
      return;
    }

    setSelectedCurrency(completionDefaults.currency);
    setSelectedTimezone(completionDefaults.timezone);
    setHasInitializedPreferences(true);
  }, [
    activeOrganization,
    completionDefaults.currency,
    completionDefaults.timezone,
    hasInitializedPreferences,
    onboardingStatus,
  ]);

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
        payload.organizationCurrency = selectedCurrency;
        payload.organizationTimezone = selectedTimezone;
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
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Card className="rounded-3xl border-border/70 bg-background/95 shadow-sm">
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
                Onboarding
              </p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-[2rem]">
                Set up your workspace defaults
              </h1>
              <p className="text-sm text-muted-foreground">
                We only need a couple of settings before opening your workspace.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-2.5 py-1.5 text-muted-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
                  1
                </span>
                <span>Organization</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                  2
                </span>
                <span>Defaults</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-2.5 py-1.5 text-muted-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
                  3
                </span>
                <span>Launch</span>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Organization
              </p>
              <p className="mt-1 truncate text-base font-medium sm:text-lg">{activeOrganization.teamName}</p>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Defaults for estimates, reports, invoices, and AI date handling.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-3xl border-border/70 bg-background/95 shadow-sm">
          <CardContent className="space-y-6 p-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">How should this workspace behave?</h2>
              <p className="text-sm text-muted-foreground">
                Answer these questions once and we will use them as your starting defaults.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="onboarding-currency">What currency do you use most often?</Label>
              <Select
                value={selectedCurrency}
                onValueChange={(value) => setSelectedCurrency(value as CurrencyCode)}
                disabled={!canUpdateOrganization || isFinishing}
              >
                <SelectTrigger id="onboarding-currency" className="w-full bg-background/50">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((currency) => (
                    <SelectItem key={currency.value} value={currency.value}>
                      <span className="font-medium">{currency.value}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{currency.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>What timezone should plans and due dates use?</Label>
              <TimezonePicker
                value={selectedTimezone}
                onValueChange={setSelectedTimezone}
                className="w-full bg-background/50"
                disabled={!canUpdateOrganization || isFinishing}
              />
            </div>

            {!canUpdateOrganization ? (
              <div className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
                Organization defaults can only be changed by an admin. You can still continue to the workspace.
              </div>
            ) : null}

            <div className="flex justify-end border-t border-border/50 pt-5">
              <Button
                type="button"
                onClick={handleFinish}
                disabled={!activeOrganization || isFinishing}
                className="min-w-[220px]"
              >
                {isFinishing ? "Saving..." : "Launch workspace"}
              </Button>
            </div>
          </CardContent>
        </Card>
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
