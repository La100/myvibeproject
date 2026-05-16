"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ChangeEvent,
} from "react";
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
  Globe,
  Check,
  Users,
  Coins,
  Clock3,
  HardDrive,
  FolderOpen,
  ArrowRight,
  Loader2,
  BellRing,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  CardAction,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TimezonePicker } from "@/components/ui/timezone-picker";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AppLoadingState } from "@/components/ui/loading-state";
import {
  GPT_IMAGE_TYPICAL_CREDITS,
  formatTokens,
} from "@/lib/aiPricing";
import {
  BILLING_PLANS,
  type BillingCurrency,
  type BillingPlanKey,
} from "@/lib/billingPlans";
import { DEFAULT_ORGANIZATION_TAX_SETTINGS } from "@/lib/organizationTax";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import {
  DEFAULT_TEAM_MEMBER_NOTIFICATION_SETTINGS,
  type TeamMemberNotificationSettings,
} from "@/lib/teamMemberNotificationSettings";
import { cn } from "@/lib/utils";
import { trackSubscriptionConversion } from "@/lib/marketingEvents";
import { OrganizationImagePicker } from "@/components/company/OrganizationImagePicker";
import { BillingActionErrorDialog } from "@/components/billing/BillingActionErrorDialog";
import { BillingPlanCard } from "@/components/billing/BillingPlanCard";
import { useI18n } from "@/lib/i18n";

type SubscriptionInvoice = {
  stripeInvoiceId: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  status: string;
  amountDue: number;
  amountPaid: number;
  created: number;
  currency?: string;
};

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

const COMPANY_SETTINGS_SECTIONS = [
  {
    value: "general",
    labelKey: "general",
    scope: "workspace",
  },
  {
    value: "billing",
    labelKey: "invoices",
    scope: "workspace",
  },
  {
    value: "notifications",
    labelKey: "myNotifications",
    scope: "personal",
  },
] as const;

type CompanySettingsSection =
  (typeof COMPANY_SETTINGS_SECTIONS)[number]["value"];

type CompanySettingsMode = "settings" | "subscription";

