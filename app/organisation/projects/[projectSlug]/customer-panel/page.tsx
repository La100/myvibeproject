"use client";

import { ReactNode, useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ClipboardList,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  Files,
  ImageIcon,
  ListTodo,
  Mail,
  RefreshCw,
  ShoppingBag,
  SquareUserRound,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";
import { Badge } from "@/components/ui/badge";
import { apiAny } from "@/lib/convexApiAny";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { useProject } from "@/components/providers/ProjectProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const DEFAULT_CLIENT_PANEL_SETTINGS = {
  showShoppingList: false,
  allowShoppingItemDecisions: true,
  allowShoppingItemComments: true,
  showFiles: false,
  showMoodboard: false,
  showSurveys: false,
  showTasks: false,
  showLabor: false,
  showContacts: false,
  showBudget: false,
  showPayments: false,
  showNotes: true,
  showSupplier: true,
  showPrice: true,
};

type ClientPanelSettings = typeof DEFAULT_CLIENT_PANEL_SETTINGS;

type FeatureCardConfig = {
  key: keyof ClientPanelSettings;
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
};

const PRIMARY_FEATURE_CARDS: FeatureCardConfig[] = [
  {
    key: "showLabor",
    id: "show-labor",
    title: "Labor",
    description: "Services list with pricing.",
    icon: <Wrench className="h-5 w-5" />,
  },
  {
    key: "showContacts",
    id: "show-contacts",
    title: "Contacts",
    description: "Assigned project contacts.",
    icon: <SquareUserRound className="h-5 w-5" />,
  },
  {
    key: "showBudget",
    id: "show-budget",
    title: "Budget",
    description: "Project budget overview.",
    icon: <ClipboardList className="h-5 w-5" />,
  },
  {
    key: "showPayments",
    id: "show-payments",
    title: "Payments",
    description: "Stripe installments and payment links.",
    icon: <CreditCard className="h-5 w-5" />,
  },
];

const SHOPPING_LIST_FEATURE_CARD: FeatureCardConfig = {
  key: "showShoppingList",
  id: "show-shopping-list",
  title: "Shopping List",
  description: "Products, options, and alternative groups.",
  icon: <ShoppingBag className="h-5 w-5" />,
};

const SECONDARY_FEATURE_CARDS: FeatureCardConfig[] = [
  {
    key: "showFiles",
    id: "show-files",
    title: "Files",
    description: "Files marked for the client portal.",
    icon: <Files className="h-5 w-5" />,
  },
  {
    key: "showMoodboard",
    id: "show-moodboard",
    title: "Moodboard",
    description: "Saved visuals and references.",
    icon: <ImageIcon className="h-5 w-5" />,
  },
  {
    key: "showSurveys",
    id: "show-surveys",
    title: "Surveys",
    description: "Forms customers can open and submit.",
    icon: <FileText className="h-5 w-5" />,
  },
  {
    key: "showTasks",
    id: "show-tasks",
    title: "Tasks",
    description: "Project task list and statuses.",
    icon: <ListTodo className="h-5 w-5" />,
  },
];

const REGULAR_FEATURE_CARDS = [...PRIMARY_FEATURE_CARDS, ...SECONDARY_FEATURE_CARDS];

const FLAT_PRIMARY_BUTTON_CLASSNAME =
  "rounded-full bg-primary/92 text-primary-foreground shadow-none hover:bg-primary/92 focus-visible:ring-0 active:translate-y-0";

const PORTAL_SWITCH_CLASSNAME =
  "h-7 w-12 border-0 bg-slate-300/90 p-1 shadow-none data-[state=checked]:bg-primary data-[state=unchecked]:bg-slate-300/90";

