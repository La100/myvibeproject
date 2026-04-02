"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuth, useOrganizationList } from "@clerk/nextjs";
import { apiAny } from "@/lib/convexApiAny";
import {
  currencyOptions,
  detectBrowserCurrency,
  isCurrencyCode,
  type CurrencyCode,
} from "@/lib/onboardingPreferences";
import { toast } from "sonner";
import { Bot, Building2, Clock3, Coins, LocateFixed, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { TimezonePicker } from "@/components/ui/timezone-picker";

const detectTimezone = (): string => {
  if (typeof window === "undefined") {
    return "UTC";
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const onboardingStatus = useQuery(apiAny.onboarding.getStatus);
  const completeOnboarding = useMutation(apiAny.onboarding.completeOnboarding);
  const ensureCurrentUserTeamMembership = useMutation(apiAny.teamMembership.ensureCurrentUserTeamMembership);
  const { createOrganization, setActive, isLoaded: organizationListLoaded } = useOrganizationList();
  const isForcedOrganizationSetup = searchParams.get("mode") === "organization";

  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [organizationCurrency, setOrganizationCurrency] = useState<CurrencyCode>("USD");
  const [organizationTimezone, setOrganizationTimezone] = useState("UTC");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!isAuthLoaded) {
      return;
    }

    if (!isSignedIn) {
      router.replace("/sign-in");
    }
  }, [isAuthLoaded, isSignedIn, router]);

  useEffect(() => {
    if (onboardingStatus === undefined || initialized) {
      return;
    }
    if (!isSignedIn) {
      return;
    }
    if (!isForcedOrganizationSetup && onboardingStatus.completed && onboardingStatus.activeOrganization) {
      setInitialized(true);
      router.replace("/dashboard");
      return;
    }

    const activeOrganization = onboardingStatus.activeOrganization;
    const currentTimezone =
      activeOrganization?.timezone ||
      onboardingStatus.profile.preferredTimezone ||
      detectTimezone();
    const currentCurrency =
      (isCurrencyCode(activeOrganization?.currency) && activeOrganization.currency) ||
      (isCurrencyCode(onboardingStatus.profile.preferredCurrency) && onboardingStatus.profile.preferredCurrency) ||
      detectBrowserCurrency({
        countryCode: onboardingStatus.profile.countryCode,
        timezone: currentTimezone,
      });

    setOrganizationCurrency(currentCurrency || "USD");
    setOrganizationTimezone(currentTimezone);
    setInitialized(true);
  }, [initialized, isForcedOrganizationSetup, isSignedIn, onboardingStatus, router]);

  useEffect(() => {
    if (!isSignedIn || !onboardingStatus || onboardingStatus.activeOrganization || organizationName) {
      return;
    }

    const displayName = onboardingStatus.profile.displayName?.trim();
    if (displayName) {
      setOrganizationName(`${displayName}'s Organization`);
      return;
    }

    setOrganizationName("My Organization");
  }, [isSignedIn, onboardingStatus, organizationName]);

  const activeOrganization = onboardingStatus?.activeOrganization ?? null;
  const canUpdateOrganization = Boolean(activeOrganization?.canUpdateTeamSettings);
  const canSubmit = Boolean(activeOrganization) && (!canUpdateOrganization || organizationTimezone.trim().length > 0);
  const detectOrganizationCurrency = () => {
    setOrganizationCurrency(
      detectBrowserCurrency({
        countryCode: onboardingStatus?.profile.countryCode,
        timezone: organizationTimezone,
      }),
    );
  };

  const ensureMembershipWithRetry = async (organizationId: string, orgName?: string) => {
    let lastError: unknown;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await ensureCurrentUserTeamMembership({
          clerkOrgId: organizationId,
          orgName,
        });
        return;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        const isTransientOrgContextError =
          message.includes("Active organization context missing") ||
          message.includes("Selected organization does not match active auth context");

        if (!isTransientOrgContextError || attempt === 4) {
          throw error;
        }

        await delay(250 * (attempt + 1));
      }
    }

    throw lastError ?? new Error("Could not ensure membership");
  };

  const activateOrganization = async (organizationId: string, orgName?: string) => {
    if (!setActive) {
      toast.error("Organization activation is not available yet.");
      return false;
    }

    try {
      await setActive({ organization: organizationId });
      await ensureMembershipWithRetry(organizationId, orgName);
      toast.success("Organization selected.");
      router.refresh();
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Could not activate organization.");
      return false;
    }
  };

  const createAndActivateOrganization = async () => {
    const trimmedName = organizationName.trim();
    if (trimmedName.length < 2) {
      toast.error("Enter at least 2 characters for organization name.");
      return;
    }
    if (!createOrganization) {
      toast.error("Organization creation is not available yet.");
      return;
    }

    setIsCreatingOrganization(true);
    try {
      const createdOrganization = await createOrganization({
        name: trimmedName,
      });
      const activated = await activateOrganization(createdOrganization.id, createdOrganization.name || trimmedName);
      if (!activated) {
        return;
      }
      toast.success("Organization created.");
      router.replace("/onboarding?mode=organization");
    } catch (error) {
      console.error(error);
      toast.error("Could not create organization.");
    } finally {
      setIsCreatingOrganization(false);
    }
  };

  const finishOnboarding = async () => {
    if (!activeOrganization) {
      toast.error("Create your organization first.");
      return;
    }

    setIsSaving(true);
    try {
      const payload: {
        organizationCurrency?: CurrencyCode;
        organizationTimezone?: string;
      } = {};

      if (activeOrganization && canUpdateOrganization) {
        payload.organizationCurrency = organizationCurrency;
        payload.organizationTimezone = organizationTimezone.trim();
      }

      const result = await completeOnboarding({
        ...payload,
      });

      if (result.appliedToTeam) {
        toast.success("Organization onboarding saved. Team settings were updated.");
      } else if (activeOrganization && !canUpdateOrganization) {
        toast.success("Organization onboarding saved. Team settings were not changed because your role is not admin.");
      } else {
        toast.success("Organization onboarding saved.");
      }
      router.replace("/dashboard");
    } catch (error) {
      console.error(error);
      toast.error("Could not save organization onboarding.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthLoaded || !isSignedIn || onboardingStatus === undefined || !initialized) {
    return <LoadingState message="Preparing onboarding..." />;
  }

  if (!isForcedOrganizationSetup && onboardingStatus.completed && activeOrganization) {
    return <LoadingState message="Redirecting to workspace..." />;
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Card className="border-border/50">
          <CardHeader className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-2">
                <Badge variant="secondary" className="w-fit">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {isForcedOrganizationSetup ? "Organization Re-Setup" : "Organization Setup"}
                </Badge>
                <CardTitle className="text-2xl">Set up your organization workspace</CardTitle>
                <CardDescription>
                  {isForcedOrganizationSetup
                    ? "Update team defaults for the currently active organization."
                    : "Configure team defaults for architectural project management."}
                </CardDescription>
              </div>
              <Bot className="size-8 text-primary" />
            </div>

            {activeOrganization ? (
              <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">{activeOrganization.teamName}</span>
                  <Badge variant="outline" className="ml-1">{activeOrganization.role}</Badge>
                </div>
                <p className="text-muted-foreground">
                  {canUpdateOrganization
                    ? "Set default timezone and currency for this organization."
                    : "Onboarding is organization-focused. Only admins can update organization-wide timezone and currency."}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                <div className="mb-1 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">Create your organization</span>
                </div>
                <p className="text-muted-foreground">
                  We are using a custom onboarding flow. Create an organization below to continue.
                </p>
              </div>
            )}
          </CardHeader>

          <CardContent className="flex flex-col gap-6">
            {!activeOrganization && (
              <div className="flex flex-col gap-4 rounded-lg border p-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="organization-name" className="text-sm font-medium">
                    Organization name
                  </Label>
                  <Input
                    id="organization-name"
                    placeholder="e.g. North Studio"
                    value={organizationName}
                    onChange={(event) => setOrganizationName(event.target.value)}
                    disabled={isCreatingOrganization || !organizationListLoaded}
                  />
                </div>
                <Button
                  type="button"
                  onClick={createAndActivateOrganization}
                  disabled={isCreatingOrganization || !organizationListLoaded}
                  className="w-full sm:w-auto"
                >
                  {isCreatingOrganization ? "Creating organization..." : "Create organization"}
                </Button>
              </div>
            )}

            {activeOrganization && canUpdateOrganization && (
              <div className="flex flex-col gap-3">
                <Label htmlFor="currency" className="text-sm font-medium">
                  <Coins className="h-4 w-4 inline mr-2" />
                  Organization currency
                </Label>
                <div className="flex max-w-full gap-2">
                  <Select
                    value={organizationCurrency}
                    onValueChange={(value) => setOrganizationCurrency(value as CurrencyCode)}
                  >
                    <SelectTrigger id="currency" className="w-[360px] max-w-full flex-1">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyOptions.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.code} - {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={detectOrganizationCurrency}
                  >
                    <LocateFixed className="h-4 w-4" />
                    <span className="sr-only">Detect currency</span>
                  </Button>
                </div>
              </div>
            )}

            {activeOrganization && canUpdateOrganization && (
              <div className="flex max-w-md flex-col gap-3">
                <Label className="text-sm font-medium">
                  <Clock3 className="h-4 w-4 inline mr-2" />
                  Organization timezone
                </Label>
                <TimezonePicker
                  value={organizationTimezone}
                  onValueChange={setOrganizationTimezone}
                  className="w-[360px] max-w-full"
                />
              </div>
            )}

            {activeOrganization && !canUpdateOrganization && (
              <p className="text-sm text-muted-foreground">
                Your role cannot change organization settings. You can still complete onboarding now.
              </p>
            )}

            <div className="flex items-center justify-end pt-4">
              <Button type="button" onClick={finishOnboarding} disabled={!canSubmit || isSaving}>
                {isSaving ? "Saving..." : "Finish organization setup"}
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
    <Suspense
      fallback={<LoadingState message="Preparing onboarding..." />}
    >
      <OnboardingContent />
    </Suspense>
  );
}