export default function CompanySettings({
  mode = "settings",
}: {
  mode?: CompanySettingsMode;
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organization, isLoaded } = useOrganization();
  const ensureCurrentUserTeamMembership = useMutation(
    apiAny.teamMembership.ensureCurrentUserTeamMembership,
  );
  const [repairingTeamState, setRepairingTeamState] = useState(false);

  // Loading actual data from backend
  const teamData = useQuery(
    apiAny.teams.getTeamSettingsByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip",
  );

  const teamId = teamData?.teamId;
  const isSubscriptionPage = mode === "subscription";
  const requestedTab = searchParams.get("tab");
  const checkoutState = searchParams.get("checkout");
  const shouldRedirectToSubscription =
    !isSubscriptionPage &&
    (requestedTab === "billing" || requestedTab === "subscription");
  const requestedSettingsSection =
    requestedTab as CompanySettingsSection | null;
  const [activeSettingsSection, setActiveSettingsSection] =
    useState<CompanySettingsSection>("general");

  const aiAccess = useQuery(
    apiAny.stripe.checkTeamAIAccess,
    isSubscriptionPage && teamId ? { teamId } : "skip",
  );
  const subscription = useQuery(
    apiAny.stripe.getTeamSubscription,
    isSubscriptionPage && teamId ? { teamId } : "skip",
  );
  const usageBreakdown = useQuery(
    apiAny.ai.usage.getTeamUsageBreakdown,
    isSubscriptionPage && teamId ? { teamId } : "skip",
  );
  const storageUsage = useQuery(
    apiAny.files.getTeamStorageUsage,
    isSubscriptionPage && teamId ? { teamId } : "skip",
  );
  const resourceUsage = useQuery(
    apiAny.teams.getTeamResourceUsage,
    isSubscriptionPage && teamId ? { teamId } : "skip",
  );

  const updateTeamSettings = useMutation(apiAny.teams.updateTeamSettings);
  const updateMyNotificationSettings = useMutation(
    apiAny.teams.updateMyNotificationSettings,
  );
  const ensureBillingWindow = useMutation(apiAny.stripe.ensureBillingWindow);
  const createCheckoutSession = useAction(
    apiAny.stripeActions.createCheckoutSession,
  );
  const createBillingPortalSession = useAction(
    apiAny.stripeActions.createBillingPortalSession,
  );
  const ensureSubscriptionSynced = useAction(
    apiAny.stripeActions.ensureSubscriptionSynced,
  );
  const listTeamInvoicesFromStripe = useAction(
    apiAny.stripeActions.listTeamInvoicesFromStripe,
  );
  const teamInvoices = useQuery(
    apiAny.stripe.getTeamInvoices,
    isSubscriptionPage && teamId ? { teamId } : "skip",
  ) as SubscriptionInvoice[] | undefined;
  const [stripeInvoices, setStripeInvoices] = useState<
    SubscriptionInvoice[] | null
  >(null);
  const [stripeInvoicesLoading, setStripeInvoicesLoading] = useState(false);
  const displayedInvoices =
    stripeInvoices && stripeInvoices.length > 0 ? stripeInvoices : teamInvoices;

  // Local state for team settings
  const [teamSettings, setTeamSettings] = useState<{
    currency:
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
    timezone: string;
    taxEnabled: boolean;
    taxRate: string;
    taxLabel: string;
  }>({
    currency: "PLN",
    timezone: "UTC",
    taxEnabled: DEFAULT_ORGANIZATION_TAX_SETTINGS.taxEnabled,
    taxRate: String(DEFAULT_ORGANIZATION_TAX_SETTINGS.taxRate),
    taxLabel: DEFAULT_ORGANIZATION_TAX_SETTINGS.taxLabel,
  });
  const [organizationImagePreviewUrl, setOrganizationImagePreviewUrl] =
    useState("");
  const [organizationImageFile, setOrganizationImageFile] =
    useState<File | null>(null);
  const [organizationNameDraft, setOrganizationNameDraft] = useState("");
  const [billingProfile, setBillingProfile] = useState<BillingProfileForm>(
    EMPTY_BILLING_PROFILE,
  );
  const [notificationSettings, setNotificationSettings] =
    useState<TeamMemberNotificationSettings>(
      DEFAULT_TEAM_MEMBER_NOTIFICATION_SETTINGS,
    );
  const [savingOrganizationProfile, setSavingOrganizationProfile] =
    useState(false);
  const [savingOrganizationName, setSavingOrganizationName] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingBillingProfile, setSavingBillingProfile] = useState(false);
  const [billingAction, setBillingAction] = useState<
    "portal" | BillingPlanKey | null
  >(null);
  const [billingActionError, setBillingActionError] = useState<string | null>(
    null,
  );
  const [syncingSubscription, setSyncingSubscription] = useState(false);
  const billingWindowEnsuredRef = useRef(false);
  const subscriptionAutoSyncAttemptedRef = useRef<string | null>(null);
  const checkoutSyncAttemptedRef = useRef<string | null>(null);
  const organizationImageInputRef = useRef<HTMLInputElement | null>(null);
  const organizationImageObjectUrlRef = useRef<string | null>(null);
  const organizationHasImage = organization?.hasImage ?? false;
  const resolvedOrganizationImageUrl = organizationHasImage
    ? teamData?.imageUrl || organization?.imageUrl || ""
    : "";
  const organizationImageReady =
    teamData?.hasCustomOrganizationImage === true ||
    Boolean(resolvedOrganizationImageUrl.trim()) ||
    Boolean(organization?.imageUrl?.trim());
  const normalizedOrganizationName =
    organization?.name?.trim() || teamData?.name?.trim() || "";
  const organizationNameTrimmed = organizationNameDraft.trim();
  const organizationNameChanged =
    organizationNameTrimmed !== normalizedOrganizationName;
  const canSaveOrganizationName =
    Boolean(organization?.id && teamData?.teamId) &&
    organizationNameTrimmed.length >= 2 &&
    organizationNameChanged &&
    !savingOrganizationName;

  useEffect(() => {
    if (shouldRedirectToSubscription) {
      router.replace("/organisation/subscription");
    }
  }, [router, shouldRedirectToSubscription]);

  useEffect(() => {
    if (!requestedSettingsSection) {
      return;
    }

    const isKnownSection = COMPANY_SETTINGS_SECTIONS.some(
      (section) => section.value === requestedSettingsSection,
    );

    if (isKnownSection) {
      setActiveSettingsSection(requestedSettingsSection);
    }
  }, [requestedSettingsSection]);

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

  const syncSubscriptionFromStripe = useCallback(
    async ({
      showResult = false,
      trackConversion = false,
    }: { showResult?: boolean; trackConversion?: boolean } = {}) => {
      if (!teamData?.teamId) return;

      setSyncingSubscription(true);
      try {
        const result = await ensureSubscriptionSynced({
          teamId: teamData.teamId,
        });

        if (result.synced) {
          if (trackConversion) {
            trackSubscriptionConversion({
              teamId: teamData.teamId,
              planKey: result.plan,
              subscriptionId: result.subscriptionId,
              priceId: result.priceId,
            });
          }
          toast.success(t("companySettings", "subscriptionSynced"));
          router.refresh();
        } else if (showResult) {
          toast.message(t("companySettings", "noActiveStripeSubscription"), {
            description: t("companySettings", "syncAgainDescription"),
          });
        }
      } catch (error) {
        console.error("Failed to sync subscription from Stripe", error);
        toast.error(t("companySettings", "couldNotSyncSubscription"), {
          description: toUserFacingErrorMessage(error),
        });
      } finally {
        setSyncingSubscription(false);
      }
    },
    [ensureSubscriptionSynced, router, t, teamData?.teamId],
  );

  // Synchronize data from backend
  useEffect(() => {
    if (teamData) {
      setTeamSettings({
        currency:
          (teamData.currency as
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
            | "HKD") || "PLN",
        timezone:
          teamData.timezone ||
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          "UTC",
        taxEnabled:
          teamData.organizationTaxSettings?.taxEnabled ??
          DEFAULT_ORGANIZATION_TAX_SETTINGS.taxEnabled,
        taxRate: String(
          teamData.organizationTaxSettings?.taxRate ??
            DEFAULT_ORGANIZATION_TAX_SETTINGS.taxRate,
        ),
        taxLabel:
          teamData.organizationTaxSettings?.taxLabel ??
          DEFAULT_ORGANIZATION_TAX_SETTINGS.taxLabel,
      });
      if (!organizationImageFile) {
        setOrganizationImagePreviewUrl(resolvedOrganizationImageUrl);
      }
      setOrganizationNameDraft(organization?.name || teamData.name || "");
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
        defaultPaymentTermDays: String(
          teamData.billingProfile?.defaultPaymentTermDays || 14,
        ),
      });
      setNotificationSettings(
        teamData.notificationSettings ??
          DEFAULT_TEAM_MEMBER_NOTIFICATION_SETTINGS,
      );
    }
  }, [
    organization?.name,
    teamData,
    organizationImageFile,
    resolvedOrganizationImageUrl,
  ]);

  useEffect(() => {
    return () => {
      if (organizationImageObjectUrlRef.current) {
        URL.revokeObjectURL(organizationImageObjectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isSubscriptionPage) return;
    if (!subscription || subscription.subscriptionPlan !== "free") return;
    if (subscriptionAutoSyncAttemptedRef.current === subscription.teamId)
      return;

    subscriptionAutoSyncAttemptedRef.current = subscription.teamId;
    void syncSubscriptionFromStripe();
  }, [isSubscriptionPage, subscription, syncSubscriptionFromStripe]);

  useEffect(() => {
    if (
      !isSubscriptionPage ||
      checkoutState !== "success" ||
      !teamData?.teamId
    ) {
      return;
    }

    if (checkoutSyncAttemptedRef.current === teamData.teamId) {
      return;
    }

    checkoutSyncAttemptedRef.current = teamData.teamId;
    void syncSubscriptionFromStripe({
      showResult: true,
      trackConversion: true,
    });
  }, [
    checkoutState,
    isSubscriptionPage,
    syncSubscriptionFromStripe,
    teamData?.teamId,
  ]);

  useEffect(() => {
    if (!isSubscriptionPage) return;
    if (!subscription || !teamData?.teamId || billingWindowEnsuredRef.current)
      return;

    const start = subscription.currentPeriodStart;
    const end = subscription.currentPeriodEnd;
    const now = Date.now();
    const invalidWindow = !start || !end || end <= start || end < now;

    if (invalidWindow) {
      billingWindowEnsuredRef.current = true;
      ensureBillingWindow({ teamId: teamData.teamId }).catch(console.error);
    }
  }, [isSubscriptionPage, subscription, teamData?.teamId, ensureBillingWindow]);

  useEffect(() => {
    if (!isSubscriptionPage || !teamId || !subscription?.stripeCustomerId) {
      setStripeInvoices(null);
      return;
    }

    let cancelled = false;
    setStripeInvoicesLoading(true);

    listTeamInvoicesFromStripe({ teamId })
      .then((invoices) => {
        if (!cancelled) {
          setStripeInvoices(invoices as SubscriptionInvoice[]);
        }
      })
      .catch((error) => {
        console.error("Failed to load Stripe invoices", error);
        if (!cancelled) {
          setStripeInvoices(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStripeInvoicesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    isSubscriptionPage,
    listTeamInvoicesFromStripe,
    subscription?.stripeCustomerId,
    teamId,
  ]);

  if (shouldRedirectToSubscription) {
    return (
      <AppLoadingState
        variant="section"
        title={t("companySettings", "openingSubscription")}
        description={t("companySettings", "preparingBillingAccess")}
      />
    );
  }

  if (!isLoaded) {
    return (
      <AppLoadingState
        variant="section"
        title={
          isSubscriptionPage
            ? t("companySettings", "loadingSubscription")
            : t("companySettings", "loadingSettings")
        }
        description={t("companySettings", "loadingOrganizationData")}
      />
    );
  }

  if (!organization) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="flex w-full max-w-md flex-col gap-4 text-center">
          <h1 className="text-2xl font-semibold">
            {t("companySettings", "selectWorkspace")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("companySettings", "needActiveOrganization")}{" "}
            {isSubscriptionPage
              ? t("companySettings", "organizationSubscription")
              : t("companySettings", "organizationSettings")}
            .
          </p>
          <Button
            type="button"
            onClick={() => router.replace("/select-organization")}
            className="px-6"
          >
            {t("companySettings", "selectOrganization")}
          </Button>
        </div>
      </div>
    );
  }

  if (teamData === undefined || repairingTeamState) {
    return (
      <AppLoadingState
        variant="section"
        title={
          isSubscriptionPage
            ? t("companySettings", "loadingSubscription")
            : t("companySettings", "loadingSettings")
        }
        description={
          repairingTeamState
            ? t("companySettings", "syncingOrganizationMembership")
            : t("companySettings", "loadingTeamSettings")
        }
      />
    );
  }

  if (teamData === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-lg w-full border-border/40 bg-card">
          <CardHeader>
            <CardTitle>{t("companySettings", "couldNotLoadSettings")}</CardTitle>
            <CardDescription>
              {t("companySettings", "couldNotFindMembership")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {t("companySettings", "retrySyncDescription")}
            </p>
            <Button
              onClick={async () => {
                try {
                  await repairTeamMembership();
                  toast.success(
                    t("companySettings", "organizationSyncCompleted"),
                  );
                } catch {
                  toast.error(t("companySettings", "couldNotSyncMembership"));
                }
              }}
              disabled={repairingTeamState}
            >
              {repairingTeamState
                ? t("companySettings", "syncing")
                : t("companySettings", "retrySync")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSubscriptionDataLoading =
    isSubscriptionPage &&
    (aiAccess === undefined ||
      subscription === undefined ||
      usageBreakdown === undefined ||
      storageUsage === undefined ||
      resourceUsage === undefined ||
      teamInvoices === undefined);

  if (isSubscriptionDataLoading) {
    return (
      <AppLoadingState
        variant="section"
        title={t("companySettings", "loadingSubscription")}
        description={t("companySettings", "loadingUsageInvoicesLimits")}
      />
    );
  }

  const handleSaveTeamSettings = async () => {
    setSavingPreferences(true);
    try {
      const normalizedTaxRate = Math.min(
        Math.max(Number.parseFloat(teamSettings.taxRate || "0") || 0, 0),
        100,
      );

      await updateTeamSettings({
        teamId: teamData.teamId,
        currency: teamSettings.currency,
        timezone: teamSettings.timezone,
        organizationTaxSettings: {
          taxEnabled: teamSettings.taxEnabled,
          taxRate: normalizedTaxRate,
          taxLabel:
            teamSettings.taxLabel.trim() ||
            DEFAULT_ORGANIZATION_TAX_SETTINGS.taxLabel,
        },
      });
      toast.success(t("companySettings", "preferencesUpdated"));
    } catch (error) {
      toast.error(t("companySettings", "failedToUpdatePreferences"), {
        description: toUserFacingErrorMessage(error),
      });
      console.error(error);
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleSelectOrganizationImage = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t("companySettings", "chooseImageFile"));
      event.target.value = "";
      return;
    }

    const maxSizeInBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      toast.error(t("companySettings", "imageTooLarge"));
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

  const handleSaveNotificationSettings = async () => {
    if (!teamData?.teamId) {
      return;
    }

    setSavingNotifications(true);
    try {
      await updateMyNotificationSettings({
        teamId: teamData.teamId,
        notificationSettings,
      });
      toast.success(t("companySettings", "notificationPreferencesUpdated"));
    } catch (error) {
      toast.error(t("companySettings", "failedToUpdateNotificationPreferences"), {
        description: toUserFacingErrorMessage(error),
      });
      console.error(error);
    } finally {
      setSavingNotifications(false);
    }
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
          markCustomImageUploaded: true,
        });
      } catch (error) {
        console.error("Failed to sync team image with Clerk logo", error);
        throw error;
      }

      if (organizationImageObjectUrlRef.current) {
        URL.revokeObjectURL(organizationImageObjectUrlRef.current);
        organizationImageObjectUrlRef.current = null;
      }
      setOrganizationImagePreviewUrl(updatedImageUrl);
      setOrganizationImageFile(null);
      toast.success(t("companySettings", "organizationImageUpdated"));
    } catch (error) {
      toast.error(t("companySettings", "failedToUpdateOrganizationImage"), {
        description: toUserFacingErrorMessage(error),
      });
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

  const handleSaveOrganizationName = async () => {
    if (!organization?.id || !teamData?.teamId) {
      return;
    }

    const trimmedName = organizationNameDraft.trim();
    if (!trimmedName) {
      toast.error(t("companySettings", "organizationNameEmpty"));
      setOrganizationNameDraft(organization.name || teamData.name || "");
      return;
    }

    if (trimmedName.length < 2) {
      toast.error(t("companySettings", "organizationNameMinLength"));
      return;
    }

    if (trimmedName === organization.name) {
      return;
    }

    setSavingOrganizationName(true);
    try {
      await organization.update({ name: trimmedName });
      await ensureCurrentUserTeamMembership({
        clerkOrgId: organization.id,
        orgName: trimmedName,
      });
      setOrganizationNameDraft(trimmedName);
      toast.success(t("companySettings", "organizationNameUpdated"));
      router.refresh();
    } catch (error) {
      console.error("Failed to update organization name", error);
      toast.error(t("companySettings", "failedToUpdateOrganizationName"), {
        description: toUserFacingErrorMessage(error),
      });
      setOrganizationNameDraft(organization.name || teamData.name || "");
    } finally {
      setSavingOrganizationName(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!teamData?.teamId) return;

    setBillingAction("portal");
    try {
      const result = await createBillingPortalSession({
        teamId: teamData.teamId,
        baseUrl: window.location.origin,
      });

      if (result.url) {
        window.location.href = result.url;
      } else {
        toast.error(t("companySettings", "failedToOpenBillingPortal"));
      }
    } catch (error) {
      console.error("Error creating billing portal session:", error);
      setBillingActionError(toUserFacingErrorMessage(error));
    } finally {
      setBillingAction(null);
    }
  };

  const handleStartCheckout = async (
    planKey: BillingPlanKey,
    priceId?: string,
  ) => {
    if (!teamData?.teamId) return;

    if (!priceId) {
      toast.error(t("companySettings", "billingPlanNotConfigured"));
      return;
    }

    setBillingAction(planKey);
    try {
      const result = await createCheckoutSession({
        teamId: teamData.teamId,
        priceId,
        baseUrl: window.location.origin,
      });

      if (result.url) {
        window.location.href = result.url;
      } else {
        toast.error(t("companySettings", "failedToOpenCheckout"));
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      setBillingActionError(toUserFacingErrorMessage(error));
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
          defaultPaymentTermDays: Number.parseInt(
            billingProfile.defaultPaymentTermDays || "14",
            10,
          ),
        },
      });
      toast.success(t("companySettings", "billingProfileUpdated"));
    } catch (error) {
      toast.error(t("companySettings", "failedToUpdateBillingProfile"), {
        description: toUserFacingErrorMessage(error),
      });
      console.error(error);
    } finally {
      setSavingBillingProfile(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: "easeOut" as const },
    },
  };

  const remainingCredits = aiAccess?.remainingTokens ?? 0;
  const totalCredits = aiAccess?.totalTokens ?? remainingCredits;
  const usedCredits =
    usageBreakdown?.totalTokens ?? Math.max(0, totalCredits - remainingCredits);
  const creditBreakdownItems = [
    {
      key: "assistant",
      label: t("companySettings", "aiAssistant"),
      icon: Sparkles,
      color: "text-chart-1",
      barColor: "bg-chart-1",
    },
    {
      key: "visualizations",
      label: t("companySettings", "visualizations"),
      icon: BarChart3,
      color: "text-chart-2",
      barColor: "bg-chart-2",
    },
    {
      key: "other",
      label: t("companySettings", "other"),
      icon: AlertCircle,
      color: "text-chart-4",
      barColor: "bg-chart-4",
    },
  ] as const;
  const visibleCreditBreakdownItems = creditBreakdownItems.filter(
    (item) => (usageBreakdown?.byFeature?.[item.key] || 0) > 0,
  );
  const usagePercent =
    totalCredits > 0
      ? Math.min(100, Math.round((usedCredits / totalCredits) * 100))
      : 0;
  const currentPlanKey = subscription?.subscriptionPlan || "free";
  const planStatus = subscription?.subscriptionStatus;
  const canOpenPortal = Boolean(subscription?.stripeCustomerId);
  const preferredBillingCurrency: BillingCurrency =
    (subscription?.subscriptionCurrency as BillingCurrency | undefined) ??
    (locale === "pl" ? "pln" : "usd");
  const billingSeatQuantity = Math.max(
    1,
    Number(subscription?.billingSeatQuantity) || 1,
  );
  const formatBillingAmount = (amount: number, currency = preferredBillingCurrency) =>
    new Intl.NumberFormat(locale === "pl" ? "pl-PL" : "en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount);
  const subscriptionLabel =
    planStatus === "trialing"
      ? t("companySettings", "trial")
      : subscription?.planDetails?.name || t("companySettings", "free");
  const subscriptionSubtext =
    planStatus === "trialing"
      ? t("companySettings", "activeTrialSubscription")
      : planStatus === "active"
        ? t("companySettings", "activeSubscription")
        : t("companySettings", "noActiveSubscription");
  const subscriptionStatusLabel =
    planStatus === "trialing"
      ? t("companySettings", "trial")
      : planStatus === "active"
        ? subscription?.cancelAtPeriodEnd
          ? t("companySettings", "ending")
          : t("companySettings", "active")
        : t("companySettings", "free");
  const subscriptionPeriodLabel = subscription?.currentPeriodEnd
    ? t(
        "companySettings",
        subscription?.cancelAtPeriodEnd ? "accessUntil" : "renews",
        {
          date: new Date(subscription.currentPeriodEnd).toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
          }),
        },
      )
    : t("companySettings", "upgradeToUnlockLimits");
  const checkoutPriceIds: Record<BillingPlanKey, Record<BillingCurrency, string | null>> =
    subscription?.checkoutPlans ?? {
      core: { usd: null, pln: null },
      ai: { usd: null, pln: null },
      ai_scale: { usd: null, pln: null },
    };
  const currentPlanDetails = BILLING_PLANS.find(
    (plan) => plan.key === currentPlanKey,
  );
  const getBillingPlanName = (planKey: BillingPlanKey) => {
    const planNameKeys: Record<BillingPlanKey, string> = {
      core: "coreName",
      ai: "aiName",
      ai_scale: "aiScaleName",
    };
    return t("billingPlanCard", planNameKeys[planKey]);
  };
  const currentPlanCredits =
    subscription?.limits?.aiMonthlyTokens ??
    (currentPlanDetails?.monthlyCreditsPerUser !== undefined
      ? currentPlanDetails.monthlyCreditsPerUser * billingSeatQuantity
      : totalCredits);
  const currentPlanPricePerUser =
    currentPlanDetails?.prices?.[preferredBillingCurrency] ?? 0;
  const hasActiveSubscription =
    planStatus === "active" || planStatus === "trialing";
  const hasPaidSubscription = hasActiveSubscription && currentPlanKey !== "free";
  const getPlanRank = (planKey: string) =>
    BILLING_PLANS.findIndex((candidate) => candidate.key === planKey);
  const availableBillingPlans = BILLING_PLANS.map((plan) => ({
    ...plan,
    priceId: checkoutPriceIds[plan.key]?.[preferredBillingCurrency] ?? undefined,
  })).filter((plan) => Boolean(plan.priceId));
  const upgradeBillingPlans = availableBillingPlans.filter(
    (plan) =>
      plan.key !== currentPlanKey &&
      getPlanRank(plan.key) > getPlanRank(currentPlanKey),
  );
  const visibleBillingPlans = hasPaidSubscription
    ? upgradeBillingPlans
    : availableBillingPlans;
  const recommendedPlan =
    availableBillingPlans.find(
      (plan) =>
        plan.key ===
        (currentPlanKey === "free"
          ? "core"
          : currentPlanKey === "core"
            ? "ai"
            : "ai_scale"),
    ) ||
    availableBillingPlans[0] ||
    null;
  const isBillingActionPending = billingAction !== null || syncingSubscription;
  const activeSettingsSectionConfig =
    COMPANY_SETTINGS_SECTIONS.find(
      (section) => section.value === activeSettingsSection,
    ) ?? COMPANY_SETTINGS_SECTIONS[0];
  const workspaceSections = COMPANY_SETTINGS_SECTIONS.filter(
    (section) => section.scope === "workspace",
  );
  const personalSections = COMPANY_SETTINGS_SECTIONS.filter(
    (section) => section.scope === "personal",
  );

  return (
    <div className="min-h-screen pb-20">
      <BillingActionErrorDialog
        message={billingActionError}
        onClose={() => setBillingActionError(null)}
      />
      <div
        className={cn(
          "mx-auto flex w-full flex-col gap-6 py-4",
          isSubscriptionPage ? "max-w-7xl" : "max-w-5xl",
        )}
      >
        {isSubscriptionPage ? (
          <div className="flex flex-col gap-2">
            <h1 className="clean-title text-4xl font-medium tracking-tight text-foreground md:text-5xl">
              {t("companySettings", "subscription")}
            </h1>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <h1 className="clean-title text-[1.65rem] font-medium tracking-tight text-foreground md:text-[1.9rem]">
              {t("companySettings", "settings")}
            </h1>
          </div>
        )}

        {isSubscriptionPage ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-6"
          >
            <div
              className={cn(
                "flex flex-col gap-4",
                hasPaidSubscription ? "order-3" : "order-1",
              )}
            >
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Badge variant="secondary">
                    {hasPaidSubscription
                      ? t("companySettings", "upgradeOptions")
                      : t("companySettings", "subscriptionOptions")}
                  </Badge>
                  <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-semibold tracking-tight">
                      {hasPaidSubscription
                        ? t("companySettings", "needMoreCapacity")
                        : t("companySettings", "choosePlan")}
                    </h2>
                    {hasPaidSubscription ? (
                      <p className="max-w-2xl text-sm text-muted-foreground">
                        {t("companySettings", "currentPlanActiveDescription")}
                      </p>
                    ) : null}
                    <p className="max-w-2xl text-sm text-muted-foreground">
                      {t("companySettings", "seatBillingNote")}
                    </p>
                  </div>
                </div>
              </div>

              {visibleBillingPlans.length > 0 ? (
                <div
                  className={cn(
                    "grid gap-4",
                    visibleBillingPlans.length === 2 && "xl:grid-cols-2",
                    visibleBillingPlans.length > 2 &&
                      "xl:grid-cols-3",
                  )}
                >
                  {visibleBillingPlans.map((plan) => {
                    const isCurrentPlan = currentPlanKey === plan.key;
                    const canUpgradeToPlan = !isCurrentPlan && plan.priceId;
                    const isRecommended =
                      recommendedPlan?.key === plan.key &&
                      currentPlanKey === "free";
                    const availabilityLabel = isCurrentPlan
                      ? t("companySettings", "currentPlan")
                      : plan.key === "ai_scale"
                        ? t("companySettings", "bestValue")
                        : t("companySettings", "available");
                    const availabilityVariant =
                      isCurrentPlan || plan.key === "ai_scale"
                        ? "secondary"
                        : "outline";

                    return (
                      <BillingPlanCard
                        key={plan.key}
                        plan={plan}
                        availabilityLabel={availabilityLabel}
                        availabilityVariant={availabilityVariant}
                        isCurrentPlan={isCurrentPlan}
                        isRecommended={isRecommended}
                        currency={preferredBillingCurrency}
                        locale={locale}
                        seatCount={billingSeatQuantity}
                        footer={
                          isCurrentPlan && canOpenPortal ? (
	                            <Button
	                              onClick={handleManageSubscription}
	                              disabled={isBillingActionPending}
	                              variant="outline"
	                              className="w-full"
	                            >
                              {billingAction === "portal" ? (
                                <>
                                  <Loader2
                                    data-icon="inline-start"
                                    className="animate-spin"
                                  />
                                  {t("companySettings", "openingBilling")}
                                </>
                              ) : (
                                <>
                                  <CreditCard data-icon="inline-start" />
                                  {t("companySettings", "managePlan")}
                                </>
                              )}
                            </Button>
                          ) : canUpgradeToPlan ? (
	                            <Button
	                              onClick={() =>
	                                void handleStartCheckout(plan.key, plan.priceId)
	                              }
	                              disabled={isBillingActionPending}
	                              className={cn(
	                                "w-full",
	                                plan.key === "ai_scale" || isRecommended
	                                  ? "h-11"
	                                  : "h-10",
	                              )}
	                              variant={
	                                plan.key === "ai_scale" || isRecommended
	                                  ? "default"
	                                  : "outline"
	                              }
	                            >
                              {billingAction === plan.key ? (
                                <>
                                  <Loader2
                                    data-icon="inline-start"
                                    className="animate-spin"
                                  />
                                  {t("companySettings", "openingCheckout")}
                                </>
                              ) : (
                                <>
                                  <Coins data-icon="inline-start" />
                                  {currentPlanKey === "free"
                                    ? t("companySettings", "choosePlanName", {
                                        plan: getBillingPlanName(plan.key),
                                      })
                                    : t("companySettings", "upgradeToPlanName", {
                                        plan: getBillingPlanName(plan.key),
                                      })}
                                </>
                              )}
                            </Button>
                          ) : (
                            <Button
                              disabled
                              variant="outline"
                              className="w-full"
                            >
                              {t("companySettings", "currentSelection")}
                            </Button>
                          )
                        }
                      />
                    );
                  })}
                </div>
              ) : hasPaidSubscription ? (
                <Alert>
                  <Check />
                  <AlertTitle>
                    {t("companySettings", "highestPlanTitle")}
                  </AlertTitle>
                  <AlertDescription>
                    {t("companySettings", "highestPlanDescription")}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertCircle />
                  <AlertTitle>
                    {t("companySettings", "checkoutNotConfiguredTitle")}
                  </AlertTitle>
                  <AlertDescription>
                    {t("companySettings", "checkoutNotConfiguredDescription")}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div
              className={cn(
                "grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]",
                hasPaidSubscription ? "order-1" : "order-2",
              )}
            >
              <Card className="border-border/70 bg-card shadow-none">
                <CardHeader className="gap-4 border-b border-border/70">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base font-medium">
                        <Coins className="h-4 w-4" />
                        {t("companySettings", "creditsOverview")}
                      </CardTitle>
                    </div>
                    <Badge
                      variant={usagePercent >= 75 ? "secondary" : "outline"}
                    >
                      {t("companySettings", "percentUsed", {
                        percent: usagePercent,
                      })}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-5 pt-6">
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm text-muted-foreground">
                        {t("companySettings", "availableNow")}
                      </p>
                      <div className="text-4xl font-semibold tracking-tight tabular-nums">
                        {formatTokens(remainingCredits)}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-secondary/70 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          {t("companySettings", "usedThisPeriod")}
                        </p>
                        <p className="mt-2 text-xl font-semibold tabular-nums">
                          {formatTokens(usedCredits)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-secondary/70 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          {t("companySettings", "monthlyCredits")}
                        </p>
                        <p className="mt-2 text-xl font-semibold tabular-nums">
                          {formatTokens(totalCredits)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-secondary/70 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          {t("companySettings", "estimatedPerRun")}
                        </p>
                        <p className="mt-2 text-xl font-semibold tabular-nums">
                          {formatTokens(GPT_IMAGE_TYPICAL_CREDITS)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {t("companySettings", "creditsUsedShort", {
                          count: formatTokens(usedCredits),
                        })}
                      </span>
                      <span>
                        {t("companySettings", "creditsTotalShort", {
                          count: formatTokens(totalCredits),
                        })}
                      </span>
                    </div>
                    <Progress
                      value={usagePercent}
                      className="h-2.5 bg-secondary/70"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card shadow-sm">
                <CardHeader className="gap-4 border-b border-border/40">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    {t("companySettings", "currentPlanTitle")}
                  </CardTitle>
                  <CardAction>
                    <Badge
                      variant={
                        planStatus === "active" || planStatus === "trialing"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {subscriptionStatusLabel}
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="flex h-full flex-col gap-5 pt-6">
                  <div className="flex flex-col gap-1">
                    <div className="text-3xl font-semibold tracking-tight">
                      {subscriptionLabel}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {subscriptionSubtext}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {subscriptionPeriodLabel}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-secondary/70 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {t("companySettings", "includedMonthlyCredits")}
                    </p>
                    <p className="mt-2 text-xl font-semibold tabular-nums">
                      {formatTokens(currentPlanCredits)}
                    </p>
                  </div>

                  <div className="mt-auto flex flex-col gap-2">
                    {currentPlanKey === "free" && recommendedPlan ? (
                      <Button
                        onClick={() =>
                          void handleStartCheckout(
                            recommendedPlan.key,
                            recommendedPlan.priceId,
                          )
                        }
                        disabled={isBillingActionPending}
                        className="w-full"
                      >
                        {billingAction === recommendedPlan.key ? (
                          <>
                            <Loader2
                              data-icon="inline-start"
                              className="animate-spin"
                            />
                            {t("companySettings", "openingCheckout")}
                          </>
                        ) : (
                          <>
                            <Coins data-icon="inline-start" />
                            {t("companySettings", "upgradeToPlanName", {
                              plan: getBillingPlanName(recommendedPlan.key),
                            })}
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
                            <Loader2
                              data-icon="inline-start"
                              className="animate-spin"
                            />
                            {t("companySettings", "openingBilling")}
                          </>
                        ) : (
                          <>
                            <CreditCard data-icon="inline-start" />
                            {t("companySettings", "manageSubscription")}
                          </>
                        )}
                      </Button>
                    ) : recommendedPlan ? (
                      <Button
                        onClick={() =>
                          void handleStartCheckout(
                            recommendedPlan.key,
                            recommendedPlan.priceId,
                          )
                        }
                        disabled={isBillingActionPending}
                        className="w-full"
                      >
                        {billingAction === recommendedPlan.key ? (
                          <>
                            <Loader2
                              data-icon="inline-start"
                              className="animate-spin"
                            />
                            {t("companySettings", "openingCheckout")}
                          </>
                        ) : (
                          <>
                            <ArrowRight data-icon="inline-start" />
                            {t("companySettings", "renewUpgradePlan")}
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button disabled className="w-full">
                        {t("companySettings", "billingUnavailable")}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card
              className={cn(
                "border-border/40 bg-card shadow-sm",
                hasPaidSubscription ? "order-2" : "order-3",
              )}
            >
              <CardHeader>
                <CardTitle className="text-base font-medium">
                  {t("companySettings", "transactionHistory")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {displayedInvoices && displayedInvoices.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {displayedInvoices.map((invoice) => {
                      const amount =
                        (invoice.amountPaid || invoice.amountDue || 0) / 100;
                      const currency = invoice.currency || "USD";
                      const formatted = new Intl.NumberFormat(locale === "pl" ? "pl-PL" : "en-US", {
                        style: "currency",
                        currency,
                      }).format(amount);
                      const createdAt = new Date(
                        invoice.created * 1000,
                      ).toLocaleDateString(locale, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });

                      return (
                        <div
                          key={invoice.stripeInvoiceId}
                          className="flex flex-col gap-1 rounded-lg border border-border/40 bg-secondary/70 px-4 py-3 text-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{formatted}</span>
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">
                              {invoice.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{createdAt}</span>
                            <span>
                              {invoice.stripeInvoiceId.slice(-8)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : stripeInvoicesLoading || teamInvoices === undefined ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                    <Clock3 className="h-6 w-6" />
                    <p className="text-sm">
                      {t("companySettings", "noTransactionsYet")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Separator className="order-4" />

            <div className="order-5 flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-medium">
                  {t("companySettings", "usage")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("companySettings", "usageDescription")}
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="border-border/40 bg-card shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-medium">
                      <Coins className="h-4 w-4 text-chart-1" />
                      {t("companySettings", "aiCredits")}
                    </CardTitle>
                    <CardDescription>
                      {usageBreakdown?.periodStart
                        ? new Date(
                            usageBreakdown.periodStart,
                          ).toLocaleDateString(locale, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : t("companySettings", "currentPeriod")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div>
                      <div className="text-xl font-semibold tabular-nums">
                        {formatTokens(usedCredits)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("companySettings", "creditsUsedThisBillingPeriod")}
                      </p>
                    </div>
                    <div>
                      <div className="text-xl font-semibold tabular-nums">
                        {formatTokens(remainingCredits)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("companySettings", "creditsRemaining")}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                      <Progress
                        value={usagePercent}
                        className="h-2 bg-secondary/70"
                        indicatorClassName={
                          usagePercent >= 90
                            ? "bg-destructive"
                            : usagePercent >= 75
                              ? "bg-chart-1"
                              : "bg-chart-2"
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("companySettings", "percentUsed", {
                          percent: usagePercent,
                        })}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/40 bg-card shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-medium">
                      <HardDrive className="h-4 w-4 text-chart-2" />
                      {t("companySettings", "storage")}
                    </CardTitle>
                    <CardDescription>
                      {t("companySettings", "allProjectsCombined")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div>
                      <div className="text-xl font-semibold tabular-nums">
                        {storageUsage?.usedGB.toFixed(2) ?? "0.00"} GB
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("companySettings", "usedOfGbTotal", {
                          used: storageUsage?.usedGB.toFixed(2) ?? "0.00",
                          total: storageUsage?.limitGB ?? 0,
                        })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {t("companySettings", "gbUsed", {
                            count: storageUsage?.usedGB.toFixed(2) ?? "0.00",
                          })}
                        </span>
                        <span>
                          {t("companySettings", "gbTotal", {
                            count: storageUsage?.limitGB ?? 0,
                          })}
                        </span>
                      </div>
                      <Progress
                        value={storageUsage?.percentUsed ?? 0}
                        className="h-2 bg-secondary/70"
                        indicatorClassName={
                          (storageUsage?.percentUsed ?? 0) >= 90
                            ? "bg-destructive"
                            : (storageUsage?.percentUsed ?? 0) >= 75
                              ? "bg-chart-1"
                              : "bg-chart-2"
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("companySettings", "percentUsed", {
                          percent: storageUsage?.percentUsed.toFixed(1) ?? "0.0",
                        })}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/40 bg-card shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-medium">
                      <FolderOpen className="h-4 w-4 text-chart-3" />
                      {t("companySettings", "projects")}
                    </CardTitle>
                    <CardDescription>
                      {t("companySettings", "activeProjects")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div>
                      <div className="text-xl font-semibold tabular-nums">
                        {t("companySettings", "projectsCount", {
                          count: resourceUsage?.projectsUsed ?? 0,
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("companySettings", "ofTotal", {
                          count: resourceUsage?.projectsLimit ?? 0,
                        })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {t("companySettings", "usedCount", {
                            count: resourceUsage?.projectsUsed ?? 0,
                          })}
                        </span>
                        <span>
                          {t("companySettings", "totalCount", {
                            count: resourceUsage?.projectsLimit ?? 0,
                          })}
                        </span>
                      </div>
                      <Progress
                        value={resourceUsage?.projectsPercentUsed ?? 0}
                        className="h-2 bg-secondary/70"
                        indicatorClassName={
                          (resourceUsage?.projectsPercentUsed ?? 0) >= 90
                            ? "bg-destructive"
                            : (resourceUsage?.projectsPercentUsed ?? 0) >= 75
                              ? "bg-chart-1"
                              : "bg-chart-3"
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("companySettings", "percentUsed", {
                          percent: resourceUsage?.projectsPercentUsed ?? 0,
                        })}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/40 bg-card shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-medium">
                      <Users className="h-4 w-4 text-chart-4" />
                      {t("companySettings", "teamMembers")}
                    </CardTitle>
                    <CardDescription>
                      {t("companySettings", "activeMembers")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div>
                      <div className="text-xl font-semibold tabular-nums">
                        {t("companySettings", "membersCount", {
                          count: resourceUsage?.membersUsed ?? 0,
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("companySettings", "ofTotal", {
                          count: resourceUsage?.membersLimit ?? 0,
                        })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {t("companySettings", "usedCount", {
                            count: resourceUsage?.membersUsed ?? 0,
                          })}
                        </span>
                        <span>
                          {t("companySettings", "totalCount", {
                            count: resourceUsage?.membersLimit ?? 0,
                          })}
                        </span>
                      </div>
                      <Progress
                        value={resourceUsage?.membersPercentUsed ?? 0}
                        className="h-2 bg-secondary/70"
                        indicatorClassName={
                          (resourceUsage?.membersPercentUsed ?? 0) >= 90
                            ? "bg-destructive"
                            : (resourceUsage?.membersPercentUsed ?? 0) >= 75
                              ? "bg-chart-1"
                              : "bg-chart-4"
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("companySettings", "percentUsed", {
                          percent: resourceUsage?.membersPercentUsed ?? 0,
                        })}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/40 bg-card shadow-sm md:col-span-2 lg:col-span-1">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      {t("companySettings", "subscriptionPlan")}
                      <span
                        className="text-muted-foreground"
                        title={t("companySettings", "limitsResetTitle")}
                      >
                        <AlertCircle className="h-3.5 w-3.5" />
                      </span>
                    </CardTitle>
                    <CardDescription>
                      {usageBreakdown?.periodEnd
                        ? t("companySettings", "nextBilling", {
                            date: new Date(usageBreakdown.periodEnd).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" }),
                          })
                        : t("companySettings", "billingPeriod")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t("companySettings", "plan")}
                      </span>
                      <span className="font-medium">{subscriptionLabel}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t("companySettings", "monthlyCost")}
                      </span>
                      <span className="font-medium">
                        {currentPlanPricePerUser > 0
                          ? t("companySettings", "monthlySeatTotal", {
                              amount: formatBillingAmount(
                                currentPlanPricePerUser * billingSeatQuantity,
                              ),
                              seats: billingSeatQuantity,
                            })
                          : t("companySettings", "free")}
                      </span>
                    </div>
                    <div className="pt-2">
                      <Button
                        onClick={handleManageSubscription}
                        disabled={isBillingActionPending || !canOpenPortal}
                        variant="outline"
                        className="w-full"
                      >
                        {billingAction === "portal"
                          ? t("companySettings", "opening")
                          : t("companySettings", "manageSubscription")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/70 bg-card shadow-none">
                <CardHeader className="pb-3 border-b border-border/70">
                  <CardTitle className="text-base font-medium">
                    {t("companySettings", "creditBreakdown")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{t("companySettings", "creditsUsed")}</span>
                    <span>
                      {formatTokens(usedCredits)} of{" "}
                      {t("companySettings", "creditsTotalPhrase", {
                        count: formatTokens(totalCredits),
                      })}
                    </span>
                  </div>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary/70">
                    {visibleCreditBreakdownItems.map((segment) => {
                      const tokens =
                        usageBreakdown?.byFeature?.[segment.key] || 0;
                      const percent =
                        usedCredits > 0 ? (tokens / usedCredits) * 100 : 0;
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
                      const percent =
                        usedCredits > 0 ? (tokens / usedCredits) * 100 : 0;
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.key}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${item.color}`} />
                            <span>{item.label}</span>
                          </div>
                          <div className="text-muted-foreground">
                            {t("companySettings", "creditsWithPercent", {
                              credits: formatTokens(tokens),
                              percent: percent.toFixed(1),
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("companySettings", "typicalVisualizationUsage", {
                      credits: formatTokens(GPT_IMAGE_TYPICAL_CREDITS),
                    })}
                  </p>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)] xl:gap-12">
            <aside className="self-start lg:sticky lg:top-8">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-1">
                  <p className="px-4 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {t("companySettings", "workspace")}
                  </p>
                  <nav className="flex flex-col gap-1">
                    {workspaceSections.map((section) => (
                      <button
                        key={section.value}
                        type="button"
                        onClick={() => setActiveSettingsSection(section.value)}
                        className={cn(
                          "rounded-2xl px-4 py-3 text-left text-[1rem] transition-colors",
                          activeSettingsSection === section.value
                            ? "bg-secondary/70 text-foreground"
                            : "text-foreground/80 hover:bg-secondary/70 hover:text-foreground",
                        )}
                      >
                        {t("companySettings", section.labelKey)}
                      </button>
                    ))}
                  </nav>
                </div>

                {personalSections.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    <p className="px-4 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {t("companySettings", "personal")}
                    </p>
                    <nav className="flex flex-col gap-1">
                      {personalSections.map((section) => (
                        <button
                          key={section.value}
                          type="button"
                          onClick={() =>
                            setActiveSettingsSection(section.value)
                          }
                          className={cn(
                            "rounded-2xl px-4 py-3 text-left text-[1rem] transition-colors",
                            activeSettingsSection === section.value
                              ? "bg-secondary/70 text-foreground"
                              : "text-foreground/80 hover:bg-secondary/70 hover:text-foreground",
                          )}
                        >
                          {t("companySettings", section.labelKey)}
                        </button>
                      ))}
                    </nav>
                  </div>
                ) : null}
              </div>
            </aside>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid gap-8"
            >
              <section className="grid gap-8">
                <div className="flex flex-col gap-1 border-b border-border/70 pb-5">
                  <h2 className="text-[1.2rem] font-semibold tracking-tight text-foreground md:text-[1.3rem]">
                    {t("companySettings", activeSettingsSectionConfig.labelKey)}
                  </h2>
                </div>

                {activeSettingsSection === "general" ? (
                  <section id="organization-profile" className="grid gap-6">
                    <input
                      ref={organizationImageInputRef}
                      id="organization-image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleSelectOrganizationImage}
                      className="hidden"
                    />

                    <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm md:p-8">
                      <div className="grid gap-8">
                        <form
                          className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void handleSaveOrganizationName();
                          }}
                        >
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="organization-name">
                              {t("companySettings", "organizationName")}
                            </Label>
                            <Input
                              id="organization-name"
                              value={organizationNameDraft}
                              onChange={(event) =>
                                setOrganizationNameDraft(event.target.value)
                              }
                              disabled={
                                savingOrganizationName ||
                                !organization?.id ||
                                !teamData?.teamId
                              }
                              placeholder={t("companySettings", "organizationName")}
                              className="h-12 bg-card text-base"
                            />
                          </div>
                          <Button
                            type="submit"
                            disabled={!canSaveOrganizationName}
                            className="h-12 px-6"
                          >
                            {savingOrganizationName ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t("companySettings", "saving")}
                              </>
                            ) : (
                              t("companySettings", "save")
                            )}
                          </Button>
                        </form>

                        <div className="border-t border-border/60 pt-6">
                          <OrganizationImagePicker
                            inputId="organization-image-upload"
                            currentImageUrl={organizationImagePreviewUrl}
                            name={
                              organizationNameDraft ||
                              organization?.name ||
                              t("companySettings", "organization")
                            }
                            onPick={() =>
                              organizationImageInputRef.current?.click()
                            }
                            disabled={savingOrganizationProfile}
                            buttonLabel={
                              savingOrganizationProfile
                                ? t("companySettings", "uploading")
                                : organizationImageReady
                                  ? t("companySettings", "changeImage")
                                  : t("companySettings", "uploadCustomImage")
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <Card
                      id="workspace-defaults"
                      className="overflow-hidden border-border/70 bg-card shadow-none"
                    >
                      <CardHeader className="gap-2 border-b border-border/70">
                        <CardTitle className="flex items-center gap-2 text-base font-medium">
                          <Globe className="h-4 w-4 text-primary" />
                          {t("companySettings", "regionalDefaults")}
                        </CardTitle>
                        <CardDescription>
                          {t("companySettings", "regionalDefaultsDescription")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-8 p-6">
                        <div className="grid gap-4">
                          <div className="flex flex-col gap-1">
                            <h3 className="text-sm font-medium text-foreground">
                              {t("companySettings", "currencyTimezone")}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {t("companySettings", "currencyTimezoneDescription")}
                            </p>
                          </div>
                          <div className="grid gap-4">
                            <div className="grid gap-2">
                              <Label htmlFor="currency">
                                {t("companySettings", "currency")}
                              </Label>
                              <Select
                                value={teamSettings.currency}
                                onValueChange={(value) =>
                                  setTeamSettings({
                                    ...teamSettings,
                                    currency:
                                      value as typeof teamSettings.currency,
                                  })
                                }
                              >
                                <SelectTrigger
                                  id="currency"
                                  className="w-full bg-secondary/70"
                                >
                                  <SelectValue placeholder={t("companySettings", "selectCurrency")} />
                                </SelectTrigger>
                                <SelectContent>
                                  {[
                                    { value: "USD", label: t("companySettings", "usd") },
                                    { value: "EUR", label: t("companySettings", "eur") },
                                    {
                                      value: "PLN",
                                      label: t("companySettings", "pln"),
                                    },
                                    {
                                      value: "GBP",
                                      label: t("companySettings", "gbp"),
                                    },
                                    {
                                      value: "CAD",
                                      label: t("companySettings", "cad"),
                                    },
                                    {
                                      value: "AUD",
                                      label: t("companySettings", "aud"),
                                    },
                                    { value: "JPY", label: t("companySettings", "jpy") },
                                  ].map((curr) => (
                                    <SelectItem
                                      key={curr.value}
                                      value={curr.value}
                                    >
                                      <span className="font-medium">
                                        {curr.value}
                                      </span>
                                      <span className="ml-2 text-xs text-muted-foreground">
                                        ({curr.label})
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid gap-2">
                              <Label>{t("companySettings", "organizationTimezone")}</Label>
                              <TimezonePicker
                                value={teamSettings.timezone}
                                onValueChange={(timezone) =>
                                  setTeamSettings({ ...teamSettings, timezone })
                                }
                                className="w-full"
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="flex flex-col gap-3 border-t border-border/70 px-6 py-4">
                        <Button
                          onClick={handleSaveTeamSettings}
                          disabled={savingPreferences}
                          className="min-w-[140px] self-start"
                        >
                          {savingPreferences ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                          ) : (
                            <>
                              <Check data-icon="inline-start" />
                              {t("companySettings", "save")}
                            </>
                          )}
                        </Button>
                      </CardFooter>
                    </Card>
                  </section>
                ) : null}

                {activeSettingsSection === "billing" ? (
                  <Card
                    id="organization-billing-profile"
                    className="scroll-mt-24 overflow-hidden border-border/70 bg-card shadow-none"
                  >
                    <CardHeader className="gap-2 border-b border-border/70">
                      <CardTitle className="flex items-center gap-2 text-base font-medium">
                        <CreditCard className="h-4 w-4 text-primary" />
                        {t("companySettings", "invoicingProfile")}
                      </CardTitle>
                      <CardDescription>
                        {t("companySettings", "invoicingProfileDescription")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-8 p-6">
                      <div className="grid gap-4">
                        <div className="flex flex-col gap-1">
                          <h3 className="text-sm font-medium text-foreground">
                            {t("companySettings", "sellerIdentity")}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {t("companySettings", "sellerIdentityDescription")}
                          </p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="flex flex-col gap-2">
                            <Label>{t("companySettings", "sellerName")}</Label>
                            <Input
                              value={billingProfile.sellerName}
                              onChange={(e) =>
                                setBillingProfile((prev) => ({
                                  ...prev,
                                  sellerName: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>{t("companySettings", "taxIdVatId")}</Label>
                            <Input
                              value={billingProfile.sellerTaxId}
                              onChange={(e) =>
                                setBillingProfile((prev) => ({
                                  ...prev,
                                  sellerTaxId: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>{t("companySettings", "billingEmail")}</Label>
                            <Input
                              type="email"
                              value={billingProfile.sellerEmail}
                              onChange={(e) =>
                                setBillingProfile((prev) => ({
                                  ...prev,
                                  sellerEmail: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>{t("companySettings", "phone")}</Label>
                            <Input
                              value={billingProfile.sellerPhone}
                              onChange={(e) =>
                                setBillingProfile((prev) => ({
                                  ...prev,
                                  sellerPhone: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="grid gap-4">
                        <div className="flex flex-col gap-1">
                          <h3 className="text-sm font-medium text-foreground">
                            {t("companySettings", "registeredAddress")}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {t("companySettings", "registeredAddressDescription")}
                          </p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <div className="flex flex-col gap-2 md:col-span-2 xl:col-span-3">
                            <Label>{t("companySettings", "addressLine1")}</Label>
                            <Input
                              value={billingProfile.sellerAddressLine1}
                              onChange={(e) =>
                                setBillingProfile((prev) => ({
                                  ...prev,
                                  sellerAddressLine1: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-2 md:col-span-2 xl:col-span-3">
                            <Label>{t("companySettings", "addressLine2")}</Label>
                            <Input
                              value={billingProfile.sellerAddressLine2}
                              onChange={(e) =>
                                setBillingProfile((prev) => ({
                                  ...prev,
                                  sellerAddressLine2: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>{t("companySettings", "postalCode")}</Label>
                            <Input
                              value={billingProfile.sellerPostalCode}
                              onChange={(e) =>
                                setBillingProfile((prev) => ({
                                  ...prev,
                                  sellerPostalCode: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>{t("companySettings", "city")}</Label>
                            <Input
                              value={billingProfile.sellerCity}
                              onChange={(e) =>
                                setBillingProfile((prev) => ({
                                  ...prev,
                                  sellerCity: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>{t("companySettings", "country")}</Label>
                            <Input
                              value={billingProfile.sellerCountry}
                              onChange={(e) =>
                                setBillingProfile((prev) => ({
                                  ...prev,
                                  sellerCountry: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="grid gap-4">
                        <div className="flex flex-col gap-1">
                          <h3 className="text-sm font-medium text-foreground">
                            {t("companySettings", "paymentDetails")}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {t("companySettings", "paymentDetailsDescription")}
                          </p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="flex flex-col gap-2">
                            <Label>{t("companySettings", "accountHolder")}</Label>
                            <Input
                              value={billingProfile.bankAccountHolder}
                              onChange={(e) =>
                                setBillingProfile((prev) => ({
                                  ...prev,
                                  bankAccountHolder: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>{t("companySettings", "bankName")}</Label>
                            <Input
                              value={billingProfile.bankName}
                              onChange={(e) =>
                                setBillingProfile((prev) => ({
                                  ...prev,
                                  bankName: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>{t("companySettings", "bankAccountNumberIban")}</Label>
                            <Input
                              value={billingProfile.bankAccountNumber}
                              onChange={(e) =>
                                setBillingProfile((prev) => ({
                                  ...prev,
                                  bankAccountNumber: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>{t("companySettings", "swift")}</Label>
                            <Input
                              value={billingProfile.bankSwift}
                              onChange={(e) =>
                                setBillingProfile((prev) => ({
                                  ...prev,
                                  bankSwift: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-2 md:max-w-[220px]">
                            <Label>{t("companySettings", "defaultDueDays")}</Label>
                            <Input
                              type="number"
                              min="1"
                              value={billingProfile.defaultPaymentTermDays}
                              onChange={(e) =>
                                setBillingProfile((prev) => ({
                                  ...prev,
                                  defaultPaymentTermDays: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-2 md:col-span-2">
                            <Label>{t("companySettings", "paymentInstructions")}</Label>
                            <Textarea
                              rows={4}
                              value={billingProfile.paymentInstructions}
                              onChange={(e) =>
                                setBillingProfile((prev) => ({
                                  ...prev,
                                  paymentInstructions: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3 border-t border-border/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">
                        {t("companySettings", "sellerNameFallback")}
                      </p>
                      <Button
                        onClick={handleSaveBillingProfile}
                        disabled={savingBillingProfile}
                        className="min-w-[140px] self-start sm:self-auto"
                      >
                        {savingBillingProfile ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                        ) : (
                          <>
                            <Check data-icon="inline-start" />
                            {t("companySettings", "save")}
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                ) : null}
              </section>

              <div className="grid gap-8">
                {activeSettingsSection === "notifications" ? (
                  <Card
                    id="workspace-notifications"
                    className="overflow-hidden border-border/70 bg-card shadow-none"
                  >
                    <CardHeader className="gap-2 border-b border-border/70">
                      <CardTitle className="flex items-center gap-2 text-base font-medium">
                        <BellRing className="h-4 w-4 text-primary" />
                        {t("companySettings", "myNotifications")}
                      </CardTitle>
                      <CardDescription>
                        {t("companySettings", "notificationsDescription")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-8 p-6">
                      <div className="grid gap-3">
                        <div className="flex flex-col gap-1">
                          <h3 className="text-sm font-medium text-foreground">
                            {t("companySettings", "tasks")}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {t("companySettings", "tasksNotificationsDescription")}
                          </p>
                        </div>
                        {[
                          {
                            key: "taskAssigned",
                            title: t("companySettings", "taskAssigned"),
                            description: t("companySettings", "taskAssignedDescription"),
                          },
                          {
                            key: "taskUnassigned",
                            title: t("companySettings", "taskUnassigned"),
                            description: t("companySettings", "taskUnassignedDescription"),
                          },
                          {
                            key: "taskStatusUpdated",
                            title: t("companySettings", "taskStatusUpdated"),
                            description: t("companySettings", "taskStatusUpdatedDescription"),
                          },
                          {
                            key: "taskDueDateChanged",
                            title: t("companySettings", "taskDueDateChanged"),
                            description: t("companySettings", "taskDueDateChangedDescription"),
                          },
                        ].map((item) => (
                          <div
                            key={item.key}
                            className="flex items-start justify-between gap-4 rounded-2xl border border-border/50 bg-secondary/70 px-4 py-4"
                          >
                            <div className="flex flex-col gap-1 pr-4">
                              <div className="text-sm font-medium text-foreground">
                                {item.title}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {item.description}
                              </p>
                            </div>
                            <Switch
                              checked={
                                notificationSettings[
                                  item.key as keyof TeamMemberNotificationSettings
                                ]
                              }
                              onCheckedChange={(checked) =>
                                setNotificationSettings((current) => ({
                                  ...current,
                                  [item.key]: checked,
                                }))
                              }
                            />
                          </div>
                        ))}
                      </div>

                      <Separator />

                      <div className="grid gap-3">
                        <div className="flex flex-col gap-1">
                          <h3 className="text-sm font-medium text-foreground">
                            {t("companySettings", "comments")}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {t("companySettings", "commentsDescription")}
                          </p>
                        </div>
                        <div className="flex items-start justify-between gap-4 rounded-2xl border border-border/50 bg-secondary/70 px-4 py-4">
                          <div className="flex flex-col gap-1 pr-4">
                            <div className="text-sm font-medium text-foreground">
                              {t("companySettings", "taskComments")}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {t("companySettings", "taskCommentsDescription")}
                            </p>
                          </div>
                          <Switch
                            checked={notificationSettings.taskComments}
                            onCheckedChange={(checked) =>
                              setNotificationSettings((current) => ({
                                ...current,
                                taskComments: checked,
                              }))
                            }
                          />
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3 border-t border-border/70 px-6 py-4">
                      <p className="text-xs text-muted-foreground">
                        {t("companySettings", "preferencesApply")}
                      </p>
                      <Button
                        onClick={handleSaveNotificationSettings}
                        disabled={savingNotifications}
                        className="min-w-[140px] self-start"
                      >
                        {savingNotifications ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                        ) : (
                          <>
                            <Check data-icon="inline-start" />
                            {t("companySettings", "save")}
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                ) : null}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
