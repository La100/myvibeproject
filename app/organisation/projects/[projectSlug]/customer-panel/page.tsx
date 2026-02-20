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

type PortalPermissionKey =
  | "overview"
  | "tasks"
  | "moodboard"
  | "notes"
  | "contacts"
  | "surveys"
  | "calendar"
  | "files"
  | "shopping_list"
  | "labor"
  | "estimations";

type PortalPermissions = Record<PortalPermissionKey, { visible: boolean }>;

const portalSections: Array<{ key: PortalPermissionKey; label: string; description: string }> = [
  { key: "overview", label: "Overview", description: "Project overview and summary" },
  { key: "tasks", label: "Tasks", description: "Task list and progress" },
  { key: "moodboard", label: "Moodboard", description: "Visual references and inspirations" },
  { key: "notes", label: "Notes", description: "Project notes and documentation" },
  { key: "contacts", label: "Contacts", description: "Client and stakeholder contacts" },
  { key: "surveys", label: "Surveys", description: "Client questionnaires and responses" },
  { key: "calendar", label: "Calendar", description: "Timeline and planning" },
  { key: "files", label: "Files", description: "Project files and assets" },
  { key: "shopping_list", label: "Materials", description: "Material list and procurement" },
  { key: "labor", label: "Labor", description: "Work scope and labor entries" },
  { key: "estimations", label: "Estimations", description: "Cost estimations and quotes" },
];

const getEmptyPortalPermissions = (): PortalPermissions => ({
  overview: { visible: false },
  tasks: { visible: false },
  moodboard: { visible: false },
  notes: { visible: false },
  contacts: { visible: false },
  surveys: { visible: false },
  calendar: { visible: false },
  files: { visible: false },
  shopping_list: { visible: false },
  labor: { visible: false },
  estimations: { visible: false },
});

export default function CustomerPanelPage() {
  const { project, permissions, isLoading } = useProject();
  const panelConfig = useQuery(
    apiAny.projects.getClientPanelConfiguration,
    isLoading ? "skip" : { projectId: project._id }
  );
  const portalConfig = useQuery(
    apiAny.projects.getClientPortalConfiguration,
    isLoading ? "skip" : { projectId: project._id }
  );
  const ensureClientPanelAccessToken = useMutation(apiAny.projects.ensureClientPanelAccessToken);
  const regenerateClientPanelAccessToken = useMutation(apiAny.projects.regenerateClientPanelAccessToken);
  const updatePortalPermissions = useMutation(apiAny.projects.updateProjectSidebarPermissions);
  const publishClientPortal = useMutation(apiAny.projects.publishClientPortal);

  const [accessToken, setAccessToken] = useState("");
  const [isPreparingLink, setIsPreparingLink] = useState(false);
  const [isRegeneratingLink, setIsRegeneratingLink] = useState(false);
  const [portalPermissions, setPortalPermissions] = useState<PortalPermissions>(
    getEmptyPortalPermissions()
  );
  const [hasPortalChanges, setHasPortalChanges] = useState(false);
  const [isSavingPortalDraft, setIsSavingPortalDraft] = useState(false);
  const [isPublishingPortal, setIsPublishingPortal] = useState(false);

  const canManageCustomerPanel =
    permissions?.userRole === "admin" || permissions?.userRole === "member";

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

  useEffect(() => {
    if (!portalConfig?.draftPermissions || hasPortalChanges) {
      return;
    }

    // New projects should start with all modules disabled by default.
    if (!project.sidebarPermissions && (portalConfig.version || 0) === 0) {
      setPortalPermissions(getEmptyPortalPermissions());
      return;
    }

    setPortalPermissions({
      overview: { visible: portalConfig.draftPermissions.overview?.visible ?? false },
      tasks: { visible: portalConfig.draftPermissions.tasks?.visible ?? false },
      moodboard: { visible: portalConfig.draftPermissions.moodboard?.visible ?? false },
      notes: { visible: portalConfig.draftPermissions.notes?.visible ?? false },
      contacts: { visible: portalConfig.draftPermissions.contacts?.visible ?? false },
      surveys: { visible: portalConfig.draftPermissions.surveys?.visible ?? false },
      calendar: { visible: portalConfig.draftPermissions.calendar?.visible ?? false },
      files: { visible: portalConfig.draftPermissions.files?.visible ?? false },
      shopping_list: { visible: portalConfig.draftPermissions.shopping_list?.visible ?? false },
      labor: { visible: portalConfig.draftPermissions.labor?.visible ?? false },
      estimations: { visible: portalConfig.draftPermissions.estimations?.visible ?? false },
    });
  }, [hasPortalChanges, portalConfig?.draftPermissions, portalConfig?.version, project.sidebarPermissions]);

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

  const handlePortalPermissionChange = (key: PortalPermissionKey, visible: boolean) => {
    setPortalPermissions((prev) => ({
      ...prev,
      [key]: { visible },
    }));
    setHasPortalChanges(true);
  };

  const handleSavePortalDraft = async (silent = false) => {
    setIsSavingPortalDraft(true);
    try {
      await updatePortalPermissions({
        projectId: project._id,
        sidebarPermissions: portalPermissions,
      });
      setHasPortalChanges(false);
      if (!silent) {
        toast.success("Portal draft saved");
      }
      return true;
    } catch (error) {
      if (!silent) {
        toast.error("Failed to save portal draft", {
          description: (error as Error).message,
        });
      }
      return false;
    } finally {
      setIsSavingPortalDraft(false);
    }
  };

  const handlePublishPortal = async () => {
    setIsPublishingPortal(true);
    try {
      if (hasPortalChanges) {
        const saved = await handleSavePortalDraft(true);
        if (!saved) {
          throw new Error("Save draft failed");
        }
      }
      const result = await publishClientPortal({ projectId: project._id });
      toast.success("Client portal updated", {
        description: `Published version #${result.version}.`,
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
        <p className="text-sm text-muted-foreground">Loading customer panel...</p>
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
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Client Portal Modules</h2>
          <p className="text-sm text-muted-foreground">
            Choose what clients can see. Save draft, then publish.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleSavePortalDraft()}
            disabled={isSavingPortalDraft || !hasPortalChanges}
          >
            {isSavingPortalDraft ? "Saving..." : "Save draft"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handlePublishPortal}
            disabled={isPublishingPortal}
          >
            {isPublishingPortal ? "Updating..." : "Update portal"}
          </Button>
        </div>
      </div>

      {/* Portal Modules */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Version: #{portalConfig?.version || 0}
          </p>
        </div>

        <div className="space-y-4 rounded-lg border bg-card p-6">
          {portalSections.map((section) => (
            <div
              key={section.key}
              className="flex items-center justify-between"
            >
              <div className="pr-4">
                <Label
                  htmlFor={`portal-${section.key}`}
                  className="text-sm font-medium"
                >
                  {section.label}
                </Label>
                <p className="text-xs text-muted-foreground">{section.description}</p>
              </div>
              <Switch
                id={`portal-${section.key}`}
                checked={portalPermissions[section.key]?.visible ?? false}
                onCheckedChange={(checked) => handlePortalPermissionChange(section.key, checked)}
              />
            </div>
          ))}

        </div>
      </section>

      {/* Customer Link */}
      <section className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Customer Link</h2>
          <p className="text-sm text-muted-foreground">
            Share this link directly with a customer. This view contains only shopping list choices.
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
              Open panel
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
