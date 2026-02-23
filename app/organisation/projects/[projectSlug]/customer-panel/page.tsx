"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEFAULT_CLIENT_PANEL_SETTINGS = {
  showNotes: true,
  showSupplier: true,
  showPrice: true,
};

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

  const canManageCustomerPanel =
    teamMember?.role === "admin" || teamMember?.role === "member";

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
  }, [panelConfig]);

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
        settings: panelConfig?.settings ?? DEFAULT_CLIENT_PANEL_SETTINGS,
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

  if (!canManageCustomerPanel) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-center">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="text-muted-foreground">
            Only admins and members can manage customer links.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Client Portal</h2>
          <p className="text-sm text-muted-foreground">
            Publish the latest portal data for the public client link.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Portal version: #{panelConfig?.version || 0}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handlePublishPortal}
          disabled={isPublishingPortal}
        >
          {isPublishingPortal ? "Updating..." : "Update portal"}
        </Button>
      </div>

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
    </div>
  );
}