export default function CustomerPanelPage() {
  const { project, teamMember, isLoading } = useProject();
  const panelConfig = useQuery(
    apiAny.projects.getClientPanelConfiguration,
    isLoading ? "skip" : { projectId: project._id }
  );
  const ensureClientPanelAccessToken = useMutation(apiAny.projects.ensureClientPanelAccessToken);
  const regenerateClientPanelAccessToken = useMutation(apiAny.projects.regenerateClientPanelAccessToken);
  const publishClientPanelData = useMutation(apiAny.projects.publishClientPanelData);
  const sendClientPortalLinkEmail = useAction(apiAny.clientPortalActions.sendClientPortalLinkEmail);

  const [accessToken, setAccessToken] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [isPreparingLink, setIsPreparingLink] = useState(false);
  const [isRegeneratingLink, setIsRegeneratingLink] = useState(false);
  const [isPublishingPortal, setIsPublishingPortal] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [portalSettings, setPortalSettings] = useState<ClientPanelSettings>(
    DEFAULT_CLIENT_PANEL_SETTINGS
  );

  const canManageCustomerPanel = !!teamMember;

  useEffect(() => {
    if (isLoading || !canManageCustomerPanel) {
      return;
    }

    let cancelled = false;

    const loadToken = async () => {
      setIsPreparingLink(true);
      try {
        const result = await ensureClientPanelAccessToken({ projectId: project._id });
        if (!cancelled) {
          setAccessToken(result.token);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error("Failed to prepare customer link", {
            description: toUserFacingErrorMessage(error),
          });
        }
      } finally {
        if (!cancelled) {
          setIsPreparingLink(false);
        }
      }
    };

    void loadToken();

    return () => {
      cancelled = true;
    };
  }, [canManageCustomerPanel, ensureClientPanelAccessToken, isLoading, project._id]);

  useEffect(() => {
    if (!panelConfig) return;
    if (panelConfig.accessToken) {
      setAccessToken(panelConfig.accessToken);
    }
    setPortalSettings({
      ...DEFAULT_CLIENT_PANEL_SETTINGS,
      ...panelConfig.settings,
    });
  }, [panelConfig]);

  const handleToggleSetting = (key: keyof ClientPanelSettings, checked: boolean) => {
    setPortalSettings((prev) => ({
      ...prev,
      [key]: checked,
    }));
  };

  const panelPath = accessToken ? `/client-panel/${accessToken}` : "";

  const panelUrlValue =
    typeof window !== "undefined" && panelPath
      ? `${window.location.origin}${panelPath}`
      : panelPath;

  const handleCopyLink = async () => {
    if (!panelUrlValue) return;

    try {
      await navigator.clipboard.writeText(panelUrlValue);
      toast.success("Customer link copied");
    } catch {
      toast.error("Failed to copy customer link");
    }
  };

  const handleRegenerateLink = async () => {
    setIsRegeneratingLink(true);
    try {
      const result = await regenerateClientPanelAccessToken({ projectId: project._id });
      setAccessToken(result.token);
      toast.success("Customer link regenerated");
    } catch (error) {
      toast.error("Failed to regenerate customer link", {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setIsRegeneratingLink(false);
    }
  };

  const handleSendLink = async () => {
    const normalizedEmail = recipientEmail.trim();
    if (!normalizedEmail) {
      toast.error("Enter a customer email");
      return;
    }

    setIsSendingEmail(true);
    try {
      await sendClientPortalLinkEmail({
        projectId: project._id,
        recipientEmail: normalizedEmail,
        baseUrl: typeof window !== "undefined" ? window.location.origin : undefined,
      });
      toast.success("Client portal link sent", {
        description: `Email sent to ${normalizedEmail}.`,
      });
    } catch (error) {
      toast.error("Failed to send client portal link", {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handlePublishPortal = async () => {
    setIsPublishingPortal(true);
    try {
      const result = await publishClientPanelData({
        projectId: project._id,
        settings: portalSettings,
      });
      toast.success("Client portal updated", {
        description: `Published portal version #${result.version}.`,
      });
    } catch (error) {
      toast.error("Failed to update client portal", {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setIsPublishingPortal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading portal...</p>
      </div>
    );
  }

  return (
    <ProjectPageLayout>
      <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-7">
        <ProjectPageHeader
          title="Client Portal"
          icon={<ExternalLink className="h-8 w-8 text-primary" />}
          subtitle="Control what your client sees in the portal. Toggle sections, copy the link, and publish when ready."
          tags={
            <>
              <Badge
                variant="outline"
                className="rounded-full border-border/70 bg-white px-3 py-1.5 text-[12px] font-semibold text-foreground"
              >
                v{panelConfig?.version || 0}
              </Badge>
              <Badge
                variant="outline"
                className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-700"
              >
                Live
              </Badge>
            </>
          }
        />

        <SectionBlock
          title="Portal access"
          description="Copy the link, open the portal, regenerate access, or send it by email from one compact row."
        >
          <Card className="gap-0 rounded-[24px] border-border/70 bg-white/85 py-0 shadow-none backdrop-blur-[2px]">
            <CardContent className="grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
              <div className="space-y-4 p-5 lg:border-r lg:border-border/70">
                <div className="space-y-2">
                  <Label htmlFor="customer-portal-url" className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Portal link
                  </Label>
                  <Input
                    id="customer-portal-url"
                    value={panelUrlValue || (isPreparingLink ? "Preparing link..." : "")}
                    readOnly
                    className="h-10 rounded-full bg-background/60 text-sm"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCopyLink}
                    disabled={!panelUrlValue || isPreparingLink}
                    className={FLAT_PRIMARY_BUTTON_CLASSNAME}
                  >
                    <Copy className="h-4 w-4" />
                    Copy link
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!panelPath || typeof window === "undefined") return;
                      window.open(panelPath, "_blank", "noopener,noreferrer");
                    }}
                    disabled={!panelPath || isPreparingLink}
                    className="rounded-full border-border/70 bg-white"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open portal
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerateLink}
                    disabled={!panelUrlValue || isRegeneratingLink || isPreparingLink}
                    className="rounded-full border-border/70 bg-white"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {isRegeneratingLink ? "Regenerating..." : "Regenerate"}
                  </Button>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div className="space-y-2">
                  <Label htmlFor="customer-portal-email" className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Customer email
                  </Label>
                  <Input
                    id="customer-portal-email"
                    type="email"
                    placeholder="client@example.com"
                    value={recipientEmail}
                    onChange={(event) => setRecipientEmail(event.target.value)}
                    disabled={isSendingEmail || isPreparingLink}
                    className="h-10 rounded-full bg-background/60 text-sm"
                  />
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleSendLink}
                  disabled={!panelUrlValue || isSendingEmail || isPreparingLink}
                  className={FLAT_PRIMARY_BUTTON_CLASSNAME}
                >
                  <Mail className="h-4 w-4" />
                  {isSendingEmail ? "Sending..." : "Send link"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </SectionBlock>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Visible sections</h2>
              <p className="text-sm text-muted-foreground">
                Choose what the client sees, then publish those changes to the live portal.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handlePublishPortal}
              disabled={isPublishingPortal}
              className={FLAT_PRIMARY_BUTTON_CLASSNAME}
            >
              {isPublishingPortal ? "Updating..." : "Update portal"}
            </Button>
          </div>

          <ShoppingListFeatureCard
            id={SHOPPING_LIST_FEATURE_CARD.id}
            title={SHOPPING_LIST_FEATURE_CARD.title}
            description={SHOPPING_LIST_FEATURE_CARD.description}
            icon={SHOPPING_LIST_FEATURE_CARD.icon}
            checked={portalSettings.showShoppingList}
            decisionsChecked={portalSettings.allowShoppingItemDecisions}
            commentsChecked={portalSettings.allowShoppingItemComments}
            disabled={isPublishingPortal}
            onCheckedChange={(checked) => handleToggleSetting("showShoppingList", checked)}
            onDecisionsChange={(checked) => handleToggleSetting("allowShoppingItemDecisions", checked)}
            onCommentsChange={(checked) => handleToggleSetting("allowShoppingItemComments", checked)}
          />

          <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
            {REGULAR_FEATURE_CARDS.map((card) => (
              <FeatureCard
                key={card.id}
                id={card.id}
                title={card.title}
                description={card.description}
                icon={card.icon}
                checked={portalSettings[card.key]}
                disabled={isPublishingPortal}
                onCheckedChange={(checked) => handleToggleSetting(card.key, checked)}
              />
            ))}
          </div>
        </section>
      </div>
    </ProjectPageLayout>
  );
}

type SectionBlockProps = {
  title: string;
  description: string;
  children: ReactNode;
};

function SectionBlock({ title, description, children }: SectionBlockProps) {
  return (
    <section className="space-y-2.5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

type FeatureCardProps = {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

function FeatureCard({
  id,
  title,
  description,
  icon,
  checked,
  disabled,
  onCheckedChange,
}: FeatureCardProps) {
  return (
    <Card className="gap-0 rounded-[22px] border-border/70 bg-white/85 shadow-none transition-colors hover:border-foreground/12">
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[15px] border border-border/70 bg-background/70 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </div>
          <Switch
            id={id}
            checked={checked}
            onCheckedChange={onCheckedChange}
            disabled={disabled}
            aria-label={title}
            className={PORTAL_SWITCH_CLASSNAME}
          />
        </div>

        <div className="space-y-1">
          <CardTitle className="text-[15px] leading-5">{title}</CardTitle>
          <CardDescription className="max-w-[24ch] text-[13px] leading-5">
            {description}
          </CardDescription>
        </div>
      </CardContent>
    </Card>
  );
}

type ShoppingListFeatureCardProps = {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  checked: boolean;
  decisionsChecked: boolean;
  commentsChecked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  onDecisionsChange: (checked: boolean) => void;
  onCommentsChange: (checked: boolean) => void;
};

function ShoppingListFeatureCard({
  id,
  title,
  description,
  icon,
  checked,
  decisionsChecked,
  commentsChecked,
  disabled,
  onCheckedChange,
  onDecisionsChange,
  onCommentsChange,
}: ShoppingListFeatureCardProps) {
  const detailDisabled = disabled || !checked;

  return (
    <Card className="gap-0 rounded-[24px] border-border/70 bg-white/88 shadow-none transition-colors hover:border-foreground/12">
      <CardContent className="grid gap-3 p-5 lg:grid-cols-3 lg:items-stretch">
        <div className="flex h-full min-h-[170px] flex-col justify-between gap-4 rounded-[18px] border border-border/70 bg-background/55 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[15px] border border-border/70 bg-background/70 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">
              {icon}
            </div>
            <Switch
              id={id}
              checked={checked}
              onCheckedChange={onCheckedChange}
              disabled={disabled}
              aria-label={title}
              className={PORTAL_SWITCH_CLASSNAME}
            />
          </div>

          <div className="space-y-1">
            <CardTitle className="text-[15px] leading-5">{title}</CardTitle>
            <CardDescription className="max-w-[30ch] text-[13px] leading-5">
              {description}
            </CardDescription>
          </div>
        </div>

        <ShoppingListSettingCard
          id="allow-shopping-item-decisions"
          title="Allow decisions"
          description="Clients can approve or reject items."
          checked={decisionsChecked}
          onCheckedChange={onDecisionsChange}
          disabled={detailDisabled}
        />
        <ShoppingListSettingCard
          id="allow-shopping-item-comments"
          title="Allow comments"
          description="Clients can leave item comments."
          checked={commentsChecked}
          onCheckedChange={onCommentsChange}
          disabled={detailDisabled}
        />
      </CardContent>
    </Card>
  );
}

type ShoppingListSettingCardProps = {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

function ShoppingListSettingCard({
  id,
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: ShoppingListSettingCardProps) {
  return (
    <div className="h-full min-h-[170px] rounded-[18px] border border-border/70 bg-background/55 px-4 py-3">
      <div className="flex h-full items-start justify-between gap-3">
        <div className="space-y-1 pr-4">
          <Label htmlFor={id} className="text-[13px] font-medium text-foreground">
            {title}
          </Label>
          <p className="text-[12px] leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          className={PORTAL_SWITCH_CLASSNAME}
        />
      </div>
    </div>
  );
}
