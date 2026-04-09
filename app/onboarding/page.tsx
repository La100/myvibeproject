"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuth, useOrganization, useOrganizationList } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  Bot,
  Building2,
  Camera,
  Check,
  Clock3,
  Coins,
  LocateFixed,
  MessageSquareText,
  Puzzle,
  Sparkles,
  Swords,
  Trophy,
} from "lucide-react";

import { apiAny } from "@/lib/convexApiAny";
import { cn } from "@/lib/utils";
import {
  ONBOARDING_EXTENSION_READY_KEY,
  readOnboardingFlag,
} from "@/lib/onboardingJourney";
import {
  currencyOptions,
  detectBrowserCurrency,
  isCurrencyCode,
  type CurrencyCode,
} from "@/lib/onboardingPreferences";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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

type ChatRole = "assistant" | "user";

type ChatEntry = {
  id: string;
  role: ChatRole;
  content: string;
};

type QuestItem = {
  id: string;
  label: string;
  xp: number;
  done: boolean;
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
  const onboardingStatus = useQuery(apiAny.onboarding.getStatus);
  const completeOnboarding = useMutation(apiAny.onboarding.completeOnboarding);
  const ensureCurrentUserTeamMembership = useMutation(apiAny.teamMembership.ensureCurrentUserTeamMembership);
  const updateTeamSettings = useMutation(apiAny.teams.updateTeamSettings);
  const { organization } = useOrganization();
  const { createOrganization, setActive, isLoaded: organizationListLoaded } = useOrganizationList();
  const isForcedOrganizationSetup = searchParams.get("mode") === "organization";

  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [organizationCurrency, setOrganizationCurrency] = useState<CurrencyCode>("USD");
  const [organizationTimezone, setOrganizationTimezone] = useState("UTC");
  const [initialized, setInitialized] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [organizationImagePreviewUrl, setOrganizationImagePreviewUrl] = useState("");
  const [extensionReady, setExtensionReady] = useState(false);
  const [isUploadingOrganizationImage, setIsUploadingOrganizationImage] = useState(false);

  const announcedOrganizationIdRef = useRef<string | null>(null);
  const completionHintShownRef = useRef(false);
  const organizationImageInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    const syncJourney = () => {
      const hasExtensionReady = readOnboardingFlag(ONBOARDING_EXTENSION_READY_KEY);
      setExtensionReady(hasExtensionReady);
    };

    syncJourney();
    window.addEventListener("storage", syncJourney);
    window.addEventListener("focus", syncJourney);

    return () => {
      window.removeEventListener("storage", syncJourney);
      window.removeEventListener("focus", syncJourney);
    };
  }, []);

  useEffect(() => {
    setOrganizationImagePreviewUrl(organization?.imageUrl || "");
  }, [organization?.imageUrl]);

  const activeOrganization = onboardingStatus?.activeOrganization ?? null;
  const canUpdateOrganization = Boolean(activeOrganization?.canUpdateTeamSettings);

  const appendChat = (role: ChatRole, content: string) => {
    setChatHistory((current) => [
      ...current,
      {
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        content,
      },
    ]);
  };

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
      return false;
    }
    if (!createOrganization) {
      toast.error("Organization creation is not available yet.");
      return false;
    }

    setIsCreatingOrganization(true);
    try {
      const createdOrganization = await createOrganization({
        name: trimmedName,
      });
      const activated = await activateOrganization(createdOrganization.id, createdOrganization.name || trimmedName);
      if (!activated) {
        return false;
      }
      toast.success("Organization created.");
      router.replace("/onboarding?mode=organization");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Could not create organization.");
      return false;
    } finally {
      setIsCreatingOrganization(false);
    }
  };

  const quests = useMemo<QuestItem[]>(() => {
    const hasOrganization = Boolean(activeOrganization);
    const canManageTeamDefaults = Boolean(activeOrganization?.canUpdateTeamSettings);

    return [
      {
        id: "quest-organization",
        label: "Claim your workspace base",
        xp: 40,
        done: hasOrganization,
      },
      {
        id: "quest-currency",
        label: canManageTeamDefaults ? "Set organization currency" : "Currency inherited from admin",
        xp: 30,
        done: canManageTeamDefaults ? Boolean(organizationCurrency) : hasOrganization,
      },
      {
        id: "quest-timezone",
        label: canManageTeamDefaults ? "Set organization timezone" : "Timezone inherited from admin",
        xp: 30,
        done: canManageTeamDefaults ? organizationTimezone.trim().length > 0 : hasOrganization,
      },
      {
        id: "quest-org-image",
        label: canManageTeamDefaults ? "Add organization image" : "Organization image handled by admin",
        xp: 20,
        done: canManageTeamDefaults ? Boolean(organization?.imageUrl) : hasOrganization,
      },
      {
        id: "quest-extension",
        label: "Set up Chrome Clipper",
        xp: 20,
        done: extensionReady,
      },
    ];
  }, [activeOrganization, extensionReady, organization?.imageUrl, organizationCurrency, organizationTimezone]);

  const xpTotal = useMemo(() => quests.reduce((sum, quest) => sum + quest.xp, 0), [quests]);
  const xpEarned = useMemo(
    () => quests.reduce((sum, quest) => sum + (quest.done ? quest.xp : 0), 0),
    [quests],
  );
  const level = xpEarned >= 100 ? 3 : xpEarned >= 60 ? 2 : 1;
  const canSubmit =
    Boolean(activeOrganization) &&
    quests
      .filter((quest) => quest.id !== "quest-org-image" && quest.id !== "quest-extension")
      .every((quest) => quest.done);

  const bonusQuestCount = quests.filter(
    (quest) => quest.id === "quest-org-image" || quest.id === "quest-extension",
  ).length;
  const completedBonusQuestCount = quests.filter(
    (quest) => (quest.id === "quest-org-image" || quest.id === "quest-extension") && quest.done,
  ).length;

  const handleOrganizationImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    event.target.value = "";

    if (!organization || !activeOrganization || !canUpdateOrganization) {
      toast.error("Organization image can only be updated by an admin.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5 MB.");
      return;
    }

    setIsUploadingOrganizationImage(true);
    try {
      const updatedOrganization = await organization.setLogo({ file });
      const updatedImageUrl = updatedOrganization.imageUrl || "";
      setOrganizationImagePreviewUrl(updatedImageUrl);

      await updateTeamSettings({
        teamId: activeOrganization.teamId,
        imageUrl: updatedImageUrl,
      });

      toast.success("Organization image updated.");
      appendChat("assistant", "Organization image saved. Branding mission complete.");
    } catch (error) {
      console.error(error);
      toast.error("Could not update organization image.");
      appendChat("assistant", "Organization image upload failed. Retry with a smaller PNG, JPG, or WebP file.");
    } finally {
      setIsUploadingOrganizationImage(false);
    }
  };

  const openOrganizationImagePicker = () => {
    organizationImageInputRef.current?.click();
  };

  const openExtensionAuth = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.open("/auth/extension", "_blank", "noopener,noreferrer");
  };

  const finishOnboarding = async () => {
    if (!activeOrganization) {
      toast.error("Create your organization first.");
      return false;
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
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Could not save organization onboarding.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const systemMessages = useMemo<ChatEntry[]>(() => {
    const messages: ChatEntry[] = [
      {
        id: "system-greeting",
        role: "assistant",
        content:
          "Hi, I am Vibe Coach. We will finish onboarding like a short questline. Complete missions, earn XP, unlock your workspace.",
      },
    ];

    if (!activeOrganization) {
      messages.push({
        id: "system-no-organization",
        role: "assistant",
        content: "Mission 1: create your organization. Type a name and run 'Create organization now'.",
      });
      return messages;
    }

    messages.push({
      id: "system-organization-ready",
      role: "user",
      content: `Organization connected: ${activeOrganization.teamName}`,
    });

    if (canUpdateOrganization) {
      messages.push({
        id: "system-admin-flow",
        role: "assistant",
        content: "Mission 2 and 3: set currency and timezone for the whole team. I can auto-detect both.",
      });
    } else {
      messages.push({
        id: "system-member-flow",
        role: "assistant",
        content:
          "You are in member mode. Team defaults come from an admin, so your final mission is to launch the workspace.",
      });
    }

    if (canSubmit && completedBonusQuestCount < bonusQuestCount) {
      messages.push({
        id: "system-bonus-track",
        role: "assistant",
        content: "Workspace is unlockable now. Two bonus missions remain: upload the organization image and prep Chrome Clipper.",
      });
    }

    if (canSubmit) {
      messages.push({
        id: "system-ready-to-launch",
        role: "assistant",
        content:
          completedBonusQuestCount < bonusQuestCount
            ? "Core launch is ready. Enter dashboard now, or finish the bonus missions for a full setup."
            : "All missions complete. Run 'Finish onboarding' to enter dashboard.",
      });
    }

    return messages;
  }, [activeOrganization, bonusQuestCount, canSubmit, canUpdateOrganization, completedBonusQuestCount]);

  useEffect(() => {
    if (!activeOrganization) {
      announcedOrganizationIdRef.current = null;
      return;
    }

    const teamId = String(activeOrganization.teamId);
    if (announcedOrganizationIdRef.current === teamId) {
      return;
    }

    announcedOrganizationIdRef.current = teamId;
    appendChat("assistant", `Great. ${activeOrganization.teamName} is online. XP boosted.`);
  }, [activeOrganization]);

  useEffect(() => {
    if (!canSubmit || completionHintShownRef.current) {
      return;
    }

    completionHintShownRef.current = true;
    appendChat(
      "assistant",
      completedBonusQuestCount < bonusQuestCount
        ? "Core launch quests complete. You can enter dashboard now or finish the bonus track first."
        : "Questline complete. Press Finish onboarding and I will route you to dashboard.",
    );
  }, [bonusQuestCount, canSubmit, completedBonusQuestCount]);

  const runAssistantAction = async (
    action: "create_org" | "detect_currency" | "sync_timezone" | "add_org_image" | "extension" | "finish",
    options: { echoUserMessage?: boolean } = {},
  ) => {
    const echoUserMessage = options.echoUserMessage ?? true;

    if (action === "create_org") {
      if (echoUserMessage) {
        appendChat("user", "Create organization now");
      }
      const created = await createAndActivateOrganization();
      if (!created) {
        appendChat("assistant", "I could not create the organization. Check the name and try again.");
      }
      return;
    }

    if (action === "detect_currency") {
      if (!activeOrganization) {
        appendChat("assistant", "Create organization first, then I can sync currency.");
        return;
      }
      if (echoUserMessage) {
        appendChat("user", "Detect currency from my locale");
      }
      detectOrganizationCurrency();
      appendChat("assistant", "Currency updated from your locale and timezone signals.");
      return;
    }

    if (action === "sync_timezone") {
      if (!activeOrganization) {
        appendChat("assistant", "Create organization first, then I can sync timezone.");
        return;
      }
      if (echoUserMessage) {
        appendChat("user", "Use my browser timezone");
      }
      const timezone = detectTimezone();
      setOrganizationTimezone(timezone);
      appendChat("assistant", `Timezone set to ${timezone}.`);
      return;
    }

    if (action === "add_org_image") {
      if (echoUserMessage) {
        appendChat("user", "Add organization image");
      }
      if (!canUpdateOrganization) {
        appendChat("assistant", "Only an admin can upload the organization image.");
        return;
      }
      openOrganizationImagePicker();
      appendChat("assistant", "Choose one logo or image file. I will sync it to the Clerk organization and sidebar.");
      return;
    }

    if (action === "extension") {
      if (echoUserMessage) {
        appendChat("user", "Set up Chrome Clipper");
      }
      openExtensionAuth();
      appendChat("assistant", "I opened extension auth in a new tab. Once it succeeds, this quest will complete automatically.");
      return;
    }

    if (echoUserMessage) {
      appendChat("user", "Finish onboarding");
    }
    const finished = await finishOnboarding();
    if (!finished) {
      appendChat("assistant", "Finish failed. I kept your progress, so retry once the issue is fixed.");
    }
  };

  const handleChatSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = chatInput.trim();
    if (!text) {
      return;
    }

    setChatInput("");
    appendChat("user", text);

    const normalized = text.toLowerCase();
    if (normalized.includes("currency") || normalized.includes("walut")) {
      await runAssistantAction("detect_currency", { echoUserMessage: false });
      return;
    }

    if (normalized.includes("timezone") || normalized.includes("stref")) {
      await runAssistantAction("sync_timezone", { echoUserMessage: false });
      return;
    }

    if (normalized.includes("logo") || normalized.includes("image") || normalized.includes("zdjec")) {
      await runAssistantAction("add_org_image", { echoUserMessage: false });
      return;
    }

    if (
      normalized.includes("create") ||
      normalized.includes("utworz") ||
      normalized.includes("organiz")
    ) {
      await runAssistantAction("create_org", { echoUserMessage: false });
      return;
    }

    if (normalized.includes("extension") || normalized.includes("clipper") || normalized.includes("wtycz")) {
      await runAssistantAction("extension", { echoUserMessage: false });
      return;
    }

    if (
      normalized.includes("finish") ||
      normalized.includes("done") ||
      normalized.includes("gotowe") ||
      normalized.includes("zakoncz")
    ) {
      await runAssistantAction("finish", { echoUserMessage: false });
      return;
    }

    if (!activeOrganization) {
      appendChat("assistant", "Start with Mission 1: create organization, then I unlock the next quests.");
      return;
    }

    if (!canSubmit) {
      appendChat("assistant", "You are close. Complete remaining quests from the mission panel on the right.");
      return;
    }

    appendChat("assistant", "Everything is ready. Use Finish onboarding to enter dashboard.");
  };

  if (!isAuthLoaded || !isSignedIn || onboardingStatus === undefined || !initialized) {
    return <LoadingState message="Preparing onboarding..." />;
  }

  if (!isForcedOrganizationSetup && onboardingStatus.completed && activeOrganization) {
    return <LoadingState message="Redirecting to workspace..." />;
  }

  const allMessages = [...systemMessages, ...chatHistory];
  const isBusy = isSaving || isCreatingOrganization || isUploadingOrganizationImage;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/35 px-4 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Card className="border-border/60 bg-background/90">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-2">
              <Badge variant="secondary" className="w-fit">
                <Sparkles className="mr-1 h-3 w-3" />
                {isForcedOrganizationSetup ? "Organization Re-Setup" : "AI Quest Onboarding"}
              </Badge>
              <CardTitle className="text-2xl">Launch your workspace with Vibe Coach</CardTitle>
              <CardDescription>
                Chat-first onboarding with mission progress. Same backend logic, faster completion.
              </CardDescription>
            </div>
            <Bot className="size-8 text-primary" />
          </CardHeader>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          <Card className="border-border/70">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquareText className="h-4 w-4" />
                AI onboarding chat
              </div>
              <CardTitle className="text-xl">Vibe Coach</CardTitle>
              <CardDescription>
                Use quick actions or type commands like: create organization, detect currency, set timezone, add logo, extension, finish.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="max-h-[420px] min-h-[320px] overflow-y-auto rounded-2xl border bg-muted/25 p-4">
                <div className="space-y-3">
                  {allMessages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.role === "assistant" ? "justify-start" : "justify-end",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                          message.role === "assistant"
                            ? "border border-primary/25 bg-primary/10 text-foreground"
                            : "bg-primary text-primary-foreground",
                        )}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {!activeOrganization ? (
                <div className="space-y-2 rounded-xl border bg-muted/25 p-3">
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
              ) : null}

              <input
                ref={organizationImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleOrganizationImageChange}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => runAssistantAction("create_org")}
                  disabled={Boolean(activeOrganization) || isBusy || !organizationListLoaded}
                >
                  Create organization now
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => runAssistantAction("detect_currency")}
                  disabled={!activeOrganization || !canUpdateOrganization || isBusy}
                >
                  Detect currency
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => runAssistantAction("sync_timezone")}
                  disabled={!activeOrganization || !canUpdateOrganization || isBusy}
                >
                  Use browser timezone
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => runAssistantAction("add_org_image")}
                  disabled={!activeOrganization || !canUpdateOrganization || isBusy}
                >
                  {organization?.imageUrl ? "Replace logo" : "Add logo"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => runAssistantAction("extension")}
                  disabled={isBusy || extensionReady}
                >
                  {extensionReady ? "Clipper ready" : "Chrome Clipper"}
                </Button>
                <Button
                  type="button"
                  onClick={() => runAssistantAction("finish")}
                  disabled={!canSubmit || isBusy}
                >
                  Finish onboarding
                </Button>
              </div>

              <form onSubmit={handleChatSubmit} className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Type a command for Vibe Coach..."
                  disabled={isBusy}
                />
                <Button type="submit" disabled={isBusy || chatInput.trim().length === 0}>
                  Send
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Swords className="h-4 w-4" />
                Mission progress
              </div>
              <CardTitle className="text-xl">Onboarding Questline</CardTitle>
              <CardDescription>
                Complete the core quests to unlock the dashboard. Bonus quests tighten the setup.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3 rounded-xl border bg-muted/25 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Level {level}</div>
                  <Badge variant="secondary">
                    <Trophy className="mr-1 h-3 w-3" />
                    {xpEarned}/{xpTotal} XP
                  </Badge>
                </div>
                <Progress value={xpEarned} max={xpTotal} />
              </div>

              <div className="space-y-2">
                {quests.map((quest) => (
                  <div
                    key={quest.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
                      quest.done ? "border-primary/35 bg-primary/5" : "bg-background",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={quest.done ? "default" : "outline"}>
                        {quest.done ? "Done" : "Open"}
                      </Badge>
                      <span>{quest.label}</span>
                    </div>
                    <span className="text-muted-foreground">+{quest.xp} XP</span>
                  </div>
                ))}
              </div>

              {activeOrganization ? (
                <div className="space-y-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                  <div className="mb-1 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span className="font-medium">{activeOrganization.teamName}</span>
                    <Badge variant="outline">{activeOrganization.role}</Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {canUpdateOrganization
                      ? "Admin mode: you can set team defaults."
                      : "Member mode: defaults are managed by your admin."}
                  </p>
                </div>
              ) : null}

              {activeOrganization && canUpdateOrganization ? (
                <div className="space-y-4 rounded-xl border p-4">
                  <div className="space-y-2">
                    <Label htmlFor="currency" className="text-sm font-medium">
                      <Coins className="mr-2 inline h-4 w-4" />
                      Organization currency
                    </Label>
                    <div className="flex max-w-full gap-2">
                      <Select
                        value={organizationCurrency}
                        onValueChange={(value) => setOrganizationCurrency(value as CurrencyCode)}
                      >
                        <SelectTrigger id="currency" className="w-[320px] max-w-full flex-1">
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

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      <Clock3 className="mr-2 inline h-4 w-4" />
                      Organization timezone
                    </Label>
                    <TimezonePicker
                      value={organizationTimezone}
                      onValueChange={setOrganizationTimezone}
                      className="w-[320px] max-w-full"
                    />
                  </div>
                </div>
              ) : null}

              {activeOrganization ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3 rounded-xl border p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Camera className="h-4 w-4" />
                      Organization image
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Upload the image shown for your Clerk organization and workspace sidebar.
                    </p>
                    {organizationImagePreviewUrl ? (
                      <img
                        src={organizationImagePreviewUrl}
                        alt="Organization preview"
                        className="h-36 w-full rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-36 items-center justify-center rounded-xl border border-dashed bg-muted/20 text-sm text-muted-foreground">
                        No organization image yet
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">
                        {organization?.imageUrl ? "Synced with Clerk organization" : "PNG, JPG, WebP up to 5 MB"}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={openOrganizationImagePicker}
                        disabled={!canUpdateOrganization || isUploadingOrganizationImage}
                      >
                        {isUploadingOrganizationImage
                          ? "Uploading..."
                          : organization?.imageUrl
                            ? "Replace image"
                            : "Add image"}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-xl border p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Puzzle className="h-4 w-4" />
                      Chrome Clipper
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Load the unpacked extension from `chrome-extension/dist`, then connect it to your account.
                    </p>
                    <div className="space-y-2 rounded-xl bg-muted/20 p-3 text-sm text-muted-foreground">
                      <p>1. Build or open `chrome-extension/dist`.</p>
                      <p>2. Load it in `chrome://extensions`.</p>
                      <p>3. Open extension auth and confirm setup.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={openExtensionAuth}>
                        Open extension auth
                      </Button>
                      <div className="flex items-center rounded-xl border px-3 text-sm text-muted-foreground">
                        {extensionReady ? (
                          <>
                            <Check className="mr-2 h-4 w-4 text-primary" />
                            Connected
                          </>
                        ) : (
                          "Quest completes after auth succeeds"
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <Button type="button" onClick={finishOnboarding} disabled={!canSubmit || isSaving} className="w-full">
                {isSaving ? "Saving..." : completedBonusQuestCount < bonusQuestCount ? "Launch workspace" : "Finish onboarding"}
              </Button>
            </CardContent>
          </Card>
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
