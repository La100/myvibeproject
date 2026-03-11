"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import { ProjectApprovalsManager } from "@/components/project/ProjectApprovalsManager";

const DEFAULT_CLIENT_PANEL_SETTINGS = {
  showShoppingList: false,
  showFiles: false,
  showMoodboard: false,
  showSurveys: false,
  showTasks: false,
  showLabor: false,
  showContacts: false,
  showBudget: false,
  showPayments: false,
  showApprovals: false,
  showNotes: true,
  showSupplier: true,
  showPrice: true,
};

type ClientPanelSettings = typeof DEFAULT_CLIENT_PANEL_SETTINGS;

export default function CustomerPanelPage() {
  const { project, teamMember, isLoading } = useProject();
  const panelConfig = useQuery(
    apiAny.projects.getClientPanelConfiguration,
    isLoading ? "skip" : { projectId: project._id }
  );
  const ensureClientPanelAccessToken = useMutation(apiAny.projects.ensureClientPanelAccessToken);
  const regenerateClientPanelAccessToken = useMutation(apiAny.projects.regenerateClientPanelAccessToken);
  const publishClientPanelData = useMutation(apiAny.projects.publishClientPanelData);

  const [accessToken, setAccessToken] = useState("");
  const [isPreparingLink, setIsPreparingLink] = useState(false);
  const [isRegeneratingLink, setIsRegeneratingLink] = useState(false);
  const [isPublishingPortal, setIsPublishingPortal] = useState(false);
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
            description: (error as Error).message,
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
        description: (error as Error).message,
      });
    } finally {
      setIsRegeneratingLink(false);
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
        description: (error as Error).message,
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
    <div className="space-y-10">
      <ProjectPageHeader
        title="Client Portal"
        icon={<ExternalLink className="h-8 w-8 text-[var(--ui-accent-brand)]" />}
        subtitle={
          <>
            Publish the latest portal data for the public client link.
            <span className="mt-1 block text-xs">Portal version: #{panelConfig?.version || 0}</span>
          </>
        }
        actions={
          <Button
            type="button"
            size="sm"
            onClick={handlePublishPortal}
            disabled={isPublishingPortal}
          >
            {isPublishingPortal ? "Updating..." : "Update portal"}
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-2xl space-y-10">
      <section className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Visibility</h2>
          <p className="text-sm text-muted-foreground">
            Choose what customers can see in the portal after Update portal.
          </p>
        </div>

        <div className="space-y-6 rounded-lg border bg-card p-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground">Portal sections</h3>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="show-shopping-list" className="font-medium">
                    Shopping List
                  </Label>
                  <p className="text-xs text-muted-foreground">Share products and alternatives.</p>
                </div>
                <Switch
                  id="show-shopping-list"
                  checked={portalSettings.showShoppingList}
                  onCheckedChange={(checked) => handleToggleSetting("showShoppingList", checked)}
                  disabled={isPublishingPortal}
                />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="show-files" className="font-medium">
                    Files
                  </Label>
                  <p className="text-xs text-muted-foreground">Share files marked for client portal.</p>
                </div>
                <Switch
                  id="show-files"
                  checked={portalSettings.showFiles}
                  onCheckedChange={(checked) => handleToggleSetting("showFiles", checked)}
                  disabled={isPublishingPortal}
                />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="show-moodboard" className="font-medium">
                    Moodboard
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Share moodboard visuals saved in project files.
                  </p>
                </div>
                <Switch
                  id="show-moodboard"
                  checked={portalSettings.showMoodboard}
                  onCheckedChange={(checked) => handleToggleSetting("showMoodboard", checked)}
                  disabled={isPublishingPortal}
                />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="show-surveys" className="font-medium">
                    Surveys
                  </Label>
                  <p className="text-xs text-muted-foreground">Allow customers to submit surveys.</p>
                </div>
                <Switch
                  id="show-surveys"
                  checked={portalSettings.showSurveys}
                  onCheckedChange={(checked) => handleToggleSetting("showSurveys", checked)}
                  disabled={isPublishingPortal}
                />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="show-tasks" className="font-medium">
                    Tasks
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Share task list and statuses.
                  </p>
                </div>
                <Switch
                  id="show-tasks"
                  checked={portalSettings.showTasks}
                  onCheckedChange={(checked) => handleToggleSetting("showTasks", checked)}
                  disabled={isPublishingPortal}
                />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="show-labor" className="font-medium">
                    Labor
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Share labor/services list with pricing.
                  </p>
                </div>
                <Switch
                  id="show-labor"
                  checked={portalSettings.showLabor}
                  onCheckedChange={(checked) => handleToggleSetting("showLabor", checked)}
                  disabled={isPublishingPortal}
                />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="show-contacts" className="font-medium">
                    Contacts
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Share assigned project contacts.
                  </p>
                </div>
                <Switch
                  id="show-contacts"
                  checked={portalSettings.showContacts}
                  onCheckedChange={(checked) => handleToggleSetting("showContacts", checked)}
                  disabled={isPublishingPortal}
                />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="show-budget" className="font-medium">
                    Budget
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Show project budget in the client portal.
                  </p>
                </div>
                <Switch
                  id="show-budget"
                  checked={portalSettings.showBudget}
                  onCheckedChange={(checked) => handleToggleSetting("showBudget", checked)}
                  disabled={isPublishingPortal}
                />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="show-payments" className="font-medium">
                    Payments
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Share Stripe installments and payment links.
                  </p>
                </div>
                <Switch
                  id="show-payments"
                  checked={portalSettings.showPayments}
                  onCheckedChange={(checked) => handleToggleSetting("showPayments", checked)}
                  disabled={isPublishingPortal}
                />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="show-approvals" className="font-medium">
                    Approvals
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Let clients review and formally approve decision requests.
                  </p>
                </div>
                <Switch
                  id="show-approvals"
                  checked={portalSettings.showApprovals}
                  onCheckedChange={(checked) => handleToggleSetting("showApprovals", checked)}
                  disabled={isPublishingPortal}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Portal Link</h2>
          <p className="text-sm text-muted-foreground">
            Share this link directly with a customer. The portal refreshes after Update portal.
          </p>
        </div>

        <div className="space-y-4 rounded-lg border bg-card p-6">
          <Input value={panelUrlValue || (isPreparingLink ? "Preparing link..." : "")} readOnly />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={handleCopyLink} disabled={!panelUrlValue || isPreparingLink}>
              <Copy className="mr-2 h-4 w-4" />
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
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open portal
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRegenerateLink}
              disabled={!panelUrlValue || isRegeneratingLink || isPreparingLink}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {isRegeneratingLink ? "Regenerating..." : "Regenerate link"}
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Approval Summary</h2>
          <p className="text-sm text-muted-foreground">
            Current approval workflow status for this project.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border bg-card p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pending</p>
            <p className="mt-2 text-2xl font-semibold">{panelConfig?.approvalSummary?.pendingCount || 0}</p>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Approved</p>
            <p className="mt-2 text-2xl font-semibold">{panelConfig?.approvalSummary?.approvedCount || 0}</p>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Rejected</p>
            <p className="mt-2 text-2xl font-semibold">{panelConfig?.approvalSummary?.rejectedCount || 0}</p>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Drafts</p>
            <p className="mt-2 text-2xl font-semibold">{panelConfig?.approvalSummary?.draftCount || 0}</p>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <ProjectApprovalsManager />
      </section>
      </div>
    </div>
  );
}
