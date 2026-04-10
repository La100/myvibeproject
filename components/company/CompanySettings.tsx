"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { toast } from "sonner";
import { motion } from "framer-motion";

import {
  Sparkles,
  BarChart3,
  AlertCircle,
  CreditCard,
  Building2,
  Globe,
  Check,
  Shield,
  Users,
  Coins,
  Clock3,
  HardDrive,
  FolderOpen,
  Upload,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { TimezonePicker } from "@/components/ui/timezone-picker";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AI_PRO_MONTHLY_TOKENS,
  AI_SCALE_MONTHLY_TOKENS,
  GEMINI_FLASH_IMAGE_TYPICAL_CREDITS,
  formatTokens,
} from "@/lib/aiPricing";
import { cn } from "@/lib/utils";

type BillingProfileForm = {
  sellerName: string;
  sellerEmail: string;
  sellerPhone: string;
  sellerTaxId: string;
  sellerAddressLine1: string;
  sellerAddressLine2: string;
  sellerPostalCode: string;
  sellerCity: string;
  sellerCountry: string;
  bankAccountHolder: string;
  bankName: string;
  bankAccountNumber: string;
  bankSwift: string;
  paymentInstructions: string;
  defaultPaymentTermDays: string;
};

const EMPTY_BILLING_PROFILE: BillingProfileForm = {
  sellerName: "",
  sellerEmail: "",
  sellerPhone: "",
  sellerTaxId: "",
  sellerAddressLine1: "",
  sellerAddressLine2: "",
  sellerPostalCode: "",
  sellerCity: "",
  sellerCountry: "",
  bankAccountHolder: "",
  bankName: "",
  bankAccountNumber: "",
  bankSwift: "",
  paymentInstructions: "",
  defaultPaymentTermDays: "14",
};

const BILLING_PLANS = [
  {
    key: "ai",
    name: "AI Pro",
    price: 39,
    monthlyCredits: AI_PRO_MONTHLY_TOKENS,
    description: "Best for teams using the assistant and visualizations every week.",
    limits: ["20 active projects", "2 team members", "50 GB storage"],
  },
  {
    key: "ai_scale",
    name: "AI Scale",
    price: 99,
    monthlyCredits: AI_SCALE_MONTHLY_TOKENS,
    description: "Higher monthly AI volume with stronger workspace limits and better token value.",
    limits: ["75 active projects", "100 team members", "250 GB storage"],
  },
] as const;

type BillingPlanKey = (typeof BILLING_PLANS)[number]["key"];

type CompanySettingsMode = "settings" | "subscription";

