"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuth, useOrganizationList } from "@clerk/nextjs";
import { apiAny } from "@/lib/convexApiAny";
import { toast } from "sonner";
import { Bot, Building2, Clock3, Coins, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CurrencyCode =
  | "USD"
  | "EUR"
  | "PLN"
  | "GBP"
  | "CAD"
  | "AUD"
  | "JPY"
  | "CHF"
  | "SEK"
  | "NOK"
  | "DKK"
  | "CZK"
  | "HUF"
  | "CNY"
  | "INR"
  | "BRL"
  | "MXN"
  | "KRW"
  | "SGD"
  | "HKD";

const currencyOptions: Array<{ code: CurrencyCode; label: string }> = [
  { code: "USD", label: "US Dollar ($)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "PLN", label: "Polish Zloty (PLN)" },
  { code: "GBP", label: "British Pound (GBP)" },
  { code: "CAD", label: "Canadian Dollar (CAD)" },
  { code: "AUD", label: "Australian Dollar (AUD)" },
  { code: "JPY", label: "Japanese Yen (JPY)" },
  { code: "CHF", label: "Swiss Franc (CHF)" },
  { code: "SEK", label: "Swedish Krona (SEK)" },
  { code: "NOK", label: "Norwegian Krone (NOK)" },
  { code: "DKK", label: "Danish Krone (DKK)" },
  { code: "CZK", label: "Czech Koruna (CZK)" },
  { code: "HUF", label: "Hungarian Forint (HUF)" },
  { code: "CNY", label: "Chinese Yuan (CNY)" },
  { code: "INR", label: "Indian Rupee (INR)" },
  { code: "BRL", label: "Brazilian Real (BRL)" },
  { code: "MXN", label: "Mexican Peso (MXN)" },
  { code: "KRW", label: "South Korean Won (KRW)" },
  { code: "SGD", label: "Singapore Dollar (SGD)" },
  { code: "HKD", label: "Hong Kong Dollar (HKD)" },
];

const detectTimezone = (): string => {
  if (typeof window === "undefined") {
    return "UTC";
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function OnboardingPage() {
  const router = useRouter();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const onboardingStatus = useQuery(apiAny.onboarding.getStatus);
  const completeOnboarding = useMutation(apiAny.onboarding.completeOnboarding);
  const ensureCurrentUserTeamMembership = useMutation(apiAny.teamMembership.ensureCurrentUserTeamMembership);
  const { createOrganization, setActive, isLoaded: organizationListLoaded } = useOrganizationList();

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
    if (onboardingStatus.completed && onboardingStatus.activeOrganization) {
      setInitialized(true);
      router.replace("/dashboard");
      return;
    }

    const activeOrganization = onboardingStatus.activeOrganization;
    const currentCurrency = activeOrganization?.currency as CurrencyCode | undefined;
    const currentTimezone = activeOrganization?.timezone || detectTimezone();

    setOrganizationCurrency(currentCurrency || "USD");
    setOrganizationTimezone(currentTimezone);
    setInitialized(true);
  }, [initialized, isSignedIn, onboardingStatus, router]);

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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Preparing onboarding...</p>
        </div>
      </div>
    );
  }

  if (onboardingStatus.completed && activeOrganization) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Redirecting to workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="border-border/50">
          <CardHeader className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Badge variant="secondary" className="w-fit">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Organization Setup
                </Badge>
                <CardTitle className="text-2xl">Set up your organization workspace</CardTitle>
                <CardDescription>
                  Configure team defaults for architectural project management.
                </CardDescription>
              </div>
              <Bot className="h-8 w-8 text-primary" />
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
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">Create your organization</span>
                </div>
                <p className="text-muted-foreground">
                  We are using a custom onboarding flow. Create an organization below to continue.
                </p>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            {!activeOrganization && (
              <div className="space-y-4 rounded-lg border p-4">
                <div className="space-y-2">
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
              <div className="space-y-3">
                <Label htmlFor="currency" className="text-sm font-medium">
                  <Coins className="h-4 w-4 inline mr-2" />
                  Organization currency
                </Label>
                <Select
                  value={organizationCurrency}
                  onValueChange={(value) => setOrganizationCurrency(value as CurrencyCode)}
                >
                  <SelectTrigger id="currency">
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
              </div>
            )}

            {activeOrganization && canUpdateOrganization && (
              <div className="space-y-3">
                <Label htmlFor="timezone" className="text-sm font-medium">
                  <Clock3 className="h-4 w-4 inline mr-2" />
                  Organization timezone
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="timezone"
                    placeholder="Europe/Warsaw"
                    value={organizationTimezone}
                    onChange={(event) => setOrganizationTimezone(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOrganizationTimezone(detectTimezone())}
                  >
                    Detect
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use IANA timezone format, for example `America/New_York`.
                </p>
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
