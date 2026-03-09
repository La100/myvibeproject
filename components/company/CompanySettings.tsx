"use client";

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
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
  Settings,
  Globe,
  Check,
  Shield,
  Users,
  Coins,
  Clock3,
  HardDrive,
  FolderOpen,
  ImageIcon,
  Upload,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { TimezonePicker } from "@/components/ui/timezone-picker";
import { GEMINI_FLASH_IMAGE_TYPICAL_CREDITS, formatTokens } from "@/lib/aiPricing";

export default function CompanySettings() {
  const router = useRouter();
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

  const aiAccess = useQuery(apiAny.stripe.checkTeamAIAccess, teamId ? { teamId } : "skip");
  const subscription = useQuery(apiAny.stripe.getTeamSubscription, teamId ? { teamId } : "skip");
  const usageBreakdown = useQuery(apiAny.ai.usage.getTeamUsageBreakdown, teamId ? { teamId } : "skip");
  const storageUsage = useQuery(apiAny.files.getTeamStorageUsage, teamId ? { teamId } : "skip");
  const resourceUsage = useQuery(apiAny.teams.getTeamResourceUsage, teamId ? { teamId } : "skip");

  const updateTeamSettings = useMutation(apiAny.teams.updateTeamSettings);
  const ensureBillingWindow = useMutation(apiAny.stripe.ensureBillingWindow);
  const createBillingPortalSession = useAction(apiAny.stripeActions.createBillingPortalSession);
  const ensureSubscriptionSynced = useAction(apiAny.stripeActions.ensureSubscriptionSynced);
  const teamPayments = useQuery(apiAny.stripe.getTeamPayments, teamId ? { teamId } : "skip");

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
  const [savingOrganizationProfile, setSavingOrganizationProfile] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const billingWindowEnsuredRef = useRef(false);
  const organizationImageInputRef = useRef<HTMLInputElement | null>(null);
  const organizationImageObjectUrlRef = useRef<string | null>(null);

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
        setOrganizationImagePreviewUrl(teamData.imageUrl || organization?.imageUrl || "");
      }
    }
  }, [teamData, organization?.imageUrl, organizationImageFile]);

  useEffect(() => {
    return () => {
      if (organizationImageObjectUrlRef.current) {
        URL.revokeObjectURL(organizationImageObjectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (subscription && subscription.stripeCustomerId && subscription.subscriptionPlan === "free") {
      ensureSubscriptionSynced({ teamId: subscription.teamId }).catch(console.error);
    }
  }, [subscription, ensureSubscriptionSynced]);

  useEffect(() => {
    if (!subscription || !teamData?.teamId || billingWindowEnsuredRef.current) return;

    const start = subscription.currentPeriodStart;
    const end = subscription.currentPeriodEnd;
    const now = Date.now();
    const invalidWindow = !start || !end || end <= start || end < now;

    if (invalidWindow) {
      billingWindowEnsuredRef.current = true;
      ensureBillingWindow({ teamId: teamData.teamId }).catch(console.error);
    }
  }, [subscription, teamData?.teamId, ensureBillingWindow]);

  if (!isLoaded) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading settings...</p>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Finish workspace setup</h1>
          <p className="text-sm text-muted-foreground">
            You need an active organization to access organization settings.
          </p>
          <Button type="button" onClick={() => router.replace("/onboarding")} className="rounded-lg px-6">
            Go to onboarding
          </Button>
        </div>
      </div>
    );
  }

  if (teamData === undefined || repairingTeamState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading settings...</p>
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
          <CardContent className="space-y-4">
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
      setOrganizationImagePreviewUrl(teamData.imageUrl || organization?.imageUrl || "");
      setOrganizationImageFile(null);
    } finally {
      setSavingOrganizationProfile(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!teamData?.teamId) return;

    setPortalLoading(true);
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
      setPortalLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } }
  };

  const remainingCredits = aiAccess?.remainingTokens ?? 0;
  const totalCredits = aiAccess?.totalTokens ?? remainingCredits;
  const usedCredits = usageBreakdown?.totalTokens ?? Math.max(0, totalCredits - remainingCredits);
  const usagePercent = totalCredits > 0 ? Math.min(100, Math.round((usedCredits / totalCredits) * 100)) : 0;
  const planStatus = subscription?.subscriptionStatus;
  const subscriptionLabel = planStatus === "trialing" ? "Trial" : subscription?.planDetails?.name || "Free";
  const subscriptionSubtext = planStatus === "trialing"
    ? "Active trial subscription"
    : planStatus === "active"
      ? "Active subscription"
      : "No active subscription";

  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">

        {/* Header */}
        <div className="flex flex-col gap-2 border-b border-border/40 pb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Organization Settings</h1>
              <p className="text-sm text-muted-foreground">Manage your team profile, billing, and preferences.</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="w-full justify-start h-auto p-1 bg-muted/30 rounded-lg border border-border/40 mb-8 overflow-x-auto flex-nowrap">
            <TabsTrigger
              value="settings"
              className="flex-1 min-w-[120px] py-2.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all rounded-md flex items-center gap-2 justify-center"
            >
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger
              value="billing"
              className="flex-1 min-w-[120px] py-2.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all rounded-md flex items-center gap-2 justify-center"
            >
              <CreditCard className="h-4 w-4" />
              Billing & AI
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
              <div className="grid gap-6">
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-medium">Organization Profile</h2>
                  <p className="text-sm text-muted-foreground">
                    Basic organization identity from your current workspace context.
                  </p>
                </div>

                <Card className="border-border/40 shadow-sm overflow-hidden">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center gap-4 rounded-lg border border-border/40 bg-muted/20 p-4">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border/40 bg-background">
                        {organizationImagePreviewUrl.trim() ? (
                          <img
                            src={organizationImagePreviewUrl}
                            alt={organization?.name || "Organization"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-primary">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
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
                            <Upload className="h-4 w-4 mr-2" />
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
                      <Button type="button" variant="outline" onClick={() => router.replace("/onboarding")}>
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
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" />
                      Default Currency
                    </CardTitle>
                    <CardDescription>
                      Select the currency used for project estimates and financial reports.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
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
                          ].map(curr => (
                            <SelectItem key={curr.value} value={curr.value}>
                              <span className="font-medium">{curr.value}</span>
                              <span className="text-muted-foreground ml-2 text-xs">({curr.label})</span>
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
                  <CardFooter className="bg-muted/30 border-t border-border/40 px-6 py-4 flex justify-between items-center">
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
                          <Check className="h-4 w-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>

                {/* Role Information Block */}
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
            </motion.div>
          </TabsContent>

          {/* Billing & AI Tab */}
          <TabsContent value="billing">
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
              <div className="space-y-6">
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-medium">Credits & Billing</h2>
                  <p className="text-sm text-muted-foreground">
                    Manage your credits and view transaction history.
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="border-border/40 shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-base font-medium flex items-center gap-2">
                        <Coins className="h-4 w-4" />
                        Available Credits
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="text-4xl font-semibold tracking-tight tabular-nums">
                        {remainingCredits.toLocaleString()} credits
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {aiAccess?.hasAccess ? "Active balance" : "No active credits"}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-border/40 shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-base font-medium flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Subscription
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-0">
                      <div className="space-y-1">
                        <div className="text-2xl font-semibold tracking-tight">{subscriptionLabel}</div>
                        <p className="text-sm text-muted-foreground">{subscriptionSubtext}</p>
                      </div>
                      <Button
                        onClick={handleManageSubscription}
                        disabled={portalLoading}
                        className="w-full"
                      >
                        {portalLoading ? "Opening..." : "Manage Subscription"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-border/40 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-medium">Transaction History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {teamPayments && teamPayments.length > 0 ? (
                      <div className="space-y-4">
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
              </div>

              <Separator />

              <div className="space-y-6">
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-medium">Usage</h2>
                  <p className="text-sm text-muted-foreground">
                    Monitor your usage, costs, and resource consumption across all services.
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <Card className="border-border/40 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-medium flex items-center gap-2">
                        <Coins className="h-4 w-4 text-blue-500" />
                        AI Credits
                      </CardTitle>
                      <CardDescription>
                        {usageBreakdown?.periodStart
                          ? new Date(usageBreakdown.periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "Current period"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="text-xl font-semibold tabular-nums">{formatTokens(usedCredits)}</div>
                        <p className="text-xs text-muted-foreground">credits used this billing period</p>
                      </div>
                      <div>
                        <div className="text-xl font-semibold tabular-nums">{formatTokens(remainingCredits)}</div>
                        <p className="text-xs text-muted-foreground">credits remaining</p>
                      </div>
                      <div className="space-y-2 pt-2">
                        <Progress
                          value={usagePercent}
                          className="h-2 bg-muted/30"
                          indicatorClassName={
                            usagePercent >= 90
                              ? "bg-red-500"
                              : usagePercent >= 75
                                ? "bg-orange-500"
                                : "bg-blue-500"
                          }
                        />
                        <p className="text-xs text-muted-foreground">{usagePercent}% used</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/40 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-medium flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-emerald-500" />
                        Storage
                      </CardTitle>
                      <CardDescription>
                        All projects combined
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="text-xl font-semibold tabular-nums">
                          {storageUsage?.usedGB.toFixed(2) ?? "0.00"} GB
                        </div>
                        <p className="text-xs text-muted-foreground">used of {storageUsage?.limitGB ?? 0} GB total</p>
                      </div>
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{storageUsage?.usedGB.toFixed(2) ?? "0.00"} GB used</span>
                          <span>{storageUsage?.limitGB ?? 0} GB total</span>
                        </div>
                        <Progress
                          value={storageUsage?.percentUsed ?? 0}
                          className="h-2 bg-muted/30"
                          indicatorClassName={
                            (storageUsage?.percentUsed ?? 0) >= 90
                              ? "bg-red-500"
                              : (storageUsage?.percentUsed ?? 0) >= 75
                                ? "bg-orange-500"
                                : "bg-emerald-500"
                          }
                        />
                        <p className="text-xs text-muted-foreground">{storageUsage?.percentUsed.toFixed(1) ?? "0.0"}% used</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/40 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-medium flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-purple-500" />
                        Projects
                      </CardTitle>
                      <CardDescription>
                        Active projects
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="text-xl font-semibold tabular-nums">
                          {resourceUsage?.projectsUsed ?? 0} projects
                        </div>
                        <p className="text-xs text-muted-foreground">of {resourceUsage?.projectsLimit ?? 0} total</p>
                      </div>
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{resourceUsage?.projectsUsed ?? 0} used</span>
                          <span>{resourceUsage?.projectsLimit ?? 0} total</span>
                        </div>
                        <Progress
                          value={resourceUsage?.projectsPercentUsed ?? 0}
                          className="h-2 bg-muted/30"
                          indicatorClassName={
                            (resourceUsage?.projectsPercentUsed ?? 0) >= 90
                              ? "bg-red-500"
                              : (resourceUsage?.projectsPercentUsed ?? 0) >= 75
                                ? "bg-orange-500"
                                : "bg-purple-500"
                          }
                        />
                        <p className="text-xs text-muted-foreground">{resourceUsage?.projectsPercentUsed ?? 0}% used</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/40 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-medium flex items-center gap-2">
                        <Users className="h-4 w-4 text-orange-500" />
                        Team Members
                      </CardTitle>
                      <CardDescription>
                        Active members
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="text-xl font-semibold tabular-nums">
                          {resourceUsage?.membersUsed ?? 0} members
                        </div>
                        <p className="text-xs text-muted-foreground">of {resourceUsage?.membersLimit ?? 0} total</p>
                      </div>
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{resourceUsage?.membersUsed ?? 0} used</span>
                          <span>{resourceUsage?.membersLimit ?? 0} total</span>
                        </div>
                        <Progress
                          value={resourceUsage?.membersPercentUsed ?? 0}
                          className="h-2 bg-muted/30"
                          indicatorClassName={
                            (resourceUsage?.membersPercentUsed ?? 0) >= 90
                              ? "bg-red-500"
                              : (resourceUsage?.membersPercentUsed ?? 0) >= 75
                                ? "bg-orange-500"
                                : "bg-orange-500"
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
                    <CardContent className="space-y-4">
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
                          disabled={portalLoading}
                          variant="outline"
                          className="w-full"
                        >
                          {portalLoading ? "Opening..." : "Manage Subscription"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-border/40 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-medium">Credit Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Credits Used</span>
                      <span>
                        {formatTokens(usedCredits)} of {formatTokens(totalCredits)} credits
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30 flex">
                      {[
                        { key: "assistant", color: "bg-blue-500" },
                        { key: "visualizations", color: "bg-emerald-500" },
                        { key: "other", color: "bg-amber-500" },
                      ].map((segment) => {
                        const tokens = usageBreakdown?.byFeature?.[segment.key] || 0;
                        const percent = usedCredits > 0 ? (tokens / usedCredits) * 100 : 0;
                        if (percent <= 0) return null;
                        return (
                          <div
                            key={segment.key}
                            className={segment.color}
                            style={{ width: `${percent}%` }}
                          />
                        );
                      })}
                    </div>
                    <div className="space-y-3">
                      {[
                        { key: "assistant", label: "AI Assistant", icon: Sparkles, color: "text-blue-500" },
                        { key: "visualizations", label: "Visualizations", icon: BarChart3, color: "text-emerald-500" },
                        { key: "other", label: "Other", icon: AlertCircle, color: "text-amber-500" },
                      ].map((item) => {
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
