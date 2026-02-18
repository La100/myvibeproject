"use client";

import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Settings,
  Calendar,
  ShoppingCart,
  CheckSquare,
  Files,
  Eye,
  Save,
  Contact,
  StickyNote,
  Image,
  Hammer,
  Calculator,
  ClipboardList,
  Upload,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

interface SidebarPermissionsProps {
  projectId: Id<"projects">;
}

interface PermissionSection {
  key: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

const sidebarSections: PermissionSection[] = [
  {
    key: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    description: "Project overview and summary",
  },
  {
    key: "tasks",
    label: "Tasks",
    icon: CheckSquare,
    description: "Task list and progress",
  },
  {
    key: "moodboard",
    label: "Moodboard",
    icon: Image,
    description: "Visual references and inspirations",
  },
  {
    key: "notes",
    label: "Notes",
    icon: StickyNote,
    description: "Project notes and documentation",
  },
  {
    key: "contacts",
    label: "Contacts",
    icon: Contact,
    description: "Client and stakeholder contacts",
  },
  {
    key: "calendar",
    label: "Calendar",
    icon: Calendar,
    description: "Timeline and planning",
  },
  {
    key: "surveys",
    label: "Surveys",
    icon: ClipboardList,
    description: "Client questionnaires and responses",
  },
  {
    key: "files",
    label: "Files",
    icon: Files,
    description: "Project files and assets",
  },
  {
    key: "shopping_list",
    label: "Materials",
    icon: ShoppingCart,
    description: "Material list and procurement",
  },
  {
    key: "labor",
    label: "Labor",
    icon: Hammer,
    description: "Work scope and labor entries",
  },
  {
    key: "estimations",
    label: "Estimations",
    icon: Calculator,
    description: "Cost estimations and quotes",
  },
  {
    key: "settings",
    label: "Settings",
    icon: Settings,
    description: "Project configuration (usually hidden)",
  },
];

const getDefaultPermissions = () => {
  const permissions: Record<string, { visible: boolean }> = {};
  sidebarSections.forEach((section) => {
    permissions[section.key] = {
      visible: section.key !== "settings",
    };
  });
  return permissions;
};

export default function SidebarPermissions({ projectId }: SidebarPermissionsProps) {
  const project = useQuery(apiAny.projects.getProject, { projectId });
  const portalConfig = useQuery(apiAny.projects.getClientPortalConfiguration, { projectId });

  const updatePermissions = useMutation(apiAny.projects.updateProjectSidebarPermissions);
  const publishPortal = useMutation(apiAny.projects.publishClientPortal);

  const [permissions, setPermissions] = useState<Record<string, { visible: boolean }>>(getDefaultPermissions());
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    if (!portalConfig?.draftPermissions) {
      return;
    }

    setPermissions(portalConfig.draftPermissions);
    setHasChanges(false);
  }, [portalConfig?.draftPermissions]);

  const updatePermission = (sectionKey: string, value: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      [sectionKey]: {
        visible: value,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async (silent = false) => {
    setIsSaving(true);
    try {
      await updatePermissions({
        projectId,
        sidebarPermissions: permissions,
      });
      setHasChanges(false);
      if (!silent) {
        toast.success("Portal draft saved", {
          description: "Draft saved. Click Update Portal when you want clients to see it.",
        });
      }
      return true;
    } catch (error) {
      if (!silent) {
        toast.error("Failed to save portal draft", {
          description: (error as Error).message || "Try again.",
        });
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      if (hasChanges) {
        const saved = await handleSave(true);
        if (!saved) {
          throw new Error("Save draft first.");
        }
      }

      const result = await publishPortal({ projectId });
      toast.success("Client portal updated", {
        description: `Published version #${result.version}. Clients can now review and accept it.`,
      });
    } catch (error) {
      toast.error("Failed to update client portal", {
        description: (error as Error).message || "Try again.",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const resetToDefaults = () => {
    setPermissions(getDefaultPermissions());
    setHasChanges(true);
  };

  if (!project || portalConfig === undefined) {
    return <div>Loading client portal...</div>;
  }

  if (!portalConfig) {
    return <div>Client portal is not available for your role.</div>;
  }

  const publishLabel = portalConfig.publishedAt
    ? new Date(portalConfig.publishedAt).toLocaleString()
    : "Not published yet";

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg lg:text-xl">
          <Eye className="h-4 w-4 lg:h-5 lg:w-5" />
          Client Portal
        </CardTitle>
        <CardDescription className="text-sm">
          Prepare what clients can see, then publish with Update Portal. Clients only see the published version.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-4 lg:px-6">
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Portal version</p>
              <p className="text-sm font-semibold">#{portalConfig.version}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last publish</p>
              <p className="text-sm font-semibold">{publishLabel}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active clients</p>
              <p className="text-sm font-semibold">{portalConfig.stats.activeCustomers}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Accepted current version</p>
              <p className="text-sm font-semibold">{portalConfig.stats.acceptedCustomers}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {sidebarSections.map((section) => {
            const sectionPermissions = permissions[section.key] || { visible: section.key !== "settings" };
            const Icon = section.icon;

            return (
              <div key={section.key} className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <h4 className="text-sm font-medium">{section.label}</h4>
                      <p className="text-xs text-muted-foreground">{section.description}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`${section.key}-visible`}
                        checked={sectionPermissions.visible}
                        onChange={(e) => updatePermission(section.key, e.target.checked)}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <Label htmlFor={`${section.key}-visible`} className="text-xs flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        Visible in client portal
                      </Label>
                    </div>
                  </div>
                </div>

                {section.key !== sidebarSections[sidebarSections.length - 1].key && (
                  <Separator className="my-4" />
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => handleSave(false)}
              disabled={!hasChanges || isSaving || isPublishing}
              variant="outline"
              className="flex-1 sm:flex-none"
            >
              {isSaving ? (
                <>Saving draft...</>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Draft
                </>
              )}
            </Button>

            <Button
              onClick={handlePublish}
              disabled={isSaving || isPublishing}
              className="flex-1 sm:flex-none"
            >
              {isPublishing ? (
                <>Updating portal...</>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Update Portal
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={resetToDefaults}
              disabled={isSaving || isPublishing}
              className="flex-1 sm:flex-none"
            >
              Reset to defaults
            </Button>
          </div>

          {(hasChanges || portalConfig.hasUnpublishedChanges) && (
            <p className="text-xs text-muted-foreground mt-2">
              You have draft changes not yet published to clients.
            </p>
          )}
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h5 className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            How it works
          </h5>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>1. Edit what should be visible in the client portal.</li>
            <li>2. Save draft any time.</li>
            <li>3. Click Update Portal to publish a new version to clients.</li>
            <li>4. Clients can confirm the latest published version from their project view.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