export default function CompanySettings({ mode = "settings" }: { mode?: CompanySettingsMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organization, isLoaded } = useOrganization();
  const ensureCurrentUserTeamMembership = useMutation(apiAny.teamMembership.ensureCurrentUserTeamMembership);
  const [repairingTeamState, setRepairingTeamState] = useState(false);
  const attemptedRepairRef = useRef<string | null>(null);

  // Loading actual data from backend
  const teamData = useQuery(
    apiAny.teams.getTeamSettingsByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );

  const teamId = teamData?.teamId;
  const isSubscriptionPage = mode === "subscription";
  const requestedTab = searchParams.get("tab");
  const shouldRedirectToSubscription =
    !isSubscriptionPage && (requestedTab === "billing" || requestedTab === "subscription");

  const aiAccess = useQuery(apiAny.stripe.checkTeamAIAccess, isSubscriptionPage && teamId ? { teamId } : "skip");
  const subscription = useQuery(apiAny.stripe.getTeamSubscription, isSubscriptionPage && teamId ? { teamId } : "skip");
  const usageBreakdown = useQuery(apiAny.ai.usage.getTeamUsageBreakdown, isSubscriptionPage && teamId ? { teamId } : "skip");
  const storageUsage = useQuery(apiAny.files.getTeamStorageUsage, isSubscriptionPage && teamId ? { teamId } : "skip");
  const resourceUsage = useQuery(apiAny.teams.getTeamResourceUsage, isSubscriptionPage && teamId ? { teamId } : "skip");

  const updateTeamSettings = useMutation(apiAny.teams.updateTeamSettings);
  const ensureBillingWindow = useMutation(apiAny.stripe.ensureBillingWindow);
  const createCheckoutSession = useAction(apiAny.stripeActions.createCheckoutSession);
  const createBillingPortalSession = useAction(apiAny.stripeActions.createBillingPortalSession);
  const ensureSubscriptionSynced = useAction(apiAny.stripeActions.ensureSubscriptionSynced);
  const teamPayments = useQuery(apiAny.stripe.getTeamPayments, isSubscriptionPage && teamId ? { teamId } : "skip");

  // Local state for team settings
  const [teamSettings, setTeamSettings] = useState<{
    currency: "USD" | "EUR" | "PLN" | "GBP" | "CAD" | "AUD" | "JPY" | "CHF" | "SEK" | "NOK" | "DKK" | "CZK" | "HUF" | "CNY" | "INR" | "BRL" | "MXN" | "KRW" | "SGD" | "HKD";
    timezone: string;
  }>({
    currency: "PLN",
    timezone: "UTC",
  });
  const [organizationImagePreviewUrl, setOrganizationImagePreviewUrl] = useState("");
  const [organizationImageFile, setOrganizationImageFile] = useState<File | null>(null);
  const [billingProfile, setBillingProfile] = useState<BillingProfileForm>(EMPTY_BILLING_PROFILE);
  const [savingOrganizationProfile, setSavingOrganizationProfile] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [savingBillingProfile, setSavingBillingProfile] = useState(false);
  const [billingAction, setBillingAction] = useState<"portal" | BillingPlanKey | null>(null);
  const billingWindowEnsuredRef = useRef(false);
  const organizationImageInputRef = useRef<HTMLInputElement | null>(null);
  const organizationImageObjectUrlRef = useRef<string | null>(null);
  const organizationHasImage = organization?.hasImage ?? false;
  const resolvedOrganizationImageUrl = organizationHasImage
    ? (teamData?.imageUrl || organization?.imageUrl || "")
    : "";

  useEffect(() => {
    if (shouldRedirectToSubscription) {
      router.replace("/organisation/subscription");
    }
  }, [router, shouldRedirectToSubscription]);

  const repairTeamMembership = useCallback(async () => {
    if (!organization?.id) return;
    setRepairingTeamState(true);
    try {
      await ensureCurrentUserTeamMembership({
        clerkOrgId: organization.id,
        orgName: organization.name,
      });
    } catch (error) {
      console.error("Failed to repair team membership", error);
      throw error;
    } finally {
      setRepairingTeamState(false);
    }
  }, [organization?.id, organization?.name, ensureCurrentUserTeamMembership]);

  useEffect(() => {
    if (!isLoaded || !organization?.id || teamData !== null) {
      return;
    }

    if (attemptedRepairRef.current === organization.id) {
      return;
    }

    attemptedRepairRef.current = organization.id;
    repairTeamMembership().catch(() => {
      // Render fallback UI below if sync cannot repair the state.
    });
  }, [isLoaded, organization?.id, teamData, repairTeamMembership]);

  // Synchronize data from backend
  useEffect(() => {
    if (teamData) {
      setTeamSettings({
        currency: (teamData.currency as "USD" | "EUR" | "PLN" | "GBP" | "CAD" | "AUD" | "JPY" | "CHF" | "SEK" | "NOK" | "DKK" | "CZK" | "HUF" | "CNY" | "INR" | "BRL" | "MXN" | "KRW" | "SGD" | "HKD") || "PLN",
        timezone: teamData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      });
      if (!organizationImageFile) {
        setOrganizationImagePreviewUrl(resolvedOrganizationImageUrl);
      }
      setBillingProfile({
        sellerName: teamData.billingProfile?.sellerName || teamData.name || "",
        sellerEmail: teamData.billingProfile?.sellerEmail || "",
        sellerPhone: teamData.billingProfile?.sellerPhone || "",
        sellerTaxId: teamData.billingProfile?.sellerTaxId || "",
        sellerAddressLine1: teamData.billingProfile?.sellerAddressLine1 || "",
        sellerAddressLine2: teamData.billingProfile?.sellerAddressLine2 || "",
        sellerPostalCode: teamData.billingProfile?.sellerPostalCode || "",
        sellerCity: teamData.billingProfile?.sellerCity || "",
        sellerCountry: teamData.billingProfile?.sellerCountry || "",
        bankAccountHolder: teamData.billingProfile?.bankAccountHolder || "",
        bankName: teamData.billingProfile?.bankName || "",
        bankAccountNumber: teamData.billingProfile?.bankAccountNumber || "",
        bankSwift: teamData.billingProfile?.bankSwift || "",
        paymentInstructions: teamData.billingProfile?.paymentInstructions || "",
        defaultPaymentTermDays: String(teamData.billingProfile?.defaultPaymentTermDays || 14),
      });
    }
  }, [teamData, organizationImageFile, resolvedOrganizationImageUrl]);

  useEffect(() => {
    return () => {
      if (organizationImageObjectUrlRef.current) {
        URL.revokeObjectURL(organizationImageObjectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isSubscriptionPage) return;
    if (subscription && subscription.stripeCustomerId && subscription.subscriptionPlan === "free") {
      ensureSubscriptionSynced({ teamId: subscription.teamId }).catch(console.error);
    }
  }, [isSubscriptionPage, subscription, ensureSubscriptionSynced]);

  useEffect(() => {
    if (!isSubscriptionPage) return;
    if (!subscription || !teamData?.teamId || billingWindowEnsuredRef.current) return;

    const start = subscription.currentPeriodStart;
    const end = subscription.currentPeriodEnd;
    const now = Date.now();
    const invalidWindow = !start || !end || end <= start || end < now;

    if (invalidWindow) {
      billingWindowEnsuredRef.current = true;
      ensureBillingWindow({ teamId: teamData.teamId }).catch(console.error);
    }
  }, [isSubscriptionPage, subscription, teamData?.teamId, ensureBillingWindow]);

  if (shouldRedirectToSubscription) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground animate-pulse">Opening subscription...</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground animate-pulse">
          {isSubscriptionPage ? "Loading subscription..." : "Loading settings..."}
        </p>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="flex w-full max-w-md flex-col gap-4 text-center">
          <h1 className="text-2xl font-semibold">Finish workspace setup</h1>
          <p className="text-sm text-muted-foreground">
            You need an active organization to access {isSubscriptionPage ? "organization subscription" : "organization settings"}.
          </p>
          <Button type="button" onClick={() => router.replace("/onboarding")} className="px-6">
            Go to onboarding
          </Button>
        </div>
      </div>
    );
  }

  if (teamData === undefined || repairingTeamState) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground animate-pulse">
          {isSubscriptionPage ? "Loading subscription..." : "Loading settings..."}
        </p>
      </div>
    );
  }

  if (teamData === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-lg w-full border-border/40">
          <CardHeader>
            <CardTitle>Couldn&apos;t load organization settings</CardTitle>
            <CardDescription>
              The app couldn&apos;t find your team membership for this organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Click retry to re-sync your organization and permissions.
            </p>
            <Button
              onClick={async () => {
                attemptedRepairRef.current = null;
                try {
                  await repairTeamMembership();
                  toast.success("Organization sync completed. Reloading settings...");
                } catch {
                  toast.error("Could not sync organization membership");
                }
              }}
              disabled={repairingTeamState}
            >
              {repairingTeamState ? "Syncing..." : "Retry sync"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSaveTeamSettings = async () => {
    setSavingPreferences(true);
    try {
      await updateTeamSettings({
        teamId: teamData.teamId,
        currency: teamSettings.currency,
        timezone: teamSettings.timezone,
      });
      toast.success("Preferences updated successfully");
    } catch (error) {
      toast.error("Failed to update preferences");
      console.error(error);
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleSelectOrganizationImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      event.target.value = "";
      return;
    }

    const maxSizeInBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      toast.error("Image must be smaller than 5 MB");
      event.target.value = "";
      return;
    }

    if (organizationImageObjectUrlRef.current) {
      URL.revokeObjectURL(organizationImageObjectUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    organizationImageObjectUrlRef.current = objectUrl;
    setOrganizationImagePreviewUrl(objectUrl);
    setOrganizationImageFile(file);
    event.target.value = "";
    void handleSaveOrganizationProfile(file);
  };

  const handleSaveOrganizationProfile = async (fileOverride?: File) => {
    const imageToUpload = fileOverride ?? organizationImageFile;
    if (!imageToUpload) {
      return;
    }

    setSavingOrganizationProfile(true);
    try {
      const updatedOrganization = await organization.setLogo({
        file: imageToUpload,
      });
      const updatedImageUrl = updatedOrganization.imageUrl;

      try {
        await updateTeamSettings({
          teamId: teamData.teamId,
          imageUrl: updatedImageUrl,
        });
      } catch (error) {
        console.error("Failed to sync team image with Clerk logo", error);
      }

      if (organizationImageObjectUrlRef.current) {
        URL.revokeObjectURL(organizationImageObjectUrlRef.current);
        organizationImageObjectUrlRef.current = null;
      }
      setOrganizationImagePreviewUrl(updatedImageUrl);
      setOrganizationImageFile(null);
      toast.success("Organization image updated");
    } catch (error) {
      toast.error("Failed to update organization image");
      console.error(error);
      if (organizationImageObjectUrlRef.current) {
        URL.revokeObjectURL(organizationImageObjectUrlRef.current);
        organizationImageObjectUrlRef.current = null;
      }
      setOrganizationImagePreviewUrl(resolvedOrganizationImageUrl);
      setOrganizationImageFile(null);
    } finally {
      setSavingOrganizationProfile(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!teamData?.teamId) return;

    setBillingAction("portal");
    try {
      const result = await createBillingPortalSession({
        teamId: teamData.teamId,
      });

      if (result.url) {
        window.location.href = result.url;
      } else {
        toast.error("Failed to open billing portal");
      }
    } catch (error) {
      console.error("Error creating billing portal session:", error);
      toast.error("Error opening billing portal");
    } finally {
      setBillingAction(null);
    }
  };

  const handleStartCheckout = async (planKey: BillingPlanKey, priceId?: string) => {
    if (!teamData?.teamId) return;

    if (!priceId) {
      toast.error("Billing plan is not configured yet.");
      return;
    }

    setBillingAction(planKey);
    try {
      const result = await createCheckoutSession({
        teamId: teamData.teamId,
        priceId,
      });

      if (result.url) {
        window.location.href = result.url;
      } else {
        toast.error("Failed to open checkout");
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      toast.error("Error opening checkout");
    } finally {
      setBillingAction(null);
    }
  };

  const handleSaveBillingProfile = async () => {
    setSavingBillingProfile(true);
    try {
      await updateTeamSettings({
        teamId: teamData.teamId,
        billingProfile: {
          ...billingProfile,
          invoicePrefix: "",
          defaultPaymentTermDays: Number.parseInt(billingProfile.defaultPaymentTermDays || "14", 10),
        },
      });
      toast.success("Organization billing profile updated");
    } catch (error) {
      toast.error("Failed to update billing profile");
      console.error(error);
    } finally {
      setSavingBillingProfile(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } }
  };

  const remainingCredits = aiAccess?.remainingTokens ?? 0;
  const totalCredits = aiAccess?.totalTokens ?? remainingCredits;
  const usedCredits = usageBreakdown?.totalTokens ?? Math.max(0, totalCredits - remainingCredits);
  const creditBreakdownItems = [
    { key: "assistant", label: "AI Assistant", icon: Sparkles, color: "text-chart-1", barColor: "bg-chart-1" },
    { key: "visualizations", label: "Visualizations", icon: BarChart3, color: "text-chart-2", barColor: "bg-chart-2" },
    { key: "other", label: "Other", icon: AlertCircle, color: "text-chart-4", barColor: "bg-chart-4" },
  ] as const;
  const visibleCreditBreakdownItems = creditBreakdownItems.filter((item) => (usageBreakdown?.byFeature?.[item.key] || 0) > 0);
  const usagePercent = totalCredits > 0 ? Math.min(100, Math.round((usedCredits / totalCredits) * 100)) : 0;
  const currentPlanKey = subscription?.subscriptionPlan || "free";
  const planStatus = subscription?.subscriptionStatus;
  const canOpenPortal = Boolean(subscription?.stripeCustomerId);
  const subscriptionLabel = planStatus === "trialing" ? "Trial" : subscription?.planDetails?.name || "Free";
  const subscriptionSubtext = planStatus === "trialing"
    ? "Active trial subscription"
    : planStatus === "active"
      ? "Active subscription"
      : "No active subscription";
  const subscriptionStatusLabel = planStatus === "trialing"
    ? "Trial"
    : planStatus === "active"
      ? subscription?.cancelAtPeriodEnd ? "Ending" : "Active"
      : "Free";
  const subscriptionPeriodLabel = subscription?.currentPeriodEnd
    ? `${subscription?.cancelAtPeriodEnd ? "Access until" : "Renews"} ${new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`
    : "Upgrade to unlock higher AI limits and monthly credits.";
  const checkoutPriceIds: Record<BillingPlanKey, string | null> = subscription?.checkoutPlans ?? {
    ai: null,
    ai_scale: null,
  };
  const currentPlanDetails = BILLING_PLANS.find((plan) => plan.key === currentPlanKey);
  const availableBillingPlans = BILLING_PLANS
    .map((plan) => ({
      ...plan,
      priceId: checkoutPriceIds[plan.key] ?? undefined,
    }))
    .filter((plan) => Boolean(plan.priceId));
  const recommendedPlan =
    availableBillingPlans.find((plan) => plan.key === (currentPlanKey === "ai" ? "ai_scale" : "ai")) ||
    availableBillingPlans[0] ||
    null;
  const isBillingActionPending = billingAction !== null;

  return (
    <div className="min-h-screen pb-20">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">

        <div className="flex flex-col gap-2 border-b border-border/40 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {isSubscriptionPage ? <CreditCard className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {isSubscriptionPage ? "Subscription" : "Organization Settings"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isSubscriptionPage
                  ? "Manage your plan, credits, and transaction history."
                  : "Manage your team profile, billing, and preferences."}
              </p>
            </div>
          </div>
        </div>

        {isSubscriptionPage ? (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="flex flex-col gap-10">
            <div className="flex flex-col gap-5 rounded-4xl border border-border/60 bg-gradient-to-br from-muted/50 via-background to-background p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Badge variant="secondary">Subscription options</Badge>
                  <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-semibold tracking-tight">Choose the plan for your team</h2>
                  </div>
                </div>
              </div>

              {availableBillingPlans.length > 0 ? (
                <div className="grid gap-6 xl:grid-cols-2">
                  {availableBillingPlans.map((plan) => {
                    const isCurrentPlan = currentPlanKey === plan.key;
                    const canUpgradeToPlan = !isCurrentPlan && plan.priceId;
                    const isRecommended = recommendedPlan?.key === plan.key && currentPlanKey === "free";
                    const availabilityLabel = isCurrentPlan
                      ? "Current plan"
                      : plan.key === "ai_scale"
                        ? "Best value"
                        : "Available";
                    const availabilityVariant = isCurrentPlan || plan.key === "ai_scale" ? "secondary" : "outline";

                    return (
                      <Card
                        key={plan.key}
                        className={cn(
                          "h-full border-border/50 bg-background/90 shadow-sm",
                          isRecommended && "border-primary/30 bg-primary/[0.03]",
                          isCurrentPlan && "border-primary/25"
                        )}
                      >
                        <CardHeader className="gap-4 border-b border-border/40">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                                {isRecommended ? <Badge>Recommended</Badge> : null}
                              </div>
                              <CardDescription>{plan.description}</CardDescription>
                            </div>
                            <Badge variant={availabilityVariant}>
                              {availabilityLabel}
                            </Badge>
                          </div>
                          <div className="flex items-end gap-2">
                            <span className="text-4xl font-semibold tracking-tight">${plan.price}</span>
                            <span className="pb-1 text-sm text-muted-foreground">per month</span>
                          </div>
                        </CardHeader>
                        <CardContent className="flex h-full flex-col gap-6 pt-6">
                          <div className="rounded-xl border border-border/50 bg-background/80 p-4">
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Monthly AI credits</p>
                            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatTokens(plan.monthlyCredits)}</p>
                          </div>

                          <div className="grid gap-3 text-sm text-muted-foreground">
                            {plan.limits.map((limit) => (
                              <div key={limit} className="flex items-center gap-2 rounded-lg border border-transparent bg-muted/20 px-3 py-2">
                                <Check className="size-4 text-primary" />
                                <span>{limit}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                        <CardFooter className="mt-auto border-t border-border/40 pt-6">
                          {isCurrentPlan && canOpenPortal ? (
                            <Button
                              onClick={handleManageSubscription}
                              disabled={isBillingActionPending}
                              variant="outline"
                              className="w-full"
                            >
                              {billingAction === "portal" ? (
                                <>
                                  <Loader2 data-icon="inline-start" className="animate-spin" />
                                  Opening billing...
                                </>
                              ) : (
                                <>
                                  <CreditCard data-icon="inline-start" />
                                  Manage plan
                                </>
                              )}
                            </Button>
                          ) : canUpgradeToPlan ? (
                            <Button
                              onClick={() => void handleStartCheckout(plan.key, plan.priceId)}
                              disabled={isBillingActionPending}
                              className="w-full"
                            >
                              {billingAction === plan.key ? (
                                <>
                                  <Loader2 data-icon="inline-start" className="animate-spin" />
                                  Opening checkout...
                                </>
                              ) : (
                                <>
                                  <Coins data-icon="inline-start" />
                                  {currentPlanKey === "free" ? `Choose ${plan.name}` : `Upgrade to ${plan.name}`}
                                </>
                              )}
                            </Button>
                          ) : (
                            <Button disabled variant="outline" className="w-full">
                              Current selection
                            </Button>
                          )}
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Alert>
                  <AlertCircle />
                  <AlertTitle>Upgrade checkout is not configured</AlertTitle>
                  <AlertDescription>
                    Add `STRIPE_AI_PRICE_ID` (and optionally `STRIPE_AI_SCALE_PRICE_ID`) to enable subscription upgrades from this page.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <Card className="border-border/50 bg-gradient-to-br from-background via-background to-muted/30 shadow-sm">
                <CardHeader className="gap-4 border-b border-border/40">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base font-medium">
                        <Coins className="h-4 w-4" />
                        Credits Overview
                      </CardTitle>
                    </div>
                    <Badge variant={usagePercent >= 75 ? "secondary" : "outline"}>{usagePercent}% used</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-5 pt-6">
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm text-muted-foreground">Available now</p>
                      <div className="text-4xl font-semibold tracking-tight tabular-nums">
                        {formatTokens(remainingCredits)}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-border/50 bg-background/80 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Used this period</p>
                        <p className="mt-2 text-xl font-semibold tabular-nums">{formatTokens(usedCredits)}</p>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-background/80 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Monthly allowance</p>
                        <p className="mt-2 text-xl font-semibold tabular-nums">{formatTokens(totalCredits)}</p>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-background/80 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Typical run</p>
                        <p className="mt-2 text-xl font-semibold tabular-nums">{formatTokens(GEMINI_FLASH_IMAGE_TYPICAL_CREDITS)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatTokens(usedCredits)} used</span>
                      <span>{formatTokens(totalCredits)} total</span>
                    </div>
                    <Progress value={usagePercent} className="h-2.5 bg-muted/50" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-gradient-to-b from-background to-muted/30 shadow-sm">
                <CardHeader className="gap-4 border-b border-border/40">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Current Plan
                  </CardTitle>
                  <CardAction>
                    <Badge variant={planStatus === "active" || planStatus === "trialing" ? "secondary" : "outline"}>
                      {subscriptionStatusLabel}
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="flex h-full flex-col gap-5 pt-6">
                  <div className="flex flex-col gap-1">
                    <div className="text-3xl font-semibold tracking-tight">{subscriptionLabel}</div>
                    <p className="text-sm text-muted-foreground">{subscriptionSubtext}</p>
                    <p className="text-sm text-muted-foreground">{subscriptionPeriodLabel}</p>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-background/80 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Included monthly credits</p>
                    <p className="mt-2 text-xl font-semibold tabular-nums">
                      {formatTokens(currentPlanDetails?.monthlyCredits ?? totalCredits)}
                    </p>
                  </div>

                  <div className="mt-auto">
                    {currentPlanKey === "free" && recommendedPlan ? (
                      <Button
                        onClick={() => void handleStartCheckout(recommendedPlan.key, recommendedPlan.priceId)}
                        disabled={isBillingActionPending}
                        className="w-full"
                      >
                        {billingAction === recommendedPlan.key ? (
                          <>
                            <Loader2 data-icon="inline-start" className="animate-spin" />
                            Opening checkout...
                          </>
                        ) : (
                          <>
                            <Coins data-icon="inline-start" />
                            Upgrade to {recommendedPlan.name}
                          </>
                        )}
                      </Button>
                    ) : canOpenPortal ? (
                      <Button
                        onClick={handleManageSubscription}
                        disabled={isBillingActionPending}
                        className="w-full"
                      >
                        {billingAction === "portal" ? (
                          <>
                            <Loader2 data-icon="inline-start" className="animate-spin" />
                            Opening billing...
                          </>
                        ) : (
                          <>
                            <CreditCard data-icon="inline-start" />
                            Manage Subscription
                          </>
                        )}
                      </Button>
                    ) : recommendedPlan ? (
                      <Button
                        onClick={() => void handleStartCheckout(recommendedPlan.key, recommendedPlan.priceId)}
                        disabled={isBillingActionPending}
                        className="w-full"
                      >
                        {billingAction === recommendedPlan.key ? (
                          <>
                            <Loader2 data-icon="inline-start" className="animate-spin" />
                            Opening checkout...
                          </>
                        ) : (
                          <>
                            <ArrowRight data-icon="inline-start" />
                            Renew / Upgrade Plan
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button disabled className="w-full">
                        Billing unavailable
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

              <Card className="border-border/40 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-medium">Transaction History</CardTitle>
                </CardHeader>
                <CardContent>
                  {teamPayments && teamPayments.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {teamPayments.map((payment) => {
                      const amount = payment.amount / 100;
                      const currency = payment.currency?.toUpperCase() || "USD";
                      const formatted = new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency,
                      }).format(amount);
                      const createdAt = new Date(payment.created * 1000).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });

                      return (
                        <div
                          key={payment.stripePaymentIntentId}
                          className="flex flex-col gap-1 rounded-lg border border-border/40 px-4 py-3 text-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{formatted}</span>
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">
                              {payment.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{createdAt}</span>
                            <span>{payment.stripePaymentIntentId.slice(-8)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                    <Clock3 className="h-6 w-6" />
                    <p className="text-sm">No transactions yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Separator />

            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-medium">Usage</h2>
                <p className="text-sm text-muted-foreground">
                  Monitor your usage, costs, and resource consumption across all services.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="border-border/40 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-medium">
                      <Coins className="h-4 w-4 text-chart-1" />
                      AI Credits
                    </CardTitle>
                    <CardDescription>
                      {usageBreakdown?.periodStart
                        ? new Date(usageBreakdown.periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "Current period"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div>
                      <div className="text-xl font-semibold tabular-nums">{formatTokens(usedCredits)}</div>
                      <p className="text-xs text-muted-foreground">credits used this billing period</p>
                    </div>
                    <div>
                      <div className="text-xl font-semibold tabular-nums">{formatTokens(remainingCredits)}</div>
                      <p className="text-xs text-muted-foreground">credits remaining</p>
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                      <Progress
                        value={usagePercent}
                        className="h-2 bg-muted/30"
                        indicatorClassName={
                          usagePercent >= 90
                            ? "bg-destructive"
                            : usagePercent >= 75
                              ? "bg-chart-1"
                              : "bg-chart-2"
                        }
                      />
                      <p className="text-xs text-muted-foreground">{usagePercent}% used</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/40 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-medium">
                      <HardDrive className="h-4 w-4 text-chart-2" />
                      Storage
                    </CardTitle>
                    <CardDescription>
                      All projects combined
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div>
                      <div className="text-xl font-semibold tabular-nums">
                        {storageUsage?.usedGB.toFixed(2) ?? "0.00"} GB
                      </div>
                      <p className="text-xs text-muted-foreground">used of {storageUsage?.limitGB ?? 0} GB total</p>
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{storageUsage?.usedGB.toFixed(2) ?? "0.00"} GB used</span>
                        <span>{storageUsage?.limitGB ?? 0} GB total</span>
                      </div>
                      <Progress
                        value={storageUsage?.percentUsed ?? 0}
                        className="h-2 bg-muted/30"
                        indicatorClassName={
                          (storageUsage?.percentUsed ?? 0) >= 90
                            ? "bg-destructive"
                            : (storageUsage?.percentUsed ?? 0) >= 75
                              ? "bg-chart-1"
                              : "bg-chart-2"
                        }
                      />
                      <p className="text-xs text-muted-foreground">{storageUsage?.percentUsed.toFixed(1) ?? "0.0"}% used</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/40 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-medium">
                      <FolderOpen className="h-4 w-4 text-chart-3" />
                      Projects
                    </CardTitle>
                    <CardDescription>
                      Active projects
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div>
                      <div className="text-xl font-semibold tabular-nums">
                        {resourceUsage?.projectsUsed ?? 0} projects
                      </div>
                      <p className="text-xs text-muted-foreground">of {resourceUsage?.projectsLimit ?? 0} total</p>
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{resourceUsage?.projectsUsed ?? 0} used</span>
                        <span>{resourceUsage?.projectsLimit ?? 0} total</span>
                      </div>
                      <Progress
                        value={resourceUsage?.projectsPercentUsed ?? 0}
                        className="h-2 bg-muted/30"
                        indicatorClassName={
                          (resourceUsage?.projectsPercentUsed ?? 0) >= 90
                            ? "bg-destructive"
                            : (resourceUsage?.projectsPercentUsed ?? 0) >= 75
                              ? "bg-chart-1"
                              : "bg-chart-3"
                        }
                      />
                      <p className="text-xs text-muted-foreground">{resourceUsage?.projectsPercentUsed ?? 0}% used</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/40 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-medium">
                      <Users className="h-4 w-4 text-chart-4" />
                      Team Members
                    </CardTitle>
                    <CardDescription>
                      Active members
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div>
                      <div className="text-xl font-semibold tabular-nums">
                        {resourceUsage?.membersUsed ?? 0} members
                      </div>
                      <p className="text-xs text-muted-foreground">of {resourceUsage?.membersLimit ?? 0} total</p>
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{resourceUsage?.membersUsed ?? 0} used</span>
                        <span>{resourceUsage?.membersLimit ?? 0} total</span>
                      </div>
                      <Progress
                        value={resourceUsage?.membersPercentUsed ?? 0}
                        className="h-2 bg-muted/30"
                        indicatorClassName={
                          (resourceUsage?.membersPercentUsed ?? 0) >= 90
                            ? "bg-destructive"
                            : (resourceUsage?.membersPercentUsed ?? 0) >= 75
                              ? "bg-chart-1"
                              : "bg-chart-4"
                        }
                      />
                      <p className="text-xs text-muted-foreground">{resourceUsage?.membersPercentUsed ?? 0}% used</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/40 shadow-sm md:col-span-2 lg:col-span-1">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      Subscription Plan
                      <span className="text-muted-foreground" title="Limits reset with each billing period.">
                        <AlertCircle className="h-3.5 w-3.5" />
                      </span>
                    </CardTitle>
                    <CardDescription>
                      {usageBreakdown?.periodEnd
                        ? `Next billing: ${new Date(usageBreakdown.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                        : "Billing period"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Plan</span>
                      <span className="font-medium">{subscriptionLabel}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Monthly Cost</span>
                      <span className="font-medium">
                        {subscription?.planDetails?.price ? `$${subscription.planDetails.price}` : "Free"}
                      </span>
                    </div>
                    <div className="pt-2">
                      <Button
                        onClick={handleManageSubscription}
                        disabled={isBillingActionPending || !canOpenPortal}
                        variant="outline"
                        className="w-full"
                      >
                        {billingAction === "portal" ? "Opening..." : "Manage Subscription"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/40 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">Credit Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Credits Used</span>
                    <span>
                      {formatTokens(usedCredits)} of {formatTokens(totalCredits)} credits
                    </span>
                  </div>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted/30">
                    {visibleCreditBreakdownItems.map((segment) => {
                      const tokens = usageBreakdown?.byFeature?.[segment.key] || 0;
                      const percent = usedCredits > 0 ? (tokens / usedCredits) * 100 : 0;
                      return (
                        <div
                          key={segment.key}
                          className={segment.barColor}
                          style={{ width: `${percent}%` }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex flex-col gap-3">
                    {visibleCreditBreakdownItems.map((item) => {
                      const tokens = usageBreakdown?.byFeature?.[item.key] || 0;
                      const percent = usedCredits > 0 ? (tokens / usedCredits) * 100 : 0;
                      const Icon = item.icon;
                      return (
                        <div key={item.key} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${item.color}`} />
                            <span>{item.label}</span>
                          </div>
                          <div className="text-muted-foreground">
                            {formatTokens(tokens)} credits ({percent.toFixed(1)}%)
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Typical visualization runs about {formatTokens(GEMINI_FLASH_IMAGE_TYPICAL_CREDITS)} credits,
                    with higher usage for long prompts, edits, and reference images.
                  </p>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="flex flex-col gap-8">
            <div className="grid gap-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-medium">Organization Profile</h2>
                <p className="text-sm text-muted-foreground">
                  Basic organization identity from your current workspace context.
                </p>
              </div>

              <Card id="organization-profile" className="overflow-hidden border-border/40 shadow-sm">
                <CardContent className="flex flex-col gap-4 p-6">
                  <div className="flex items-center gap-4 rounded-lg border border-border/40 bg-muted/20 p-4">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border/40 bg-background">
                      {organizationImagePreviewUrl.trim() ? (
                        <img
                          src={organizationImagePreviewUrl}
                          alt={organization?.name || "Organization"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Image
                          src="/logo.svg"
                          alt="Myvibe Project"
                          fill
                          className="object-contain p-2"
                        />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      <Label htmlFor="organization-image-upload">Organization image</Label>
                      <input
                        ref={organizationImageInputRef}
                        id="organization-image-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleSelectOrganizationImage}
                        className="hidden"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => organizationImageInputRef.current?.click()}
                          disabled={savingOrganizationProfile}
                        >
                          <Upload data-icon="inline-start" />
                          {savingOrganizationProfile ? "Uploading..." : "Add image"}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {savingOrganizationProfile
                          ? "Uploading logo..."
                          : "Upload a logo shown in the app sidebar."}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Organization name</Label>
                    <Input value={organization?.name || "No active organization"} readOnly />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.replace("/onboarding?mode=organization")}
                    >
                      Re-run organization onboarding
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-6 max-w-2xl">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-medium">Regional Settings</h2>
                <p className="text-sm text-muted-foreground">
                  Configure your currency and timezone preferences.
                </p>
              </div>

              <Card className="border-border/40 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <Globe className="h-4 w-4 text-primary" />
                    Default Currency
                  </CardTitle>
                  <CardDescription>
                    Select the currency used for project estimates and financial reports.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={teamSettings.currency}
                      onValueChange={(value) => setTeamSettings({ ...teamSettings, currency: value as typeof teamSettings.currency })}
                    >
                      <SelectTrigger id="currency" className="w-full bg-background/50">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          { value: "USD", label: "US Dollar ($)" },
                          { value: "EUR", label: "Euro (€)" },
                          { value: "PLN", label: "Polish Zloty (zł)" },
                          { value: "GBP", label: "British Pound (£)" },
                          { value: "CAD", label: "Canadian Dollar (C$)" },
                          { value: "AUD", label: "Australian Dollar (A$)" },
                          { value: "JPY", label: "Japanese Yen (¥)" },
                          ].map((curr) => (
                          <SelectItem key={curr.value} value={curr.value}>
                            <span className="font-medium">{curr.value}</span>
                            <span className="ml-2 text-xs text-muted-foreground">({curr.label})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2 max-w-md">
                    <Label>Organization timezone</Label>
                    <TimezonePicker
                      value={teamSettings.timezone}
                      onValueChange={(timezone) => setTeamSettings({ ...teamSettings, timezone })}
                      className="w-[360px] max-w-full"
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between border-t border-border/40 bg-muted/30 px-6 py-4">
                  <p className="text-xs text-muted-foreground">
                    Changes apply to all new projects and AI date handling.
                  </p>
                  <Button
                    onClick={handleSaveTeamSettings}
                    disabled={savingPreferences}
                    className="min-w-[100px]"
                  >
                    {savingPreferences ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    ) : (
                      <>
                        <Check data-icon="inline-start" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>

              <div className="mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Role Permissions</h3>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { role: "Admin", desc: "Full access to all settings, billing, and members." },
                    { role: "Member", desc: "Can create and manage projects and content." },
                    { role: "Customer", desc: "Limited view-only or restricted access." }
                  ].map((item) => (
                    <div key={item.role} className="rounded-lg border bg-card px-4 py-3">
                      <div className="mb-1 text-sm font-semibold text-foreground">{item.role}</div>
                      <div className="text-xs leading-snug text-muted-foreground">{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div id="organization-billing-profile" className="grid gap-6 scroll-mt-24">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-medium">Invoicing Profile</h2>
                <p className="text-sm text-muted-foreground">
                  Seller details shared automatically across project invoices in this organization.
                </p>
              </div>

              <Card className="border-border/40 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    Organization Billing Profile
                  </CardTitle>
                  <CardDescription>
                    These values prefill the seller section in project payments and invoices.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label>Seller name</Label>
                      <Input value={billingProfile.sellerName} onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerName: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Tax ID / VAT ID</Label>
                      <Input value={billingProfile.sellerTaxId} onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerTaxId: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Billing email</Label>
                      <Input type="email" value={billingProfile.sellerEmail} onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerEmail: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Phone</Label>
                      <Input value={billingProfile.sellerPhone} onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerPhone: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-2 md:col-span-2">
                      <Label>Address line 1</Label>
                      <Input value={billingProfile.sellerAddressLine1} onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerAddressLine1: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-2 md:col-span-2">
                      <Label>Address line 2</Label>
                      <Input value={billingProfile.sellerAddressLine2} onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerAddressLine2: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Postal code</Label>
                      <Input value={billingProfile.sellerPostalCode} onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerPostalCode: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>City</Label>
                      <Input value={billingProfile.sellerCity} onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerCity: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-2 md:col-span-2">
                      <Label>Country</Label>
                      <Input value={billingProfile.sellerCountry} onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerCountry: e.target.value }))} />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label>Account holder</Label>
                      <Input value={billingProfile.bankAccountHolder} onChange={(e) => setBillingProfile((prev) => ({ ...prev, bankAccountHolder: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Bank name</Label>
                      <Input value={billingProfile.bankName} onChange={(e) => setBillingProfile((prev) => ({ ...prev, bankName: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Bank account number / IBAN</Label>
                      <Input value={billingProfile.bankAccountNumber} onChange={(e) => setBillingProfile((prev) => ({ ...prev, bankAccountNumber: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>SWIFT</Label>
                      <Input value={billingProfile.bankSwift} onChange={(e) => setBillingProfile((prev) => ({ ...prev, bankSwift: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Default due days</Label>
                      <Input type="number" min="1" value={billingProfile.defaultPaymentTermDays} onChange={(e) => setBillingProfile((prev) => ({ ...prev, defaultPaymentTermDays: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-2 md:col-span-2">
                      <Label>Payment instructions</Label>
                      <Textarea rows={4} value={billingProfile.paymentInstructions} onChange={(e) => setBillingProfile((prev) => ({ ...prev, paymentInstructions: e.target.value }))} />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between border-t border-border/40 bg-muted/30 px-6 py-4">
                  <p className="text-xs text-muted-foreground">
                    Seller name defaults to the organization name until you override it here.
                  </p>
                  <Button
                    onClick={handleSaveBillingProfile}
                    disabled={savingBillingProfile}
                    className="min-w-[140px]"
                  >
                    {savingBillingProfile ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    ) : (
                      <>
                        <Check data-icon="inline-start" />
                        Save Profile
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
